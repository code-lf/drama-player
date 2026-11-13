// 执行客户端真实适配器选择方法，确认按需加载不会改变模拟与真实接口边界。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source=readFileSync('shared/api/client.ts','utf8')
const body=source.slice(source.indexOf('async function pickAdapter()'),source.indexOf('function markFailure('))
const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace("import('~/shared/api/adapters/mockAdapter')",'loadMock()')

test('真实模式不读取前端模拟适配器；模拟模式只使用显式选择的适配器',async()=>{
  const config={public:{apiAdapter:'real'}},real={name:'real'},mock={name:'mock'}
  let loads=0
  const pick=new Function('useRuntimeConfig','httpAdapter','loadMock',`${compiled};return pickAdapter`)(()=>config,real,async()=>{loads++;return {mockAdapter:mock}})
  assert.equal(await pick(),real);assert.equal(loads,0)
  config.public.apiAdapter='mock'
  assert.equal(await pick(),mock);assert.equal(loads,1)
  config.public.apiAdapter='real'
  assert.equal(await pick(),real);assert.equal(loads,1)
  assert.match(source,/const adapter = await pickAdapter\(\)/)
})

test('模拟适配器加载失败不回落到真实采购接口',async()=>{
  const pick=new Function('useRuntimeConfig','httpAdapter','loadMock',`${compiled};return pickAdapter`)(
    ()=>({public:{apiAdapter:'mock'}}),{name:'real'},async()=>{throw new Error('模拟模块加载失败')}
  )
  await assert.rejects(pick(),/模拟模块加载失败/)
})

test('业务调用等待选中适配器后仅执行一次，不因异步加载重复发送',async()=>{
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
    .replace(/^import .*$/gm,'').replace(/^export /gm,'')
    .replace("import('~/shared/api/adapters/mockAdapter')",'loadMock()')
  const config={public:{apiAdapter:'real'}},real={name:'real'},mock={name:'mock'},calls=[]
  class ApiClientError extends Error{}
  const call=new Function('useRuntimeConfig','httpAdapter','loadMock','ApiClientError',`${js};return callApi`)(
    ()=>config,real,async()=>({mockAdapter:mock}),ApiClientError
  )
  const execute=adapter=>{calls.push(adapter.name);return Promise.resolve({success:true,data:adapter.name})}
  assert.equal(await call('sample',execute),'real')
  config.public.apiAdapter='mock'
  assert.equal(await call('sample',execute),'mock')
  assert.deepEqual(calls,['real','mock'])
})
