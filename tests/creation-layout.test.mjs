// 页面结构回归：不调用浏览器、不下载成片，也不创建收费任务。
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const studio = read('features/creation/components/CreationStudio.vue')
const sidebar = read('features/dashboard/components/DashboardSidebar.vue')
test('案例按用途切换，桌面五列且横向16:9', () => {
  assert.match(studio, /creationCaseService.list\(entry.value\)/)
  assert.doesNotMatch(studio, /dramaCases|creationCases\[|listEpisodeExports/)
  assert.match(read('assets/css/creation.css'), /creation-case-grid\{[^}]*repeat\(5/)
  assert.match(read('assets/css/creation.css'), /creation-case-cover\{[^}]*aspect-ratio:16\/9/)
  assert.doesNotMatch(studio, /<section[^>]*class="creation-recent"/)
})
test('成片播放器只在点击案例后挂载，预加载关闭', () => {
  assert.match(studio, /@click="openCase\(item\)"/)
  assert.match(studio, /v-if="selectedCase"[\s\S]*<video v-if="selectedCase.media_type==='video'"[^>]*preload="none"/)
  assert.match(studio, /<audio[^>]*preload="none"/)
  assert.match(studio, /制作同款/)
})
test('侧栏每页十条，更多原地加载，会话切换可恢复', () => {
  assert.match(sidebar, /recentSessionLimit = ref\(SESSION_PAGE_SIZE\)/)
  assert.match(sidebar, /recentProjects\.value\.slice\(0, recentSessionLimit.value\)/)
  assert.match(sidebar, /v-if="hasMoreSessions \|\| sessionsError"/)
  assert.match(sidebar, /@click="loadMoreSessions">更多/)
  assert.doesNotMatch(sidebar, /to="\/dashboard-projects" class="creation-sidebar-more"/)
  assert.match(sidebar, /creation-sidebar-divider/)
  assert.match(read('features/creation/useCreationWorkspace.ts'), /watch\(\(\) => route.query.session/)
  assert.match(sidebar, /creationProjectService.list\(SESSION_PAGE_SIZE\+1/)
  assert.doesNotMatch(read('features/projects/components/ProjectDirectoryPanel.vue'), /creationService.sessions/)
})
test('静态案例各用途独立且原创封面存在', async () => {
  const js = ts.transpileModule(read('features/creation/cases.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const { creationCases } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  for (const entry of ['free', 'commerce', 'music', 'image']) {
    assert.ok(creationCases[entry].length > 0)
    for (const item of creationCases[entry]) assert.ok(existsSync(new URL(`../public${item.cover}`, import.meta.url)))
  }
})

test('流程恢复等待目录，待回答状态也恢复输入和固定素材', () => {
  // 结构回归只约束恢复路径，不冒充浏览器刷新和真实模型调用验收。
  assert.match(studio, /watch\(\(\)=>\[route.query.run,catalog.value\]/)
  assert.match(studio, /if\(!directory/)
  assert.match(studio, /if\(run.status!=='cancelled'\)[\s\S]*run.draft.references/)
  assert.match(studio, /run.answers.map/)
  assert.match(studio, /director.value\?\.mv_run_id \|\| director.value\?\.director_run_id/)
})

test('重新预估沿用已保存未绑定任务消息的幂等编号', () => {
  const workspace = read('features/creation/useCreationWorkspace.ts')
  // 游客草稿也监听 prompt；定位报价后的监听，不能误截成空字符串。
  const start = workspace.indexOf('async function estimate')
  const estimate = workspace.slice(start, workspace.indexOf('watch([prompt, parameters', start))
  assert.match(estimate, /!pending.task_id && canonical\(pending.content\) === canonical\(value\) \? pending.request_id/)
})
