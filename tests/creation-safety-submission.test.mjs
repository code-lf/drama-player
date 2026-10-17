// 只验证一次确认的授权范围，不访问模型、不创建收费任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/safetySubmission.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {safetySubmissionMatches}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const parameters={model:'configured-image',aspectRatio:'16:9',resolution:'1K',quality:'low',count:1}
const original={credits:30,parameters}
const quote={credits:30,sufficient:true,target:'image',draft:{parameters,references:[]}}

test('原模型规格和真实金额一致时一次确认足够，零积分也合法',()=>{
  assert.equal(safetySubmissionMatches(original,quote),true)
  assert.equal(safetySubmissionMatches({...original,credits:0},{...quote,credits:0}),true)
})
test('金额改变、余额不足、无原金额及跨媒体禁止直接执行',()=>{
  for(const changed of [{credits:31},{credits:29},{sufficient:false},{target:'video'}])assert.equal(safetySubmissionMatches(original,{...quote,...changed}),false)
  for(const credits of [NaN,Infinity,-1])assert.equal(safetySubmissionMatches({...original,credits},quote),false)
})
test('模型和任意技术规格改变、未知规格及新增素材需要重新确认',()=>{
  for(const key of Object.keys(parameters)){
    assert.equal(safetySubmissionMatches(original,{...quote,draft:{...quote.draft,parameters:{...parameters,[key]:'changed'}}}),false)
    assert.equal(safetySubmissionMatches({...original,parameters:{...parameters,[key]:undefined}},quote),false)
  }
  assert.equal(safetySubmissionMatches(original,{...quote,draft:{...quote.draft,references:[{}]}}),false)
})

test('视频建议一次确认严格绑定原媒体和时长，不跨模型降级或改价',()=>{
  const parameters={model:'configured-video',aspectRatio:'16:9',resolution:'480p',quality:'low',count:1,durationSec:6}
  const original={target:'video',credits:108,parameters}
  const quote={target:'video',credits:108,sufficient:true,draft:{parameters,references:[]}}
  assert.equal(safetySubmissionMatches(original,quote),true)
  assert.equal(safetySubmissionMatches(original,{...quote,draft:{parameters:{...parameters,durationSec:4},references:[]}}),false)
  assert.equal(safetySubmissionMatches(original,{...quote,target:'image'}),false)
})
