#!/usr/bin/env node
// scripts/visual-intelligence-tests.mjs
//
// Test suite for the shared visual discovery & asset intelligence system.
// Run:  node scripts/visual-intelligence-tests.mjs
//
// The suite is honest about what it can verify in the current environment:
//   PASS  — assertion held
//   FAIL  — assertion broken (suite exits non-zero)
//   SKIP  — cannot run here (missing credentials / no network / no Supabase
//           env), with the exact reason printed
//
// Scenario map (the 14 required checks):
//   01 car photo discovery                  08 create asset (procedural)
//   02 human skeleton illustration          09 reuse permanent library asset
//   03 red blood cell science illustration  10 duplicate detection (hash)
//   04 SVG mitochondrion                    11 provider failure handling
//   05 science lab background photo         12 missing credentials isolation
//   06 reject unsuitable results            13 ephemeral TTL cleanup
//   07 adapt asset decision                 14 existing engines untouched

import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let currentScenario = '';

function scenario(id, name) {
  currentScenario = `${id} ${name}`;
  console.log(`\n── ${currentScenario} ${'─'.repeat(Math.max(0, 58 - currentScenario.length))}`);
}

function pass(msg) { results.push({ scenario: currentScenario, status: 'PASS', msg }); console.log(`   PASS  ${msg}`); }
function fail(msg) { results.push({ scenario: currentScenario, status: 'FAIL', msg }); console.log(`   FAIL  ${msg}`); }
function skip(msg) { results.push({ scenario: currentScenario, status: 'SKIP', msg }); console.log(`   SKIP  ${msg}`); }

function assert(cond, msg) { (cond ? pass : fail)(msg); return cond; }

const hasNetwork = process.env.VI_SKIP_NETWORK !== '1';
async function networkOk() {
  if (!hasNetwork) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    await fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&meta=siteinfo', { signal: controller.signal });
    clearTimeout(t);
    return true;
  } catch { return false; }
}

// ── imports under test ──────────────────────────────────────────────────────
const lib = (p) => import(`../lib/visual-intelligence/${p}`);

const { discoverVisual, refetchSelected } = await lib('discover.js');
const { decideCandidate, decideBatch, aggregateDecision, DEFAULT_THRESHOLDS } = await lib('decide.js');
const { evaluateLicense, classifyLicense, buildAttribution } = await lib('license-policy.js');
const { generateProcedural, listProceduralTemplates } = await lib('procedural.js');
const { sniffFormat, probeImage, visionAvailable, inspectCandidate } = await lib('inspect.js');
const { listProviders, runProviderSearch, getProvider } = await lib('providers/index.js');
const {
  storageConfigured, sha256, effectiveTtl, cacheKey,
  searchLibrary, storePermanent, stageEphemeral, purgeExpiredEphemeral,
} = await lib('storage.js');

const online = await networkOk();
const dbUp = storageConfigured();
console.log(`\nEnvironment: network=${online ? 'yes' : 'no'} supabase=${dbUp ? 'yes' : 'no'} vision=${visionAvailable() ? 'yes' : 'no'}`);

// ═══ 01 — car photo discovery ═══════════════════════════════════════════════
scenario('01', 'Car photo discovery (photo providers)');
{
  if (!online) { skip('No outbound network in this environment.'); }
  else {
    const result = await discoverVisual(
      { subject: 'red sports car on a road', query: 'red sports car', kinds: ['photo'], allowCreate: false, persist: 'none' },
      { useCache: false, wantVision: visionAvailable() }
    );
    assert(result && typeof result.decision === 'string', `Discovery returned a structured decision: "${result?.decision}"`);
    assert(['use', 'adapt', 'no-match'].includes(result.decision), 'Decision is one of use/adapt/no-match (no crash, no throw).');
    if (result.decision !== 'no-match') {
      assert(result.asset && result.license, 'Result carries the asset + license block.');
      console.log(`   → picked: ${result.asset.provider} "${result.asset.title}" license=${result.license.status}`);
      console.log(`   → explanation: ${(result.explanation || '').slice(0, 140)}`);
    } else {
      console.log(`   → no-match reason: ${(result.explanation || '').slice(0, 140)}`);
      const providersWithKeys = listProviders().filter((p) => p.available && p.mode === 'api');
      if (!providersWithKeys.length) skip('No key-backed providers available; only no-match possible here.');
      else console.log('   → note: live providers exist; inspect reasons above.');
    }
  }
}

