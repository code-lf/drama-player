// 结构回归保护全局字体与灵感点共用入口；浏览器加载情况另外进行实际验收。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
test('本地可变字体覆盖正文及表单，同时保留中文回退', () => {
  const css = read('assets/css/main.css')
  assert.match(css, /font-weight: 1 1000/)
  assert.match(css, /font-display: swap/)
  assert.match(css, /--font-sans: "Google Sans Flex", "PingFang SC", "Liv Noto Sans SC"/)
  assert.match(css, /--liv-font-menu: "PingFang SC", "Liv Noto Sans SC", sans-serif/)
  assert.match(css, /\.dashboard-sidebar nav \{\s*font-family: var\(--liv-font-menu\)/)
  assert.match(css, /NotoSansSC-Variable.woff2/)
  assert.match(css, /font-weight: 100 900/)
  assert.match(css, /font-family: var\(--font-sans\)/)
  assert.match(css, /select \{\s*font-family: inherit/)
  assert.ok(readFileSync(new URL('../public/fonts/GoogleSansFlex-Variable.ttf', import.meta.url)).length > 0)
})
test('积分图标共用透明 OSS 图和一次本地回退', () => {
  const icon = read('components/ui/CreditIcon.vue')
  assert.match(icon, /CREATIVE_POINT_URL/)
  assert.match(icon, /@error="useLocalFallback"/)
  assert.match(icon, /imageSource.value !== CREATIVE_POINT_FALLBACK/)
  assert.doesNotMatch(icon, /credit-star.svg/)
  assert.match(read('shared/constants/creativePoint.ts'), /https:\/\/flairshufei\.oss-cn-beijing/)
  assert.match(read('features/creation/components/CreationComposer.vue'), /<CreditIcon size="xs"/)
  assert.match(read('features/library/components/AssetLibraryPanel.vue'), /<CreditIcon size="xs"\/>生成/)
})
