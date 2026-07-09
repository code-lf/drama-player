export function sanitizeAnnouncementContent(content: string): string {
  if (!content) return ''

  // 服务端渲染阶段没有 DOM，先去掉最危险的脚本块；客户端会继续做标签和属性白名单清洗。
  if (!import.meta.client) return content.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')

  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'EM',
    'H1',
    'H2',
    'H3',
    'H4',
    'I',
    'IMG',
    'LI',
    'OL',
    'P',
    'PRE',
    'S',
    'SPAN',
    'STRONG',
    'U',
    'UL'
  ])
  const template = document.createElement('template')
  template.innerHTML = content

  const sanitizeStyle = (styleText: string): string => {
    // 公告富文本只允许展示型样式，避免运营粘贴复杂 HTML 时带入定位、脚本或远程背景资源。
    return styleText
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => {
        const [name = '', value = ''] = part.split(':').map((item) => item.trim().toLowerCase())
        const safeName = ['background-color', 'color', 'text-align'].includes(name)
        const safeValue = /^[#(),.%\w\s-]+$/.test(value) && !value.includes('url') && !value.includes('expression')
        return safeName && safeValue
      })
      .join('; ')
  }

  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return

      const element = child as HTMLElement
      if (!allowedTags.has(element.tagName)) {
        // 不支持的标签只剥掉外壳，保留内部文本，避免误粘贴内容后整段丢失。
        const parent = element.parentNode
        while (element.firstChild) parent?.insertBefore(element.firstChild, element)
        parent?.removeChild(element)
        if (parent) walk(parent)
        return
      }

      Array.from(element.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase()
        if (element.tagName === 'A' && ['href', 'target', 'rel'].includes(name)) return
        if (element.tagName === 'IMG' && ['src', 'alt'].includes(name)) return
        if (name === 'style') {
          const safeStyle = sanitizeStyle(attr.value)
          if (safeStyle) element.setAttribute('style', safeStyle)
          else element.removeAttribute(attr.name)
          return
        }
        element.removeAttribute(attr.name)
      })

      if (element.tagName === 'A') {
        const href = element.getAttribute('href') || ''
        const safeHref = href.startsWith('/') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')
        if (!safeHref) element.removeAttribute('href')
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noopener noreferrer')
      }

      if (element.tagName === 'IMG') {
        const src = element.getAttribute('src') || ''
        const safeSrc = src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')
        if (!safeSrc) element.remove()
      }

      walk(element)
    })
  }

  walk(template.content)
  return template.innerHTML
}
