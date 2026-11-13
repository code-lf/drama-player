// 运行真实路由函数；仅替代H3请求对象，不访问私有素材、不启动上游服务。
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {createNativeFrameDocument} from '../features/editing/native-frame-document.mjs'
const source=readFileSync(new URL('../server/routes/editing-native-frame.get.ts',import.meta.url),'utf8')
const bundle=JSON.parse(readFileSync(new URL('../third-party/fablecut/browser/bundle.json',import.meta.url)))
function route(){
  const module={exports:{}}
  const compiled=ts.transpileModule(source.replace(/^import .*\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  new Function('module','exports','bundle','createNativeFrameDocument','defineEventHandler','getQuery','setResponseHeaders','createError',compiled)(
    module,module.exports,bundle,createNativeFrameDocument,fn=>fn,e=>e.query,(e,headers)=>e.headers=headers,value=>Object.assign(new Error(value.statusMessage),value))
  return module.exports.default
}
test('隔离壳独立加载并强制sandbox，不含用户草稿或可执行任意参数',()=>{
  const event={query:{channel:'a'.repeat(32),nonce:'b'.repeat(32),url:'https://untrusted.test/secret'}}
  const html=route()(event)
  assert.match(html,/FableCut/);assert.doesNotMatch(html,/untrusted\.test/)
  assert.match(event.headers['content-security-policy'],/^sandbox allow-scripts;/)
  assert.match(event.headers['content-security-policy'],/frame-ancestors 'self'/)
  assert.equal(event.headers['cache-control'],'no-store')
})
test('非法握手身份明确拒绝，不允许把输入插入脚本或放宽CSP',()=>{
  for(const query of [{},{channel:'a'.repeat(32),nonce:"'unsafe-inline'"},{channel:['a'.repeat(32)],nonce:'b'.repeat(32)}])
    assert.throws(()=>route()({query}),{statusCode:400})
})
