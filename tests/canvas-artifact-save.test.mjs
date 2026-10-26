// 运行真实保存回填方法，只隔离免费文件接口；不会创建生成任务或改写历史作品。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const raw=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const source=raw.slice(raw.indexOf('async function saveCanvas('),raw.indexOf('/** 选择 AI 工具只绑定明确来源'))
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('免费保存后编辑器和画布定位到独立版本，保留原作品来源',async()=>{
  for(const outcome of ['saved','edited','stale']){
    const artifact={id:'saved',source:{kind:'image',id:'original',result_id:'result'},preview_url:'/saved.png'}
    const state={session:{value:{id:'session',artifacts:[]}},saveBusy:{value:false},canvasSelected:{value:''},graphToolsOpen:{value:true},graphToolNode:{value:{id:'original',position:{x:0,y:0},data:{source:artifact.source,url:'/original.png'}}},notice:{value:''},error:{value:''},messages:{value:[]},graphResults:{value:[{key:'artifact:saved',kind:'image',title:'图片编辑版本',summary:'',url:'/saved.png',source:{kind:'artifact',id:'saved'}}]},focused:[],calls:[]}
    const fixture={...state,creationService:{saveArtifact:async(...args)=>{state.calls.push(args);if(outcome==='stale')state.session.value={id:'other',artifacts:[]};return artifact}},canvasRef:{value:{markSaved:()=>outcome!=='edited'}},agentCanvasRef:{value:{focus:async id=>state.focused.push(id)}},nextTick:async()=>{},resultCanvasNodeId:()=> 'result:artifact:saved:'}
    const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return saveCanvas`)(fixture)
    const value={file:new Blob(['pixels']),source:artifact.source,operations:[{type:'draw'}],requestId:'stable'}
    const result=await run(value);assert.equal(state.calls.length,1);assert.equal(state.saveBusy.value,false)
    if(outcome==='saved'){
      assert.equal(result.id,'saved');assert.equal(state.session.value.artifacts[0].source.id,'original');assert.deepEqual(state.focused,['result:artifact:saved:'])
      assert.equal(state.graphToolNode.value.data.source.kind,'artifact');assert.equal(state.graphToolNode.value.data.url,'/saved.png');assert.equal(state.canvasSelected.value,'saved')
    }else{
      assert.equal(result,undefined);assert.equal(state.graphToolNode.value.data.url,'/original.png');assert.equal(state.focused.length,0)
      if(outcome==='stale')assert.deepEqual(state.session.value.artifacts,[])
    }
  }
})
