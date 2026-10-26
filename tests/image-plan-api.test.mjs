// 执行真实服务适配器，仅替换网络边界；测试不会访问本地账户或触发采购。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

function adapter(){
  const source=readFileSync('shared/api/services/creationService.ts','utf8')
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
    .replace(/^import[^\n]+httpAdapter[^\n]+\n/m,'').replace('export const creationService','const creationService')
  const calls=[],request=async(...args)=>{calls.push(args);return {revision:2,target:'image',execution_available:false,quote:null}}
  return {calls,service:new Function('request',`${js};return creationService`)(request)}
}

test('读取图片计划不请求视频计划、核价或任务接口',async()=>{
  const {calls,service}=adapter()
  const value=await service.imagePlan('fixed-run')
  assert.deepEqual(calls,[['/creation/runs/fixed-run/image-plan']])
  assert.equal(value.execution_available,false)
})

test('图片准备和确认复用稳定原命令，不借用视频路由或客户端金额',async()=>{
  const {calls,service}=adapter(),command={expected_revision:2,quote_id:'fixed-quote',request_id:'same-confirmation'}
  await service.prepareImageBatch('images',command);await service.confirmImageBatch('images',command)
  assert.deepEqual(calls,[['/creation/runs/images/image-plan/prepare-execution',{method:'POST',body:command}],['/creation/runs/images/image-plan/confirm',{method:'POST',body:command}]])
})

test('保存图片计划只传原命令，网络重试不换请求号或添加价格许可',async()=>{
  const {calls,service}=adapter()
  const command={expected_revision:1,request_id:'stable-request',selected_ids:['image-2'],items:[]}
  await service.saveImagePlan('fixed-run',command)
  await service.saveImagePlan('fixed-run',command)
  assert.deepEqual(calls,Array.from({length:2},()=>['/creation/runs/fixed-run/image-plan',{method:'PATCH',body:command}]))
  assert.deepEqual(command,{expected_revision:1,request_id:'stable-request',selected_ids:['image-2'],items:[]})
})

test('图片逐张核价使用独立POST命令，重试保持修订和请求号，不调用确认或视频接口',async()=>{
  const {calls,service}=adapter()
  const command={expected_revision:3,request_id:'stable-quote-request'}
  await service.quoteImagePlan('fixed-run',command);await service.quoteImagePlan('fixed-run',command)
  assert.deepEqual(calls,Array.from({length:2},()=>['/creation/runs/fixed-run/image-plan/quote',{method:'POST',body:command}]))
})
