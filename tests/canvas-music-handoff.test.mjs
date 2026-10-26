import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed} from 'vue'

// 执行现有工具与固定版本方法；服务夹具只记录来源，不采购音乐或视频。
const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const handoff=compile(studio.slice(studio.indexOf('async function makeMusicMv('),studio.indexOf('async function chooseHistory(')))
const select=compile(studio.slice(studio.indexOf('async function selectMvSong('),studio.indexOf('async function importMvUrl(')))
const button=compile(canvas.slice(canvas.indexOf('const canMakeMv='),canvas.indexOf('// 创作台属于')))

test('分轨不借用原歌曲分享/MV身份；成功成片与处理视频保留真实来源截帧入口',()=>{
  for(const kind of ['video','composition','reference','music']){
    const version={value:{kind:'video',source:{kind,id:'owned',result_id:'specific-result'}}}
    const ui=new Function('computed','version','emit',`${button};return {canMakeMv,canCapture}`)(computed,version,()=>{})
    assert.equal(ui.canMakeMv.value,false);assert.equal(ui.canCapture.value,true)
  }
  const stem={value:{kind:'audio',source:{kind:'music',id:'owned',result_id:'media:["vocal_url"]'}}}
  const ui=new Function('computed','version','emit',`${button};return {canMakeMv,canCapture}`)(computed,stem,()=>{})
  assert.equal(ui.canMakeMv.value,false);assert.equal(ui.canCapture.value,false)
  assert.ok(canvas.includes(':task-id="canMakeMv?version.source.id:undefined"'))
  assert.ok(canvas.includes(':disabled="working||saveBusy||!canCapture"'))
})

test('MV按钮携带当前曲目固定身份，不从节点key解析序号，上传/处理结果不冒充第0首',()=>{
  for(const source of [{kind:'music',id:'b',audio_index:1},{kind:'music',id:'b',audio_index:0},{kind:'music',id:'processed'},{kind:'reference',id:'upload'},{kind:'music',id:'b',audio_index:-1}]){
    const version={value:{kind:'audio',source}},events=[]
    const run=new Function('version','computed','emit',`${button};return {canMakeMv,makeMv}`)(version,computed,(...args)=>events.push(args))
    run.makeMv()
    if(source.kind==='music'&&Number.isInteger(source.audio_index)&&source.audio_index>=0){
      assert.equal(events.length,1);assert.deepEqual(events[0],['music','make-mv',source]);assert.notEqual(events[0][2],source)
    }else assert.equal(events.length,0)
  }
  assert.ok(canvas.includes('@click="makeMv"'));assert.ok(canvas.includes('v-if="canMakeMv"'))
})

