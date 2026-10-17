// 结构回归仅证明绑定关系与防护存在；播放器及浮层仍须真实浏览器验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('旧卡片只能在所属会话的唯一滚动区出现',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('groupConversation(messages.value,assistantHistory.value,planning.value,session.value?.id)'))
  assert.ok(read('features/creation/conversationRows.ts').includes('run.session_id===sessionId'))
  assert.ok(studio.includes('conversationRows'))
  assert.equal((studio.match(/class="creation-chat-history/g)||[]).length,1)
  assert.ok(!studio.includes('class="creation-assistant-history"'))
  assert.ok(studio.includes("watch([()=>planning.value?.id,()=>planning.value?.status]"))
  assert.ok(studio.indexOf('aria-label="Liv 创作助手"')<studio.indexOf('<CreationComposer'))
})
test('回车遵守输入法与引用选择，提示不再逐字动画',()=>{
  const composer=read('features/creation/components/CreationComposer.vue')
  assert.ok(composer.includes("event.key === 'Enter' && !event.shiftKey"))
  assert.ok(composer.indexOf('event.isComposing')<composer.indexOf("event.key === 'Enter' && !event.shiftKey"))
  assert.ok(composer.includes('输入 @ 引用资料库'))
  assert.ok(!composer.includes('setTimeout(tick,45)'))
})
test('播放器保留左右卡、白色高亮令牌和唯一音频节点',()=>{
  const player=read('features/music/components/MusicPlayer.vue')
  const css=player
  assert.ok(player.includes('music-player-info'));assert.ok(player.includes('music-player-words'))
  assert.ok(css.includes('--music-lyric:24px'));assert.ok(css.includes('--music-active:26px'))
  assert.ok(css.includes('--liv-music-current-text'))
  assert.equal((player.match(/<audio /g)||[]).length,1)
  assert.ok(player.includes('恢复歌词跟随'))
  assert.ok(!read('pages/music/[id].vue').includes('await musicService.ensureLyrics'))
})
test('尺寸浮层绑定触发器，普通聊天通过显式模式提交',()=>{
  assert.ok(read('features/creation/components/CreationResultCanvas.vue').includes('v-model:open="ratioOpen"'))
  assert.ok(read('shared/api/services/creationService.ts').includes("mode:draft.skill?'skill':'chat'"))
  assert.ok(read('features/creation/useCreationWorkspace.ts').includes("方案确认后报价"))
})
