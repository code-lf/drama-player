import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

// 真实画布重载只读取同一编辑版本元数据；不调用编辑保存、生成或计费接口。
const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
const node=readFileSync('features/creation/components/CreativeCanvasNode.vue','utf8')
const source=studio.slice(studio.indexOf('async function refreshGraphFile('),studio.indexOf('const graphResults='))
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('图片编辑版本重载重新读取原固定版本地址且不改来源或创建任务',async()=>{
  for(const mode of ['ok','stale-session','stale-owner','unavailable']){
    const original={id:'artifact-1',source:{kind:'image',id:'task-1',result_id:'result-1'},operations:[{type:'crop'}],item_id:'item-1',version_id:'version-1',preview_url:'/expired.png'}
    const state={session:{value:{id:'session-1',artifacts:[original]}},draftOwner:{value:'owner-1'},error:{value:''},notice:{value:''},calls:[]}
    const fixture={...state,libraryService:{detail:async id=>{state.calls.push(id);if(mode==='stale-session')state.session.value={id:'other',artifacts:[]};if(mode==='stale-owner')state.draftOwner.value='other';if(mode==='unavailable')throw Error('素材库读取失败');return {media_type:'image',versions:[{id:'version-1',preview_url:'/fresh.png'}]}}}}
    const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return refreshGraphFile`)(fixture)
    await run({id:'result:artifact:artifact-1:',data:{source:{kind:'artifact',id:'artifact-1'},url:'/expired.png'}})
    assert.deepEqual(state.calls,['item-1'])
    if(mode==='ok'){
      assert.equal(state.session.value.artifacts[0].preview_url,'/fresh.png')
      assert.equal(state.session.value.artifacts[0].version_id,'version-1')
      assert.deepEqual(state.session.value.artifacts[0].source,original.source)
      assert.match(state.notice.value,/重新读取/);assert.equal(state.error.value,'')
    }else if(mode==='unavailable'){
      assert.equal(state.session.value.artifacts[0].preview_url,'/expired.png');assert.equal(state.error.value,'素材库读取失败')
    }else{
      assert.deepEqual(state.session.value.artifacts,mode==='stale-session'?[]:[original]);assert.equal(state.notice.value,'');assert.equal(state.error.value,'')
    }
  }
})

test('重载链从媒体卡片经画布回到资料库只读接口，不碰生成接口',()=>{
  assert.match(node,/emit\('refreshFile',props\.id\)/)
  assert.match(canvas,/@refresh-file="refreshNodeFile"/)
  assert.match(canvas,/emit\('refreshFile',node\)/)
  assert.match(studio,/@refresh-file="refreshGraphFile"/)
  assert.match(source,/libraryService\.detail\(artifact\.item_id\)/)
  assert.match(source,/creationService\.run\(run\.id\)/)
  assert.match(source,/productImageService\.getHistory\(source\.id\)/)
  assert.match(source,/productVideoService\.getTask\(source\.id\)/)
  assert.match(source,/readGraphCompositions\(true\)/)
  assert.doesNotMatch(source,/creationService\.(?:confirm|create|saveArtifact)|product(?:Image|Video)Service\.(?:generate|create)/)
})

test('批次视频文件重载重新读取所属运行快照，不调用生成或许可接口',async()=>{
  const original={id:'run-1',session_id:'session-1',creative_plan:{batch:{items:[{task_id:'video-task-1',results:[{id:'video-1',video_url:'/expired.mp4'}]}]}}}
  const fresh={...original,creative_plan:{batch:{items:[{task_id:'video-task-1',results:[{id:'video-1',video_url:'/fresh.mp4'}]}]}}}
  const state={session:{value:{id:'session-1'}},draftOwner:{value:'owner-1'},graphRuns:{value:[original]},messages:{value:[]},taskData:{},musicTasks:{value:[]},references:{value:[]},roundReferences:{value:[]},assistantHistory:{value:[original]},planning:{value:null},error:{value:''},notice:{value:''},calls:[]}
  const fixture={...state,creationService:{run:async id=>{state.calls.push(`read-run:${id}`);return fresh}},updateRecoveredFlow:run=>{state.calls.push(`project-run:${run.id}`);state.assistantHistory.value=[run]},libraryService:{},productImageService:{},productVideoService:{},musicService:{},readGraphCompositions:async()=>{},normalizeStatus:value=>value}
  const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return refreshGraphFile`)(fixture)
  await run({id:'plan:run-1:item-1',data:{source:{kind:'video',id:'video-task-1',result_id:'video-1'}}})
  assert.deepEqual(state.calls,['read-run:run-1','project-run:run-1'])
  assert.equal(state.assistantHistory.value[0].creative_plan.batch.items[0].results[0].video_url,'/fresh.mp4')
  assert.match(state.notice.value,/未重新生成/)
  assert.equal(state.error.value,'')
})

