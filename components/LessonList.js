import Link from 'next/link';

export default function LessonList({ lessons = [], enrolled = false, courseId, completedLessonIds = [] }) {
  return (
    <div className="space-y-4">
      {lessons.map((lesson, index) => {
        const isCompleted = completedLessonIds.includes(lesson.id);

        return (
          <div key={lesson.id} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Lesson {index + 1}</p>
              <h3 className="mt-1 text-lg font-bold text-brand-blue">{lesson.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{lesson.description}</p>
            </div>
            <div className="flex items-center gap-3">
              {isCompleted ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Completed</span>
              ) : null}
              {lesson.content_type === 'video' && !lesson.video_url ? (
                <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-dark">Coming Soon</span>
              ) : null}
              {enrolled && lesson.is_published && (lesson.content_type !== 'video' || lesson.video_url) ? (
                <Link
                  href={`/courses/${courseId}/lessons/${lesson.id}`}
                  className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
                >
                  {lesson.content_type === 'bite_sized' ? 'Learn Lesson' : 'Watch Lesson'}
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
