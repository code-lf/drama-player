// 结构回归不等于供应商或浏览器验收；确保免费操作不偷偷调用生成。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('会话及独立页面共用播放器，无时间轴不伪造歌词滚动',()=>{
  assert.ok(read('features/creation/components/CreationResultCanvas.vue').includes('<MusicPlayer'))
  assert.ok(read('pages/music/[id].vue').includes('<MusicPlayer'))
  const player=read('features/music/components/MusicPlayer.vue')
  assert.equal((player.match(/<audio /g)||[]).length,1)
  assert.ok(player.includes('timedLyrics'));assert.ok(player.includes('暂无同步时间轴'))
})
test('普通发送先进入助手，方案采用及真实执行单独确认',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes("if(entry.value!=='drama')"))
  assert.ok(studio.includes('await planDemand();return'))
  assert.match(studio,/await prepare\(true[,)]/);assert.ok(studio.includes('creationService.authorize'))
  assert.ok(studio.includes('stopCountdown'));assert.ok(read('features/creation/components/CreationConfirmationCard.vue').includes('超过积分阈值'))
})
test('MV 来源收进输入框，不再强制歌词输入，试听只创建本地对象 URL',()=>{
  const composer=read('features/creation/components/CreationComposer.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(composer.includes('name="audio-source"'))
  assert.ok(!composer.includes('MV 歌词原文'))
  assert.ok(!studio.includes('mvRights'))
  const upload=studio.slice(studio.indexOf('async function receiveFiles'),studio.indexOf("const mvSource ="))
  assert.ok(upload.includes('URL.createObjectURL'));assert.ok(!upload.includes('createTask'))
})
