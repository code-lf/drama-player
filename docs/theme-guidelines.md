# 明暗主题开发规范

## 核心规则
- 组件规格见 `docs/livliv-ui-spec.md` 第 9 节；设置弹窗复用 `LivDialog settings dark`、`LivButton settings` 和 `USwitch`，不再手写遮罩与原生勾选框。
- 品牌色为 `#4F46E5`，设置弹窗固定深灰外观作为允许的产品表面例外，颜色只通过 `--liv-settings-*` 令牌定义。
- 优先使用语义 token：`bg`、`panel`、`panelSoft`、`surfaceBase`、`surfaceRaised`、`surfaceOverlay`
- 文本统一使用：`textMain`、`textMuted`、`textInverse`
- 状态色统一使用：`stateSuccess`、`stateWarning`、`stateDanger`
- 交互悬浮统一使用：`surfaceHover` 或 `neon` 系列，不直接写 `hover:bg-white/10`

## 用户端选择控件
- 选择交互复用 Nuxt UI／Liv 现有封装：单选优先 `USelect`，搜索或多选优先 `USelectMenu`；禁止原生 `select`、浏览器系统菜单及未套业务主题的默认黑蓝长列表。
- 选择面板使用锚定触发器的传送浮层，避免父级裁切并执行视口碰撞避让；长选项在面板内部滚动，键盘可聚焦、方向键选择、Enter／Space 确认、Esc 关闭并恢复触发器焦点。选中与禁用态必须清晰可辨，禁用项保留真实原因。
- 复杂媒体值不改造成名称下拉：技能步骤风格复用 `CreationStyleDialog` 风格库，返回真实风格 ID；模型选择使用真实目录勾选卡片并按图片／视频／音乐分组，只呈现已开放能力。
- 选择器、弹层及选中项沿用现有深色语义表面和令牌；创作弹层保持 `#151515` 表面及既有靛紫品牌层级，不为选择器新增硬编码底色或第二套选中颜色。

## 默认禁止
- 在主题敏感目录直接写 `text-white`、`text-black`
- 直接写 `bg-white`、`bg-black`
- 直接写硬编码十六进制颜色作为正文、容器、输入框底色

## 允许例外
- 品牌渐变、海报/插画视觉
- 媒体蒙层、视频占位、截图预览画布
- 阴影、发光、边框微调
- Logo 或第三方素材本身自带颜色
- 音乐播放舞台为固定深色媒体表面，统一使用 `--liv-music-*` 令牌；封面氛围、黑胶凹槽和靛紫光效属于媒体装饰例外，不扩展为普通业务表单的主题色。

## 开发建议
- 先确定语义层级，再决定颜色，不要先写颜色后补 `dark:` 分支
- 一个组件里如果出现 `dark:` 超过 3 处，优先考虑抽成 token 或基础组件
- 新按钮、输入框、选择器优先复用基础组件，不再页面里拼裸样式
- 数量步进使用 `UInputNumber`，加载占位使用 `USkeleton` / `DashboardSkeleton`；具体场景、边界和失败退出规则见 UI 规范第 4、13 节。
- 新增页面必须同时检查浅色和深色主题，尤其是空状态、下拉层、弹窗、表单、卡片边框这类最容易漏适配的区域
- 公告、充值、项目列表等工作区页面不要只依赖父级背景，组件内部容器也要使用语义 token 或明确的暗色覆盖

## 自检命令
```bash
pnpm theme:check
```
