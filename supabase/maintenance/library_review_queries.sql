-- Safe, read-only checks before cleaning up the live Shiney Library.
-- Run in Supabase SQL Editor. Review the results before deleting or unpublishing anything.

-- 1) Likely placeholder/test titles. This does not change any data.
select id, title, author, price, is_published, created_at, pdf_url
from public.books
where coalesce(is_published, false) = true
  and (
    lower(coalesce(title, '')) like '%test book%'
    or lower(coalesce(title, '')) like '%sample book%'
    or lower(coalesce(title, '')) like '%for testing%'
    or lower(coalesce(title, '')) = 'animal physiology'
  )
order by created_at desc;

-- 2) Exact duplicate published titles. Similar-but-not-identical titles need human review.
select
  lower(regexp_replace(trim(title), '\s+', ' ', 'g')) as normalized_title,
  count(*) as copies,
  array_agg(id order by created_at desc) as book_ids,
  array_agg(price order by created_at desc) as prices,
  array_agg(is_published order by created_at desc) as publication_states
from public.books
where coalesce(is_published, false) = true
group by lower(regexp_replace(trim(title), '\s+', ' ', 'g'))
having count(*) > 1
order by copies desc, normalized_title;

-- 3) Published rows missing a usable PDF/file URL.
select id, title, price, created_at, generation_status
from public.books
where is_published = true
  and nullif(trim(coalesce(pdf_url, file_url, '')), '') is null
order by created_at desc;
