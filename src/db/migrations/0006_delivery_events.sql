-- ────────────────────────────────────────────────────────────────────────────
-- 0006_delivery_events — DELIVER channel fields + MEASURE event store
--
-- Campaigns gain a delivery channel (email/sms/zalo) and an optional voucher
-- code (UrBox offer injection). `message_events` is the tracking spine for the
-- MEASURE layer: message.sent/open/click and conversion (with amount) for
-- attribution, and it backs frequency capping (count recent sends per contact).
-- ────────────────────────────────────────────────────────────────────────────

alter table campaigns add column if not exists channel text not null default 'email';
alter table campaigns add column if not exists voucher_code text;

create table if not exists message_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  type         text not null,            -- message.sent|message.open|message.click|conversion
  email        text not null,
  channel      text,
  campaign_id  uuid references campaigns(id) on delete set null,
  journey_id   uuid references journeys(id) on delete set null,
  amount       numeric,                  -- conversion value (attribution)
  created_at   timestamptz not null default now()
);

create index if not exists idx_events_tenant on message_events (tenant_id, created_at desc);
create index if not exists idx_events_recent on message_events (tenant_id, email, type, created_at desc);
