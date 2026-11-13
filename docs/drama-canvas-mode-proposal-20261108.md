# 短剧双视图复用方案（源码核查，不是已实现）

## 产品名称与边界

建议沿用同一短剧项目，提供「流程工作台」与「创作画布」两种视图。前者是现有剧本、资产、分镜、成片四阶段，适合顺序制作及批量管理；后者用于查看关系、局部调整和对话操作。切换视图不创建第二个项目，不重新分析或生成，不迁移收费授权。

本轮仅分析；未改动短剧执行链路。不能将通用自由创作的多图多视频任务直接当成短剧分镜生产。

## 已有代码与复用位置

| 阶段 | 真实现有接口/组件 | 画布建议投影 |
| --- | --- | --- |
| 剧本 | `dramaService.ingestScript`、`confirmScriptVersion`；`DramaScriptWorkspace.vue` | 剧本版本节点、集与场节点；正式剧本和编辑草稿分开 |
| 提炼 | `prepareAssetWorkspace`、`getAssetWorkspace` | 真实提炼任务及角色/场景/道具关系，不将预加载标为AI已完成 |
| 资产 | `generateRoleAssets`、`generateSceneAssets`、`generatePropAssets`；`DramaAssetWorkspace.vue` | 按固定资产身份引用角色、场景、道具及其生成版本 |
| 分镜 | `generateStoryboards`、`getStoryboardWorkspace`、`selectStoryboardTake`；`DramaStoryboardWorkspace.vue` | 按集/场分组，分镜行与take是不同身份，连到实际采用的角色及场景 |
| 视频 | `estimateStoryboardVideoBatch`、`createStoryboardVideoBatch` | 复用原报价、批次与逐镜头任务，不走通用画布重复采购 |
| 成片 | `getEpisodeCut`、`saveEpisodeCut`、`renderEpisodeCut`、`getEpisodeCutTask`；`DramaEpisodeCutWorkspace.vue` | 每集剪辑稿与导出版本，片段绑定rowId/takeId，完成文件独立显示 |

现有路由 `pages/drama/[projectId].vue` 已定义 script/setting/storyboard/video 四阶段；剧本确认、生产快照、资产差异扫描与同步接口应保留。当前通用 `agentCanvas.ts` 主要投影创作运行/媒体任务，未发现完整短剧项目投影，不能称为已经支持短剧画布。

## 需要新接的薄适配层

1. 建立短剧只读画布投影：项目、正式剧本版本、生产版本、集/场、资产key、分镜rowId、takeId、剪辑稿及导出任务均使用稳定业务身份。布局独立保存，拖动不是生产关系变更。
2. 共用项目快照与阶段权限。切视图只换呈现；不将整页Vue组件和其轮询同时挂载两份。先只读投影，再逐项接原编辑与确认入口。
3. 连线区分追溯展示与真实采用。真实关系变更只能调用原受控命令并验证版本；不能仅拖线就修改已冻结生产快照。
4. 剪辑接线须显式适配。短剧`EpisodeCutDraft`有字幕、BGM、逐片段原声及跟随分镜选版语义；通用剪辑V3不能直接整份覆盖它。首版先打开原成片工作台，后续再验证映射与不支持字段保留。
5. 对话工具读取当前短剧项目/版本及授权素材，操作复用原服务。手选短剧技能不路由成普通生图助理；修改剧本后由真实影响扫描告知下游失效，不全部重做。

## 推荐开发门槛

第一批只读展示一份已有项目：剧本→资产→分镜分组→真实视频take→每集成片；两视图显示相同数量、版本、任务状态。随后接已有详情面板及原修改入口，再接短剧专用Agent工具。最后用独立测试项目验证版本变更、报价确认、失败恢复和导出。

首版验收至少覆盖：切换不新增任务/扣费；分镜选版双向一致；资产换版不覆盖旧take；多集分组不串素材；刷新与停止保留已提交任务；预览与导出来源一致。没有这些证据前，模式选择只能作为待开发方案，不能发布假入口。
