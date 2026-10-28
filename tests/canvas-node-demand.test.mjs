import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

// 运行真实画布提交方法与API适配表达式；不调用模型、报价或媒体服务。
const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const submit=compile(studio.slice(studio.indexOf('async function generateGraphNode('),studio.indexOf('const allResults=')))

test('历史已连入的未完成或失败文字不能提交为正式要求，完整正文仍可正常使用',async()=>{
  for(const status of ['planning','waiting','failed','cancelled','replied']){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{extra:{}}},error:{value:''},requests:[]}
    const fixture={...state,draft:()=>({prompt:''}),setSkill:()=>{},setText:()=>{},patchParameters:()=>{},confirmHomeAction:async()=>true,planDemand:async value=>state.requests.push(value)}
    const generate=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await generate({id:'draft:image',data:{kind:'image',prompt:'使用上面的文稿'}},[{data:{kind:'text',phase:'planning',status,prompt:'一段尚未完成的文字'}}])
    assert.equal(state.requests.length,status==='replied'?1:0,status)
    if(status!=='replied')assert.ok(state.error.value.includes('尚未整理完成'))
  }
})

test('文档不依赖图片URL，固定片段完整传递；未解析不规划、不丢原稿',async()=>{
  for(const parse of ['ready','queued','failed']){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{extra:{}}},error:{value:''},requests:[],texts:[]}
    const fixture={...state,draft:()=>({prompt:''}),libraryService:{detail:async()=>({id:'doc',name:'品牌手册',media_type:'document',versions:[{id:'v-doc',parse_status:parse,preview_url:'/doc.pdf'}]}),previewUrl:value=>value},setSkill:()=>{},setText:text=>state.texts.push(text),patchParameters:()=>{},confirmHomeAction:async()=>true,planDemand:async options=>state.requests.push(options)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await fn({id:'draft:text',data:{kind:'text',prompt:'按选定资料写文案'}},[{id:'reference:doc',data:{kind:'text',prompt:'',reference:{item_id:'doc',version_id:'v-doc',start:4,end:15,purpose:'reference',media_type:'document'}}}])
    if(parse==='ready'){
      assert.deepEqual(state.requests,[{mode:'chat'}]);assert.equal(state.texts[0],'按选定资料写文案')
      assert.equal(state.references.value[0].start,4);assert.equal(state.references.value[0].end,15);assert.equal(state.references.value[0].media_type,'document')
    }else{assert.equal(state.requests.length,0);assert.equal(state.texts.length,0);assert.ok(state.error.value.includes('文档需解析完成'))}
  }
})

test('文本、图片和视频节点独立固定意图，不继承上一项广告技能或媒体数量',async()=>{
  for(const kind of ['text','image','video']){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[]},roundReferences:{value:[{version_id:'old'}]},explicitSkillBoundary:{value:false},parameters:{value:{count:3,output:'video',extra:{}}},error:{value:''},skills:[],patches:[],requests:[]}
    const fixture={...state,draft:()=>({prompt:state.prompt.value}),libraryService:{},setSkill:code=>state.skills.push(code),confirmHomeAction:async()=>true,setText:text=>state.text=text,patchParameters:patch=>state.patches.push(patch),planDemand:async options=>state.requests.push(options)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await fn({id:'draft:new',data:{kind,prompt:'本次完整要求'}},[{id:'draft:constraint',data:{kind:'text',prompt:'保持商品事实'}}])
    assert.deepEqual(state.skills,['free']);assert.equal(state.patches[0].count,1)
    assert.equal(state.patches[0].output,kind==='text'?'auto':kind)
    assert.deepEqual(state.requests,[{mode:kind==='text'?'chat':'skill'}]);assert.equal(state.patches[0].extra.canvas_node_kind,kind)
    assert.equal(state.text,'保持商品事实\n\n本次完整要求');assert.deepEqual(state.roundReferences.value,[])
  }
})

