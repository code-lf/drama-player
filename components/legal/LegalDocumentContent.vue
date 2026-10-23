<script setup lang="ts">
type LegalContentBlock = {
  type: 'heading' | 'paragraph' | 'ordered-list' | 'unordered-list'
  level?: number
  text?: string
  items?: string[]
}

const props = defineProps<{ content: string }>()

/**
 * 将后台保存的 Markdown 正文解析为受控结构，不使用 v-html，避免后台文本引入脚本。
 * 当前覆盖协议常用的标题、段落、有序列表和无序列表，原始换行仍会保留。
 */
const blocks = computed<LegalContentBlock[]>(() => {
  const lines = String(props.content || '').replace(/\r\n?/g, '\n').split('\n')
  const result: LegalContentBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] || ''
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      result.push({ type: 'heading', level: heading[1]?.length || 2, text: heading[2] || '' })
      index += 1
      continue
    }

    const ordered = trimmed.match(/^\d+[.)、]\s*(.+)$/)
    if (ordered) {
      const items: string[] = []
      while (index < lines.length) {
        const match = (lines[index] || '').trim().match(/^\d+[.)、]\s*(.+)$/)
        if (!match) break
        items.push(match[1] || '')
        index += 1
      }
      result.push({ type: 'ordered-list', items })
      continue
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/)
    if (unordered) {
      const items: string[] = []
      while (index < lines.length) {
        const match = (lines[index] || '').trim().match(/^[-*+]\s+(.+)$/)
        if (!match) break
        items.push(match[1] || '')
        index += 1
      }
      result.push({ type: 'unordered-list', items })
      continue
    }

    const paragraph: string[] = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = (lines[index] || '').trim()
      if (!next || /^(#{1,6})\s+/.test(next) || /^\d+[.)、]\s*/.test(next) || /^[-*+]\s+/.test(next)) break
      paragraph.push(next)
      index += 1
    }
    result.push({ type: 'paragraph', text: paragraph.join('\n') })
  }

  return result
})

// 页面和弹窗外层已经展示协议标题，正文首个一级标题与其重复时不再渲染。
const displayBlocks = computed(() => (
  blocks.value[0]?.type === 'heading' && blocks.value[0]?.level === 1
    ? blocks.value.slice(1)
    : blocks.value
))
</script>

<template>
  <article class="legal-document-content">
    <template v-for="(block, index) in displayBlocks" :key="`${block.type}-${index}`">
      <h1 v-if="block.type === 'heading' && block.level === 1">{{ block.text }}</h1>
      <h2 v-else-if="block.type === 'heading' && block.level === 2">{{ block.text }}</h2>
      <h3 v-else-if="block.type === 'heading'">{{ block.text }}</h3>
      <ol v-else-if="block.type === 'ordered-list'">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
      </ol>
      <ul v-else-if="block.type === 'unordered-list'">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
      </ul>
      <p v-else class="whitespace-pre-line">{{ block.text }}</p>
    </template>
  </article>
</template>

<style scoped>
/* 正文与标题共用页面语义色，深色页面不能继续沿用固定深色文字。 */
.legal-document-content { color: var(--color-text-main); font-size: 14px; line-height: 1.9; }
.legal-document-content h1 { margin: 0 0 20px; font-size: 24px; font-weight: 600; line-height: 1.5; }
.legal-document-content h2 { margin: 26px 0 10px; padding-left: 10px; border-left: 3px solid var(--liv-ui-primary); font-size: 18px; font-weight: 600; line-height: 1.5; }
.legal-document-content h3 { margin: 20px 0 8px; font-size: 16px; font-weight: 600; line-height: 1.5; }
.legal-document-content p { margin: 0 0 12px; }
.legal-document-content ol,
.legal-document-content ul { margin: 0 0 14px; padding-left: 1.5rem; }
.legal-document-content ol { list-style: decimal; }
.legal-document-content ul { list-style: disc; }
.legal-document-content li { margin: 5px 0; padding-left: 4px; }
</style>