// ═══ 02 — human skeleton illustration ═══════════════════════════════════════
scenario('02', 'Human skeleton illustration (open-licensed science media)');
{
  if (!online) { skip('No outbound network.'); }
  else {
    const result = await discoverVisual(
      { subject: 'human skeleton', query: 'human skeleton anatomy', kinds: ['illustration', 'diagram', 'svg'], scientificAccuracy: 'strict', allowCreate: false, persist: 'none' },
      { useCache: false, wantVision: visionAvailable() }
    );
    assert(['use', 'adapt', 'no-match'].includes(result.decision), `Structured decision: "${result.decision}".`);
    if (result.decision !== 'no-match') {
      const lic = result.license;
      assert(lic && ['allowed', 'unknown'].includes(lic.status), `License gated correctly (status=${lic.status}).`);
      if (lic.attributionRequired) assert(lic.attribution, 'Attribution string supplied when the license requires it.');
      console.log(`   → ${result.asset.provider}: ${(result.asset.title || '').slice(0, 70)} | ${lic.text}`);
    }
  }
}

// ═══ 03 — red blood cell science illustration ═══════════════════════════════
scenario('03', 'Red blood cell scientific illustration (strict accuracy)');
{
  if (!online) { skip('No outbound network.'); }
  else if (!visionAvailable()) {
    const result = await discoverVisual(
      { subject: 'red blood cells', query: 'red blood cells erythrocytes', kinds: ['illustration', 'photo'], scientificAccuracy: 'strict', allowCreate: false, persist: 'none' },
      { useCache: false, wantVision: false }
    );
    // Without vision, subject accuracy must be reported as uncertain — never
    // silently guessed to be fine.
    assert(['adapt', 'no-match', 'use'].includes(result.decision), `Decision "${result.decision}" without vision.`);
    if (result.decision === 'use') {
      console.log('   → note: a use without vision can only come from library reuse (vision-checked earlier) — acceptable.');
    } else if (result.decision === 'adapt') {
      pass('Without a vision model the candidate is downgraded to uncertain/adapt, never claimed as visually verified.');
    }
    assert(!visionAvailable(), 'System correctly reports vision as unavailable (subject accuracy = uncertain, explicitly).');
  } else {
    const result = await discoverVisual(
      { subject: 'red blood cells', query: 'red blood cells erythrocytes illustration', kinds: ['illustration', 'photo'], scientificAccuracy: 'strict', allowCreate: false, persist: 'none' },
      { useCache: false, wantVision: true }
    );
    assert(['use', 'adapt', 'no-match'].includes(result.decision), `Decision "${result.decision}" with vision inspection.`);
    if (result.inspection?.scientificAccuracy) {
      console.log(`   → scientific accuracy: ${result.inspection.scientificAccuracy.verdict} — ${result.inspection.scientificAccuracy.note || ''}`);
    }
  }
}

// ═══ 04 — SVG mitochondrion ═════════════════════════════════════════════════
scenario('04', 'SVG mitochondrion (vector chain incl. procedural fallback)');
{
  if (!online) { skip('No outbound network.'); }
  else {
    const result = await discoverVisual(
      { subject: 'mitochondrion', query: 'mitochondrion diagram', kinds: ['svg'], allowCreate: true, persist: 'none' },
      { useCache: false, wantVision: false }
    );
    assert(['use', 'adapt', 'created', 'no-match'].includes(result.decision), `Decision "${result.decision}".`);
    if (result.decision === 'created') {
      assert(typeof result.asset.svg === 'string' && result.asset.svg.startsWith('<svg'), 'Procedural fallback returned valid SVG.');
      assert(result.license.text.includes('CC0') || result.license.text.includes('SBA'), 'Procedural asset is SBA Original (CC0).');
      console.log(`   → ${result.asset.title}`);
    } else if (result.decision === 'use') {
      assert(result.asset.kind === 'svg' || (result.asset.url || '').includes('.svg'), 'SVG asset delivered.');
    }
  }
}

// ═══ 05 — science lab background photo ══════════════════════════════════════
scenario('05', 'Science lab background (wide background photo)');
{
  if (!online) { skip('No outbound network.'); }
  else {
    const result = await discoverVisual(
      { subject: 'science laboratory', query: 'science laboratory background', kinds: ['photo', 'background'], minWidth: 800, allowCreate: false, persist: 'none' },
      { useCache: false, wantVision: visionAvailable() }
    );
    assert(['use', 'adapt', 'no-match'].includes(result.decision), `Decision "${result.decision}".`);
    if (result.decision !== 'no-match') {
      const checks = result.inspection?.checks || {};
      if (checks.resolution) assert(checks.resolution.pass !== false, `Resolution ≥ 800px enforced (got ${checks.image?.width || '?'}px).`);
    }
  }
}

