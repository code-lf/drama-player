/** 选中图片的预览与编辑手势边界；使用实际组件表达式，不伪造业务任务。 */
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed,ref} from 'vue'
const node=readFileSync('features/creation/components/CreativeCanvasNode.vue','utf8')
const editor=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('选中图片的内联宿主不再禁止整块拖动，视频控制仍沿用原隔离',()=>{
  const expression=node.match(/:class="\{'nodrag nopan nowheel':([^}]+)\}"/)?.[1]
  assert.ok(expression)
  const locked=new Function('data',`return ${expression}`)
  assert.equal(locked({kind:'image'}),false)
  assert.equal(locked({kind:'audio'}),false)
  assert.equal(locked({kind:'video'}),true)
  assert.ok(node.includes('@mousedown="protectInlineControls" @touchstart="protectInlineControls"'))
})

test('默认预览把手势交给节点，批注裁剪及内部平移动态锁住节点',()=>{
  const declaration=editor.match(/const ownsImageGesture=computed\([\s\S]*?\)\n/)?.[0]
  assert.ok(declaration)
  const props={inlineNode:true},version=ref({kind:'image'}),annotating=ref(false),tool=ref(''),hand=ref(false),spaceHeld=ref(false)
  const owns=new Function('props','version','annotating','tool','hand','spaceHeld','computed',`${compile(declaration)};return ownsImageGesture`)(props,version,annotating,tool,hand,spaceHeld,computed)
  assert.equal(owns.value,false)
  for(const [state,value] of [[annotating,true],[tool,'crop'],[tool,'pointer'],[hand,true],[spaceHeld,true]]){
    const prior=state.value;state.value=value;assert.equal(owns.value,true);state.value=prior;assert.equal(owns.value,false)
  }
  tool.value='crop';version.value={kind:'audio'};assert.equal(owns.value,false)
  assert.ok(editor.includes("'nodrag nopan':ownsImageGesture"))
})

test('真实控件的鼠标及触屏启动被拦截，普通图片不拦截、不阻止默认行为',()=>{
  const method=node.match(/function protectInlineControls\(event:Event\)\{[\s\S]*?\n\}/)?.[0]
  assert.ok(method)
  const handler=new Function(`${compile(method)};return protectInlineControls`)()
  let stopped=0
  handler({target:{closest:()=>null},stopPropagation:()=>stopped++})
  assert.equal(stopped,0)
  for(const type of ['mousedown','touchstart']){
    handler({type,target:{closest:selector=>{for(const control of ['button','input','video','[role=slider]','.annotation-surface','.crop-overlay'])assert.ok(selector.includes(control));return {}}},stopPropagation:()=>stopped++})
  }
  assert.equal(stopped,2)
})
