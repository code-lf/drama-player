// 页面结构回归：不调用浏览器、不下载成片，也不创建收费任务。
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const studio = read('features/creation/components/CreationStudio.vue')
const sidebar = read('features/dashboard/components/DashboardSidebar.vue')

test('首页启动使用专属骨架，侧栏恢复工作台且会话首页不变',()=>{
  const page=read('pages/dashboard.vue'),skeleton=read('components/DashboardSkeleton.vue')
  assert.match(page,/route.query.session\?'conversation':'home'/)
  assert.match(skeleton,/v-else-if="variant==='home'"/)
  assert.match(skeleton,/class="creation-home"/)
  assert.match(skeleton,/home-skeleton-composer\{height:clamp\(190px,30cqi,240px\)/)
  assert.match(sidebar,/<span>Liv 工作台<\/span>/)
  assert.match(read('features/creation/components/SessionWorkspaceNav.vue'),/label:'首页'/)
})
test('案例按用途切换，桌面五列且横向16:9', () => {
  assert.match(studio, /creationCaseService.list\(entry.value\)/)
  assert.doesNotMatch(studio, /dramaCases|creationCases\[|listEpisodeExports/)
  assert.match(read('assets/css/creation.css'), /creation-case-grid\{[^}]*repeat\(5/)
  assert.match(read('assets/css/creation.css'), /creation-case-cover\{[^}]*aspect-ratio:16\/9/)
  assert.doesNotMatch(studio, /<section[^>]*class="creation-recent"/)
})
test('成片播放器只在点击案例后挂载，仅预读元数据', () => {
  assert.match(studio, /@click="openCase\(item\)"/)
  // 播放器已经抽到统一案例组件；仍约束有真实选中项才挂载媒体。
  assert.match(studio, /<CreationCaseViewer :item="selectedCase"/)
  const viewer=read('features/creation/components/CreationCaseViewer.vue')
  assert.match(viewer, /v-if="item"[\s\S]*<video v-if="item.media_type==='video'"[^>]*preload="metadata"/)
  assert.match(viewer, /<audio[^>]*preload="metadata"/)
  assert.match(viewer, /复刻同款/)
})
test('侧栏每页十条，更多原地加载，会话切换可恢复', () => {
  assert.match(sidebar, /recentSessionLimit = ref\(SESSION_PAGE_SIZE\)/)
  assert.match(sidebar, /recentProjects\.value\.slice\(0, recentSessionLimit.value\)/)
  assert.match(sidebar, /v-if="hasMoreSessions && listFilled"/)
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
  // 报价已合并到prepare；先验证真实边界存在，避免旧函数名截空导致假失败。
  const start = workspace.indexOf('async function prepare(')
  const end = workspace.indexOf('\n  async function ', start+1)
  assert.ok(start>=0&&end>start,'应能定位真实准备方法')
  const prepare = workspace.slice(start,end)
  assert.match(prepare, /!pending.task_id && canonical\(pending.content\) === canonical\(value\) \? pending.request_id/)
})
// 首页布局按容器而非整页宽度收缩，避免侧栏展开后工具按钮挤成多行。
test('首页最大800px，窄容器图标化与快捷入口换行',()=>{
  const css=read('assets/css/creation.css')
  assert.match(read('assets/css/tokens.css'),/--liv-home-composer-width:\s*800px/)
  assert.match(css,/container-name:home-composer/)
  assert.match(css,/@container home-composer \(max-width:640px\)/)
  assert.match(css,/@container home-composer \(max-width:360px\)/)
  assert.match(css,/creation-home \.creation-quick-templates\{flex-wrap:wrap;justify-content:center;overflow:visible/)
  assert.match(css,/min-height:clamp\(190px,30cqi,240px\)/)
})
