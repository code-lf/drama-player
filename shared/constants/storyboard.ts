import type { StoryboardRow } from '~/entities/storyboard/types'

export const mockStoryboardRows: StoryboardRow[] = [
  {
    id: 's-1',
    shotNo: 1,
    durationSec: 4,
    sceneDescription: '现代深夜打工人的压抑与疲惫，确立穿越前悲惨基调',
    role: '沈昭昭（现代）',
    shotType: '特写（Close-Up）',
    action: '疲惫地伏案敲击键盘，抬头看向屏幕',
    mood: '极度疲惫、压抑、麻木',
    soundFx: '急促键盘声、手机提示音',
    storyboardPrompt: '[画面构图: 特写，平视机位] [角色: 沈昭昭（现代）]',
    cameraPrompt: '镜头缓慢前推并轻微抖动，突出压迫感'
  },
  {
    id: 's-2',
    shotNo: 2,
    durationSec: 3,
    sceneDescription: '穿越瞬间，视觉断崖式切黑，制造悬念',
    role: '沈昭昭（现代）',
    shotType: '大特写（Extreme Close-Up）',
    action: '头部猛然下坠，双眼闭合',
    mood: '眩晕、失去意识',
    soundFx: '心跳声与耳鸣',
    storyboardPrompt: '[画面构图: 大特写，近距离仰角]',
    cameraPrompt: '镜头快速推进后直接切黑'
  },
  {
    id: 's-3',
    shotNo: 3,
    durationSec: 4,
    sceneDescription: '时空转换，大唐金銮殿与现代办公室叠化',
    role: '沈昭昭（大唐）',
    shotType: '全景（Wide Shot）',
    action: '猛然睁眼，发现自己跪在大殿中央',
    mood: '震惊、错愕',
    soundFx: '宏大殿鼓声、衣袍摩擦声',
    storyboardPrompt: '[画面构图: 全景，高角度俯拍] [场景: 金銮殿]',
    cameraPrompt: '镜头俯拍并缓慢拉近，突出空间压迫'
  },
  {
    id: 's-4',
    shotNo: 4,
    durationSec: 3,
    sceneDescription: '展现朝堂上的危机与逼迫',
    role: '群臣',
    shotType: '中景（Medium Shot）',
    action: '群臣整齐列队，低声议论',
    mood: '紧张、威压',
    soundFx: '朝服摩擦声与低语声',
    storyboardPrompt: '[画面构图: 中景，略带仰角]',
    cameraPrompt: '镜头横移掠过群臣，随后定格主角'
  },
  {
    id: 's-5',
    shotNo: 5,
    durationSec: 4,
    sceneDescription: '主角意识到自己穿越，情绪由错愕转为惊叹',
    role: '沈昭昭（大唐）',
    shotType: '近景（Close-Up）',
    action: '环顾四周，低声自语',
    mood: '惊诧、微颤、清醒',
    soundFx: '周遭环境音渐弱，仅保留呼吸声',
    storyboardPrompt: '[画面构图: 近景，平视镜头]',
    cameraPrompt: '镜头围绕角色半环绕，刻画情绪波动'
  }
]
