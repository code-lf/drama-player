import { defineStore } from 'pinia'

export type StoryboardArrangeMode = 'grid' | 'horizontal' | 'vertical'
export type ScriptWorkMode = 'rewrite' | 'storyboard'
export type ScriptInputMode = 'plot' | 'videoRef' | 'roleRef'

interface StoryboardStudioState {
  // 脚本节点当前工作模式：重新生成脚本 或 生成分镜
  scriptWorkMode: ScriptWorkMode
  // 脚本节点输入模式：剧本、视频参考、角色参考
  scriptInputMode: ScriptInputMode
  // 是否已经执行过“生成分镜”，用于控制创意视图工具条显示
  hasGeneratedStoryboard: boolean
  // 创意视图排列方式
  arrangeMode: StoryboardArrangeMode
  // 生成分镜参数
  styleName: string
  modelName: string
  // 视频供应商：首期默认字节，后续可切阿里视频。
  videoProvider: 'bytedance' | 'alibaba'
  // 视频画质档位：前期默认最低画质压缩成本。
  videoResolution: '360p' | '540p' | '720p' | '1080p'
  resolution: string
  cameraPreset: string
  selectedShotIds: string[]
  // 当前分镜总数，用于显示“已选镜头 x/x”
  totalShotCount: number
  // 脚本重生输入
  rewritePrompt: string
}

export const useStoryboardStudioStore = defineStore('storyboard-studio', {
  state: (): StoryboardStudioState => ({
    scriptWorkMode: 'rewrite',
    scriptInputMode: 'plot',
    hasGeneratedStoryboard: false,
    arrangeMode: 'grid',
    styleName: '默认风格',
    // 前期默认切到性价比模型，先压低单位成本再做质量迭代。
    modelName: 'Doubao-Seedance-1.0-pro-fast',
    videoProvider: 'bytedance',
    videoResolution: '360p',
    resolution: '360p',
    cameraPreset: '基础镜头',
    selectedShotIds: [],
    totalShotCount: 0,
    rewritePrompt: ''
  }),

  getters: {
    selectedShotCount: (state) => state.selectedShotIds.length
  },

  actions: {
    switchWorkMode(mode: ScriptWorkMode) {
      this.scriptWorkMode = mode
    },

    switchScriptInputMode(mode: ScriptInputMode) {
      this.scriptInputMode = mode
    },

    setRewritePrompt(prompt: string) {
      this.rewritePrompt = prompt
    },

    setStyleName(style: string) {
      this.styleName = style
    },

    setModelName(model: string) {
      this.modelName = model
    },

    setVideoProvider(provider: 'bytedance' | 'alibaba') {
      this.videoProvider = provider
    },

    setVideoResolution(resolution: '360p' | '540p' | '720p' | '1080p') {
      this.videoResolution = resolution
      this.resolution = resolution
    },

    setResolution(resolution: string) {
      this.resolution = resolution
    },

    setCameraPreset(preset: string) {
      this.cameraPreset = preset
    },

    setTotalShotCount(total: number) {
      this.totalShotCount = Math.max(0, total)
    },

    setArrangeMode(mode: StoryboardArrangeMode) {
      this.arrangeMode = mode
    },

    replaceSelectedShots(shotIds: string[]) {
      this.selectedShotIds = [...shotIds]
    },

    toggleShotSelection(shotId: string) {
      const exists = this.selectedShotIds.includes(shotId)

      if (exists) {
        this.selectedShotIds = this.selectedShotIds.filter((id) => id !== shotId)
        return
      }

      this.selectedShotIds.push(shotId)
    },

    markStoryboardGenerated() {
      this.hasGeneratedStoryboard = true
    }
  }
})
