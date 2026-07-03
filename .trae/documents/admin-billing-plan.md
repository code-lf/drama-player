# 独立管理后台与盈利体系方案

## Summary

* 目标：在不污染当前用户侧 `Nuxt 3` 主站的前提下，新增一套独立管理后台，并补齐商业化所需的会员、点数、模型定价、动态扣点、订单支付、后台配置能力。

* 当前结论：

  * 用户侧前端继续保留现有仓库 `e:\workspace\ai-create-video`，不建议把管理后台继续塞进这个仓库。

  * 管理后台建议独立成新前端项目，优先选用 `Vue Vben Admin` 作为后台壳子，自定义业务页面，不建议整套从零写。

  * 盈利体系采用“会员套餐 + 单独充值点数 + 按实际用量动态扣点”的双层模式。

  * 支付优先支持国内：微信支付、支付宝。

  * 首期后台聚焦：用户、模型、点数；订单/支付作为第二阶段补齐。

  * 模型体系需要统一成“一套规则 + 多 provider 适配器”，支持可灵、阿里、火山由后台任意启停与切换。

  * 现有后端中的 provider / model 硬编码，需要迁移到数据库配置与后台管理，不再由 `Settings / ConfigService / Service / Task` 写死。

* 推荐落地路线：

  * 阶段 1：先补后端基础能力与数据模型。

  * 阶段 2：新建独立 `admin-web` 管理端。

  * 阶段 3：接入支付与点数结算。

  * 阶段 4：上线运营报表、人工调账、模型成本配置。

  * 阶段 5：完成多 provider 动态路由与模型治理平台。

## Current State Analysis

### 现有用户侧前端

* 当前用户侧主流程已经明确聚焦在短剧工作流，核心页面是：

  * 控制台与项目列表：`e:\workspace\ai-create-video\pages\dashboard.vue`

  * 项目详情工作流：`e:\workspace\ai-create-video\pages\drama\[projectId].vue`

  * 首页：`e:\workspace\ai-create-video\pages\index.vue`

* 当前前端没有真正意义上的管理后台、套餐页、支付页、账单页、点数中心。

* 当前登录只有用户态基础能力，没有管理员权限模型：

  * `e:\workspace\ai-create-video\features\auth\store\useAuthStore.ts`

  * `e:\workspace\ai-create-video\features\auth\components\LoginDialog.vue`

* 当前用户前端已经承担业务创作链路，不适合继续在同仓里深做中后台，避免：

  * 路由和 layout 混杂

  * 主题与交互诉求冲突

  * 用户权限与管理员权限耦合

### 现有后端

* 当前后端已具备 AI 短剧生产链路主能力：

  * 路由入口：`e:\workspace\ai-create-video-api\app\api\routes\drama.py`

  * 核心业务：`e:\workspace\ai-create-video-api\app\services\drama_service.py`

  * 视频任务：`e:\workspace\ai-create-video-api\app\tasks\workflow_tasks.py`

  * 运行时配置：`e:\workspace\ai-create-video-api\app\services\config_service.py`

  * 供应商接入：`e:\workspace\ai-create-video-api\app\integrations\alibaba\*.py`

* 当前后端已有一个“使用量台账”雏形：

  * `e:\workspace\ai-create-video-api\app\models\assets.py` 中的 `UsageLedger`

* 当前缺失的核心商业化能力：

  * 正式鉴权与管理员身份体系

  * 套餐、价格、会员、点数余额、点数充值、订单、支付单、账单、退款

  * 模型成本配置与动态扣点规则

  * 后台管理 API

  * 支付回调幂等与对账

  * 统一的用量结算事件流

  * 统一模型目录、统一输出协议、统一 provider 工厂

  * 可灵 / 阿里 / 火山三套供应商的后台可配接入

  * 把默认 provider / model / 候选模型 / 兼容别名从代码迁出到后台配置

### 当前模型硬编码现状

* 运行时配置里的模型候选目前写死在：

  * `e:\workspace\ai-create-video-api\app\services\config_service.py`

  * 例如 `ALIBABA_VIDEO_CANDIDATE_MODELS`、`BYTEDANCE_VIDEO_CANDIDATE_MODEL`

