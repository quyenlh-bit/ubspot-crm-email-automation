-- ────────────────────────────────────────────────────────────────────────────
-- 0001_init — CRM core schema (multi-tenant SaaS)
--
-- Design notes:
--   • Every business row carries tenant_id → the unit of isolation for this
--     SaaS. Enable Supabase RLS in a later migration and scope every policy by
--     tenant_id once auth/JWT claims are wired.
--   • `channel_connections` holds per-tenant CRM provider credentials (HubSpot,
--     Salesforce, Zoho, …). HubSpot is just one provider. `config` is JSONB:
--     {accessToken, appSecret, transactionalEmailId, ...}. [SECURITY] encrypt
--     this at rest (pgcrypto / Supabase Vault) before storing real secrets.
--   • Contacts/deals keep an `external_ids` JSONB map { provider: externalId }
--     so the core can round-trip a record to each connected CRM.
-- ────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Tenants ─────────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- CRM provider connections (one tenant may connect several providers) ──────────
create table if not exists channel_connections (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  provider    text not null,                 -- 'hubspot' | 'salesforce' | 'zoho'
  config      jsonb not null default '{}'::jsonb,  -- provider credentials/settings
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, provider)
);

-- Contacts (source of truth) ──────────────────────────────────────────────────
create table if not exists contacts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  email            text not null,
  first_name       text,
  last_name        text,
  phone            text,
  lifecycle_stage  text,
  external_ids     jsonb not null default '{}'::jsonb,  -- { provider: externalId }
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, email)
);

-- Deals ───────────────────────────────────────────────────────────────────────
create table if not exists deals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  name          text not null,
  amount        numeric,
  stage         text,
  external_ids  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Sync audit log (core ⇄ channel) ─────────────────────────────────────────────
create table if not exists sync_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  provider      text not null,
  direction     text not null,               -- 'outbound' | 'inbound'
  entity        text not null,               -- 'contact' | 'deal'
  entity_id     uuid,
  external_id   text,
  status        text not null,               -- 'ok' | 'error'
  detail        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_contacts_tenant on contacts (tenant_id);
create index if not exists idx_deals_tenant on deals (tenant_id);
create index if not exists idx_channel_connections_tenant on channel_connections (tenant_id);
create index if not exists idx_sync_log_tenant on sync_log (tenant_id, created_at desc);
