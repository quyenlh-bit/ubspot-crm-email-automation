-- ────────────────────────────────────────────────────────────────────────────
-- 0011_journey_goal_vouchers — journey goals + voucher lifecycle
--
-- goal: a member who meets the journey goal (conversion / voucher redeemed /
--   lifecycle) exits early as 'converted' (run status).
-- vouchers: UrBox's loyalty primitive — issued on a send-with-voucher, redeemed
--   via the redeem endpoint (which records a conversion event for attribution),
--   and expired by the worker. Powers voucher_redeemed conditions/goals.
-- ────────────────────────────────────────────────────────────────────────────

alter table journeys add column if not exists goal jsonb;

create table if not exists vouchers (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  email        text not null,
  code         text not null,
  amount       numeric not null default 0,
  status       text not null default 'issued',   -- issued | redeemed | expired
  campaign_id  uuid references campaigns(id) on delete set null,
  journey_id   uuid references journeys(id) on delete set null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz,
  redeemed_at  timestamptz
);

create index if not exists idx_vouchers_tenant on vouchers (tenant_id, issued_at desc);
create index if not exists idx_vouchers_email on vouchers (tenant_id, email);
