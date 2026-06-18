-- ────────────────────────────────────────────────────────────────────────────
-- 0007_api_keys — RBAC (FOUNDATION)
--
-- Per-tenant API keys with a role (admin/editor/viewer). When REQUIRE_AUTH=true
-- the /api layer requires an x-api-key header and enforces the role on
-- mutations. Default is open (no key) for local/demo use.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null unique,
  role        text not null default 'viewer',   -- admin | editor | viewer
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_api_keys_tenant on api_keys (tenant_id);
