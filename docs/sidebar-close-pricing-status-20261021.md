# 侧栏关闭位置与采购接口状态（2026-10-21）

## UI修正与验证

- 展开按钮仅在侧栏收起时显示，独立关闭按钮位于侧栏内部右上角，使用UButton，不再覆盖Logo。
- 保留原路由收起与遮罩关闭，补齐打开后焦点定位、Esc关闭和关闭后焦点恢复。
- 真实浏览器800×800：侧栏宽212px，关闭键32×32、x167/y13，距右边缘13px；截图确认与Logo不重叠。
- 点击展开、点击关闭、Esc关闭、焦点返回展开入口实测通过，验收页控制台无error。临时视口已恢复，独立验收页已关闭。
- `node --test tests/sidebar-mobile-close.test.mjs tests/brand-nav-hover.test.mjs`：3项通过（含SFC脚本与模板编译）；`git diff --check`通过。本轮未重新生产构建，没有提交或部署。
- 截图：`.codex-runtime/sidebar-close-right.png`。

## 价格是否已用到

- `/v1/pricing`客户端、后台采购刷新接口及模型页刷新按钮已经连接：`account_client.fetch_pricing` → `ModelRepricingService.refresh_all` → 管理端模型页“刷新采购价格”。不是每次用户生成实时取采购价。
- 只读核查本地数据库：本轮新增8个模型的采购来源均为manual；服务端会跳过人工锁价。已有旧型号查询记录的supplier_refreshed_at为空，新型号时间来自初始化，不能将这个时间当作成功调用远端价格接口的证明。
- 本轮未执行采购刷新写操作，未查询带密钥的远端账号价格，也未修改任何采购/零售价。
- 生成报价仍读取库内档位。后台采购刷新不自动改变用户售价，需要另外预览并确认调价。
- Seedance最低Token快查表尚未进入实际报价计算；其用途与风险在`seedance-cost-table-review-20261021.md`中记录。
- 视频客户端与任务保存链已接收billing/usage，但这不能证明已完成成本核算和毛利对账闭环。
