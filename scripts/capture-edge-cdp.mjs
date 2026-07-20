import fs from 'node:fs/promises'

/**
 * Product Design 本地视觉验收脚本。
 *
 * 为什么使用 Edge CDP：
 * - 用户明确指定 Microsoft Edge；
 * - 通过浏览器原生 DevTools Protocol 注入本地登录态、固定视口并截图；
 * - 不引入 Playwright，也不会污染业务运行代码。
 */
const debuggerPort = process.env.EDGE_DEBUG_PORT || '9222'
const targetUrl = process.env.CAPTURE_URL || 'http://127.0.0.1:3000/dashboard'
const outputPath = process.env.CAPTURE_OUTPUT || 'artifacts/design-audit/asset-workspace.png'
const authSession = process.env.CAPTURE_AUTH_SESSION || ''
const extraStorage = JSON.parse(process.env.CAPTURE_LOCAL_STORAGE || '{}')
const width = Number(process.env.CAPTURE_WIDTH || 2048)
const height = Number(process.env.CAPTURE_HEIGHT || 1024)
const commandTimeout = Number(process.env.CAPTURE_COMMAND_TIMEOUT || 15000)

/**
 * CDP 或 WebSocket 连接异常时必须主动失败，而不是让视觉验收脚本永久挂起。
 * 错误里保留当前阶段名称，便于区分“Edge 未开放调试端口”和“某条 CDP 指令无响应”。
 */
function withTimeout(promise, label, timeout = commandTimeout) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${timeout}ms）`)), timeout)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer))
}

const pages = await withTimeout(
  fetch(`http://127.0.0.1:${debuggerPort}/json`).then(response => response.json()),
  '读取 Edge 调试页面',
)
// Edge 首次启动有时会同时打开同步确认页；必须选择产品同源页面，
// 否则 localStorage 会被写入 edge:// 域名，业务页自然仍会跳回登录。
const page = pages.find(item => item.type === 'page' && String(item.url || '').startsWith('http://127.0.0.1:3000'))
  || pages.find(item => item.type === 'page')
if (!page?.webSocketDebuggerUrl) throw new Error('未找到 Edge 调试页面')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await withTimeout(new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
}), '连接 Edge WebSocket')

let commandId = 0
const waiters = new Map()
const runtimeErrors = []
socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
  if (payload.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(payload.params?.exceptionDetails?.exception?.description || payload.params?.exceptionDetails?.text || '未知运行时异常')
  }
  if (payload.method === 'Log.entryAdded' && ['error', 'warning'].includes(payload.params?.entry?.level)) {
    runtimeErrors.push(payload.params.entry.text)
  }
  if (!payload.id || !waiters.has(payload.id)) return
  const { resolve, reject } = waiters.get(payload.id)
  waiters.delete(payload.id)
  payload.error ? reject(new Error(payload.error.message)) : resolve(payload.result)
})

function send(method, params = {}) {
  commandId += 1
  const id = commandId
  socket.send(JSON.stringify({ id, method, params }))
  return withTimeout(
    new Promise((resolve, reject) => waiters.set(id, { resolve, reject })),
    `CDP ${method}`,
  )
}

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false,
})

// 先停留在同源页面写入登录态与工作流步骤，再导航到目标页。
const storageEntries = {
  ...(authSession ? { 'livliv-auth-session': authSession } : {}),
  ...extraStorage,
}
await send('Runtime.evaluate', {
  expression: `Object.entries(${JSON.stringify(storageEntries)}).forEach(([key,value]) => localStorage.setItem(key, value))`,
  awaitPromise: true,
})
await send('Page.navigate', { url: targetUrl })

// 等待 Nuxt 页面和接口数据稳定，避免把加载骨架误当成最终实现。
await new Promise(resolve => setTimeout(resolve, 6500))
await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' })
if (process.env.CAPTURE_CLICK_SELECTOR) {
  // 用于抽屉、菜单等交互态验收；点击行为仍由真实页面事件完成。
  await send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(process.env.CAPTURE_CLICK_SELECTOR)})?.click()`,
  })
  await new Promise(resolve => setTimeout(resolve, 900))
}
if (process.env.CAPTURE_CLICK_SEQUENCE) {
  /**
   * 支持按顺序验收“勾选 → 打开确认弹窗 → 最终确认”这类多步核心交互。
   * 环境变量使用 JSON 数组，每一步都可以设置独立等待时间；这样不会把测试逻辑写进业务组件。
   */
  const sequence = JSON.parse(process.env.CAPTURE_CLICK_SEQUENCE)
  for (const step of sequence) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { const element = document.querySelector(${JSON.stringify(step.selector)}); if (!element) return false; element.click(); return true })()`,
      returnByValue: true,
    })
    if (!result.result?.value) throw new Error(`未找到交互验收元素：${step.selector}`)
    await new Promise(resolve => setTimeout(resolve, Number(step.wait || 900)))
  }
}
if (process.env.CAPTURE_DIAGNOSTICS === '1') {
  const diagnostics = await send('Runtime.evaluate', {
    // 同时记录浮层锚点和实际浮层坐标，用于定位“视觉上跑到屏幕边缘”这类只看截图难以判断的错误。
    expression: `JSON.stringify({url: location.href, text: document.body.innerText.slice(0, 1800), asset: document.querySelector('.asset-workspace')?.outerHTML.slice(0, 1200) || '', html: document.querySelector('main')?.innerHTML.slice(0, 600) || '', floating: {anchor: (() => { const e = document.querySelector('.status-select'); return e ? {...e.getBoundingClientRect().toJSON(), className: e.className} : null })(), layers: [...document.body.children].filter(e => getComputedStyle(e).position === 'fixed').map(e => ({className:e.className, style:e.getAttribute('style'), rect:e.getBoundingClientRect().toJSON()}))}})`,
    returnByValue: true,
  })
  console.log(diagnostics.result?.value || '')
  if (runtimeErrors.length) console.log(JSON.stringify({ runtimeErrors }, null, 2))
}
const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
})
await fs.mkdir(outputPath.split(/[\\/]/).slice(0, -1).join('/') || '.', { recursive: true })
await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'))
socket.close()
