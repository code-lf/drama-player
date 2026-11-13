import type { DramaProjectDetail } from '~/entities/drama/types'
import type { EpisodeCutTask } from '~/entities/drama/episodeCutTypes'
import type { DramaAssetProfile, DramaAssetWorkspace } from '~/shared/api/types'
import type { StoryboardWorkspace } from '~/entities/storyboard/types'

export type DramaCanvasStep = 'script' | 'setting' | 'storyboard' | 'video'
/** 画布的只读成片追溯扩展独立于原界面合同，尚未接通时不推测来源。 */
type CanvasExport = EpisodeCutTask & {renderSources?: Array<{rowId:string;takeId:string}>}
export interface DramaCanvasCard {
  kind: string
  title: string
  detail: string
  state: string
  step: DramaCanvasStep
  image?: string
  video?: string
  rowId?: string
  /** 只有尚未提交预演且没有视频的真实镜头才能准备确认。 */
  canPrevisualize?: boolean
  /** 设定事实与生成提示词分开展示，不能把模型补充设计冒充剧本原话。 */
  design?: string
  sourceCount?: number
}

/** 只展示后端资产合同中已知的设定字段，不把内部JSON原样打印成用户正文。 */
function assetDetails(profile: DramaAssetProfile) {
  const data = profile.data || {}
  const fields = [['identity', '身份'], ['appearance', '外观'], ['costume', '服装'],
    ['description', '设定'], ['personality', '性格'], ['required_visible_elements', '关键特征']] as const
  const detail = fields.flatMap(([key, label]) => {
    const value = data[key]
    const text = typeof value === 'string' ? value : Array.isArray(value) ? value.filter(item => typeof item === 'string').join('、') : ''
    if (!text) return []
    const origin = data._field_sources?.[key] || data[`${key}_source`]
    const source = origin === 'script' ? '（剧本）' : origin === 'user' ? '（用户确认）' : origin === 'ai_completion' ? '（补充设计）' : ''
    return [`${label}${source}：${text}`]
  }).join('\n')
  const design = typeof data.prompt === 'string' ? data.prompt : typeof data.visual_prompt === 'string' ? data.visual_prompt : ''
  return {detail, design, sourceCount: profile.source_refs?.length || 0}
}

