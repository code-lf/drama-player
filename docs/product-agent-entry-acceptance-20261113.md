# 商品创作入口回归记录

## 改动

- 移除 CreationStudio 新建商品轮次后调用 beginStage 的特殊分支，统一调用 advanceRun。
- 原文、模型参数及固定素材引用继续由原 startRun 提交；公开说明和问题使用实际 Agent 回包。
- 保留历史 collection_stage 的补答恢复逻辑，不修改旧运行，不新增生成或授权调用。

## 自动验证

- 执行 product-agent-entry、style-conflict、creation-entry-consolidation 三组测试，共 15 项通过。
- 通过 vue/compiler-sfc 解析并编译 CreationStudio 脚本，语法检查通过；不等于完整生产构建。
- 新增测试执行真实发送方法的创建与推进代码，覆盖商品／自由／图片入口返回补问及方案，核对原文、附件身份与实际状态回填。
- 本次测试使用接口替身，不代表真实模型效果或登录态页面验收。

## 未验收

- 未执行生产构建、真实阿里云调用或浏览器新对话验收。
- 旧对话中的固定问卷保留原样，不能用旧记录判断新入口是否已生效。
- 未采购媒体、提交 Git 或部署。
