import type { H3Event } from 'h3'
import { readBody, getQuery } from 'h3'

interface LibraryVersion {
  id: string
  version_no: number
  size_bytes: number
  mime_type: string
  media: { width?: number; height?: number; duration_sec?: number }
  parse_status: string
  parse_error: string
  preview_url: string
}

interface LibraryItem {
  id: string
  name: string
  scope: 'personal' | 'public'
  media_type: string
  category: string
  status: string
  versions: LibraryVersion[]
  created_at: string
}

const mockCategories = [
  { code: 'character', name: '角色' },
  { code: 'scene', name: '场景' },
  { code: 'prop', name: '道具' },
  { code: 'script', name: '剧本' },
  { code: 'product', name: '商品' },
  { code: 'other', name: '其他' }
]

// 保持在沙箱内存中的资料库，支持断网与降级模式下的完整 CRUD 与交互
const inMemoryLibraryItems: LibraryItem[] = [
  {
    id: 'item-1',
    name: '短剧资产',
    scope: 'personal',
    media_type: 'image',
    category: 'character',
    status: 'active',
    created_at: '2026-10-12T10:00:00Z',
    versions: [
      {
        id: 'ver-1-1',
        version_no: 1,
        size_bytes: 1772093,
        mime_type: 'image/png',
        media: { width: 1024, height: 1024 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/tool-character.png'
      }
    ]
  },
  {
    id: 'item-2',
    name: '图片生成结果',
    scope: 'personal',
    media_type: 'image',
    category: 'other',
    status: 'active',
    created_at: '2026-10-12T11:00:00Z',
    versions: [
      {
        id: 'ver-2-1',
        version_no: 1,
        size_bytes: 1342177,
        mime_type: 'image/png',
        media: { width: 1024, height: 1024 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/tool-storyboard.png'
      }
    ]
  },
  {
    id: 'item-3',
    name: 'tool-product.png',
    scope: 'personal',
    media_type: 'image',
    category: 'product',
    status: 'active',
    created_at: '2026-10-12T12:00:00Z',
    versions: [
      {
        id: 'ver-3-3',
        version_no: 3,
        size_bytes: 1101004,
        mime_type: 'image/png',
        media: { width: 1024, height: 1024 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/tool-product.png'
      },
      {
        id: 'ver-3-2',
        version_no: 2,
        size_bytes: 1048576,
        mime_type: 'image/png',
        media: { width: 1024, height: 1024 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/tool-product.png'
      },
      {
        id: 'ver-3-1',
        version_no: 1,
        size_bytes: 980000,
        mime_type: 'image/png',
        media: { width: 1024, height: 1024 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/tool-product.png'
      }
    ]
  },
  {
    id: 'item-4',
    name: '资料库验收示例.txt',
    scope: 'personal',
    media_type: 'document',
    category: 'script',
    status: 'active',
    created_at: '2026-10-12T13:00:00Z',
    versions: [
      {
        id: 'ver-4-1',
        version_no: 1,
        size_bytes: 2048,
        mime_type: 'text/plain',
        media: {},
        parse_status: 'ready',
        parse_error: '',
        preview_url: ''
      }
    ]
  },
  {
    id: 'pub-1',
    name: '赛博都市夜景背景',
    scope: 'public',
    media_type: 'image',
    category: 'scene',
    status: 'active',
    created_at: '2026-10-10T10:00:00Z',
    versions: [
      {
        id: 'pub-ver-1',
        version_no: 1,
        size_bytes: 1075062,
        mime_type: 'image/png',
        media: { width: 1920, height: 1080 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/case-city.png'
      }
    ]
  },
  {
    id: 'pub-2',
    name: '浪漫青春校园场景',
    scope: 'public',
    media_type: 'image',
    category: 'scene',
    status: 'active',
    created_at: '2026-10-10T11:00:00Z',
    versions: [
      {
        id: 'pub-ver-2',
        version_no: 1,
        size_bytes: 1311065,
        mime_type: 'image/png',
        media: { width: 1920, height: 1080 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/case-youth.png'
      }
    ]
  },
  {
    id: 'pub-3',
    name: '真相对决电影级分镜',
    scope: 'public',
    media_type: 'image',
    category: 'script',
    status: 'active',
    created_at: '2026-10-10T12:00:00Z',
    versions: [
      {
        id: 'pub-ver-3',
        version_no: 1,
        size_bytes: 1385815,
        mime_type: 'image/png',
        media: { width: 1920, height: 1080 },
        parse_status: 'ready',
        parse_error: '',
        preview_url: '/landing/case-truth.png'
      }
    ]
  }
]

const sampleDocumentText = `【资料库剧本与设定说明文档】

一、故事梗概与核心背景
在近未来霓虹都市中，独立影视创作者团队使用 AI 工具箱在虚拟与现实双重片场进行短剧拍摄。随着剧本迭代与角色版本升级，他们面临着技术与艺术表现的双重考验。

二、主要角色档案
1. 主角：林晨（男，28岁，影视导演，思维敏捷，对镜头语言有极致追求）。
2. 配角：苏晓（女，26岁，视觉概念设计师，擅长赛博国潮与极简工业风）。
3. 反派/关键人物：神秘制片人（身份成谜，推动全片核心悬念与时间限制）。

三、重点分镜规划建议
- 分镜 1：林晨在天台雨夜中凝视监视器，霓虹倒影在水洼中泛起波澜（冷色调，慢动作）。
- 分镜 2：全息虚拟演播厅内，苏晓正在调整 AI 分镜模型参数，光影随手势实时渲染。
- 分镜 3：追逐戏中，手持镜头快速穿梭于狭窄巷道，低饱和度强反差光效。

四、关键资产关联
- 已挂载角色形象：短剧资产 v1
- 已挂载产品道具：tool-product.png v3
- 场景基底图：赛博都市夜景背景`

export async function handleLibraryFallback(event: H3Event, apiPath: string, requestUrl: URL): Promise<unknown> {
  const method = event.method.toUpperCase()

  // 1. 能力查询
  if (apiPath === '/library/capabilities') {
    return {
      enabled: true,
      image_picker: true,
      video_picker: true,
      drama_picker: true
    }
  }

  // 2. 配置查询
  if (apiPath === '/library/configuration') {
    return {
      categories: mockCategories,
      max_upload_bytes: 52428800,
      user_quota_bytes: 1073741824
    }
  }

  // 3. 读取文档内容
  if (apiPath === '/library/document/read') {
    return {
      text: sampleDocumentText,
      offset: 0,
      total_chars: sampleDocumentText.length,
      parse_status: 'ready',
      parse_error: ''
    }
  }

  // 4. 重试提取文档
  if (apiPath === '/library/document/retry') {
    const item = inMemoryLibraryItems.find(i => i.media_type === 'document')
    if (item && item.versions[0]) {
      item.versions[0].parse_status = 'ready'
      item.versions[0].parse_error = ''
    }
    return item || inMemoryLibraryItems[0]
  }

  // 5. 归档 / 恢复
  const archiveMatch = apiPath.match(/^\/library\/([^/]+)\/archive$/)
  if (archiveMatch) {
    const id = archiveMatch[1]
    const item = inMemoryLibraryItems.find(i => i.id === id)
    if (item) item.status = 'archived'
    return { success: true }
  }

  const restoreMatch = apiPath.match(/^\/library\/([^/]+)\/restore$/)
  if (restoreMatch) {
    const id = restoreMatch[1]
    const item = inMemoryLibraryItems.find(i => i.id === id)
    if (item) item.status = 'active'
    return item || { success: true }
  }

  // 6. 新增版本
  const versionMatch = apiPath.match(/^\/library\/([^/]+)\/versions$/)
  if (versionMatch && method === 'POST') {
    const id = versionMatch[1]
    const item = inMemoryLibraryItems.find(i => i.id === id)
    if (item) {
      const nextVer = (item.versions[0]?.version_no || item.versions.length) + 1
      const newVersion: LibraryVersion = {
        id: `ver-${id}-${nextVer}`,
        version_no: nextVer,
        size_bytes: 1250000,
        mime_type: item.versions[0]?.mime_type || 'image/png',
        media: item.versions[0]?.media || {},
        parse_status: 'ready',
        parse_error: '',
        preview_url: item.versions[0]?.preview_url || '/landing/tool-product.png'
      }
      item.versions.unshift(newVersion)
      return item
    }
  }

  // 7. 编辑名称/分类 (PATCH)
  const itemMatch = apiPath.match(/^\/library\/([^/]+)$/)
  if (itemMatch && method === 'PATCH') {
    const id = itemMatch[1]
    const item = inMemoryLibraryItems.find(i => i.id === id)
    try {
      const body = await readBody<{ name?: string; category?: string }>(event)
      if (item && body) {
        if (body.name) item.name = body.name
        if (body.category) item.category = body.category
        return item
      }
    } catch {
      // ignore
    }
    return item || { success: true }
  }

  // 8. 上传素材
  if (apiPath === '/library/upload' && method === 'POST') {
    const newItem: LibraryItem = {
      id: `item-${Date.now()}`,
      name: `新上传素材_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
      scope: 'personal',
      media_type: 'image',
      category: 'other',
      status: 'active',
      created_at: new Date().toISOString(),
      versions: [
        {
          id: `ver-${Date.now()}-1`,
          version_no: 1,
          size_bytes: 1048576,
          mime_type: 'image/png',
          media: { width: 1024, height: 1024 },
          parse_status: 'ready',
          parse_error: '',
          preview_url: '/landing/tool-product.png'
        }
      ]
    }
    inMemoryLibraryItems.unshift(newItem)
    return newItem
  }

  // 9. 保存生成结果 (save-result)
  if (apiPath === '/library/save-result') {
    const item = inMemoryLibraryItems[0]
    return item || { success: true }
  }

  // 10. 列表查询 (/library 或 /library/)
  if (apiPath === '/library' || apiPath === '/library/') {
    const query = getQuery(event)
    const scope = String(query.scope || 'personal')
    const category = String(query.category || '')
    const mediaType = String(query.media_type || '')
    const keyword = String(query.query || '').trim().toLowerCase()
    const archived = String(query.archived) === 'true'
    const page = Math.max(1, Number(query.page || 1))
    const pageSize = 24

    let filtered = inMemoryLibraryItems.filter(item => {
      if (item.scope !== scope) return false
      if (archived) {
        if (item.status !== 'archived') return false
      } else {
        if (item.status === 'archived') return false
      }
      if (category && item.category !== category) return false
      if (mediaType && item.media_type !== mediaType) return false
      if (keyword) {
        const matchName = item.name.toLowerCase().includes(keyword)
        const matchDoc = item.media_type === 'document' && sampleDocumentText.toLowerCase().includes(keyword)
        if (!matchName && !matchDoc) return false
      }
      return true
    })

    const total = filtered.length
    const start = (page - 1) * pageSize
    const pagedItems = filtered.slice(start, start + pageSize)

    return {
      items: pagedItems,
      total,
      page,
      page_size: pageSize
    }
  }

  return { success: false, message: '未匹配的资料库接口' }
}
