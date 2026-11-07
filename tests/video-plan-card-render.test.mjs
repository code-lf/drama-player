import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'
import {renderToString} from 'vue/server-renderer'

// 编译真实组件而非复制模板；只隔离基础控件和网络，不把 SSR 结果冒充浏览器点击验收。
function common(source,require=()=>{throw new Error('未声明的测试依赖')}){
  const module={exports:{}}
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports',code)(require,module,module.exports)
  return module.exports
}
const helpers=common(readFileSync(new URL('../features/creation/videoPlanState.ts',import.meta.url),'utf8'))
const confirmRules=common(readFileSync(new URL('../features/creation/confirmationRules.ts',import.meta.url),'utf8'))
const confirmDescriptor=parse(readFileSync(new URL('../features/creation/components/CreationConfirmationCard.vue',import.meta.url),'utf8')).descriptor
const confirmComponent=common(compileScript(confirmDescriptor,{id:'shared-confirm-test',inlineTemplate:true}).content,name=>name==='vue'?vue:confirmRules)
const previewDescriptor=parse(readFileSync(new URL('../features/creation/components/CreationMediaPreview.vue',import.meta.url),'utf8')).descriptor
const previewComponent=common(compileScript(previewDescriptor,{id:'preview-render-test',inlineTemplate:true}).content,name=>{if(name==='vue')return vue;throw Error('未知预览依赖 '+name)})
const resultDescriptor=parse(readFileSync(new URL('../features/creation/components/CreationResultCard.vue',import.meta.url),'utf8')).descriptor
const resultComponent=common(compileScript(resultDescriptor,{id:'result-render-test',inlineTemplate:true}).content,name=>name==='vue'?vue:previewComponent)
const {descriptor}=parse(readFileSync(new URL('../features/creation/components/CreationVideoPlanCard.vue',import.meta.url),'utf8'))
let apiCalls=0
const compiled=compileScript(descriptor,{id:'video-plan-render-test',inlineTemplate:true}).content
const component=common(compiled,name=>{
  if(name==='vue')return vue
  if(name.endsWith('planReview'))return common(readFileSync(new URL('../features/creation/planReview.ts',import.meta.url),'utf8'))
  if(name.endsWith('videoPlanState'))return helpers
  if(name.endsWith('videoResultAudit'))return common(readFileSync(new URL('../features/creation/videoResultAudit.ts',import.meta.url),'utf8'))
  if(name.endsWith('creationService'))return {creationService:new Proxy({},{get(){return ()=>{apiCalls++;throw new Error('渲染不得请求执行接口')}}})}
  if(name.endsWith('videoCompositionService'))return {videoCompositionService:new Proxy({},{get(){return ()=>{apiCalls++;throw new Error('渲染不得提交合成')}}})}
  if(name.endsWith('CreationMediaPreview.vue'))return previewComponent
  if(name.endsWith('CreationResultCard.vue'))return resultComponent
  if(name.endsWith('CreationConfirmationCard.vue'))return confirmComponent
  if(name.endsWith('.vue'))return {default:{props:['text'],setup:props=>()=>vue.h('span',props.text||'')}}
  throw new Error('未知依赖 '+name)
}).default
async function render(plan,extra={}){
  const app=vue.createSSRApp(component,{runId:'run',plan,...extra})
  app.component('UButton',{props:['disabled'],setup:(props,{slots})=>()=>vue.h('button',{disabled:props.disabled},slots.default?.())})
  app.component('UCheckbox',{props:['label','disabled','modelValue'],setup:props=>()=>vue.h('label',[vue.h('input',{type:'checkbox',disabled:props.disabled,checked:props.modelValue}),props.label])})
  app.component('UInput',{render:()=>vue.h('input')})
  app.component('UTextarea',{render:()=>vue.h('textarea')})
  app.component('UIcon',{render:()=>vue.h('i')})
  app.component('LivDialog',{props:['open'],setup:(props,{slots})=>()=>props.open?vue.h('section',slots.default?.()):null})
  return renderToString(app)
}
function plan(){return {schema_version:1,status:'draft',revision:1,total_count:2,selected_ids:['a','b'],allocation_note:'保留两条需求',batch_supported:true,
  items:['a','b'].map(id=>({id,title:'方案'+id,prompt:'独立完整分镜'+id,parameters:{model:'test-model',durationSec:15,aspectRatio:'9:16',resolution:'720p'},references:[]})),
  quote:{id:'quote',plan_revision:1,item_ids:['a','b'],items:[{id:'a',title:'方案a',credits:12},{id:'b',title:'方案b',credits:18}],total_credits:30,sufficient:true,expires_at:Date.now()/1000+300,execution_available:true}}}

