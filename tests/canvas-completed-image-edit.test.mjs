// 执行套图成品的真实编辑判断和保存方法；只创建本机续作草案，不提交媒体或费用授权。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref} from 'vue'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function eligibility(data,derivable=true){
  const selected=ref({id:'image-plan:run:image-1',position:{x:0,y:0},data})
  const code=source.split('\n').filter(line=>/^const (sourceEditing|canEdit)=/.test(line)).join('\n')
  const state=new Function('selected','computed','canDerive',`${code};return {sourceEditing,canEdit}`)(selected,computed,()=>derivable)
  return {...state,selected}
}
const completed={kind:'image',readonly:true,itemId:'image-1',runId:'run',planTarget:'image',status:'succeeded',url:'/real.png',source:{kind:'image',id:'task',result_id:'result'},title:'商品图',prompt:'原始完整提示词'}

test('已完成且有真实文件的套图进入统一续作输入，未完成/失败/缺文件不能绕过原计划编辑器',()=>{
  const ok=eligibility(completed);assert.equal(ok.sourceEditing.value,true);assert.equal(ok.canEdit.value,true)
  for(const patch of [{status:'failed'},{status:'status_unavailable'},{status:'draft'},{url:''},{source:undefined},{kind:'video',planTarget:'video'}]){
    const state=eligibility({...completed,...patch});assert.equal(state.sourceEditing.value,false);assert.equal(state.canEdit.value,false)
  }
  assert.equal(eligibility(completed,false).canEdit.value,false)
  assert.ok(source.includes('selected.data.runId&&selected.data.itemId&&!sourceEditing'))
  assert.ok(source.includes(':value="editorParameters"'))
})

test('普通媒体续作与手动草案仍可编辑，纯文字结果不被开放为媒体改稿',()=>{
  assert.equal(eligibility({...completed,itemId:undefined,planTarget:undefined}).sourceEditing.value,true)
  assert.equal(eligibility({kind:'video',manual:true,readonly:false,status:'draft'}).canEdit.value,true)
  assert.equal(eligibility({kind:'text',readonly:true,status:'replied'}).canEdit.value,false)
})

test('保存成品提示词只建立相连草案，继承白名单规格，不覆盖原计划/文件/任务或报价',()=>{
  const data=structuredClone(completed),original=structuredClone(data),selected=ref({id:'image-plan:run:image-1',position:{x:80,y:80},data})
  const parameters={model:'gpt-image-2-vip',style:'',styleId:'',aspectRatio:'1:1',durationSec:6,resolution:'1K',quality:'low'}
  const layout=ref({drafts:[],positions:{},edges:[]}),state={conflict:ref(false),canEdit:ref(true),sourceEditing:ref(true),selected,layout,draftPrompt:ref('只将背景换为米色墙面'),draftTitle:ref('商品图'),nodes:ref([selected.value]),editorParameters:ref(parameters),error:ref('')}
  const calls=[],code=compile(source.slice(source.indexOf('function saveText(){'),source.indexOf('/** 先保证草案及引用线已持久化')))
  const save=new Function('state','snapshot','changed','creativeFreePosition',`const {${Object.keys(state).join(',')}}=state;${code};return saveText`)(state,()=>calls.push('snapshot'),()=>calls.push('changed'),position=>position)
  const id=save()
  assert.match(id,/^draft:/);assert.deepEqual(selected.value.data,original)
  assert.deepEqual(layout.value.drafts,[{id,kind:'image',title:'商品图 · 编辑稿',prompt:'只将背景换为米色墙面'}])
  assert.equal(layout.value.edges[0].source,selected.value.id);assert.equal(layout.value.edges[0].target,id)
  assert.deepEqual(layout.value.node_parameters[id],parameters)
  assert.equal(layout.value.overrides,undefined);assert.deepEqual(calls,['snapshot','changed'])
})

test('失败提示浮层保留完整脱敏原因，传送层约束宽度并允许换行而不是超出视口',()=>{
  const notice=readFileSync('features/creation/components/CreationTaskNotice.vue','utf8')
  assert.ok(notice.includes(":ui=\"{content:'liv-task-notice-tooltip',text:'liv-task-notice-reason'}\""))
  assert.match(notice,/:global\(\.liv-task-notice-tooltip\)\{[^}]*max-width:min\(320px,calc\(100vw - 24px\)\);height:auto;white-space:normal;overflow-wrap:anywhere/)
  assert.match(notice,/:global\(\.liv-task-notice-reason\)\{[^}]*white-space:normal;overflow:visible;text-overflow:clip/)
})
