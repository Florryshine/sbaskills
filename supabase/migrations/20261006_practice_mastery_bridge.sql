-- Practice -> curriculum topic -> student mastery bridge.
-- Existing questions remain usable even when they have not yet been
-- mapped to an official curriculum topic.

alter table public.past_questions
  add column if not exists curriculum_topic_id uuid
  references public.curriculum_topics(id)
  on delete set null;

create index if not exists idx_past_questions_curriculum_topic
  on public.past_questions(curriculum_topic_id);

create or replace function public.refresh_student_curriculum_mastery(p_user_id uuid, p_curriculum_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into student_topic_mastery (user_id, curriculum_topic_id)
  select p_user_id, ct.id
  from curriculum_topics ct
  where ct.curriculum_id = p_curriculum_id
  on conflict (user_id, curriculum_topic_id) do nothing;

  update student_topic_mastery stm
  set status = case
      when stm.mastery_score >= 80 and stm.questions_attempted >= 5 then 'mastered'
      when stm.mastery_score >= 60 then 'learning'
      when stm.questions_attempted > 0 then 'weak'
      else 'not_started'
    end,
    updated_at = now()
  from curriculum_topics ct
  where stm.curriculum_topic_id = ct.id
    and stm.user_id = p_user_id
    and ct.curriculum_id = p_curriculum_id;

  insert into student_subject_mastery
    (user_id, curriculum_id, subject, topics_total, topics_started, topics_mastered, mastery_percent)
  select
    p_user_id, p_curriculum_id, ct.subject,
    count(*)::int,
    count(*) filter (where stm.status <> 'not_started')::int,
    count(*) filter (where stm.status = 'mastered')::int,
    coalesce(round(avg(stm.mastery_score))::int, 0)
  from curriculum_topics ct
  left join student_topic_mastery stm
    on stm.curriculum_topic_id = ct.id and stm.user_id = p_user_id
  where ct.curriculum_id = p_curriculum_id
  group by ct.subject
  on conflict (user_id, curriculum_id, subject) do update set
    topics_total = excluded.topics_total,
    topics_started = excluded.topics_started,
    topics_mastered = excluded.topics_mastered,
    mastery_percent = excluded.mastery_percent,
    updated_at = now();

  insert into student_progress_summary
    (user_id, curriculum_id, topics_total, topics_started, topics_mastered, mastery_percent)
  select
    p_user_id, p_curriculum_id,
    count(*)::int,
    count(*) filter (where stm.status <> 'not_started')::int,
    count(*) filter (where stm.status = 'mastered')::int,
    coalesce(round(avg(stm.mastery_score))::int, 0)
  from curriculum_topics ct
  left join student_topic_mastery stm
    on stm.curriculum_topic_id = ct.id and stm.user_id = p_user_id
  where ct.curriculum_id = p_curriculum_id
  on conflict (user_id, curriculum_id) do update set
    topics_total = excluded.topics_total,
    topics_started = excluded.topics_started,
    topics_mastered = excluded.topics_mastered,
    mastery_percent = excluded.mastery_percent,
    updated_at = now();
end;
$$;

create or replace function public.record_jamb_practice_mastery(
  p_user_id uuid,
  p_question_ids uuid[],
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curriculum_id uuid;
  v_attempted integer := 0;
  v_correct integer := 0;
  v_q record;
  v_answer text;
  v_is_correct boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select curriculum_id
    into v_curriculum_id
  from public.student_exam_targets
  where user_id = p_user_id
    and upper(exam_type) = 'JAMB'
    and status = 'active'
  order by exam_year desc
  limit 1;

  if v_curriculum_id is null then
    return jsonb_build_object(
      'processed', 0,
      'message', 'No active JAMB exam target is configured for this student'
    );
  end if;

  for v_q in
    select
      pq.id,
      pq.curriculum_topic_id,
      pq.correct_answer
    from public.past_questions pq
    where pq.id = any(coalesce(p_question_ids, '{}'::uuid[]))
      and pq.curriculum_topic_id is not null
      and exists (
        select 1
        from public.curriculum_topics ct
        where ct.id = pq.curriculum_topic_id
          and ct.curriculum_id = v_curriculum_id
      )
  loop
    v_attempted := v_attempted + 1;

    v_answer := lower(coalesce(p_answers ->> v_q.id::text, ''));
    v_is_correct := v_answer = lower(coalesce(v_q.correct_answer, ''));

    if v_is_correct then
      v_correct := v_correct + 1;
    end if;

    insert into public.student_topic_mastery (
      user_id,
      curriculum_topic_id,
      questions_attempted,
      questions_correct,
      accuracy,
      mastery_score,
      status,
      last_practiced_at,
      updated_at
    )
    values (
      p_user_id,
      v_q.curriculum_topic_id,
      1,
      case when v_is_correct then 1 else 0 end,
      case when v_is_correct then 100 else 0 end,
      case when v_is_correct then 100 else 0 end,
      case
        when v_is_correct then 'learning'
        else 'weak'
      end,
      now(),
      now()
    )
    on conflict (user_id, curriculum_topic_id)
    do update set
      questions_attempted =
        student_topic_mastery.questions_attempted + 1,
      questions_correct =
        student_topic_mastery.questions_correct
        + case when v_is_correct then 1 else 0 end,
      accuracy =
        round(
          (
            (
              student_topic_mastery.questions_correct
              + case when v_is_correct then 1 else 0 end
            )::numeric
            /
            (
              student_topic_mastery.questions_attempted + 1
            )::numeric
          ) * 100,
          2
        ),
      mastery_score =
        round(
          (
            (
              student_topic_mastery.questions_correct
              + case when v_is_correct then 1 else 0 end
            )::numeric
            /
            (
              student_topic_mastery.questions_attempted + 1
            )::numeric
          ) * 100
        )::int,
      status =
        case
          when round(
            (
              (
                student_topic_mastery.questions_correct
                + case when v_is_correct then 1 else 0 end
              )::numeric
              /
              (
                student_topic_mastery.questions_attempted + 1
              )::numeric
            ) * 100
          ) >= 80
          and student_topic_mastery.questions_attempted + 1 >= 5
            then 'mastered'
          when round(
            (
              (
                student_topic_mastery.questions_correct
                + case when v_is_correct then 1 else 0 end
              )::numeric
              /
              (
                student_topic_mastery.questions_attempted + 1
              )::numeric
            ) * 100
          ) >= 60
            then 'learning'
          else 'weak'
        end,
      last_practiced_at = now(),
      updated_at = now();
  end loop;

  perform public.refresh_student_curriculum_mastery(
    p_user_id,
    v_curriculum_id
  );

  return jsonb_build_object(
    'processed', v_attempted,
    'correct', v_correct,
    'curriculum_id', v_curriculum_id
  );
end;
$$;

revoke all on function public.record_jamb_practice_mastery(uuid, uuid[], jsonb)
  from public;

grant execute on function public.record_jamb_practice_mastery(uuid, uuid[], jsonb)
  to authenticated;
