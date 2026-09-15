# Bite-Sized Course System — Repository Audit

## Audit status

This audit was completed before feature implementation against the checked-out repository at commit `2837c4f` on branch `master`. The repository is a Next.js 14 application using the App Router, React 18, Supabase/Postgres, client-side Supabase access in many existing pages, Cloudinary/Supabase Storage assets, and a multi-provider LLM fallback chain.

The implementation must follow the code where it differs from the build specification. The most important confirmed product constraint remains unchanged: **individual learning interactions should be small, but lesson length must be determined by instructional need; no per-screen word-count limit will be introduced.**

## Repository facts and contradictions

| Build-spec assumption | Repository reality | Decision |
|---|---|---|
| Existing video lessons are the primary lesson format | The live admin course page already supports `content_type` values `video`, `text`, and `pdf`; the student lesson page renders all three. `video_url` is present but is not the only content gate. | Add `bite_sized` as a fourth additive format and preserve existing branches. |
| `components/AdminCourseEditor.js` owns lesson creation | The active route `app/admin/courses/[id]/page.js` is the real lesson-creation/editor surface. It loads lessons, creates rows, deletes rows, changes `content_type`, edits text, and uploads video/PDF assets. | Extend the active admin page; do not build a parallel editor. `components/AdminCourseEditor.js` is legacy/secondary and should not be treated as authoritative. |
| Student course and lesson routes are available at the specified paths | The specified routes do exist: `app/(student)/courses/[id]/page.js` and `app/(student)/courses/[id]/lessons/[lessonId]/page.js`. | Extend these routes carefully. |
| Lessons are video-oriented and completion may depend on `video_url` | The current lesson page renders based on `content_type`, while the course list and `LessonList` still use `video_url` as the visibility/opening condition. This is a real format-agnostic completion/access bug for non-video content. | Replace only the relevant `video_url` gates with a format-aware published-content check, preserving video behavior. |
| `lesson_progress` includes resume state | The tracked schema has only `completed`, `completed_at`, and a unique `(student_id, lesson_id)` constraint. Current lesson UI loads completed IDs and inserts progress on completion; it does not persist a screen index. | Add only the minimum screen resume fields required for bite-sized lessons, probably `current_screen_index` and optional content-version metadata, after confirming live DB columns. Preserve existing rows/defaults. |
| Course completion and certificate issuance are clearly implemented | The checked-in repository contains no visible course-completion service or certificate issuance path. The certificate route is presentation-only and reads an existing `certificates` row. Dashboard code also only reads certificates. | Treat certificate issuance as an unresolved live-database/application concern. Audit deployed SQL/functions/server routes before changing certificate logic; do not create a parallel issuer in the first stages. |
| One quiz system exists | There are two student quiz paths: manual `quizzes`/`quiz_questions` at `/quiz/[id]`, with a 50% pass threshold, and generated `quiz_drafts` at `/quizzes/[id]?draft=true`, using `passing_score` defaulting to 70. Both persist `quiz_attempts`; neither is connected to course completion in the inspected pages. | Reuse the existing quiz system for a future completion test only after its live schema and completion integration are confirmed. Do not replace it with lesson screens. |
| Knowledge Assets are only shallow topic summaries | The app exposes `keyword`, `subject`, `summary`, `difficulty`, `key_concepts`, `sub_topics`, `definitions`, `examples`, `facts`, `learning_objectives`, `exam_type`, `estimated_duration_minutes`, `prerequisite_ids`, and `related_asset_ids` across the content generator, migration, and admin UI. | Reuse `buildAssetContext` and extend its normalized context only where needed. The Learning Blueprint can use existing objectives and metadata but must infer or flag missing procedures/misconceptions. |
| A content-factory generator already exists | `lib/content-factory/generators/_shared.js` provides `buildAssetContext` and `generateJson`; `teaching-loop.js` is a separate video-card generator with a deliberate short-card constraint and is not suitable as the lesson generator. | Reuse shared context/JSON/fallback helpers, but create a separate bite-sized lesson generator with no word-count constraint. |
| Image engine is reusable | `lib/image-search.js` provides Pixabay, Pexels, and Wikimedia multi-result search plus download helpers. | Reuse it through a server-side image-attachment route and store stable asset metadata. Do not make image retrieval block lesson generation. |
| LLM fallback exists | `lib/llmFallbackChain.js` provides Gemini → Groq → OpenRouter → HuggingFace fallback. `generateJson` adds parsing and provider retry/repair behavior. | Reuse these helpers and add deterministic validation after generation. Do not create another provider abstraction. |
| An async/job system may be needed | The repository has tracked `generation_jobs`/`generation_job_items` orchestration in `/api/content-engine/generate-selected`, plus `runInBackground` via `@vercel/functions` `waitUntil`. | Reuse the existing job conventions only if Stage 1/2 generation requires asynchronous execution. Do not add a new generic queue in V1. |
| Audit logging is already available | There is an immutable `publish_history` pattern for social publishing, but no confirmed course/lesson authoring audit-log system was found. | Search live schema before creating a small lesson-content audit table; do not scatter ad hoc logs. |
| Supabase RLS policies are fully tracked | `supabase/schema.sql` defines RLS for profiles, courses, lessons, enrollments, and lesson_progress. It does not define the `certificates`, quiz, Knowledge Asset, or generation-job tables, which are partly created ad hoc or in separate migrations. | Add policies for new tables by traversing parent lesson/course publication and admin status. Verify live policy names and functions before applying migrations. |