test('停止卡片不显示；历史任务整行定位且不展示授权赘述',async()=>{
  const value=plan();value.status='stopped'
  assert.ok(!(await render(value)).includes('视频创作计划'))
  value.status='draft'
  const html=await render(value,{readonly:true,catalog:{skill_models:{'free:video':[{code:'test-model',name:'目录模型名称'}]},profiles:{}}})
  assert.ok(html.includes('liv-plan-inspect'))
  assert.ok(html.includes('目录模型名称'))
  assert.ok(!html.includes('不会恢复授权或生成'))
  assert.ok(!html.includes('编辑当前提示词'))
})

test('正式准备后只展示共用确认卡，任务规格和总价在同一卡内',async()=>{
  const html=await render(plan())
  assert.ok(html.includes('请确认本次 2 个视频生成任务'))
  assert.equal((html.match(/class="liv-generation-confirmation"/g)||[]).length,1)
  assert.ok(html.includes('30 积分')&&!html.includes('条费用之和'))
  assert.ok(!html.includes('liv-batch-total-value'))
  assert.ok(!html.includes('查看完整分镜'))
  assert.ok(html.includes('15 秒 · 9:16 · 720p'))
  assert.ok(html.includes('稍等一下'))
  assert.equal(apiCalls,0)
})

test('正式确认卡只列选中任务，未选择需求仍保留',async()=>{
  const value=plan();value.selected_ids=['a'];value.quote.item_ids=['a'];value.quote.items=value.quote.items.slice(0,1);value.quote.total_credits=12
  const html=await render(value)
  const cards=[...html.matchAll(/<article[^>]*class="([^"]*)"/g)].map(match=>match[1])
  assert.equal(cards.length,0)
  assert.ok(html.includes('请确认本次 1 个视频生成任务'))
  assert.equal((html.match(/liv-confirm-inspect/g)||[]).length,1)
  assert.ok(html.includes('未选择不等于放弃需求'))
  assert.equal(apiCalls,0)
})

test('视频方案只显示一次标题，单一主题确认方案入口仍不提交生成',async()=>{
  const value=plan();value.quote=null
  const html=await render(value)
  assert.equal((html.match(/>1\. 方案a</g)||[]).length,1)
  assert.ok(!html.includes('>选择方案a<'))
  assert.ok(html.includes('确认方案'))
  assert.ok(!html.includes('核算所选'))
  const source=readFileSync('features/creation/components/CreationVideoPlanCard.vue','utf8')
  assert.ok(source.includes('liv-plan-primary liv-plan-confirm'))
  assert.ok(source.includes('if(dirty.value)await save()'))
  assert.ok(source.includes('if(!dirty.value&&!error.value)await price()'))
  assert.ok(source.includes('min-height:44px!important'))
})

test('已有报价后改选择仍称确认方案，不显示更新方案',async()=>{
  // 报价与本次选择不一致时回到方案确认，原报价不能直接授权变更后的任务。
  const value=plan();value.selected_ids=['a']
  const html=await render(value)
  assert.ok(html.includes('确认方案'))
  assert.ok(!html.includes('更新方案'))
  assert.equal(apiCalls,0)
})

