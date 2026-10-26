// 真实分页方法隔离测试：不读取用户本机文件，不采购、不伪造解析或选定范围。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref as vueRef} from 'vue'
const js=ts.transpileModule(readFileSync('features/library/documentFragment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const {readSelectedDocument}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const ref={item_id:'document',version_id:'fixed',purpose:'reference'}

test('8000字原文完整读两页；偏移按Unicode而非UTF16计数',async()=>{
  const text=Array.from('🌸品牌😀资料'.repeat(1600)),calls=[]
  const read=async(reference,offset)=>{calls.push({reference,offset});return {offset,total_chars:text.length,parse_status:'ready',parse_error:'',text:text.slice(offset,offset+4000).join('')}}
  const result=await readSelectedDocument(ref,3,8003,read)
  assert.equal(result,text.slice(3,8003).join(''));assert.equal(Array.from(result).length,8000)
  assert.deepEqual(calls.map(call=>call.offset),[3,4003]);assert.ok(calls.every(call=>call.reference===ref))
})

test('未解析、读取短页、错误偏移或原文范围变化均拒绝确认',async()=>{
  for(const change of [{parse_status:'failed',parse_error:'解析失败'},{text:'短页'},{offset:3},{total_chars:5}]){
    const read=async()=>({offset:0,total_chars:20,parse_status:'ready',parse_error:'',text:'原'.repeat(20),...change})
    await assert.rejects(readSelectedDocument(ref,0,10,read))
  }
})

test('非法区间不读取任何原文；第二页失败不返回部分成功',async()=>{
  let calls=0
  for(const [start,end] of [[-1,2],[0,8001],[2,1],[0,1.5]])await assert.rejects(readSelectedDocument(ref,start,end,async()=>calls++))
  assert.equal(calls,0)
  await assert.rejects(readSelectedDocument(ref,0,8000,async(_,offset)=>{calls++;if(offset===4000)throw new Error('读取失败');return {offset,total_chars:8000,parse_status:'ready',parse_error:'',text:'原'.repeat(4000)}}))
  assert.equal(calls,2)
})

test('选择器读取失败或范围被修改不接受旧预览，关闭后的迟到响应不回填',async()=>{
  const raw=readFileSync('features/library/components/LibraryPicker.vue','utf8')
  const methods=raw.slice(raw.indexOf('async function previewDocument()'),raw.indexOf('watch(() => props.open'))
  const code=ts.transpileModule(methods,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  for(const outcome of ['success','failed','edited','closed']){
    let finish,reject
    const state={props:{open:true},documentDraft:vueRef({reference:ref,total:9000}),documentStart:vueRef(0),documentEnd:vueRef(8000),documentBusy:vueRef(false),documentPreview:vueRef('旧预览'),previewRange:vueRef('0:8000'),error:vueRef(''),selected:vueRef([]),libraryService:{readDocument:()=>{}},readSelectedDocument:()=>new Promise((resolve,fail)=>{finish=resolve;reject=fail})}
    const ui=new Function('state',`const {${Object.keys(state).join(',')}}=state;let documentRevision=0;${code};return {previewDocument,confirmDocument}`)(state)
    const pending=ui.previewDocument();assert.equal(state.previewRange.value,'');ui.confirmDocument();assert.equal(state.selected.value.length,0)
    if(outcome==='edited')state.documentEnd.value=7000
    if(outcome==='closed')state.props.open=false
    if(outcome==='failed')reject(new Error('读取失败'));else finish('新预览')
    await pending
    assert.equal(state.documentPreview.value,outcome==='success'?'新预览':'旧预览')
    if(outcome!=='success'){ui.confirmDocument();assert.equal(state.selected.value.length,0)}
    else{ui.confirmDocument();assert.equal(state.selected.value[0].reference.end,8000)}
  }
})