* 默认 provider 和默认 model 目前写死在：

  * `e:\workspace\ai-create-video-api\app\core\config.py`

  * 例如 `drama_text_provider='alibaba'`、`drama_video_model='wan2.6-r2v-flash'`

* 兼容别名和 provider fallback 也写死在：

  * `e:\workspace\ai-create-video-api\app\core\config.py`

  * 例如：

    * `ali_video_model`

    * `bytedance_video_model`

* provider client 选择目前直接写死在服务/任务中：

  * `e:\workspace\ai-create-video-api\app\tasks\workflow_tasks.py`

    * 直接实例化 `AlibabaVideoClient()`

  * `e:\workspace\ai-create-video-api\app\services\drama_service.py`

    * 直接依赖 `AlibabaTextClient()`、`AlibabaImageClient()`

  * `e:\workspace\ai-create-video-api\app\api\routes\drama.py`

    * 路由层直接注入 `AlibabaTextClient()`、`AlibabaImageClient()`

* 部分模型名和回退规则也写死在业务逻辑中：

  * `e:\workspace\ai-create-video-api\app\services\drama_service.py`

  * `e:\workspace\ai-create-video-api\app\integrations\alibaba\text_client.py`

  * 例如：

    * `qwen-plus`

    * `wanx2.1-t2i-turbo`

    * `wan2.7-r2v`

    * `wan2.6-r2v-flash`

    * `doubao-seedance-1.0-pro-fast`

* 这意味着当前虽然看上去“可切换 provider”，但本质仍然是：

  * 默认值靠 `.env`

  * 候选列表靠代码常量

  * 真实 client 依赖阿里实现

  * 多供应商尚未形成统一治理层

### 当前还缺哪些功能

* 用户侧仍缺：

  * 点数余额展示

  * 会员状态展示

  * 购买套餐/购买点数

  * 点数扣减记录

  * 账单与订单页

  * 失败任务是否退款/返还点数的规则提示

* 后端仍缺：

  * `plan / point_pack / order / payment / subscription / credit_account / credit_ledger / model_pricing_rule`

  * 管理端所需的查询、编辑、停用、审计接口

  * 支付渠道适配层

  * 扣点引擎

* 管理侧仍缺：

  * 用户管理

  * 模型管理

  * 点数配置管理

  * 套餐管理

  * 充值包管理

  * 订单与支付管理

  * 使用量与成本报表

  * 手工调账、补点、封禁

## Assumptions & Decisions

### 已确定决策

* 管理后台采用独立VUE3项目+饿了么UI，不与当前用户端 Nuxt 仓库混写。

* 支付优先面向国内支付场景。

* 盈利体系采用：

  * 会员套餐：提供月包/季包/年包权益

  * 单独充值点数：适合重度用户追加购买

  * 动态扣点：根据模型、字数、图片数、视频秒数、分辨率、是否有声等参数计算

* 首期后台优先做：

  * 用户管理

  * 模型管理

  * 点数管理

* 模型治理要求：

  * 前台只读取后台下发的模型配置

  * 后台控制哪些模型可见、默认哪个、哪个需要会员或更高点数门槛

  * provider 密钥与 endpoint 允许在后台配置，而不是只放 `.env`

### 推荐技术决策

* 管理后台前端：

  * 推荐：`Vue Vben Admin`

  * 备选：`Soybean Admin`

  * 不推荐：继续塞入当前 `Nuxt 3` 用户端

* 支付策略：

  * 首期后端抽象统一支付接口

  * 先接微信支付、支付宝

  * 后续如要出海，再扩 Stripe

* 模型定价策略：

  * 不在代码中写死价格

  * 价格由后台配置中心维护

  * 计费规则按“模型 + 能力 + 参数区间”配置

* 模型接入策略：

  * 前后端统一只认“标准模型协议”，不直接感知阿里 / 可灵 / 火山的原生差异

  * 每个 provider 由适配器负责把标准输入转换成各自 API 协议

  * 前台只拿统一输出结构，不感知 provider 差异

* 后台配置策略：

  * 密钥可后台录入，但必须加密存储

  * 所有敏感配置修改都写审计日志

  * 支持启停、权重、默认、可见范围、会员门槛、价格规则、参数限制统一管理

