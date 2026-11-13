// 对照界面的结构约束；真实字号、颜色和交互仍由浏览器另行验收。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
test('隐藏突兀的独立参考栏，但保留下一轮素材引用上下文',()=>{
  // 只撤下展示，不允许通过清空引用来隐藏，避免后续创作丢失商品或图片上下文。
  const source=read('features/creation/components/CreationStudio.vue')
  assert.doesNotMatch(source,/class="creation-round-references"/)
  assert.doesNotMatch(source,/aria-label="本轮参考素材"/)
  assert.match(source,/mergeRoundReferences\(roundReferences\.value,sentReferences\)/)
  assert.match(source,/round_reference_state/)
})
test('输出类型只在模型选择入口切换，不展示重复的智能选择行',()=>{const source=read('features/creation/components/CreationComposer.vue');assert.doesNotMatch(source,/class="creation-output"/);assert.doesNotMatch(source,/label:'智能选择'/);assert.match(source,/function chooseModel\(code:string,kind:ModelKind=modelKind.value\)/);assert.match(source,/output:modelKind.value/);assert.match(source,/chooseMusicType/)})
test('最近项目字号提升、行高放大并保留长标题全名',()=>{const css=read('assets/css/creation.css');assert.match(css,/\.creation-sidebar-recent a\{height:44px;min-height:44px;padding:8px 10px;gap:8px;font-size:14px!important;line-height:22px/);assert.match(css,/\.creation-sidebar-recent a>span\{font-size:14px!important;font-weight:500;line-height:22px/);assert.match(css,/\.creation-sidebar-recent \.iconify\{width:14px!important;height:14px!important/);assert.ok(read('features/dashboard/components/DashboardSidebar.vue').includes(':title="sessionLabel(item.title)"'))})
test('侧栏未选项目使用灰字，选中或交互时恢复白色并保留靛紫主题',()=>{assert.match(read('features/dashboard/components/SidebarIcon.vue'),/:stroke-width="2.4"/);assert.match(read('features/dashboard/components/DashboardSidebar.vue'),/<SidebarIcon/);const css=read('assets/css/creation.css');assert.match(css,/\.liv-sidebar-item span,.+\.creation-sidebar-recent \.liv-session-title\{color:var\(--liv-account-muted\)!important\}/);assert.match(css,/\.liv-session-row\.is-active \.liv-session-title\{color:var\(--liv-chat-assistant-text\)!important\}/);assert.match(css,/--liv-accent:#4F46E5/)})
test('技能分类单行且我的技能分创建和收藏',()=>{const source=read('features/creation/components/SkillCenterPanel.vue');assert.match(source,/自媒体','广告营销','游戏','短漫剧','周边设计/);assert.match(source,/aria-label="技能分类"/);assert.match(source,/我创建的/);assert.match(source,/我收藏的/);assert.match(source,/container-type:inline-size/)} )
test('主题变量统一为用户指定靛紫色',()=>{const source=read('assets/css/creation.css');assert.match(source,/--liv-accent:#4F46E5/);assert.doesNotMatch(source,/#ff2aa3/);assert.match(read('features/creation/components/SkillCenterPanel.vue'),/background:var\(--liv-accent\)/);assert.match(read('app.config.ts'),/primary: 'indigo'/)})
test('自由音频入口使用真实音乐目录而不展示未接入的模型',()=>{const source=read('features/creation/components/CreationComposer.vue');assert.match(source,/modelKind.value=isMusic.value\?'music'/);assert.match(source,/operation==='generation'&&row.enabled/);assert.doesNotMatch(source,/Seed Audio/);assert.match(source,/chooseMusicType/)})
test('资产浏览保留旧文档和版本管理，音色预听真实文件',()=>{const source=read('features/library/components/AssetLibraryPanel.vue');assert.match(source,/演员库/);assert.match(source,/音色库/);assert.match(source,/文件素材/);assert.match(source,/回收站/);assert.match(source,/<LibraryWorkspacePanel/);assert.match(source,/await audio.value.play\(\)/);/* 未点击试听时音频没有来源，真实文件仅由试听动作赋值。 */assert.match(source,/<audio ref="audio" @ended=/);assert.match(source,/audio.value.src=libraryService.previewUrl/);assert.match(source,/libraryService.restore/);assert.match(source,/page\*24>=total/);assert.doesNotMatch(source,/option value="public"/)})
