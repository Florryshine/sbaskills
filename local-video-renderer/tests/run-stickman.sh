#!/bin/bash
# Runs the real stickman-worker.js against an in-memory Supabase fake, stubbed
# TTS/planner and a stand-in for the Chrome render step. From repo root
# (needs bun + root `npm ci` + stickman-engine `bun install`).
set -u
FAKE=$(mktemp -d)
cat > "$FAKE/bun" <<'SH'
#!/bin/bash
if [ "$RENDER_MODE" = "fail" ]; then echo "Error: render failed (simulated)" >&2; exit 1; fi
job=""; prev=""
for a in "$@"; do [ "$prev" = "--job" ] && job="$a"; prev="$a"; done
out=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['out'])" "$job")
head -c 4096 /dev/urandom > "$out"; exit 0
SH
chmod +x "$FAKE/bun"
REALBUN=$(command -v bun)
fail=0
check() { # scenario jq-ish python expr
  out=$(PATH="$FAKE:$PATH" timeout 150 "$REALBUN" --preload ./local-video-renderer/tests/stickman-stubs-plugin.mjs local-video-renderer/tests/stickman-scenario.mjs "$1" 2>&1 | grep '^RESULT ' | sed 's/^RESULT //')
  if python3 -c "import json,sys; r=json.loads(sys.argv[1]); sys.exit(0 if ($2) else 1)" "$out"; then echo "PASS $1"; else echo "FAIL $1: $out"; fail=1; fi
}
check image_presenter "r['status']=='ready' and r['video_url'] and r['image_presenter_image_events']==1 and r['timeline_audio']==1 and r['asset_links_knowledge']"
check image_presenter_comparison "r['status']=='ready' and r['image_presenter_image_events']==2 and r['timeline_audio']==3 and r['asset_links_knowledge']"
check image_presenter_sequence "r['status']=='ready' and r['image_presenter_image_events']==3 and r['timeline_audio']==3 and r['asset_links_knowledge']"
check image_presenter_diagram "r['status']=='ready' and r['image_presenter_image_events']==1 and r['image_presenter_annotation_events']==1 and r['timeline_audio']==2 and r['asset_links_knowledge']"
check happy        "r['status']=='ready' and r['content_assets']==1 and r['media_files']==1 and r['publish_jobs']==2 and r['ka_rows']==1 and r['asset_links_knowledge'] and r['narration_entries']==13 and r['narration_have_urls'] and r['timeline_audio']==13 and r['audio_starts_increasing'] and r['audio_is_riff'] and 'narrating' in r['stages'] and 'uploading' in r['stages']"
check rerun        "r['status']=='ready' and r['content_assets']==1 and r['media_files']==1 and r['publish_jobs']==2"
check ai_ok        "r['status']=='ready' and r['has_script'] and r['title']=='Ben and the Stubborn Box - A Friction Story' and r['ka_rows']==1 and 'scripting' in r['stages'] and r['asset_links_knowledge']"
check ai_lesson    "r['status']=='ready' and r['ka_reused'] and r['asset_links_knowledge']"
check ai_retry     "r['status']=='ready' and r['has_script'] and r['script_calls']==3"
check ai_fail      "r['status']=='failed' and 'AI script generation failed' in r['error'] and r['content_assets']==0"
check ai_garbage   "r['status']=='failed' and 'SceneScript validation failed' in r['error'] and r['content_assets']==0"
check tts_fail     "r['status']=='failed' and 'Narration for scene 1' in r['error']"
check tts_flaky    "r['status']=='ready'"
check render_fail  "r['status']=='failed' and r['error'].startswith('Render failed') and r['has_timeline'] and r['content_assets']==0"
check upload_fail  "r['status']=='failed' and 'Video upload failed' in r['error'] and r['content_assets']==0"
check crash_resume "r['status']=='ready' and r['attempts']==2 and (r['tts_calls']==0 or r['tts_calls'] is None) and r['content_assets']==1 and r['timeline_audio']==13 and r['audio_starts_increasing']"
check poison       "r['status']=='failed' and 'stopped responding' in r['error'] and r['content_assets']==0"
check rpc_missing  "r['status']=='queued' and r['stage']=='queued' and r['worker_registered']==1"
check no_publish   "r['status']=='ready' and r['publish_jobs']==0 and r['content_assets']==1"
check once         "r['exited_by_worker'] and r['status']=='ready' and r['exit_code']==0 and r['content_assets']==1"
exit $fail
