# Livliv 前端架构（首期）

## 技术栈
- Nuxt 3 + Vue 3 + TypeScript
- TailwindCSS（配合设计令牌）
- Pinia（本地状态）
- @tanstack/vue-query（异步状态）
- Vue Flow（节点画布）

## 目录分层
- `pages`：路由页面（首页、创作页）
- `features`：业务模块（landing、auth、studio、canvas）
- `entities`：核心类型（project、auth、canvas、storyboard）
- `shared`：公共能力（api、constants、ui）
- `assets/css`：设计令牌与全局样式
- `composables/queries`：查询封装

## 核心流程
1. 首页读取 `projectService` 获取作品列表。
2. 登录弹窗读取 `authService` 获取二维码票据并轮询登录态。
3. 创作页读取 `canvasService` 与 `storyboardService`，初始化画布与分镜。
4. 画布交互写入 `useCanvasStore`，并持久化到 localStorage。
5. 点击保存时通过 `canvasService` 提交流程图。

## API 适配策略
- `shared/api/client.ts` 通过 `runtimeConfig.public.apiAdapter` 决定使用哪个适配器。
- 首期默认 `mockAdapter`。
- 接入真实后端时新增适配器并切换配置，不改页面业务代码。

## 日志与排障
- `callApi` 对同接口连续失败做计数。
- 达到阈值后输出详细错误日志，并提示提供日志继续协助定位问题。
