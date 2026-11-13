// 兼容旧草稿时不捏造工具调用；执行状态展示不产生任何写操作。
import {test} from 'node:test'
import assert from 'node:assert/strict'

test('增量方案与交付工具进行中合并为一条正在整理，失败仍说明未确认',()=>{
 const events=[{id:'delivery',tool:'generate_response',status:'started'},
   {id:'preview',kind:'proposal_preview',status:'started',text:'雨夜车站方案'}]
 const output=exports.runProcessEvents({status:'planning',skill_agent_events:events})
 assert.equal(output.filter(item=>item.status==='processing').length,1)
 assert.equal(output[0].feedback,'正在整理')
 assert.match(exports.runProcessEvents({status:'failed',error:'失败',skill_agent_events:events})[0].feedback,/未确认/)
})

test('历史双语标记颠倒只纠正展示，不改实际执行字段',()=>{
  const zh='写实摄影，一条红白相间的锦鲤跃起在雨后的水洼里，水花清晰，无文字。'
  const en='Realistic nature photography of a red and white koi leaping in a rainy puddle. No text.'
  for(const english of [false,true]){
    const item={id:'image-1',title:'锦鲤',prompt:english?en:zh,prompt_translation:{execution_language:english?'zh':'en',text:english?zh:en}}
    const original=JSON.stringify(item)
    const pair=exports.runProcessEvents({status:'replied',image_plan:{public_summary:'图片方案',items:[item]}})[0].promptPairs[0]
    assert.equal(pair.zh,zh);assert.equal(pair.en,en)
    assert.equal(pair.executionLanguage,english?'en':'zh')
    assert.equal(JSON.stringify(item),original)
  }
})

test('增量方案仅为未确认预览，完成替换、失败停止可恢复且不伪装成功',()=>{
  const event={id:'preview',kind:'proposal_preview',text:'雨中锦鲤',status:'started'}
  const project=status=>exports.runProcessEvents({status,skill_agent_events:[event]})
  assert.equal(project('planning')[0].description,'雨中锦鲤')
  assert.equal(project('planning')[0].feedback,'正在整理')
  assert.equal(project('replied').length,0)
  assert.equal(project('failed')[0].status,'failed')
  assert.match(project('failed')[0].feedback,/未提交生成/)
  assert.equal(project('cancelled')[0].status,'stopped')
  const completedThenStopped=exports.runProcessEvents({status:'cancelled',image_plan:{public_summary:'已校验创意',public_summary_version:3},skill_agent_events:[event]})
  assert.ok(!completedThenStopped.some(item=>item.kind==='proposal_preview'))
})

test('原生技能加载仅在真实返回后显示公开版本回执，私有摘要不作反馈',()=>{
  const call={id:'load',origin:'agent',tool:'read_creation_skill',skill:{id:'image-assistant',label:'图片创作助理',version:3},summary:'私有摘要',feedback:'已加载《图片创作助理》第3版指导。'}
  const project=status=>exports.runProcessEvents({status:'planning',skill_agent_events:[{...call,status}]})[0]
  assert.equal(project('started').feedback,undefined)
  assert.equal(project('failed').feedback,undefined)
  assert.equal(project('returned').feedback,call.feedback)
})

test('手动停止看图显示已停止，真正成功失败和未知媒体收据不改写',()=>{
  const value={status:'cancelled',skill_agent_events:[
    {id:'vision',kind:'image_understanding',origin:'runtime',status:'started'},
    {id:'done',kind:'image_understanding',origin:'runtime',status:'returned'},
    {id:'failed',kind:'image_understanding',origin:'runtime',status:'failed'},
  ],flow_runtime:{events:[{id:'media',title:'提交任务',status:'unknown'}]}}
  const events=exports.runProcessEvents(value)
  assert.equal(events.find(event=>event.id==='agent:vision').status,'stopped')
  assert.equal(events.find(event=>event.id==='agent:done').status,'succeeded')
  assert.equal(events.find(event=>event.id==='agent:failed').status,'failed')
  assert.equal(events.find(event=>event.id==='media').status,'unknown')
  assert.equal(exports.runProcessEvents({...value,status:'planning'})[0].status,'processing')
})

