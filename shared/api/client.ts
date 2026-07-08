import { useRuntimeConfig } from '#imports'
import { httpAdapter } from '~/shared/api/adapters/httpAdapter'
import { mockAdapter } from '~/shared/api/adapters/mockAdapter'
import { ApiClientError } from '~/shared/api/errors'
import type { ApiAdapter, ApiResponse } from '~/shared/api/types'

const failureCounter = new Map<string, number>()

function pickAdapter(): ApiAdapter {
  const config = useRuntimeConfig()

  // 适配器切换只依赖 runtime config，页面层不关心 mock / real 的差异。
  if (config.public.apiAdapter === 'mock') {
    return mockAdapter
  }

  return httpAdapter
}

function markFailure(endpoint: string, error: unknown): void {
  const currentCount = (failureCounter.get(endpoint) ?? 0) + 1
  failureCounter.set(endpoint, currentCount)

  // 同一接口连续失败达到阈值时，主动输出详细日志并给出协助提示。
  if (currentCount >= 3) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 接口重复失败日志', {
      endpoint,
      count: currentCount,
      error
    })

    // eslint-disable-next-line no-console
    console.warn('[livliv] 该接口已连续失败多次，可把以上日志提供给我，我可以继续协助定位问题。')
  }
}

function resetFailure(endpoint: string): void {
  failureCounter.set(endpoint, 0)
}

function normalizeApiErrorMessage(detail: unknown): string {
  // 后端 AppException 会返回 { error_code, message }，这里统一提取用户能看懂的中文文案。
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message?: unknown }).message || '接口返回失败')
  }
  return '接口返回失败'
}

export async function callApi<T>(endpoint: string, task: (adapter: ApiAdapter) => Promise<ApiResponse<T>>): Promise<T> {
  const adapter = pickAdapter()

  try {
    const response = await task(adapter)

    if (!response.success) {
      throw new ApiClientError(response.message || '接口返回失败', 'BIZ_ERROR')
    }

    resetFailure(endpoint)
    return response.data
  } catch (error) {
    markFailure(endpoint, error)

    if (error instanceof ApiClientError) {
      throw error
    }

    // 尝试提取后端的 AppException 错误信息
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as any).response
      if (response && response._data && response._data.detail) {
        throw new ApiClientError(normalizeApiErrorMessage(response._data.detail), 'BIZ_ERROR')
      }
    }

    throw new ApiClientError('网络异常，请稍后重试', 'NETWORK_ERROR')
  }
}
