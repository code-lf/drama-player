// 执行真实发送方法的创建/推进片段，防止商品入口再次绕过 Agent 弹出固定问卷。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
const method=source.slice(source.indexOf('async function planDemand('),source.indexOf('/** 用户明确切换技能'))
const body=method.slice(method.indexOf('    const started=await'),method.indexOf('  } catch(cause)'))
const compiled=ts.transpileModule(`async function execute(){${body}\n}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

for(const [entry,skill] of [['commerce','product'],['free','free'],['image','image']]){
  for(const status of ['waiting','ready']){
    test(`${entry}/${skill} 新需求通过 Agent 返回 ${status}，不预建固定问题`,async()=>{
      const calls=[]
      const requestDraft={entry,skill,prompt:'一张窗帘商品详情图',references:[{item_id:'item',version_id:'version',purpose:'商品外观'}],parameters:{extra:{}}}
      const started={id:'run',session_id:'session',draft:requestDraft,status:'planning'}
      const result={...started,status,question:status==='waiting'?{title:'请补充窗帘材质'}:null}
      const deps={requestDraft,requestId:'stable-request',sid:'session',parent:null,options:undefined,sentReferences:requestDraft.references,sourceSelection:null,
        epoch:1,assistantEpoch:1,session:{value:{id:'session'}},parameters:{value:{extra:{}}},explicitSkillBoundary:{value:true},planning:{value:null},prompt:{value:''},
        sameRunScope:(before,current,accepted)=>before===current&&current===accepted,
        acceptStarted:value=>{calls.push(['accept',value]);deps.planning.value=value},
        routerRun:async(...args)=>calls.push(['route',...args]),
        applyAssistantState:value=>calls.push(['apply',value]),setText:()=>assert.fail('不应覆盖新的输入'),
        creationService:{
          startRun:async(...args)=>{calls.push(['start',...args]);return started},
          advanceRun:async id=>{calls.push(['advance',id]);return result},
          beginStage:()=>assert.fail('新商品需求不能直接创建固定阶段问卷'),
          confirm:()=>assert.fail('分析不应提交媒体任务'),
        },
      }
      await new Function(...Object.keys(deps),`${compiled};return execute`)(...Object.values(deps))()
      assert.deepEqual(calls.map(call=>call[0]),['start','accept','route','advance','apply'])
      assert.deepEqual(calls[0][1],requestDraft,'完整原文、参数及素材应原样提交')
      assert.deepEqual(calls[0][8],['version'],'本轮附件身份仍明确传递')
      assert.equal(calls.at(-1)[1],result,'问题或方案必须采用实际 Agent 回包')
    })
  }
}

test('历史阶段问卷仍走原补答恢复分支',()=>{
  assert.match(method,/collection_stage\?\.status==='collecting'.*await sendStageText\(\);return/)
  assert.doesNotMatch(body,/creationService\.beginStage\(/)
})