test('音乐节点使用自身纯音乐选项进入原整理链，拒绝旧授权及不支持的媒体引用',async()=>{
  for(const invalid of [false,true]){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{output:'video',extra:{execution_permit:'old',instrumental:false}}},error:{value:''},requests:[]}
    const fixture={...state,catalog:{value:{capabilities:{platform:{music:{enabled:true}}}}},draft:()=>({prompt:''}),setSkill:()=>{},setText:()=>{},confirmHomeAction:async()=>true,patchParameters:patch=>{state.parameters.value={...state.parameters.value,...patch}},planDemand:async value=>state.requests.push(value)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await fn({id:'draft:music',data:{kind:'audio',prompt:'温暖的钢琴纯音乐',parameters:{style:'钢琴',instrumental:true,vocalGender:''}}},invalid?[{data:{kind:'image'}}]:[])
    if(invalid){assert.equal(state.requests.length,0);assert.match(state.error.value,/暂不支持/);continue}
    assert.deepEqual(state.requests,[{mode:'skill'}]);assert.equal(state.parameters.value.output,'music')
    assert.equal(state.parameters.value.extra.instrumental,true);assert.equal(state.parameters.value.extra.execution_permit,undefined)
    assert.equal(state.parameters.value.style,'钢琴');assert.equal(state.parameters.value.rightsConfirmed,false)
  }
})

test('音乐能力关闭或目录未加载时，不替换原输入、不发起整理',async()=>{
  for(const catalog of [null,{capabilities:{platform:{music:{enabled:false}}}}]){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:'原稿'},catalog:{value:catalog},parameters:{value:{extra:{}}},error:{value:''},requests:[]}
    const fixture={...state,draft:()=>({prompt:state.prompt.value}),planDemand:async value=>state.requests.push(value)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await fn({id:'draft:music',data:{kind:'audio',prompt:'钢琴纯音乐'}},[])
    assert.equal(state.prompt.value,'原稿');assert.deepEqual(state.requests,[]);assert.match(state.error.value,/音乐生成当前不可用/)
  }
})

test('引用准备期间禁止重复提交，改稿/换会话/取消确认不会覆盖新输入或创建运行',async()=>{
  for(const outcome of ['success','draft','session','owner','cancel','confirmation','failed']){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:'用户原草稿'},references:{value:[{version_id:'old'}]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{extra:{}}},error:{value:''},reads:0,patches:[],requests:[],texts:[]}
    let finishRead
    const libraryService={detail:()=>{state.reads++;return new Promise(resolve=>finishRead=resolve)},previewUrl:value=>value}
    const fixture={...state,libraryService,draft:()=>({prompt:state.prompt.value}),setSkill:()=>{},confirmHomeAction:async()=>{if(outcome==='confirmation')state.prompt.value='确认期间的新输入';return outcome!=='cancel'},setText:text=>state.texts.push(text),patchParameters:patch=>state.patches.push(patch),planDemand:async options=>state.requests.push(options)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    const node={id:'draft:image',data:{kind:'image',prompt:'保留商品外观'}},ref={item_id:'i',version_id:'v',purpose:'reference'}
    const inputs=[{id:'reference:v',data:{kind:'image',url:'/product',source:{kind:'reference',id:'v'},reference:ref}}]
    const pending=fn(node,inputs);assert.equal(state.graphPreparing.value,true)
    await fn(node,inputs);assert.equal(state.reads,1)
    if(outcome==='draft')state.prompt.value='准备期间的新输入'
    if(outcome==='session')state.session.value.id='other'
    if(outcome==='owner')state.draftOwner.value='other'
    finishRead({id:'i',name:'商品',versions:outcome==='failed'?[]:[{id:'v',preview_url:'/product'}]});await pending
    assert.equal(state.graphPreparing.value,false)
    assert.equal(state.requests.length,outcome==='success'?1:0)
    if(outcome!=='success'){assert.equal(state.patches.length,0);assert.equal(state.texts.length,0);assert.deepEqual(state.references.value,[{version_id:'old'}])}
    if(outcome==='session'||outcome==='owner'||outcome==='cancel')assert.equal(state.error.value,'')
  }
})

