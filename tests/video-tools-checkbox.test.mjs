// 只校验展示配置与模板编译，不勾选真实协议、不提交生成或更改免确认规则。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('勾选图标使用固定品牌前景，不随主题反转',()=>{
  const config=read('app.config.ts')
  assert.match(config,/checkbox:[\s\S]*indicator: 'text-\[var\(--liv-control-on-primary\)\]'/)
  assert.match(config,/icon: 'text-\[var\(--liv-control-on-primary\)\]'/)
  assert.match(read('assets/css/tokens.css'),/--liv-control-on-primary: #ffffff/)
})

test('视频主工具保留截帧与引用，移除旧通用创作台入口且模板可编译',()=>{
  const source=read('features/creation/components/CreationResultCanvas.vue')
  assert.doesNotMatch(source,/视频同款与口播/)
  assert.doesNotMatch(source,/打开视频创作台|:items="videoToolItems"/)
  assert.match(source,/@click="capture"/)
  assert.match(source,/@click="ai\('video_reference'\)"/)
  const {descriptor}=parse(source)
  const script=compileScript(descriptor,{id:'video-tools-test'})
  const result=compileTemplate({source:descriptor.template.content,filename:'CreationResultCanvas.vue',id:'video-tools-test',compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(result.errors,[])
})
