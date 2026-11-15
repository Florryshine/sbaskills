// Minimal in-memory Supabase stand-in (tables + storage + the claim RPC) — enough to drive the
// real whiteboard-worker.js without network. Mirrors claim_whiteboard_job() from the migrations.
import { randomUUID } from 'node:crypto';

export const db = { whiteboard_jobs: [], content_assets: [], media_files: [], whiteboard_workers: [], knowledge_assets: [] };
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
      const row = { id: randomUUID(), ...this.payload };
      rows.push(row); out = [row];
    } else if (this.mode === 'upsert') {
      const key = this.table === 'whiteboard_workers' ? 'worker_id' : 'id';
      const i = rows.findIndex((r) => r[key] === this.payload[key]);
      if (i >= 0) Object.assign(rows[i], this.payload); else rows.push({ ...this.payload });
      out = [this.payload];
    } else if (this.mode === 'update') {
      out = rows.filter((r) => matches(r, this.filters));
      out.forEach((r) => {
        Object.assign(r, this.payload);
        if (this.table === 'whiteboard_jobs' && this.payload.stage) log.stageHistory.push(this.payload.stage);
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

export function createClient() {
  return {
    from: (t) => new Query(t),
    rpc: async (name, args) => {
      if (faults.rpcError) return { data: null, error: { message: faults.rpcError } };
      if (name !== 'claim_whiteboard_job') return { data: null, error: { message: 'unknown rpc' } };
      const cutoff = Date.now() - 5 * 60 * 1000;
      for (const j of db.whiteboard_jobs) {
        if (['narrating', 'rendering'].includes(j.status) && j.claim_token && new Date(j.heartbeat_at).getTime() < cutoff && j.attempt_count >= 3) {
          Object.assign(j, { status: 'failed', stage: 'failed', claim_token: null, heartbeat_at: null });
        }
      }
      const j = db.whiteboard_jobs.find((x) => ['narrating', 'rendering'].includes(x.status) && (!x.claim_token || !x.heartbeat_at || new Date(x.heartbeat_at).getTime() < cutoff));
      if (!j) return { data: [], error: null };
      const resumed = j.timeline && (j.audio_files || []).length;
      Object.assign(j, { status: resumed ? 'rendering' : 'narrating', stage: resumed ? 'rendering' : 'narrating', claim_token: randomUUID(), worker_id: args.p_worker_id, claimed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), attempt_count: (j.attempt_count || 0) + 1, error_message: null });
      log.stageHistory.push(j.stage);
      return { data: [JSON.parse(JSON.stringify(j))], error: null };
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
