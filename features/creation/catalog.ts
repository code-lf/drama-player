import type { CreationEntryType, CreationParameterState, CreationTemplate } from './types'

/** 只维护产品入口和创作预设，模型、价格及素材限制由服务器能力目录提供。 */
export const creationEntries: Array<{ id: CreationEntryType; label: string; title: string; description: string; icon: string }> = [
  { id: 'free', label: '自由创作', title: '让想法开始生长', description: '说出你的想法，图片与视频可以在这里接着创作。', icon: 'i-lucide-sparkles' },
  { id: 'drama', label: '短剧', title: '从剧本开始，完成你的短剧', description: '上传剧本文件，进入剧本、角色、场景、分镜与成片流程。', icon: 'i-lucide-clapperboard' },
  { id: 'commerce', label: '电商·广告', title: '让你的商品成为主角', description: '商品图、海报、展示视频与广告短片，一处开始。', icon: 'i-lucide-shopping-bag' },
  { id: 'music', label: '音乐·MV', title: '为灵感写一首歌', description: '创作歌曲与纯音乐，从歌词剧本、分镜制作 MV，也可制作歌词视频。', icon: 'i-lucide-audio-lines' },
  { id: 'image', label: '图片创作', title: '把心中的画面带到眼前', description: '描述画面、上传原图，生成或修改，再继续转为视频。', icon: 'i-lucide-image' },
]
export const defaultSkills: Record<CreationEntryType, string> = { free: '', drama: 'director', commerce: '', music: '', image: '' }
/** 轻量视觉预设只传描述，不冒充后台短剧风格编号。 */
export const localVisualStyles = [
  // 原创 3D 喜剧封面只作风格预览，选择后传递文字指导，不自动引用为用户素材。
  { style_id: 'local-cartoon-comedy-3d', display_name: '3D 卡通喜剧', render_medium: '3D', runtime_style_prefix: '高品质三维卡通动画，圆润可爱的角色造型，夸张灵动的喜剧表情与动作，鲜艳明快配色，柔和全局光照，暖色电影光影，细腻风格化材质，清晰轮廓与简洁构图；保持用户指定主体与场景，不自动添加封面角色', cover_url: '/creation-presets/cartoon-comedy-3d-v2.png' },
  { style_id: 'local-commercial', display_name: '商业摄影', render_medium: '写实', runtime_style_prefix: '精致商业摄影，真实材质，干净布光', cover_url: '/creation-presets/perfume.png' },
  { style_id: 'local-cinema', display_name: '电影人像', render_medium: '写实', runtime_style_prefix: '电影级人像摄影，柔和侧光，自然皮肤纹理', cover_url: '/creation-presets/portrait.png' },
  { style_id: 'local-healing', display_name: '日系治愈', render_medium: '2D', runtime_style_prefix: '细腻二维动画，柔和蓝橙色，温暖治愈氛围', cover_url: '/creation-presets/anime.png' },
]
export function defaultParameters(): CreationParameterState {
  return { model: '', style: '', styleId: '', aspectRatio: '16:9', durationSec: 10, resolution: '720p', count: 1,
    quality: 'medium', output: 'auto', workflow: 'direct', templateId: '', selectedTemplateId: '', musicMode: 'create', musicOperation: 'generation',
    sourceTask: '', audioIndex: 0, customLyrics: false, rightsConfirmed: false, sourceUrl: '', extra: {} }
}
export const skillExamples: Record<string, string> = {
  free: '为这款香水制作一段 10 秒的广告短片，暖色自然光，突出瓶身细节和清新的使用感受。',
  product: '生成一张香水商品主图，保留瓶身与品牌细节，柔和自然光，背景简洁。',
  poster: '为新品香水制作宣传海报，标题「让夏天有自己的气味」，突出清爽与轻盈。',
  showcase: '让商品缓慢旋转，镜头从整体推进到材质细节，背景干净，节奏自然。',
  ad: '为这款商品做一段广告，先展示使用场景，再突出核心卖点，最后以商品特写结束。',
  story: '一位女孩在雨后街角发现一封旧信，镜头缓慢推进，温暖而有故事感。',
  image: '一间窗边咖啡馆，午后阳光落在木桌上，电影感构图，柔和暖色。',
  edit: '保留原图主体，把背景换成自然光下的简洁室内空间，保持细节和比例。',
  song: '写一首温柔的中文流行歌曲，关于重逢，钢琴与弦乐，轻柔女声。',
  instrumental: '一段适合商品广告的纯音乐，轻快明亮，电子节拍与吉他，不要人声。',
  reference: '参考上传音频的节奏与氛围，创作新的音乐。',
  remix: '把这首歌曲改成温暖的原声吉他风格，保留情绪。',
}
/** 常见描述转换成可点击替换的字段，模板只填内容，不触发生成。 */
const preset = (id: string, name: string, category: string, skill: string, prompt: string, cover: string): CreationTemplate => ({ id, name, category, skill,
  prompt: prompt.replace(/香水|商品|一位女孩|一位人物|咖啡馆|温暖|自然光|钢琴|吉他/g, value => `{{${/香水|商品/.test(value) ? '商品' : /一位/.test(value) ? '人物' : /光/.test(value) ? '灯光' : /钢琴|吉他/.test(value) ? '乐器' : '描述'}:${value}}}`), cover })
