/** 标准 LRC 逐句时间轴；没有真实时间戳时绝不按歌曲时长猜测。 */
export interface TimedLyric {
  start: number
  text: string
}

function seconds(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw)
  const matched = raw.match(/^(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?$/)
  if (!matched) return null
  const fraction = matched[3] ? Number(matched[3]) / 10 ** matched[3].length : 0
  return Number(matched[1]) * 60 + Number(matched[2]) + fraction
}

/** 歌曲原始歌词可带段落标记；下载 TXT 时保留原文，播放器只移除空行。 */
export function plainLyricLines(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean)
}

/** 兼容 [mm:ss.xx]、[mm:ss.xxx] 和单行多个时间标记。 */
export function parseLrc(value: unknown): TimedLyric[] {
  if (typeof value !== 'string') return []
  const lines: TimedLyric[] = []
  for (const raw of value.replace(/\r/g, '').split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = raw.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    if (!text || !stamps.length) continue
    for (const stamp of stamps) {
      const start = seconds(`${stamp[1]}:${stamp[2]}.${stamp[3] || '0'}`)
      if (start !== null) lines.push({ start, text })
    }
  }
  return lines.sort((a, b) => a.start - b.start)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** 对齐接口可能提供逐句或逐词数组；只采纳有明确起点的记录。 */
function parseItems(value: unknown): TimedLyric[] {
  if (!Array.isArray(value)) return []
  const rows: TimedLyric[] = []
  for (const item of value) {
    const record = asRecord(item)
    if (!record) continue
    if (record.success === false) continue
    const start = seconds(record.start_s ?? record.start ?? record.start_time ?? record.startTime ?? record.timestamp ?? record.time ?? record.begin)
    const rawText = record.text ?? record.line ?? record.lyric ?? record.word ?? record.content
    const text = typeof rawText === 'string' ? rawText.trim() : ''
    if (start !== null && text) rows.push({ start, text })
  }
  return rows.sort((a, b) => a.start - b.start)
}

/** 逐词结果按停顿和标点合成可阅读的句子，起点仍取供应商原始时间戳。 */
function groupWords(words: TimedLyric[]): TimedLyric[] {
  const lines: TimedLyric[] = []
  for (const word of words) {
    const previous = lines[lines.length - 1]
    if (!previous || word.start - previous.start > 4 || previous.text.length >= 24 || /[。！？.!?]$/.test(previous.text)) {
      lines.push({ ...word })
    } else {
      const separator = /[\u4e00-\u9fff]/.test(word.text) ? '' : ' '
      previous.text += separator + word.text
    }
  }
  return lines
}

/** ToAPIs 逐词结果的 word 会保留原歌词换行；按换行组句比固定秒数截断更贴近歌词。 */
function parseAlignedWords(value: unknown): TimedLyric[] {
  if (!Array.isArray(value)) return []
  const lines: TimedLyric[] = []
  const fallbackWords: TimedLyric[] = []
  let sawLineBreak = false
  for (const item of value) {
    const record = asRecord(item)
    if (!record || record.success === false || typeof record.word !== 'string') continue
    const start = seconds(record.start_s ?? record.start)
    if (start === null) continue
    const marked = record.word.replace(/\[[^\]]+\]/g, '\n')
    const fragments = marked.replace(/\r/g, '').split('\n')
    if (fragments.length > 1) sawLineBreak = true
    for (let index = 0; index < fragments.length; index++) {
      const text = fragments[index]!.trim()
      if (!text) continue
      fallbackWords.push({ start, text })
      const previous = lines[lines.length - 1]
      if (!previous || (index > 0 && previous.text)) {
        lines.push({ start, text })
      } else {
        const separator = /[A-Za-z0-9]$/.test(previous.text) && /^[A-Za-z0-9]/.test(text) ? ' ' : ''
        previous.text += separator + text
      }
    }
  }
  return sawLineBreak && lines.length > 1 ? lines : groupWords(fallbackWords)
}

/** 仅提取供应商实际给出的时间轴；普通歌词走静态展示。 */
export function timedLyrics(result: unknown): TimedLyric[] {
  const queue: unknown[] = [result]
  const visited = new Set<object>()
  while (queue.length) {
    const value = queue.shift()
    if (typeof value === 'string') {
      const parsed = parseLrc(value)
      if (parsed.length) return parsed
      // 部分供应商把结构化时间轴序列化为字符串，按 JSON 解开后继续检查。
      if (/^[\[{]/.test(value.trim())) {
        try { queue.push(JSON.parse(value)) } catch { /* 普通歌词并非 JSON，继续静态展示。 */ }
      }
      continue
    }
    if (Array.isArray(value)) {
      const parsed = parseItems(value)
      if (parsed.length) return parsed
      queue.push(...value)
      continue
    }
    const record = asRecord(value)
    if (!record || visited.has(record)) continue
    visited.add(record)
    for (const key of ['lines', 'segments', 'sentences', 'aligned_lyrics', 'alignedLyrics']) {
      const parsed = parseItems(record[key])
      if (parsed.length) return parsed
    }
    // ToAPIs 当前返回 result.alignment[]，其中是逐词 start_s/word；合成逐句后再滚动。
    const alignedWords = parseAlignedWords(record.alignment)
    if (alignedWords.length) return alignedWords
    const words = parseItems(record.words)
    if (words.length) return groupWords(words)
    for (const key of ['lrc', 'lyrics', 'text', 'content', 'data', 'result', 'alignment', 'aligned_lyrics', 'alignedLyrics', 'items', 'output']) {
      if (record[key] !== undefined) queue.push(record[key])
    }
  }
  return []
}

/** 导出的 LRC 时间点精确到百分秒，兼容主流播放器。 */
export function toLrc(lines: TimedLyric[], title = ''): string {
  const header = title ? `[ti:${title.replace(/[\r\n\[\]]/g, ' ')}]\n` : ''
  return header + lines.map((line) => {
    const centiseconds = Math.round(line.start * 100)
    const minutes = String(Math.floor(centiseconds / 6000)).padStart(2, '0')
    const secondsPart = String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')
    const fraction = String(centiseconds % 100).padStart(2, '0')
    return `[${minutes}:${secondsPart}.${fraction}]${line.text}`
  }).join('\n') + '\n'
}