function mvFixture(outcome='success'){
  const state={session:{value:{id:'same'}},draftOwner:{value:'owner'},busy:{value:false},mvSourceMode:{value:'link'},mvSource:{value:'old:0'},prompt:{value:'保留的用户草稿'},entry:{value:'marketing'},confirmation:{value:{old:true}},graphToolsOpen:{value:true},graphAnnotationReturn:{value:null},chatCollapsed:{value:true},mobilePane:{value:'canvas'},composerRef:{value:{focusInput:()=>{state.focus++}}},notice:{value:''},calls:[],skill:'old-skill',text:'保留的用户草稿',focus:0}
  const fixture={...state,confirmHomeAction:async()=>{if(outcome==='changed')state.session.value.id='other';return outcome!=='cancel'},selectMvSong:async()=>{state.calls.push(state.mvSource.value);return outcome!=='failure'},setSkill:value=>state.skill=value,setText:value=>state.text=value,nextTick:async()=>{}}
  const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${handoff};return makeMusicMv`)(fixture)
  return {state,fn}
}

test('画布选中B曲目时明确使用B的第2首；成功后回对话，不调用生成/报价',async()=>{
  const {state,fn}=mvFixture();await fn('make-mv',{kind:'music',id:'B',audio_index:1})
  assert.deepEqual(state.calls,['B:1']);assert.equal(state.entry.value,'music');assert.equal(state.skill,'mv-visual');assert.equal(state.mvSourceMode.value,'owned')
  assert.equal(state.confirmation.value,null);assert.equal(state.graphToolsOpen.value,false);assert.equal(state.chatCollapsed.value,false);assert.equal(state.mobilePane.value,'chat')
  assert.deepEqual(state.graphAnnotationReturn.value,{sessionId:'same',owner:'owner'});assert.equal(state.focus,0)
  assert.ok(state.text.includes('MV'));assert.ok(state.notice.value.includes('核价确认'))
})

test('取消覆盖、会话变化和固定版本保存失败都不把旧音频当成成功交接',async()=>{
  for(const outcome of ['cancel','changed','failure']){
    const {state,fn}=mvFixture(outcome);await fn('make-mv',{kind:'music',id:'B',audio_index:1})
    assert.equal(state.calls.length,outcome==='failure'?1:0);assert.equal(state.skill,'old-skill');assert.equal(state.text,'保留的用户草稿')
    assert.equal(state.entry.value,'marketing');assert.equal(state.graphToolsOpen.value,true);assert.deepEqual(state.confirmation.value,{old:true})
  }
  const {state,fn}=mvFixture();await fn('make-mv',{kind:'music',id:'processed'});await fn('make-mv',{kind:'reference',id:'uploaded'});await fn('unsupported',{kind:'music',id:'B',audio_index:1});assert.equal(state.calls.length,0)
})

test('真实歌曲固定版本方法只接受本次来源，迟到请求不回填其他会话或新草稿',async()=>{
  for(const outcome of ['success','session','owner','draft','selection','failure','empty']){
    const state={mvSource:{value:'B:1'},busy:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},sourceTask:{value:{id:'A',result:{music:[{title:'错误旧歌',lyrics:'旧歌词'}]}}},musicTasks:{value:[{id:'B',result:{music:[{}, {title:'B第二首',lyrics:'正确歌词'}]}}]},parameters:{value:{extra:{keep:'yes'}}},references:{value:[{version_id:'old-audio'}]},roundReferences:{value:[{version_id:'old-round'}]},mvPickerOpen:{value:true},error:{value:''},draftText:'未发送',patches:[],calls:[]}
    const service={saveResult:async(...args)=>{
      state.calls.push(args)
      if(outcome==='session')state.session.value.id='other'
      if(outcome==='owner')state.draftOwner.value='other'
      if(outcome==='draft')state.draftText='新输入'
      if(outcome==='selection')state.mvSource.value='C:0'
      if(outcome==='failure')throw new Error('真实保存失败')
      return {id:'fixed-item',name:'固定曲目',versions:outcome==='empty'?[]:[{id:'fixed-B-1',preview_url:'/fixed-audio',media:{duration_sec:12}}]}
    },previewUrl:value=>value}
    state.parameters.value.extra={keep:'yes',creation_run_id:'old',mv_run_id:'old-mv',director_run_id:'old-director'}
    const fixture={...state,libraryService:service,draft:()=>({prompt:state.draftText}),patchParameters:value=>{state.patches.push(value);state.parameters.value={...state.parameters.value,...value}}}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${select};return selectMvSong`)(fixture)
    const result=await fn();assert.deepEqual(state.calls,[['music','B','1','other']]);assert.equal(state.busy.value,false)
    if(outcome==='success'){
      assert.equal(result,true);assert.equal(state.patches[0].sourceTask,'B:1');assert.equal(state.patches[0].extra.mv_lyrics,'正确歌词')
      for(const key of ['creation_run_id','mv_run_id','director_run_id'])assert.equal(state.parameters.value.extra[key],undefined)
      assert.equal(state.references.value[0].version_id,'fixed-B-1');assert.equal(state.references.value[0].name,'B第二首');assert.deepEqual(state.roundReferences.value,[])
      assert.equal(state.mvPickerOpen.value,false)
    }else{
      assert.equal(result,false);assert.equal(state.patches.length,0);assert.deepEqual(state.references.value,[{version_id:'old-audio'}]);assert.equal(state.mvPickerOpen.value,true)
      if(outcome==='session'||outcome==='owner')assert.equal(state.error.value,'')
      else assert.ok(state.error.value)
    }
  }
})
