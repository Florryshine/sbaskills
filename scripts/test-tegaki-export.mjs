import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'app/api/admin/tegaki-studio/export/route.js',
  'app/api/admin/tegaki-studio/music/route.js',
  'local-video-renderer/tegaki-worker.js',
  'remotion/Root.jsx',
  'remotion/StudioComposition.jsx',
  '.github/workflows/tegaki-render.yml',
  'supabase/migrations/20261127050000_tegaki_export_jobs.sql',
  'app/admin/tegaki-studio/page.js',
].map(async path => [path, await readFile(new URL('../' + path, import.meta.url), 'utf8')])));

assert.match(files['app/api/admin/tegaki-studio/export/route.js'], /requireAdminApi/);
assert.match(files['app/api/admin/tegaki-studio/export/route.js'], /knowledge_assets/);
assert.match(files['app/api/admin/tegaki-studio/export/route.js'], /trustedStorageUrl/);
assert.match(files['app/api/admin/tegaki-studio/export/route.js'], /aspectRatio/);
assert.match(files['app/api/admin/tegaki-studio/music/route.js'], /20 \* 1024 \* 1024/);
assert.match(files['local-video-renderer/tegaki-worker.js'], /claim_tegaki_job/);
assert.match(files['local-video-renderer/tegaki-worker.js'], /renderMedia/);
assert.match(files['local-video-renderer/tegaki-worker.js'], /content_assets/);
assert.match(files['local-video-renderer/tegaki-worker.js'], /media_files/);
assert.match(files['remotion/Root.jsx'], /id="TegakiVideo"/);
assert.match(files['remotion/Root.jsx'], /ratio==='16:9'/);
assert.match(files['remotion/Root.jsx'], /ratio==='1:1'/);
assert.match(files['remotion/StudioComposition.jsx'], /musicSrc\?<Audio src=\{musicSrc\} volume=\{musicVolume\} loop/);
assert.match(files['remotion/StudioComposition.jsx'], /dark-chalkboard/);
assert.match(files['.github/workflows/tegaki-render.yml'], /repository_dispatch:/);
assert.match(files['supabase/migrations/20261127050000_tegaki_export_jobs.sql'], /claim_tegaki_job/);
assert.match(files['supabase/migrations/20261127050000_tegaki_export_jobs.sql'], /tegaki-assets/);
assert.match(files['app/admin/tegaki-studio/page.js'], /Render and save MP4/);
assert.match(files['app/admin/tegaki-studio/page.js'], /Export history/);
assert.match(files['app/admin/tegaki-studio/page.js'], /16:9/);
assert.match(files['app/admin/tegaki-studio/page.js'], /Background music/);

console.log('Tegaki export pipeline structural checks passed.');
