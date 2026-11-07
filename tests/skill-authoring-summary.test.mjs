// 交付解读必须可从原文复核；不生成工具权限、发布成功或虚假计价。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../features/creation/skillAuthoringSummary.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const exports={};new Function('exports',code)(exports)
test('从实际章节提炼方法、输入、模板和检查，而非只回复状态',()=>{
  const result=exports.skillAuthoringSummary({label:'软件宣传',document:'# 技能\n\n## 必要输入\n软件名、真实卖点。\n\n## 创作方法\n按痛点与演示组织。\n\n### 口播台词模板\n{{软件名}}帮助{{受众}}。\n\n### 视频提示词模板\n保持真实UI。\n\n## 质量检查\n总时长不符先修正文案。\n\n## 交付清单\n口播、分镜、提示词。\n\n## 能力限制\n不自动采购。'})
  for(const text of ['软件名、真实卖点','按痛点与演示','{{受众}}','保持真实UI','总时长不符','口播、分镜'])assert.ok(result.includes(text),text)
  assert.doesNotMatch(result,/已保存|已发布|联网检索|已生成视频|成功/)
  assert.doesNotMatch(result,/使用边界|不自动采购|本次未生成媒体/)
})

test('仅列真实资源，不将正文文件名或固定系统说明冒充交付',()=>{
  const config={label:'视频制作',document:'# 技能\n## 目标\n可先策划再制作。\n## 能力限制\n模型目录仅表示当前可用规格。\n\n参考 method.md。',public_guide:{output:'口播、分镜和可继续制作的提示词。'}}
  const empty=exports.skillAuthoringSummary(config)
  assert.doesNotMatch(empty,/method\.md|资源附件|模型目录仅表示/)
  const actual=exports.skillAuthoringSummary({...config,text_resources:[{name:'method.md'}]})
  assert.match(actual,/资源附件[\s\S]*`method.md`/)
  assert.match(actual,/可继续制作/)
  // 仅改变摘要呈现，历史文档和原有业务限制不被改写。
  assert.match(config.document,/模型目录仅表示/)
})
test('空文档不杜撰方法或时间预算',()=>{const result=exports.skillAuthoringSummary({label:'空稿'});assert.doesNotMatch(result,/60秒|五段|180|已绑定/)})

test('待支持视频在解读中保留计划类型与绑定，不宣称可执行',()=>{
  const result=exports.skillFlowSummary({version:1,steps:[{id:'v',title:'四条视频',type:'unsupported',planned_type:'generate_video',instructions:'保留四条',inputs:[],allowed_models:['real-video'],unavailable_reason:'跨媒体待接通'}]})
  assert.match(result,/计划能力.*生成视频/);assert.match(result,/real-video/);assert.match(result,/尚未接通执行/)
})
test('隐藏历史内部状态但保留用户原话与失败原因',()=>{assert.equal(exports.isAuthoringNotice({role:'assistant',content:'当前草稿已自动保存'}),true);assert.equal(exports.isAuthoringNotice({role:'user',content:'当前草稿已自动保存'}),false);assert.equal(exports.isAuthoringNotice({role:'assistant',content:'保存失败，原稿保留。'}),false)})

test('转换解读逐项对应真实步骤、绑定和依赖，不冒充已执行',()=>{
  const result=exports.skillFlowSummary({version:1,steps:[{id:'plan',title:'两条广告策划',type:'plan',instructions:'分别保留独立提示词',inputs:[],prompt_template:'{{商品}}'}, {id:'video',title:'生成两条视频',type:'generate_video',instructions:'保持数量',inputs:['plan'],allowed_models:['real-model'],style_prompt:'暖阳生活风'}, {id:'audio',title:'自动配音',type:'unsupported',instructions:'待接入',inputs:['video'],unavailable_reason:'配音混音尚未接通'}]})
  for(const text of ['3 个步骤','两条广告策划','分别保留独立提示词','前序输入','real-model','暖阳生活风','配音混音尚未接通','未生成媒体'])assert.ok(result.includes(text),text)
  assert.doesNotMatch(result,/已生成视频|可直接运行|已绑定垫图|已保存/)
  assert.match(exports.skillFlowSummary(null),/未返回可核对/)
})
