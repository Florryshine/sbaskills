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

## Phase 5: Export and publishing
Add reliable preview/export presets for 9:16, 16:9 and 1:1, MP4 rendering, draft persistence, asset reuse and Social Engine handoff.

## Migration safety
1. Do not delete or rename legacy Video Studio files during extraction.
2. Keep Notebook Studio's renderer API stable; Tegaki uses its exported SVG builder through a separate adapter.
3. Preserve existing content asset records, metadata, media storage paths and Social Engine publishing behaviour.
4. Keep the existing Remotion Tegaki template as the compatibility fallback until the dedicated renderer/video integration passes visual regression tests.