## Proposed Changes

### 一、仓库与系统边界调整

#### 1. 用户侧前端保持独立

* 保持现有用户侧仓库：`e:\workspace\ai-create-video`

* 用户端后续新增的页面只包含：

  * 点数余额展示页

  * 套餐购买页

  * 充值点数页

  * 订单/账单页

  * 扣点明细页

* 需要改动的现有用户侧文件：

  * `e:\workspace\ai-create-video\pages\dashboard.vue`

    * 增加用户余额、会员状态入口

  * `e:\workspace\ai-create-video\pages\index.vue`

    * 增加商业化入口，如“套餐”“点数”“升级会员”

  * `e:\workspace\ai-create-video\shared\api\services\authService.ts`

    * 后续扩展用户信息、会员信息、余额接口

  * `e:\workspace\ai-create-video\shared\api\services\dramaService.ts`

    * 生成前增加余额/扣点预估能力展示

#### 2. 新建独立管理后台项目

* 建议新增新仓库或并列目录：

  * `e:\workspace\ai-create-video-admin`

* 技术选型：

  * 基于 `Vue Vben Admin` 初始化

  * 自定义对接当前 FastAPI 管理接口

* 管理后台页面首期路由建议：

  * `/users`

  * `/models`

  * `/pricing-rules`

  * `/credit-accounts`

  * `/credit-ledgers`

  * `/plans`

  * `/point-packs`

  * `/orders`

  * `/payments`

  * `/usage-report`

  * `/system-config`

  * `/providers`

  * `/provider-credentials`

  * `/model-catalog`

  * `/model-routing`

### 一点五、统一模型治理架构

#### 1. 目标形态

* 后台不再按“阿里模型 / 火山模型 / 可灵模型”零散管理，而是统一成：

  * provider 配置层

  * 模型目录层

  * 路由与默认策略层

  * 价格规则层

  * 前台可见性层

* 前台拿到的始终是一套统一结构：

  * `provider`

  * `model_code`

  * `display_name`

  * `task_type`

  * `capabilities`

  * `limits`

  * `pricing_preview`

  * `visibility`

* 后台改配置后，前端无须改代码即可切换：

  * 默认 provider

  * 默认模型

  * 可见模型列表

  * 会员可用范围

  * 参数上限

  * 对应的真实 provider 接入通道

#### 2. 统一标准输入输出

* 针对三类任务统一标准输入：

  * 文本任务

  * 图片任务

  * 视频任务

* 标准视频任务输入建议统一为：

  * `task_type`

  * `provider`

  * `model_code`

  * `prompt`

  * `negative_prompt`

  * `duration_sec`

  * `resolution`

  * `ratio`

  * `audio_enabled`

  * `reference_assets`

  * `callback_context`

* 标准视频任务输出统一为：

  * `provider`

  * `model_code`

  * `provider_task_id`

  * `request_id`

  * `status`

  * `progress`

  * `video_url`

  * `cover_url`

  * `error_code`

  * `error_message`

  * `raw_meta`

* 文本、图片也采用同样模式，形成统一 provider 适配协议。

#### 3. provider 适配器工厂

* 建议新增统一 provider 工厂，而不是在业务代码里直接 `new AlibabaVideoClient()`：

  * `e:\workspace\ai-create-video-api\app\integrations\factories\provider_factory.py`

* 建议新增标准接口定义：

  * `e:\workspace\ai-create-video-api\app\integrations\contracts\text_provider.py`

  * `e:\workspace\ai-create-video-api\app\integrations\contracts\image_provider.py`

  * `e:\workspace\ai-create-video-api\app\integrations\contracts\video_provider.py`

* provider 实现建议拆分为：

  * `e:\workspace\ai-create-video-api\app\integrations\alibaba\*`

  * `e:\workspace\ai-create-video-api\app\integrations\huoshan\*`

  * `e:\workspace\ai-create-video-api\app\integrations\kling\*`

* 工厂行为：

  * 根据后台启用的 provider 凭据和模型目录，返回可用 provider client

  * 如果 provider 被停用或密钥失效，直接在服务层拒绝调用

#### 4. 前台只读运行时配置

