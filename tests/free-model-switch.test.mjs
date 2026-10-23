// 执行真实菜单计算和选模方法，不提交创作请求、不生成作品。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref,computed,reactive,watch,nextTick} from 'vue'
const source=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8')
function setup(skill='',entry='free',base){
  const props=reactive({skill,entry,models:[],catalog:{capabilities:{platform:{music:{enabled:true}}},skill_models:{'free:image':[{code:'image-real'}],'free:video':[{code:'video-real'}]},profiles:{}}})
  const selectedSkill=ref(base?{base_code:base}:undefined)
  const baseLine=source.split(/\r?\n/).find(line=>line.startsWith('const baseSkill ='))
  const methods=source.slice(source.indexOf('type ModelKind='),source.indexOf('function open('))
  const code=ts.transpileModule(`const popover=ref('model'),isMusic=ref(false),isVideo=ref(false);\n${baseLine}\n${methods}\nreturn {baseSkill,modelKind,modelGroups,modelListRoot,modelsFor,chooseModel,scrollModelGroup,syncModelGroup}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const events=[]
  const value=new Function('props','selectedSkill','computed','ref','emit','update','watch','nextTick',code)(props,selectedSkill,computed,ref,(...args)=>{events.push(args);if(args[0]==='skill')props.skill=args[1]},patch=>events.push(['parameters',patch]),watch,nextTick)
  return {...value,events}
}
test('空技能自由入口与明确自由技能均可查三类真实候选',()=>{
  for(const skill of ['', 'free']){
    const menu=setup(skill)
    assert.equal(menu.baseSkill.value,'free')
    for(const [kind,code] of [['image','image-real'],['video','video-real'],['music','']]){
      menu.modelKind.value=kind
      assert.equal(menu.modelsFor(kind)[0].code,code)
    }
  }
})
test('单音乐引擎选定后仍可切回图片；归一技能先于参数更新',()=>{
  const menu=setup()
  menu.modelKind.value='music';menu.chooseModel('')
  assert.deepEqual(menu.events,[['skill','free'],['parameters',{model:'',output:'music'}]])
  menu.modelKind.value='image';menu.chooseModel('image-real')
  assert.deepEqual(menu.events.at(-1),['parameters',{model:'image-real',output:'image'}])
})

test('分类连续排列，滚动与 Tab 导航不选模型，最后小分组到底仍能激活',()=>{
  const menu=setup()
  assert.deepEqual(menu.modelGroups.value.map(group=>group.kind),['image','video','music'])
  const sections=['image','video','music'].map((kind,index)=>({offsetTop:index*80,dataset:{modelKind:kind}}))
  const root={scrollTop:0,scrollHeight:240,clientHeight:100,querySelector:selector=>sections.find(section=>selector.includes(section.dataset.modelKind)),querySelectorAll:()=>sections,scrollTo({top}){this.scrollTop=Math.min(140,top)}}
  menu.modelListRoot.value=root
  menu.scrollModelGroup('video');menu.syncModelGroup()
  assert.equal(menu.modelKind.value,'video')
  menu.scrollModelGroup('music');menu.syncModelGroup()
  assert.equal(menu.modelKind.value,'music')
  assert.deepEqual(menu.events,[])
})
test('音乐专项与其他入口不因空值扩大自由创作能力',()=>{
  assert.equal(setup('song','music','song').baseSkill.value,'song')
  assert.equal(setup('','drama').baseSkill.value,'')
})

test('固定能力和不可选模型隐藏入口，自由创作保留跨媒体切换',()=>{
  // 直接执行组件的可见性计算，避免只检查模板字符串而漏掉固定技能分支。
  const line=source.split(/\r?\n/).find(row=>row.startsWith('const showModelSelector ='))
  const evaluate=new Function('computed','isMv','baseSkill','selectedSkill','isMusic','props',`${line};return showModelSelector.value`)
  const visible=(base,strategy,entry,models,music=false,mv=false)=>evaluate(computed,ref(mv),ref(base),ref({model_strategy:strategy}),ref(music),{entry,models:Array(models).fill({})})
  assert.equal(visible('drama','fixed','drama',3),false)
  assert.equal(visible('ad','fixed','commerce',3),false)
  assert.equal(visible('image','inherit','image',1),false)
  assert.equal(visible('image','inherit','image',2),true)
  assert.equal(visible('free','inherit','free',0,true),true)
  assert.equal(visible('mv-story','inherit','music',2,false,true),false)
})
