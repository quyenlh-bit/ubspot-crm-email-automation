-- ────────────────────────────────────────────────────────────────────────────
-- 0009_journey_enrollments — journey worker enrollment state (ORCHESTRATE)
--
-- Tracks which contacts have already been enrolled into a journey, so the
-- background worker can pick up only NEW segment members each tick and run
-- them through the graph once (instead of re-sending to everyone).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists journey_enrollments (
  journey_id   uuid not null references journeys(id) on delete cascade,
  email        text not null,
  enrolled_at  timestamptz not null default now(),
  primary key (journey_id, email)
);