test('补答重带同源图片只展示一次理解，换图与失败仍保留',()=>{
  const vision=(id,status,source_fingerprint)=>({id,kind:'image_understanding',origin:'runtime',status,source_fingerprint})
  const events=exports.runProcessEvents({status:'ready',skill_agent_events:[
    vision('first','returned','image-a'),vision('same','returned','image-a'),
    vision('different','returned','image-b'),vision('failed','failed','image-a'),
  ]})
  assert.deepEqual(events.filter(row=>row.title==='理解图片').map(row=>row.status),['succeeded','succeeded','failed'])
  const old=exports.runProcessEvents({status:'ready',answers:[
    {question:'上传',answer:'已上传',timeline_id:'upload',reference_versions:['version-1']},
    {question:'平台',answer:'电商',timeline_id:'platform'},
  ],skill_agent_events:[
    {...vision('old-first','returned'),answer_timeline_id:'upload'},
    {...vision('old-same','returned'),answer_timeline_id:'platform'},
  ]})
  assert.equal(old.filter(row=>row.title==='理解图片').length,1)
  assert.equal(old.filter(row=>row.kind==='answer').length,2)
})

test('规划结论只显示已返回的公开业务收据，不泄漏目录技术摘要',()=>{
 const events=exports.runProcessEvents({status:'replied',skill_agent_events:[
  {id:'plan',tool:'generate_response',status:'returned',summary:'已整理创作方案，费用以确认卡为准。'},
  {id:'catalog',tool:'list_capabilities',status:'returned',summary:'内部目录统计'},
  {id:'fail',tool:'generate_response',status:'failed',summary:'已整理创作方案，费用以确认卡为准。'}
 ]})
 assert.equal(events[0].feedback,undefined)
 assert.equal(events[1].feedback,undefined)
 assert.equal(events.length,2)
 assert.ok(!events.some(event=>event.title==='核对可用能力'))
})
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../features/creation/processEvents.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const exports={};new Function('exports',code)(exports)

test('技能发现和读取只显示真实轻量收据，不裸露路由工具名',()=>{
 const events=exports.runProcessEvents({status:'planning',skill_agent_events:[
  {id:'s1',tool:'list_creation_skills',status:'returned'},
  {id:'s2',tool:'read_creation_skill',status:'started'}]})
 assert.deepEqual(events.map(item=>item.title),['查找适用技能','读取创作技能'])
 assert.deepEqual(events.map(item=>item.status),['succeeded','processing'])
})

test('技能读取展示本次真实名称，开始结束合并且跨技能不串名',()=>{
 const events=exports.runProcessEvents({status:'ready',skill_agent_events:[
  {id:'image',tool:'read_creation_skill',origin:'agent',skill:{id:'image-assistant',label:'图片创作助理',version:1},status:'started'},
  {id:'image',tool:'read_creation_skill',origin:'agent',skill:{id:'image-assistant',label:'图片创作助理',version:1},status:'returned'},
  {id:'music',tool:'read_creation_skill',origin:'agent',skill:{id:'music-assistant',label:'音乐创作助理',version:1},status:'returned'},
  {id:'video',tool:'read_creation_skill',origin:'agent',skill:{id:'video-assistant',label:'视频创作助理',version:1},status:'failed'}]})
 assert.deepEqual(events.map(event=>event.title),['读取图片创作助理','读取音乐创作助理','读取视频创作助理'])
 assert.deepEqual(events.map(event=>event.status),['succeeded','succeeded','failed'])
 // 历史没有可信名称时不能按本轮最终技能/用户文字倒推补名。
 const legacy=exports.runProcessEvents({status:'ready',skill_agent_events:[{id:'old',tool:'read_creation_skill',status:'returned'}]})
 assert.equal(legacy[0].title,'读取创作技能')
 const injected=exports.runProcessEvents({status:'ready',skill_agent_events:[{id:'unknown',tool:'read_creation_skill',skill:{id:'x',label:'自报名称'},status:'returned'}]})
 assert.equal(injected[0].title,'读取创作技能')
})