test('图片视频计划共用表面与按钮层级，排除复选框和成品卡，不新增平行基础组件',()=>{
  const image=readFileSync('features/creation/components/CreationImagePlanCard.vue','utf8'),video=readFileSync('features/creation/components/CreationVideoPlanCard.vue','utf8')
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  for(const component of [image,video]){
    assert.ok(component.includes('liv-media-plan'))
    assert.ok(component.includes('liv-plan-panel'))
    assert.ok(component.includes('class="liv-plan-primary"')||component.includes('<CreationConfirmationCard'))
    assert.ok(component.includes('<UCheckbox'))
  }
  assert.ok(css.includes(':not([role=checkbox]):not([role=switch]):not(.liv-result-card):not(.creation-image-plan-open)'))
  assert.ok(css.includes('background:var(--liv-ui-primary)!important'))
  assert.ok(css.includes(':not(.creation-image-plan-open){box-shadow:none}'))
  assert.ok(css.includes('.liv-media-plan .liv-plan-panel.is-selected{border-color:var(--liv-ui-primary-foreground)}'))
})
test('待确认及未完成批次不显示冗余工作台入口，不虚构片段或触发生成',async()=>{
  const value=plan()
  assert.ok(!(await render(value)).includes('成片计划与片段列表'))
  value.batch={completed:0,selected_count:2,items:[{item_id:'a',status:'needs_review',results:[]},{item_id:'b',status:'queued',results:[]}]}
  const html=await render(value,{readonly:true,history:true})
  assert.ok(!html.includes('成片计划与片段列表'))
  assert.ok(!html.includes('直接合成全部片段'))
  assert.equal(apiCalls,0)
})

test('刷新过期报价隐藏旧金额和过期错误卡，不能用旧报价确认且不自动发请求',async()=>{
  const value=plan();value.quote.expired=true;value.quote.expires_at=Date.now()/1000-1
  const html=await render(value)
  for(const text of ['报价已过期','30 积分','批次生成确认','确认生成 2 条'])assert.ok(!html.includes(text))
  assert.equal(apiCalls,0)
})
test('对话结果是右侧工作台入口，不渲染播放器、弹窗或完整分镜',async()=>{
  const value=plan();value.status='submitted'
  value.batch={completed:1,selected_count:1,items:[{item_id:'a',task_id:'task-a',status:'succeeded',results:[{id:'r',status:'succeeded',video_url:'https://example.com/a.mp4'}]}]}
  const html=await render(value,{readonly:true})
  assert.ok(html.includes('liv-result-card'))
  assert.ok(html.includes('在右侧工作台打开方案a'))
  assert.ok(html.includes('1 个视频')&&html.includes('细节'))
  // 首帧缩略图允许媒体节点，但绝无控制条或自动播放；点击属于外层工作台按钮。
  assert.ok(html.includes('<video')&&html.includes('muted')&&html.includes('aria-hidden="true"'))
  assert.ok(!html.includes('controls')&&!html.includes('autoplay'))
  assert.ok(!html.includes('role="dialog"'))
  assert.ok(!html.includes('w-full max-h-80 object-contain'))
  assert.ok(html.includes('直接合成全部片段')&&html.includes('调整片段后合成'))
  assert.ok(!html.includes('实际文件')&&!html.includes('查看完整分镜'))
  assert.equal(apiCalls,0)
})
test('过期、未正式准备或关闭批次能力不渲染收费确认',async()=>{
  for(const mutate of [p=>p.quote.expires_at=0,p=>p.quote.execution_available=false,p=>p.batch_supported=false]){
    const value=plan();mutate(value)
    assert.ok(!(await render(value)).includes('aria-label="批次生成确认"'))
  }
  assert.equal(apiCalls,0)
})
test('历史只读卡保留真实结果、失败重试和合成，不恢复确认或编辑',async()=>{
  const value=plan();value.status='submitted'
  value.batch={completed:1,selected_count:2,items:[{item_id:'a',task_id:'task-a',status:'succeeded',results:[{id:'result-a',status:'succeeded',video_url:'https://example.com/a.mp4'}]},
    {item_id:'b',task_id:'task-b',status:'failed',error:'实际失败原因',results:[]}]}
  const html=await render(value,{readonly:true,history:true})
  assert.ok(html.includes('https://example.com/a.mp4')&&html.includes('实际失败原因'))
  assert.ok(!html.includes('直接合成全部片段')&&html.includes('选择此失败条目重新核价'))
  assert.ok(!html.includes('编辑此方案')&&!html.includes('aria-label="批次生成确认"'))
  value.batch.items[1].status='needs_review'
  assert.ok(!(await render(value,{readonly:true,history:true})).includes('选择此失败条目重新核价'))
  assert.equal(apiCalls,0)
})
