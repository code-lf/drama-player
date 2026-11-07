# AI 剪辑工作台：发布包接入门槛记录

日期：2026-11-07。状态：原包直接接入阻塞；未安装为生产依赖，未替换正式页面。

## 本轮实际工作

- 从 npm 官方 registry 下载 `webcut@0.2.9` 发布包，在 `.codex-runtime/webcut-probe` 隔离解包；未运行第三方脚本。
- 校验 SHA-512，与 npm 元数据 integrity 一致；主包声明 MIT。没有完成传递依赖漏洞和许可审计，MIT 声明不等于全套商用安全通过。
- 新增只读复核脚本 `scripts/inspect-webcut-package.mjs`，执行 `node scripts/inspect-webcut-package.mjs`；包文件缺失或指纹不一致即失败，不自动下载和安装。
- `package.json`、锁文件、原工作台、任务及账务未因本轮取包而修改。取包时误执行了一次本地项目 pack，生成的临时 `livliv-0.1.0.tgz` 已删除；没有发布、上传或删除源文件。

## 精确阻塞证据（相对发布包 package 目录）

| 源码位置 | 实际行为 | 对本计划的影响 |
| --- | --- | --- |
| `src/views/manager/container/index.vue` | 初始化 `useWebCutHistory()`，拖动结束 `pushHistory()` 后才 emit resize | 普通平台事件监听不能阻止内部历史写入 |
| `src/hooks/history.ts` | mounted 时 `historyMachine.init()`，恢复本地宽高及历史候选 | 隐藏恢复按钮不等于停用第二套持久化 |
| `src/libs/history-machine.ts` | push 调用 `pushProjectHistory`，undo/redo 读写本地历史指针 | 不能只替换外层撤销按钮就声称统一草稿 |
| `src/db/index.ts` | 固定 `webcut` IndexedDB，含 project、project_history、project_state；使用 OPFS | 缺少平台账号隔离及存储注入的验证 |
| `src/hooks/index.ts` | 更新画幅直接 `updateProjectState` | 不用整套编辑器仍可能写本地项目状态 |
| `src/views/manager/main/index.vue` | 依据 rail.type 而非片段类型选择图片／视频组件 | 单条图片视频混排主画面轨需要自定义投影／插槽适配 |

当前检查范围内未找到关闭历史持久化或替换存储的公开配置。以上证明**未经适配的原包不能直接满足计划**，不证明 WebCut 永远无法适配，也不证明其他组件全部不可复用。

## 停止范围与下一步

按用户批准的“不能维护两套项目状态”门槛，暂停正式入口接入，不以旧表单、安装依赖或静态页面宣称工作台完成。

若继续此候选，下一批应限定为最小源码适配验证：可注入内存历史／禁用本地恢复与项目写入、混排视觉轨渲染、平台命令失败回滚及账号切换清理。必须归档确切上游版本、MIT 声明和补丁；不得用全局 IndexedDB 拦截、伪造成功或删除用户其他项目缓存绕过问题。适配验证通过后才推进三版合同、FFmpeg 图片渲染、四区页面和剪辑 Agent。

## 未完成

Nuxt 客户端加载、浏览器拖动／裁切、私人素材读取与缓存隔离、传递依赖安全、预览导出一致性尚未验收。三版合同、统一编辑命令、新工作台、剪辑 Agent 和整体验收尚未实现。本记录不是整体交付声明。
