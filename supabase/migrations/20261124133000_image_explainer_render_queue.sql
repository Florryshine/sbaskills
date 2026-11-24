-- Phase 6: durable Remotion render queue.
ALTER TABLE public.image_explainer_jobs ADD COLUMN IF NOT EXISTS render_attempt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_image_explainer_render_queue
  ON public.image_explainer_jobs(status, updated_at)
  WHERE status = 'rendering';

CREATE OR REPLACE FUNCTION public.claim_image_explainer_render_job(p_worker_id text)
RETURNS SETOF public.image_explainer_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.image_explainer_jobs
  SET status='failed', stage='render_failed',
      stage_message='Render worker lease expired after the retry limit.',
      error_message=COALESCE(error_message,'Rendering stopped responding after three attempts. Retry from the admin studio.'),
      claim_token=NULL, worker_id=NULL, heartbeat_at=NULL, updated_at=now()
  WHERE status='rendering' AND stage='render_processing' AND render_attempt_count>=3
    AND (heartbeat_at IS NULL OR heartbeat_at < now()-interval '15 minutes');

  RETURN QUERY
  WITH candidate AS (
    SELECT id FROM public.image_explainer_jobs
    WHERE status='rendering' AND stage='render_queued' AND render_attempt_count<3
    ORDER BY updated_at ASC
    FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE public.image_explainer_jobs j
  SET claim_token=gen_random_uuid(),
      worker_id=left(coalesce(p_worker_id,'image-explainer-renderer'),160),
      render_attempt_count=j.render_attempt_count+1, heartbeat_at=now(),
      stage='render_processing', stage_message='Renderer claimed the project and is preparing assets.',
      updated_at=now()
  FROM candidate WHERE j.id=candidate.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_image_explainer_render_job(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_image_explainer_render_job(text) TO service_role;
