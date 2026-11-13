# 第一版普通创作画布：本地启动与恢复边界

## 当前本地预览规则

- 正式本地验收统一使用 `http://localhost:3000`。`node scripts/preview-local.mjs` 固定监听 `127.0.0.1:3000`，不继承终端的 `PORT`／`NITRO_PORT`，端口占用则报错，不换端口；API 仍代理本地 `8000`。
- `pnpm build` 只更新构建产物，不替换监听进程。构建成功后先确认 3000 上是本项目旧预览，再在同一端口重启预览，最后刷新原浏览器地址核对实际页面。下文的其他端口为历史隔离记录，不作为交付地址。

## 2026-10-29 当前启动修正

- 实查发现仅通用、storyboard、render在线，普通创作的composition、batch-video、batch-image没有消费者。旧文中的健康快照不能沿用。
- 已在本机统一启动脚本 `.codex-runtime/start-local-services.ps1` 加入现有 `run_creation_worker.ps1` 的三个专用消费者，保留短剧原队列，不启动整套Beat。启动前按Kombu全部优先级物理队列核对：三个队列积压均为0。
- 加载音轨代码后重启API；重新执行后端 `scripts/check_creation_runtime.py`：API、checkpoint、Redis均正常，四个普通创作队列各1个完整注册的消费者，整体退出0。仍需登录真实页面验证，不等同链路验收通过。
- 手动启动需分别运行 `pwsh -NoProfile -File scripts/run_creation_worker.ps1 -Queue composition`、`-Queue batch-video`、`-Queue batch-image`（后端目录）。不得用 `render` 的ping代替合成队列检查；已有进程由脚本去重。
- 周期恢复仍未启用，后续应以专用白名单恢复调度验证，不能为收尾开启包含其他周期业务的整套Beat。

## 2026-10-28 本次只读健康快照

- 后续复核通过模块方式运行 `python -m scripts.inspect_local_image_queue`，`batch-image` 待消费及未确认均为0；随后启动该专用消费者并重新运行健康检查，四个队列均有1个注册完整的消费者，整体退出0。该结果仅为当次快照；未启用Beat，未验证周期恢复。
- 最新更正：检查补上真实 `batch-image` 消费队列及 `batch-video` 生成任务注册后，本次 API、checkpoint、Redis、其他三个队列正常，但 `batch-image` 为0个消费者，整体检查退出1。之前仅三个队列的快照不能证明图片批次就绪。没有启动该消费者，也没有补投真实任务。
- 本次运行 `check_creation_runtime.py` 退出0：API、PostgreSQL checkpoint、Redis 正常，`celery`、`composition`、`batch-video` 各有1个注册所需任务的消费者。检查不启动服务或消费任务；此结果是当次快照，不能证明周期调度已启用或真实业务恢复完成。
- 下列2026-10-27记录为历史过程，不作为当前启动状态；最终验收时需重新运行只读检查，并核对实际页面。

## 2026-10-27 历史临时验收记录

- 本轮再次按实时监听确认3000/8000缺失后补启：用户端当前为`preview-local.mjs`本机构建包，API沿用`run_api.ps1`。三个Kombu实际优先级队列积压均为0后补启原三个Worker；最新`check_creation_runtime.py`退出0，API/checkpoint/Redis正常，每队列各1个注册完整的消费者。未运行Beat、未创建采购。构建包后续源码更新仍需重新构建并重启，不能把它当热更新。

- 最新复核：原3000/8000已无监听，非浏览器超时推断；已分别按真实项目根目录的Nuxt开发命令及原`run_api.ps1`恢复。3000真实歌曲会话已显示两首历史完成卡和原聊天草稿；8000启动日志确认应用初始化完成。Worker本轮仍未启动/核验，不能宣称各消费者在线。以下旧预览/卡死结论仅为过程记录。
- 随后已完成消费者复核，覆盖上一条Worker待核验结论：三个所需队列按Kombu实际优先级列表合计均无积压，启动原通用、composition和batch-video脚本后，`check_creation_runtime.py`退出0，每队列各1个具备完整任务注册的消费者。未运行Beat。此为当次健康快照，后续仍须重查，不能凭本文沿用在线结论。

- 最新状态覆盖本节下方的过程记录：旧香水会话的图片选择/工具定位递归已修复，并真实恢复图片工具和完成卡定位。3000已恢复为从真实项目根目录启动的Nuxt开发服务；8000按原API脚本补启。Worker消费者还需当次健康核验，不沿用旧进程编号或旧在线结论。

