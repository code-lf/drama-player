// 编译真实紧凑工具组件，验证名称展示；采样、报价及采购均不在渲染测试中触发。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript} from 'vue/compiler-sfc'
import {computed,createSSRApp,defineComponent,h} from 'vue'
import {renderToString} from 'vue/server-renderer'

test('方案预览标明未确认及实际进行图标，不生成确认按钮',async()=>{
  const events=logic.exports.runProcessEvents({status:'planning',skill_agent_events:[{id:'partial',kind:'proposal_preview',status:'started',text:'雨后窗台上的白猫'}]})
  const app=createSSRApp(component.exports.default,{events})
  app.component('UIcon',defineComponent({props:['name'],setup:props=>()=>h('span',{'data-icon':props.name})}))
  const html=await renderToString(app)
  assert.ok(html.includes('尚未确认')&&html.includes('雨后窗台上的白猫'))
  assert.ok(html.includes('i-lucide-loader-circle'))
  assert.ok(!html.includes('确认执行'))
})

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const require=createRequire(import.meta.url),logic={exports:{}},component={exports:{}}
runInNewContext(transpile(read('features/creation/processEvents.ts')),{exports:logic.exports,module:logic})
const compiled=compileScript(parse(read('features/creation/components/CreationProcessEvents.vue')).descriptor,{id:'named-skill-receipt',inlineTemplate:true})
runInNewContext(transpile(compiled.content),{exports:component.exports,module:component,computed,require:id=>{
  if(id==='./AssistantReply.vue')return {default:defineComponent({props:['text'],setup:props=>()=>h('p',props.text)})}
  return require(id)
}})

test('工具及业务进行中只保留左侧加载状态，失败待核对仍显示文字',async()=>{
  const events=[
    {id:'vision',title:'理解图片',status:'processing'},
    {id:'job',kind:'business_record',title:'准备确认信息',status:'processing'},
    {id:'failed',title:'理解图片',status:'failed'},
    {id:'unknown',title:'同步状态',status:'unknown'},
    {id:'done',title:'读取方法资源',status:'succeeded'},
  ]
  const app=createSSRApp(component.exports.default,{events})
  app.component('UIcon',defineComponent({props:['name'],setup:props=>()=>h('i',{'data-icon':props.name})}))
  const html=await renderToString(app)
  assert.equal(html.match(/class="animate-spin"/g)?.length,2)
  assert.ok(!/<small[^>]*>处理中<\/small>/.test(html))
  assert.ok(html.includes('aria-label="处理中"'))
  assert.ok(html.includes('>失败</small>')&&html.includes('>待核对</small>'))
  assert.ok(html.includes('data-icon="i-lucide-check-circle-2"'))
})

test('停止后的真实看图加载行渲染已停止，不显示待核对或完成勾选',async()=>{
  const events=logic.exports.runProcessEvents({status:'cancelled',skill_agent_events:[
    {id:'vision',kind:'image_understanding',origin:'runtime',status:'started'}]})
  const app=createSSRApp(component.exports.default,{events})
  app.component('UIcon',defineComponent({props:['name'],setup:props=>()=>h('i',{'data-icon':props.name})}))
  const html=await renderToString(app)
  assert.match(html,/>已停止<\/small>/)
  assert.match(html,/data-icon="i-lucide-circle-stop"/)
  assert.doesNotMatch(html,/>待核对<|class="animate-spin"|data-icon="i-lucide-check-circle-2"/)
})

test('真实组件渲染具体助理名称和模型说明，不把预载或后台成功混成AI动作',async()=>{
  const events=logic.exports.runProcessEvents({status:'ready',skill_agent_events:[
    {id:'preload',tool:'read_skill',origin:'runtime',status:'returned'},
    {id:'intro',kind:'assistant_text',status:'returned',text:'我会采用图片创作助理，保留你选定的参数。'},
    {id:'read',tool:'read_creation_skill',origin:'agent',skill:{id:'image-assistant',label:'图片创作助理',version:1},status:'started'},
    {id:'read',tool:'read_creation_skill',origin:'agent',skill:{id:'image-assistant',label:'图片创作助理',version:1},status:'returned'}],
    flow_runtime:{events:[{id:'quote',title:'核算真实费用',status:'succeeded'}]}})
  const app=createSSRApp(component.exports.default,{events})
  app.component('UIcon',defineComponent({setup:()=>()=>h('span')}))
  const html=await renderToString(app)
  assert.equal(html.match(/读取图片创作助理/g)?.length,1)
  assert.ok(html.includes('我会采用图片创作助理，保留你选定的参数。'))
  assert.ok(!html.includes('读取创作技能')&&!html.includes('读取技能指导')&&!html.includes('核算真实费用'))
})

