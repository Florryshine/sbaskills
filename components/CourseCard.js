import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function CourseCard({ course, href = `/courses/${course.id}`, actionLabel = 'View Details' }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
      <div className="relative aspect-[16/9] w-full bg-slate-100">
        {course.thumbnail_url ? (
          <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 400px" />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-blue/10 text-sm font-semibold text-brand-blue">
            Shiney Brain Academy
          </div>
        )}
      </div>
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-brand-blue">{course.title}</h3>
          <span className="rounded-full bg-brand-yellow/20 px-3 py-1 text-xs font-bold text-brand-dark">
            {Number(course.price) === 0 ? 'Free' : formatCurrency(course.price)}
          </span>
        </div>
        <p className="line-clamp-3 text-sm leading-6 text-slate-600">{course.description}</p>
        <Link
          href={href}
          className="inline-flex rounded-full bg-brand-yellow px-5 py-3 text-sm font-bold text-brand-dark transition hover:opacity-90"
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
