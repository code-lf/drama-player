import { request } from '~/shared/api/adapters/httpAdapter'

export interface MusicField { label: string; kind: string; required: boolean; options?: string[]; min_items?: number; max_items?: number }
export interface MusicOperation {
  operation: string; label: string; group: string; supplier_usd: string
  fields: Record<string, MusicField>; max_supported: boolean; legacy: boolean
  rights_required: boolean; enabled: boolean; retail_credits: number
}
export interface MusicQuote {
  operation: string; label: string; retail_credits: number
  supplier_estimate_usd: number; expires_at: number; quote: Record<string, unknown>; signature: string
}
export interface MusicTask {
  /** 退款以已确认流水为准，不根据 failed 状态推测。 */
  refunded?: boolean
  id: string; operation: string; label: string; status: string; progress: number
  provider_task_id: string; input: Record<string, unknown>; result: Record<string, unknown>
  retail_credits: number; provider_cost_usd: number | null
  error_code: string; error_message: string; created_at: string
}

/** 分享接口只投影最终作品，不包含任务输入、账号、费用或素材引用。 */
export interface PublicMusicSong {title:string;audio_url:string;cover:string;lyrics:string;alignment:unknown;style:string}
export interface MusicShareState {enabled:boolean;token:string}

/** 音乐创作仍走统一认证与错误适配；页面不拼供应商地址或提交密钥。 */
export const musicService = {
  catalog: () => request<MusicOperation[]>('/music/catalog'),
  quote: (operation: string, inputs: Record<string, unknown>, rights_confirmed: boolean) =>
    request<MusicQuote>('/music/quote', { method: 'POST', body: { operation, inputs, rights_confirmed } }),
  create: (operation: string, inputs: Record<string, unknown>, rights_confirmed: boolean, request_id: string, quote: MusicQuote) =>
    request<MusicTask>('/music/tasks', { method: 'POST', body: { operation, inputs, rights_confirmed, request_id, quote: quote.quote, signature: quote.signature } }),
  // 播放器最多查询近期 100 项本人任务，以找到对应曲目的歌词时间轴任务。
  tasks: (limit = 30) => request<MusicTask[]>(`/music/tasks?limit=${Math.min(Math.max(limit, 1), 100)}`),
  task: (id: string) => request<MusicTask>(`/music/tasks/${id}`),
  shareState: (id:string,track:number) => request<MusicShareState>(`/music/tasks/${id}/share`,{query:{track}}),
  // 明确点击公开分享即确认公开范围；兼容旧服务字段，不代表商业使用授权。
  enableShare: (id:string,track:number) => request<MusicShareState>(`/music/tasks/${id}/share`,{method:'POST',body:{track,public_confirmed:true,rights_confirmed:true}}),
  disableShare: (id:string,track:number) => request<MusicShareState>(`/music/tasks/${id}/share`,{method:'DELETE',query:{track}}),
  // 旧歌曲首次进入播放器时补建内含时间轴；后台按固定任务编号去重，不会再次扣点。
  ensureLyrics: (id: string) => request<MusicTask>(`/music/tasks/${id}/lyrics/ensure`, { method: 'POST' }),
}
