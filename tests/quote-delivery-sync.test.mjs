// 报价准备只读同步，不允许为了恢复确认卡再次报价、采购或覆盖本地编辑。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../features/creation/'+p,import.meta.url),'utf8')
const js=ts.transpileModule(read('imagePlanState.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {imagePlanNeedsPolling}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('无批次的图片异步报价也会继续读取，就绪和失败即退出等待',()=>{
  assert.equal(imagePlanNeedsPolling({status:'draft',quote_delivery:'pending'}),true)
  for(const quote_delivery of ['ready','failed'])assert.equal(imagePlanNeedsPolling({status:'draft',quote_delivery}),false)
  assert.equal(imagePlanNeedsPolling({status:'cancelled',quote_delivery:'pending'}),false)
})
test('图片与视频同步仅GET并保护本地修订和写操作',()=>{
  for(const kind of ['Image','Video']){
    const source=read(`components/Creation${kind}PlanCard.vue`)
    const start=source.indexOf('async function pollStatus'),end=source.indexOf('\nwatch(',start)
    const block=source.slice(start,end)
    assert.match(source,/quote_delivery==='pending'/)
    assert.match(block,new RegExp(`creationService\\.${kind.toLowerCase()}Plan\\(id\\)`))
    assert.match(block,/revision===local.value.revision|revision!==local.value.revision/)
    assert.match(block,/dirty.value/)
  }
})
