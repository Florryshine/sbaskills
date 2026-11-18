#!/bin/bash
# Runs the real whiteboard-worker.js against an in-memory Supabase fake, stubbed TTS and a stand-in
# for the Chrome render step. From repo root (needs bun + `npm ci` + whiteboard-engine `bun install`).
set -u
FAKE=$(mktemp -d)
cat > "$FAKE/bun" <<'SH'
#!/bin/bash
if [ "$RENDER_MODE" = "fail" ]; then echo "Error: Could not find Chrome (simulated)" >&2; exit 1; fi
out=""; while [ $# -gt 0 ]; do [ "$1" = "--out" ] && out="$2"; shift; done
head -c 4096 /dev/urandom > "$out"; exit 0
SH
chmod +x "$FAKE/bun"
REALBUN=$(command -v bun)
fail=0
check() { # scenario jq-ish python expr
  out=$(PATH="$FAKE:$PATH" timeout 120 "$REALBUN" --preload ./local-video-renderer/tests/stubs-plugin.mjs local-video-renderer/tests/scenario.mjs "$1" 2>&1 | grep '^RESULT ' | sed 's/^RESULT //')
  if python3 -c "import json,sys; r=json.loads(sys.argv[1]); sys.exit(0 if ($2) else 1)" "$out"; then echo "PASS $1"; else echo "FAIL $1: $out"; fail=1; fi
}
check happy        "r['status']=='ready' and r['content_assets']==1 and r['media_files']==1 and r['asset_links_knowledge'] and r['stages']==['narrating','timeline','rendering','uploading','completed']"
check rerun        "r['status']=='ready' and r['content_assets']==1 and r['media_files']==1"
check pcm          "r['status']=='ready' and r['audio_is_riff']"
check tts_flaky    "r['status']=='ready'"
check tts_fail     "r['status']=='failed' and 'Narration for scene 1' in r['error']"
check render_fail  "r['status']=='failed' and r['error'].startswith('Render failed') and r['has_timeline'] and r['content_assets']==0"
check upload_fail  "r['status']=='failed' and 'Video upload failed' in r['error'] and r['content_assets']==0"
check crash_resume "r['status']=='ready' and r['attempts']==2 and r['content_assets']==1"
check poison       "r['status']=='failed' and r['content_assets']==0"
check rpc_missing  "r['status']=='narrating' and r['stage']=='queued' and r['worker_registered']==1"
check ai_ok        "r['status']=='ready' and r['has_script'] and r['title']=='Photosynthesis' and r['ka_rows']==1 and r['asset_links_knowledge'] and 'scripting' in r['stages']"
check ai_retry     "r['status']=='ready' and r['has_script']"
check ai_fail      "r['status']=='failed' and 'AI script generation failed' in r['error'] and r['content_assets']==0"
# Garbage scripts are rejected by the worker's validator reflect loop: the job
# fails with the validator's message (not the planner's) after 3 attempts.
check ai_garbage   "r['status']=='failed' and r['content_assets']==0 and r['has_script']==False"
check once         "r['exited_by_worker'] and r['status']=='ready' and r['exit_code']==0 and r['content_assets']==1"
exit $fail
