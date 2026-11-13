// 直接验证共享输入器的真实素材标签方法，固定版本与显示名称分离。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed,ref,reactive,watch,nextTick} from 'vue'
const source=readFileSync('features/creation/components/CreationComposer.vue','utf8')
const body=source.match(/function referenceNode\([\s\S]*?\n}\n/)[0]
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.ownText=''}
  append(child){this.children.push(child)}
  set textContent(value){this.ownText=value}
  get textContent(){return this.ownText+this.children.map(child=>child.textContent).join('')}
  querySelector(tag){return this.children.find(child=>child.tag===tag)}
  prepend(child){this.children.unshift(child)}
}
test('素材标签显示真实小图和名称，不显示@，身份仍为固定版本',()=>{
  const props={references:[{version_id:'fixed-v1',name:'产品主图',media_type:'image',preview_url:'/private-preview.png'}]}
  const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const create=new Function('props','document','updateChipPreview','showInlineReferencePreview',js+';return referenceNode')(props,{createElement:tag=>new Element(tag)},(chip,item)=>{const image=new Element('img');image.src=item.preview_url;chip.prepend(image)},()=>{})
  const chip=create('fixed-v1','@产品主图')
  assert.equal(chip.dataset.reference,'fixed-v1');assert.equal(chip.textContent,'产品主图')
  assert.equal(chip.children[0].tag,'img');assert.equal(chip.children[0].src,'/private-preview.png')
})
test('内联引用不在顶部重复展示，黄色标签悬停和键盘聚焦可看原图',()=>{
  assert.ok(source.includes('nodeEditor||!inlineReferenceIds.has(reference.version_id)'))
  assert.ok(source.includes('chip.onmouseenter=()=>showInlineReferencePreview(chip,item)'))
  assert.ok(source.includes('chip.onfocus=()=>showInlineReferencePreview(chip,item)'))
  assert.ok(source.includes('rect.top-height-8'))
  const css=readFileSync('assets/css/creation.css','utf8')
  assert.ok(css.includes('color:var(--liv-reference-tag-text)'))
})
test('正文缩略图与附件共享预览恢复，不用坏地址重建正文或改写引用',()=>{
  assert.ok(source.includes('referencePreview.url(item)'))
  assert.ok(source.includes('await referencePreview.failed(item)'))
  assert.ok(source.includes('if(chip.isConnected&&props.references.some'))
  assert.ok(source.includes("{flush:'post'}"))
})
test('资产大面板点击即加入，没有多选确认条，风格入口仍保留',()=>{
  assert.ok(source.includes('aria-label="选择资产"'));assert.ok(source.includes('compact selectable immediate'))
  assert.ok(source.includes('@select="chooseAsset"'));assert.ok(source.includes('aria-label="选择风格"'))
  assert.ok(source.includes('v-if="showParameterControl"'))
  assert.ok(source.includes("if(!props.parameters.model)return false"))
  const library=readFileSync('features/library/components/AssetLibraryPanel.vue','utf8')
  assert.ok(library.includes('v-if="selectable&&!immediate&&!canvasPlacement"'))
})

test('资产面板与资料选择器按需加载，首次以打开状态挂载仍初始化目录',async()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const picker=readFileSync('features/library/components/LibraryPicker.vue','utf8')
  assert.match(source,/AssetLibraryPanel=defineWorkspaceComponent\(\(\)=>import/)
  assert.match(source,/<AssetLibraryPanel v-if="assetsOpen"/)
  assert.match(studio,/LibraryPicker=defineWorkspaceComponent\(\(\)=>import/)
  assert.match(studio,/<LibraryPicker v-if="pickerMounted"/)
  assert.match(studio,/<LibraryPicker v-if="stagePickerMounted"/)
  const body=picker.slice(picker.indexOf('watch(() => props.open'),picker.indexOf('watch([scope, category, mediaFilter]'))
  const props=reactive({open:true,initialCategory:'product',homepage:false})
  const state={selected:ref(['old']),page:ref(4),category:ref(''),documentDraft:ref(null),documentBusy:ref(false),error:ref(''),categories:ref([])}
  let loads=0
  // 执行选择器实际 watcher，覆盖异步组件首屏已打开而非先挂载再打开的时序。
  const run=new Function('watch','props','state','libraryService','load',`let documentRevision=0;const {selected,page,category,documentDraft,documentBusy,error,categories}=state;${body}`)
  run(watch,props,state,{configuration:async()=>({categories:[{code:'product'}]})},async()=>{loads++})
  await nextTick();await Promise.resolve()
  assert.equal(loads,1);assert.equal(state.category.value,'product');assert.deepEqual(state.selected.value,[])
})

test('资产入口沿用其他工具的紧凑图标与宽布局文字规则',()=>{
  // 检查实际按钮挂接公共响应式类，避免新增入口再次绕过容器宽度规则。
  assert.match(source,/class="creation-tool creation-icon-tool creation-assets-trigger"/)
  assert.match(source,/<span class="creation-tool-label">资产<\/span>/)
  assert.match(source,/\.is-compact \.creation-icon-tool \.creation-tool-label\{display:none\}/)
  assert.match(source,/@container creation-composer \(min-width:640px\)/)
})
test('无模型、固定纯音乐与无可编辑项不展示参数图标，真实视频规格仍可配置',()=>{
  const snippet=source.match(/const showParameterControl=computed\(\(\)=>\{[\s\S]*?\n}\)/)[0]
  const evaluate=(overrides={})=>{
    const setup={props:{parameters:{model:'real'},ratios:['16:9'],resolutions:['480p'],qualities:[],durationRange:{min:4,max:4}},mv:false,music:false,base:'free',video:true,image:false,locked:true,...overrides}
    const run=new Function('computed','props','isMv','isMusic','baseSkill','isVideo','isImage','isParameterLocked',snippet+';return showParameterControl.value')
    return run(computed,setup.props,ref(setup.mv),ref(setup.music),ref(setup.base),ref(setup.video),ref(setup.image),()=>setup.locked)
  }
  assert.equal(evaluate(),false)
  assert.equal(evaluate({music:true,base:'instrumental'}),false)
  assert.equal(evaluate({props:{parameters:{model:''}}}),false)
  assert.equal(evaluate({locked:false}),true)
})