* `e:\workspace\ai-create-video-api\app\services\config_service.py` 不再维护代码常量候选模型。

* 改造成：

  * 从数据库读取后台启用且允许前台可见的模型

  * 生成统一的 `RuntimeConfigResponse`

  * 根据用户会员等级 / 点数 / 业务场景过滤可见模型

* 前端仍只调原有运行时配置接口，但内容不再来自硬编码常量。

### 二、后端数据模型补齐

#### 1. 保留并扩展 `UsageLedger`

* 基于现有文件：

  * `e:\workspace\ai-create-video-api\app\models\assets.py`

* 当前 `UsageLedger` 可继续保留，但需要迁出为独立计费域模型，建议后续拆到：

  * `e:\workspace\ai-create-video-api\app\models\billing.py`

* 扩展字段建议：

  * `billing_status`

  * `deduct_credits`

  * `source_type`

  * `source_id`

  * `pricing_snapshot_json`

  * `refund_credits`

  * `refund_reason`

#### 2. 新增核心模型

* 建议在 `e:\workspace\ai-create-video-api\app\models\` 下新增：

  * `billing.py`

  * `payment.py`

  * `admin.py`

* 需要新增的实体：

  * `AdminUser`

  * `AdminRole`

  * `AdminPermission`

  * `CreditAccount`

  * `CreditLedger`

  * `MembershipPlan`

  * `MembershipSubscription`

  * `PointPack`

  * `Order`

  * `PaymentTransaction`

  * `RefundRecord`

  * `ProviderCatalog`

  * `ProviderCredential`

  * `ModelCatalog`

  * `ModelPricingRule`

  * `PricingSnapshot`

  * `WebhookEventLog`

  * `AuditLog`

#### 3. 计费规则模型设计

* `ProviderCatalog`

  * `provider_code`

  * `provider_name`

  * `task_types`

  * `is_enabled`

  * `priority`

  * `health_status`

* `ProviderCredential`

  * `provider_id`

  * `credential_name`

  * `base_url`

  * `encrypted_secret_json`

  * `is_default`

  * `is_enabled`

  * `environment`

  * `last_check_status`

  * `last_check_at`

* `ModelCatalog`

  * `provider_id`

  * `provider`

  * `model_code`

  * `model_name`

  * `display_name`

  * `model_type`

  * `is_enabled`

  * `supports_audio`

  * `supports_multi_image`

  * `visible_in_frontend`

  * `default_for_scene`

  * `member_only`

  * `sort_order`

  * `capability_json`

  * `limits_json`

  * `input_schema_json`

  * `output_schema_json`

* `ModelPricingRule`

  * `model_id`

  * `billing_unit`

  * `base_cost`

  * `step_cost`

  * `step_size`

  * `currency_cost`

  * `credits_cost`

  * `effective_from`

  * `effective_to`

  * `member_discount_json`

  * `fallback_rule_json`

* 计费维度支持：

  * 文本：按字数或 token 区间

  * 图片：按张数、分辨率、是否重绘

  * 视频：按秒数、分辨率、音频开关、参考图数量

### 三、后端接口与服务域拆分

#### 1. 管理接口

* 建议新增路由文件：

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_users.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_models.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_billing.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_orders.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_reports.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_providers.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\admin_runtime_config.py`

* 首期接口范围：

  * 用户列表、详情、封禁、补点

  * provider 凭据增删改查、健康检查、启停、默认切换

  * 模型启停、排序、标签、能力配置

  * 模型价格规则 CRUD

  * 模型前台可见范围配置

  * 默认模型与路由策略配置

  * 点数余额查询、手工加减点

  * 点数流水查询

  * 套餐与充值包 CRUD

#### 2. 服务域

* 建议新增服务：

  * `e:\workspace\ai-create-video-api\app\services\billing_service.py`

  * `e:\workspace\ai-create-video-api\app\services\credit_service.py`

  * `e:\workspace\ai-create-video-api\app\services\payment_service.py`

  * `e:\workspace\ai-create-video-api\app\services\pricing_service.py`

  * `e:\workspace\ai-create-video-api\app\services\admin_service.py`

  * `e:\workspace\ai-create-video-api\app\services\provider_service.py`

  * `e:\workspace\ai-create-video-api\app\services\model_registry_service.py`

  * `e:\workspace\ai-create-video-api\app\services\runtime_model_service.py`

