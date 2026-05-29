-- =========================================================
-- Livliv 完整数据库快照（v1）
-- 日期：2026-05-28
-- 数据库：PostgreSQL 15+
-- 说明：用于开发/测试环境一键初始化
-- =========================================================

BEGIN;

-- 为 UUID 与更新时间触发器做准备
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 通用更新时间触发器
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 1) 用户与鉴权
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname          VARCHAR(64) NOT NULL DEFAULT '',
  avatar_url        TEXT NOT NULL DEFAULT '',
  wechat_openid     VARCHAR(128) UNIQUE,
  phone             VARCHAR(32),
  status            SMALLINT NOT NULL DEFAULT 1, -- 1=正常, 0=禁用
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_wechat_openid ON users (wechat_openid);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 微信扫码登录票据（轮询态）
CREATE TABLE IF NOT EXISTS wechat_login_tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code       VARCHAR(128) NOT NULL UNIQUE,
  qr_code_url       TEXT NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending/scanned/confirmed/expired
  user_id           UUID REFERENCES users(id),
  expire_at         TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wechat_tickets_status ON wechat_login_tickets (status);
CREATE INDEX IF NOT EXISTS idx_wechat_tickets_expire_at ON wechat_login_tickets (expire_at);

DROP TRIGGER IF EXISTS trg_wechat_login_tickets_updated_at ON wechat_login_tickets;
CREATE TRIGGER trg_wechat_login_tickets_updated_at
BEFORE UPDATE ON wechat_login_tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 会话表（可选：若后续完全 JWT，可只做 refresh token 存储）
CREATE TABLE IF NOT EXISTS auth_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  access_token      TEXT NOT NULL,
  refresh_token     TEXT NOT NULL,
  expire_at         TIMESTAMPTZ NOT NULL,
  user_agent        TEXT NOT NULL DEFAULT '',
  ip                VARCHAR(64) NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expire_at ON auth_sessions (expire_at);

DROP TRIGGER IF EXISTS trg_auth_sessions_updated_at ON auth_sessions;
CREATE TRIGGER trg_auth_sessions_updated_at
BEFORE UPDATE ON auth_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 2) 项目与画布
-- =========================================================

CREATE TABLE IF NOT EXISTS projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES users(id),
  title             VARCHAR(128) NOT NULL DEFAULT '未命名项目',
  cover_url         TEXT NOT NULL DEFAULT '',
  category          VARCHAR(64) NOT NULL DEFAULT 'AI漫剧',
  status            VARCHAR(16) NOT NULL DEFAULT 'draft', -- draft/generating/published/archived
  description       TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects (updated_at DESC);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 画布版本：完整快照存储（JSONB）
CREATE TABLE IF NOT EXISTS canvas_graph_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_no        INTEGER NOT NULL,
  graph_data        JSONB NOT NULL, -- {nodes, edges, viewport, version}
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_canvas_graph_versions_project_id ON canvas_graph_versions (project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_graph_versions_created_at ON canvas_graph_versions (created_at DESC);

-- =========================================================
-- 3) 工作流执行
-- =========================================================

