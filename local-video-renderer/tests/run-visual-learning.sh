#!/bin/bash
# Runs the real visual-learning-worker.js against an in-memory Supabase fake,
# stubbed planner/TTS/imagery and a stand-in for the Chrome render step.
# From repo root (needs bun + visual-learning-engine `bun install`).
set -u
FAKE=$(mktemp -d)
cat > "$FAKE/bun" <<'SH'
#!/bin/bash
if [ "$RENDER_MODE" = "fail" ]; then echo "Error: render failed (simulated)" >&2; exit 1; fi
out=""; prev=""
for a in "$@"; do [ "$prev" = "--out" ] && out="$a"; prev="$a"; done
head -c 4096 /dev/urandom > "$out"; exit 0
SH
chmod +x "$FAKE/bun"
REALBUN=$(command -v bun)
fail=0
check() { # scenario python-expr
  out=$(PATH="$FAKE:$PATH" timeout 220 "$REALBUN" --preload ./local-video-renderer/tests/visual-learning-stubs-plugin.mjs local-video-renderer/tests/visual-learning-scenario.mjs "$1" 2>&1 | grep '^RESULT ' | sed 's/^RESULT //')
  if python3 -c "import json,sys; r=json.loads(sys.argv[1]); sys.exit(0 if ($2) else 1)" "$out"; then echo "PASS $1"; else echo "FAIL $1: $out"; fail=1; fi
}
check happy        "r['status']=='ready' and r['content_assets']==1 and r['media_files']==1 and r['publish_jobs']==2 and r['ka_rows']==1 and r['has_script'] and r['has_timeline'] and r['video_uploaded'] and r['narration_clips']==8 and r['image_count']>=6 and r['timeline_shots']>=r['image_count'] and r['duration_seconds'] and 'saving' in r['stages']"
check rerun        "r['status']=='ready' and r['content_assets']==1 and r['media_files']==1 and r['publish_jobs']==2"
check script_ok    "r['status']=='ready' and r['has_script'] and r['script_provider']=='stub' and r['ka_rows']==1 and 'scripting' in r['stages']"
check script_retry "r['status']=='ready' and r['has_script'] and 'scripting' in r['stages']"
check script_fail  "r['status']=='failed' and ('AI script generation failed' in r['error'] or 'deterministic architect' in r['error'] or r['script_provider']=='architect')"
check script_garbage "r['status']=='ready' and r['script_provider']=='architect'"
check tts_fail     "r['status']=='failed' and 'narration' in r['error'].lower()"
check render_fail  "r['status']=='failed' and r['error'].startswith('Render failed') and r['has_timeline'] and r['content_assets']==0"
check upload_fail  "r['status']=='failed' and 'Video upload failed' in r['error'] and r['content_assets']==0"
check crash_resume "r['status']=='ready' and r['attempts']==2 and r['content_assets']==1"
check poison       "r['status']=='failed' and 'stopped responding' in r['error'] and r['content_assets']==0"
check rpc_missing  "r['status']=='queued' and r['stage']=='queued' and r['worker_registered']==1"
check no_publish   "r['status']=='ready' and r['publish_jobs']==0 and r['content_assets']==1"
check once         "r['exited_by_worker'] and r['status']=='ready' and r['exit_code']==0 and r['content_assets']==1"
exit $fail
