-- Stickman 2 Image Presenter: persist typed project and compiled visual tracks.
-- Safe to apply more than once; legacy Stickman rows remain unchanged.
alter table public.stickman_jobs
  add column if not exists image_presenter_project jsonb,
  add column if not exists image_presenter_tracks jsonb;

comment on column public.stickman_jobs.image_presenter_project is
  'Optional Stickman 2 Image Presenter project. When non-null the worker uses the Image Presenter adapter; legacy SceneScript jobs are unaffected.';
comment on column public.stickman_jobs.image_presenter_tracks is
  'Compiled frame-synchronized image and annotation tracks consumed by the Remotion composition.';
