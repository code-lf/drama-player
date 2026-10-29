// 尺寸／定位规则回归；不把隔离几何计算当作真实浏览器视觉验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('资产入口与实际卡片共用网格行高，音色横向列表不受影响',()=>{
 const asset=read('features/library/components/AssetLibraryPanel.vue')
 assert.ok(asset.includes('.asset-list:not(.voices){align-items:stretch}'))
 assert.match(asset,/\.asset-list:not\(\.voices\)>\.upload-card\{aspect-ratio:auto;align-self:stretch/)
 assert.ok(asset.includes('>.asset-card>img{display:block;flex-shrink:0}'))
})
test('技能菜单加宽20像素，四行高度固定且列表内滚动',()=>{
 const tokens=read('assets/css/tokens.css'),composer=read('features/creation/components/CreationComposer.vue')
 assert.ok(tokens.includes('--liv-skill-menu-width: 480px'))
 assert.ok(tokens.includes('--liv-skill-menu-list-height: 268px'))
 assert.ok(tokens.includes('--liv-skill-menu-height: 422px'))
 assert.ok(tokens.includes('--liv-skill-menu-radius: 19px'))
 assert.ok(composer.includes('border-radius:var(--liv-skill-menu-radius);overflow:hidden!important'))
 assert.ok(tokens.includes('--liv-skill-card-selected: #1c1c1c'))
 assert.ok(tokens.includes('--liv-skill-category-selected: #272727'))
 const css=read('assets/css/creation.css')
 assert.ok(css.includes('.creation-skill-card.active{background:var(--liv-skill-card-selected)}'))
 assert.ok(css.includes('.creation-filter.creation-skill-categories>button.active{background:var(--liv-skill-category-selected)}'))
 assert.equal(4*64+3*4,268)
 assert.ok(composer.includes('grid-template-rows:28px 28px minmax(0,1fr) 40px'))
  assert.ok(composer.includes('avoidCollisions:true'))
 assert.ok(composer.includes('scrollbar-gutter:stable'))
 assert.ok(composer.includes(':aria-pressed="!skill || skill===\'free\'"'))
 assert.ok(composer.includes('v-if="!skill || skill===\'free\'" name="i-lucide-check"'))
 assert.ok(composer.includes(':aria-pressed="item.id===skill"'))
 assert.ok(!composer.includes("watch(skillScope,lockSkillPlacement"))
})
test('技能打开时按固定四行高度选方向，短列表不能触发翻转',()=>{
 const composer=read('features/creation/components/CreationComposer.vue')
 const body=composer.match(/function lockSkillPlacement\(\)\{([\s\S]*?)\n\}/)?.[1]
 assert.ok(body)
 function place(top,bottom,screen){
  const side={value:'top'},height={value:422}
  new Function('popoverAnchor','skillPopoverSide','skillPopoverHeight','window','document','getComputedStyle',body)(
   {value:{getBoundingClientRect:()=>({top,bottom})}},side,height,{innerHeight:screen},{documentElement:{}},()=>({getPropertyValue:()=> '422px'}))
  return {side:side.value,height:height.value}
 }
 assert.deepEqual(place(700,732,900),{side:'top',height:422})
 assert.deepEqual(place(200,232,900),{side:'bottom',height:422})
 assert.deepEqual(place(250,282,500),{side:'top',height:230})
})
test('创作弹层、对话和黑色画布分层，分类箭头与标签居中并有渐隐',()=>{
 const tokens=read('assets/css/tokens.css'),css=read('assets/css/creation.css')
 const canvas=read('assets/css/creative-canvas.css'),composer=read('features/creation/components/CreationComposer.vue')
 assert.match(tokens,/--liv-workspace-surface:\s*#151515/)
 assert.match(tokens,/--liv-graph-background:\s*#000000/)
 assert.ok(canvas.includes('background-color:var(--liv-graph-background)'))
 assert.ok(css.includes('.creation-popover{background:var(--liv-workspace-surface)!important}'))
 assert.match(css,/\.creation-skill-category-control\{[^}]*align-items:center;[^}]*height:28px;margin:0/)
 assert.ok(css.includes('.creation-skill-category-control.has-right::after'))
 assert.ok(css.includes('linear-gradient(to left,var(--liv-workspace-surface)'))
 assert.ok(composer.includes('.creation-skill-categories button{display:flex;align-items:center;height:28px'))
})
test('案例预览有144像素上限，图片不以原始高度撑开容器',()=>{
 const css=read('assets/css/creation.css')
 assert.ok(css.includes('.creation-cases .creation-case-cover{max-height:var(--liv-case-cover-max-height)'))
 assert.ok(css.includes('.creation-cases .creation-case-cover>img{position:absolute;inset:0'))
})
