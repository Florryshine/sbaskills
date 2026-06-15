import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function CourseCard({ course, href = `/courses/${course.id}`, actionLabel = 'View Details' }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md transition-all duration-300 hover:shadow-xl h-full">
      {/* Premium Thumbnail Container */}
      <div className="aspect-[16/10] w-full bg-slate-50 relative overflow-hidden">
        {course.thumbnail_url ? (
          <img 
            src={course.thumbnail_url} 
            alt={course.title} 
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" 
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-blue/5 text-xs font-bold tracking-wider text-brand-blue/40 uppercase">
            Shiney Brain Academy
          </div>
        )}
      </div>

      {/* Card Content Details */}
      <div className="flex flex-col flex-grow p-5 justify-between">
        <div className="space-y-3">
          {/* Title and Price Row */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[1.15rem] font-extrabold leading-snug text-brand-blue line-clamp-2">
              {course.title}
            </h3>
            <span className="shrink-0 rounded-lg bg-brand-yellow/15 px-2.5 py-1 text-xs font-black tracking-wide text-brand-dark border border-brand-yellow/30 uppercase">
              {Number(course.price) === 0 ? 'Free' : formatCurrency(course.price)}
            </span>
          </div>

          {/* Description Block */}
          <p className="line-clamp-3 text-xs leading-relaxed text-slate-500 font-medium">
            {course.description}
          </p>
        </div>

        {/* Premium Full-Width Action Button */}
        <div className="pt-5 mt-auto">
          <Link
            href={href}
            className="flex w-full items-center justify-center rounded-xl bg-brand-yellow py-3.5 text-center text-sm font-black text-brand-dark transition-all duration-200 hover:bg-brand-yellow/90 shadow-sm active:scale-[0.98]"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
              }
