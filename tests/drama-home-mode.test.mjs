import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'

test('首页在共用剧本输入区选择模式，只在发送时保存画布文稿', () => {
  const filename = 'features/creation/components/CreationStudio.vue'
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'drama-home-mode' })
  const template = compileTemplate({
    id: 'drama-home-mode', filename, source: descriptor.template.content,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  assert.match(descriptor.template.content, /chooseEntry\(item.id\)/)
  assert.match(descriptor.template.content, /#workflow-mode>[\s\S]*?<URadioGroup[^>]*v-model="dramaMode"/)
  assert.doesNotMatch(descriptor.template.content, /选择短剧制作模式/)
  const handler = descriptor.scriptSetup.content.split('async function submitDramaCanvas')[1].split('\n}')[0]
  assert.match(handler, /creationService.readScriptFile\(file\)/)
  assert.match(handler, /delete previewInput.parameters.extra.director_run_id/)
  assert.match(handler, /script:value.prompt/)
  assert.match(handler, /script-document[\s\S]*source_text:preview.script[\s\S]*startScriptRun\(runDraft,attempt.runId,created.id,saved.revision\)/)
  assert.doesNotMatch(handler, /prompt:preview.script/)
  assert.match(handler, /!fromChat&&production\?\.style_id[\s\S]*production-intake/)
  assert.match(handler, /expected_document_revision:saved.revision/)
  assert.doesNotMatch(handler, /\b(?:prepare|submit|estimate|analyze)\(/)
  assert.match(descriptor.scriptSetup.content,/dramaMode.value==='canvas'\)\{await submitDramaCanvas\(\);return\}/)
  assert.match(descriptor.scriptSetup.content,/await submitDramaCanvas\(true\)/)
})

test('短剧模式在工具栏中先于已选与未选风格，保持键盘顺序一致', () => {
  const source = readFileSync('features/creation/components/CreationComposer.vue', 'utf8')
  const toolbar = parse(source).descriptor.template.content
  // 按模板顺序断言，避免用视觉排序把 Tab 焦点顺序留在风格之后。
  assert.match(toolbar, /<slot name="workflow-mode"\/>\s*<div v-if="hasActiveStyle" class="creation-selected-style">[\s\S]*?<UTooltip v-else[^>]*>[\s\S]*?aria-label="选择风格"/)
})

test('剧本与风格步骤仅显示真实助手工具收据', async () => {
  const source = readFileSync('features/creation/processEvents.ts', 'utf8')
  assert.match(source,/read_canvas_script:'读取剧本全文'/)
  assert.match(source,/request_visual_style:'请你选择风格'/)
  assert.match(source,/origin!=='agent'[\s\S]*?event.tool==='read_canvas_script'/)
})
