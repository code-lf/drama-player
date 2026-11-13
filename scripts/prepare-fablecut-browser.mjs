// 从固定发布归档生成浏览器实验包；不执行上游服务，不导入示例文件或字体。
import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import ts from 'typescript'
import {fileURLToPath} from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(root + 'third-party/fablecut/manifest.json', 'utf8'))
const archive = root + `.codex-runtime/fablecut-probe/fablecut-${manifest.version}.tgz`
if (`sha512-${createHash('sha512').update(await readFile(archive)).digest('base64')}` !== manifest.integrity) throw new Error('发布包完整性不符。')
const entry = name => execFileSync('tar', ['-xOf', archive, `package/${name}`], {maxBuffer: 16 * 1024 * 1024}).toString('utf8')
const metadata = JSON.parse(entry('package.json'))
if (metadata.version !== '1.18.0' || metadata.license !== 'MIT') throw new Error('发布身份不符。')
const html = entry('index.html'), style = entry('style.css')
const names = [...html.matchAll(/<script src="([a-z-]+\.js)"><\/script>/g)].map(match => match[1])
if (names.length !== 20 || names.at(-1) !== 'app.js') throw new Error('浏览器脚本清单变化。')
const patches = {
  connectServer: 'async function connectServer() { return false; }',
  syncFromServer: 'async function syncFromServer() { return false; }',
  scheduleSave: 'function scheduleSave() { state.dirtyTimeline = true; window.__livChanged?.(projectJSON()); }',
  saveNow: 'async function saveNow() { return false; }',
  pushUndo: 'function pushUndo() {}', undo: 'function undo() {}', redo: 'function redo() {}',
  loadLibraryFonts: 'function loadLibraryFonts() {}', runExportJobFromUrl: 'async function runExportJobFromUrl() {}',
}
const files = {}, hashes = {}
for (const name of names) {
  let source = entry(name)
  hashes[name] = createHash('sha256').update(source).digest('hex')
  if (name === 'app.js') {
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    const edits = [], found = new Set()
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && patches[node.name?.text]) {
        found.add(node.name.text); edits.push([node.getStart(ast), node.end, patches[node.name.text]]); return
      }
      // sandbox无持久化存储；原UI布局偏好也只放本次内存，不触发SecurityError中断初始化。
      if (ts.isIdentifier(node) && node.text === 'localStorage') edits.push([node.getStart(ast), node.end, 'livMemoryStorage'])
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'MIN_DUR') edits.push([node.initializer.getStart(ast), node.initializer.end, '0.04'])
      ts.forEachChild(node, visit)
    }
    visit(ast)
    if (found.size !== Object.keys(patches).length) throw new Error('原生函数补丁锚点不完整。')
    for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + value + source.slice(end)
  }
  files[name] = source
}
await mkdir(root + 'third-party/fablecut/browser', {recursive: true})
// 保留独立适配源码，避免生产压缩后Function.toString丢失闭包标识或重命名依赖。
const adapter=(await readFile(root+'features/editing/native-projection.mjs','utf8')).replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
await writeFile(root + 'third-party/fablecut/browser/bundle.json', JSON.stringify({version: manifest.version,adapter,
  // 保留完整DOM供上游事件接线，外壳只呈现受控区域；原script和外部link在srcdoc构造时移除。
  html, style, files}))
await writeFile(root + 'third-party/fablecut/browser/source-manifest.json', JSON.stringify({version: manifest.version, integrity: manifest.integrity, hashes,
  disabledFunctions: Object.keys(patches), persistence: 'platform-only', productionEnabled: false}, null, 2) + '\n')
console.log('已生成固定版本原生浏览器实验包；未注册正式入口。')
