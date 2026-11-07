# 技能动作显示真实名称 · 2026-11-06

## 问题与修复

原 `read_creation_skill` 已真实读取具体助理，公开事件却只有通用工具类型，前端因此统一写“读取创作技能”。不是没有选到助理，也不能把读取指导美化成已启动独立子Agent或已提交生成。

- API复用既有授权目录查询，缓存公开id、名称、版本；开始读取时关联准确技能id，成功后以实际固定版本回包更新该次事件的skill身份。不增加目录请求、不存整份工具参数/资源正文，不按模型public_note或用户文字猜名称。
- 前端工具行显示“读取图片创作助理／视频创作助理／音乐创作助理／文本创作助理”等本次真实名称；多阶段各自保留，不用最后选择覆盖前序。历史没保存可信名称时仍保留通用标题，不编造补名，不改历史数据。
- 自由创作指导补充真实技能名称与当前动作说明，图片助理补充“主体明确可推荐构图、场景与光线，不因新主题自动重复补问”的规则。需求、选模理由、真实规格及提示词设计仍按已有图片助理反馈指导组织，不通过前端填固定长文。
- 原预加载、权限、真实报价、最终确认、停止及任务服务不变；没有新增框架或独立子Agent。

## 验收

| 类别 | 证据 |
| --- | --- |
| 前端 | 32项通过，含真实工具组件SSR渲染、事件合并、图片/音乐/视频独立名称、失败不冒充成功、历史无名不猜补、确认卡及思考状态回归。 |
| API | 135项通过（56.99秒）。真实Deep Agents循环使用采样替身，覆盖四助理开始/完成身份、畸形ID及伪造名称拒绝、原读取/任务边界；隔离PostgreSQL核对带名称收据写库及刷新恢复。 |
| 服务 | 统一Python3.12共享脚本重启API：新虚拟环境父进程54008、实际CPython3.12监听8000进程46316；检查API、checkpoint、Redis及celery/composition/batch-video/batch-image四队列均正常，每队列1名就绪消费者。未重启或重发媒体任务。 |
| 未覆盖 | 本轮没有真实文字模型新对话、浏览器新调用名称展示或生产构建验收，不以SSR或隔离采样证明模型实际表达质量。无采购、提交Git或部署。 |

重启前只读核查两条planning记录均为10月29/30日旧记录，未改其状态，也未重新推进。

前端命令：`node --test tests/process-events.test.mjs tests/process-events-render.test.mjs tests/creation-confirmation-render.test.mjs tests/thinking-indicator.test.mjs`

API命令：`.codex-runtime/agent-py312/Scripts/python.exe -m pytest tests/test_creation_skill_library.py tests/test_canvas_skill_agent.py tests/test_canvas_skill_agent_runtime.py tests/test_image_batch_public_confirmation.py tests/test_image_batch_results.py tests/test_plan_review_intent.py tests/test_image_assistant_guidance.py -q --tb=line`
