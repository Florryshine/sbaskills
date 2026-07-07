# Podcast Engine — Setup Steps

## 1. Install the TTS package
```bash
npm install edge-tts-universal
```

## 2. Run the SQL migration
Copy `supabase/migrations/20260707_podcast_engine.sql` into the Supabase SQL
editor and run it. Creates `podcast_episodes` + `podcast_segments` tables
with RLS.

## 3. Create the storage bucket
Supabase Dashboard → Storage → New bucket:
- name: `podcast-audio`
- public: ✅ yes

(Same setup as your existing `audio-files` bucket.)

## 4. Copy these files into your repo (same paths)
```
lib/podcastTTS.js
lib/podcastPrompt.js
lib/llmFallbackChain.js
app/api/content-engine/podcast/generate/route.js
components/PodcastPlayer.js
components/AdminGeneratePodcastButton.js
app/blog/[slug]/page.js   ← replaces your existing file (adds podcast fetch + player, everything else unchanged)
```

## 5. Add the generate button to your admin content list
Wherever you list published posts in `/app/admin`, add next to each row:
```jsx
import AdminGeneratePodcastButton from '@/components/AdminGeneratePodcastButton';
// ...
<AdminGeneratePodcastButton contentDraftId={post.id} />
```

## 6. Test it
1. Pick a published post, click "🎙️ Generate Podcast" in admin.
2. Wait ~30-90 seconds (depends on script length — it's synthesizing every
   line one at a time).
3. Visit the blog post — the player appears right under the title/meta,
   above the article text.

## Notes
- No new env vars needed — Edge TTS requires no API key.
- If a line's TTS fails, that segment is just skipped (marked in
  `podcast_episodes.error_message`); regenerate to retry.
- `lib/llmFallbackChain.js` is a new shared helper — it does **not** touch
  your existing `app/api/content-engine/generate/route.js`, which keeps
  working exactly as before.