- 为排查历史会话渲染问题，本机3000已暂时从Nuxt开发服务切为`node scripts/preview-local.mjs`启动的构建包，仍只代理本地8000；3001另有同版本隔离预览。此变更不是部署，也没有修改`.env`或线上目标。
- 构建包没有热更新；后续源码修改必须重新构建并重启对应本地预览，再刷新页面验收。恢复开发模式时先核对3000实际监听进程，只停止本项目预览，再按下文原开发命令启动，不与预览抢端口。
- 原地址登录缓存已恢复，双视频成功会话可操作；香水历史会话仍有渲染卡顿，不能用健康接口正常代替修复。

本说明不部署、不迁移、不改价格、不开放新技能，也不恢复费用授权。所有命令先检查当前进程，只启动缺失项；无需重启运行正常的用户端/API。

## 正常启动

用户端在`E:\workspace\ai-create-video`执行：

```powershell
pnpm exec nuxt dev . --host 0.0.0.0 --port 3000
```

必须保留真实项目根目录`.`与有值的`--host`，不得重复传裸`--host`导致Nuxt欢迎页。3000返回200后仍需打开已有登录会话，看见真实项目、消息与画布。

API在`E:\workspace\ai-create-video-api`执行：

```powershell
pwsh -NoProfile -File scripts/run_api.ps1
```

以下Worker分别在同一个系统终端窗口的不同标签运行；每项常驻且日志应出现ready。先核对队列，若有积压不得把启动消费者当作“无业务副作用的检查”。不要清队列，也不要因观察超时重复启动。

```powershell
pwsh -NoProfile -File scripts/run_worker.ps1
pwsh -NoProfile -File scripts/run_creation_worker.ps1 -Queue composition
pwsh -NoProfile -File scripts/run_creation_worker.ps1 -Queue batch-video
pwsh -NoProfile -File scripts/run_creation_worker.ps1 -Queue batch-image
```

- `celery`：原通用生成与图片恢复任务，使用原授权和执行锁。
- `composition`：普通短片免费后期，与短剧render隔离，单并发。
- `batch-video`：已有视频批次补派发/结果对账，单并发；不接受新的采购许可。
- `batch-image`：仅消费已授权图片计划子任务；启动前必须检查实际队列和未确认消息，启动会执行已有积压，不能当作纯健康检查。
- 短剧storyboard/render不因本画布验收改变；管理端5666也保留原启动方式。

## 只读验收

API仓执行：

```powershell
.venv/Scripts/python.exe scripts/check_creation_runtime.py
```

退出0要求API业务健康、PostgreSQL checkpoint、Redis和四个队列均正常；消费者必须同时监听队列并注册所需实际任务，不以ping或进程存在代替。输出不含数据库/Redis连接、用户身份或消息内容。该命令不调用模型，不恢复图，不派发任务。

仍须另做浏览器验证：打开已有会话，恢复真实消息和节点，旧作品能播放，刷新不产生新任务。健康报告不是UI验收。

## 恢复与安全限制

- 单纯启动Worker只消费已存在队列消息，**不等于已经启用周期恢复**。队列外的事务待派发记录仍依赖已有恢复任务被显式调度。
- 本地没有为本验收启动整套Beat；其中还包含其他周期业务，不得为恢复合成而一并启动。新增 `app.tasks.creation_recovery_beat.celery_app` 白名单入口，只含短片合成、图片批次、视频批次恢复；专用调度器禁止追加框架默认任务，隔离临时调度文件验证旧非白名单条目会移除。隔离测试3项通过，但**尚未启动或完成真实周期恢复验收**。
- 只有在明确需要恢复已有任务、检查相关队列及待派发记录，并确认同一环境没有任何完整Beat或其他创作Beat运行后，才可在API项目目录单独启动：`.venv/Scripts/celery.exe -A app.tasks.creation_recovery_beat.celery_app beat -l info -s logs/beat/creation-recovery-schedule`。确保 `logs/beat` 已存在；同环境仅允许一个调度器，跨主机也要检查，不能只看本机进程。停止调度器不会取消已派发任务。
- 图片/视频恢复可能补派已获得授权但尚未执行的真实任务，并非无副作用的只读检查；状态未知仍须对账，不可重购。不得用健康检查或页面刷新替代上述启动前核对。
- 已受理未知任务只核对原任务与费用，不因查询404、超时或Worker重启重新采购；不得手工改成成功/失败以通过验收。
- 关闭新入口不删除旧运行；引擎、图与技能版本保持固定。网页读取、保存、重新连接均不恢复采购授权。
- 当前`.env`和进程临时开关不作为公开发布配置；开启收费批次或技能白名单须完成对应验收并另行批准发布。
