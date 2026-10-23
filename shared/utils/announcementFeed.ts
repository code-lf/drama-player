/** 公告按钮仅允许站内路径与HTTP(S)链接，不执行管理员富文本中的脚本协议。 */
export function safeAnnouncementLink(value:string|undefined):string{
  const link=(value||'').trim()
  if(/[\u0000-\u0020\\]/.test(link))return ''
  if(link.startsWith('/')&&!link.startsWith('//'))return link
  try{return ['http:','https:'].includes(new URL(link).protocol)?link:''}catch{return ''}
}
