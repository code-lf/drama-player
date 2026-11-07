import{readFileSync}from'node:fs'
import{test}from'node:test'
import assert from'node:assert/strict'
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
test('批量删除静默逐项执行并汇总成功项，失败也刷新',()=>{
 const panel=read('features/projects/components/UnifiedProjectDirectory.vue')
 assert.match(panel,/recycle.remove\(item,true\)/)
 assert.match(panel,/items.value=items.value.filter\(row=>row.id!==item.id\)/)
 assert.match(panel,/finally\{[\s\S]*recycle.notifyRemoved\(removed\);await load\(\)/)
 const bin=read('composables/useProjectRecycleBin.ts')
 assert.match(bin,/id:'project-recycle-result'/)
 assert.match(bin,/if\(silent\)return/)
})
test('回收站共用目录网格及品牌占位，确认操作不挤压',()=>{
 assert.match(read('features/projects/components/ProjectTrashPanel.vue'),/DashboardSkeleton v-if="busy" variant="projects" :heading="false"/)
 assert.doesNotMatch(read('features/projects/components/ProjectTrashPanel.vue'),/USkeleton v-for/)
 assert.match(read('features/projects/components/ProjectTrashPanel.vue'),/project-card-grid/)
 assert.match(read('features/projects/components/ProjectTrashPanel.vue'),/暂无项目封面/)
 assert.match(read('components/liv-ui/LivDialog.vue'),/gap:12px!important/)
 assert.match(read('components/liv-ui/LivDialog.vue'),/min-width:112px/)
 assert.match(read('app.vue'),/position: 'top-center'/)
})
test('删除核实真实回执，分页和提示动作具有高对比前景',()=>{
 assert.match(read('shared/api/services/creationProjectService.ts'),/result.id!==item.id\|\|result.is_deleted!==true/)
 assert.match(read('features/projects/components/ProjectDirectoryPanel.vue'),/button\[aria-current=page\].*liv-control-on-primary/)
 assert.match(read('assets/css/liv-icon-menu.css'),/project-recycle-toast button.*liv-control-on-primary/)
 assert.doesNotMatch(read('composables/useProjectRecycleBin.ts'),/description:'对话、制作数据与作品仍保留。'/)
})