test('方案真实正文紧跟成功工具，隐藏报价和取消成功行，停止后保留新版创意',()=>{
 const value={status:'cancelled',image_plan:{public_summary:'本轮交付两项文字创意，保持原有事实约束。',public_summary_version:3},skill_agent_events:[{id:'p',tool:'generate_response',status:'returned'}],flow_runtime:{events:[{id:'q',title:'核算真实费用',status:'succeeded'},{id:'c',title:'停止未执行流程',status:'succeeded'},{id:'x',title:'准备执行批次',status:'failed',description:'原请求失败'}]}}
 const events=exports.runProcessEvents(value)
 assert.deepEqual(events.map(event=>event.id),['agent:p','accepted-plan-narration','x'])
 assert.equal(events[1].description,value.image_plan.public_summary)
 assert.equal(events[2].status,'failed')
 assert.equal(exports.runProcessEvents({...value,image_plan:{public_summary:'请核对下方费用卡'}}).some(event=>event.id==='accepted-plan-narration'),false)
 const failedQuote=exports.runProcessEvents({status:'replied',flow_runtime:{events:[{id:'q',title:'核算真实费用',status:'failed'}]}})
 assert.equal(failedQuote[0].status,'failed')
})

test('真实规划调用显示进行中，不叠加编排卡或报价成功记录',()=>{
  const events=exports.runProcessEvents({status:'planning',skill_agent_events:[{id:'tool',tool:'generate_response',status:'started'}],
    flow_runtime:{events:[{id:'planning',title:'整理创作方案',status:'unknown'},{id:'quote',title:'核算真实费用',status:'succeeded'}]}})
  assert.equal(events.filter(item=>item.title==='整理创作方案').length,0)
  assert.equal(events.length,1)
  assert.equal(events[0].title,'正在整理')
  assert.equal(events[0].status,'processing')
  assert.ok(!events.some(item=>item.title==='核算真实费用'))
})

test('规划结束或拒绝后不会残留正在整理状态',()=>{
  for(const status of ['replied','failed','cancelled']){
    const result=exports.runProcessEvents({status,skill_agent_events:[{id:'tool',tool:'generate_response',status:'started'}]})
    assert.ok(!result.some(event=>event.status==='processing'))
  }
})

test('未调用规划工具时不提前显示根流程的计划待核对卡',()=>{
  const events=exports.runProcessEvents({status:'planning',skill_agent_events:[{id:'read',tool:'read_skill',origin:'agent',status:'returned'}],flow_runtime:{events:[{id:'pending',title:'整理创作方案',status:'unknown'}]}})
  assert.equal(events.length,1)
  assert.equal(events[0].title,'读取技能指导')
})

test('在途公开增量立即显示，同消息快照合并且断流不伪装成功',()=>{
  const value={status:'planning',skill_agent_events:[{id:'delta',kind:'assistant_text',status:'started',text:'第一段'}]}
  let events=exports.runProcessEvents(value)
  assert.equal(events[0].description,'第一段');assert.equal(events[0].status,'processing')
  value.skill_agent_events.push({id:'delta',kind:'assistant_text',status:'returned',text:'第一段，第二段'})
  events=exports.runProcessEvents(value)
  assert.equal(events.length,1);assert.equal(events[0].description,'第一段，第二段');assert.equal(events[0].status,'succeeded')
  value.skill_agent_events.push({id:'delta',kind:'assistant_text',status:'failed',text:'第一段，第二段'})
  assert.equal(exports.runProcessEvents(value)[0].status,'unknown')
})
test('系统技能开场不冒充模型动作，真实工具只有实际返回才勾选',()=>{
  const events=exports.runProcessEvents({status:'planning',skill_agent_events:[
    {id:'context',kind:'skill_context',origin:'runtime',status:'returned',text:'正在使用「测试技能」技能执行任务'},
    {id:'read',tool:'read_skill',origin:'agent',status:'started',description:'读取创作要求。'}]})
  assert.equal(events.length,1);assert.equal(events[0].status,'processing')
  assert.equal(exports.runProcessEvents({status:'planning',skill_agent_events:[{id:'read',tool:'read_skill',origin:'agent',status:'returned'}]})[0].status,'succeeded')
})
test('原服务事件原样投影，包括未知与失败',()=>{const events=[{id:'x',title:'提交任务',status:'unknown'}];assert.deepEqual(exports.authoringProcessEvents({status:'processing',events}),events)})
test('旧草稿不补造保存正文或设置元数据，成功时无内部提示',()=>{for(const status of ['processing','ready','failed']){const events=exports.authoringProcessEvents({status});if(status==='ready'){assert.deepEqual(events,[]);continue}assert.equal(events.length,1);assert.doesNotMatch(events[0].title,/保存|元数据|转换完成/);assert.equal(events[0].status,status)}})
test('隐藏候选落盘的内部通知，保留实际阶段',()=>{assert.deepEqual(exports.authoringProcessEvents({status:'ready',events:[{id:'candidate',title:'保存整理候选',status:'succeeded'}]}),[])})

