# 三端源代码快照：提交前检查（2026-10-29）

## 范围

- 用户端、API、管理端各自 `origin/master`（Gitee）；不推用户端的另一个 GitHub 远程。
- 保存当前技能制造机、草稿/试用/资源/步骤合同、声音与合成适配、相关测试、运行说明及开源接入路线。
- 本次只是开发源代码快照，不标记第一版验收完成，不安装 Deep Agents，不升级 Python，不部署，不执行数据库迁移或采购。
- `.data` 新日志/本地验收记录、`.nuxt-builder-check`、未引用的 `pelican-bicycle.svg` 和 `cartoon-comedy-3d-v1.png` 不暂存；不删除这些本地文件。已在历史提交中的文件不在本次改写或清理。

## 本次验证

| 仓库 | 实际运行 | 结果与边界 |
| --- | --- | --- |
| 用户端 | `node --test tests/*.test.mjs` | 869通过、0失败，不代替真实浏览器验收 |
| 用户端 | `pnpm build` | Nuxt生产构建通过，未部署构建产物 |
| 用户端 | `node scripts/check-theme-usage.cjs` | 未通过：只报告未改动的历史 `pages/index.vue` 硬编码；不以本次提交冒称全仓主题检查通过 |
| API | `test_skill*.py`、`test_composition*.py`、真实合成器、创作事件/运行合同/规划重试及视频批次派发相关回归 | 312通过、1失败、17个子用例通过；失败见下方 |
| API | `.venv/Scripts/python.exe -m compileall -q app scripts` | 通过，当前环境仍Python3.10.11 |
| 管理端 | `node --test apps/web-antd/tests/*.test.mjs` | 65通过；本次管理端只新增开发约定，无应用源码修改，未重新执行生产构建 |

后端失败为 `tests/test_skill_example_contract.py::test_all_platform_normalization_preserves_executor_and_materials`：测试使用本机 `D:/桌面/skill.json` 和当前数据库，硬编码期望矩阵67项，本次读取68项。测试和 `scripts/normalize_skill_examples.py` 都未改动；该函数遍历当前平台技能目录。没有为了通过而删除技能、修改真实目录或放宽断言。后续应将这类历史迁移用例改为固定隔离夹具，本次上传不扩大为数据整改。

候选改动文本的私钥头、常见云/API令牌模式检查未发现命中；这不是完整安全审计。暂存清单、空白及远程同步按三仓库分别检查。

## 明确未完成

Deep Agents接入/Python升级、支持范围内步骤真实执行、后台共用制造机，以及既定完整页面/异常专项仍按各自矩阵推进。旧阶段收据不冒充真实多工具Agent调用记录。源代码推送成功也不代表这些项目已完成。

后续接入与许可/安全要求见 [全链路路线](open-source-integration-roadmap.md) 和 [决策台账](open-source-decisions.md)。
