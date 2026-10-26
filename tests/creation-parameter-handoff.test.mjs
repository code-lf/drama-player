// 绑定与恢复结构回归不替代浏览器实测；确保后续调整不再重新引入默认规格覆盖。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('未生成媒体的会话也从运行快照恢复参数，云草稿保留显式修改',()=>{
  const workspace=read('features/creation/useCreationWorkspace.ts')
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(workspace.includes('conversationParameters'))
  assert.ok(workspace.includes('latest!.draft.parameters'))
  assert.ok(studio.includes('user_parameter_keys'))
  assert.ok(studio.includes('restoredParameters'))
  assert.ok(studio.includes('quality:selectedParameters.quality'))
})

test('普通助手回复不再继承导演卡片，问题才有表面和独立按钮',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(!studio.includes('class="creation-director-preview creation-assistant-card"'))
  assert.ok(!studio.includes('creation-assistant-card>div:not(.liv-user-message)'))
  assert.ok(studio.includes('class="liv-question-card"'))
  assert.ok(studio.includes('placeholder="自由补充…"'))
  assert.ok(studio.includes('<CreationThinkingIndicator :run="planning"/>'))
})

test('工具浮层使用同一 Nuxt UI 关闭行为，规格统一展示质量等级',()=>{
  const composer=read('features/creation/components/CreationComposer.vue')
  // 禁止的是用户可见的旧标签，不应因中文方法注释提到同名概念而误报。
  const template=composer.slice(composer.indexOf('<template>'),composer.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g,'')
  assert.ok(composer.includes('<UPopover'))
  assert.ok(composer.includes(':reference="popoverAnchor"'))
  assert.ok(!composer.includes('搜索技能'))
  assert.ok(!composer.includes('内置技能'))
  assert.ok(!template.includes('普通聊天'))
  assert.ok(!composer.includes('Enter 发送，Shift+Enter 换行'))
  assert.ok(composer.includes("low:'低',medium:'中',high:'高'"))
  const studio=read('features/creation/components/CreationStudio.vue')
  const product=read('features/product-image/components/ProductImageWorkspacePanel.vue')
  assert.ok(studio.includes("low:'低',medium:'中',high:'高'"))
  assert.ok(product.includes("{ label: '低', value: 'low' }"))
  assert.ok(composer.includes('.is-compact .creation-param .creation-tool-label{display:none!important}'))
  assert.ok(composer.includes('.creation-composer.is-compact .creation-toolbar .creation-param{width:32px!important'))
  assert.ok(composer.includes(':text="`创作参数：${parameterLabel}`"'))
})
