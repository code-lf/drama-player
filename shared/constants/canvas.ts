import type { WorkflowNode, WorkflowNodeType } from '~/entities/canvas/types'

export const nodeTypeOrder: WorkflowNodeType[] = ['text', 'image', 'video', 'videoCompose', 'audio', 'script', 'resource']

export const nodeTypePreset: Record<WorkflowNodeType, { label: string; description: string; icon: string }> = {
  text: { label: '文本', description: '脚本、提示词、品牌文案', icon: 'T' },
  image: { label: '图片', description: '角色图/场景图生成与编辑', icon: 'P' },
  video: { label: '视频', description: '图生视频/文生视频', icon: 'V' },
  videoCompose: { label: '视频合成', description: '拼接片段并导出成片', icon: 'M' },
  audio: { label: '音频', description: '配音、配乐、音效', icon: 'A' },
  resource: { label: '添加资源', description: '上传素材、图库选择', icon: 'R' },
  script: { label: '脚本', description: '结构化分镜脚本整理', icon: 'S' },
  storyboard: { label: '分镜', description: '表格视图与创意视图', icon: 'B' }
}

// 默认示例节点：用于首屏演示画布能力
export const defaultNodes: WorkflowNode[] = [
  {
    id: 'node-script',
    type: 'script',
    position: { x: 100, y: 110 },
    nodeMeta: { label: '脚本节点', description: '根据输入主题生成剧情脚本', icon: 'S' },
    nodeConfig: { title: '脚本生成器', model: 'Qwen-Max', prompt: '', duration: 60, scriptGenerated: false },
    ioPorts: [
      { id: 'script-in', name: '输入', direction: 'input' },
      { id: 'script-out', name: '输出', direction: 'output' }
    ],
    runtimeState: { status: 'idle' },
    outputRefs: []
  },
  {
    id: 'node-text-2',
    type: 'text',
    position: { x: 100, y: 460 },
    nodeMeta: { label: '文本节点', description: '可继续拆分脚本并生成提示词', icon: 'T' },
    nodeConfig: { title: '文本节点 2', model: 'Qwen-Plus' },
    ioPorts: [
      { id: 'text-2-in', name: '输入', direction: 'input' },
      { id: 'text-2-out', name: '输出', direction: 'output' }
    ],
    runtimeState: { status: 'idle' },
    outputRefs: []
  },
  {
    id: 'node-text-3',
    type: 'text',
    position: { x: 500, y: 540 },
    nodeMeta: { label: '文本节点', description: '用于生成多版本提示词', icon: 'T' },
    nodeConfig: { title: '文本节点 3', model: 'Qwen-Plus' },
    ioPorts: [
      { id: 'text-3-in', name: '输入', direction: 'input' },
      { id: 'text-3-out', name: '输出', direction: 'output' }
    ],
    runtimeState: { status: 'idle' },
    outputRefs: []
  },
  {
    id: 'node-audio',
    type: 'audio',
    position: { x: 1030, y: 470 },
    nodeMeta: { label: '音频节点', description: '为脚本匹配配乐和音效', icon: 'A' },
    nodeConfig: { title: '音频生成', model: 'Qwen-Omni' },
    ioPorts: [
      { id: 'audio-in', name: '输入', direction: 'input' },
      { id: 'audio-out', name: '输出', direction: 'output' }
    ],
    runtimeState: { status: 'idle' },
    outputRefs: []
  }
]
