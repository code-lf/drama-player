// 错误映射执行测试与防串页结构约束；另行进行浏览器点击和刷新验证。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/sessionRecovery.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {sessionErrorText}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('会话网络失败不泄漏原始请求；权限、服务故障各自明确',()=>{assert.match(sessionErrorText(new Error('Failed to fetch')),/检查网络/);assert.match(sessionErrorText({statusCode:401}),/登录/);assert.match(sessionErrorText({response:{status:404}}),/无权访问/);assert.match(sessionErrorText({status:503}),/暂时不可用/)})
test('会话恢复取消旧请求并在提交视图前检查修订号',()=>{const source=read('features/creation/useCreationWorkspace.ts');assert.match(source,/restoreController\?\.abort\(\)/);assert.match(source,/current !== restoreRevision/);assert.match(source,/creationService.session\(id, signal\)[\s\S]*if \(stale\(\)\) return/);assert.match(source,/session.value=null;messages.value=\[\]/);assert.match(read('features/creation/components/CreationStudio.vue'),/重试加载会话/);assert.match(read('features/creation/components/CreationStudio.vue'),/v-if="!sessionLoading && !sessionError"/)})