test('阶段说明保留真实回包，不从标题捏造操作内容',()=>{const events=[{id:'document',title:'校验 SKILL.md',description:'正文已校验，尚未应用。',status:'succeeded'}];assert.deepEqual(exports.authoringProcessEvents({status:'ready',events}),events)})

test('画布Agent按真实调用合并开始结束，不补未调用工具',()=>{
  assert.deepEqual(exports.runProcessEvents({status:'replied',skill_agent_events:[
    {id:'a',tool:'read_skill',origin:'agent',status:'started'},{id:'a',tool:'read_skill',origin:'agent',status:'returned'}
  ]}),[{id:'agent:a',title:'读取技能指导',status:'succeeded'}])
  assert.deepEqual(exports.runProcessEvents({status:'replied'}),[])
})
test('中断的工具仍待核对，内部方案纠正与未知工具名不进入页面',()=>{
  const result=exports.runProcessEvents({status:'failed',skill_agent_events:[
    {id:'a',tool:'read_skill',origin:'agent',status:'started'},{id:'b',tool:'generate_response',status:'rejected'},
    {id:'c',tool:'secret-tool',status:'returned'},{id:'d',tool:'toString',status:'returned'}]})
  assert.equal(result.length,1);assert.equal(result[0].status,'unknown')
})
test('方案自动修正不堆步骤，只合并同轮连续且完全相同的说明',()=>{
  const prefix='canvas-agent-'+ 'a'.repeat(32)
  const msg=(n,text)=>({id:prefix+'-message-'+n,kind:'assistant_text',status:'returned',text})
  const plan=(n,status)=>({id:prefix+'-tool-'+n,tool:'generate_response',status})
  const result=exports.runProcessEvents({status:'replied',skill_agent_events:[
    msg(1,'先拟一份主图方案。'),plan(1,'started'),plan(1,'rejected'),
    msg(2,'先拟一份主图方案。'),plan(2,'rejected'),msg(3,'保留窗帘的真实叶片颜色。'),plan(3,'returned')]})
  assert.equal(result.map(event=>event.description||event.title).join('|'),
    '先拟一份主图方案。|保留窗帘的真实叶片颜色。|整理创作方案')
  assert.equal(exports.runProcessEvents({status:'failed',error:'本次方案未完成。',skill_agent_events:[plan(1,'failed')]}).length,0)
})
test('直接发图没有回答卡也显示一条真实图片理解记录，纯文字不补造',()=>{
  const vision={id:'canvas-agent-'+ 'a'.repeat(32)+'-vision',kind:'image_understanding',origin:'runtime'}
  assert.equal(exports.runProcessEvents({status:'planning',skill_agent_events:[{...vision,status:'started'}]})[0].status,'processing')
  assert.equal(exports.runProcessEvents({status:'replied',skill_agent_events:[{...vision,status:'returned'}]})[0].title,'理解图片')
  assert.equal(exports.runProcessEvents({status:'replied',skill_agent_events:[
    {id:'text',kind:'assistant_text',status:'returned',text:'我看到了图片。'}]}).some(event=>event.title==='理解图片'),false)
})
test('工具收据紧凑显示，报价套话仅保留审计而不重复费用卡',()=>{
  const component=readFileSync(new URL('../features/creation/components/CreationProcessEvents.vue',import.meta.url),'utf8')
  assert.match(component,/padding:2px 0;border:0;background:none/)
  assert.match(component,/event.description.*class="process-feedback"/)
  const event={id:'quote',title:'核算真实费用',description:'已核算2项，等待确认。',status:'succeeded'}
  assert.deepEqual(exports.runProcessEvents({status:'replied',flow_runtime:{events:[event]}}),[])
  assert.equal(event.description,'已核算2项，等待确认。')
})

