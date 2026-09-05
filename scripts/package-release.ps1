#requires -Version 7.0
<#
.SYNOPSIS
选择用户前端、API、Admin，或一次构建三端并合成部署 ZIP。
.EXAMPLE
pwsh -NoProfile -File ./scripts/package-release.ps1
.EXAMPLE
pwsh -NoProfile -File ./scripts/package-release.ps1 -Targets all
.EXAMPLE
pwsh -NoProfile -File ./scripts/package-release.ps1 -Targets web,admin
#>
[CmdletBinding()]
param(
    # 不传时显示菜单；支持 web、api、admin、all，以及英文逗号组合。
    [string]$Targets = '',
    # 默认假设三端仓库位于同一父目录，也允许显式指定 API/Admin 仓库。
    [string]$ApiRoot = '',
    [string]$AdminRoot = '',
    # 默认输出到用户端仓库 artifacts/releases，已被 Git 忽略。
    [string]$OutputDir = ''
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$webRoot = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $webRoot
if (-not $ApiRoot) { $ApiRoot = Join-Path $workspace 'ai-create-video-api' }
if (-not $AdminRoot) { $AdminRoot = Join-Path $workspace 'ai-create-video-admin-web' }
if (-not $OutputDir) { $OutputDir = Join-Path $webRoot 'artifacts/releases' }

if (-not $Targets) {
    Write-Host '1 用户前端(web)   2 后端(api)   3 管理端(admin)   4 全部(all)'
    $Targets = Read-Host '请选择，可输入 1,3 或 web,admin'
}
$aliases = @{ '1' = 'web'; '2' = 'api'; '3' = 'admin'; '4' = 'all' }
$selected = @($Targets.Split(',') | ForEach-Object {
    $item = $_.Trim().ToLowerInvariant()
    if ($aliases.ContainsKey($item)) { $item = $aliases[$item] }
    if ($item -notin @('web', 'api', 'admin', 'all')) { throw "不支持的选项：$item" }
    $item
} | Select-Object -Unique)
if ('all' -in $selected) { $selected = @('web', 'api', 'admin') }
$roots = @{ web = $webRoot; api = $ApiRoot; admin = $AdminRoot }
foreach ($target in $selected) {
    $roots[$target] = (Resolve-Path -LiteralPath $roots[$target]).Path
}
foreach ($tool in @('git', 'tar')) { Get-Command $tool -ErrorAction Stop | Out-Null }
if ('web' -in $selected -or 'admin' -in $selected) { Get-Command pnpm -ErrorAction Stop | Out-Null }

$runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
$runtimeRoot = Join-Path $webRoot '.codex-runtime'
$stage = Join-Path $runtimeRoot "release-$runId"
$logDir = Join-Path $OutputDir "logs-$runId"
$null = New-Item -ItemType Directory -Path $stage, $logDir -Force
$archiveName = if ($selected.Count -eq 3) { 'all' } else { $selected -join '-' }
$archive = Join-Path (Resolve-Path -LiteralPath $OutputDir).Path "livliv-$archiveName-$runId.zip"
$manifest = [ordered]@{ createdAt = (Get-Date).ToString('o'); targets = $selected; envIncluded = $false; repositories = @{} }

function Invoke-Build {
    param([string]$Root, [string[]]$BuildArgs, [string]$LogPath)
    # 保存完整构建日志，命令失败立即停止，禁止用旧产物冒充本次成功构建。
    Push-Location -LiteralPath $Root
    try {
        & pnpm @BuildArgs *> $LogPath
        if ($LASTEXITCODE -ne 0) {
            Get-Content -LiteralPath $LogPath -Tail 60 | Out-Host
            throw "构建失败，请提供日志：$LogPath"
        }
        Get-Content -LiteralPath $LogPath -Tail 6 | Out-Host
    } finally { Pop-Location }
}

function Copy-ApiSources {
    param([string]$Root, [string]$Destination)
    # 收集当前工作区中“已跟踪文件 + 未被 .gitignore 排除的新文件”。
    # API 的迁移脚本经常先完成开发、验证后再提交；如果这里只读取已跟踪文件，发布包会静默漏掉
    # 新增的 Alembic 版本和服务文件，最终出现代码已更新但线上数据库无法升级的问题。
    # --exclude-standard 会继续遵守 .gitignore，因此 .env、虚拟环境、缓存和运行数据不会被纳入。
    $files = @(& git -C $Root -c core.quotepath=false ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw '无法读取 API Git 文件清单' }
    foreach ($file in $files) {
        if ($file -notmatch '^(app/|alembic/|scripts/|alembic\.ini$|pyproject\.toml$|uv\.lock$|requirements[^/]*\.txt$|README\.md$|CONFIGURATION\.md$|\.env\.example$)') { continue }
        if ($file -match '(^|/)(\.env(\..*)?|__pycache__|node_modules|\.venv)(/|$)' -and $file -ne '.env.example') { continue }
        if ($file -match '\.(pyc|log|dump|zip)$') { continue }
        $source = Join-Path $Root $file
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "待打包源码文件缺失：$file" }
        $dest = Join-Path $Destination $file
        $null = New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force
        Copy-Item -LiteralPath $source -Destination $dest
    }
}

