-- Adds a manual ordering field for topics within a subject. Prerequisites
-- (prerequisite_ids) already control the unlock LOGIC; this controls DISPLAY
-- order on the syllabus map when multiple topics have no prerequisite
-- relationship to each other (e.g. two independent "first topics" in a
-- subject). Nullable — topics without it just sort by created_at as a
-- sane fallback, so this is safe to leave unset while backfilling content.
alter table public.knowledge_assets
  add column if not exists order_index integer;

comment on column public.knowledge_assets.order_index is
  'Manual display order within a subject on the syllabus map. Lower = earlier. Null falls back to created_at order.';