* 各服务职责：

  * `pricing_service`：按模型和参数输出“应扣点数”

  * `credit_service`：账户余额、冻结、扣减、回滚

  * `billing_service`：落使用台账、账单归集、退款结算

  * `payment_service`：创建支付单、校验回调、对账

  * `admin_service`：后台通用管理逻辑

  * `provider_service`：provider 凭据、健康检查、加密存储、默认通道切换

  * `model_registry_service`：统一管理模型目录、能力、限制、可见性

  * `runtime_model_service`：面向前台生成“当前用户当前场景可见的模型配置”

#### 3. 鉴权体系

* 需改造现有：

  * `e:\workspace\ai-create-video-api\app\core\security.py`

  * `e:\workspace\ai-create-video-api\app\api\routes\auth.py`

* 补齐两套身份：

  * 用户身份

  * 管理员身份

* 管理端鉴权建议：

  * 独立管理员登录

  * JWT + refresh token

  * RBAC

  * 按接口与菜单双层校验

  * provider 密钥查看 / 修改仅限超管角色

#### 4. 必须去掉的后端硬编码点

* `e:\workspace\ai-create-video-api\app\services\config_service.py`

  * 删除代码常量候选列表

  * 改为数据库读取模型目录和前台可见配置

* `e:\workspace\ai-create-video-api\app\core\config.py`

  * 环境变量只保留底层应用配置与兼容兜底

  * 不再作为业务默认模型的长期真相源

  * `drama_*_provider`、`drama_*_model` 后续降级为初始化默认值

* `e:\workspace\ai-create-video-api\app\tasks\workflow_tasks.py`

  * 替换 `AlibabaVideoClient()` 为 provider factory

  * 不再默认“视频只能走阿里”

* `e:\workspace\ai-create-video-api\app\services\drama_service.py`

  * 替换 `AlibabaTextClient()`、`AlibabaImageClient()`

  * 删除 `qwen-plus / wanx / wan2.*` 的业务硬编码回退

  * 所有模型回退改为后台配置的 fallback 策略

* `e:\workspace\ai-create-video-api\app\api\routes\drama.py`

  * 依赖注入改为 provider-neutral service，不在路由层绑定阿里实现

* `e:\workspace\ai-create-video-api\app\integrations\alibaba\video_client.py`

  * 阿里专属约束继续保留在 provider adapter 内部

  * 但这些限制只在适配器里生效，不再污染通用业务层

### 四、盈利体系设计

#### 1. 商业模式基础版套餐 99.9 元 / 年，赠送 10,000 积分，支持 30 个子账号；

* 可叠加购买积分资源包，10 万积分 / 1,000 元，有效期 1 年；

- 会员套餐：

  * 月会员

  * 季会员

  * 年会员

- 会员权益建议：

  * 每月赠送点数

  * 更高并发

  * 更高阶模型访问权限

  * 更大上传限制

  * 视频优先队列

- 充值点数：

  * 小额试用包

  * 常规包

  * 大额包

#### 2. 扣点公式

* 文本任务：

  * `基础点数 + 字数阶梯点数 + 高级模型系数`

* 图片任务：

  * `基础点数 + 图片张数 * 单张成本 + 高清系数`

* 视频任务：

  * `基础点数 + 秒数 * 单秒成本 + 分辨率系数 + 音频系数 + 参考图数量系数`

#### 3. 计费流程

* 用户发起任务

* 前端请求“预估消耗”

* 后端根据 `ModelPricingRule` 返回：

  * 预计扣点

  * 点数是否充足

  * 执行建议

* 用户确认后提交任务

* 后端先冻结或直接扣除点数

* 任务成功：

  * 写入 `UsageLedger`

  * 写入 `CreditLedger`

* 任务失败：

  * 根据失败阶段决定是否全额退回/部分退回

#### 4. 点数账户规则

* `CreditAccount`

  * 当前总余额

  * 可用余额

  * 冻结余额

  * 赠送点数余额

  * 充值点数余额

  * 会员赠送点数余额

* 扣减顺序建议：

  * 先扣赠送点数

  * 再扣会员点数

  * 最后扣充值点数

