# AI动作来源与预加载展示修正 · 2026-11-06

## 口径与实现

聊天内工具成功仅表示模型实际请求了受控工具，且工具返回成功；这不是证明模型已经理解、记住或正确运用指导的证据。创作质量仍需另行验收。

- 相邻API `app/services/canvas_skill_agent.py` 由执行边界赋值事件来源：带真实模型工具调用身份的事件为 `origin=agent`，系统预加载为 `origin=runtime`。不接受用户或模型自行宣称来源。
- 保留技能及续作进度的必要预加载、权限校验、完整上下文注入与快照持久化；不为了展示真实性让模型重复读取，也不增加模型调用。
- 用户端 `features/creation/processEvents.ts` 隐藏runtime聊天投影。历史固定开场、技能读取、进度读取缺少可信来源时也不显示，原始事件和历史数据不改写。
- AI真实调用开始、成功、拒绝、异常分别沿用原状态，不将中断改成成功，不以固定描述补造模型感悟。后台报价、准备、提交的成功不混入AI打勾行，由原业务确认/结果卡承担；异常、处理中、待核对仍展示。
- 未改权限、报价、积分、任务、采购、停止或恢复服务，不安装框架、提交Git或部署。

## 验收证据

| 类别 | 结果与范围 |
| --- | --- |
| 前端 | 62项通过：事件来源、未知历史读取、预载不产生续答分隔、真实返回/失败、确认卡及恢复展示；包含组件渲染与源码断言，不冒充真实模型验证。测试宿主有既存USkeleton未注册警告，未阻止通过。 |
| API | Python3.12统一环境130项通过（66.57秒）：Deep Agents实际工具循环、来源区分、首次模型失败仍完整注入技能/进度、无伪造AI调用、快照与隔离PostgreSQL刷新持久化、媒体确认/结果边界。供应商采样为隔离替身，无真实网络生成。 |
| 浏览器 | 只读打开并刷新本人原失败会话 `06f4399d-a2d0-47be-b118-dcd175dbf840`、运行 `a0da67a9-0c4f-43f1-a424-00809b16b955`。AX及截图确认：失败轮不再展示两条固定预加载动作；原错误与已完成mock图片卡/画布成果保留。 |
| 未覆盖 | 新代码下真实文字模型的新一轮工具调用与创作质量、生产构建、完整媒体链均未复验。按用户说明等待文字供应商充值，不发送新对话、不采购。没有重启服务来触发新运行。 |

页面刷新同时显示既有“草稿有冲突”，未选择保留本地或云端，不替用户覆盖草稿；此现象不计为本轮修复。

## 回归命令

前端：`node --test tests/process-events.test.mjs tests/thinking-indicator.test.mjs tests/creation-confirmation-render.test.mjs tests/image-plan-card.test.mjs tests/video-plan-card-render.test.mjs tests/creation-flow-recovery.test.mjs`

相邻API：`.codex-runtime/agent-py312/Scripts/python.exe -m pytest tests/test_creation_skill_library.py tests/test_canvas_skill_agent.py tests/test_canvas_skill_agent_runtime.py tests/test_image_batch_public_confirmation.py tests/test_image_batch_results.py tests/test_plan_review_intent.py tests/test_image_assistant_guidance.py -q --tb=line`
