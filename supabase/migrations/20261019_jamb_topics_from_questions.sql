-- Record the topic-mapping migration that was already applied to Supabase.
-- Original applied migration: 20261019_map_jamb_questions_to_topics_mvp
-- This file mirrors the SQL stored in supabase_migrations.schema_migrations.

DO $$
DECLARE
  v_curriculum_id uuid;
BEGIN
  SELECT id INTO v_curriculum_id
  FROM public.curricula
  WHERE exam_type = 'JAMB' AND status = 'active'
  ORDER BY effective_from_year DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_curriculum_id IS NULL THEN
    RAISE EXCEPTION 'No active JAMB curriculum found';
  END IF;

  INSERT INTO public.curriculum_topics
    (curriculum_id, subject, title, node_type, source, order_index)
  SELECT
    v_curriculum_id,
    MIN(BTRIM(subject)),
    MIN(BTRIM(topic)),
    'topic',
    'past_questions_mvp',
    ROW_NUMBER() OVER (PARTITION BY LOWER(BTRIM(subject)) ORDER BY LOWER(BTRIM(topic)))::integer
  FROM public.past_questions
  WHERE exam_type = 'JAMB'
    AND subject IS NOT NULL AND BTRIM(subject) <> ''
    AND topic IS NOT NULL AND BTRIM(topic) <> ''
  GROUP BY LOWER(BTRIM(subject)), LOWER(BTRIM(topic))
  ON CONFLICT (curriculum_id, subject, title) DO NOTHING;

  UPDATE public.past_questions pq
  SET curriculum_topic_id = (
    SELECT ct.id
    FROM public.curriculum_topics ct
    JOIN public.curricula c ON c.id = ct.curriculum_id
    WHERE c.exam_type = 'JAMB'
      AND c.status = 'active'
      AND LOWER(BTRIM(ct.subject)) = LOWER(BTRIM(pq.subject))
      AND LOWER(BTRIM(ct.title)) = LOWER(BTRIM(pq.topic))
    ORDER BY (ct.source = 'past_questions_mvp') DESC, ct.created_at DESC
    LIMIT 1
  )
  WHERE pq.exam_type = 'JAMB'
    AND pq.topic IS NOT NULL AND BTRIM(pq.topic) <> ''
    AND pq.subject IS NOT NULL AND BTRIM(pq.subject) <> ''
    AND pq.curriculum_topic_id IS DISTINCT FROM (
      SELECT ct.id
      FROM public.curriculum_topics ct
      JOIN public.curricula c ON c.id = ct.curriculum_id
      WHERE c.exam_type = 'JAMB'
        AND c.status = 'active'
        AND LOWER(BTRIM(ct.subject)) = LOWER(BTRIM(pq.subject))
        AND LOWER(BTRIM(ct.title)) = LOWER(BTRIM(pq.topic))
      ORDER BY (ct.source = 'past_questions_mvp') DESC, ct.created_at DESC
      LIMIT 1
    );
END $$;
