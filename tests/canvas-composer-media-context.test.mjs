// 直接运行公共输入器的实际computed与参数锁，不调用目录、生成或计费接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed} from 'vue'
import ts from 'typescript'

const source=readFileSync('features/creation/components/CreationComposer.vue','utf8')
const names=['selectedSkill','baseSkill','isInstrumental','isMusic','isMv','isVideo','parameterLabel']
const declarations=source.split('\n').filter(line=>names.some(name=>new RegExp(`^const ${name}\\s*=`).test(line))||line.startsWith('function isParameterLocked(')).join('\n')
const code=ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const video={id:'custom-marketing-ad',entries:['marketing'],target:'video',base_code:'ad',allowed_parameter_keys:['model','durationSec','resolution','aspectRatio']}

/** 入口筛选模拟真实free壳：营销技能不在聊天菜单，但仍存在于授权目录中。 */
function context(overrides={}){
  const props={entry:'free',skill:video.id,nodeEditor:true,controlsOnly:false,controlsKind:'video',catalog:{skills:[video]},parameters:{model:'grok-video-1.0',output:'video',aspectRatio:'9:16',durationSec:10,resolution:'480p',quality:'medium',extra:{}},...overrides}
  const skillList=computed(()=>props.catalog.skills.filter(skill=>skill.entries.includes(props.entry)))
  return new Function('computed','props','skillList',`${code};return {${names.join(',')},isParameterLocked}`)(computed,props,skillList)
}

test('营销视频节点在free壳中保留原技能约束，参数区显示原10秒而不是图片质量',()=>{
  const ui=context()
  assert.equal(ui.selectedSkill.value.id,video.id)
  assert.equal(ui.isVideo.value,true)
  assert.equal(ui.isMusic.value,false)
  assert.equal(ui.parameterLabel.value,'9:16 · 10s · 480p')
  assert.equal(ui.isParameterLocked('count'),true)
  assert.equal(ui.isParameterLocked('durationSec'),false)
  assert.equal(ui.isParameterLocked('quality'),true)
})

test('历史技能缺失仍以节点媒体类型展示，图片和文本不会借用视频或MV控件',()=>{
  assert.equal(context({catalog:{skills:[]}}).isVideo.value,true)
  for(const controlsKind of ['image','text']){
    const ui=context({controlsKind,skill:'mv-story'})
    assert.equal(ui.isVideo.value,false)
    assert.equal(ui.isMv.value,false)
    assert.equal(ui.isMusic.value,false)
  }
  assert.equal(context({nodeEditor:false,controlsOnly:true}).isVideo.value,true)
})

test('普通聊天仍按当前入口技能判断，切回图片不能继承旧视频时长区',()=>{
  const image={id:'product-image',target:'image',entries:['free']}
  const ui=context({nodeEditor:false,skill:image.id,catalog:{skills:[image]}})
  assert.equal(ui.isVideo.value,false)
  assert.equal(ui.parameterLabel.value,'9:16 · 480p · 中')
  assert.equal(context({nodeEditor:false,skill:'mv-story'}).isMv.value,true)
})
