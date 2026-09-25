export interface DramaVisualStyleContract {
  style_id: string
  style_version: number
  display_name: string
  aliases: string[]
  render_medium: string
  character_style: string
  costume_material_style: string
  environment_render_style: string
  camera_language: string
  color_palette: string[]
  lighting: string
  negative_elements: string[]
  runtime_style_prefix: string
}

export interface DramaVisualStyleOption {
  styleId: string
  label: string
  value: string
  description: string
  image: string
}

// 后端不可用时的唯一前端兜底目录；首页和项目页必须共同复用，禁止再维护第二套名称。
export const fallbackDramaVisualStyleOptions: DramaVisualStyleOption[] = [
  { styleId: 'oriental_fantasy_live_action', label: '东方玄幻 · 古装影视写实', value: '东方玄幻 · 古装影视写实', description: '真人古装 · 电影光影', image: '/landing/case-truth.png' },
  { styleId: 'urban_emotion_live_action', label: '都市情感 · 现代影视写实', value: '都市情感 · 现代影视写实', description: '现代真人 · 细腻表演', image: '/landing/case-city.png' },
  { styleId: 'ancient_xianxia_aesthetic', label: '古风仙侠 · 唯美国风', value: '古风仙侠 · 唯美国风', description: '清透柔光 · 诗意留白', image: '/landing/tool-character.png' },
  { styleId: 'anime_japanese_2d', label: '二次元动画 · 日系2D', value: '二次元动画 · 日系2D', description: '二维线稿 · 赛璐璐渲染', image: '/landing/case-youth.png' },
  { styleId: 'guofeng_3d_cg', label: '国风3D · 游戏CG质感', value: '国风3D · 游戏CG质感', description: 'PBR材质 · 电影级CG', image: '/landing/tool-short-drama.png' },
  { styleId: 'mystery_cinematic_live_action', label: '悬疑推理 · 电影悬疑写实', value: '悬疑推理 · 电影悬疑写实', description: '冷色低调光 · 心理压迫', image: '/landing/case-love.png' },
]

export function mapStyleContractsToOptions(contracts: DramaVisualStyleContract[]): DramaVisualStyleOption[] {
  const fallbackById = new Map(fallbackDramaVisualStyleOptions.map(item => [item.styleId, item]))
  return contracts.map((contract) => {
    const fallback = fallbackById.get(contract.style_id)
    return {
      styleId: contract.style_id,
      label: contract.display_name,
      value: contract.display_name,
      description: fallback?.description || contract.render_medium,
      image: fallback?.image || '/landing/case-truth.png',
    }
  })
}

export function findVisualStyleOption(value: string, options = fallbackDramaVisualStyleOptions) {
  return options.find(item => item.styleId === value || item.value === value || item.label === value)
}
