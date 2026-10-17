/** 素材版本编号必须跟随引用提交，不能只保存可能更新的条目编号。 */
export interface LibraryReference { item_id: string; version_id: string; purpose: string; start?: number; end?: number }
export interface LibraryVersion {
  id: string; version_no: number; size_bytes: number; mime_type: string
  media: { width?: number; height?: number; duration_sec?: number }
  parse_status: string; parse_error: string; preview_url: string
}
export interface LibraryItem {
  id: string; name: string; scope: 'personal' | 'public'; media_type: string
  category: string; status: string; versions: LibraryVersion[]; created_at: string
  is_favorite?: boolean; voice_capability?: 'preview_only' | 'reference_audio'
  incompatibilities?: Record<string, string>
}
export interface LibraryCollectionMember { item_id?: string; version_id: string; name?: string; category?: string; media_type?: string; preview_url?: string; available: boolean; reason: string }
export interface LibraryCollection { id: string; name: string; status: string; version_id: string; version_no: number; is_favorite: boolean; versions: Array<{id:string;version_no:number;name:string}>; members: LibraryCollectionMember[] }
export interface LibraryConfiguration {
  categories: Array<{ code: string; name: string }>; max_upload_bytes: number; user_quota_bytes: number
}
export interface LibraryPage { items: LibraryItem[]; total: number; page: number; page_size: number }
export interface LibraryCapabilities { enabled: boolean; image_picker: boolean; video_picker: boolean; drama_picker: boolean }
