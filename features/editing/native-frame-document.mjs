/** 仅构造隔离文档，不在首页读取上游大包；调用方必须使用sandbox="allow-scripts"。
 * CSP禁止网络、表单、子页及外部脚本。媒体只能由父壳传输字节后创建blob。
 */
export function createNativeFrameDocument(bundle, channel, nonce) {
  if (!/^[0-9a-f]{32}$/.test(channel) || !/^[0-9a-f]{32}$/.test(nonce)) throw new Error('隔离身份无效。')
  if (bundle.version !== '1.18.0') throw new Error('不支持的原生编辑器版本。')
  const script = source => `<script nonce="${nonce}">${source.replace(/<\/script/gi, '<\\/script')}</script>`
  const boot = `
const livMemoryStorage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const livChannel=${JSON.stringify(channel)};
let livSeq=0;
function livSend(type,payload){parent.postMessage({version:1,channel:livChannel,request_id:'native_'+(++livSeq),type,payload},'*');}
// 不向原版授予网络、文件服务、导航、持久化或原生弹窗能力。
const livFetch=window.fetch.bind(window);
window.fetch=(url,options)=> typeof url==='string' && url.startsWith('blob:null/') ? livFetch(url,options) : Promise.reject(new Error('network_disabled'));
window.EventSource=window.WebSocket=class {constructor(){throw new Error('network_disabled')}};
// 上游标尺先transfer再建Worker；CSP禁Worker时会留下不可重设尺寸的canvas，走原生主线程回退。
window.Worker=undefined;
window.alert=window.confirm=window.prompt=()=>{throw new Error('native_dialog_disabled')};
window.open=()=>null;
let livPending=false,livDragging=false,livEditable=true;
function livStop(e){e.preventDefault();e.stopImmediatePropagation();}
for(const type of ['pointerdown','mousedown','click','dblclick','contextmenu','keydown','input','change','drop']){
  document.addEventListener(type,e=>{
    if(type==='keydown'){if(!['Space','Tab'].includes(e.code)||e.ctrlKey||e.metaKey||e.altKey)livStop(e);return;}
    // 循环音轨是多个投影分片，不能让上游单片拖动/音量手势产生无法保存的候选。
    if(['pointerdown','mousedown'].includes(type)&&e.target.closest?.('.clip.c-audio')){livStop(e);return;}
    // 保存未收敛或冲突时，允许预览播放但不给原生片段开始新的编辑手势。
    if(!livEditable&&['pointerdown','mousedown'].includes(type)&&e.target.closest?.('.clip,#preview')){livStop(e);return;}
    const target=e.target.closest?.('#timelineScroll,#zoomSlider,#btnZoomFit,#btnPlay,#preview');
    if(!target || e.altKey || e.ctrlKey || e.metaKey || type==='dblclick'||type==='contextmenu'||type==='drop'||livPending)livStop(e);
  },true);
}
window.addEventListener('error',e=>{
  console.error('[liv-native]',e.message,e.lineno);
  livSend('runtime_error',{code:'native_runtime_failed'});
});
`
  const attach = `
const fail=(code,path,message)=>{throw Object.assign(new Error(message),{code,path})};
const validateDraft=()=>{};const applyCandidate=()=>{};
${bundle.adapter}
const livProject=nativeProject,livChanges=nativeChanges;
let livDraft=null,livBaseline=null,livTimer=null,livApplyEpoch=0;
let livMediaDirty=false;
const livMedia=Object.create(null),livUrls=new Set();
function livApply(){
  if(!livDraft)return;
  livMediaDirty=false;
  // 同一修订也可能连续收到多个素材；旧解码回调不得替换新投影的编辑基线。
  const applyEpoch=++livApplyEpoch;
  applyProject(livProject(livDraft,livMedia));
  livBaseline=structuredClone(projectJSON());
  livPending=false;
  // applyProject只恢复数据；离线投影没有connectServer的后续探测，需明确解码本地媒体。
  const revision=livDraft.revision;
  for(const m of project.media.filter(m=>m.src))Promise.resolve().then(()=>loadMediaMetadata(m)).then(async()=>{
    if(applyEpoch!==livApplyEpoch||livDraft.revision!==revision)return;
    // 单项解码不阻塞其他波形或缩略图；回调不能用正在拖动的项目刷新编辑基线。
    if(m.kind==='audio'||m.kind==='video')ensureWave(m);
    if(m.kind==='video')await grabThumb(m);
    if(applyEpoch!==livApplyEpoch)return;
    if(livDragging||livPending||livTimer){livMediaDirty=true;return;}
    rebuildClips();state.dirtyTimeline=true;
  }).catch(()=>{if(applyEpoch===livApplyEpoch)livSend('media_decode_failed',{clip_id:m.id});});
}
window.__livChanged=()=>{
  if(!livDraft||!livBaseline||livPending)return;
  clearTimeout(livTimer);
  livTimer=setTimeout(()=>{
    livTimer=null;
    try{
      const operations=livChanges(livDraft,livBaseline,projectJSON());
      if(operations.length){livPending=true;livSend('edit_candidate',{expected_revision:livDraft.revision,operations});}
      else livApply();
    }catch(error){
      // 私有控制台保留字段与具体原因，跨域桥仅发送稳定分类，不泄露素材地址。
      console.warn('[liv-native-edit]',error.code,error.path,error.message);
      livApply();livSend('runtime_error',{code:error.path==='audio'?'audio_edit_restricted':'unsupported_native_change'});
    }
  },150);
};
window.addEventListener('message',e=>{
  const m=e.data;
  if(e.source!==parent||!m||m.version!==1||m.channel!==livChannel)return;
  if(m.type==='viewport'){
    const p=m.payload;
    if(!p||!Number.isFinite(p.right)||p.right<0||p.right>440||typeof p.paused!=='boolean')return;
    document.documentElement.style.setProperty('--liv-material-width',p.right+'px');
    document.documentElement.classList.toggle('liv-narrow',p.compact===true);
    livEditable=p.editable!==false;
    if(p.paused){if(state.playing)pause();document.querySelectorAll('video,audio').forEach(el=>el.pause());}
  }else if(m.type==='projection'){
    clearTimeout(livTimer);livTimer=null;livDraft=structuredClone(m.payload);livApply();
  }else if(m.type==='media_remove'){
    const id=m.payload?.clip_id,url=typeof id==='string'&&Object.hasOwn(livMedia,id)?livMedia[id]:null;
    if(!url)return;
    URL.revokeObjectURL(url);livUrls.delete(url);delete livMedia[id];
    if(livDragging||livPending||livTimer)livMediaDirty=true;else livApply();
  }else if(m.type==='media_bytes'){
    const p=m.payload;
    if(!p||![...livDraft?.visuals||[],...livDraft?.audio_tracks||[]].some(c=>c.id===p.clip_id)||!(p.bytes instanceof ArrayBuffer)||p.bytes.byteLength>300*1024*1024||!['image/png','image/jpeg','image/webp','video/mp4','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/ogg'].includes(p.mime))return;
    if(livMedia[p.clip_id]){URL.revokeObjectURL(livMedia[p.clip_id]);livUrls.delete(livMedia[p.clip_id]);}
    const url=URL.createObjectURL(new Blob([p.bytes],{type:p.mime}));livMedia[p.clip_id]=url;livUrls.add(url);
    // 迟到素材不能重建正在拖动的轨道，或清掉松手后等待提交的候选。
    if(livDragging||livPending||livTimer)livMediaDirty=true;else livApply();
  }
});
let livSelected=null;
// 包装真实播放入口而非只监听按钮，空格播放也要卸载外壳素材试听，避免两个音源并发。
const livOriginalPlay=play;
play=function(){livOriginalPlay();livSend('playback',{playing:!!state.playing});};
window.addEventListener('pointerdown',e=>{
  if(e.button===0&&e.target.closest?.('#timelineScroll .clip:not(.c-audio),#preview'))livDragging=true;
},true);
function livReleasePointer(){livDragging=false;setTimeout(()=>{
  if(livMediaDirty&&!livPending&&!livTimer&&!livDragging)livApply();
  if(state.selId!==livSelected){livSelected=state.selId;livSend('selection',{clip_id:livSelected});}
  livSend('playhead',{position_ms:Math.max(0,Math.min(180000,Math.round(state.time*1000)))});
},0);}
window.addEventListener('pointerup',livReleasePointer);
window.addEventListener('pointercancel',livReleasePointer);
window.addEventListener('blur',livReleasePointer);
window.addEventListener('pagehide',()=>{clearTimeout(livTimer);for(const url of livUrls)URL.revokeObjectURL(url);});
livSend('ready',{});
`
  const override = `
/* 只开放主轨/预览的验证阶段外观；上游高级按钮和DOM事件同时由捕获守卫拦截。 */
:root{--accent:#4F46E5;--accent-hover:#6366f1;--bg:#202020;--well:#202020;--panel-head:#202020;font-family:"PingFang SC",sans-serif}
.topbar,.bin,.inspector,.side-panel,.v-split,.monitor-top,.track-headers,.overlay,.context-menu,#monitorModeGroup,#aspectSel,#fpsSel,#exportFrameSel,#btnExportFrame,#btnGuides,#btnProxy,#vuMeter{display:none!important}
.app{height:100vh!important;display:flex!important;flex-direction:column!important}
.upper{flex:1!important;min-height:0!important;display:block!important}
#monitorPanel{height:100%!important;width:100%!important}
.upper{margin-right:var(--liv-material-width,0px)!important}
.timeline-panel{height:340px!important;min-height:340px!important;flex:none!important}
.timeline-toolbar>*{display:none!important}
.timeline-toolbar>#zoomSlider,.timeline-toolbar>#btnZoomFit{display:block!important}
.timeline-toolbar::before{content:'画面轨 · 拖动排序 / 边缘裁切';font-size:13px;color:#aaa;margin-right:auto}
.timeline{grid-template-columns:1fr!important}.monitor-controls{justify-content:center}
button:is(#btnMarkIn,#btnHome,#btnBack,#btnFwd,#btnEnd,#btnMarkOut,#btnSpeed){display:none!important}
button,input{font:inherit}.timeline-toolbar{gap:8px}
/* 控制条与底部时间轴同宽，中央播放不再被父壳编辑按钮遮住。 */
.transport{position:fixed!important;bottom:340px!important;left:0;right:0;height:64px!important;border-top:1px solid #333;background:#202020;display:flex!important;align-items:center!important;justify-content:center!important;gap:20px!important;z-index:4}.tc-playhead{display:contents!important}.tc-slash,.transport-end{display:none!important}#tcCurrent{order:1}.transport-btns{order:2}#tcTotal{order:3}
#btnPlay{width:36px!important;height:36px!important;min-width:36px;border-radius:50%!important;background:#fff!important;color:#111!important;font-size:18px!important;border:0!important}
.monitor-wrap{padding:16px!important;background:#111!important}.monitor-top{display:none!important}.timeline-toolbar{height:0!important;min-height:0!important;padding:0!important;border:0!important;overflow:visible!important;position:relative;z-index:5}.timeline-toolbar::before{display:none!important}.timeline-toolbar>#zoomSlider{position:absolute;right:60px;top:-40px;width:130px}.timeline-toolbar>#btnZoomFit{position:absolute;right:8px;top:-44px}.timeline-panel{background:#202020!important;border-radius:0!important}.upper{padding-bottom:64px!important}.track-headers{display:block!important}.timeline{grid-template-columns:40px minmax(0,1fr)!important}
#monitorPanel{border:0!important;border-radius:0!important;background:#111!important}#monitorPanel>.panel-head{display:none!important}.monitor-stage,.monitor-scroll{background:#111!important}.track-head>* ,#trackHeadTools{display:none!important}.track-head{display:grid!important;place-items:center;color:#888;font-size:11px}.track-head[data-track=V1]::before{content:'视频'}.track-head[data-track=A1]::before{content:'配乐'}.track-head[data-track=A2]::before{content:'旁白'}
/* 上游时间轴面板会裁切向上溢出的工具；固定到同一控制条，不让缩放按钮被面板吞掉。 */
.timeline-toolbar>#zoomSlider{position:fixed!important;top:auto!important;bottom:364px!important;right:60px!important;z-index:6}.timeline-toolbar>#btnZoomFit{position:fixed!important;top:auto!important;bottom:358px!important;right:8px!important;z-index:6}
/* 音轨参数在父壳详情中修改，隐藏首版没有执行合同的淡入淡出和包络手柄。 */
.clip.c-audio .vol-band,.clip.c-audio .fade,.clip.c-audio .fade-grip,.clip.c-audio .handle{display:none!important}.clip.c-audio{cursor:default!important}
/* 与外壳的窄屏时间轴一致，播放和时间码不与缩放手柄争抢点击区。 */
.liv-narrow .timeline-panel{height:180px!important;min-height:180px!important}
.liv-narrow .transport{bottom:180px!important;gap:8px!important;justify-content:flex-start!important;padding-left:8px!important}
.liv-narrow .timeline-toolbar>#zoomSlider{bottom:204px!important;right:44px!important;width:68px}
.liv-narrow .timeline-toolbar>#btnZoomFit{bottom:198px!important;right:4px!important}
.liv-narrow .upper{padding-bottom:104px!important}
`
  let html = bundle.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '')
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob:; connect-src blob:; font-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`
  html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${bundle.style}${override}</style>${script(boot)}`)
  const scripts = Object.values(bundle.files).map(script).join('')
  return html.replace('</body>', `${scripts}${script(attach)}</body>`)
}
