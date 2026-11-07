// 编译真实预览组件；覆盖图片/视频/音频模板分支，不用参考素材代替结果文件。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'
import {renderToString} from 'vue/server-renderer'

const source=compileScript(parse(readFileSync('features/creation/components/CreationMediaPreview.vue','utf8')).descriptor,{id:'media-preview-render',inlineTemplate:true}).content
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const module={exports:{}}
new Function('require','exports','module',code)(name=>{assert.equal(name,'vue');return vue},module.exports,module)

/** 基础图标只做可观察占位，不替换业务媒体模板。 */
async function render(props){
  const app=vue.createSSRApp(module.exports.default,props)
  app.component('UIcon',{props:['name'],setup:p=>()=>vue.h('span',{'data-icon':p.name})})
  return renderToString(app)
}

test('图片完成卡使用真实结果url，即使没有独立cover也显示缩略图',async()=>{
  const html=await render({kind:'image',url:'/owned-result.png',cover:'/not-result-cover.png'})
  assert.match(html,/<img[^>]+src="\/owned-result.png"/)
  assert.ok(!html.includes('/not-result-cover.png'))
  assert.ok(!html.includes('i-lucide-music'))
  assert.ok(!html.includes('<video'))
})

test('固定完成提示预留真实缩略图尺寸，不采用异步解码懒加载反复出现',async()=>{
  const html=await render({kind:'image',url:'/owned-result.png',stableThumbnail:true})
  assert.match(html,/width="40"/);assert.match(html,/height="40"/)
  assert.match(html,/loading="eager"/);assert.match(html,/decoding="sync"/)
})

test('缺少图片文件显示图片占位，音乐和视频仍沿用各自预览',async()=>{
  assert.ok((await render({kind:'image',url:''})).includes('i-lucide-image'))
  assert.ok((await render({kind:'audio',url:'/song.mp3'})).includes('i-lucide-music'))
  const video=await render({kind:'video',url:'/movie.mp4'})
  assert.match(video,/<video[^>]+src="\/movie.mp4"/)
  assert.ok(!video.includes('autoplay'))
  assert.match(await render({kind:'video',url:'/movie.mp4',cover:'/frame.jpg'}),/<img[^>]+src="\/frame.jpg"/)
})
