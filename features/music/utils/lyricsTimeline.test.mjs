import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLrc, timedLyrics, toLrc } from './lyricsTimeline.ts'

test('LRC 时间戳可解析并原样导出逐句歌词', () => {
  const lines = parseLrc('[00:01.25]第一句\n[00:02.500]第二句')
  assert.deepEqual(lines, [{ start: 1.25, text: '第一句' }, { start: 2.5, text: '第二句' }])
  assert.match(toLrc(lines, '歌曲'), /\[00:02\.50\]第二句/)
})

test('对齐接口的嵌套逐句结果使用供应商真实时间点', () => {
  assert.deepEqual(timedLyrics({ result: { data: { alignedLyrics: [
    { startTime: 1.2, text: '第一句' }, { startTime: 4.8, text: '第二句' },
  ] } } }), [{ start: 1.2, text: '第一句' }, { start: 4.8, text: '第二句' }])
})

test('普通歌词没有时间轴时不伪造同步时间点', () => {
  assert.deepEqual(timedLyrics('[Verse]\n一首没有时间戳的歌'), [])
})

test('ToAPIs 逐词 alignment 使用 start_s 合并成可读歌词', () => {
  assert.deepEqual(timedLyrics({ alignment: [
    { start_s: 1.995, end_s: 2.2, success: true, word: '[Verse 1]\n下班' },
    { start_s: 2.25, end_s: 2.6, success: true, word: '挤出' },
    { start_s: 7.1, end_s: 7.5, success: true, word: '\n抬头' },
  ] }), [{ start: 1.995, text: '下班挤出' }, { start: 7.1, text: '抬头' }])
})