test('业务成功不冒充AI动作，失败和待核对仍保留',()=>{
  const successes=['核对计划','准备执行批次','提交已确认任务'].map((title,index)=>({id:String(index),title,status:'succeeded'}))
  assert.deepEqual(exports.runProcessEvents({status:'ready',flow_runtime:{events:successes}}),[])
  const event={id:'plan',title:'核对计划',status:'unknown'}
  assert.deepEqual(exports.runProcessEvents({status:'planning',flow_runtime:{events:[event]}}),[event])
})

test('公开行动说明随真实收据展示，失败不伪装成功，旧记录不补造正文',()=>{
  assert.deepEqual(exports.runProcessEvents({status:'replied',skill_agent_events:[
    {id:'round1:a',tool:'read_resource',status:'started',description:'先核对引用方法。'},
    {id:'round1:a',tool:'read_resource',status:'rejected',description:'先核对引用方法。'},
    {id:'round2:a',tool:'read_resource',status:'returned'},
    {id:'x',tool:'secret',status:'returned',description:'不应展示'}
  ]}),[
    {id:'agent:round1:a',title:'读取方法资源',status:'failed',description:'先核对引用方法。'},
    {id:'agent:round2:a',title:'读取方法资源',status:'succeeded'}
  ])
})

test('行动说明复用聊天安全富文本，不执行模型HTML或另加请求',()=>{
  const component=readFileSync(new URL('../features/creation/components/CreationProcessEvents.vue',import.meta.url),'utf8')
  assert.match(component,/<AssistantReply v-if="event.description" :text="event.description"/)
  // 技术回执仍可留存审计，但不能作为对话正文重复渲染。
  assert.doesNotMatch(component,/event\.summary|process-summary/)
  assert.doesNotMatch(component,/v-html|\$fetch|useFetch/)
})

test('结果摘要仅保留成功收据数据，不从旧记录或失败记录补造',()=>{
  const events=exports.runProcessEvents({status:'ready',skill_agent_events:[
    {id:'a',tool:'read_skill',origin:'agent',status:'returned',summary:'已读取固定第1版。'},
    {id:'b',tool:'read_resource',status:'rejected',summary:'不应显示'},
    {id:'c',tool:'list_capabilities',status:'started',summary:'不应显示'}]})
  assert.equal(events[0].summary,'已读取固定第1版。')
  assert.equal(events[1].summary,undefined);assert.equal(events.length,2)
})

test('真实模型解读保留在相邻工具之间，不冒充工具卡或恢复技术摘要',()=>{
  const events=exports.runProcessEvents({status:'waiting',skill_agent_events:[
    {id:'a',tool:'list_capabilities',status:'returned',summary:'模型数量仅作审计'},
    {id:'m',kind:'assistant_text',status:'returned',text:'这两个模型满足当前规格。'},
    {id:'b',tool:'generate_response',status:'returned'},
    {id:'x',kind:'assistant_text',status:'started',text:'真实收到但中断的半段正文'},
    {id:'empty',kind:'assistant_text',status:'returned',text:' '}]})
  assert.equal(events.length,3)
  assert.equal(events[2].status,'unknown')
  assert.equal(events[0].kind,'assistant_text')
  assert.equal(events[0].title,'')
  assert.equal(events[0].description,'这两个模型满足当前规格。')
  const component=readFileSync(new URL('../features/creation/components/CreationProcessEvents.vue',import.meta.url),'utf8')
  assert.match(component,/v-if="!event.kind" class="process-event"/)
})

