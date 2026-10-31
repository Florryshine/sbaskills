-- Storage bucket for the reusable SBA Question of the Day template and rendered images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sba-question-of-day', 'sba-question-of-day', true, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
