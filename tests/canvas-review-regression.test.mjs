// 执行本轮审查涉及的真实setup片段和菜单方法，不采购媒体，也不把内存测试冒充浏览器验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as vue from 'vue'
import ts from 'typescript'
const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

// 执行真实选择/打开方法，模拟画布定位会再次发出选中事件，防止旧图片恢复时无限递归。
test('已完成图片打开工具只同步选择，完成卡显式点击仍定位一次',async()=>{
  const item={key:'image:old:result',messageId:'message',versionKey:'result'}
  const node={id:'task:image:old',data:{kind:'image',url:'/existing.png',resultKey:item.key,source:{kind:'image',id:'old',result_id:'result'}}}
  const env={busy:vue.ref(false),session:vue.ref({id:'session'}),draftOwner:vue.ref('owner'),canvasRef:vue.ref(null),
    allResults:vue.ref([item]),graphResults:vue.ref([item]),messages:vue.ref([]),selectedResultKey:vue.ref(item.key),
    videoWorkbench:vue.ref(null),entry:vue.ref('free'),graphToolNode:vue.ref(null),graphToolsOpen:vue.ref(false),
    agentCanvasRef:vue.ref(null),resultCanvasNodeId:()=>node.id,nextTick:vue.nextTick,focusCalls:0}
  const open=studio.slice(studio.indexOf('async function openGraphTools('),studio.indexOf('/** 普通画布工具使用节点子任务输入'))
  const select=studio.slice(studio.indexOf('async function chooseSessionResult('),studio.indexOf('const canvasVersions='))
  const api=new Function('env',`const {${Object.keys(env).join(',')}}=env;let graphToolsEpoch=0;${compile(open+select)};return {openGraphTools,chooseSessionResult}`)(env)
  env.agentCanvasRef.value={focus:async()=>{assert.ok(++env.focusCalls<=2,'工具同步不得递归定位');await api.openGraphTools(node);return true}}
  await api.openGraphTools(node)
  assert.equal(env.focusCalls,0)
  assert.equal(env.graphToolsOpen.value,true)
  assert.equal(env.graphToolNode.value.id,node.id)
  await api.chooseSessionResult(item.key)
  assert.equal(env.focusCalls,1)
})

test('遮挡监听等setup完成再读取后置结果computed，卸载后不重新创建观察器',async()=>{
  const snippet=compile(studio.slice(studio.indexOf('let canvasObstructionObserver:'),studio.indexOf('const imagePlanEditorRef=')))
  const env={mounted:[],unmount:[],listeners:[],observed:0}
  const instance=new Function('vue','env',`
    const {ref,computed,watch,nextTick}=vue;
    const onMounted=fn=>env.mounted.push(fn),onBeforeUnmount=fn=>env.unmount.push(fn);
    const window={addEventListener:name=>env.listeners.push(name),removeEventListener:name=>env.listeners.splice(env.listeners.indexOf(name),1)};
    class ResizeObserver{constructor(){env.observed++}observe(){}disconnect(){}}
    const workspaceElement=ref(null),floatingChat=ref(false),chatCollapsed=ref(false),miniChatWindow=ref({}),graphToolsOpen=ref(false),canvasObstructions=ref([]);
    const compositionSources=computed(()=>allResults.value);
    ${snippet}
    const allResults=ref([]);
    return {allResults,canvasObstructions};
  `)(vue,env)
  assert.equal(env.observed,0)
  env.mounted.forEach(fn=>fn())
  await vue.nextTick();await vue.nextTick()
  assert.equal(env.observed,1)
  instance.allResults.value=[{id:'completed'}]
  env.unmount.forEach(fn=>fn())
  await vue.nextTick();await vue.nextTick()
  assert.equal(env.observed,1)
  assert.deepEqual(env.listeners,[])
})

function menuFixture(confirmLeave=async()=>true){
  const current={key:'image-a',kind:'image',source:{kind:'artifact',id:'a'},parentUrl:'/parent.png'}
  const calls=[],state={version:vue.ref(current),annotating:vue.ref(true),working:vue.ref(false),compare:vue.ref(false),dirty:vue.ref(true),canRedo:vue.ref(false),props:{saveBusy:false,canFavorite:false,annotationHandoff:true}}
  const methods={computed:vue.computed,confirmLeave,emit:(...v)=>calls.push(v),add:v=>calls.push(['add',v]),undoEdit:v=>calls.push(['undo',v]),toggleCompare:()=>calls.push(['compare']),toggleFullscreen:()=>calls.push(['fullscreen']),annotationTool:v=>calls.push(['annotation',v]),useAnnotation:()=>calls.push(['use'])}
  const snippet=compile(canvas.slice(canvas.indexOf('async function ai('),canvas.indexOf('</script>')))
  const env={...state,...methods}
  const api=new Function('env',`const {${Object.keys(env).join(',')}}=env;${snippet};return {ai,nodeImageTools,annotationMoreItems}`)(env)
  return{...state,...api,calls}
}
test('更多菜单保留真实背景风格视频及旋转子菜单，打开和陈旧菜单都不执行',async()=>{
  const f=menuFixture(),items=f.nodeImageTools.value.flat()
  assert.deepEqual(f.calls,[])
  for(const label of ['调整背景','调整风格','转为视频','前后对比','撤销修改','重做修改','全屏查看'])assert.ok(items.some(v=>v.label===label))
  const rotate=items.find(v=>v.label==='旋转')
  const annotation=f.annotationMoreItems.value.flat()
  assert.equal(rotate.children.length,3)
  assert.equal(rotate.content.collisionPadding,12)
  await rotate.children[1].onSelect();assert.deepEqual(f.calls,[['add',{type:'rotate',degrees:180}]])
  f.calls.length=0
  f.version.value={key:'image-b',kind:'image',source:{kind:'artifact',id:'b'}}
  await items[0].onSelect();await rotate.children[0].onSelect()
  await annotation[0].onSelect()
  assert.deepEqual(f.calls,[])
  f.working.value=true;assert.ok(f.nodeImageTools.value[0].every(v=>v.disabled))
})
test('等待工具离开确认时切换作品，不把旧动作交给新节点',async()=>{
  let resolve
  const f=menuFixture(()=>new Promise(done=>{resolve=done}))
  const pending=f.ai('background')
  f.version.value={key:'image-b',kind:'image',source:{kind:'artifact',id:'b'}}
  resolve(true);await pending;assert.deepEqual(f.calls,[])
  const g=menuFixture();await g.ai('edit');assert.deepEqual(g.calls,[['ai','edit',{kind:'artifact',id:'a'}]])
})