test('续答分开真实调用轮次，同次开始结束仍只显示一张卡',()=>{
  const a='canvas-agent-'+ 'a'.repeat(32),b='canvas-agent-'+ 'b'.repeat(32)
  const result=exports.runProcessEvents({status:'ready',skill_agent_events:[
    {id:a+'-1',tool:'read_skill',origin:'agent',status:'started'},
    {id:a+'-1',tool:'read_skill',origin:'agent',status:'returned'},
    {id:b+'-1',tool:'read_skill',origin:'agent',status:'returned'},
    {id:b+'-2',tool:'list_capabilities',status:'returned'}]})
  assert.equal(result.length,3)
  assert.equal(result[1].kind,'continuation')
  assert.equal(result[2].title,'沿用技能指导')
})

test('旧问答仅凭可信提问边界插入，尚未收到后续事件时保留新答案',()=>{
  const a='canvas-agent-'+ 'a'.repeat(32),b='canvas-agent-'+ 'b'.repeat(32)
  const result=exports.runProcessEvents({status:'planning',answers:[
    {question:'请上传图片',answer:'旧答案'},{timeline_id:'new',question:'请选择尺寸',answer:'新答案'}],skill_agent_events:[
    {id:a+'-ask',tool:'ask_user',origin:'agent',status:'returned'},
    {id:b+'-text',kind:'assistant_text',status:'returned',text:'根据旧答案继续分析'},
    {id:b+'-ask',tool:'ask_user',origin:'agent',status:'returned'}]})
  assert.equal(result.map(event=>event.answer?.answer||event.description||event.title).join('|'),
    '提供补充问题|旧答案|根据旧答案继续分析|提供补充问题|新答案')
})

test('续答不重复技能开场，真实读取与失败收据仍保留',()=>{
  const events=exports.runProcessEvents({status:'ready',skill_agent_events:[
    {id:'context-a',kind:'skill_context',status:'returned',text:'正在使用「测试」技能执行任务'},
    {id:'read-a',tool:'read_skill',origin:'agent',status:'returned',description:'读取本次技能的创作要求。'},
    {id:'context-b',kind:'skill_context',status:'returned',text:'正在使用「测试」技能执行任务'},
    {id:'read-b',tool:'read_skill',origin:'agent',status:'started',description:'读取本次技能的创作要求。'},
    {id:'read-b',tool:'read_skill',origin:'agent',status:'returned',description:'读取本次技能的创作要求。'},
    {id:'failed-plan',tool:'generate_response',status:'failed'}]})
  assert.equal(events.filter(event=>event.kind==='skill_context').length,0)
  assert.equal(events.find(event=>event.id==='agent:read-b').title,'沿用技能指导')
  assert.equal(events.find(event=>event.id==='agent:read-b').description,undefined)
  assert.equal(events.at(-1).status,'failed')
})

test('模型不可用时系统预载不显示AI成功动作，历史来源不明的读取也不冒充',()=>{
  const source=[
    {id:'context',kind:'skill_context',origin:'runtime',status:'returned',text:'正在使用技能'},
    {id:'skill',tool:'read_skill',origin:'runtime',status:'returned',description:'读取本次技能的创作要求。'},
    {id:'progress',tool:'read_creation_progress',origin:'runtime',status:'returned',description:'读取本次创作进度，复用已确认素材与成果。'},
    {id:'failed',tool:'read_skill',origin:'runtime',status:'failed'},
    {id:'old',tool:'read_skill',status:'returned'},
    {id:'old-progress',tool:'read_creation_progress',status:'returned'}]
  assert.deepEqual(exports.runProcessEvents({status:'failed',skill_agent_events:source}),[])
  assert.equal(source.length,6) // 只过滤聊天投影，不删原始审计。
})

test('预载轮次不制造续答提示，真实AI读取进度保持原始回包状态',()=>{
  const a='canvas-agent-'+ 'a'.repeat(32),b='canvas-agent-'+ 'b'.repeat(32)
  const events=exports.runProcessEvents({status:'failed',skill_agent_events:[
    {id:a+'-1',tool:'read_skill',origin:'runtime',status:'returned'},
    {id:b+'-1',tool:'read_creation_progress',origin:'agent',status:'started'},
    {id:b+'-1',tool:'read_creation_progress',origin:'agent',status:'failed'}]})
  assert.deepEqual(events,[{id:'agent:'+b+'-1',title:'读取创作进度',status:'failed'}])
})
