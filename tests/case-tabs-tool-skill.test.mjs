// 验证真实分类过滤与专用工具入口，不调用报价、生成或收费接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref} from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const studio=read('features/creation/components/CreationStudio.vue')

test('电商显示技能分类，其余入口为单标题案例',()=>{
  const header=studio.slice(studio.indexOf('<header ref="caseHeader"'),studio.indexOf('</header>',studio.indexOf('<header ref="caseHeader"')))
  assert.ok(header.includes('<UTabs'))
  assert.ok(!header.includes('<h2'))
  assert.ok(studio.includes('<CreationSkillShowcase'))
  assert.ok(studio.includes('<h2>{{caseHeading}}</h2>'))
  assert.ok(studio.includes('creationCaseService.list(entry.value)'))
  assert.ok(!studio.includes('filteredCases'))
})

test('数字人作为独立工具技能，旧视频工作区不再被打开，口播只复用专用接口',()=>{
  assert.ok(!studio.includes('视频同款与数字人口播')&&!studio.includes('showVideoTools'))
  assert.ok(studio.includes('digital-only'))
  const panel=read('features/product-video/components/ProductVideoWorkspacePanel.vue')
  assert.ok(panel.includes('if(props.digitalOnly){await loadDigitalAvailability();return}'))
  assert.ok(panel.includes('quoteDigitalHuman(digitalScript.value.trim())'))
  assert.ok(panel.includes('if (!await confirmAction('))
  assert.ok(panel.includes('createDigitalHumanTask({ script: digitalScript.value.trim(), resolution: digitalResolution.value })'))
  assert.ok(read('features/creation/components/CreationComposer.vue').includes("emit('tool','digital-human')"))
  assert.ok(read('features/creation/components/SkillCenterPanel.vue').includes("emit('tool')"))
  assert.ok(studio.includes('@tool="showDigitalHumanSkill=true"'))
  for(const path of ['features/creation/components/CreationStudio.vue','features/creation/components/SkillCenterPanel.vue','features/creation/components/CreationComposer.vue','features/product-video/components/ProductVideoWorkspacePanel.vue']){
    const {descriptor}=parse(read(path)),script=compileScript(descriptor,{id:path})
    const result=compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}})
    assert.deepEqual(result.errors,[])
  }
})
