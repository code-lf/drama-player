// 检查被移除的展示状态不残留，并保留真实授权及提交逻辑；不签署协议、不生成作品。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const source=readFileSync(new URL('../pages/dashboard.vue',import.meta.url),'utf8')
test('右上角安全协议摘要、专用状态及重复目录请求均已移除',()=>{
  assert.doesNotMatch(source,/featureNotice|legalDocuments|legalEntryError|查看功能告知|<span>安全协议<\/span>/)
  assert.doesNotMatch(source,/supportService.getLegalDocuments\(/)
  assert.match(source,/supportService.getLegalAcceptanceStatus\(/)
  assert.match(source,/requestFeatureConsent\(missingCodes\)/)
})
test('工作台清理后真实Vue模板编译通过',()=>{
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'dashboard'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'pages/dashboard.vue',id:'dashboard',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