test('旧式图片任务文件重载只读取原任务并更新当前会话投影',async()=>{
  const message={id:'message-1',task_type:'image',task_id:'image-task-1'}
  const state={session:{value:{id:'session-1'}},draftOwner:{value:'owner-1'},graphRuns:{value:[]},messages:{value:[message]},taskData:{},musicTasks:{value:[]},references:{value:[]},roundReferences:{value:[]},assistantHistory:{value:[]},planning:{value:null},error:{value:''},notice:{value:''},calls:[]}
  const fixture={...state,productImageService:{getHistory:async id=>{state.calls.push(`read-image:${id}`);return {status:'completed',progress:100,currentStep:'已完成',results:[{id:'result-1',imageUrl:'/fresh.png'}]}}},productVideoService:{},creationService:{},musicService:{},libraryService:{},readGraphCompositions:async()=>{},normalizeStatus:value=>value}
  const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return refreshGraphFile`)(fixture)
  await run({id:'result:image:image-task-1:result-1',data:{source:{kind:'image',id:'image-task-1',result_id:'result-1'}}})
  assert.deepEqual(state.calls,['read-image:image-task-1'])
  assert.equal(state.taskData['message-1'].images.results[0].imageUrl,'/fresh.png')
  assert.match(state.notice.value,/未重新生成/)
  assert.equal(state.error.value,'')
})

test('合成与参考素材节点重载走各自的只读恢复入口',async()=>{
  for(const source of [{kind:'composition',id:'composition-1'},{kind:'reference',id:'version-1',item_id:'item-1'}]){
    const state={session:{value:{id:'session-1',reference_previews:{}}},draftOwner:{value:'owner-1'},graphRuns:{value:[]},messages:{value:[]},taskData:{},musicTasks:{value:[]},references:{value:[{item_id:'item-1',version_id:'version-1',name:'参考',media_type:'image',preview_url:'/expired.png'}]},roundReferences:{value:[]},assistantHistory:{value:[]},planning:{value:null},error:{value:''},notice:{value:''},calls:[]}
    const fixture={...state,readGraphCompositions:async reset=>state.calls.push(`read-compositions:${reset}`),libraryService:{detail:async id=>{state.calls.push(`read-library:${id}`);return {name:'参考图',media_type:'image',versions:[{id:'version-1',preview_url:'/fresh.png'}]}},previewUrl:value=>`signed:${value}`},creationService:{},productImageService:{},productVideoService:{},musicService:{},normalizeStatus:value=>value}
    const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return refreshGraphFile`)(fixture)
    await run({id:`${source.kind}:${source.id}`,data:{source}})
    if(source.kind==='composition')assert.deepEqual(state.calls,['read-compositions:true'])
    else{
      assert.deepEqual(state.calls,['read-library:item-1'])
      assert.equal(state.references.value[0].preview_url,'signed:/fresh.png')
      assert.equal(state.session.value.reference_previews['version-1'].preview_url,'/fresh.png')
    }
    assert.equal(state.error.value,'')
  }
})
