<script lang="ts">
import { defineComponent, h, isVNode, ref, type VNode } from 'vue'
import { USelect } from '#components'

/** 统一封装 Nuxt UI 下拉框，兼容已有 option、v-model 和 change，避免各页面重写业务逻辑。 */
export default defineComponent({
  name: 'LivSelect',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number, Boolean, Array], default: undefined },
    value: { type: [String, Number, Boolean, Array], default: undefined },
    multiple: { type: Boolean, default: false },
    modelModifiers: { type: Object, default: () => ({}) },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, slots, emit }) {
    // 空值也可以作为“全部/请选择”的选项，转换为组件内部专用键，避免 Reka 禁止空字符串。
    const emptyKey = '__liv_empty_option__'
    const localValue = ref<unknown>(undefined)
    function optionText(node: unknown): string {
      if (Array.isArray(node)) return node.map(optionText).join('')
      if (isVNode(node)) return optionText(node.children)
      return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
    }
    function collectOptions(nodes: VNode[], result: Array<{ label: string; value: string; original: unknown; disabled: boolean }> = []) {
      for (const node of nodes) {
        if (node.type === 'option') {
          const label = optionText(node.children), original = node.props?.value ?? label
          result.push({ label, original, value: String(original) || emptyKey, disabled: node.props?.disabled === '' || node.props?.disabled === true })
        } else if (Array.isArray(node.children)) collectOptions(node.children.filter(isVNode), result)
      }
      return result
    }
    return () => {
      // 每次渲染读取插槽，保留动态目录、权限禁用和异步选项更新。
      const items = collectOptions(slots.default?.() || [])
      const current = props.modelValue ?? props.value ?? localValue.value ?? (props.multiple ? [] : '')
      return h(USelect, {
        ...attrs,
        class: ['liv-select', attrs.class],
        items,
        multiple: props.multiple,
        // 浮层沿用 Reka 的键盘与避让能力；传送到 body 后仍应用同一主题。
        color: 'neutral',
        content: { sideOffset: 6, collisionPadding: 12, ...((attrs.content as Record<string, unknown>) || {}) },
        modelValue: props.multiple ? (Array.isArray(current) ? current.map(value => String(value) || emptyKey) : []) : String(current) || emptyKey,
        ui: { base: 'liv-select-trigger', content: 'liv-select-content', viewport: 'liv-select-viewport', item: 'liv-select-item', itemLabel: 'truncate' },
        'onUpdate:modelValue': (key: unknown) => {
          if (props.multiple) {
            const keys = Array.isArray(key) ? key : []
            const values = keys.map(value => items.find(option => option.value === value)?.original ?? value)
            localValue.value = values
            emit('update:modelValue', values)
            emit('change', { target: { selectedOptions: values.map(value => ({ value: String(value) })) } })
            return
          }
          const item = items.find(option => option.value === key)
          let value = item?.original ?? (key === emptyKey ? '' : key)
          if (props.modelModifiers.number && value !== '') value = Number(value)
          localValue.value = value
          emit('update:modelValue', value)
          // 旧页面的 change 处理器只读取 target.value，保持与原生 select 的字符串契约一致。
          emit('change', { target: { value: String(value ?? '') } })
        },
      })
    }
  },
})
</script>
