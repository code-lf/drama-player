// 执行真实目录过滤，验证跨入口不复制技能身份，旧目录与历史入口兼容。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const load=path=>{const exports={};new Function('exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);return exports}
const catalog=load('features/creation/catalog.ts'),home=load('features/creation/homeShowcase.ts')
test('五个顶部用途入口与独立默认草稿键',()=>{
  assert.deepEqual(catalog.visibleCreationEntries.map(r=>r.label),['自由创作','短剧','电商','广告','音乐·MV'])
  assert.equal(catalog.defaultSkills.marketing,'');assert.equal(catalog.defaultSkills.commerce,'')
  assert.deepEqual(home.entryShowcaseCategories.commerce.map(r=>r.label),['推荐','主图与详情','商品展示','内容种草','口播带货'])
  assert.deepEqual(home.entryShowcaseCategories.marketing.map(r=>r.label),['推荐','品牌广告','信息流广告','达人营销','节日促销'])
})
test('跨入口多分类保留同一对象身份，下架与私人技能不混入首页',()=>{
  const shared={id:'shared',entries:['commerce','marketing'],recommended_entries:['commerce','marketing'],home_showcase:{category:'presenter',entry_categories:{commerce:['presenter','discovery'],marketing:['creator']}}}
  const rows=[shared,{...shared,id:'private',kind:'user'},{...shared,id:'off',is_active:false}]
  assert.deepEqual(home.showcaseSkills(rows,'commerce'),[shared]);assert.deepEqual(home.showcaseSkills(rows,'marketing'),[shared])
  assert.equal(home.showcaseSkills(rows,'marketing')[0],home.showcaseSkills(rows,'commerce')[0])
  assert.deepEqual(home.skillEntryCategories(shared,'commerce'),['presenter','discovery'])
})
test('保留旧commerce许可但无电商展示关联的广告不会出现在电商卡片与快捷区',()=>{
  const ad={id:'ad',entries:['commerce','marketing'],recommended_entries:['marketing'],home_showcase:{category:'advertising',entry_categories:{marketing:['brand','feed']}}}
  assert.equal(home.showcaseSkills([ad],'commerce').length,0)
  assert.equal(home.showcaseSkills([ad],'marketing').length,1)
  assert.equal(home.quickRecommendedSkills([ad],'commerce').length,0)
})
test('未迁移旧版本按旧commerce展示，不能擅自开放marketing',()=>{
  const row={id:'old',entries:['commerce'],home_showcase:{category:'advertising'}}
  assert.deepEqual(home.skillEntryCategories(row,'commerce'),['discovery'])
  assert.equal(home.showcaseSkills([row],'marketing').length,0)
  assert.deepEqual(home.skillEntryCategories({...row,home_showcase:{...row.home_showcase,entry_categories:{}}},'commerce'),[])
})
