import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse as parseSfc,compileScript,compileTemplate} from 'vue/compiler-sfc'

const filename='features/creation/components/SkillFlowEditor.vue'
const source=readFileSync(new URL(`../${filename}`,import.meta.url),'utf8')

test('步骤提示词模板在媒体步骤条件外显示并编辑同一草稿字段',()=>{
  const {descriptor,errors}=parseSfc(source,{filename})
  assert.deepEqual(errors,[])
  const template=descriptor.template.content
  const mediaStart=template.indexOf('<template v-if="fieldType(step).startsWith(\'generate_\')">')
  const mediaEnd=template.indexOf('</template>',mediaStart)
  const promptStart=template.indexOf('class="flow-prompt-template"')
  assert.ok(mediaStart>=0&&mediaEnd>mediaStart&&promptStart>mediaEnd,'plan、collect、unsupported 等步骤也必须能看到已有提示词模板')
  const promptField=template.slice(promptStart,template.indexOf('</label>',promptStart))
  assert.match(promptField,/step\.prompt_template\|\|''/)
  assert.match(promptField,/prompt_template:String\(\$event\)/)
})

test('媒体步骤继续从真实目录绑定模型和风格',()=>{
  const {descriptor}=parseSfc(source,{filename})
  const template=descriptor.template.content
  const mediaStart=template.indexOf('<template v-if="fieldType(step).startsWith(\'generate_\')">')
  const mediaEnd=template.indexOf('</template>',mediaStart)
  const mediaTemplate=template.slice(mediaStart,mediaEnd)
  assert.ok(mediaStart>=0&&mediaEnd>mediaStart)
  assert.match(template,/CreationStyleDialog/)
  assert.match(source,/style_id:style\.style_id/)
  assert.match(mediaTemplate,/availableModels\(step\)/)
  assert.match(mediaTemplate,/allowed_models\?\.includes\(model\.code\)/)
})

test('待接通步骤保留计划能力，音乐和合成不复用图片表单',()=>{
  assert.match(source,/step.type==='unsupported'\?step.planned_type/)
  assert.match(source,/generate_image:'生图提示词模板',generate_video:'视频提示词模板',generate_music:'音乐创作提示词模板',compose_video:'合成时间轴与参数模板'/)
  assert.match(source,/视频片段来源/)
  assert.match(source,/\['generate_image','generate_video'\]\.includes\(fieldType\(step\)\)/)
  assert.match(source,/可用音乐引擎/)
  assert.match(source,/fieldType\(step\)==='generate_music'">音乐风格与节奏/)
  assert.doesNotMatch(source,/步骤草稿可编辑保存；运行适配尚未开放/)
})

test('风格复用现有媒体弹窗，选择和取消隔离当前步骤',()=>{
  assert.match(source,/import CreationStyleDialog from '\.\/CreationStyleDialog.vue'/)
  assert.match(source,/selected.value!==step.id/)
  assert.match(source,/styleStepId.value=step.id/)
  assert.match(source,/:reference-allowed="false"/)
  assert.doesNotMatch(source,/<USelect\b/)
  assert.match(source,/<LivSelect[^>]*multiple/)
  assert.match(source,/flow-model-grid/)
  assert.match(source,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(source,/@container\(min-width:420px\)/)
})

test('手机端步骤列表与详情分层显示，返回不会清除草稿',()=>{
  const {descriptor,errors}=parseSfc(source,{filename})
  const script=compileScript(descriptor,{id:'skill-flow-detail-test'})
  const compiled=compileTemplate({source:descriptor.template.content,filename,id:'skill-flow-detail-test',compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(errors,[])
  assert.deepEqual(compiled.errors,[])
  assert.match(descriptor.template.content,/class="flow-layout" :class="\{'has-selection':!!selected\}"/)
  assert.match(descriptor.template.content,/返回步骤列表/)
  const backMethod=source.slice(source.indexOf('function backToStepList'),source.indexOf('</script>'))
  assert.match(backMethod,/selected\.value=''\s*;notice\.value=''/)
  assert.doesNotMatch(backMethod,/emit\(|modelValue|steps\s*=/)
  assert.match(descriptor.styles[0].content,/@media\(max-width:767px\)/)
  assert.match(descriptor.styles[0].content,/\.flow-layout\.has-selection \.flow-step-list\{display:none\}/)
  assert.match(descriptor.styles[0].content,/\.flow-layout:not\(\.has-selection\) \.flow-detail\{display:none\}/)
})

test('步骤卡片标题省略但保留完整提示，操作与输入间距清晰',()=>{
  const {descriptor}=parseSfc(source,{filename})
  const template=descriptor.template.content,style=descriptor.styles[0].content
  assert.match(template,/:title="step\.title"/)
  assert.match(template,/step-select/)
  assert.match(template,/step-actions/)
  assert.match(style,/\.step-copy strong\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/)
  assert.match(style,/\.step-actions\{display:flex;flex:none;align-items:center;gap:2px\}/)
  assert.match(style,/\.flow-fields\{display:grid;gap:16px/)
  assert.match(style,/\.flow-fields label\{display:grid;gap:8px/)
  assert.match(style,/\.flow-fields :deep\(\[role="combobox"\]\)\{width:100%;max-width:100%;min-width:0\}/)
})

test('步骤导航与字段独立滚动，编辑模型不能把步骤列表整体滚走',()=>{
  assert.match(source,/\.flow-step-list\{[^}]*overflow-y:auto/)
  assert.match(source,/\.flow-detail\{[^}]*overflow-y:auto/)
  const shell=readFileSync(new URL('../features/creation/components/SkillBuilderShell.vue',import.meta.url),'utf8')
  assert.match(shell,/is-flow-mode/);assert.match(shell,/\.builder-content.is-flow-mode\{overflow:hidden\}/)
})

test('未选步骤时图标和辅助提示居于详情区正中，不影响已选表单布局',()=>{
  assert.match(source,/class="flow-detail" :class="\{'is-empty':!selected\}"/)
  assert.match(source,/v-if="!selected" class="flow-note"><UIcon[^>]*aria-hidden="true"/)
  assert.match(source,/选择一个步骤后编辑/)
  assert.match(source,/\.flow-detail\.is-empty\{display:grid;place-items:center\}/)
  assert.match(source,/\.flow-note\{[^}]*align-items:center[^}]*color:var\(--liv-account-muted\)/)
})

test('步骤中列加宽并统一制造机各栏的细圆角中性滚动条',()=>{
  const tokens=readFileSync(new URL('../assets/css/tokens.css',import.meta.url),'utf8')
  const styles=readFileSync(new URL('../assets/css/main.css',import.meta.url),'utf8')
  assert.match(source,/minmax\(200px,var\(--liv-builder-step-column\)\) minmax\(0,1fr\)/)
  assert.match(tokens,/--liv-builder-step-column: 44%/)
  assert.match(tokens,/--liv-builder-scroll-width: 6px/)
  assert.match(styles,/\.skill-builder[^}]*scrollbar-color: var\(--liv-builder-scroll-thumb\) transparent/)
  assert.match(styles,/\.skill-builder ::-webkit-scrollbar-thumb\s*\{[^}]*border-radius: 100px/)
  assert.match(styles,/scrollbar-gutter: stable/)
})