### 五、支付与订单

#### 1. 国内支付优先方案

* 支付通道：

  * 微信支付

  * 支付宝

* 后端需新增支付适配层：

  * `wechat`

  * `alipay`

* 建议目录：

  * `e:\workspace\ai-create-video-api\app\integrations\payment\wechat_client.py`

  * `e:\workspace\ai-create-video-api\app\integrations\payment\alipay_client.py`

#### 2. 订单流程

* 创建订单

* 创建支付交易单

* 前端拉起支付

* 支付平台异步回调

* 后端幂等验签

* 更新订单状态

* 发放点数或开通会员

* 写审计日志与流水

### 六、管理后台页面范围

#### 首期必须页

* 用户管理

  * 用户基本信息

  * 当前余额

  * 会员状态

  * 封禁/解封

  * 人工补点/扣点

* 模型管理

  * 模型启停

  * 展示名称

  * provider

  * 适用业务

  * 默认值

  * 能力标签

  * 前台是否可见

  * 会员门槛

  * 参数上限

* Provider 管理

  * Provider 列表

  * 通道启停

  * 默认通道

  * 健康检查

  * 错误日志

* Provider 密钥管理

  * `base_url`

  * `api_key / secret`

  * 加密存储

  * 环境标记

  * 可用性校验

* 定价规则管理

  * 文本计费规则

  * 图片计费规则

  * 视频计费规则

* 点数流水

  * 获取

  * 扣减

  * 冻结

  * 回滚

* 系统配置

  * 默认模型

  * 默认分辨率

  * 默认套餐

  * 功能开关

#### 第二阶段页面

* 套餐管理

* 充值包管理

* 订单管理

* 支付管理

* 报表中心

* Webhook 日志

* 审计日志

* 模型路由策略

* provider 健康大盘

### 七、开源方案推荐与使用方式

#### 推荐方案

* 后台壳子：

  * 首选 `Vue Vben Admin`

  * 作用：只拿来做后台工程骨架、登录、路由、权限、表格、表单页结构

  * 业务页全部按你的项目自己写

* 备选：

  * `Soybean Admin`

  * 适合更轻量的中后台，但成熟度与生态资料略弱于 Vben

#### 不建议的方案

* 不建议在当前 `Nuxt 3` 用户端仓库里继续叠管理后台。

* 不建议整套照搬 SaaS 前端模板做管理后台。

* 不建议一开始为了后台把整套用户前端技术栈推翻。

#### 实施建议

* 管理后台不是“完全自己从零写”，而是：

  * 用成熟后台骨架搭工程

  * 用户、模型、点数、订单这些业务页自己写

* 这样能兼顾：

  * 交付速度

  * 后续可维护性

  * 不被模板绑死

## Verification Steps

### 方案确认检查

* 确认管理端采用独立项目，而不是继续并入当前 Nuxt 用户端。

* 确认盈利模式为“会员 + 点数充值 + 动态扣点”。

* 确认模型治理模式为“后台统一模型目录 + provider 适配器 + 前台只读可见模型”。

* 确认首期后台范围只做：

  * 用户

  * 模型

  * 点数

  * provider

* 确认支付优先顺序为：

  * 微信支付

  * 支付宝

### 实施前检查

* 检查当前后端目录中是否已有可复用的 `UsageLedger`、配置服务、模型服务。

* 检查现有登录体系是否能扩展出管理员身份，若不能则独立实现管理员登录。

* 检查用户侧前端哪些页面需要补余额、订单、充值入口。

* 检查当前所有直接依赖阿里 provider 的服务、任务、路由是否已全部替换为 provider factory。

* 检查当前所有候选模型与默认模型是否都改成数据库读取，而不是代码常量。

### 首期验收标准

* 后端可配置模型及其点数规则。

* 后端可通过后台任意启停 / 切换可灵、阿里、火山 provider 与模型。

* 后端不存在业务层 provider / model 硬编码。

* 后台可查看用户余额、流水、进行人工调账。

* 用户侧能看到剩余点数、预估扣点、真实扣点。

* 视频/图片/文本任务能按规则扣点并落库。

* 支付成功后可自动发放点数或开通会员。

