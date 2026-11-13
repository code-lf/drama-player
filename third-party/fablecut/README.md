# FableCut最小复用边界

- 上游 `https://github.com/ronak-create/FableCut`；固定npm `fablecut@1.18.0`，MIT声明见本目录LICENSE。
- 内核为 `edit-ops.js`，原始SHA-256及归档SHA-512见manifest。浏览器实验包另见browser/source-manifest.json，包含原HTML/CSS和20个客户端脚本；未运行原Node/MCP，未带入字体、音乐或示例资产。
- 上游注释保留原文；本地补丁原因中文记录。两处补丁：最短片段40ms；分割允许首尾恰好一帧并容忍秒投影微小浮点误差。平台仍要求严格整数40ms。
- `node scripts/prepare-fablecut-kernel.mjs` 只读取本地 `.codex-runtime/fablecut-probe` 归档及已解包文件，核对完整性、身份、许可及源码指纹后机械导入，不联网、不执行上游代码。
- 浏览器使用UMD的FableCutEdit，测试使用node:vm的浏览器分支，不使用需加载其他模块的CommonJS分支。
- 平台白名单在 `features/editing/fablecut-candidate.mjs`；不能把整个上游API交给模型或通信桥。
- `node scripts/prepare-fablecut-browser.mjs`从已验证tar归档机械生成实验包，按AST替换原保存/连接/撤销函数，localStorage改为本次内存；禁网络和Worker，标尺走上游主线程回退。DOM、原生交互和许可保留，实验壳仅开放主轨拖动/裁切，不运行原导出及项目恢复。
- **开发专用editing-probe已验证图片预览、边缘时长调整和排序，未接正式入口**。双音轨、真实私人素材与视频、平台保存联动、生产压缩及完整浏览器安全审查仍未通过；不能将实验页当可交付工作台。MIT不是FFmpeg构建、媒体或其他附属资源的完整许可结论。
