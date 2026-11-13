import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import * as vue from 'vue'
import ts from 'typescript'
const workspace=readFileSync(new URL('../features/creation/components/CreationEditingWorkspace.vue',import.meta.url),'utf8')
const assistant=readFileSync(new URL('../features/editing/components/EditingAssistantPanel.vue',import.meta.url),'utf8')
const frame=readFileSync(new URL('../features/editing/native-frame-document.mjs',import.meta.url),'utf8')
const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
const panel=readFileSync(new URL('../features/creation/components/CreationConversationPanel.vue',import.meta.url),'utf8')
const nativeFrame=readFileSync(new URL('../features/editing/components/FableCutNativeFrame.vue',import.meta.url),'utf8')

test('共享面板挂载原卡片插槽，转交真实滚动事件并在卸载释放DOM引用',async()=>{
  // 挂载真实Vue组件而非复制模板；无HTTP或任务替身，也不生成聊天成功状态。
  const {descriptor}=parse(panel)
  const source=compileScript(descriptor,{id:'conversation-test',inlineTemplate:true}).content
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(name=>{assert.equal(name,'vue');return vue},module,module.exports)
  const node=(type,text='')=>({type,text,props:{},children:[],parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('text',text),createComment:()=>node('comment'),
    setText:(el,text)=>el.text=text,setElementText:(el,text)=>el.text=text,patchProp:(el,key,old,value)=>el.props[key]=value,
    insert:(el,parent)=>{el.parent=parent;parent.children.push(el)},remove:el=>{el.parent.children=el.parent.children.filter(row=>row!==el)},
    parentNode:el=>el.parent,nextSibling:()=>null})
  let history,content,seen
  const app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{
    historyElement:el=>history=el,contentElement:el=>content=el,onScroll:event=>seen=event
  },{heading:()=>vue.h('span','原助手'),default:()=>vue.h('div',{'data-card':'existing'},'已有问答卡'),composer:()=>vue.h('button','原输入框')})})
  const root=node('root');app.mount(root);await vue.nextTick()
  assert.ok(history);assert.ok(content)
  const findCard=el=>el.props['data-card']==='existing'||el.children.some(findCard)
  assert.ok(findCard(content))
  const event={target:history};history.props.onScrollPassive(event);assert.equal(seen,event)
  app.unmount();await vue.nextTick();assert.equal(history,null);assert.equal(content,null)
})

test('正式外壳与共享助手模板真实编译，不只匹配字符串',()=>{
  // 上次内联if事件只靠文本断言未能发现；按Vue真实编译器阻止相同回归。
  for(const [filename,source] of [['workspace.vue',workspace],['assistant.vue',assistant],['panel.vue',panel],['native.vue',nativeFrame]]){
    const {descriptor,errors}=parse(source,{filename})
    assert.deepEqual(errors,[])
    const script=compileScript(descriptor,{id:filename})
    const template=compileTemplate({source:descriptor.template.content,filename,id:filename,
      compilerOptions:{bindingMetadata:script.bindings}})
    assert.deepEqual(template.errors,[])
  }
  // 大画布依赖Nuxt类型解析；这里只编译其完整模板，确保搬动slot不破坏原卡片结构。
  const {descriptor}=parse(studio,{filename:'studio.vue'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'studio.vue',id:'studio'}).errors,[])
})
test('剪辑助手复用画布输入与回复，不维护第二个textarea或媒体采购入口',()=>{
  assert.match(assistant,/CreationComposer/);assert.match(assistant,/AssistantReply/)
  assert.doesNotMatch(assistant,/<UTextarea|<textarea/)
  assert.match(assistant,/send-disabled-reason=/)
  assert.match(workspace,/<EditingAssistantPanel/)
  assert.match(workspace,/<EditingAssistantPanel v-show="agentOpen"/)
  assert.match(assistant,/<CreationConversationPanel>/)
  assert.match(studio,/<CreationConversationPanel :active="active"/)
  assert.match(studio,/CreationProcessEvents/)
  assert.match(studio,/CreationAnsweredQuestionCard/)
  assert.match(panel,/props.historyElement\?\.\(element\)/)
})
test('四区按最新400/400/340规格且参数不挤占左侧对话',()=>{
  assert.match(workspace,/--editor-agent-width:400px/)
  assert.match(workspace,/--editor-assets-width:400px/)
  assert.match(workspace,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
  assert.match(frame,/height:340px!important/)
  assert.match(workspace,/assetTab==='details'/)
  assert.match(frame,/await grabThumb\(m\);\s*if\(applyEpoch!==livApplyEpoch\)return;\s*if\(livDragging\|\|livPending\|\|livTimer\)/)
  assert.match(nativeFrame,/watch\(\(\) => props.media, sendMedia\)/)
  // 素材面板不能盖住控制条，否则总时长和右侧缩放控件会不可操作。
  assert.match(workspace,/margin-bottom:calc\(var\(--editor-timeline-height\) \+ 64px\)/)
  assert.match(frame,/livOriginalPlay=play/)
  assert.doesNotMatch(assistant,/Liv 剪辑助手<\/strong>/)
})

test('冲突、旁白和窄屏入口使用现有保存边界，不自动重放或直接采购',()=>{
  const logic=readFileSync(new URL('../features/editing/useEditingWorkspace.ts',import.meta.url),'utf8')
  assert.match(workspace,/if\(await confirm\([\s\S]*?await w\.reloadConflict\(\)/)
  assert.match(logic,/controller\.queue\.reloadConfirmed\(fresh\.draft\)/)
  assert.match(workspace,/@click="chooseAudio\('narration'\)"/)
  assert.match(workspace,/@click="moveClip\(-1\)"/)
  assert.match(workspace,/@apply="trimNarration"/)
  assert.match(workspace,/@decode="w\.markDecode"/)
  assert.match(frame,/livSend\('media_decode_failed',\{clip_id:m\.id\}\)/)
  assert.match(logic,/mediaIssues\.value=\{\.\.\.mediaIssues\.value,\[clip\.id\]:classifyEditingMediaError\(e\)\}/)
})

test('素材名称不覆盖预览容器的grid布局，Nuxt类型图标统一36px',()=>{
  // UIcon和预览容器均为span，名称选择器必须排除预览，而不是覆盖全部后代。
  const preview=readFileSync(new URL('../features/creation/components/CreationMediaPreview.vue',import.meta.url),'utf8')
  assert.match(preview,/class="liv-media-preview-icon"/)
  assert.match(preview,/display:grid;place-items:center/)
  assert.match(workspace,/button:first-child>span:not\(\.liv-media-preview\)/)
  assert.match(workspace,/\.liv-media-preview-icon\)\{width:36px;height:36px/)
  assert.doesNotMatch(workspace,/\.editing-assets span\s*\{/)
})
