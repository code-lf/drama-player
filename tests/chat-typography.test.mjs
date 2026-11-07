// 对话及提示共用令牌，避免紧凑布局再次覆盖用户指定字号。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
test('正文与提示统一15px常规字重，提示为指定灰色',()=>{
  const tokens=readFileSync('assets/css/tokens.css','utf8')
  for(const value of ['--liv-chat-font: 15px','--liv-chat-line: 24.7px','--liv-chat-family: "PingFang SC", sans-serif','--liv-chat-weight: 400','--liv-chat-placeholder: #696969'])assert.ok(tokens.includes(value))
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.match(studio,/creation-placeholder\)\{font-family:var\(--liv-chat-family\)!important;font-weight:var\(--liv-chat-weight\)!important;font-size:var\(--liv-chat-font\)!important;line-height:var\(--liv-chat-line\)!important;color:var\(--liv-chat-placeholder\)!important/)
})
