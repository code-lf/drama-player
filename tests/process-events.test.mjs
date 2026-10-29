// 兼容旧草稿时不捏造工具调用；执行状态展示不产生任何写操作。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../features/creation/processEvents.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const exports={};new Function('exports',code)(exports)
test('原服务事件原样投影，包括未知与失败',()=>{const events=[{id:'x',title:'提交任务',status:'unknown'}];assert.deepEqual(exports.authoringProcessEvents({status:'processing',events}),events)})
test('旧草稿不补造保存正文或设置元数据，成功时无内部提示',()=>{for(const status of ['processing','ready','failed']){const events=exports.authoringProcessEvents({status});if(status==='ready'){assert.deepEqual(events,[]);continue}assert.equal(events.length,1);assert.doesNotMatch(events[0].title,/保存|元数据|转换完成/);assert.equal(events[0].status,status)}})
test('隐藏候选落盘的内部通知，保留实际阶段',()=>{assert.deepEqual(exports.authoringProcessEvents({status:'ready',events:[{id:'candidate',title:'保存整理候选',status:'succeeded'}]}),[])})

test('阶段说明保留真实回包，不从标题捏造操作内容',()=>{const events=[{id:'document',title:'校验 SKILL.md',description:'正文已校验，尚未应用。',status:'succeeded'}];assert.deepEqual(exports.authoringProcessEvents({status:'ready',events}),events)})
