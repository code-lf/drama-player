// 使用真实方法和生命周期回调验证竞态；网络只替换为可控Promise，不创建音乐任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript} from 'vue/compiler-sfc'
const source=readFileSync('features/music/components/MusicWorkspacePanel.vue','utf8')
const transpile=value=>ts.transpileModule(value,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
const method=name=>source.match(new RegExp(`async function ${name}\\([^]*?\\n\\}`))?.[0]

test('取消音频报价保留输入并恢复核价按钮焦点，卸载后不抢焦点',async()=>{
  for(const active of [true,false]){
    let focused=0
    const quote={value:{retail_credits:2}},busy={value:false}
    const close=new Function('quote','busy','alive','nextTick','quoteTrigger',`${transpile(method('dismissQuote'))};return dismissQuote`)(quote,busy,active,async()=>{}, {value:{$el:{focus:()=>focused++}}})
    await close();assert.equal(quote.value,null);assert.equal(focused,active?1:0)
    busy.value=true;quote.value={retail_credits:2};await close();assert.ok(quote.value)
  }
})
function fixture(){
  let finish,fail
  const pending=new Promise((resolve,reject)=>{finish=resolve;fail=reject}),calls=[]
  const service={quote:()=>pending,create:()=>pending,tasks:async()=>[]}
  const api=new Function('musicService','calls',`
    let alive=true,inputRevision=0,previewEpoch=0;
    const current={value:{operation:'coverSong'}},busy={value:false},error={value:''},quote={value:null},rightsConfirmed={value:true},requestId={value:'stable'},tasks={value:[]},focusedTaskId={value:''};
    const normalizedInputs=()=>({task_id:'fixed-source'}),message=e=>e.message,emit=(...args)=>calls.push(args);
    ${transpile(method('preview'))}
    ${transpile(method('submit'))}
    return {preview,submit,quote,busy,error,change:()=>inputRevision++,close:()=>{alive=false;previewEpoch++}};
  `)(service,calls)
  return {...api,finish,fail,calls}
}
test('音频核价等待时改规格，迟到报价不能恢复旧确认',async()=>{
  const ui=fixture(),work=ui.preview();ui.change();ui.finish({retail_credits:10});await work
  assert.equal(ui.quote.value,null);assert.equal(ui.busy.value,false)
})
test('音频面板关闭后不回填迟到报价或错误，也不发出创建事件',async()=>{
  for(const failed of [false,true]){
    const ui=fixture(),work=ui.preview();ui.close()
    if(failed)ui.fail(new Error('old'));else ui.finish({retail_credits:10})
    await work;assert.equal(ui.quote.value,null);assert.equal(ui.error.value,'');assert.deepEqual(ui.calls,[])
  }
  const ui=fixture();ui.quote.value={retail_credits:10};const work=ui.submit();ui.close();ui.finish({id:'original-accepted'});await work
  assert.deepEqual(ui.calls,[])
})
test('音频核价成功仍需独立确认，提交使用原稳定请求路径',async()=>{
  const ui=fixture(),work=ui.preview();ui.finish({retail_credits:10});await work
  assert.equal(ui.quote.value.retail_credits,10);assert.deepEqual(ui.calls,[])
  await ui.submit();assert.equal(ui.calls[0][0],'created');assert.equal(ui.quote.value,null)
})
test('关闭发生在初始化目录等待期间，不安装轮询定时器',async()=>{
  const body=source.match(/onMounted\(async \(\) => \{([^]*?)\n\}\)/)?.[1];assert.ok(body)
  let alive=true,resolveCatalog,timers=0
  const pending=new Promise(resolve=>resolveCatalog=resolve)
  const run=new Function('onMounted','musicService','isAlive',transpile(`
    const operations={value:[]},error={value:''},message=String;
    ${`onMounted(async()=>{${body}})`.replaceAll('!alive','!isAlive()')}
  `))
  let work;run(fn=>{work=fn()},{catalog:()=>pending},()=>alive)
  alive=false;resolveCatalog([]);await work
  // 未越过首个alive保护，所以不会执行refreshTasks或创建定时器（未注入即会抛错）。
  assert.equal(timers,0)
})
test('音频工具及费用确认复用统一弹窗，切换会话关闭旧来源',()=>{
  // 检查真实SFC绑定而不只匹配模板标签，防止未导入时确认正文裸露且footer完全丢失。
  const compiled=compileScript(parse(source).descriptor,{id:'music-dialog-binding'})
  assert.equal(compiled.bindings.LivDialog,'setup-const')
  assert.equal(compiled.bindings.LivButton,'setup-const')
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.match(studio,/<LivDialog :open="showMusicTools"[^>]*title="音频工具"/)
  assert.ok(!studio.includes('<div v-if="showMusicTools" class="creation-modal-backdrop"'))
  assert.match(studio,/watch\(\(\)=>\[draftOwner.value,session.value\?\.id\],\(\)=>closeCanvasMusicTools\(\),\{flush:'sync'\}\)/)
  assert.match(source,/<LivDialog v-if="quote"[^>]*settings dark title="确认音乐费用"/)
  assert.ok(source.includes('if (!alive) return'))
  assert.ok(source.includes('alive = false; previewEpoch++'))
  assert.match(source,/<fieldset :disabled="busy"/)
  assert.match(source,/<\/fieldset>\s*<\/template>/)
})

test('音频资料库加载关闭后不继续请求列表或覆盖旧状态',async()=>{
  for(const stopAt of ['capability','list']){
    let alive=true,resolve,calls=0
    const pending=new Promise(done=>resolve=done),state={ready:{value:false},items:{value:['original']}}
    const service={capabilities:()=>stopAt==='capability'?pending:Promise.resolve({enabled:true}),list:()=>{calls++;return pending}}
    const code=transpile(method('refreshAudioLibrary')).replaceAll('!alive','!isAlive()').replaceAll('if (alive)','if (isAlive())')
    const fn=new Function('libraryService','isAlive','libraryReady','audioLibrary',`${code};return refreshAudioLibrary`)(service,()=>alive,state.ready,state.items)
    const work=fn();await Promise.resolve();alive=false
    resolve(stopAt==='capability'?{enabled:true}:{items:['late']});await work
    assert.deepEqual(state.items.value,['original']);assert.equal(calls,stopAt==='list'?1:0)
  }
})
