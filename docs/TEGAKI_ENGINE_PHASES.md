# Tegaki Studio — extraction and build plan

## Phase 1: Independent foundation
- Dedicated admin route at `/admin/tegaki-studio` with editable lesson content and a continuous Remotion preview.
- Engine contract, lesson scene normaliser and visual-style registry.
- Reuse the existing Remotion Tegaki composition without moving or deleting it.

## Phase 2: Visual style system
- Six visual treatments: Classic Notebook, Premium Notes, Exam Revision, Colourful Classroom, Dark Chalkboard and Digital Study Pad.
- Real PNG page previews through `/api/admin/tegaki-studio/preview`.
- Tegaki renderer adapter reuses Notebook Studio's SVG builder without changing its existing API.

## Phase 3: Intelligent lesson composition (implemented on this branch)
- Subject and Knowledge Asset topic selector backed by `knowledge_assets`.
- Dedicated composition API grounded in the selected asset's summary, concepts, definitions, examples, facts and common mistakes.
- Structured 3–6-scene lesson storyboard with compact handwritten sections, teacher narration, key takeaways and illustration cues.
- Illustration IDs are checked against the SBA-authored 70-item vector asset catalogue; topic-to-illustration mapping is conservative.
- Scene timing is weighted by narration length and the target duration; malformed AI output is rejected by a strict schema validator.
- No content draft rows, storage uploads or external media assets are created by lesson composition.

## Phase 4: Animation and audio (implemented on this branch)
- Dedicated admin-protected narration endpoint generates one audio track per storyboard scene using the existing SBA Nigerian-English TTS pipeline.
- Reuses the Knowledge Asset narration cache (`ka_components` + `ka-component-audio`) when a source asset is selected; manual/sample lessons can still generate direct audio.
- Voice selection (female/male), delivery style, narration volume and scene-by-scene audio attachment are exposed in Tegaki Studio.
- Scene durations expand to cover estimated speech length plus a short visual hold; the Remotion handwriting reveal now completes near the end of the scene so it remains paced with narration.
- TTS is deliberately sequential to avoid rate-limit failures from the shared Edge voice service.
- Admin authorization is enforced on Tegaki assets, composition, preview and narration APIs.
- Diagram cues continue to fade between their configured scene-relative cue points; optional music mixing and final export remain for Phase 5 after the audio workflow is validated.

## Phase 5: Export and publishing (implemented on this branch)
- Three MP4 export presets: 9:16 portrait, 16:9 landscape and 1:1 square. The Remotion composition selects real output dimensions and dedicated landscape/square layouts rather than stretching the portrait page.
- The selected Tegaki page theme is passed into the Remotion composition, including Premium Notes, Exam Revision, Colourful Classroom, Dark Chalkboard and Digital Study Pad.
- Scene narration is stored in the dedicated public `tegaki-assets` bucket before export (including cached Knowledge Asset audio), avoiding oversized base64 export requests. Background music upload (MP3, WAV, M4A or OGG, up to 20 MB) uses the same bucket with a separate mix-volume control; narration volume remains independently adjustable.
- Export is queued into `tegaki_jobs`; rendering runs in `local-video-renderer/tegaki-worker.js` through the scheduled / repository-dispatch GitHub Actions workflow. Remotion is not run inside the Vercel request.
- Worker claims jobs atomically, heartbeats during render, records failure, retries up to three leases and uploads the final MP4 to the existing `lesson-videos` bucket.
- Completed MP4s are attached to a `content_assets` draft and `media_files` row using the existing Social Engine contract. The worker is idempotent on retry and does not auto-publish.
- Tegaki Studio shows export progress/history, offers retry for failed exports and links completed files to the Social Engine draft list.
- Added `npm run test:tegaki-export` structural regression checks.

### Phase 5 activation requirements
1. Apply `supabase/migrations/20261127050000_tegaki_export_jobs.sql` to the SBA Supabase project.
2. Ensure GitHub Actions repository secrets include `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. The migration dispatches through the existing Supabase Vault secret named `github_dispatch_token`; without it, the five-minute workflow schedule still acts as a fallback queue poll, but immediate dispatch will not work.
4. Run the Tegaki workflow once manually after migration, then confirm a test export reaches `ready` and appears in Social Engine as a draft.

**Validation caveat:** code and regression checks are committed, but no local test, Supabase migration, GitHub Actions render or real MP4 export has been executed/verified in this session.

## Migration safety
1. Do not delete or rename legacy Video Studio files during extraction.
2. Keep Notebook Studio's renderer API stable; Tegaki uses its exported SVG builder through a separate adapter.
3. Preserve existing content asset records, metadata, media storage paths and Social Engine publishing behaviour.
4. Keep the existing Remotion Tegaki template as the compatibility fallback until the dedicated renderer/video integration passes visual regression tests.
