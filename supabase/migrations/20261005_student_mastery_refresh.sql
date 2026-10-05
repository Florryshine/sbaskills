create or replace function public.refresh_student_curriculum_mastery(p_user_id uuid, p_curriculum_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into student_topic_mastery (user_id, curriculum_topic_id)
  select p_user_id, ct.id from curriculum_topics ct
  where ct.curriculum_id = p_curriculum_id
  on conflict (user_id, curriculum_topic_id) do nothing;

  update student_topic_mastery stm
  set status = case when stm.mastery_score >= 80 then 'mastered' when stm.mastery_score >= 60 then 'learning' when stm.questions_attempted > 0 then 'weak' else 'not_started' end,
      updated_at = now()
  from curriculum_topics ct
  where stm.curriculum_topic_id=ct.id and stm.user_id=p_user_id and ct.curriculum_id=p_curriculum_id;

  insert into student_subject_mastery (user_id,curriculum_id,subject,topics_total,topics_started,topics_mastered,mastery_percent)
  select p_user_id,p_curriculum_id,ct.subject,count(*)::int,count(*) filter(where stm.status<>'not_started')::int,count(*) filter(where stm.status='mastered')::int,coalesce(round(avg(stm.mastery_score))::int,0)
  from curriculum_topics ct left join student_topic_mastery stm on stm.curriculum_topic_id=ct.id and stm.user_id=p_user_id
  where ct.curriculum_id=p_curriculum_id group by ct.subject
  on conflict(user_id,curriculum_id,subject) do update set topics_total=excluded.topics_total,topics_started=excluded.topics_started,topics_mastered=excluded.topics_mastered,mastery_percent=excluded.mastery_percent,updated_at=now();

  insert into student_progress_summary(user_id,curriculum_id,topics_total,topics_started,topics_mastered,mastery_percent)
  select p_user_id,p_curriculum_id,count(*)::int,count(*) filter(where stm.status<>'not_started')::int,count(*) filter(where stm.status='mastered')::int,coalesce(round(avg(stm.mastery_score))::int,0)
  from curriculum_topics ct left join student_topic_mastery stm on stm.curriculum_topic_id=ct.id and stm.user_id=p_user_id
  where ct.curriculum_id=p_curriculum_id
  on conflict(user_id,curriculum_id) do update set topics_total=excluded.topics_total,topics_started=excluded.topics_started,topics_mastered=excluded.topics_mastered,mastery_percent=excluded.mastery_percent,updated_at=now();
end; $$;