-- ────────────────────────────────────────────────────────────────────────────
-- 0010_journey_runs — durable per-member journey execution state (ORCHESTRATE)
--
-- Replaces the fire-once worker with a state machine: each member enrolled in a
-- journey gets a run that tracks the node it is about to execute. At a `wait`
-- node the run parks (status='waiting', wake_at set) and the worker resumes it
-- when wake_at passes — so real time elapses and post-wait conditions (opened?)
-- evaluate against engagement that actually accrued. One run per (journey,email).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists journey_runs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  journey_id       uuid not null references journeys(id) on delete cascade,
  email            text not null,
  current_node_id  text,
  status           text not null default 'active',   -- active | waiting | completed
  wake_at          timestamptz,
  entered_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (journey_id, email)
);

create index if not exists idx_journey_runs_due on journey_runs (tenant_id, status, wake_at);
