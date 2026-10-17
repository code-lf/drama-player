# 仓库开发约定

- 写代码必须为配置项及方法逻辑补充中文注释；用户要求提交 Git 时，提交说明用中文简述改动要点。未经要求不提交或部署。
- 修改 UI 前必须阅读并遵守 `docs/livliv-ui-spec.md` 与 `docs/theme-guidelines.md`，尤其设置弹窗标准。用户最新明确要求优先于旧规范。
- 通用交互复用 Nuxt UI v4 与现有 `components/liv-ui` 封装。设置弹窗使用 `LivDialog settings`、`LivButton settings`、`USwitch`；协议同意使用 `UCheckbox`，不新增平行基础组件。
- 主色 `#4F46E5`，不恢复旧蓝色；字体、间距、圆角走现有令牌，不在页面临时拼多套尺寸。禁止浏览器原生 alert、confirm、prompt。
- 保留已有未提交修改和历史数据，功能入口调整不删除底层能力；不创造无真实接口支持的开关、进度或完成状态。
- UI 修改必须区分构建、单元测试与真实浏览器验证；未测项目明确说明，不把编译通过当成功能验收。
