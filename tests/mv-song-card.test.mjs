// 媒体卡仅消费真实歌曲封面，不把音频 URL 当作图片；业务归属仍由服务端校验。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('MV 来源使用歌曲卡，原始来源长表单收进真实弹窗',()=>{
 const studio=read('features/creation/components/CreationStudio.vue'),composer=read('features/creation/components/CreationComposer.vue')
 assert.ok(!studio.includes('<details class="creation-audio-source"'))
 assert.ok(studio.includes('title="选择 MV 歌曲"'))
 assert.ok(!studio.includes('mvRights'))
 assert.ok(!studio.includes('我可以使用这段外部音频'))
 assert.ok(studio.includes('<URadioGroup v-model="mvSourceMode"'))
 assert.ok(studio.includes('v-if="mvSourceMode===\'owned\'"'))
 assert.ok(studio.includes('<template #footer><LivButton settings block variant="primary" :disabled="!canUseMvSource"'))
 assert.ok(composer.includes("'is-song-card':reference.media_type==='audio'"))
 assert.ok(composer.includes('reference.cover_url||musicSources.find'))
 assert.ok(composer.includes('i-lucide-disc-3'))
})
test('本人歌曲传入固定版本与封面，替换成外部上传时清理原确认',()=>{
 const studio=read('features/creation/components/CreationStudio.vue')
 assert.ok(studio.includes('mv_song_version:version.id'))
 assert.ok(studio.includes('sourceTask:mvSource.value,rightsConfirmed:false'))
 assert.ok(studio.includes('cover_url:String(song?.image_large_url||song?.image_url'))
 assert.ok(studio.includes("sourceTask:'',extra:{...parameters.value.extra,mv_song_version:'',mv_lyrics:''"))
})
