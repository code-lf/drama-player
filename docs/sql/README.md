# SQL 文档规范（每次都保留完整 SQL）

这个目录用于管理数据库的**完整 SQL 快照**与**版本记录**。

## 目录约定
```txt
docs/sql/
  README.md
  CHANGELOG.md
  snapshots/
    2026-05-28_v1_full_schema.sql
```

## 维护规则（重要）
1. 每次数据库结构变更后，不只写增量 migration，也要产出一份**完整 SQL 快照**。
2. 快照命名：`YYYY-MM-DD_v{版本号}_full_schema.sql`。
3. `CHANGELOG.md` 要记录：
   - 版本号
   - 日期
   - 变更摘要
   - 对应完整快照文件
4. 前后端联调、测试、部署环境统一以“最新完整快照”为准。

## 推荐执行顺序
1. 在本地新库执行最新 `snapshots/*.sql`。
2. 再执行该版本对应的种子数据（如有）。
3. 启动后端服务并跑健康检查。

