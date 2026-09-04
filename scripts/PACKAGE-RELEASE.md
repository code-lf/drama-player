# Livliv 部署打包

需要 PowerShell 7（`pwsh`）、Git、Node.js、pnpm 和 Windows 自带 tar。
先在需要构建的前端仓库安装依赖：`pnpm install --frozen-lockfile`。

默认仓库布局（同一父目录）：

```text
ai-create-video/
ai-create-video-api/
ai-create-video-admin-web/
```

在用户前端仓库运行交互菜单：

```powershell
pwsh -NoProfile -File .\scripts\package-release.ps1
```

直接指定需要的端，每次只生成一个 ZIP：

```powershell
# 只打用户前端
pwsh -NoProfile -File .\scripts\package-release.ps1 -Targets web
# 只打 API 代码
pwsh -NoProfile -File .\scripts\package-release.ps1 -Targets api
# 只打管理端
pwsh -NoProfile -File .\scripts\package-release.ps1 -Targets admin
# 三端构建并合为一个 ZIP
pwsh -NoProfile -File .\scripts\package-release.ps1 -Targets all
# 选择两端合为一个 ZIP
pwsh -NoProfile -File .\scripts\package-release.ps1 -Targets web,admin
```

可以通过 `-ApiRoot`、`-AdminRoot` 指定不同仓库位置，通过 `-OutputDir` 指定输出目录。
默认输出到 `artifacts/releases/`，包含 ZIP、SHA256 和独立构建日志。
ZIP 内的 `release-manifest.json` 记录选择的端、构建时间、Git 提交和工作区是否有修改。

## 安全与构建约定

- 每次重新构建所选前端，构建失败立即停止，不复用旧包；API 是 Python 源码包，不含虚拟环境。
- 用户前端固定按同源 `/api`、真实 HTTP 模式构建，并检查生成配置，避免上线后访问用户电脑的 127.0.0.1。
- 管理端按 `/admin/` 路径、同源 `/api` 构建；这些变量仅在当前构建期间生效，不修改本地 `.env`。Vben 部分插件直接读取配置文件，脚本会再核对最终产物，不符合要求就停止并提示检查 `.env.production` 和本地覆盖配置。
- 默认不包含任何真实 `.env`、API 运行数据、数据库备份或打包暂存；`.env.example` 只是模板。
- API 只收集 Git 已跟踪的 `app/`、`alembic/`、`scripts/` 和部署配置。新增代码请先检查并纳入 Git。
- 不自动安装依赖、不迁移数据库、不修改服务器、不自动提交或推送 Git。
- 失败时终端打印日志位置和末尾输出，请将日志中敏感信息打码后提供排查。

## 部署

先备份服务器代码和 `.env`，把 ZIP 覆盖解压到 `/www/wwwroot/livliv/`，不要先删除整个项目目录。
压缩包中只有选定端，例如 `web/.output/`、`api/app/`、`admin/dist/`，无需再解压内层 ZIP。
未选中的端无需更新。覆盖解压不会自动移除旧版本已废弃的文件，涉及删除文件的发布需单独核对。

- 用户端：重启 `livliv-web`；命令仍是 `node .output/server/index.mjs`。
- API：按该版本要求安装依赖/执行迁移，再重启 API 与两个 Celery worker。
- Admin：网站目录须对应 `admin/dist`，刷新浏览器缓存即可。
- 后端 `.env` 与前端运行环境不同。若 Node 进程显式设置了 `NUXT_PUBLIC_API_BASE`，仍会覆盖包内默认值，应确保是 `/api`。
- Nginx 需把 `/api/` 转发到 FastAPI；Nuxt 自带的 `/api/_nuxt_icon/` 路由应转发到 Node，而非 FastAPI。

不要把服务器 `.env` 放进 Git，也不要通过打包脚本执行生产数据库迁移。