CREATE TABLE IF NOT EXISTS workflow_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trigger_node_id   VARCHAR(128) NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending/running/success/failed/cancelled
  input_snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code        VARCHAR(64) NOT NULL DEFAULT '',
  error_message     TEXT NOT NULL DEFAULT '',
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_id ON workflow_runs (project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs (status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs (created_at DESC);

DROP TRIGGER IF EXISTS trg_workflow_runs_updated_at ON workflow_runs;
CREATE TRIGGER trg_workflow_runs_updated_at
BEFORE UPDATE ON workflow_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS node_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id           VARCHAR(128) NOT NULL,
  node_type         VARCHAR(32) NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending/running/success/failed/skipped
  retry_count       INTEGER NOT NULL DEFAULT 0,
  input_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code        VARCHAR(64) NOT NULL DEFAULT '',
  error_message     TEXT NOT NULL DEFAULT '',
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_runs_run_id ON node_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_node_runs_project_id ON node_runs (project_id);
CREATE INDEX IF NOT EXISTS idx_node_runs_node_id ON node_runs (node_id);
CREATE INDEX IF NOT EXISTS idx_node_runs_status ON node_runs (status);

DROP TRIGGER IF EXISTS trg_node_runs_updated_at ON node_runs;
CREATE TRIGGER trg_node_runs_updated_at
BEFORE UPDATE ON node_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 4) 分镜数据
-- =========================================================

CREATE TABLE IF NOT EXISTS storyboard_rows (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_id            VARCHAR(128) NOT NULL,
  shot_no                   INTEGER NOT NULL,
  duration_sec              NUMERIC(6,2) NOT NULL DEFAULT 3,
  scene_description         TEXT NOT NULL DEFAULT '',
  role_name                 VARCHAR(128) NOT NULL DEFAULT '',
  shot_type                 VARCHAR(128) NOT NULL DEFAULT '',
  action_desc               TEXT NOT NULL DEFAULT '',
  mood_desc                 VARCHAR(128) NOT NULL DEFAULT '',
  sound_fx                  TEXT NOT NULL DEFAULT '',
  dialogue                  TEXT NOT NULL DEFAULT '',
  storyboard_prompt         TEXT NOT NULL DEFAULT '',
  camera_motion_prompt      TEXT NOT NULL DEFAULT '',
  extra_json                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, source_node_id, shot_no)
);

CREATE INDEX IF NOT EXISTS idx_storyboard_rows_project_id ON storyboard_rows (project_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_rows_source_node_id ON storyboard_rows (source_node_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_rows_shot_no ON storyboard_rows (shot_no);

DROP TRIGGER IF EXISTS trg_storyboard_rows_updated_at ON storyboard_rows;
CREATE TRIGGER trg_storyboard_rows_updated_at
BEFORE UPDATE ON storyboard_rows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 5) 资产与输出引用
-- =========================================================

CREATE TABLE IF NOT EXISTS assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id          UUID REFERENCES users(id),
  asset_type        VARCHAR(16) NOT NULL, -- image/video/audio/file
  provider          VARCHAR(64) NOT NULL DEFAULT 'local',
  storage_bucket    VARCHAR(128) NOT NULL DEFAULT '',
  storage_key       TEXT NOT NULL,
  public_url        TEXT NOT NULL DEFAULT '',
  mime_type         VARCHAR(128) NOT NULL DEFAULT '',
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  width             INTEGER,
  height            INTEGER,
  duration_sec      NUMERIC(8,2),
  meta_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets (project_id);
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets (owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets (created_at DESC);

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 节点输出引用：把 node_run 结果映射到资产
CREATE TABLE IF NOT EXISTS node_output_refs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_run_id       UUID NOT NULL REFERENCES node_runs(id) ON DELETE CASCADE,
  node_id           VARCHAR(128) NOT NULL,
  ref_type          VARCHAR(32) NOT NULL, -- image/video/audio/storyboard/json
  asset_id          UUID REFERENCES assets(id) ON DELETE SET NULL,
  ref_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_output_refs_project_id ON node_output_refs (project_id);
CREATE INDEX IF NOT EXISTS idx_node_output_refs_node_run_id ON node_output_refs (node_run_id);
CREATE INDEX IF NOT EXISTS idx_node_output_refs_node_id ON node_output_refs (node_id);

-- =========================================================
-- 6) 用量与计费（首期可先只记录）
-- =========================================================

CREATE TABLE IF NOT EXISTS usage_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  run_id            UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  provider          VARCHAR(64) NOT NULL,
  model_name        VARCHAR(128) NOT NULL DEFAULT '',
  usage_type        VARCHAR(32) NOT NULL, -- token/image/video/audio/storage
  quantity          NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_price        NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_price       NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency          VARCHAR(16) NOT NULL DEFAULT 'CNY',
  meta_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_id ON usage_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_project_id ON usage_ledger (project_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_run_id ON usage_ledger (run_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_created_at ON usage_ledger (created_at DESC);

COMMIT;

-- =========================================================
-- 快照结束
-- =========================================================
