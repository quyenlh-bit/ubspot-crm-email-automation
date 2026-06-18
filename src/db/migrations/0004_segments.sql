-- ────────────────────────────────────────────────────────────────────────────
-- 0004_segments — segmentation engine (TARGET layer)
--
-- A segment is a reusable audience. `dynamic` segments evaluate a rule live
-- (lifecycle stages); `static` segments hold an explicit list of emails.
-- Campaigns (and later journeys) target a segment.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists segments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  type              text not null default 'dynamic',          -- 'static' | 'dynamic'
  lifecycle_stages  jsonb not null default '[]'::jsonb,        -- dynamic rule
  member_emails     jsonb not null default '[]'::jsonb,        -- static membership
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_segments_tenant on segments (tenant_id);

alter table campaigns
  add column if not exists segment_id uuid references segments(id) on delete set null;
