'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function SortSelect({ sort }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', e.target.value);
    router.push(`/blog?${params.toString()}`);
  }

  return (
    <select
      name="sort"
      defaultValue={sort}
      onChange={handleChange}
      className="rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      <option value="newest">Newest</option>
      <option value="oldest">Oldest</option>
      <option value="popular">Most Comments</option>
    </select>
  );
}