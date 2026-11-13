// 第三方源码机械导入：只读已下载发布包，不联网、不执行安装脚本或上游服务器。
import {readFile, mkdir, copyFile, writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(path.join(root, 'third-party/fablecut/manifest.json'), 'utf8'))
const probe = path.join(root, '.codex-runtime/fablecut-probe')
const archive = await readFile(path.join(probe, `fablecut-${manifest.version}.tgz`))
const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`
if (integrity !== manifest.integrity) throw new Error('发布包完整性不符，拒绝导入。')
const upstream = path.join(probe, 'package')
const metadata = JSON.parse(await readFile(path.join(upstream, 'package.json'), 'utf8'))
if (metadata.name !== manifest.name || metadata.version !== manifest.version || metadata.license !== 'MIT') {
  throw new Error('发布包身份或许可声明不符。')
}
const license = await readFile(path.join(upstream, 'LICENSE'), 'utf8')
if (!license.startsWith('MIT License') || !license.includes('Copyright (c) 2026 ronak-create')) throw new Error('缺少上游许可。')
const validated = []
// 全部验证成功后才机械复制；不引入原版app.js、服务、字体、音乐或第三方库。
for (const [name, digest] of Object.entries(manifest.files)) {
  const source = await readFile(path.join(upstream, name), 'utf8')
  if (createHash('sha256').update(source).digest('hex') !== digest) throw new Error(`${name}源码指纹不符。`)
  let patched = source
  for (const patch of manifest.patches.filter(p => p.file === name)) {
    if (patched.split(patch.find).length !== 2) throw new Error(`${name}补丁锚点不唯一。`)
    patched = patched.replace(patch.find, patch.replace)
  }
  validated.push([name, patched])
}
const target = path.join(root, 'third-party/fablecut')
await mkdir(target, {recursive: true})
await copyFile(path.join(upstream, 'LICENSE'), path.join(target, 'LICENSE'))
for (const [name, source] of validated) await writeFile(path.join(target, name), source)
// 浏览器采用静态ESM工厂，不让打包器解析原UMD的Node require，也不使用eval。
// 首版只调用分割内核；遮罩/追踪/运动依赖不开放，由上层白名单共同约束。
const edit=validated.find(([name])=>name==='edit-ops.js')[1]
const anchor='function (MaskLib, TrackLib, MotionLib) {'
const body=edit.slice(edit.indexOf(anchor)+anchor.length,edit.lastIndexOf('});'))
await writeFile(path.join(target,'edit-ops-browser.mjs'),'// 由prepare-fablecut-kernel.mjs从固定MIT源码机械生成，勿手改。\nconst kernel=(function(MaskLib,TrackLib,MotionLib){'+body+'})(undefined,undefined,undefined);\nexport default kernel;\n')
console.log(JSON.stringify({version: manifest.version, imported: validated.map(([name]) => name), productionEnabled: false}))
