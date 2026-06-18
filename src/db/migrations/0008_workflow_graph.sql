-- ────────────────────────────────────────────────────────────────────────────
-- 0008_workflow_graph — journey v2 (visual workflow canvas, ORCHESTRATE)
--
-- Upgrade journeys from a linear step array to a graph: a trigger plus canvas
-- nodes (send/wait/condition/update/webhook/exit, with x/y) and directed edges
-- (with yes/no branch labels for conditions). Legacy `steps` is retained for
-- backward compatibility; status gains 'paused'.
-- ────────────────────────────────────────────────────────────────────────────

alter table journeys add column if not exists trigger jsonb;
alter table journeys add column if not exists nodes jsonb not null default '[]'::jsonb;
alter table journeys add column if not exists edges jsonb not null default '[]'::jsonb;