try {
    foreach ($target in $selected) {
        $root = $roots[$target]
        $commit = & git -C $root rev-parse HEAD
        if ($LASTEXITCODE -ne 0) { throw "不是有效 Git 仓库：$root" }
        $changes = @(& git -C $root status --porcelain)
        if ($LASTEXITCODE -ne 0) { throw "无法读取工作区状态：$root" }
        $manifest.repositories[$target] = @{ commit = "$commit"; dirty = $changes.Count -gt 0 }
        if ($changes.Count) {
            # dirty 只表示发布内容尚未形成 Git 提交；API 的未忽略新源码也会按下方白名单进入包内。
            Write-Warning "$target 有本地修改，本次使用当前工作区；发布清单会记录 dirty=true。"
        }
        $dest = Join-Path $stage $target
        $null = New-Item -ItemType Directory -Path $dest -Force
        Write-Host "正在打包 $target ..."
        if ($target -eq 'api') {
            Copy-ApiSources -Root $root -Destination $dest
            continue
        }

        # 临时设置构建变量，不改写开发者的 .env；退出后恢复原进程环境。
        $buildEnv = if ($target -eq 'web') {
            @{ NUXT_PUBLIC_API_BASE = '/api'; NUXT_PUBLIC_API_ADAPTER = 'http' }
        } else {
            @{ VITE_BASE = '/admin/'; VITE_GLOB_API_URL = '/api' }
        }
        $savedEnv = @{}
        foreach ($name in $buildEnv.Keys) {
            $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
            [Environment]::SetEnvironmentVariable($name, $buildEnv[$name], 'Process')
        }
        try {
            $buildArgs = if ($target -eq 'web') { @('build') } else { @('--filter', '@vben/web-antd', 'build') }
            Invoke-Build -Root $root -BuildArgs $buildArgs -LogPath (Join-Path $logDir "$target-build.log")
        } finally {
            foreach ($name in $savedEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnv[$name], 'Process') }
        }
        if ($target -eq 'web') {
            # 检查实际生成的配置，而不是只相信环境变量和构建退出码。
            $configs = @(Get-ChildItem -LiteralPath (Join-Path $root '.output/server/chunks') -Recurse -Filter '*.mjs' |
                Select-String -Pattern '"apiBase"\s*:' | ForEach-Object { $_.Line })
            if (-not $configs.Count -or @($configs | Where-Object { $_ -notmatch '"apiBase"\s*:\s*"/api"' }).Count) {
                throw '前端产物 API 地址检查失败：要求 apiBase=/api，禁止把本机地址发给用户。'
            }
            Copy-Item -LiteralPath (Join-Path $root '.output') -Destination (Join-Path $dest '.output') -Recurse
        } else {
            # Vben 的部分插件直接读取 .env 文件，不完全遵循进程变量，必须核对最终产物。
            $adminDist = Join-Path $root 'apps/web-antd/dist'
            $appConfigs = @(Get-ChildItem -LiteralPath $adminDist -Filter '_app-config-*.js')
            if (-not $appConfigs.Count) { throw '管理端缺少运行配置文件，停止打包' }
            foreach ($configFile in $appConfigs) {
                $content = Get-Content -LiteralPath $configFile.FullName -Raw
                if ($content -notmatch '"VITE_GLOB_API_URL"\s*:\s*"/api"') {
                    throw '管理端产物接口不是 /api，请检查 apps/web-antd/.env.production 和本地覆盖配置。'
                }
            }
            $index = Get-Content -LiteralPath (Join-Path $adminDist 'index.html') -Raw
            if ($index -notmatch '(src|href)="/admin/') {
                throw '管理端产物部署路径不是 /admin/，请检查 VITE_BASE 配置。'
            }
            Copy-Item -LiteralPath (Join-Path $root 'apps/web-antd/dist') -Destination (Join-Path $dest 'dist') -Recurse
        }
    }

    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stage 'release-manifest.json') -Encoding utf8
    # ZIP 根目录直接为 api/web/admin，解压到 /www/wwwroot/livliv，不再套一层目录。
    & tar -a -cf $archive -C $stage @selected release-manifest.json
    if ($LASTEXITCODE -ne 0) { throw '创建 ZIP 失败' }
    $entries = @(& tar -tf $archive)
    if ($LASTEXITCODE -ne 0) { throw '无法读取 ZIP，校验失败' }
    $entrypoints = @{ web = 'web/.output/server/index.mjs'; api = 'api/app/main.py'; admin = 'admin/dist/index.html' }
    foreach ($target in $selected) {
        if ($entrypoints[$target] -notin $entries) { throw "部署入口缺失：$($entrypoints[$target])" }
    }
    if ($entries | Where-Object { $_ -match '(^|/)\.env$|(^|/)\.env\.(?!example$)[^/]+$|^api/\.data/' }) {
        throw 'ZIP 包含环境密钥或运行数据，请勿部署！'
    }
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    "$hash  $([IO.Path]::GetFileName($archive))" | Set-Content -LiteralPath "$archive.sha256" -Encoding utf8
    Write-Host "打包成功：$archive"
    Write-Host "SHA256：$hash"
    Write-Host "日志：$logDir"
    Write-Host '先备份，再覆盖解压到 /www/wwwroot/livliv；保留服务器 .env 和数据。'
    Write-Host '更新 web 后重启 livliv-web；更新 api 后重启 API 和两个 Celery；admin 刷新浏览器。'
} catch {
    Write-Host "打包失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host "请提供本次日志目录协助排查：$logDir；失败产物不要部署。"
    throw
} finally {
    # 仅清理本次随机创建的暂存目录，校验父目录后使用原生 PowerShell 删除。
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if ((Split-Path -Parent $resolvedStage) -eq [IO.Path]::GetFullPath($runtimeRoot) -and
        (Split-Path -Leaf $resolvedStage) -eq "release-$runId") {
        if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
    }
}
