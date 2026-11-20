// Minimal in-memory Supabase stand-in (tables + storage + the claim RPC) — enough to drive the
// real whiteboard-worker.js without network. Mirrors claim_whiteboard_job() from the migrations.
import { randomUUID } from 'node:crypto';

export const db = {
  whiteboard_jobs: [], content_assets: [], media_files: [], whiteboard_workers: [], knowledge_assets: [],
  stickman_jobs: [], stickman_workers: [], stickman_scripts: [], publish_jobs: [], social_channels_v2: [],
  visual_learning_jobs: [], visual_learning_workers: [], visual_learning_dispatch_attempts: [],
};
export const storage = new Map(); // `${bucket}/${path}` -> Buffer
export const faults = { uploadBucket: null, rpcError: null };
export const log = { stageHistory: [] };

function matches(row, filters) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return v === f.val;
    if (f.op === 'in') return f.val.includes(v);
    if (f.op === 'contains') return Object.entries(f.val).every(([k, x]) => v && v[k] === x);
    return true;
  });
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'select'; this.payload = null; this.sm = null; this.lim = null; }
  select() { if (this.mode === 'select') this.mode = 'select'; this.returning = true; return this; }
  insert(p) { this.mode = 'insert'; this.payload = p; return this; }
  update(p) { this.mode = 'update'; this.payload = p; return this; }
  upsert(p) { this.mode = 'upsert'; this.payload = p; return this; }
  eq(col, val) { this.filters.push({ op: 'eq', col, val }); return this; }
  in(col, val) { this.filters.push({ op: 'in', col, val }); return this; }
  contains(col, val) { this.filters.push({ op: 'contains', col, val }); return this; }
  order() { return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.sm = 'maybe'; return this; }
  // single() mirrors PostgREST: zero rows is an error
  single() { this.sm = 'one'; return this; }
  then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }
  run() {
    const rows = db[this.table];
    let out = [];
    if (this.mode === 'insert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = payloads.map((p) => {
        const row = { id: randomUUID(), ...p };
        rows.push(row);
        return row;
      });
      out = inserted;
    } else if (this.mode === 'upsert') {
      const key = this.table === 'whiteboard_workers' || this.table === 'stickman_workers' || this.table === 'visual_learning_workers' ? 'worker_id' : 'id';
      const i = rows.findIndex((r) => r[key] === this.payload[key]);
      if (i >= 0) Object.assign(rows[i], this.payload); else rows.push({ ...this.payload });
      out = [this.payload];
    } else if (this.mode === 'update') {
      out = rows.filter((r) => matches(r, this.filters));
      out.forEach((r) => {
        Object.assign(r, this.payload);
        if ((this.table === 'whiteboard_jobs' || this.table === 'stickman_jobs' || this.table === 'visual_learning_jobs') && this.payload.stage) log.stageHistory.push(this.payload.stage);
      });
    } else {
      out = rows.filter((r) => matches(r, this.filters));
      if (this.lim) out = out.slice(0, this.lim);
    }
    out = out.map((r) => JSON.parse(JSON.stringify(r)));
    if (this.sm === 'maybe') return { data: out[0] ?? null, error: null };
    if (this.sm === 'one') return out.length ? { data: out[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
    return { data: out, error: null };
  }
}

// Mirrors claim_whiteboard_job() / claim_stickman_job() from the migrations:
// poison-pill stale leases (3+ attempts) then atomically claim the oldest
// actionable job, resuming at 'rendering' when narration already survived.
// emptyScriptStatus: stickman AI jobs (no script yet) stay 'queued'; whiteboard
// has no such state (pass null).
function claimJob(rows, args, statuses, emptyScriptStatus) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const j of rows) {
    if (statuses.includes(j.status) && j.claim_token && new Date(j.heartbeat_at).getTime() < cutoff && (j.attempt_count || 0) >= 3) {
      Object.assign(j, { status: 'failed', stage: 'failed', claim_token: null, heartbeat_at: null, stage_message: 'Worker stopped responding repeatedly', error_message: `Worker stopped responding after ${j.attempt_count || 0} attempts (crash, out-of-memory or restart during processing). Use Retry to run it again.` });
    }
  }
  const j = rows.find((x) => statuses.includes(x.status) && (!x.claim_token || !x.heartbeat_at || new Date(x.heartbeat_at).getTime() < cutoff));
  if (!j) return { data: [], error: null };
  const hasAudio = Array.isArray(j.audio_files) && j.audio_files.length > 0;
  const resumed = j.timeline && hasAudio;
  const status = emptyScriptStatus && !String(j.script_text || '').trim() ? emptyScriptStatus : resumed ? 'rendering' : 'narrating';
  Object.assign(j, { status, stage: resumed ? 'rendering' : status, claim_token: randomUUID(), worker_id: args.p_worker_id, claimed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), attempt_count: (j.attempt_count || 0) + 1, error_message: null });
  log.stageHistory.push(j.stage);
  return { data: [JSON.parse(JSON.stringify(j))], error: null };
}

export function createClient() {
  return {
    from: (t) => new Query(t),
    rpc: async (name, args) => {
      if (faults.rpcError) return { data: null, error: { message: faults.rpcError } };
      // Whiteboard jobs are never 'queued' (claim_whiteboard_job); stickman AI
      // jobs sit in 'queued' until the worker writes the script.
      if (name === 'claim_whiteboard_job') return claimJob(db.whiteboard_jobs, args, ['narrating', 'rendering'], null);
      if (name === 'claim_stickman_job') return claimJob(db.stickman_jobs, args, ['queued', 'narrating', 'rendering'], 'queued');
      if (name === 'claim_visual_learning_job') return claimJob(db.visual_learning_jobs, args, ['queued', 'scripting', 'imagery', 'narrating', 'timeline', 'rendering', 'saving'], 'scripting');
      return { data: null, error: { message: 'unknown rpc' } };
    },
    storage: {
      from: (bucket) => ({
        upload: async (p, buf) => {
          if (faults.uploadBucket === bucket) return { error: { message: `simulated storage outage (${bucket})` } };
          storage.set(`${bucket}/${p}`, Buffer.from(buf)); return { error: null };
        },
        download: async (p) => {
          const b = storage.get(`${bucket}/${p}`);
          return b ? { data: new Blob([b]), error: null } : { data: null, error: { message: 'Object not found' } };
        },
        getPublicUrl: (p) => ({ data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${p}` } }),
      }),
    },
  };
}
