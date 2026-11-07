/** WebCut 发布包只读门槛检查；不导入或执行第三方代码，不安装依赖、不访问私人媒体。 */
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'

// 固定 npm 发布包，防止用主分支文档或其他版本冒充本轮证据。
const expected='ECU6sHtNqXa/Wn87/W0IYQ/h6Bh1U2YgG8ppWjUeHBOT9OIt4AYYHDwRaXhcm1zGH5NUEwNe9TRI0Sibr8HVTQ=='
const root=resolve(process.argv[2]||'.codex-runtime/webcut-probe')
const bytes=await readFile(resolve(root,'webcut-0.2.9.tgz'))
assert.equal(createHash('sha512').update(bytes).digest('base64'),expected,'发布包完整性不匹配，停止检查')
const read=path=>readFile(resolve(root,'package',path),'utf8')
const manifest=JSON.parse(await read('package.json'))
assert.equal(manifest.version,'0.2.9')
const [container,history,machine,db,segment,context]=await Promise.all([
  'src/views/manager/container/index.vue','src/hooks/history.ts','src/libs/history-machine.ts',
  'src/db/index.ts','src/views/manager/main/index.vue','src/hooks/index.ts',
].map(read))
// 这些检查记录真实耦合，不把发现风险误当作完成运行时或安全验收。
const findings={
  timelineUsesPrivateHistory:container.includes('useWebCutHistory')&&container.includes('pushHistory();'),
  historyLoadsOnMount:history.includes('onMounted(async () =>')&&history.includes('historyMachine.init()'),
  historyWritesLocalProject:machine.includes('pushProjectHistory(this.projectId, state)'),
  fixedLocalDatabase:db.includes("name: 'webcut'")&&db.includes("name: 'project_state'"),
  mixedVisualRailNeedsAdapter:segment.includes("rail.type === 'video'")&&segment.includes("rail.type === 'image'"),
  aspectRatioWritesProject:context.includes('await updateProjectState(id.value, { aspectRatio })'),
}
assert.ok(Object.values(findings).every(Boolean),'发布包与已记录耦合证据变化，请人工重新审查')
console.log(JSON.stringify({version:manifest.version,integrityVerified:true,license:manifest.license,
  findings,decision:'blocked_unmodified_package',
  runtimeVerified:false,dependencySecurityVerified:false,privateMediaVerified:false},null,2))
