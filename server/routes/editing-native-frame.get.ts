import bundle from '~~/third-party/fablecut/browser/bundle.json'
import {createNativeFrameDocument} from '~~/features/editing/native-frame-document.mjs'

/** 独立静态编辑壳仅在iframe打开时请求；不读取账号、私有素材或平台草稿。 */
export default defineEventHandler(event=>{
  const query=getQuery(event)
  const channel=typeof query.channel==='string'?query.channel:''
  const nonce=typeof query.nonce==='string'?query.nonce:''
  // 随机身份只负责当前父窗口握手，不能成为素材访问授权或任意脚本输入。
  if(!/^[0-9a-f]{32}$/.test(channel)||!/^[0-9a-f]{32}$/.test(nonce))throw createError({statusCode:400,statusMessage:'Invalid editor identity'})
  setResponseHeaders(event,{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    // 响应本身也强制隔离；即使父壳误改iframe属性也不获得平台同源权限。
    'content-security-policy':`sandbox allow-scripts; default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob:; connect-src blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`,
    'referrer-policy':'no-referrer',
  })
  return createNativeFrameDocument(bundle,channel,nonce)
})
