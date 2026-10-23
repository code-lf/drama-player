// 会话布局结构回归：不调用生成接口，不创建收费任务。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const composer = read('features/creation/components/CreationComposer.vue')

test('大输入框不重复底栏加号，紧凑输入框仍有素材入口，技能闪电实心且工具文字统一', () => {
  assert.ok(composer.includes('v-if="compact && !isMv && entry!==\'drama\'"'))
  assert.ok(composer.includes('v-if="!compact && !isMv && entry!==\'drama\'" class="creation-add"'))
  assert.ok(composer.includes('name="i-lucide-zap" mode="svg" class="creation-solid-zap"'))
  const css=read('assets/css/creation.css')
  assert.match(css,/creation-toolbar \.creation-tool,[^}]*font-size:14px!important;font-weight:500!important/)
  assert.ok(css.includes('.creation-solid-zap,.creation-solid-zap path{fill:currentColor}'))
})

test('会话收起顶部用途，音乐重复页签在首页和会话均移除', () => {
  assert.match(read('features/creation/components/CreationStudio.vue'), /<nav v-if="!active && !sessionLoading && !sessionError" class="creation-entry-tabs"/)
  assert.doesNotMatch(composer, /class="creation-subtabs"/)
})

test('会话上传移到底栏，图标有提示和可访问名称且费用未丢失', () => {
  assert.match(composer, /UTooltip[^>]*text="添加素材/)
  for (const label of ['选择模型', '选择风格', '选择创作模板','清除风格']) assert.ok(composer.includes(`aria-label="${label}"`))
  // MV 复用参数按钮，但无障碍名称明确为比例，其余入口仍是创作参数。
  assert.ok(composer.includes(`:aria-label="isMv?'调整 MV 比例':'调整创作参数'"`))
  assert.ok(composer.includes('从资料库选择'))
  assert.ok(!composer.includes('aria-label="引用资产"'))
  assert.match(composer, /class="creation-cost" role="status" :aria-label="creditLabel"/)
  assert.match(composer, /v-if="hasCreditQuote">\{\{ creditLabel \}\}/)
  assert.ok(composer.includes("(canStop&&emit('stop')) : emit('send')"))
})

test('全部工具气泡零延迟且固定在图标上方', () => {
  const tooltips = composer.match(/<UTooltip\b[^>]*>/g) || []
  assert.equal(tooltips.length, 11)
  for (const tooltip of tooltips) {
    assert.ok(tooltip.includes(':delay-duration="0"'))
    assert.ok(tooltip.includes("side: 'top'"))
    assert.ok(tooltip.includes('avoidCollisions: false'))
  }
})

test('紧凑工具栏不换行，参数面板向上避开底部', () => {
  assert.match(read('assets/css/creation.css'), /creation-composer.is-compact .creation-toolbar\{[^}]*flex-wrap:nowrap/)
  assert.match(composer, /const placement = props.compact[\s\S]*window.innerHeight - rect.top \+ 10/)
})