## What can be reused directly

The following should be reused without duplicating their responsibility:

- Supabase browser/server/admin client conventions in `lib/supabase*.js`.
- Existing `courses`, `lessons`, `enrollments`, and `lesson_progress` tables and their RLS model.
- Existing lesson routing and enrollment checks.
- Existing `content_type` field and content-type branching, adding `bite_sized` rather than inventing a new lesson table.
- `buildAssetContext`, `generateJson`, `generateWithFallback`, and `parseJsonFromText`.
- Existing Knowledge Asset fields and admin editing workflow.
- Existing image search and storage conventions.
- Existing quiz tables/routes for a later course completion-test integration.
- Existing certificate display route and design.
- Existing `completeActivity(studentId, activityType, activityId, points = 10)` only as an optional side effect, never as access control.
- Existing background/job conventions where asynchronous generation is necessary.

## What needs a small adaptation

The smallest compatible adaptations are likely to be:

- Add a `bite_sized` lesson format to the existing lesson model while preserving `video`, `text`, and `pdf` behavior.
- Replace course-list/open-link checks that require `video_url` with a format-aware check.
- Extend lesson progress with a resume index only if the live table lacks an equivalent.
- Add a `learning_blueprint` JSONB field and generation status to lessons only if equivalent fields do not already exist in the live database.
- Add a `lesson_screens` child table, explicitly named **screens**, not cards, if the existing lesson content model has no ordered structured-screen representation.
- Extend the active admin course page rather than `components/AdminCourseEditor.js`.
- Add a dedicated lesson screen player branch to the existing student lesson route.
- Add deterministic validator utilities and tests before publishing/generation UI.
- Integrate course completion and certificate behavior only after the actual live trigger is found.

## What genuinely needs to be created

Subject to live-schema confirmation, the new system needs:

- A versioned `lesson_screens` persistence layer.
- A persisted Learning Blueprint and generation status.
- A two-stage lesson-generation route/service.
- Deterministic schema and blueprint-coverage validation.
- Admin blueprint/screen review and publish controls.
- A dedicated `LessonScreenPlayer` component with supported V1 screen types.
- Screen-level progress/resume and practice-attempt persistence, using the smallest additive shape.
- RLS policies and tests for new structured lesson content.
- A course-format-aware completion integration after the existing completion/certificate path is located.

## Staged implementation plan

1. **Audit stage:** retain this report and confirm live database columns, policies, functions, and certificate/completion triggers through the connected Supabase environment before applying migrations.
2. **Schema stage:** add only required lesson format, blueprint/status, screens, and module/progress fields; apply and verify RLS. Preserve legacy rows and content types.
3. **Generator Stage 1:** implement Learning Blueprint generation from an existing Knowledge Asset or raw notes, persist drafts/status, and test it against a real asset.
4. **Generator Stage 2:** implement blueprint-to-screen generation for at least one conceptual and one procedural/exam-prep topic. Do not use a screen word-count rule.
5. **Validator stage:** add deterministic structural, coverage, safety, and asset-reference validation; keep pedagogical LLM checks advisory only.
6. **Image stage:** attach optional image candidates asynchronously or independently; do not fail the lesson when an optional image search fails.
7. **Admin stage:** extend the active course editor with format selection, blueprint review, screen editing, diagnostics, preview, draft/publish, and version-safe regeneration.
8. **Student stage:** add the screen player and format-aware course/lesson list behavior while leaving video/text/PDF rendering intact.
9. **Progress stage:** wire screen resume, attempts, lesson completion, and existing gamification side effects without changing access control.
10. **Completion/certificate stage:** audit and fix the real course-completion/certificate logic last, ensuring mixed video and bite-sized courses contribute equally and existing certificates remain unchanged.

Each implementation stage must be committed separately, tested against the real repository conventions, and reported with the commit hash and known limitations before moving to the next stage.

## Immediate implementation boundary

The first code stage should be limited to the additive schema and validator contracts after live database confirmation. It must not modify flashcards, the existing quiz UI, video rendering, certificate design, or the certificate issuance path. No student-facing behavior should be changed until the schema and validation contracts are reviewable.
