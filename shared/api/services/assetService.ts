export const assetService = {
  async uploadAsset(): Promise<{ success: boolean; message: string }> {
    // 资源服务首期占位：后续接阿里 OSS / 媒体处理网关
    return {
      success: true,
      message: 'asset upload mock'
    }
  }
}