// 推荐模板使用站内既有封面；选择模板只填参数，绝不会开始收费任务。
export const systemTemplates: Record<CreationEntryType, CreationTemplate[]> = {
  free: [
    preset('free-photo', '电影感画面', '图片', 'image', skillExamples.image!, '/landing/case-city.png'),
    preset('free-motion', '图片动起来', '视频', 'showcase', skillExamples.showcase!, '/landing/tool-product.png'),
    preset('free-ad', '商品广告', '广告', 'ad', skillExamples.ad!, '/landing/tool-product.png'),
    preset('free-story', '故事短片', '视频', 'story', skillExamples.story!, '/landing/case-youth.png'),
    preset('free-music', '短片配乐', '音乐', 'instrumental', skillExamples.instrumental!, '/landing/tool-idea.jpeg'),
    preset('free-edit', '换个背景', '图片', 'edit', skillExamples.edit!, '/landing/tool-character.png'),
  ],
  drama: [
    preset('drama-suspense', '悬疑短剧', '短剧', 'director', '', '/landing/case-city.png'),
    preset('drama-city', '都市情感', '短剧', 'director', '', '/landing/case-city.png'),
    preset('drama-fantasy', '古风故事', '短剧', 'director', '', '/landing/case-truth.png'),
  ],
  commerce: [
    preset('commerce-product', '商品主图', '商品图', 'product', skillExamples.product!, '/landing/tool-product.png'),
    preset('commerce-poster', '新品海报', '海报', 'poster', skillExamples.poster!, '/landing/tool-product.png'),
    preset('commerce-video', '通用商品展示', '展示视频', 'showcase', skillExamples.showcase!, '/landing/tool-product.png'),
    preset('commerce-beauty', '美妆个护', '广告', 'ad', '为美妆产品制作自然真实的使用场景广告，避免夸张功效。', '/landing/tool-product.png'),
    preset('commerce-fashion', '服装穿搭', '展示视频', 'showcase', '保留服装的版型与材质，在自然光下展示穿搭效果。', '/landing/tool-character.png'),
    preset('commerce-food', '食品饮料', '广告', 'ad', '用清新明亮的光线展示食品与饮料，突出真实质感。', '/landing/tool-product.png'),
    preset('commerce-luxury', '香氛质感大片', '商品图', 'product', '为{{商品:香水}}生成广告主图，{{场景:浅色石材与白色花朵}}，{{灯光:午后暖光}}，突出{{卖点:通透瓶身与高级质感}}，不添加未经提供的商标。', '/creation-presets/perfume.png'),
    preset('commerce-skincare', '护肤新品海报', '海报', 'poster', '为{{商品:护肤精华}}设计宣传海报，标题「{{标题:让肌肤遇见好状态}}」，{{背景:柔和水波与浅色渐变}}，保留真实包装，不夸大功效。', '/landing/tool-product.png'),
    preset('commerce-coffee', '饮品氛围主图', '商品图', 'product', '{{商品:冰咖啡}}置于{{场景:窗边木桌}}，{{灯光:清晨侧光}}，细节清晰，突出{{卖点:清爽与真实口感}}。', '/landing/case-city.png'),
    preset('commerce-launch', '新品发布短片', '广告', 'ad', '制作{{商品:智能耳机}}的新品广告，{{场景:极简摄影棚}}，先展示整体再推进细节，以{{结束画面:商品特写}}结束，不虚构功能。', '/landing/tool-product.png'),
  ],
  music: [
    preset('music-pop', '流行写歌', '歌曲', 'song', skillExamples.song!, '/landing/case-youth.png'),
    preset('music-bgm', '纯音乐配乐', '配乐', 'instrumental', skillExamples.instrumental!, '/landing/tool-idea.jpeg'),
    preset('music-ad', '轻快广告配乐', '配乐', 'instrumental', '轻快明亮的广告纯音乐，清晰节奏，适合商品展示。', '/landing/tool-product.png'),
    preset('music-mood', '情绪氛围', '配乐', 'instrumental', '安静舒缓的钢琴纯音乐，适合夜晚读书与雨景。', '/landing/case-city.png'),
    preset('music-reference', '参考音频创作', '参考', 'reference', '', '/landing/tool-idea.jpeg'),
    preset('music-lyrics', '歌词视频', 'MV', 'lyric-video', '', '/landing/case-youth.png'),
  ],
  image: [
    preset('image-portrait', '电影人像', '人像', 'image', '一位人物站在窗边，柔和侧光，电影感人像。', '/landing/tool-character.png'),
    preset('image-scene', '场景设计', '场景', 'image', skillExamples.image!, '/landing/case-city.png'),
    preset('image-social', '社媒配图', '配图', 'image', '创作一张清新简洁的生活方式配图，明亮自然光。', '/landing/case-youth.png'),
    preset('image-fantasy', '古风意境', '风格', 'image', '古风山水场景，云雾与远山，细腻柔和的光影。', '/landing/case-truth.png'),
    preset('image-edit', '图片修改', '修改', 'edit', skillExamples.edit!, '/landing/tool-character.png'),
    preset('image-detail', '细节优化', '修改', 'edit', '保留原图主体和构图，优化光线与细节，保持真实质感。', '/landing/tool-product.png'),
    preset('image-editorial', '杂志人像', '人像', 'image', '{{人物:一位成年女性}}，{{服装:简洁黑色外套}}，{{灯光:柔和侧光}}，{{背景:深灰摄影棚}}，自然皮肤纹理，杂志摄影。', '/creation-presets/portrait-wide.png'),
    preset('image-anime', '日系治愈', '风格', 'image', '{{主体:少年站在海边}}，{{时段:夏日傍晚}}，{{色调:温暖蓝橙色}}，细腻二维动画风格，干净构图。', '/creation-presets/anime-wide.png'),
    preset('image-city', '城市电影感', '场景', 'image', '{{场景:雨后的城市街道}}，{{时段:蓝调夜晚}}，{{灯光:霓虹倒影}}，电影感广角镜头，真实环境细节。', '/landing/case-city.png'),
    preset('image-background', '一键换背景', '修改', 'edit', '保留上传图片的主体、材质和比例，背景换成{{背景:窗边简约室内}}，灯光为{{灯光:柔和自然光}}，不要改变人物身份或商品文字。', '/landing/tool-character.png'),
  ],
}
