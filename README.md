# livliv（前端首期）

## 启动说明
1. 安装依赖：`pnpm install`
2. 本地开发：`pnpm dev`

> 按你的要求，当前已完成前端页面与交互封装，暂未接真实后端，也未执行构建。

## 当前实现范围
- 首页（导航、轮播、分类筛选、作品卡片流）
- 微信扫码登录弹窗（二维码占位 + 轮询状态）
- 创作画布（节点添加、拖拽、连线、节点配置）
- 分镜工作区（脚本表格视图 / 创意卡片视图）
- API 封装层（`apiClient + mockAdapter + services`）

## 目录结构
- `pages`：页面路由
- `features`：业务模块
- `entities`：领域类型
- `shared`：公共组件、常量、接口层
- `composables/queries`：Vue Query 查询封装
- `docs/livliv-frontend-architecture.md`：架构说明
