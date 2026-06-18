-- ────────────────────────────────────────────────────────────────────────────
-- 0005_journeys — journey/orchestration engine (ORCHESTRATE layer)
--
-- A journey enrols a segment's members and walks ordered steps (send/wait/exit).
-- v1 runs on demand and is simulated; `last_run_summary` stores the per-step
-- result. Branching, A/B split, and time-based triggers come later.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists journeys (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  segment_id        uuid references segments(id) on delete set null,
  steps             jsonb not null default '[]'::jsonb,
  status            text not null default 'draft',     -- 'draft' | 'active'
  last_run_at       timestamptz,
  last_run_summary  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_journeys_tenant on journeys (tenant_id);