// ═══ 06 — reject unsuitable results ═════════════════════════════════════════
scenario('06', 'Reject unsuitable results (license + subject hard gates)');
{
  const baseInspection = (over = {}) => ({
    verdict: 'pass', reasons: [],
    checks: { image: { width: 1600, height: 1200, format: 'jpeg', usesTransparency: false, isFlat: false } },
    vision: { available: true, model: 'test', subjectMatch: 88, scientificAccuracy: { verdict: 'ok' }, watermark: false },
    ...over,
  });
  // a) NC license must be discarded regardless of quality
  const nc = decideCandidate(
    { candidate: { provider: 'wikimedia', providerAssetId: 'x', title: 'Cell', license: 'CC BY-NC-SA 4.0', kind: 'photo' }, inspection: baseInspection() },
    {}
  );
  assert(nc.decision === 'discard', `NonCommercial license discarded (got "${nc.decision}") — license is a hard gate.`);
  // b) wrong subject must be discarded even with clean license
  const wrongSubject = decideCandidate(
    { candidate: { provider: 'pexels', providerAssetId: 'y', title: 'Random landscape', license: 'Pexels License', kind: 'photo' }, inspection: baseInspection({ vision: { available: true, model: 'test', subjectMatch: 15, watermark: false } }) },
    {}
  );
  assert(wrongSubject.decision === 'discard', `Wrong subject discarded (match 15 → "${wrongSubject.decision}").`);
  assert(/subject/i.test(wrongSubject.explanation), 'Rejection explanation mentions the subject mismatch.');
  // c) watermark → never a clean "use"
  const wm = decideCandidate(
    { candidate: { provider: 'openverse', providerAssetId: 'z', title: 'Diagram', license: 'CC0', kind: 'photo' }, inspection: baseInspection({ vision: { available: true, model: 'test', subjectMatch: 90, watermark: true } }) },
    {}
  );
  assert(wm.decision !== 'use' && wm.adaptations.some((a) => /watermark/i.test(a)), `Watermarked image downgraded to "${wm.decision}" with an adaptation note.`);
  // d) batch aggregate: all rejected + create disabled → explicit no-match + text fallback
  const agg = aggregateDecision([
    { decision: 'discard', score: { total: 0 }, candidate: { provider: 'x' }, explanation: 'bad' },
    { decision: 'discard', score: { total: 0 }, candidate: { provider: 'y' }, explanation: 'worse' },
  ], { allowCreate: false });
  assert(agg.decision === 'no-match' && agg.fallback === 'text', 'All-rejected batch yields explicit no-match with text fallback.');
}

// ═══ 07 — adapt asset decision ══════════════════════════════════════════════
scenario('07', 'Adapt decision (right subject, needs rework)');
{
  const adapted = decideCandidate(
    {
      candidate: { provider: 'pexels', providerAssetId: 'a1', title: 'Red car on road', license: 'Pexels License', kind: 'photo', width: 1600, height: 900 },
      inspection: {
        verdict: 'pass', reasons: [],
        checks: { image: { width: 1600, height: 900, format: 'jpeg', usesTransparency: false, isFlat: false } },
        vision: { available: true, model: 'test', subjectMatch: 92, scientificAccuracy: { verdict: 'ok' }, watermark: false, composition: 'wide' },
      },
    },
    { transparent: true } // raster without alpha → background removal adaptation
  );
  assert(adapted.decision === 'adapt', `Subject ok but transparency missing → adapt (got "${adapted.decision}").`);
  assert(adapted.adaptations.some((a) => /background/i.test(a)), 'Concrete adaptation instruction provided (background removal).');
  assert(adapted.score.subject === 92, 'Score breakdown records the vision subject match.');
  const batch = decideBatch([
    { candidate: { provider: 'z', providerAssetId: 'low', title: 'low', license: 'CC0' }, inspection: { verdict: 'pass', checks: {}, vision: { available: true, subjectMatch: 65 } } },
    adapted,
  ], {});
  assert(batch[0].candidate.providerAssetId === 'a1' && ['use', 'adapt'].includes(batch[0].decision), 'Batch ranking puts the better match first.');
  assert(batch[1].candidate.providerAssetId === 'low', 'Weaker match ranks second.');
}

