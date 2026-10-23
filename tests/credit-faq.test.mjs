import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript'),mod={exports:{}}
const groupsSource=readFileSync('features/support/creditReferenceGroups.ts','utf8')
new Function('module','exports',ts.transpileModule(groupsSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports)
const {creditReferenceGroups,formatReferenceCredits}=mod.exports

test('FAQ跨组分界线完整，标题和账户按钮独立垂直居中',()=>{
  const faq=readFileSync('features/support/components/CreationFaqDialog.vue','utf8')
  const css=readFileSync('assets/css/main.css','utf8'),account=readFileSync('assets/css/creation.css','utf8')
  assert.equal((faq.match(/item:'liv-faq-item'/g)||[]).length,2)
  assert.doesNotMatch(faq,/space-y-5 liv-faq-copy/)
  assert.match(css,/\.liv-faq-item\{border-bottom:1px solid var\(--liv-faq-border\)!important/)
  assert.match(css,/\.liv-faq-question\{display:flex!important;align-items:center!important/)
  assert.match(account,/\.liv-account-dropdown \.liv-account-menu-item\{display:flex!important;align-items:center!important/)
  assert.match(account,/\.liv-account-purchase\{display:inline-flex!important;align-items:center!important;justify-content:center!important/)
})

test('参考积分只显示向上取整整数，显示换算不回写原始参考价',()=>{
  for(const [value,expected] of [['12.5','13'],['12','12'],['0.2','1'],['1.4E+2','140'],['4E+1','40'],['0','—'],['NaN','—'],['Infinity','—'],['-1','—'],['','—']])assert.equal(formatReferenceCredits(value),expected)
  const reference={credits:'12.5',unit:'second',note:'示例'}
  formatReferenceCredits(reference.credits)
  assert.equal(reference.credits,'12.5')
  const faq=readFileSync('features/support/components/CreationFaqDialog.vue','utf8')
  assert.match(faq,/formatReferenceCredits\(row.reference.credits\)/)
  assert.match(faq,/不按表中取整单价直接相乘/)
})

test('FAQ默认高度固定，标题不收缩，长表格只在正文内滚动',()=>{
  const css=readFileSync('assets/css/main.css','utf8')
  assert.match(css,/--liv-faq-height: 780px/)
  assert.match(css,/height:min\(var\(--liv-faq-height\),calc\(100dvh - 64px\)\)!important/)
  assert.match(css,/\.liv-faq-dialog \.liv-settings-header\{flex:0 0 auto\}/)
  assert.match(css,/\.liv-faq-dialog \.liv-settings-body\{flex:1 1 0%;min-height:0;overflow:auto;overscroll-behavior:contain/)
  assert.match(css,/height:min\(var\(--liv-faq-height\),calc\(100dvh - 32px\)\)!important/)
})

test('模型选择不展示价格，FAQ从接口读取逐档积分且错误可重试',()=>{
  const composer=readFileSync('features/creation/components/CreationComposer.vue','utf8')
  assert.doesNotMatch(composer,/<small v-if="item.reference_pricing"/)
  const faq=readFileSync('features/support/components/CreationFaqDialog.vue','utf8')
  assert.match(faq,/\/creation\/credit-reference/)
  assert.match(faq,/暂未提供参考价/)
  assert.match(faq,/重新读取/)
  assert.match(faq,/current===sequence&&props.open/)
  assert.match(faq,/<LivDialog[^>]*settings dark/)
})

test('积分悬停复用个人菜单边界并保留常见问题入口',()=>{
  const source=readFileSync('pages/dashboard.vue','utf8')
  const credit=source.slice(source.indexOf('aria-label="打开积分账户"'),source.indexOf('aria-label="打开积分账户"')+350)
  assert.match(credit,/@pointerenter=.*hoverUserMenu/)
  assert.match(source,/hoverMenuBoundary\('\.dashboard-user-trigger,\.dashboard-credit-pill,\.liv-account-dropdown'/)
  assert.match(source,/label:'常见问题'/)
  assert.match(source,/const \{open:isFaqOpen\} = useCreationFaq\(\)/)
  assert.match(readFileSync('app.vue','utf8'),/<CreationFaqDialog v-model:open="faqOpen"/)
})

test('账户菜单只上下居中，标签从图标旁左对齐，购买按钮独立居中',()=>{
  const css=readFileSync('assets/css/creation.css','utf8')
  const item=css.match(/\.liv-account-dropdown \.liv-account-menu-item\{([^}]+)\}/)[1]
  assert.match(item,/align-items:center!important/)
  assert.match(item,/justify-content:flex-start!important/)
  assert.match(item,/text-align:left!important/)
  assert.match(css,/\.liv-account-dropdown \[data-slot=itemWrapper\]\{[^}]*flex-direction:row!important/)
  assert.match(css,/\.liv-account-dropdown \[data-slot=itemLabel\]\{text-align:left!important/)
  assert.match(css,/\.liv-account-purchase\{[^}]*justify-content:center!important/)
})

test('参考表按图片视频音乐分组，同模型非相邻行仍正确合并且不合并不同编码',()=>{
  const row=(type,code,model,spec)=>({type,code,model,spec,reference:null})
  const groups=creditReferenceGroups([row('video','v','视频A','720P'),row('image','a','图片A','1K'),row('image','b','图片A','2K'),row('image','a','图片A','4K'),row('music','suno','音乐','生成歌曲')])
  assert.deepEqual(groups.map(g=>g.label),['图片','视频','音乐'])
  assert.equal(groups[0].count,3)
  assert.deepEqual(groups[0].models.map(m=>m.rows.length),[2,1])
  assert.equal(groups[2].models[0].rows[0].spec,'生成歌曲')
  assert.equal(creditReferenceGroups([]).length,3)
})

test('充值与个人菜单共用单一FAQ宿主，宽版白字和表格网格有独立规格',()=>{
  const billing=readFileSync('features/billing/components/BillingAccountDialog.vue','utf8')
  assert.match(billing,/useCreationFaq\(\)/);assert.match(billing,/@click="faqOpen=true">常见问题/)
  assert.doesNotMatch(billing,/<CreationFaqDialog/)
  const faq=readFileSync('features/support/components/CreationFaqDialog.vue','utf8')
  assert.match(faq,/settings dark reference width="xl"/)
  assert.match(faq,/:rowspan="model.rows.length"/);assert.match(faq,/:rowspan="group.count"/)
  assert.match(billing,/<template #actions><UButton class="liv-recharge-help"/)
  assert.match(faq,/const tableExpanded=ref<string\|undefined>\(\)/)
  assert.match(faq,/:unmount-on-hide="false"/)
  assert.doesNotMatch(faq,/<small>\{\{row.reference.note\}\}<\/small>/)
  const css=readFileSync('assets/css/main.css','utf8')
  assert.match(css,/--liv-faq-width: 1040px/)
  assert.match(css,/\.liv-faq-table th,\.liv-faq-table td\{border:1px solid var\(--liv-faq-border\)/)
  assert.match(css,/\.liv-faq-question,\.liv-faq-answer\{color:var\(--liv-settings-text\)!important/)
})
