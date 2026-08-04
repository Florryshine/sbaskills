-- student_topic_progress was created pointing at knowledge_assets (the
-- private admin table). Since nothing has written to this table yet, this
-- repoints it at game_topics instead — the public entity students actually
-- see and interact with — and renames the column to match.

alter table public.student_topic_progress
  drop constraint if exists student_topic_progress_knowledge_asset_id_fkey;

alter table public.student_topic_progress
  rename column knowledge_asset_id to game_topic_id;

alter table public.student_topic_progress
  add constraint student_topic_progress_game_topic_id_fkey
  foreign key (game_topic_id) references public.game_topics(id) on delete cascade;
