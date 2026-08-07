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

function normalizeApiErrorCode(detail: unknown): string {
  // 保留后端业务错误码，页面才能区分积分不足、模型超时、版本冲突等处理动作。
  if (detail && typeof detail === 'object' && 'error_code' in detail) {
    return String((detail as { error_code?: unknown }).error_code || 'BIZ_ERROR')
  }
  return 'BIZ_ERROR'
}

function extractApiErrorDetail(error: unknown): unknown {
  if (!error || typeof error !== 'object') return undefined
  const fetchError = error as {
    data?: unknown
    response?: { _data?: unknown; data?: unknown }
  }

  const unwrapDetail = (payload: unknown): unknown => {
    if (!payload || typeof payload !== 'object') return undefined
    const body = payload as { detail?: unknown; error_code?: unknown; message?: unknown }
    // FastAPI 原生 HTTPException 使用 detail 包装；AppException 则直接返回业务错误对象，两种都要识别。
    if (body.detail !== undefined) return body.detail
    if (body.error_code !== undefined || body.message !== undefined) return body
    return undefined
  }

  // Nuxt/ofetch 在不同运行环境下可能把响应体放在 error.data 或 response._data，
  // 两种格式都保留，避免业务错误被错误降级为“网络异常”。
  return unwrapDetail(fetchError.data)
    ?? unwrapDetail(fetchError.response?._data)
    ?? unwrapDetail(fetchError.response?.data)
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

    // 尝试提取后端的 AppException 错误信息。
    const detail = extractApiErrorDetail(error)
    if (detail !== undefined) {
      throw new ApiClientError(
        normalizeApiErrorMessage(detail),
        normalizeApiErrorCode(detail)
      )
    }

    throw new ApiClientError('网络异常，请稍后重试', 'NETWORK_ERROR')
  }
}
