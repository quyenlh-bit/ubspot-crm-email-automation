-- ────────────────────────────────────────────────────────────────────────────
-- 0002_campaigns — email campaigns (Campaign builder)
--
-- A campaign targets contacts by lifecycle stage (null = all), starts from an
-- optional built-in template, and is dispatched via the send action. v1 send is
-- simulated (records recipient_count + sent_at); real provider dispatch hooks in
-- later. Like all business tables, every row carries tenant_id.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists campaigns (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  name                      text not null,
  template_id               text,                       -- built-in template id, if any
  subject                   text not null,
  body                      text not null,
  audience_lifecycle_stage  text,                        -- null = all contacts
  scheduled_at              timestamptz,
  status                    text not null default 'draft',  -- draft|scheduled|sending|sent
  recipient_count           integer,
  sent_at                   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_campaigns_tenant on campaigns (tenant_id, created_at desc);
