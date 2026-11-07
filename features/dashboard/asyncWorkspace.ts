import { defineAsyncComponent, type AsyncComponentLoader, type AsyncComponentOptions, type Component } from 'vue'

/** 工作区仅在自己的内容位置等待下载，不向 NuxtPage 的 Suspense 传播等待，导航先挂载。 */
export function defineWorkspaceComponent<T extends Component>(options: AsyncComponentLoader<T> | AsyncComponentOptions<T>) {
  return defineAsyncComponent({
    ...(typeof options === 'function' ? { loader: options } : options),
    suspensible: false,
  })
}
