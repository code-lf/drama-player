/** 只展示可操作的会话错误，不把请求地址或底层网络堆栈透给用户。 */
export function sessionErrorText(cause: unknown): string {
  const error = cause as { status?: number; statusCode?: number; code?: string; response?: {status?: number} }
  const status = error?.statusCode || error?.status || error?.response?.status
  if(status===429)return '读取较频繁，请稍后重试加载会话；原任务仍会继续。'
  if (status === 401 || error?.code === 'UNAUTHORIZED') return '登录已失效，请重新登录后打开会话。'
  if (status === 403 || status === 404) return '会话不存在或无权访问，请从我的项目重新选择。'
  if (status && status >= 500) return '会话服务暂时不可用，请稍后重试。'
  return '会话加载失败，请检查网络后重试。'
}
