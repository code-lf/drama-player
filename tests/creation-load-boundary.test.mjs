// 构建后校验真实静态依赖树；普通测试未构建时跳过，避免把源码字符串当成分包证据。
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {test} from 'node:test'
import assert from 'node:assert/strict'

const manifestPath=resolve('.nuxt-build/dist/server/client.manifest.mjs')

test('画布首屏静态依赖不包含按需面板、前端模拟适配器与短剧图表库',{skip:!existsSync(manifestPath)},async()=>{
  const manifest=(await import(pathToFileURL(manifestPath).href)).default
  const entries=Object.entries(manifest)
  const roots=entries.filter(([key,value])=>key==='features/creation/components/CreationStudio.vue'||value.name==='dashboard'||value.name==='entry').map(([key])=>key)
  assert.equal(roots.length,3,'构建清单缺少创作工作区、工作台或入口，无法验证分包')
  const visited=new Set()
  // 只遍历同步依赖；动态依赖允许在用户打开对应能力时加载。
  function visit(key){
    if(visited.has(key))return
    assert.ok(manifest[key],`构建清单缺少依赖：${key}`)
    visited.add(key)
    for(const dependency of manifest[key].imports||[])visit(dependency)
  }
  roots.forEach(visit)
  for(const name of ['AssetLibraryPanel','LibraryPicker','CreationDeliveryPanel','MvLyricAlignment','CreationSafetyRepair','mockAdapter','echarts']){
    assert.ok(entries.some(([,value])=>value.name===name),`构建清单未包含 ${name}，不能误判为已按需加载`)
    assert.equal([...visited].some(key=>manifest[key].name===name),false,`${name} 不应成为画布首屏同步依赖`)
  }
  // 音频播放器在试听或音频节点出现时才加载，图片／视频画布不应同步引入。
  visit('features/creation/components/CreationAgentCanvas.vue')
  const players=entries.filter(([,value])=>value.name==='MusicPlayer')
  assert.ok(players.length,'构建清单缺少音乐播放器')
  assert.equal(players.some(([key])=>visited.has(key)),false,'音乐播放器不应成为普通画布的同步依赖')
})
