import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(path,'utf8')
const exports={}
new Function('exports',ts.transpileModule(read('features/creation/inputExamples.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports)
test('示例针对本题给出具体写法，视觉要求不再空白，未知问题有通用兜底',()=>{
  const example=exports.creationInputExample
  assert.match(example('补充视觉要求'),/镜头缓慢推进/)
  assert.match(example('核心卖点'),/真实信息/)
  assert.doesNotMatch(example('海报内容或卖点'),/考勤|OA/)
  assert.match(example('参考图用途'),/只参考/)
  assert.match(example('目标受众'),/企业行政/)
  assert.match(example('其他要求'),/^例如/)
})
test('示例仅放placeholder，既有答案、选填和提交合同不变，真实模板可编译',()=>{
  for(const name of ['CreationStageCard','CreationQuestionPages','SkillTextResources','SkillFlowEditor']){
    const path=`features/creation/components/${name}.vue`,source=read(path)
    const {descriptor}=parse(source),script=compileScript(descriptor,{id:'input-example'})
    assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:'input-example',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
    if(['CreationStageCard','CreationQuestionPages'].includes(name))assert.match(source,/:placeholder="creationInputExample/)
    assert.doesNotMatch(source,/v-model="creationInputExample|modelValue.*=creationInputExample/)
  }
})
