// 右键裁剪只切换本地编辑器；会话或节点过期时不打开旧作品工具。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const snippet=source.slice(source.indexOf('async function openGraphTools('),source.indexOf('/** 普通画布工具使用节点子任务输入'))
const compiled=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('右键裁剪等内嵌编辑器挂载后开启，迟到的会话切换不会打开旧节点',async()=>{
  for(const stale of [false,true]){
    const calls=[],session={value:{id:'session-1'}},canvasRef={value:{confirmLeave:async()=>true,openCrop:async()=>calls.push('crop')}}
    const fixture={
      busy:{value:false},session,draftOwner:{value:'owner-1'},canvasRef,
      graphToolsEpoch:0,graphToolsOpen:{value:false},graphToolNode:{value:null},
      nextTick:async()=>{if(stale)session.value={id:'session-2'}},
    }
    const names=Object.keys(fixture).filter(name=>name!=='graphToolsEpoch')
    const run=new Function('fixture',`const {${names.join(',')}}=fixture;let graphToolsEpoch=fixture.graphToolsEpoch;${compiled};return openGraphTools`)(fixture)
    const node={id:'image-node',data:{kind:'image',url:'/image.png',source:{kind:'artifact',id:'source-artifact'}}}
    await run(node,'crop')
    assert.equal(fixture.graphToolsOpen.value,true)
    assert.deepEqual(calls,stale?[]:['crop'])
  }
})
