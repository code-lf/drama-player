export interface StylePreset {
  id: string
  name: string
  category: string
  author: string
  heat: number
  preview: string
}

export interface ModelPreset {
  id: string
  name: string
  description: string
  sec: number
}

export interface CameraPreset {
  id: string
  name: string
  lens: string
  focal: string
  aperture: string
}

export const stylePresets: StylePreset[] = [
  { id: 's-1', name: '二次元国风插画', category: '推荐', author: '星空岁月', heat: 758, preview: 'linear-gradient(140deg,#6f3457,#ef89a3)' },
  { id: 's-2', name: 'Seedream 4.5/5.0 官方版', category: '摄影写真', author: '花雨琦', heat: 822, preview: 'linear-gradient(140deg,#2d0f17,#c43a55)' },
  { id: 's-3', name: '梦幻多巴胺治愈插画', category: '平面设计', author: '猫小猫qian', heat: 2100, preview: 'linear-gradient(140deg,#6eb4b0,#ebd88a)' },
  { id: 's-4', name: '猫咪花卉壁纸风格', category: '风格插画', author: '木木木豆', heat: 1500, preview: 'linear-gradient(140deg,#c8a18d,#eccab8)' },
  { id: 's-5', name: 'CG玄幻动态武器', category: '动漫游戏', author: 'uin', heat: 1200, preview: 'linear-gradient(140deg,#1a243d,#1ec9f5)' },
  { id: 's-6', name: '古韵没风格插画', category: '文创周边', author: '星空岁月', heat: 5900, preview: 'linear-gradient(140deg,#586d98,#b7d8ea)' }
]

export const modelPresets: ModelPreset[] = [
  { id: 'm-1', name: 'Doubao-Seedance-1.0-pro-fast', description: '前期推荐：价格友好，质量与速度平衡', sec: 18 },
  { id: 'm-2', name: 'Doubao-Seedance-1.0-lite-t2v', description: '文生视频低成本方案', sec: 15 },
  { id: 'm-3', name: 'Doubao-Seedance-1.0-lite-i2v', description: '图生视频低成本方案', sec: 14 },
  { id: 'm-6', name: 'pixverse/pixverse-v6-t2v', description: '阿里生态视频模型（可切换）', sec: 16 },
  { id: 'm-4', name: 'Qwen-Plus', description: '阿里文本脚本经济款', sec: 8 },
  { id: 'm-5', name: 'wanx2.1-t2i-turbo', description: '阿里图像快速经济款', sec: 12 }
]

// 视频画质改为业务常用档位，便于直接映射供应商参数与成本估算。
export const resolutionPresets = ['360p', '540p', '720p', '1080p']
export const aspectRatioPresets = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']

export const cameraPresets: CameraPreset[] = [
  { id: 'c-1', name: 'Sony Venice', lens: 'Zeiss Ultra Prime', focal: '8mm', aperture: 'f/1.4' },
  { id: 'c-2', name: 'ARRI Alexa', lens: 'Master Prime', focal: '35mm', aperture: 'f/2.0' },
  { id: 'c-3', name: 'RED V-Raptor', lens: 'Cooke Anamorphic', focal: '50mm', aperture: 'f/2.8' }
]
