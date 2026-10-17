// 结构保护与服务端隔离测试互补；不把源码断言当成浏览器视觉验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('顶栏左右一级入口共用高度令牌且记录规范',()=>{
 const css=read('assets/css/creation.css')
 assert.match(css,/session-workspace-nav\{[^}]*height:var\(--liv-topbar-control-height\)/)
 assert.match(css,/dashboard-credit-pill,[^}]*announcement-bell\{height:var\(--liv-topbar-control-height\)/)
 assert.ok(read('docs/livliv-ui-spec.md').includes('同一行顶部左右一级入口'))
})
test('音乐特效遵循真实播放与减少动态效果，使用同一个音频元素',()=>{
 const player=read('features/music/components/MusicPlayer.vue'),css=player
 assert.equal((player.match(/<audio /g)||[]).length,1)
 assert.ok(player.includes('music-vinyl'));assert.ok(player.includes('aria-hidden="true"'))
 assert.ok(css.includes('.is-playing .music-vinyl{animation-play-state:running}'))
 assert.ok(css.includes('prefers-reduced-motion:reduce'))
 assert.ok(player.includes('timeline.length'));assert.ok(player.includes('music-player-tracks'))
 // Nuxt 开发服务曾把 style src 相对路径解析到仓库根目录；内联 scoped 样式防止再次 500。
 assert.ok(player.includes('<style scoped>'));assert.ok(!player.includes('src="./music-player.css"'))
})
test('分享先授权，公开路由不携带账号或调用生成',()=>{
 const page=read('pages/listen/[token].vue'),dialog=read('features/music/components/MusicShareDialog.vue')
 assert.ok(page.includes("credentials:'omit'"));assert.ok(page.includes("cache:'no-store'"))
 assert.ok(page.includes('noindex, nofollow, noarchive'))
 assert.ok(!page.includes('musicService.task'));assert.ok(!page.includes('ensureLyrics'))
 assert.ok(!dialog.includes('<UCheckbox'));assert.ok(dialog.includes('开启公开分享'))
 assert.ok(dialog.includes('关闭分享'));assert.ok(dialog.includes('shareState'))
})
