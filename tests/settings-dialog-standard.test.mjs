// 设置组件只验证真实配置链路与共用样式，禁止扩展虚假水印能力。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
test('水印设置复用组件库，真实读取成功后才保存',()=>{
  const source=read('features/creation/components/WatermarkPreferenceDialog.vue')
  for(const fragment of ['<LivDialog','dark settings','<USwitch','<LivButton settings','for="watermark-switch"','!loaded.value||loading.value||saving.value','skillCenterService.saveWatermark'])assert.ok(source.includes(fragment))
  assert.ok(!source.includes('type="checkbox"'));assert.ok(!source.includes('<Teleport'))
  assert.equal((source.match(/<USwitch/g)||[]).length,1)
  assert.ok(source.includes('始终保留 · 不可关闭'))
})

test('深底高亮与实心主色分开，开关显式限制轨道与圆点尺寸',()=>{
  const css=read('assets/css/main.css'),creation=read('assets/css/creation.css')
  assert.ok(css.includes('--liv-ui-primary-foreground: #818CF8'))
  assert.ok(css.includes('--liv-switch-width: 40px'));assert.ok(css.includes('--liv-switch-height: 22px'));assert.ok(css.includes('--liv-switch-thumb: 18px'))
  assert.ok(css.includes('padding:0!important;gap:0!important;border:2px solid transparent!important'))
  assert.ok(creation.includes('creation-tool.creation-skill{color:var(--liv-skill-accent)'))
})

test('技能强调色独立于积分和主色，紧凑名称可收缩且保留完整提示',()=>{
  const css=read('assets/css/creation.css'),tokens=read('assets/css/tokens.css'),composer=read('features/creation/components/CreationComposer.vue')
  assert.ok(tokens.includes('--liv-skill-label-max: 128px'))
  assert.ok(tokens.includes('--liv-skill-accent: #f8bf32'))
  assert.ok(tokens.includes('--liv-skill-accent-on-dark: #f8bf32'))
  assert.ok(css.includes('max-width:var(--liv-skill-label-max)'))
  assert.ok(css.includes('.creation-studio .creation-cost{color:var(--liv-ui-primary-foreground)'))
  assert.ok(css.includes('.creation-studio{--liv-skill-accent:var(--liv-skill-accent-on-dark)}'))
  assert.ok(composer.includes('选择技能：${selectedSkill?.label'))
  assert.ok(composer.includes('flex:0 1 auto;overflow:hidden'))
})
test('技能分类按当前入口目录生成，窄屏单行滚动并提供键盘可用的左右导航',()=>{
  const css=read('assets/css/creation.css'),composer=read('features/creation/components/CreationComposer.vue')
  assert.ok(composer.includes('item.entries.includes(props.entry)'))
  assert.ok(composer.includes("skillScope.value !== 'mine' || item.kind === 'user'"))
  assert.ok(composer.includes("new Set(scopedSkillList.value.map(item => item.category || '通用'))"))
  assert.ok(composer.includes('scopedSkillList.value.filter(item => (skillCategory.value'))
  assert.ok(composer.includes("(item.category || '通用') === skillCategory.value"))
  assert.ok(composer.includes("function setSkillScope(scope:'all'|'mine')"))
  assert.ok(composer.includes("skillCategory.value='全部'"))
  assert.ok(composer.includes("@click=\"setSkillScope('mine')\""))
  assert.ok(composer.includes('categories.includes(skillCategory.value)'))
  assert.ok(composer.includes("emit('skill',catalog?.skills.some(item=>item.id==='free')?'free':'')"))
  assert.ok(composer.includes('role="tablist" aria-label="技能分类"'))
  assert.ok(composer.includes('向左查看技能分类')&&composer.includes('向右查看技能分类'))
  assert.ok(composer.includes('scrollSkillCategories(direction'))
  assert.match(css,/\.creation-filter\.creation-skill-categories\{[^}]*display:flex;[^}]*flex-wrap:nowrap/)
  assert.ok(css.includes('overflow-x:auto'))
  assert.ok(css.includes('.creation-skill-category-arrow:hover'))
  assert.ok(css.includes('.creation-skill-category-arrow:focus-visible'))
})
test('设置规格集中于令牌与现有封装，仓库说明要求后续复用',()=>{
  const css=read('assets/css/main.css'),instructions=read('AGENTS.md')
  assert.ok(css.includes('--liv-settings-title: 18px'));assert.ok(css.includes('--liv-settings-body: 14px'));assert.ok(css.includes('--liv-settings-note: 12px'))
  assert.ok(read('components/liv-ui/LivDialog.vue').includes('liv-settings-dialog'))
  assert.ok(read('components/liv-ui/LivButton.vue').includes('liv-settings-button'))
  assert.ok(instructions.includes('docs/livliv-ui-spec.md'));assert.ok(instructions.includes('USwitch'))
})