test('当前与历史按提问、回答、理解图片、后续分析的顺序展示',async()=>{
  const scopes=['a','b','c'].map(letter=>'canvas-agent-'+letter.repeat(32))
  const [first,second,third]=scopes
  const vision={id:second+'-vision',kind:'image_understanding',origin:'runtime',answer_timeline_id:'image'}
  const value={answers:[{timeline_id:'image',question:'上传窗帘图片',answer:'已选参考图'},
    {timeline_id:'platform',question:'用在哪个平台',answer:'店铺主页'}],skill_agent_events:[
    {id:first+'-intro',kind:'assistant_text',status:'returned',text:'请先提供窗帘照片。'},
    {id:first+'-ask',tool:'ask_user',status:'returned'},
    {...vision,status:'started'},
    {id:second+'-analysis',kind:'assistant_text',answer_timeline_id:'image',status:'returned',text:'参考图展示了银灰色百叶。'},
    {id:second+'-ask',tool:'ask_user',answer_timeline_id:'image',status:'returned'},
    {id:third+'-analysis',kind:'assistant_text',answer_timeline_id:'platform',status:'returned',text:'将按店铺首页构图。'}]}
  for(const [status,visionStatus,icon] of [['planning','started','i-lucide-loader-circle'],['replied','returned','i-lucide-check-circle-2'],['failed','failed','i-lucide-circle-alert']]){
    const events=logic.exports.runProcessEvents({...value,status,skill_agent_events:[...value.skill_agent_events,{...vision,status:visionStatus}]})
    const app=createSSRApp({render:()=>h(component.exports.default,{events},{answer:({answer})=>h('article',answer.answer)})})
    app.component('UIcon',defineComponent({props:['name'],setup:props=>()=>h('span',{'data-icon':props.name})}))
    const html=await renderToString(app)
    const positions=['请先提供窗帘照片','已选参考图','理解图片','参考图展示了银灰色百叶','店铺主页','将按店铺首页构图'].map(text=>html.indexOf(text))
    assert.ok(positions.every((pos,index)=>pos>=0&&(!index||pos>positions[index-1])))
    assert.equal(html.match(/理解图片/g)?.length,1)
    assert.match(html,new RegExp(icon+'"[^>]*></span><span>理解图片'))
  }
})

test('英文默认折叠、中文默认展示，提示词按原文转义并标明实际执行语言',async()=>{
  const zh='两个外星人并肩站立，无文字。',en='Two aliens side by side. No text. <script>'
  for(const language of ['zh','en']){
    const value={status:'replied',image_plan:{public_summary:'一张霓虹街头图片。',public_summary_version:3,items:[
      {id:'image-1',title:'霓虹街头',prompt:language==='zh'?zh:en,
        prompt_translation:{execution_language:language,text:language==='zh'?en:zh}}]}}
    const events=logic.exports.runProcessEvents(value)
    assert.equal(events[0].promptPairs[0].zh,zh)
    assert.equal(events[0].promptPairs[0].en,en)
    assert.equal(logic.exports.runProcessEvents({...value,status:'cancelled'})[0].promptPairs,undefined)
    for(const open of [false,true]){
      const app=createSSRApp(component.exports.default,{events})
      app.component('UButton',defineComponent({setup:(_,ctx)=>()=>h('button',ctx.slots.default?.())}))
      // SSR 模拟 Nuxt 折叠插槽的开闭；实际可点击性单独进行浏览器验收。
      app.component('UCollapsible',defineComponent({setup:(_,ctx)=>()=>h('div',[ctx.slots.default?.({open}),open&&ctx.slots.content?.()])}))
      const html=await renderToString(app)
      assert.ok(html.includes(zh))
      assert.ok(html.includes(language==='zh'?'中文提示词（用于生成）':'英文提示词（用于生成）'))
      assert.equal(html.includes('Two aliens side by side.'),open)
      assert.ok(!html.includes('<script>'))
    }
  }
})