test('同一固定版本重复连入只提交一次；空白文本引用不被静默忽略',async()=>{
  const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{extra:{}}},error:{value:''},requests:[]}
  const fixture={...state,draft:()=>({prompt:''}),libraryService:{detail:async()=>({id:'i',name:'商品',versions:[{id:'v',preview_url:'/product'}]}),previewUrl:value=>value},setSkill:()=>{},confirmHomeAction:async()=>true,setText:()=>{},patchParameters:()=>{},planDemand:async options=>state.requests.push(options)}
  const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
  const node={id:'draft:image',data:{kind:'image',prompt:'保留商品外观'}},ref={item_id:'i',version_id:'v',purpose:'reference'}
  const input={id:'reference:v',data:{kind:'image',url:'/product',source:{kind:'reference',id:'v'},reference:ref}}
  await fn(node,[input,{...input,id:'result:same-file'}]);assert.equal(state.references.value.length,1)
  await fn(node,[{data:{kind:'text',prompt:'   '}}]);assert.equal(state.requests.length,1);assert.ok(state.error.value.includes('文本节点还没有内容'))
})

test('只有画布明确指定文本时使用chat模式，旧客户端技能推断保持兼容',async()=>{
  const source=readFileSync('shared/api/services/creationService.ts','utf8')
  const property=source.split('\n').find(line=>line.trimStart().startsWith('startRun:'))
  const requests=[]
  const api=new Function('request',`${compile(`const api={${property}}`)};return api`)((url,options)=>requests.push({url,options}))
  await api.startRun({skill:'free'},'text-request','same',undefined,null,'chat')
  await api.startRun({skill:'free'},'media-request')
  await api.startRun({skill:''},'legacy-chat')
  assert.deepEqual(requests.map(value=>value.options.body.mode),['chat','skill','chat'])
  assert.ok(requests.every(value=>value.url==='/creation/runs'&&value.options.body.deferred===true))
  assert.ok(studio.includes('creationService.startRun(requestDraft,requestId,sid,undefined,parent,options?.mode)'))
})

test('成片引用只向服务端提交合成任务编号，取得固定视频版本后才进入原核价链',async()=>{
  for(const outcome of ['success','failed','not-video']){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[{version_id:'old'}]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{extra:{}}},error:{value:''},calls:[],requests:[]}
    const fixture={...state,draft:()=>({prompt:''}),libraryService:{saveResult:async(...args)=>{state.calls.push(args);if(outcome==='failed')throw new Error('成片不可访问');return {id:'fixed-item',name:'合成成片',media_type:outcome==='not-video'?'image':'video',versions:[{id:'fixed-version',preview_url:'/fixed-video'}]}},previewUrl:value=>value},setSkill:()=>{},setText:()=>{},patchParameters:()=>{},confirmHomeAction:async()=>true,planDemand:async options=>state.requests.push(options)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await fn({id:'draft:new',data:{kind:'video',prompt:'参考这份成片制作新视频'}},[{id:'draft:compose',data:{kind:'compose',url:'/display-only.mp4',source:{kind:'composition',id:'job-owned'}}}])
    assert.deepEqual(state.calls,[['video_composition','job-owned','','other']])
    assert.equal(state.requests.length,outcome==='success'?1:0);assert.equal(state.graphPreparing.value,false)
    if(outcome==='success'){assert.equal(state.references.value[0].version_id,'fixed-version');assert.equal(state.references.value[0].purpose,'reference_video');assert.equal(state.references.value[0].media_type,'video')}
    else{assert.deepEqual(state.references.value,[{version_id:'old'}]);assert.ok(state.error.value)}
  }
})
