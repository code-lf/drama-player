import type { Ref } from 'vue'

interface ActionDialogRequest {
  title: string
  message: string
  input: boolean
  initialValue: string
}

// 确认请求只发生在客户端；队列串行展示，避免两个异步操作互相覆盖确认结果。
let pendingResolution: ((value: string | null) => void) | null = null
let dialogQueue: Promise<unknown> = Promise.resolve()

/** 创作页共用站内确认与输入弹窗，不调用阻塞浏览器的原生 confirm/prompt。 */
export function useActionDialog() {
  const current = useState<ActionDialogRequest | null>('livliv-action-dialog', () => null)
  function ask(request: ActionDialogRequest): Promise<string | null> {
    if (import.meta.server) return Promise.resolve(null)
    const result = dialogQueue.then(() => new Promise<string | null>(resolve => {
      current.value = request
      pendingResolution = resolve
    }))
    dialogQueue = result.then(() => undefined, () => undefined)
    return result
  }
  function settle(value: string | null) {
    const resolve = pendingResolution
    pendingResolution = null
    current.value = null
    resolve?.(value)
  }
  return {
    current: current as Ref<ActionDialogRequest | null>,
    settle,
    confirm: async (message: string, title = '操作确认') => (await ask({ title, message, input: false, initialValue: '' })) !== null,
    prompt: (message: string, initialValue = '', title = '填写信息') => ask({ title, message, input: true, initialValue }),
  }
}
