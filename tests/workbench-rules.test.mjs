// 执行纯交互规则；浏览器中的真实光标、焦点和布局另行验证。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/workbenchRules.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {canApplyEntryPreference,activeMention,nextMentionTab}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('默认模式只作用于全新工作台',()=>{assert.equal(canApplyEntryPreference('/dashboard',{},'',0,false),true);for(const key of ['entry','skill','session','run'])assert.equal(canApplyEntryPreference('/dashboard',{[key]:'explicit'},'',0,false),false);assert.equal(canApplyEntryPreference('/dashboard-music',{},'',0,false),false)})
test('文字、素材及剧本草稿优先于账号偏好',()=>{assert.equal(canApplyEntryPreference('/dashboard',{},'草稿',0,false),false);assert.equal(canApplyEntryPreference('/dashboard',{},'',1,false),false);assert.equal(canApplyEntryPreference('/dashboard',{},'',0,true),false)})
test('中文、重复 @ 与光标中间搜索使用当前词',()=>{assert.deepEqual(activeMention('前文 @街头',6),{query:'街头',start:3});assert.deepEqual(activeMention('@旧 @新',5),{query:'新',start:3});assert.equal(activeMention('@街头 后文',7),null);assert.deepEqual(activeMention('@街头 后文',3),{query:'街头',start:0})})
test('空搜索与超长关键词边界',()=>{assert.deepEqual(activeMention('@',1),{query:'',start:0});assert.equal(activeMention('@'+'字'.repeat(121),122),null)})
test('左右分类循环，空列表不产生负下标',()=>{assert.equal(nextMentionTab(0,-1,7),6);assert.equal(nextMentionTab(6,1,7),0);assert.equal(nextMentionTab(0,-1,0),0)})
