import type { CreationEntryType } from './types'

export interface CreationCase { id: string; title: string; cover: string; description: string; video?: string }
/** 临时静态案例与可应用模板分离；这些案例不会填充提示词或自动启动收费任务。 */
const item = (id: string, title: string, cover: string, description: string): CreationCase => ({ id, title, cover, description })
export const creationCases: Record<CreationEntryType, CreationCase[]> = {
  free: [item('free-photo', '雨夜电影人像', '/creation-presets/portrait-wide.png', '电影摄影风格参考'), item('free-anime', '落日海边小镇', '/creation-presets/anime-wide.png', '二维动画场景参考'), item('free-product', '香氛产品展示', '/creation-presets/perfume.png', '商品摄影参考')],
  drama: [],
  commerce: [item('ad-perfume', '香氛质感广告', '/creation-presets/perfume.png', '光影、材质与商品展示参考'), item('ad-fashion', '电影感穿搭', '/creation-presets/portrait-wide.png', '人物与服装视觉参考')],
  music: [item('music-night', '雨夜钢琴氛围', '/creation-presets/portrait-wide.png', '配乐情绪示例，暂未提供音频'), item('music-sunset', '落日治愈配乐', '/creation-presets/anime-wide.png', '音乐与 MV 视觉参考，暂未提供音频')],
  image: [item('image-portrait', '杂志人像', '/creation-presets/portrait-wide.png', '暖色轮廓光与真实人像'), item('image-anime', '日系治愈场景', '/creation-presets/anime-wide.png', '海边村落与落日'), item('image-commercial', '高级商品摄影', '/creation-presets/perfume.png', '自然光下的通透玻璃质感')],
}