/** 节点和追溯边只投影已读取的项目数据；移动画布不改变剧本、素材或镜头。 */
export function buildDramaCanvas(project: DramaProjectDetail, episode: number, exports: CanvasExport[] = [], assets?: DramaAssetWorkspace, storyboard?: StoryboardWorkspace) {
  const nodes: Array<{id: string; type: 'drama'; position: {x: number; y: number}; data: DramaCanvasCard}> = []
  const edges: Array<{id: string; source: string; target: string}> = []
  const ids = new Set<string>()
  const lanes = [0, 0, 0, 0, 0]
  function add(id: string, lane: number, data: DramaCanvasCard) {
    if (ids.has(id)) return
    ids.add(id)
    const slot = lanes[lane] ?? 0
    lanes[lane] = slot + 1
    // 剧本根节点含真实制作入口，首列预留操作高度，避免覆盖下一张场次卡。
    nodes.push({id, type: 'drama', position: {x: lane * 328, y: slot * 236 + (lane === 0 && slot > 0 ? 100 : 0)}, data})
  }
  function link(source: string, target: string) {
    if (ids.has(source) && ids.has(target) && !edges.some(edge => edge.source === source && edge.target === target)) {
      edges.push({id: JSON.stringify([source, target]), source, target})
    }
  }
  const status = (value: string) => ({
    succeeded: '已完成', success: '已完成', completed: '已完成', done: '已完成', ready: '已就绪',
    queued: '排队中', running: '处理中', generating: '生成中', failed: '失败', blocked: '受阻',
    candidate: '待整理', planned: '待生成', to_confirm: '待确认', locked: '已锁定', stale: '待同步', skipped: '已跳过',
  } as Record<string, string>)[value] || '待制作'
  const analysis = project.analysis
  const root = 'script'
  add(root, 0, {
    kind: '剧本', title: analysis.title || project.title || '短剧项目',
    detail: analysis.episodeDetails.find(item => item.episodeNo === episode)?.content || project.sourceScriptText,
    state: analysis.confirmedScriptVersionId ? '存在已确认版本' : status(project.analysisRun.status),
    step: 'script',
  })
  for (const scene of analysis.scriptScenes.filter(item => item.episodeNo === episode)) {
    if (!scene.sceneId) continue
    const id = `script-scene:${scene.sceneId}`
    add(id, 0, {kind: '剧本场次', title: scene.title || `场次 ${scene.index}`, detail: scene.content,
      state: scene.hasUnpublishedChanges ? '有未发布修改' : '剧本内容', step: 'script'})
    link(root, id)
  }
  // 资产卡片仅使用真实角色/场景/道具及返回的素材，不从剧本文字推测固定关系。
  const assetGroups = [
    ['role', '角色', analysis.roles.map(item => ({key: item.key, name: item.name, detail: item.appearance || item.prompt, asset: item.assets.find(asset => asset.imageUrl)}))],
    ['scene', '场景', analysis.scenes.map(item => ({key: item.key, name: item.name, detail: item.description || item.prompt, asset: item.asset}))],
    ['prop', '道具', analysis.props.map(item => ({key: item.key, name: item.name, detail: item.description || item.prompt, asset: item.asset}))],
  ] as const
  if (assets?.project_id === project.projectId) {
    for (const profile of assets.assets) {
      const label = {role: '角色', scene: '场景', prop: '道具'}[profile.asset_type]
      if (!label || !profile.asset_key) continue
      const version = profile.versions.find(item => item.id === profile.selected_asset_id)
      const id = `asset:${profile.asset_type}:${profile.asset_key}`
      const content = assetDetails(profile)
      add(id, 1, {kind: label, title: profile.name, ...content,
        detail: [version?.meta?.mock ? '开发 Mock 样本，非本次模型生成。' : '', content.detail,
          profile.generation_error_message, profile.stale_reason].filter(Boolean).join('\n'),
        image: version?.image_url, state: status(profile.production_status), step: 'setting', rowId: `${profile.asset_type}:${profile.asset_key}`})
      if (profile.source_script_version === analysis.confirmedScriptVersionId) link(root, id)
    }
  } else for (const [kind, label, items] of assetGroups) for (const item of items) {
    if (!item.key) continue
    const id = `asset:${kind}:${item.key}`
    add(id, 1, {kind: label, title: item.name, detail: item.detail, image: item.asset?.imageUrl,
      state: item.asset?.imageUrl ? '已有素材' : status(item.asset?.status || ''), step: 'setting', rowId: `${kind}:${item.key}`})
  }
  const currentExports = exports.filter(item => item.projectId === project.projectId && item.episodeNo === episode && item.taskType === 'render')
  const rows = (storyboard?.projectId === project.projectId && storyboard.episodeNo === episode ? storyboard.rows : project.storyboards)
    .filter(row => row.episodeNo === episode).sort((a,b) => a.sortIndex - b.sortIndex)
  const sourceNodes = new Map<string, string>()
  const sourceKey = (row: string, take: string) => JSON.stringify([row, take])
  const episodeId = `episode:${episode}`
  if (rows.length) {
    add(episodeId, 2, {kind: '分镜组', title: `第 ${episode} 集分镜`, detail: `${rows.length} 个镜头`, state: '已有分镜', step: 'storyboard'})
    link(root, episodeId)
  }
  const sceneTitles = new Map(analysis.scriptScenes.filter(item => item.episodeNo === episode)
    .map(item => [item.sceneId, item.title || `场次 ${item.index}`]))
  const sceneGroups = new Set<string>()
  for (const row of rows) {
    const shotId = `shot:${row.id}`
    const take = row.takes.find(item => item.id === row.selectedTakeId) || row.takes.find(item => item.isSelected)
    add(shotId, 2, {kind: '分镜', title: `镜头 ${row.shotNo}`,
      detail: [row.sceneDescription || row.actionDesc,
        row.extra?.previsualization_execution_mode === 'mock' ? '开发 Mock 样本，非本次模型生成' : ''].filter(Boolean).join('\n'),
      image: row.previsualizationUrl || take?.posterUrl,
      state: row.previsualizationUrl ? '有预演图' : ['queued','running'].includes(row.previsualizationStatus) ? '预演处理中' : '已有镜头方案',
      canPrevisualize: !row.previsualizationUrl && !row.videoUrl && !['queued','running','succeeded'].includes(row.previsualizationStatus),
      step: 'storyboard', rowId: row.id})
    const sourceScenes = row.sourceSceneIds.filter(id => sceneTitles.has(id))
    if (!sourceScenes.length) link(episodeId, shotId)
    for (const source of sourceScenes) {
      const group = `shot-group:${episode}:${source}`
      if (!sceneGroups.has(group)) {
        sceneGroups.add(group)
        add(group, 2, {kind: '场次分镜组', title: sceneTitles.get(source)!, detail: '', state: '已有分镜', step: 'storyboard'})
        link(episodeId, group)
        link(`script-scene:${source}`, group)
      }
      link(group, shotId)
    }
    for (const [kind, keys] of [['role', row.roleKeys], ['scene', row.sceneKeys], ['prop', row.propKeys]] as const) {
      keys.forEach(key => link(`asset:${kind}:${key}`, shotId))
    }
    // 选中 take 是独立身份；没有选版的旧镜头才读取历史视频字段。
    const requestedTakes = new Set(currentExports.flatMap(task => task.renderSources || [])
      .filter(item => item.rowId === row.id).map(item => item.takeId))
    if (take) requestedTakes.add(take.id)
    else requestedTakes.add('')
    for (const takeId of requestedTakes) {
      const variant = row.takes.find(item => item.id === takeId)
      if (takeId && !variant) continue
      // 新分镜不能用当前投影替换缺失的历史选版。
      if (!variant && take) continue
      const video = variant ? variant.videoUrl : row.videoUrl
      if (!video && !row.videoTaskId && !variant) continue
      const id = `video:${row.id}:${variant?.id || row.videoTaskId || 'legacy'}`
      add(id, 3, {kind: '镜头视频', title: `镜头 ${row.shotNo} 视频${variant?.versionNo ? ` · V${variant.versionNo}` : ''}`,
        detail: [row.videoErrorMessage,variant?.qc?.mock ? '开发 Mock 视频样本，非本次模型生成；未执行剧情一致性质检。' : ''].filter(Boolean).join('\n'),
        image: variant?.posterUrl, video, state: status(variant?.status || row.videoStatus), step: 'storyboard', rowId: row.id})
      sourceNodes.set(sourceKey(row.id, takeId), id)
      link(shotId, id)
    }
  }
  for (const task of currentExports) {
    const id = `render:${task.id}`
    add(id, 4, {kind: '成片', title: `第 ${episode} 集成片`, detail: task.errorMessage,
      video: task.status === 'completed' ? task.outputUrl : undefined, state: status(task.status), step: 'video'})
    for (const source of task.renderSources || []) {
      const nodeId = sourceNodes.get(sourceKey(source.rowId, source.takeId))
      if (nodeId) link(nodeId, id)
    }
  }
  return {nodes, edges}
}
