// 光流节奏与方向测试不启动模型/Worker，不将装饰动画当作任务状态。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/canvasEdgeMotion.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {creativeEdgeMotion,creativeEdgeBeam,CREATIVE_EDGE_TAIL_LENGTH}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('同一引用刷新相位稳定，不同引用错开；长短线节奏有界且真实活动更快',()=>{
  assert.deepEqual(creativeEdgeMotion('edge-a',0,0,600,100),creativeEdgeMotion('edge-a',0,0,600,100))
  assert.notEqual(creativeEdgeMotion('edge-a',0,0,600,100)['--creative-flow-delay'],creativeEdgeMotion('edge-b',0,0,600,100)['--creative-flow-delay'])
  for(const distance of [0,10,400,100000,NaN,Infinity]){
    const idle=parseFloat(creativeEdgeMotion('edge',0,0,distance,0)['--creative-flow-duration'])
    const active=parseFloat(creativeEdgeMotion('edge',0,0,distance,0,true)['--creative-flow-duration'])
    assert.ok(idle>=1.19&&idle<=2.62);assert.ok(active>=.59&&active<=1.5);assert.ok(active<idle)
  }
})

test('沿相同真实路径的光尾与亮点不拦截点击，减少动画时整体隐藏',()=>{
  const component=readFileSync('features/creation/components/CreativeCanvasEdge.vue','utf8')
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.equal((component.match(/class="creative-edge-comet"/g)||[]).length,1)
  assert.ok(component.includes(':d="path[0]" pathLength="1"'))
  assert.ok(component.includes('aria-hidden="true" pointer-events="none"'))
  assert.ok(!component.includes('v-if="data?.active" :d='))
  assert.ok(component.includes('attributeName="stroke-dasharray" :values="beam.dashValues"'))
  assert.ok(component.includes('stop-opacity="0"')&&component.includes('stop-opacity="1"'))
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce){.creative-edge-flow{display:none}'))
})

test('白色长尾为原3.5倍，始终只有一个连续区间，入场与离场不产生首尾两束',()=>{
  assert.equal(CREATIVE_EDGE_TAIL_LENGTH,88*3.5)
  const beam=creativeEdgeBeam(100,200,1100,700)
  for(const values of beam.dashValues.split(';')){
    const [first,gap,visible,rest]=values.split(' ').map(Number)
    assert.equal(first,0);assert.ok(visible<=.308)
    assert.ok(Math.abs(gap+visible+rest-1)<1e-9)
  }
  assert.deepEqual(beam.coordinates[0],{attribute:'x1',values:'100;100;792;1100'})
  assert.deepEqual(beam.coordinates[2],{attribute:'x2',values:'100;408;1100;1100'})
})