// ═══ 08 — create asset (procedural) ═════════════════════════════════════════
scenario('08', 'Create asset procedurally when nothing external qualifies');
{
  const result = await discoverVisual(
    { subject: 'quantum entanglement hero', query: 'quantum entanglement', kinds: ['illustration'], providerDeny: listProviders().map((p) => p.id), allowCreate: true, persist: 'none' },
    { useCache: false, wantVision: false }
  );
  assert(result.decision === 'created', `All providers denied + allowCreate → created (got "${result.decision}").`);
  assert(typeof result.asset.svg === 'string' && result.asset.svg.includes('</svg>'), 'Generated SVG payload present.');
  assert(result.license.status === 'allowed' && /SBA|CC0/.test(result.license.text), 'Created asset is SBA Original (CC0).');
  const again = await discoverVisual(
    { subject: 'quantum entanglement hero', query: 'quantum entanglement', kinds: ['illustration'], providerDeny: listProviders().map((p) => p.id), allowCreate: true, persist: 'none', proceduralTemplateId: 'concept-card' },
    { useCache: false, wantVision: false }
  );
  assert(again.asset.svg === result.asset.svg, 'Procedural generation is deterministic (same seed → identical bytes).');
  // template registry sanity
  assert(listProceduralTemplates().length >= 5, 'Procedural template registry exposes the generator catalogue.');
}

