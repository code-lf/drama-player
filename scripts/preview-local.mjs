/** 本机构建包验收入口：显式指向本地代理，不沿用生产构建内置的线上API。 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** 仅覆盖本次子进程，不修改.env、发布配置或服务器环境。 */
export function localPreviewEnv(env = process.env) {
  return { ...env, HOST: '127.0.0.1', NUXT_PUBLIC_API_BASE: '/api',
    NUXT_API_SERVER_BASE: 'http://127.0.0.1:8000/api', NUXT_PUBLIC_API_ADAPTER: 'http' }
}

/** 只启动已经构建的用户端；后端未启动时保留真实错误，不切换线上兜底。 */
function start() {
  const entry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
  if (!existsSync(entry)) throw new Error('请先执行 pnpm build，再启动本地构建包。')
  const child = spawn(process.execPath, [entry], { stdio: 'inherit', env: localPreviewEnv() })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
  child.on('error', () => { console.error('本地用户端启动失败。'); process.exitCode = 1 })
  child.on('exit', code => { process.exitCode = code ?? 1 })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
