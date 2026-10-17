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
 assert.equal(4*64+3*4,268)
 assert.ok(composer.includes('grid-template-rows:28px 28px minmax(0,1fr) 40px'))
 assert.ok(composer.includes("avoidCollisions:popover!=='skill'"))
 assert.ok(composer.includes('scrollbar-gutter:stable'))
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
test('案例预览有144像素上限，图片不以原始高度撑开容器',()=>{
 const css=read('assets/css/creation.css')
 assert.ok(css.includes('.creation-cases .creation-case-cover{max-height:var(--liv-case-cover-max-height)'))
 assert.ok(css.includes('.creation-cases .creation-case-cover>img{position:absolute;inset:0'))
})
