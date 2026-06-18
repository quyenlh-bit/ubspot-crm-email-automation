-- ────────────────────────────────────────────────────────────────────────────
-- 0003_consent_suppression — compliance gate (Decree 13/2023/ND-CP)
--
-- Marketing consent is a LEGAL GATE, not a feature: a contact may only be
-- messaged on a channel they opted in to, and never if they are on the
-- suppression list (unsubscribed / hard bounce / manual). The delivery layer
-- must consult both before sending.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists contact_consent (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  channel     text not null,              -- 'email' | 'sms' | 'zalo'
  opted_in    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, email, channel)
);

create table if not exists suppression_list (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists idx_suppression_tenant on suppression_list (tenant_id);
