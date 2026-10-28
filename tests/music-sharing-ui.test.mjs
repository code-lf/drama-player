// 结构保护与服务端隔离测试互补；不把源码断言当成浏览器视觉验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('隐藏播放器暂停且保留进度，恢复不续播，迟到play与卸载清理遵守同一保护',()=>{
 const player=read('features/music/components/MusicPlayer.vue')
 const block=player.slice(player.indexOf('let resumeOnLoad=false'),player.indexOf('/** 切换曲目沿用播放意图'))
 const code=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const props=vue.reactive({playbackEnabled:true}),playing=vue.ref(true),error=vue.ref(''),listeners=new Map()
 const media={currentTime:27,pauseCount:0,pause(){this.pauseCount++}},audio={value:media}
 const doc={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key,fn)=>{if(listeners.get(key)===fn)listeners.delete(key)}}
 let mounted,unmount
 const scope=vue.effectScope()
 const api=scope.run(()=>new Function('props','audio','playing','error','document','watch','onMounted','onBeforeUnmount',`${code};return{played,markResume:()=>resumeOnLoad=true,resume:()=>resumeOnLoad}`)(props,audio,playing,error,doc,vue.watch,fn=>mounted=fn,fn=>unmount=fn))
 mounted();api.markResume();props.playbackEnabled=false
 assert.equal(media.pauseCount,1);assert.equal(media.currentTime,27);assert.equal(playing.value,false);assert.equal(api.resume(),false)
 props.playbackEnabled=true;assert.equal(media.pauseCount,1);assert.equal(playing.value,false)
 doc.hidden=true;api.played();assert.equal(media.pauseCount,2);assert.equal(playing.value,false)
 listeners.get('visibilitychange')();assert.equal(media.pauseCount,3)
 unmount();assert.equal(listeners.size,0);assert.equal(media.pauseCount,4);scope.stop()
 const endedCode=ts.transpileModule(player.match(/function ended\(\)\{[^\n]+\}/)[0],{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 let pausedEnd=0,selected=0
 const ended=new Function('props','document','playing','pausePlayback','shuffle','trackIndex','changeTrack','emit',`${endedCode};return ended`)({playbackEnabled:false,tracks:[{key:'a'},{key:'b'}]}, {hidden:false},playing,()=>pausedEnd++,{value:false},{value:0},()=>selected++,()=>selected++)
 ended();assert.equal(pausedEnd,1);assert.equal(selected,0)
 const studio=read('features/creation/components/CreationStudio.vue')
 assert.ok(studio.includes(':playback-enabled="!compositionOpen&&!rulesOpen&&!showMusicTools&&(floatingChat||desktopWorkspace||mobilePane===\'canvas\')"'))
 assert.ok(read('features/creation/components/CreationResultCanvas.vue').includes(':playback-enabled="playbackEnabled"'))
})
test('单曲节点显示真实来源序号，紧凑/沉浸继续共用同一音频',()=>{
 const player=read('features/music/components/MusicPlayer.vue')
 const expression=player.match(/const displayTrackNumber=computed\(\(\)=>([^\n]+)\)/)?.[1]
 assert.ok(expression)
 const compiled=ts.transpileModule(`const get=(props,trackIndex)=>(${expression});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const get=new Function(`${compiled};return get`)()
 assert.equal(get({trackNumber:1},{value:0}),2)
 assert.equal(get({trackNumber:0},{value:0}),1)
 assert.equal(get({trackNumber:-1},{value:2}),3)
 assert.equal(get({},{value:-1}),undefined)
 assert.ok(player.includes("'is-compact':compact&&!immersive"))
 assert.equal((player.match(/<audio /g)||[]).length,1)
 assert.ok(player.includes('.is-compact .music-business-actions{order:5'))
 assert.ok(player.includes('<Teleport :to="controlsTarget||\'body\'" :disabled="!dockControls">'))
 const dockExpression=player.match(/const dockControls=computed\(\(\)=>([^\n]+)\)/)?.[1]
 const dock=new Function('props','immersive',`return ${dockExpression}`)
 assert.equal(dock({compact:true,controlsTarget:'#same-canvas'},{value:false}),true)
 assert.equal(dock({compact:true,controlsTarget:'#same-canvas'},{value:true}),false)
 assert.equal(dock({compact:false,controlsTarget:'#same-canvas'},{value:false}),false)
 assert.equal(dock({compact:true},{value:false}),false)
 assert.ok(player.includes('.music-player-controls.is-canvas-controls button{width:32px;height:32px;min-height:32px'))
})
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
