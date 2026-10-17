// 实际执行系统状态文案规则；不改写用户提示词，不创建生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/taskPresentation.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {taskStatusText,compactTaskFailure,isSubmittedTask,taskNoticeState,showTaskNotice}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('系统任务文案不再泄露接入术语，包括历史返回说明',()=>{
  assert.equal(taskStatusText('供应商正在处理作品'),'正在生成作品')
  assert.equal(taskStatusText('供应商进度 · 0%'),'生成进度 · 0%')
  assert.equal(taskStatusText('供应商反馈：图片未通过审核'),'图片未通过审核')
  assert.equal(taskStatusText('ToAPIs 上游响应超时'),'生成服务 生成服务响应超时')
})

test('已知长错误使用短文案，真实重试保留次数，未知原因不截断',()=>{
  assert.equal(compactTaskFailure('图片生成服务暂时异常，本次失败不会扣除积分，请稍后免费重试。'),'生成失败，请稍后重试')
  assert.equal(compactTaskFailure('图片未通过安全审核。请调整可能涉及敏感内容的描述或参考素材后免费重试。'),'未通过安全审核，请修改需求')
  assert.equal(compactTaskFailure('图片生成服务暂时异常。 正在尝试 3/3。'),'生成遇到问题，正在重试 3/3')
  assert.equal(compactTaskFailure('参考素材已失效，请重新选择'),'参考素材已失效，请重新选择')
})

test('提交和进行态分开，失败、未知及结果读取不能标绿',()=>{
  for(const state of ['queued','processing','running'])assert.equal(isSubmittedTask(state),true)
  for(const state of ['','failed','completed','result_pending','cancelled'])assert.equal(isSubmittedTask(state),false)
  const notice=readFileSync(new URL('../features/creation/components/CreationTaskNotice.vue',import.meta.url),'utf8')
  assert.equal(taskNoticeState('submitting').text,'任务已提交 · 右侧查看进度')
  assert.equal(taskNoticeState('queued').kind,'running')
  assert.ok(notice.includes('justify-content:center'))
  assert.ok(notice.includes('var(--color-state-success)'))
})

test('排队、生成和读取结果使用进行状态，真实零进度保留',()=>{
  assert.equal(taskNoticeState('queued','',0).text,'排队中 · 0%')
  for(const status of ['in_progress','processing','running']){
    assert.equal(taskNoticeState(status,'',10).text,'正在生成作品 · 10%')
    assert.equal(taskNoticeState(status,'',null).text,'正在生成作品')
  }
  assert.equal(taskNoticeState('result_pending').text,'正在读取生成结果')
  assert.equal(taskNoticeState('result_pending').kind,'running')
  for(const progress of [NaN,Infinity,-1,101])assert.equal(taskNoticeState('running','',progress).text,'正在生成作品')
})
test('部分结果到达不能提前隐藏进行状态，完成后才让结果卡接替',()=>{
  for(const status of ['queued','in_progress','status_unavailable','failed'])assert.equal(showTaskNotice(status,true),true)
  for(const status of ['completed','success','succeeded'])assert.equal(showTaskNotice(status,true),false)
  assert.equal(showTaskNotice('completed',false),true)
})
test('真实重试仍显示进行中，断线和失败不沿用旧百分比',()=>{
  const retry=taskNoticeState('in_progress','生成服务繁忙，正在尝试 2/3',null,true,true)
  assert.equal(retry.kind,'running')
  assert.equal(retry.text,'生成遇到问题，正在重试 2/3')
  assert.equal(taskNoticeState('status_unavailable','',10).text,'正在同步任务状态')
  assert.equal(taskNoticeState('failed','图片未通过安全审核',10).text,'未通过安全审核，请修改需求')
  assert.equal(taskNoticeState('completed','',100).text,'生成已完成')
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.ok(studio.includes(':progress="taskActivity[item.id]?.progress"'))
})

test('状态读取失败进入同步提示并继续查询，不保留生成百分比假象',()=>{
  const workspace=readFileSync(new URL('../features/creation/useCreationWorkspace.ts',import.meta.url),'utf8')
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  assert.ok(workspace.includes("status:'status_unavailable'"))
  assert.ok(workspace.includes("'result_pending','status_unavailable'].includes"))
  assert.ok(canvas.includes("v-if=\"status==='status_unavailable'\""))
  assert.ok(canvas.includes('正在同步任务状态'))
  assert.equal(isSubmittedTask('status_unavailable'),false)
})

test('刷新后的状态查询限流进入冷却，不污染另一个方案的报价错误',()=>{
  const workspace=readFileSync(new URL('../features/creation/useCreationWorkspace.ts',import.meta.url),'utf8')
  const adapter=readFileSync(new URL('../shared/api/adapters/httpAdapter.ts',import.meta.url),'utf8')
  const maintenance=readFileSync(new URL('../components/system/SystemMaintenanceGate.vue',import.meta.url),'utf8')
  assert.ok(adapter.includes('retry: 0'))
  assert.ok(workspace.includes('if(Date.now()<resultRateLimitedUntil)'))
  assert.ok(workspace.includes('resultRateLimitedUntil=Date.now()+60000'))
  assert.ok(workspace.includes('Math.max(resultRateLimitedUntil-Date.now()'))
  const catchBlock=workspace.slice(workspace.indexOf("const prior=taskData[item.id]"),workspace.indexOf('pollFailures=failed?'))
  assert.ok(!catchBlock.includes('error.value='))
  assert.ok(maintenance.includes('Date.now()-lastReadAt<30000'))
})
test('正常状态说明保持原样，合法零进度不会被隐藏',()=>{
  assert.equal(taskStatusText('正在保存创作结果'),'正在保存创作结果')
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  assert.ok(canvas.includes('v-if="progress!=null"'))
  assert.ok(canvas.includes('aria-label="生成进度"'))
  assert.ok(canvas.includes('<UProgress :model-value="progress"'))
  assert.ok(canvas.includes('taskStatusText(detail'))
})
