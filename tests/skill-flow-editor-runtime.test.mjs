// 执行真实组件方法验证各阶段表单配置；不创建媒体或开放步骤执行。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{renderToString}=createRequire(require.resolve('vue'))('@vue/server-renderer')
const source=readFileSync(new URL('../features/creation/components/SkillFlowEditor.vue',import.meta.url),'utf8')
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
async function setup(){
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'flow-runtime'}),module={exports:{}}
  new Function('require','module','exports',transpile(script.content))(name=>name==='vue'?vue:{default:{}},module,module.exports)
  const events=[],props=vue.reactive({modelValue:{version:1,steps:[{id:'collect',title:'收集',type:'collect',inputs:[],instructions:''},{id:'plan',title:'策划',type:'plan',inputs:['collect'],instructions:'原要求'},{id:'images',title:'四张图片',type:'generate_image',inputs:['plan'],instructions:'四张独立',allowed_models:['image-a'],style_id:'style-a'},{id:'videos',title:'四段视频',type:'unsupported',planned_type:'generate_video',inputs:['images'],instructions:'四条独立',unavailable_reason:'跨媒体待接通',allowed_models:['video-a'],style_prompt:'用户原风格',prompt_template:'原视频模板'},{id:'music',title:'音乐',type:'unsupported',planned_type:'generate_music',inputs:['plan'],instructions:'背景音乐',unavailable_reason:'待接通'},{id:'compose',title:'合成',type:'unsupported',planned_type:'compose_video',inputs:['videos'],instructions:'按顺序',unavailable_reason:'待接通'}]},models:[{code:'image-a',target:'image'},{code:'video-a',target:'video'},{code:'music-a',target:'music'}],styles:[{style_id:'style-a',display_name:'真实风格',render_medium:'写实',runtime_style_prefix:'真实风格词'}]})
  let b;const component=module.exports.default,original=component.setup
  component.setup=(p,c)=>{b=original(p,c);return b};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,{...props,'onUpdate:modelValue':value=>events.push(value)}))
  return {b,props,events}
}
test('六类步骤分别展示真实字段，待支持视频不会丢模型绑定',async()=>{
  const {b,props}=await setup(),steps=props.modelValue.steps
  assert.equal(b.templateLabel(steps[0]),'资料问题与输入模板')
  assert.equal(b.templateLabel(steps[1]),'策划内容模板')
  assert.equal(b.templateLabel(steps[2]),'生图提示词模板')
  assert.equal(b.templateLabel(steps[3]),'视频提示词模板')
  assert.equal(b.templateLabel(steps[4]),'音乐创作提示词模板')
  assert.equal(b.templateLabel(steps[5]),'合成时间轴与参数模板')
  assert.equal(b.inputLabel(steps[5]),'视频片段来源')
  for(const [index,target] of [[2,'image'],[3,'video'],[4,'music']])assert.deepEqual(b.availableModels(steps[index]).map(item=>item.target),[target])
  assert.equal(steps[3].type,'unsupported');assert.deepEqual(steps[3].allowed_models,['video-a'])
})
test('模型勾选只修改当前节点，新旧对象及成功步骤不被原位覆盖',async()=>{
  const {b,props,events}=await setup(),step=props.modelValue.steps[3]
  b.selectModel(step,'video-a',false)
  assert.deepEqual(events.at(-1).steps[3].allowed_models,[])
  assert.deepEqual(step.allowed_models,['video-a'])
  assert.equal(events.at(-1).steps[3].type,'unsupported')
  assert.deepEqual(events.at(-1).steps[2],props.modelValue.steps[2])
})
test('风格取消不写稿、未知风格不接受、切错节点不写入',async()=>{
  const {b,props,events}=await setup(),step=props.modelValue.steps[2]
  b.selected.value=step.id;b.openStyle(step);b.styleOpen.value=false
  assert.equal(events.length,0)
  b.chooseStyle({style_id:'forged'});assert.equal(events.length,0)
  b.selected.value='videos';b.chooseStyle(props.styles[0]);assert.equal(events.length,0)
  b.selected.value=step.id;b.chooseStyle(props.styles[0]);assert.equal(events.length,1)
  assert.equal(events[0].steps[2].style_id,'style-a');assert.equal(events[0].steps[3].style_prompt,'用户原风格')
})
test('改计划类型清理不兼容绑定，原模板与待支持门禁仍保留',async()=>{
  const {b,props,events}=await setup(),step=props.modelValue.steps[3]
  b.changePlannedType(step,'generate_music')
  const changed=events[0].steps[3]
  assert.equal(changed.type,'unsupported');assert.equal(changed.planned_type,'generate_music')
  assert.deepEqual(changed.allowed_models,[]);assert.equal(changed.style_id,'');assert.equal(changed.prompt_template,'原视频模板')
  b.changeType(step,'plan');assert.equal(events.at(-1).steps[3].planned_type,null)
})

test('仅切换待接通状态保留同类型模型与风格，不因缺失原因导致自动保存失败',async()=>{
  const {b,props,events}=await setup(),step=props.modelValue.steps[2]
  b.changeType(step,'unsupported')
  const pending=events[0].steps[2]
  assert.equal(pending.planned_type,'generate_image');assert.deepEqual(pending.allowed_models,['image-a'])
  assert.equal(pending.style_id,'style-a');assert.ok(pending.unavailable_reason)
  b.changeType(pending,'generate_image')
  const restored=events.at(-1).steps[2]
  assert.deepEqual(restored.allowed_models,['image-a']);assert.equal(restored.style_id,'style-a');assert.equal(restored.planned_type,null)
})
