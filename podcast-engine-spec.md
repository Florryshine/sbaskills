# Shiney Brain Academy — AI Podcast Engine (Technical Spec)

## 1. What this adds

Every published `content_drafts` post gets a **"Generate Podcast"** button in
admin. That produces a two-host conversational audio version of the lesson,
using content you've already written — no new writing work per post.

```
content_drafts (existing post)
        ↓
LLM turns article → 2-host conversation script (JSON)
        ↓
Each line synthesized with Edge TTS (free, unlimited, no API key)
        ↓
Segments uploaded to Supabase Storage
        ↓
Player embedded on the blog post page + a new /podcasts library page
```

## 2. Why this architecture (serverless-friendly)

Vercel functions don't have `ffmpeg`, and third-party TTS-stitching adds
latency/cost. So instead of generating **one merged audio file** server-side,
we generate **one audio file per line of dialogue** and let the browser
`<audio>` element play them back‑to‑back. This:

- Needs zero audio processing on the server (just TTS + upload).
- Lets us highlight the *current speaker's line* in the transcript for free
  (we already know which segment is playing) — this is the foundation for
  the "Study Mode" feature from your brainstorm.
- Fails gracefully — if one line's TTS fails, we can regenerate just that
  segment instead of redoing the whole episode.

Trade-off: a ~150–300ms gap between lines. Acceptable for Phase 1; Phase 2
can pre-buffer the next segment to make it seamless.

## 3. Voices (free, unlimited — Edge TTS)

Edge TTS (`edge-tts-universal` npm package) is unofficial-but-widely-used,
free, no API key, no rate limit in practice. It's the same engine behind
the "Ezinne" voice already used in `sba_generator`.

| Role | Voice | Why |
|---|---|---|
| Host A — Teacher | `en-NG-EzinneNeural` | Already your brand voice, Nigerian, warm/authoritative |
| Host B — Student/Examiner | `en-US-AvaMultilingualNeural` (or `en-NG-AbeoNeural` if you want both hosts Nigerian) | Multilingual-neural voices are Microsoft's newest generation — noticeably more natural and expressive than the older standard voices, not robotic |

Emotion/expressiveness: the multilingual neural voices infer tone from
punctuation and phrasing reasonably well on their own. We also programmatically
vary `rate` and `pitch` per line based on a tag the LLM assigns to that line
(`curious`, `excited`, `calm`, `emphatic`) — cheap, free, and works with any
Edge voice, so no lock-in to a paid emotional-TTS provider.

If quality still isn't enough later, ElevenLabs can be dropped in later as a
paid upgrade path without changing the pipeline shape (same "segments" model).

## 4. Data model (new tables)

```sql
podcast_episodes
  id, content_draft_id (fk), title, status (draft|generating|ready|failed),
  host_a_voice, host_b_voice, total_duration_seconds, created_at

podcast_segments
  id, episode_id (fk), position, speaker (host_a|host_b),
  text, emotion_tag, audio_url, duration_seconds
```

Kept separate from `content_drafts` so regenerating a podcast never touches
the article, and a post can have zero or one active episode.

## 5. Script generation prompt (the core trick)

Reuses your existing Gemini → Groq → OpenRouter → HuggingFace fallback chain
(same pattern as `app/api/content-engine/generate/route.js`). The prompt:

- Forces strict JSON output: `[{ "speaker": "host_a", "text": "...", "emotion": "curious" }, ...]`
- Caps each line at 1–3 sentences so it sounds like conversation, not monologue
- Requires a "Rapid Fire Revision" closing block (mini quiz, 3 Q&A pairs)
- For Post-UTME/JAMB content specifically, uses the "Teacher vs Examiner" persona
  instead of "Teacher vs Student" (ties directly to exam prep, per your idea)

## 6. Phased rollout (matches what you outlined)

**Phase 1 (this build)**
- Script generation from any published post
- Edge TTS segment generation (Ezinne + one other free natural voice)
- Sequential-segment audio player with transcript, embedded on the blog post
- Admin trigger button + status tracking

**Phase 2**
- Voice picker (swap Host B voice per subject, e.g. warmer voice for CRS, snappier for Chemistry)
- Playback speed control (1x/1.5x/2x)
- Download button (concatenate segments client-side into one file on demand, via `ffmpeg.wasm` — only runs on user's device, not the server)
- Pre-buffering next segment to remove the gap between lines

**Phase 3**
- Daily auto-generated episode (cron via Vercel scheduled function)
- Weekly "JAMB News" / exam-tips / motivation formats as separate episode "types"
- Study Mode: tap-a-sentence → ask AI mentor, bookmarks, keyword highlighting

## 7. What I'm building right now

1. SQL migration for the two new tables + RLS
2. `lib/podcastTTS.js` — Edge TTS wrapper (two-voice, emotion→prosody mapping)
3. `app/api/content-engine/podcast/generate/route.js` — script gen + TTS + upload, reusing your fallback chain
4. `components/PodcastPlayer.js` — sequential playback + live transcript highlight
5. Wire-up: "🎧 Listen" block on `app/blog/[slug]/page.js` when an episode exists

You'll need to add one npm package (`edge-tts-universal`) and create a
`podcast-audio` public bucket in Supabase Storage (same pattern as your
existing `audio-files` bucket).
