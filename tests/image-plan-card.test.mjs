// 挂载真实图片计划卡，仅替换网络和基础控件；不将夹具价格当作真实账户报价。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

const fixture=()=>({schema_version:1,revision:1,target:'image',plan_type:'product_set',status:'draft',skill:'product',skill_version:1,total_count:2,selected_ids:['image-1','image-2'],quote:null,execution_available:false,items:[1,2].map(n=>({id:`image-${n}`,title:`香水商品图${n}`,prompt:`独立的完整商品图${n}`,parameters:{model:'gpt-image-2-vip',count:1,aspectRatio:'1:1',resolution:'1K'},references:[]}))})
const priced=(plan=fixture())=>({...plan,quote:{id:'quote',plan_revision:plan.revision,item_ids:plan.selected_ids,items:plan.items.filter(item=>plan.selected_ids.includes(item.id)).map(item=>({id:item.id,title:item.title,credits:2})),total_credits:plan.selected_ids.length*2,current_balance:10,sufficient:true,expires_at:Date.now()/1000+300,expired:false,execution_available:false}})
const tick=async()=>{for(let i=0;i<6;i++)await vue.nextTick()}
const helperJs=ts.transpileModule(readFileSync('features/creation/resultCatalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const resultHelpers=await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`)
const stateJs=ts.transpileModule(readFileSync('features/creation/imagePlanState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const stateHelpers=await import(`data:text/javascript;base64,${Buffer.from(stateJs).toString('base64')}`)
test('图片批次区分排队、提交和实际生成，不把混合排队批次误标完成',()=>{
  const label=(...states)=>stateHelpers.imagePlanDeliveryLabel({batch:{items:states.map(delivery_status=>({delivery_status})),completed:0,selected_count:states.length}})
  assert.equal(label('queued'),'图片任务排队中')
  assert.equal(label('submitting'),'正在提交图片任务')
  assert.equal(label('queued','processing'),'图片生成中')
  assert.equal(label('result_pending'),'图片生成中')
})
// 挂载测试复用实际审核规则，防止自动核价误走采购提交。
const reviewJs=ts.transpileModule(readFileSync('features/creation/planReview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const reviewHelpers=await import(`data:text/javascript;base64,${Buffer.from(reviewJs).toString('base64')}`)
// 嵌套挂载实际确认卡，避免空桩掩盖图片入口与统一费用确认的接线问题。
const confirmationRules={exports:{}}
new Function('exports','module',ts.transpileModule(readFileSync('features/creation/confirmationRules.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(confirmationRules.exports,confirmationRules)
const confirmationModule={exports:{}}
const confirmationSource=compileScript(parse(readFileSync('features/creation/components/CreationConfirmationCard.vue','utf8')).descriptor,{id:'image-confirmation',inlineTemplate:true}).content
new Function('require','exports','module',ts.transpileModule(confirmationSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText)(name=>name==='vue'?vue:confirmationRules.exports,confirmationModule.exports,confirmationModule)

test('图片方案显示获准参考缩略图而不冒充结果，失败预览回退且点击只定位节点',async()=>{
  const plan=fixture();plan.items[0].references=[{version_id:'ref',item_id:'product'}]
  const ui=mount({plan,referencePreviews:{ref:{available:true,media_type:'image',preview_url:'/perfume.png'}}});await tick()
  const image=ui.find(el=>el.type==='img'&&el.props.src==='/perfume.png')
  assert.equal(image.props.alt,'香水商品图1 · 参考图')
  await ui.find(el=>el.type==='button'&&String(el.props.class).includes('creation-image-plan-open')).props.onClick();await tick()
  assert.deepEqual(ui.events,[['open','image-1']]);assert.equal(ui.calls.length,0)
  image.props.onError();await tick();assert.ok(ui.text().includes('参考图'))
  ui.app.unmount()
})

test('没有真实缩略图时只显示图片图标，不渲染“图片方案”占位文字',async()=>{
  const ui=mount();await tick()
  assert.ok(!ui.text().includes('图片方案'))
  assert.ok(ui.text().includes('香水商品图1'))
  assert.ok(ui.text().includes('gpt-image-2-vip · 1:1 · 1K'))
  ui.app.unmount()
})

test('已受理批次保留后台费用快照，成果区不重复展示价格或过期提示',async()=>{
  const plan=priced();plan.status='submitted';plan.quote.expired=true;plan.quote.sufficient=false
  plan.batch={items:[],completed:0,selected_count:2}
  const ui=mount({plan});await tick()
  assert.ok(!ui.text().includes('本次预计消耗'));assert.equal(ui.props.plan.quote.total_credits,4)
  assert.ok(!ui.text().includes('报价已过期'));assert.ok(!ui.text().includes('当前余额不足'))
  ui.app.unmount()
})

test('已确认图片在对话保持加载与明确提示，mock不冒充实际模型出图',async()=>{
  const plan={...fixture(),status:'submitted',batch:{completed:0,selected_count:1,items:[{item_id:'image-1',task_id:'one',delivery_status:'queued',mock:true,detail:'等待生成',results:[]}]}}
  const ui=mount({plan});await tick()
  assert.ok(ui.text().includes('图片任务排队中（0/1）'))
  assert.ok(ui.text().includes('停止对话不会中止生成'))
  assert.ok(ui.text().includes('开发 mock：使用已有样本'))
  assert.ok(!ui.text().includes('已完成 0 / 1'))
  assert.ok(ui.calls.every(call=>call[0]==='read'))
  ui.app.unmount()
})

test('失败图片只建立待核价草案，断线重用请求号；未知项不显示重试',async()=>{
  const plan={...fixture(),status:'submitted',batch:{items:[{item_id:'image-2',task_id:'two',status:'failed',delivery_status:'failed',results:[]}]}}
  let attempts=0
  const ui=mount({plan,retry:()=>{if(!attempts++)throw new Error('网络断开');return {run_id:'retry-run'}}});await tick()
  await ui.click('为此失败图片创建重试方案');await tick()
  await ui.click('为此失败图片创建重试方案');await tick()
  const retries=ui.calls.filter(value=>value[0]==='retry')
  assert.equal(retries.length,2);assert.equal(retries[0][2].request_id,retries[1][2].request_id)
  assert.deepEqual(retries[0][2].item_ids,['image-2'])
  assert.ok(ui.events.some(value=>value[0]==='retry'&&value[1]==='fixed-run'))
  assert.ok(ui.calls.every(value=>['retry','run'].includes(value[0])))
  ui.app.unmount()
  const unknown=mount({plan:{...plan,batch:{items:[{...plan.batch.items[0],delivery_status:'unknown'}]}}});await tick()
  assert.ok(!unknown.text().includes('为此失败图片创建重试方案'));unknown.app.unmount()
})

test('活动图片只GET原批次，隐藏页暂停、完成后停止，过期响应不能回退待执行方案',async()=>{
  const originalTimeout=globalThis.setTimeout,originalDocument=globalThis.document,queue=[]
  globalThis.setTimeout=(fn,ms,...args)=>{if(ms===4000){queue.push(fn);return 0}return originalTimeout(fn,ms,...args)}
  const batch={request_id:'batch-1',items:[{item_id:'image-1',task_id:'one',status:'queued',delivery_status:'queued',results:[]}],completed:0,selected_count:1}
  let response={...fixture(),status:'submitted',batch},ui
  try{
    globalThis.document={hidden:true}
    ui=mount({plan:response,read:()=>response});await tick()
    queue.shift()();await tick();assert.equal(ui.calls.length,0)
    globalThis.document.hidden=false
    // 服务端旧响应即使修订相同也不能把已提交计划变回可编辑草案。
    response=fixture();queue.shift()();await tick()
    assert.ok(ui.text().includes('图片任务排队中（0/1）'));assert.ok(!ui.text().includes('统一核价'))
    response={...fixture(),status:'submitted',batch:{...batch,completed:1,items:[{...batch.items[0],status:'success',delivery_status:'completed',results:[{id:'f',status:'success',image_url:'/real.png'}]}]}}
    queue.shift()();await tick()
    assert.ok(ui.text().includes('图片已生成（1/1）'));assert.equal(queue.length,0)
    assert.ok(ui.calls.every(value=>value[0]==='read'))
  }finally{ui?.app.unmount();globalThis.setTimeout=originalTimeout;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument}
})

test('未知与文件超时不无限轮询，已提交图片刷新恢复不取得费用许可',()=>{
  for(const delivery_status of ['unknown','result_error','failed','cancelled','completed']){
    const run={image_plan:{...fixture(),status:'submitted',batch:{items:[{delivery_status}]}}}
    assert.equal(stateHelpers.imagePlanNeedsPolling(run.image_plan),false)
    assert.equal(stateHelpers.hasSubmittedImagePlan(run),true)
  }
})

test('新版报价一次点击准备并确认两张；无自动确认，双击不重复提交',async()=>{
  let resolve
  const plan=priced({...fixture(),batch_supported:true})
  const ui=mount({plan,prepare:()=>new Promise(done=>resolve=done)});await tick()
  assert.equal(ui.calls.length,0)
  assert.ok(ui.text().includes('请确认本次 2 个图片生成任务'))
  const pending=ui.click('确认执行');await tick()
  await ui.click('确认执行');await tick()
  assert.deepEqual(ui.calls.map(value=>value[0]),['prepare'])
  resolve({...plan,execution_available:true});await pending;await tick()
  assert.deepEqual(ui.calls.map(value=>value[0]),['prepare','confirm'])
  assert.deepEqual(ui.calls[0][2],ui.calls[1][2])
  assert.equal(ui.calls[0][2].quote_id,'quote');assert.ok(ui.text().includes('（0/2）'))
  ui.app.unmount()
})

test('提交断线保留确认请求号；准备金额变化则不得继续生成',async()=>{
  let count=0
  const plan=priced({...fixture(),batch_supported:true})
  const ui=mount({plan,confirm:()=>{count++;throw new Error('连接中断，请核对原批次')}});await tick()
  await ui.click('确认执行');await tick()
  await ui.click('确认执行');await tick()
  assert.equal(count,2)
  assert.equal(new Set(ui.calls.filter(value=>['prepare','confirm'].includes(value[0])).map(value=>value[2].request_id)).size,1)
  ui.app.unmount()
  const changed=mount({plan,prepare:()=>({...plan,execution_available:true,quote:{...plan.quote,total_credits:6}})});await tick()
  await changed.click('确认执行');await tick()
  assert.deepEqual(changed.calls.map(value=>value[0]),['prepare','read'])
  assert.ok(changed.text().includes('未提交生成'));changed.app.unmount()
})

test('刷新只显示原待恢复命令，报价过期后显式恢复提交也不准备新采购',async()=>{
  const plan=priced({...fixture(),batch_supported:true})
  plan.quote.expires_at=Date.now()/1000-1;plan.quote.expired=true
  plan.flow_runtime={engine:'langgraph',version:'creation-flow-v2',phase:'prepared',pending_command:{action:'confirm',request_id:'server-original-request'}}
  const ui=mount({plan});await tick()
  assert.equal(ui.calls.length,0)
  assert.ok(!ui.text().includes('确认生成'));assert.ok(!ui.text().includes('报价已过期'))
  assert.ok(!ui.text().includes('本次预计消耗'));assert.equal(ui.calls.length,0)
  await ui.click('恢复原提交状态');await tick()
  assert.deepEqual(ui.calls,[['resume','fixed-run',{action:'confirm',request_id:'server-original-request'}]])
  assert.ok(ui.text().includes('（0/0）'));ui.app.unmount()
})

test('图片统一确认稍等后隐藏计划，取消失败不伪造停止或提交生成',async()=>{
  const plan=priced({...fixture(),batch_supported:true})
  const ui=mount({plan});await tick()
  await ui.click('稍等一下');await tick()
  assert.deepEqual(ui.calls,[['cancel','fixed-run','confirmation_defer']])
  assert.ok(!ui.text().includes('请确认本次'))
  assert.ok(!ui.text().includes('图片方案'))
  ui.app.unmount()
  const rejected=mount({plan,cancel:()=>({id:'fixed-run',status:'ready'})});await tick()
  await rejected.click('稍等一下');await tick()
  assert.ok(rejected.text().includes('停止尚未确认'))
  assert.ok(rejected.text().includes('请确认本次'))
  assert.deepEqual(rejected.calls.map(value=>value[0]),['cancel'])
  rejected.app.unmount()
})
function mount({plan=fixture(),quickQuote=false,readonly=false,referencePreviews,beforeCommand,quote,save,read,prepare,confirm,resume,retry,run,cancel}={}){
  const props=vue.reactive({runId:'fixed-run',plan,quickQuote,referencePreviews,beforeCommand,busy:false,readonly}),calls=[],events=[]
  const api={saveImagePlan:async(...args)=>{calls.push(['save',...args]);return save?save(...args):{...fixture(),revision:2,selected_ids:args[1].selected_ids}},quoteImagePlan:async(...args)=>{calls.push(['quote',...args]);return quote?quote(...args):priced(props.plan)},imagePlan:async(...args)=>{calls.push(['read',...args]);return read?read(...args):fixture()}}
  api.prepareImageBatch=async(...args)=>{calls.push(['prepare',...args]);return prepare?prepare(...args):{...props.plan,execution_available:true}}
  api.retryImageBatch=async(...args)=>{calls.push(['retry',...args]);return retry?retry(...args):{run_id:'retry-run'}}
  api.run=async(...args)=>{calls.push(['run',...args]);return run?run(...args):{id:'retry-run',image_plan:{...fixture(),retry_of:props.runId}}}
  api.confirmImageBatch=async(...args)=>{calls.push(['confirm',...args]);return confirm?confirm(...args):{...props.plan,status:'submitted',batch:{...args[1],plan_revision:args[1].expected_revision,selected_count:2,completed:0,items:[1,2].map(n=>({item_id:`image-${n}`,task_id:`task${n}`,status:'queued',delivery_status:'queued',results:[]}))}}}
  api.resumeFlow=async(...args)=>{calls.push(['resume',...args]);return resume?resume(...args):{id:props.runId,image_plan:{...props.plan,status:'submitted',batch:{items:[],completed:0}},flow_runtime:{phase:'submitted'}}}
  api.cancelRun=async(...args)=>{calls.push(['cancel',...args]);return cancel?cancel(...args):{id:props.runId,status:'cancelled'}}
  const source=compileScript(parse(readFileSync('features/creation/components/CreationImagePlanCard.vue','utf8')).descriptor,{id:'image-plan-card',inlineTemplate:true}).content
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText,module={exports:{}}
  const ResultCard={props:['item'],setup:(p,{emit})=>()=>vue.h('button',{onClick:()=>emit('select',p.item.key)},`${p.item.title} 已完成`)}
  new Function('require','exports','module',output)(name=>name==='vue'?vue:name.includes('creationService')?{creationService:api}:name.includes('planReview')?reviewHelpers:name.includes('resultCatalog')?resultHelpers:name.includes('imagePlanState')?stateHelpers:name.includes('CreationResultCard')?{default:ResultCard}:name.includes('CreationConfirmationCard')?confirmationModule.exports:{default:{render:()=>null}},module.exports,module)
  const node=(type,text='')=>({type,text,children:[],props:{},parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('text',text),createComment:text=>node('comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el);el.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(el);else parent.children.splice(i,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const root=node('root'),app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,onUpdated:(...args)=>events.push(['updated',...args]),onOpen:id=>events.push(['open',id]),onRetry:(...args)=>events.push(['retry',...args])})})
  app.component('UButton',{setup:(_,{slots,attrs})=>()=>vue.h('button',attrs,slots.default?.())})
  app.component('UCheckbox',{props:['modelValue','disabled'],setup:(p,{attrs,emit})=>()=>vue.h('checkbox',{...attrs,checked:p.modelValue,disabled:p.disabled,onChecked:value=>emit('update:modelValue',value)})})
  app.component('UIcon',{render:()=>null});app.mount(root)
  const text=el=>el.text+el.children.map(text).join('')
  const find=(predicate,el=root)=>predicate(el)?el:el.children.map(child=>find(predicate,child)).find(Boolean)
  return {app,props,calls,events,text:()=>text(root),choose:(id,value)=>find(el=>el.type==='checkbox'&&el.props['aria-label']===`本次选择香水商品图${id}`).props.onChecked(value),click:label=>find(el=>el.type==='button'&&text(el)===label).props.onClick(),find}
}

test('后端交付费用卡，页面挂载与刷新不报价、不提交生成；在途无额外确认方案按钮',async()=>{
  const base=fixture(),plan={...base,review_required:false,batch_supported:true,items:base.items.slice(0,1),selected_ids:['image-1'],total_count:1}
  plan.quote_delivery='pending'
  const ui=mount({plan,quickQuote:true});await tick()
  assert.deepEqual(ui.calls,[])
  assert.ok(ui.text().includes('正在准备费用确认'))
  assert.ok(!ui.text().includes('确认方案'))
  ui.props.busy=true;await tick();ui.props.busy=false;await tick()
  assert.deepEqual(ui.calls,[])
  ui.app.unmount()
  const restored=mount({plan:priced(plan),quickQuote:true});await tick()
  assert.equal(restored.calls.length,0);restored.app.unmount()
})

test('过期报价自动更新，最终卡始终确认执行且不自动提交',async()=>{
  const plan=priced({...fixture(),review_required:false,batch_supported:true})
  plan.quote.expires_at=Date.now()/1000-1;plan.quote.expired=true
  const ui=mount({plan,quote:()=>({...priced(plan),quote:{...priced(plan).quote,id:'renewed'}})})
  await tick()
  assert.ok(!ui.text().includes('确认方案'))
  assert.deepEqual(ui.calls.map(call=>call[0]),['quote'])
  assert.ok(ui.text().includes('确认执行'))
  assert.ok(!ui.text().includes('重新核算'))
  assert.ok(!ui.text().includes('确认方案'))
  assert.ok(!ui.calls.some(call=>['prepare','confirm'].includes(call[0])))
  ui.app.unmount()
})

test('自动续价失败不无限请求、不用旧价提交；只读历史不续价',async()=>{
  const plan=priced({...fixture(),review_required:false,batch_supported:true})
  plan.quote.expires_at=Date.now()/1000-1;plan.quote.expired=true
  const ui=mount({plan,quote:()=>{throw new Error('费用暂时无法更新，请稍后重试。')}})
  await tick()
  assert.deepEqual(ui.calls.map(call=>call[0]),['quote'])
  assert.ok(ui.text().includes('费用暂时无法更新'))
  const buttonText=el=>el.text+el.children.map(buttonText).join('')
  assert.ok(ui.find(el=>el.type==='button'&&buttonText(el)==='确认执行').props.disabled)
  assert.ok(!ui.text().includes('重新核算'))
  await ui.click('确认执行');await tick()
  assert.deepEqual(ui.calls.map(call=>call[0]),['quote'])
  ui.app.unmount()
  const history=mount({plan,readonly:true});await tick()
  assert.deepEqual(history.calls,[]);history.app.unmount()
})

test('后台核价失败保持方案可查看，显示原因与明确重试，不自动循环',async()=>{
  const ui=mount({plan:{...fixture(),quote_delivery:'failed',quote_error:'费用服务暂不可用'}});await tick()
  assert.ok(ui.text().includes('费用服务暂不可用')&&ui.text().includes('重试准备'))
  assert.equal(ui.calls.length,0);ui.app.unmount()
})

test('同修订真实任务完成更新卡片，部分成功只显示已有成品，点击定位原条目不生成',async()=>{
  const ui=mount();await tick()
  const batch={items:[{item_id:'image-1',task_id:'one',status:'success',delivery_status:'completed',results:[{id:'file1',image_url:'/real.png',status:'success'}]},
    {item_id:'image-2',task_id:'two',status:'needs_review',delivery_status:'unknown',detail:'等待核对原请求',results:[]}],completed:1,selected_count:2,unknown:1}
  ui.props.plan={...fixture(),status:'submitted',batch};await tick()
  assert.ok(ui.text().includes('图片任务待核对（1/2）'));assert.ok(ui.text().includes('1 张提交状态待核对'))
  assert.ok(!ui.text().includes('统一核价'));assert.equal(ui.calls.length,0)
  await ui.click('香水商品图1 已完成');await tick()
  assert.deepEqual(ui.events,[['open','image-1']]);assert.equal(ui.calls.length,0)
  batch.items[1]={item_id:'image-2',task_id:'two',status:'success',delivery_status:'completed',results:[{id:'file2',image_url:'/real2.png',status:'success'}]}
  ui.props.plan={...ui.props.plan,batch:{...batch,completed:2,unknown:0}};await tick()
  assert.ok(ui.text().includes('图片已生成（2/2）'));assert.ok(ui.text().includes('香水商品图2 已完成'))
  ui.app.unmount()
})

test('两张默认全选，选择一张仅保存执行选择，不删总需求；未保存选择隐藏旧报价',async()=>{
  const ui=mount({plan:priced()});await tick()
  assert.ok(ui.text().includes('本次预计消耗4 积分'));assert.equal(ui.calls.length,0)
  ui.choose(1,false);await tick()
  assert.ok(ui.text().includes('共 2 张方案 · 本次选择 1 张'))
  assert.ok(!ui.text().includes('合计'));assert.ok(ui.text().includes('旧报价已隐藏'))
  assert.ok(!ui.text().includes('更新方案'))
  await ui.click('确认方案');await tick()
  assert.deepEqual(ui.calls[0][2].selected_ids,['image-2']);assert.deepEqual(ui.calls[0][2].items,[])
  assert.equal(ui.events[0][2].total_count,2);assert.equal(ui.events[0][2].items.length,2)
  assert.deepEqual(ui.calls.map(call=>call[0]),['save','quote'])
  assert.equal(ui.props.plan.selected_ids.length,2);ui.app.unmount()
})

test('核价显式调用一次；合计不冒充第三条费用，读取/挂载不核价或确认生成',async()=>{
  const ui=mount();await tick();assert.equal(ui.calls.length,0)
  await ui.click('确认方案');await tick()
  assert.equal(ui.calls.length,1);assert.equal(ui.calls[0][0],'quote');assert.equal(ui.calls[0][2].expected_revision,1)
  assert.ok(ui.text().includes('本次预计消耗4 积分'));assert.ok(!ui.text().includes('以上 2 条费用之和'))
  assert.ok(!ui.text().includes('确认生成'));assert.equal(ui.events[0][2].quote.execution_available,false)
  ui.app.unmount()
})

test('未保存节点正文阻止核价；网络重试复用请求号；只读历史不发送写入',async()=>{
  const blocked=mount({beforeCommand:async()=>false});await tick();await blocked.click('确认方案');await tick()
  assert.equal(blocked.calls.length,0);assert.ok(blocked.text().includes('请先保存当前图片提示词'));blocked.app.unmount()
  const ui=mount({quote:async()=>{throw new Error('暂时断线')}});await tick()
  await ui.click('确认方案');await tick();await ui.click('确认方案');await tick()
  assert.equal(ui.calls[0][2].request_id,ui.calls[1][2].request_id)
  ui.props.readonly=true;await tick();ui.choose(1,false);await tick();assert.ok(ui.text().includes('本次选择 2 张'))
  assert.equal(ui.find(el=>el.type==='button'&&el.text==='确认方案'),undefined);ui.app.unmount()
})

test('旧核价响应晚于跨页新修订不回填；切换后迟到结果不改变其他会话',async()=>{
  for(const unmount of [false,true]){
    let finish
    const ui=mount({quote:()=>new Promise(resolve=>finish=resolve)});await tick()
    const pending=ui.click('确认方案');await tick()
    if(unmount)ui.app.unmount()
    else {ui.props.plan={...fixture(),revision:2};await tick()}
    finish(priced());await pending;await tick()
    assert.equal(ui.events.length,0)
    if(!unmount){assert.ok(ui.text().includes('更新'));ui.app.unmount()}
  }
})

test('图片未执行计划刷新可恢复，停止/已执行/被替代不自动重开',async()=>{
  const js=ts.transpileModule(readFileSync('features/creation/imagePlanState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  const {hasUnsubmittedImagePlan}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  assert.equal(hasUnsubmittedImagePlan({status:'replied',image_plan:fixture()}),true)
  for(const changes of [{status:'cancelled'},{executed_request:'done'},{superseded_by:'new'},{image_plan:undefined}])assert.equal(hasUnsubmittedImagePlan({status:'replied',image_plan:fixture(),...changes}),false)
})

test('节点正文正在修改时立即隐藏旧价，不能用旧快照核价或保存选择',async()=>{
  const ui=mount({plan:priced()});await tick();assert.ok(ui.text().includes('本次预计消耗'))
  ui.props.draftDirty=true;await tick()
  assert.ok(!ui.text().includes('本次预计消耗'));assert.ok(ui.text().includes('旧报价已隐藏'))
  await ui.click('确认方案');assert.equal(ui.calls.length,0)
  ui.props.draftDirty=false;await tick();assert.ok(ui.text().includes('本次预计消耗'))
  ui.app.unmount()
})
