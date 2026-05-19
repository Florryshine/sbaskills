export default function VideoPlayer({ src, title }) {
  if (!src) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-brand-yellow bg-brand-yellow/10 text-center text-sm font-semibold text-brand-dark">
        This lesson video is coming soon.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-black shadow-soft">
      <video controls preload="metadata" className="aspect-video w-full" src={src}>
        Your browser does not support the video tag.
      </video>
      <div className="border-t border-slate-800 px-5 py-3 text-sm text-white/80">{title}</div>
    </div>
  );
}
