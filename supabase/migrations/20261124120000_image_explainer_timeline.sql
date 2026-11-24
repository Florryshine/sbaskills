-- Phase 5: persist deterministic, audio-aligned visual execution timelines.
ALTER TABLE public.image_explainer_jobs
  ADD COLUMN IF NOT EXISTS timeline jsonb,
  ADD COLUMN IF NOT EXISTS timeline_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS image_explainer_timeline_review_idx
  ON public.image_explainer_jobs (status, updated_at DESC)
  WHERE timeline IS NOT NULL;
