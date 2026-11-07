// 真实事件方法回归：平移不改作品，拖动与右键菜单分别处理。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
function harness(){
 const code=source.slice(source.indexOf('let rightPan:'),source.indexOf('async function contextTools'))
 const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const views=[],saved=[],flow={viewport:{value:{x:10,y:20,zoom:1}},setViewport:v=>{views.push(v);flow.viewport.value=v}}
 const methods=new Function('flow','viewportEnd','contextNodeId','contextPoint','canvasElement','creativeCanvasPoint',`${js};return {startRightPan,moveRightPan,endRightPan,prepareContextMenu}`)(flow,v=>saved.push(v),{value:''},{value:null},{value:null},()=>null)
 return {...methods,views,saved}
}
const pointer=(x,y)=>({button:2,clientX:x,clientY:y,pointerId:1,target:{closest:()=>null},currentTarget:{setPointerCapture:()=>{}},stopPropagation:()=>{}})

test('窗口外松手及失焦会释放拖动，仍按住鼠标时不打断拖动',()=>{
 const method=source.match(/function releaseCanvasDrag\(event\?:MouseEvent\)\{[\s\S]*?\n\}/)?.[0]
 assert.ok(method)
 const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const active={value:true},nodes=[{dragging:true}],events=[]
 const run=new Function('nodeDragActive','flow','window','MouseEvent','endGroupDrag','endRightPan',`${code};return releaseCanvasDrag`)(active,{getNodes:{value:nodes}},{dispatchEvent:e=>events.push(e)},class {constructor(type){this.type=type}},()=>{},()=>{})
 run({buttons:1});assert.equal(active.value,true);assert.equal(events.length,0)
 run({buttons:0});assert.equal(active.value,false);assert.equal(nodes[0].dragging,false);assert.equal(events.length,1)
 active.value=true;run({type:'blur'});assert.equal(active.value,false);assert.equal(events.length,2)
})
test('按住右键拖动只平移，结束保存镜头且屏蔽这次菜单',()=>{
 const h=harness();h.startRightPan(pointer(100,100));h.moveRightPan(pointer(150,125));h.endRightPan()
 assert.deepEqual(h.views,[{x:60,y:45,zoom:1}]);assert.equal(h.saved.length,1)
 let blocked=0;h.prepareContextMenu({preventDefault:()=>blocked++,stopPropagation:()=>blocked++})
 assert.equal(blocked,2)
})
test('普通右键不移动，菜单保留；输入控件不启动拖动',()=>{
 const h=harness();h.startRightPan(pointer(100,100));h.endRightPan()
 h.prepareContextMenu({target:{closest:()=>null},preventDefault:()=>assert.fail('不得拦截单击菜单')})
 assert.equal(h.views.length,0);assert.equal(h.saved.length,0)
 h.startRightPan({...pointer(1,1),target:{closest:()=>({})}});h.moveRightPan(pointer(20,20));assert.equal(h.views.length,0)
 assert.match(source,/:zoom-on-scroll="false".*zoom-activation-key-code="Control".*:pan-on-scroll="true" pan-on-scroll-mode="vertical"/)
 assert.match(source,/<LivButton settings block variant="danger" @click="removeNode">删除节点/)
})
