import type { StoryboardRow } from '~/entities/storyboard/types'

const CACHE_KEY = 'livliv-storyboard-cache'

type StoryboardCacheRecord = Record<string, StoryboardRow[]>

function readCacheRecord(): StoryboardCacheRecord {
  if (!import.meta.client) return {}

  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StoryboardCacheRecord
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 分镜缓存读取失败', error)
    return {}
  }
}

function writeCacheRecord(record: StoryboardCacheRecord): void {
  if (!import.meta.client) return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(record))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 分镜缓存写入失败', error)
  }
}

export function getStoryboardCache(projectId: string): StoryboardRow[] {
  const record = readCacheRecord()
  return record[projectId] ?? []
}

export function setStoryboardCache(projectId: string, rows: StoryboardRow[]): void {
  const record = readCacheRecord()
  record[projectId] = rows
  writeCacheRecord(record)
}
