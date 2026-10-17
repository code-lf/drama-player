/** 仅负责文件传输；鉴权、协议确认和登录失效仍由共用请求适配器处理。 */
export function uploadFormData<T>(url: string, body: FormData, headers: Record<string, string>, progress: (percent: number | null) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = 180000 // 文件上传最多等待三分钟；超时不自动重传，避免重复落库。
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = event => progress(event.lengthComputable ? Math.min(99, Math.floor(event.loaded / event.total * 100)) : null)
    xhr.onload = () => {
      let data: unknown
      try { data = JSON.parse(xhr.responseText) } catch { data = { detail: '上传响应无法解析，请重试。' } }
      if (xhr.status >= 200 && xhr.status < 300) { progress(100); resolve(data as T) }
      else reject(Object.assign(new Error('素材上传失败'), { statusCode: xhr.status, data }))
    }
    xhr.onerror = () => reject(new Error('网络异常，素材上传失败，请重试。'))
    xhr.ontimeout = () => reject(new Error('素材上传超时，请重试。'))
    xhr.onabort = () => reject(new Error('素材上传已取消。'))
    progress(0)
    xhr.send(body)
  })
}
