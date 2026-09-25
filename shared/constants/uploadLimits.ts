// 商品创作参考图按 ToAPIs 图片上传接口及当前火山 Seedream 接入的 10 MB 上限校验。
// 视频文件上传属于独立接口（ToAPIs 为 50 MB），不要复用参考图限额。
export const PRODUCT_REFERENCE_IMAGE_MAX_MB = 10
export const PRODUCT_REFERENCE_IMAGE_MAX_BYTES = PRODUCT_REFERENCE_IMAGE_MAX_MB * 1024 * 1024
