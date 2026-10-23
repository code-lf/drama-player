// 快捷技能只保留一个使用入口；编译检查不代替真实浏览器交互验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('快捷技能预览无重复使用按钮，下方使用与主体预览仍分离',()=>{
  const filename='features/creation/components/CreationQuickSkill.vue',source=read(filename)
  const {descriptor,errors}=parse(source)
  assert.deepEqual(errors,[])
  const script=compileScript(descriptor,{id:'quick-skill-use'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'quick-skill-use',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const preview=descriptor.template.content.match(/<template #content>([\s\S]*?)<\/template>/)[1]
  assert.doesNotMatch(preview,/<UButton|@click="use"/)
  assert.equal((descriptor.template.content.match(/<UButton\b/g)||[]).length,1)
  assert.match(source,/class="creation-quick-skill-use"[^>]*@click.stop="use"/)
  assert.match(source,/class="creation-quick-skill-main"[^>]*@click="preview"/)
  assert.match(source,/emit\('use',props.skill.id\)/)
})

test('下方使用复用现有白底深字令牌与试一试胶囊规格',()=>{
  const style=read('assets/css/creation.css').match(/\.creation-quick-skill-use\{([^}]+)\}/)[1]
  assert.match(style,/background:var\(--liv-control-on-primary\)/)
  assert.match(style,/color:var\(--liv-page-background\)/)
  assert.match(style,/border-radius:999px/)
  assert.match(style,/min-height:32px/)
})
