# 独立管理后台与盈利体系方案

## Summary

* 目标：在不污染当前用户侧 `Nuxt 3` 主站的前提下，新增一套独立管理后台，并补齐商业化所需的会员、点数、模型定价、动态扣点、订单支付、后台配置能力。

* 当前结论：

  * 用户侧前端继续保留现有仓库 `e:\workspace\ai-create-video`，不建议把管理后台继续塞进这个仓库。

  * 管理后台建议独立成新前端项目，优先选用 `Vue Vben Admin` 作为后台壳子，自定义业务页面，不建议整套从零写。

  * 盈利体系采用“会员套餐 + 单独充值点数 + 按实际用量动态扣点”的双层模式。

  * 支付优先支持国内：微信支付、支付宝。

  * 首期后台聚焦：用户、模型、点数；订单/支付作为第二阶段补齐。

* 推荐落地路线：

  * 阶段 1：先补后端基础能力与数据模型。

  * 阶段 2：新建独立 `admin-web` 管理端。

  * 阶段 3：接入支付与点数结算。

  * 阶段 4：上线运营报表、人工调账、模型成本配置。

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

* 管理后台采用独立项目，不与当前用户端 Nuxt 仓库混写。

* 支付优先面向国内支付场景。

* 盈利体系采用：

  * 会员套餐：提供月包/季包/年包权益

  * 单独充值点数：适合重度用户追加购买

  * 动态扣点：根据模型、字数、图片数、视频秒数、分辨率、是否有声等参数计算

* 首期后台优先做：

  * 用户管理

  * 模型管理

  * 点数管理

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

  * `ModelCatalog`

  * `ModelPricingRule`

  * `PricingSnapshot`

  * `WebhookEventLog`

  * `AuditLog`

#### 3. 计费规则模型设计

* `ModelCatalog`

  * provider

  * model\_code

  * model\_name

  * model\_type

  * is\_enabled

  * supports\_audio

  * supports\_multi\_image

* `ModelPricingRule`

  * model\_id

  * billing\_unit

  * base\_cost

  * step\_cost

  * step\_size

  * currency\_cost

  * credits\_cost

  * effective\_from

  * effective\_to

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

* 首期接口范围：

  * 用户列表、详情、封禁、补点

  * 模型启停、排序、标签、能力配置

  * 模型价格规则 CRUD

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

* 各服务职责：

  * `pricing_service`：按模型和参数输出“应扣点数”

  * `credit_service`：账户余额、冻结、扣减、回滚

  * `billing_service`：落使用台账、账单归集、退款结算

  * `payment_service`：创建支付单、校验回调、对账

  * `admin_service`：后台通用管理逻辑

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

### 四、盈利体系设计

#### 1. 商业模式

* 会员套餐：

  * 月会员

  * 季会员

  * 年会员

* 会员权益建议：

  * 每月赠送点数

  * 更高并发

  * 更高阶模型访问权限

  * 更大上传限制

  * 视频优先队列

* 充值点数：

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

* 确认首期后台范围只做：

  * 用户

  * 模型

  * 点数

* 确认支付优先顺序为：

  * 微信支付

  * 支付宝

### 实施前检查

* 检查当前后端目录中是否已有可复用的 `UsageLedger`、配置服务、模型服务。

* 检查现有登录体系是否能扩展出管理员身份，若不能则独立实现管理员登录。

* 检查用户侧前端哪些页面需要补余额、订单、充值入口。

### 首期验收标准

* 后端可配置模型及其点数规则。

* 后台可查看用户余额、流水、进行人工调账。

* 用户侧能看到剩余点数、预估扣点、真实扣点。

* 视频/图片/文本任务能按规则扣点并落库。

* 支付成功后可自动发放点数或开通会员。

