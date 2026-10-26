// 运行真实交接方法体，隔离DOM渲染和全部业务服务；绝不采购或伪造上传成功。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

function method(path,start,end){const text=readFileSync(path,'utf8');return ts.transpileModule(text.slice(text.indexOf(start),text.indexOf(end)),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText}
const transfer=method('features/creation/components/CreationStudio.vue','async function useGraphAnnotation(', 'async function openGraphTools(')
const prepare=method('features/creation/components/CreationResultCanvas.vue','async function useAnnotation(', '/** 截帧单独读取')

test('批注先保存固定版本再绑定创作素材，移除原图重复引用且不生成/继承费用授权',async()=>{
  for(const outcome of ['saved','stale','failed','edited']){
    const value={file:new Blob(['image']),source:{kind:'image',id:'original',result_id:'result'},operations:[{type:'draw'}],requestId:'stable',preview:'data:image/png;base64,x'}
    const artifact={id:'artifact',item_id:'saved-item',version_id:'saved-version',preview_url:'/saved.png'}
    const state={session:{value:{id:'session'}},draftOwner:{value:'owner'},graphToolsOpen:{value:true},chatCollapsed:{value:true},mobilePane:{value:'canvas'},graphAnnotationReturn:{value:null},annotationSubmitting:{value:false},current:value,focus:0,reads:0,
      prompt:{value:'修改瓶盖颜色'},references:{value:[{version_id:'original-version'},{version_id:'other'}]},parameters:{value:{extra:{creation_run_id:'old-authorization',keep:'value'}}},director:{value:{}},directorAccepted:{value:true},confirmation:{value:{credits:12}},notice:{value:''},error:{value:''},skill:''}
    state.hasEdits=outcome==='edited'
    const run=new Function('state','saveCanvas','libraryService',`const {session,draftOwner,graphToolsOpen,chatCollapsed,mobilePane,graphAnnotationReturn,annotationSubmitting,prompt,references,parameters,director,directorAccepted,confirmation,notice,error}=state;const updateAnnotation=value=>{state.current=value},setSkill=value=>state.skill=value,patchParameters=value=>state.patch=value,setText=value=>state.text=value,nextTick=async()=>{};const composerRef={value:{focusInput:async()=>state.focus++}},canvasRef={value:{isDirty:()=>state.hasEdits}};${transfer};return {useGraphAnnotation,graphToolsCloseAutoFocus}`)(state,async()=>{state.reads++;if(outcome==='stale')state.session.value.id='other';return outcome==='failed'?undefined:artifact},{saveResult:async()=>({versions:[{id:'original-version'}]}),previewUrl:value=>value})
    await run.useGraphAnnotation(value);assert.equal(state.reads,1);assert.equal(state.annotationSubmitting.value,false)
    if(outcome==='saved'){
      assert.equal(state.graphToolsOpen.value,false);assert.equal(state.current,null);assert.equal(state.mobilePane.value,'chat');assert.equal(state.chatCollapsed.value,false)
      assert.deepEqual(state.references.value.map(ref=>ref.version_id),['other','saved-version']);assert.equal(state.confirmation.value,null);assert.equal(state.patch.extra.creation_run_id,undefined);assert.equal(state.patch.extra.keep,'value');assert.equal(state.skill,'edit')
      let prevented=0;run.graphToolsCloseAutoFocus({preventDefault:()=>prevented++});await Promise.resolve();await Promise.resolve();assert.equal(prevented,1);assert.equal(state.focus,1)
      run.graphToolsCloseAutoFocus({preventDefault:()=>prevented++});assert.equal(prevented,1)
    }else{assert.equal(state.graphToolsOpen.value,true);assert.equal(state.current,value);assert.equal(state.focus,0);assert.equal(state.references.value.length,2)}
  }
})

test('批注交接先提交未结束文字/笔画，仅输出真实像素和固定来源快照',async()=>{
  const file=new Blob(['real pixels']),calls=[]
  const state={working:{value:false},props:{saveBusy:false,annotationHandoff:true},drawing:{value:true},dirty:{value:true},canvas:{toBlob:callback=>callback(file)}}
  const value={file,source:{kind:'image',id:'original'},operations:[{type:'draw'}],requestId:'stable'}
  const run=new Function('state','calls','value',`const {working,props,drawing,dirty,canvas}=state;const commitText=async()=>calls.push('text'),pointerUp=async()=>calls.push('stroke'),publishAnnotation=(blob,surface)=>{if(blob!==value.file||surface!==canvas)throw Error('错误像素');return value},emit=(name,payload)=>calls.push([name,payload]);${prepare};return useAnnotation`)(state,calls,value)
  await run();assert.deepEqual(calls,['text','stroke',['useAnnotation',value]])
  calls.length=0;state.props.annotationHandoff=false;await run();assert.deepEqual(calls,[])
})
