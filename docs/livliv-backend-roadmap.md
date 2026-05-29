# Livliv 后端开发方向与周期方案（MVP -> 可商用）

## 1. 当前阶段结论
- 前端工作流骨架已具备演示能力：`首页 -> 项目 -> 画布节点 -> 分镜视图/输入面板`。
- 当前核心阻塞在后端：任务编排、模型调用、资产存储、状态回传尚未打通。
- 技术建议：后端优先使用 **Python（FastAPI）**，先跑通链路，再考虑按流量拆分服务。

---

## 2. 后端技术栈建议（首期）

### 2.1 语言与框架
- API 框架：`FastAPI`
- 任务队列：`Celery + Redis`
- 数据库：`PostgreSQL 15+`
- 对象存储：`阿里云 OSS`（或 S3 兼容）
- 实时推送：`SSE`（首期）/ `WebSocket`（后续）

### 2.2 为什么先 Python
- 模型 SDK 与生态最完整，联调效率最高。
- 适合当前目标：快速验证“脚本 -> 分镜 -> 视频”的真实可用性。
- 后续可把高并发网关或任务调度拆分到 Go，不影响当前推进。

---

## 3. 目标链路（必须跑通）
1. 用户输入剧情文本。
2. 脚本节点生成结构化分镜表。
3. 批量生成分镜图。
4. 批量生成视频片段。
5. 合成节点导出成片。

---

## 4. 模块拆分（建议目录）
```txt
backend/
  app/
    api/                # 路由层
    core/               # 配置、日志、鉴权、中间件
    models/             # ORM 模型
    schemas/            # Pydantic 入参/出参
    services/           # 业务服务
    workers/            # Celery task
    integrations/       # 阿里/字节/OpenAI 等适配器
    repositories/       # 数据访问层
```

---

## 5. 周期计划（6 周，1-2 人）

## 第 1 周：基础设施与数据库
- 完成 FastAPI 项目初始化、环境配置、日志规范。
- 建库建表（项目、画布、任务、分镜、素材、会话）。
- 输出 OpenAPI v1 草案。

## 第 2 周：基础 API
- `Auth`：微信扫码最小闭环（ticket + 轮询 + session）。
- `Project`：项目 CRUD、最近项目、全部项目分页。
- `Canvas`：图数据保存、读取、版本记录。

## 第 3 周：脚本生成链路
- `POST /storyboard/generate`：文本 -> LLM -> 结构化分镜。
- 增加 JSON Schema 校验与失败重试。
- 前端大分镜表格改用真实接口填充。

## 第 4 周：图片与视频节点链路
- 分镜批量图像生成任务（并发受控）。
- 图像到视频片段任务。
- 任务状态轮询 / SSE 回传。

## 第 5 周：合成与导出
- 片段拼接（FFmpeg worker）。
- 音频叠加与成片导出。
- 失败补偿、超时取消、幂等。

## 第 6 周：联调与上线准备
- 压测与限流（用户并发/项目并发/提供商并发）。
- 错误码标准化与可观测性（日志、trace、告警）。
- 预发布环境联调并回归。

---

## 6. 并发与稳定性策略（P0）

### 6.1 并发限制
- 用户级：如 `2` 个视频任务 + `4` 个图像任务并发。
- 项目级：同一项目最多 `N` 个节点同时执行。
- 提供商级：按模型维度限流（QPS/RPM/并发）。

### 6.2 任务幂等
- 使用 `idempotency_key = hash(project_id + node_id + input_snapshot)`。
- 同 key 重复请求直接返回已有 run 结果，避免重复扣费。

### 6.3 重试策略
- 仅对可重试错误（超时、429、5xx）重试。
- 指数退避：`1s -> 2s -> 4s`，最大 3 次。

---

## 7. 模型策略（训练与接入）

## 首期（建议）
- 不做大模型预训练。
- 重点做：
  1. Prompt 模板工程；
  2. Few-shot 示例；
  3. 结构化输出约束（JSON Schema / function calling）；
  4. 角色一致性规则（参考图 + 标签库）。

## 进入微调（SFT/LoRA）的时机
- 有稳定标注样本（建议 5k+ 高质量样本）。
- 线上提示词优化已到瓶颈，且有可量化评测集。

---

## 8. 接口优先级（第一批）
1. `POST /api/auth/wechat/ticket`
2. `GET /api/auth/wechat/poll`
3. `GET /api/projects`
4. `POST /api/projects`
5. `GET /api/canvas/{project_id}`
6. `PUT /api/canvas/{project_id}`
7. `POST /api/storyboard/generate`
8. `POST /api/workflow/runs`
9. `GET /api/workflow/runs/{run_id}`

---

## 9. 验收标准（MVP）
- 输入剧情后，15~60 秒内能返回结构化分镜并写入表格。
- 选中分镜可批量触发图像生成，状态实时可见。
- 图像可继续生成视频片段并完成合成导出。
- 任务失败有错误码、有重试、有日志可追踪。

---

## 10. 下一步你可以立刻做
1. 建 `backend` 仓库目录与 FastAPI skeleton。
2. 按 `docs/sql/` 下完整 SQL 初始化开发库。
3. 先打通 `storyboard/generate` 一个接口（文本 -> 分镜 JSON -> 入库 -> 前端回显）。