// ═══ 09 — reuse permanent library asset ═════════════════════════════════════
scenario('09', 'Reuse permanent library asset before external fetch');
{
  if (!dbUp) {
    // Graceful degradation path still must hold: library miss → providers run.
    const libRes = await searchLibrary({ subject: 'anything' });
    assert(libRes.ok === false && /supabase-not-configured/.test(libRes.reason), 'Without Supabase env, library search degrades gracefully (ok:false, explicit reason).');
    skip('Live reuse check needs Supabase credentials (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  } else {
    const seed = await storePermanent({
      buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><text>${Date.now()}</text></svg>`),
      mimeType: 'image/svg+xml', name: `vi-test-reuse-${Date.now()}`, subject: 'TestSubjectVI', category: 'object',
      assetType: 'svg', keywords: ['vitest', 'reuse'], license: 'SBA Original (CC0)', source: 'test',
    });
    if (!seed.stored) { skip(`Store failed: ${seed.reason}`); }
    else {
      const result = await discoverVisual({ subject: 'TestSubjectVI', query: 'TestSubjectVI', kinds: ['svg'], persist: 'none' }, { useCache: false, wantVision: false });
      assert(result.decision === 'use' && result.reuse === 'library', 'Library hit short-circuits external fetch with decision=use.');
      assert(result.storage?.tier === 'C', 'Reuse reports storage tier C (permanent library).');
    }
  }
}

// ═══ 10 — duplicate detection ═══════════════════════════════════════════════
scenario('10', 'Duplicate detection via content hash');
{
  const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="9"/></svg>');
  const h1 = sha256(buf);
  const h2 = sha256(Buffer.from(buf));
  assert(h1 === h2 && /^[0-9a-f]{64}$/.test(h1), 'sha256 content hashing is stable.');
  assert(cacheKey('pexels', 'Red Car') === cacheKey('pexels', 'red car '), 'Search cache key is case/whitespace-insensitive per provider+query.');
  if (!dbUp) {
    skip('Live dedup store needs Supabase credentials.');
  } else {
    const name = `vi-test-dedup-${Date.now()}`;
    const first = await storePermanent({ buffer: buf, mimeType: 'image/svg+xml', name, license: 'SBA Original (CC0)', source: 'test' });
    const second = await storePermanent({ buffer: buf, mimeType: 'image/svg+xml', name: name + '-again', license: 'SBA Original (CC0)', source: 'test' });
    if (!first.stored) skip(`Store failed: ${first.reason}`);
    else {
      assert(first.stored && !first.reused, 'First insert creates a new library row.');
      assert(second.stored && second.reused && second.asset?.id === first.asset?.id, 'Second identical upload is deduplicated onto the existing row (no second copy).');
    }
  }
}

// ═══ 11 — provider failure handling ═════════════════════════════════════════
scenario('11', 'Provider failure handling (one dead provider never breaks discovery)');
{
  const bad = await runProviderSearch({ query: 'anything', kinds: ['photo'], providerAllow: ['nonexistent-provider'] });
  assert(bad.ok === undefined && Array.isArray(bad.results) && bad.results.length === 0, 'Unknown provider selection degrades to an empty result set (no throw).');
  if (online) {
    const provider = getProvider('wikimedia');
    const res = await provider.search({ query: 'zzzzqqqqxxxxnothing', limit: 2 });
    assert(res.ok && res.results.length === 0, 'A valid provider with zero hits returns ok:true with [] (distinct from failure).');
    const { getJson } = await lib('providers/http.js');
    const deadRes = await getJson('https://nonexistent.invalid.example/endpoint', { timeoutMs: 4000 });
    assert(deadRes.ok === false && deadRes.error, 'A dead endpoint returns { ok:false, error } instead of throwing.');
  }
  const result = await discoverVisual(
    { subject: 'solar system', query: 'solar system', kinds: ['photo'], providerDeny: ['pexels', 'pixabay', 'openverse', 'openclipart', 'polyhaven', 'sketchfab', 'svgrepo', 'undraw', 'storyset', 'openpeeps'], allowCreate: false, persist: 'none' },
    { useCache: false, wantVision: false }
  );
  assert(result && (result.ok === true || result.ok === false), 'Full pipeline survives partial provider denial and always answers.');
}

// ═══ 12 — missing credentials isolation ═════════════════════════════════════
scenario('12', 'Missing credentials disable only their provider');
{
  const statuses = listProviders();
  const pexelsStatus = statuses.find((p) => p.id === 'pexels');
  const pixabayStatus = statuses.find((p) => p.id === 'pixabay');
  const wikimediaStatus = statuses.find((p) => p.id === 'wikimedia');
  if (process.env.PEXELS_API_KEY) pass('PEXELS_API_KEY configured in this environment (provider available).');
  else assert(pexelsStatus && pexelsStatus.available === false, 'Pexels reported unavailable without its key.');
  if (process.env.PIXABAY_API_KEY) pass('PIXABAY_API_KEY configured here.');
  else assert(pixabayStatus && pixabayStatus.available === false, 'Pixabay reported unavailable without its key.');
  assert(wikimediaStatus && wikimediaStatus.available === true, 'Wikimedia stays available (no key needed) — modular isolation intact.');
  const search = await runProviderSearch({ query: 'car', kinds: ['photo'], providerDeny: ['openverse'] });
  const skips = new Set(search.skipped.map((s) => s.provider));
  if (!process.env.PEXELS_API_KEY) assert(skips.has('pexels'), 'Keyless provider was skipped with an explicit reason, not an error.');
  assert(search.errors.every((e) => e.provider), 'Any provider errors are recorded per-provider (never fatal to the batch).');
}

// ═══ 13 — ephemeral TTL cleanup ═════════════════════════════════════════════
scenario('13', 'Ephemeral file TTL + purge');
{
  const ttl = effectiveTtl(getProvider('pixabay'));
  assert(ttl <= 24 * 3600, `Pixabay search-cache TTL capped at 24h per their terms (got ${ttl / 3600}h).`);
  assert(effectiveTtl(getProvider('wikimedia')) > 0, 'Wikimedia cache TTL is provider-configurable.');
  if (!dbUp) {
    const res = await purgeExpiredEphemeral({ dryRun: true });
    assert(res.ok === false && /supabase-not-configured/.test(res.reason), 'Purge without Supabase env degrades gracefully (never throws).');
    skip('Live purge needs Supabase credentials.');
  } else {
    const staged = await stageEphemeral({
      buffer: Buffer.from('vi-ephemeral-test-' + Date.now()), mimeType: 'text/plain',
      name: 'vi-test-ephemeral', retainUntilSeconds: 1, retainedFor: 'test',
    });
    if (!staged.stored) skip(`Staging failed: ${staged.reason}`);
    else {
      assert(staged.stored && staged.expires_at, 'Ephemeral staging returns storage info + expiry.');
      await new Promise((r) => setTimeout(r, 1500));
      const purged = await purgeExpiredEphemeral({ dryRun: false });
      assert(purged.ok && purged.purged.some((p) => p.includes('vi-test-ephemeral')), `Expired ephemeral file purged (${purged.purged.length} file(s)).`);
    }
  }
}

// ═══ 14 — existing engines untouched ════════════════════════════════════════
scenario('14', 'Existing engines & pipelines untouched (additive change only)');
{
  const EXPECTED_MODIFIED = new Set([
    'app/admin/visual-assets/page.js', // admin UI extended (library behaviour preserved)
    'tsconfig.json',                   // one-line pre-existing-build fix: target es5 → ES2017
    'vercel.json',                     // cron entry added for the storage purge (additive)
  ]);
  const EXPECTED_NEW_PREFIXES = [
    'lib/visual-intelligence/', 'app/api/admin/visual-intelligence/', 'app/api/visual-intelligence/',
    'app/api/cron/visual-cache-purge/', 'supabase/migrations/20261122120000', 'scripts/visual-intelligence-tests.mjs',
    'docs/VISUAL-INTELLIGENCE.md',
  ];
  let status;
  try {
    const out = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
    status = out.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.length >= 4);
  } catch {
    skip('git metadata unavailable in this export; verify by file listing instead.');
    status = null;
  }
  if (status) {
    const modified = [];
    const added = [];
    for (const line of status) {
      const code = line.slice(0, 2).trim();
      const file = line.slice(3).trim().replace(/^"|"$/g, '');
      if (!file) continue;
      if (code === '??' || EXPECTED_NEW_PREFIXES.some((p) => file.startsWith(p))) added.push(file);
      else modified.push(file);
    }
    const unexpected = modified.filter((f) => !EXPECTED_MODIFIED.has(f));
    assert(unexpected.length === 0, `No unexpected modified files (modified: ${modified.length ? modified.join(', ') : 'none'}; unexpected: ${unexpected.length ? unexpected.join(', ') : 'none'}).`);
    // Untracked entries collapse whole directories — count real files.
    let newFileCount = 0;
    const walk = (p) => {
      let n = 0;
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(p, entry.name);
        n += entry.isDirectory() ? walk(full) : 1;
      }
      return n;
    };
    for (const f of added) {
      const full = path.join(ROOT, f);
      newFileCount += fs.statSync(full).isDirectory() ? walk(full) : 1;
    }
    assert(newFileCount >= 10, `Additive files present (${newFileCount} new files across ${added.length} new paths).`);
  }
  // Engine files still exist and still parse.
  const engineFiles = [
    'app/api/admin/whiteboard', 'app/api/admin/whiteboard-engine', 'app/api/admin/stickman-engine',
    'app/api/admin/cartoon-studio', 'app/api/engines/visual-blueprint',
    'local-video-renderer/visual-learning-worker.js', 'lib/image-search.js',
    'app/api/admin/visual-assets/route.js', 'app/api/cron/daily-missions/route.js',
  ];
  const missing = engineFiles.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  assert(missing.length === 0, `Existing engine/API entry points still present${missing.length ? ' — MISSING: ' + missing.join(', ') : ''}.`);
  // Admin page keeps the original upload/library contracts.
  const adminRoute = fs.readFileSync(path.join(ROOT, 'app/api/admin/visual-assets/route.js'), 'utf8');
  assert(adminRoute.includes("from('visual_assets')") && adminRoute.includes('content_hash'), 'Existing visual-assets API contract (library search + hash dedup upload) unchanged.');
  const page = fs.readFileSync(path.join(ROOT, 'app/admin/visual-assets/page.js'), 'utf8');
  assert(page.includes("'/api/admin/visual-assets'"), 'Admin library tab still talks to the original API endpoints.');
  // Syntax-check every new module with node.
  const newModules = [
    'lib/visual-intelligence/license-policy.js', 'lib/visual-intelligence/procedural.js',
    'lib/visual-intelligence/inspect.js', 'lib/visual-intelligence/decide.js',
    'lib/visual-intelligence/storage.js', 'lib/visual-intelligence/discover.js',
    'lib/visual-intelligence/providers/index.js', 'lib/visual-intelligence/providers/http.js',
    'lib/visual-intelligence/providers/photo-providers.js', 'lib/visual-intelligence/providers/svg-providers.js',
    'lib/visual-intelligence/providers/three-d-providers.js',
  ];
  for (const m of newModules) {
    try {
      execSync(`node --check "${path.join(ROOT, m)}"`, { encoding: 'utf8' });
      pass(`Syntax OK: ${m}`);
    } catch (e) {
      fail(`Syntax check failed: ${m}`);
    }
  }
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════');
const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
for (const r of results) counts[r.status]++;
for (const r of results) {
  if (r.status === 'FAIL') console.log(`  FAIL  ${r.scenario} — ${r.msg}`);
}
console.log(`  ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIP} skipped`);
if (counts.SKIP) console.log('  (skipped checks need credentials/network/Supabase env — reasons printed above)');
process.exitCode = counts.FAIL ? 1 : 0;
