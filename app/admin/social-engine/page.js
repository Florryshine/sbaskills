'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const PLATFORMS = ['instagram', 'facebook', 'telegram', 'linkedin', 'x', 'pinterest', 'youtube', 'tiktok'];

// Founder posts aren't a real target platform — they're generated onto
// linkedin/facebook/instagram rows (see lib/content-factory/generators/founder.js)
// so char limits and existing platform filters still work, marked via an
// asset_type prefix instead. This list is only for the generation picker;
// PLATFORMS above stays the real filter-tab / content_assets.platform list.
const GENERATE_PLATFORMS = [...PLATFORMS, 'founder'];

const VOICE_MODES = [
  { value: 'founder', label: 'Founder' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'funny', label: 'Funny Florry' },
  { value: 'reflective', label: 'Reflective' },
];

// Mirrors GRADIENT_PRESETS in lib/carousel-engine/render-canvas.js — kept in
// sync manually since one is canvas gradient stops and the other is CSS.
const GRADIENT_CSS = {
  ocean: 'linear-gradient(135deg, #0f4c81, #1a73e8)',
  sunrise: 'linear-gradient(135deg, #ff6b6b, #FFCC00)',
  violet: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
  forest: 'linear-gradient(135deg, #064e3b, #10b981)',
  midnight: 'linear-gradient(180deg, #0f172a, #1e293b)',
  candy: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
};

// Mirrored in app/api/admin/content-assets/route.js for server-side validation.
const PLATFORM_LIMITS = {
  x: 280,
  threads: 500,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  telegram: 4096,
};

function CharCounter({ platform, length }) {
  const limit = PLATFORM_LIMITS[platform];
  if (!limit) return null;
  const pct = length / limit;
  const color = pct > 1 ? 'text-red-600' : pct > 0.9 ? 'text-amber-600' : 'text-gray-400';
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {length} / {limit}
      {pct > 1 && <span> — over by {length - limit}</span>}
    </span>
  );
}

const JOB_STATUS_COLORS = {
  queued: 'text-yellow-600',
  scheduled: 'text-yellow-600',
  publishing: 'text-blue-600',
  published: 'text-green-600',
  failed: 'text-red-600',
  cancelled: 'text-gray-400',
  rate_limited: 'text-orange-600',
};

export default function SocialEnginePage() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [channelPickerId, setChannelPickerId] = useState(null);
  const [pickedChannelIds, setPickedChannelIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [lastResults, setLastResults] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [editError, setEditError] = useState(null);
  const [voiceMode, setVoiceMode] = useState('founder');
  const [founderContext, setFounderContext] = useState('');
  const [bgBusyId, setBgBusyId] = useState(null);
  const [bgError, setBgError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [zipBusyId, setZipBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopiedId(key);
      setTimeout(() => setCopiedId((c) => (c === key ? null : c)), 1500);
    } catch {
      setActionError('Clipboard blocked by the browser — try selecting the text manually.');
    }
  };

  // Cross-origin Supabase storage URLs won't respect a plain <a download>,
  // so we fetch the bytes ourselves and trigger the download from a blob
  // URL. Falls back to opening the file in a new tab if the fetch fails
  // (e.g. a storage CORS policy change) so the user is never stuck.
  const downloadUrl = async (url, filename) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  // JSZip is loaded from a CDN at click time instead of being an npm
  // dependency — this is a rarely-used admin action, not worth bundling
  // into every page load.
  const downloadZip = async (draft, slides) => {
    setZipBusyId(draft.id);
    setActionError(null);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const s of slides) {
        const res = await fetch(s.url);
        const blob = await res.blob();
        zip.file(`slide-${s.position + 1}.png`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const objectUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${(draft.title || 'carousel').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setActionError(`ZIP download failed: ${e.message}`);
    }
    setZipBusyId(null);
  };

  const GRADIENTS = ['ocean', 'sunrise', 'violet', 'forest', 'midnight', 'candy'];
  const PATTERNS = ['dots', 'grid', 'diagonal'];

  const applyBackground = async (draftId, background) => {
    setBgBusyId(draftId);
    setBgError(null);
    try {
      const res = await fetch(`/api/admin/content-assets/${draftId}/carousel-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ background }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Background update failed');
      await loadDrafts();
    } catch (e) {
      setBgError(e.message);
    }
    setBgBusyId(null);
  };

  const handleBackgroundImageUpload = (draftId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyBackground(draftId, { type: 'image', imageBase64: reader.result });
    reader.readAsDataURL(file);
  };
  // knowledge_assets has an anon-readable policy elsewhere in the app, so
  // this one still goes through the browser client — content_assets /
  // media_files / video_scripts / social_channels_v2 / publish_jobs are the
  // service_role-only ones and go through /api/admin/* instead.
  const supabase = createBrowserClient();

  useEffect(() => {
    loadAssets();
    loadDrafts();
    loadChannels();
  }, []);

  const loadAssets = async () => {
    const { data } = await supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(100);
    setAssets(data || []);
  };

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content-assets');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load drafts');
      setDrafts(json.data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const loadChannels = async () => {
    try {
      const res = await fetch('/api/admin/channels');
      const json = await res.json();
      if (res.ok) setChannels((json.data || []).filter((c) => c.is_active));
    } catch {
      // non-fatal — channel picker just shows empty
    }
  };

  const togglePlatform = (p) => {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const runGenerate = async () => {
    if (!selectedAssetId) { alert('Pick a knowledge asset first.'); return; }
    setGenerating(true);
    setError(null);
    setLastResults(null);
    try {
      const res = await fetch('/api/content-factory/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeAssetId: selectedAssetId,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
          ...(selectedPlatforms.includes('founder') ? { voiceMode, founderContext } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      // runContentFactory() never throws for a failed carousel/hero-image
      // attach — it records it in results.succeeded[].mediaErrors instead,
      // by design, so one bad image doesn't block the whole draft. But
      // nothing was ever surfacing that here, so a draft could come back
      // with real text and silently no media, with no visible reason why.
      setLastResults(data.results || null);
      await loadDrafts();
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  };

  const deleteDraft = async (id) => {
    if (!confirm('Delete this social engine draft (and its media)?')) return;
    const res = await fetch(`/api/admin/content-assets?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'Failed to delete');
      return;
    }
    loadDrafts();
  };

  const startEdit = (draft) => {
    setEditingId(draft.id);
    setEditDraft(draft.body || '');
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
    setEditError(null);
  };

  const saveEdit = async (id) => {
    setSavingId(id);
    setEditError(null);
    try {
      const res = await fetch('/api/admin/content-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, body: editDraft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setEditingId(null);
      setEditDraft('');
      await loadDrafts();
    } catch (e) {
      setEditError(e.message);
    }
    setSavingId(null);
  };

  // Opens the inline channel picker for a draft, pre-filtered to channels
  // matching that draft's platform — approving doesn't publish anything by
  // itself, it just queues one publish_jobs row per channel selected.
  const openChannelPicker = (draft) => {
    setChannelPickerId(draft.id);
    setPickedChannelIds([]);
  };

  const toggleChannelPick = (channelId) => {
    setPickedChannelIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const confirmApprove = async (contentAssetId) => {
    if (pickedChannelIds.length === 0) { alert('Pick at least one channel.'); return; }
    setBusyId(contentAssetId);
    try {
      const res = await fetch('/api/publish/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentAssetId, channelIds: pickedChannelIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Approve failed');
      setChannelPickerId(null);
      await loadDrafts();
    } catch (e) {
      alert(e.message);
    }
    setBusyId(null);
  };

  // Actually calls the platform API via the real publisher for that job.
  const publishNow = async (jobId, contentAssetId) => {
    setBusyId(contentAssetId);
    try {
      const res = await fetch('/api/publish/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Publish failed');
      if (json.success === false) {
        alert(`Publish failed: ${json.error}${json.willRetry ? ' (will retry automatically)' : ''}`);
      }
      await loadDrafts();
    } catch (e) {
      alert(e.message);
    }
    setBusyId(null);
  };

  const filtered =
    platformFilter === 'all'
      ? drafts
      : platformFilter === 'founder'
      ? drafts.filter((d) => d.asset_type?.startsWith('founder_'))
      : drafts.filter((d) => d.platform === platformFilter && !d.asset_type?.startsWith('founder_'));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🚀 Social Engine</h1>
      <p className="text-sm text-gray-500 mb-6">
        Generates per-platform posts from a knowledge asset — Instagram carousels and
        TikTok/YouTube video scripts are rendered/queued automatically as part of this run.
        Approving a draft queues it to real, connected{' '}
        <a href="/admin/channels" className="text-brand-blue underline">channels</a> — it does not
        post anything by itself until you hit Publish Now.
      </p>

      {/* ── Generate ── */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8">
        <h2 className="font-bold mb-3">Generate</h2>
        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-3">
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm flex-1"
          >
            <option value="">Select a knowledge asset…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.keyword} {a.subject ? `(${a.subject})` : ''}</option>
            ))}
          </select>
          <button
            onClick={runGenerate}
            disabled={generating}
            className="bg-brand-blue text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {GENERATE_PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                selectedPlatforms.includes(p)
                  ? p === 'founder'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-brand-blue text-white border-brand-blue'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p === 'founder' ? 'Founder Post' : p}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Leave all unchecked to generate every platform (Founder Post is opt-in only, never included by default).
        </p>

        {selectedPlatforms.includes('founder') && (
          <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-indigo-700">Voice:</span>
              {VOICE_MODES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setVoiceMode(v.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    voiceMode === v.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'text-indigo-700 border-indigo-200 bg-white hover:bg-indigo-100'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <textarea
              value={founderContext}
              onChange={(e) => setFounderContext(e.target.value)}
              placeholder="Anything on your mind today? (optional — leave blank most of the time)"
              rows={2}
              className="w-full text-sm border border-indigo-200 rounded-lg p-2 font-sans"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        {lastResults && (
          <div className="mt-4 space-y-2">
            {lastResults.succeeded?.map((r) => (
              <div key={r.platform} className="text-xs bg-gray-50 border rounded-lg px-3 py-2">
                <span className="font-semibold text-green-700">✓ {r.platform}</span>
                <span className="text-gray-500"> — {r.count} row(s) created</span>
                {r.mediaErrors?.length > 0 && (
                  <div className="mt-1 text-red-600">
                    ⚠ Media failed to attach: {r.mediaErrors.map((m) => m.error).join('; ')}
                  </div>
                )}
              </div>
            ))}
            {lastResults.failed?.map((r) => (
              <div key={r.platform} className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="font-semibold text-red-700">✗ {r.platform} failed</span>
                <span className="text-red-600"> — {r.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${platformFilter === 'all' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          All
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${platformFilter === p ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setPlatformFilter('founder')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${platformFilter === 'founder' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}
        >
          Founder
        </button>
      </div>

      {/* ── Drafts ── */}
      {loading ? (
        <div className="text-center py-8">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No social engine drafts found.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((draft) => {
            const carouselSlides = (draft.media_files || [])
              .filter((m) => m.role === 'carousel_slide')
              .sort((a, b) => a.position - b.position);
            const heroImage = (draft.media_files || []).find((m) => m.role === 'hero_image' || m.role === 'primary');
            const videoScript = (draft.video_scripts || [])[0];
            const jobs = draft.publish_jobs || [];
            const matchingChannels = channels.filter((c) => c.platform === draft.platform);

            return (
              <div key={draft.id} className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <span className="inline-block text-xs font-bold uppercase tracking-wide text-brand-blue bg-blue-50 rounded-full px-2 py-0.5 mr-2">
                      {draft.platform || draft.asset_type}
                    </span>
                    {draft.asset_type?.startsWith('founder_') && (
                      <span className="inline-block text-xs font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5 mr-2">
                        Founder{draft.metadata?.voiceMode ? ` · ${draft.metadata.voiceMode}` : ''}
                      </span>
                    )}
                    <span className="font-bold">{draft.title || draft.knowledge_assets?.keyword}</span>
                    <p className="text-sm text-gray-500 mt-1">
                      Status: <span className={`font-semibold ${draft.status === 'approved' || draft.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>{draft.status}</span>
                      {carouselSlides.length > 0 && <> • {carouselSlides.length} carousel slide(s)</>}
                      {videoScript && <> • video script: {videoScript.render_status}</>}
                      {heroImage && <> • hero image attached</>}
                    </p>
                    {jobs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {jobs.map((job) => (
                          <span key={job.id} className={`text-xs font-semibold ${JOB_STATUS_COLORS[job.status] || ''} bg-gray-50 border rounded-full px-2 py-0.5`}>
                            {job.social_channels_v2?.label || job.social_channels_v2?.platform}: {job.status}
                            {job.status === 'failed' && job.last_error ? ` — ${job.last_error}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                      {expandedId === draft.id ? 'Hide' : 'Preview'}
                    </button>

                    {draft.body && (
                      <button
                        onClick={() => copyText(draft.body, `text-${draft.id}`)}
                        className="text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 border border-gray-200"
                      >
                        {copiedId === `text-${draft.id}` ? '✓ Copied' : '📋 Copy Text'}
                      </button>
                    )}

                    {editingId !== draft.id && (
                      <button
                        onClick={() => {
                          setExpandedId(draft.id);
                          startEdit(draft);
                        }}
                        className="text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                    )}

                    {jobs.length === 0 && (
                      <button
                        onClick={() => openChannelPicker(draft)}
                        disabled={matchingChannels.length === 0}
                        title={matchingChannels.length === 0 ? `No active ${draft.platform} channel connected` : ''}
                        className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                    )}

                    {jobs.filter((j) => j.status === 'queued' || j.status === 'failed').map((job) => (
                      <button
                        key={job.id}
                        onClick={() => publishNow(job.id, draft.id)}
                        disabled={busyId === draft.id}
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-200 disabled:opacity-50"
                      >
                        {busyId === draft.id ? 'Publishing…' : `Publish Now (${job.social_channels_v2?.platform})`}
                      </button>
                    ))}

                    <button onClick={() => deleteDraft(draft.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">Delete</button>
                  </div>
                </div>

                {/* ── Inline channel picker ── */}
                {channelPickerId === draft.id && (
                  <div className="mt-4 bg-green-50 border border-green-200 p-4 rounded-xl">
                    <p className="text-sm font-semibold mb-2">Publish to which channel(s)?</p>
                    {matchingChannels.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No active {draft.platform} channel connected.{' '}
                        <a href="/admin/channels" className="text-brand-blue underline">Connect one</a>.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {matchingChannels.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => toggleChannelPick(c.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                              pickedChannelIds.includes(c.id)
                                ? 'bg-brand-blue text-white border-brand-blue'
                                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmApprove(draft.id)}
                        disabled={busyId === draft.id || matchingChannels.length === 0}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      >
                        {busyId === draft.id ? 'Queueing…' : 'Confirm Approve'}
                      </button>
                      <button onClick={() => setChannelPickerId(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {expandedId === draft.id && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-xl space-y-4">
                    {editingId === draft.id ? (
                      <div>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={6}
                          className="w-full text-sm border rounded-lg p-3 font-sans"
                          autoFocus
                        />
                        <div className="flex items-center justify-between mt-2">
                          <CharCounter platform={draft.platform} length={editDraft.length} />
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEdit}
                              disabled={savingId === draft.id}
                              className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(draft.id)}
                              disabled={savingId === draft.id}
                              className="bg-brand-blue text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                            >
                              {savingId === draft.id ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                        {editError && <p className="text-xs text-red-600 mt-2">{editError}</p>}
                      </div>
                    ) : (
                      draft.body && (
                        <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
                      )
                    )}
                    {heroImage && (
                      <div>
                        <img src={heroImage.url} alt={draft.title} className="rounded-lg max-h-64 object-cover" />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => downloadUrl(heroImage.url, `${(draft.title || 'hero').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`)}
                            className="text-xs font-semibold text-gray-600 border rounded-full px-3 py-1 hover:bg-gray-50"
                          >
                            ⬇ Download
                          </button>
                          <a
                            href={heroImage.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-gray-600 border rounded-full px-3 py-1 hover:bg-gray-50"
                          >
                            ↗ Open
                          </a>
                          <button
                            onClick={() => copyText(heroImage.url, `hero-url-${draft.id}`)}
                            className="text-xs font-semibold text-gray-600 border rounded-full px-3 py-1 hover:bg-gray-50"
                          >
                            {copiedId === `hero-url-${draft.id}` ? '✓ Copied' : '🔗 Copy URL'}
                          </button>
                        </div>
                      </div>
                    )}
                    {carouselSlides.length > 0 && (
                      <div>
                        <div className="flex justify-end mb-1">
                          <button
                            onClick={() => downloadZip(draft, carouselSlides)}
                            disabled={zipBusyId === draft.id}
                            className="text-xs font-semibold text-indigo-700 border border-indigo-200 rounded-full px-3 py-1 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            {zipBusyId === draft.id ? 'Zipping…' : `📥 Download all (${carouselSlides.length}) as ZIP`}
                          </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {carouselSlides.map((s) => (
                            <div key={s.id} className="relative group">
                              <img src={s.url} alt={`Slide ${s.position + 1}`} className="h-48 rounded-lg border" />
                              <div className="absolute bottom-1 left-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => downloadUrl(s.url, `slide-${s.position + 1}.png`)}
                                  title="Download"
                                  className="bg-black/70 text-white text-xs rounded px-2 py-1"
                                >
                                  ⬇
                                </button>
                                <button
                                  onClick={() => copyText(s.url, `slide-url-${s.id}`)}
                                  title="Copy URL"
                                  className="bg-black/70 text-white text-xs rounded px-2 py-1"
                                >
                                  {copiedId === `slide-url-${s.id}` ? '✓' : '🔗'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {carouselSlides.length > 0 && ['instagram', 'facebook', 'x'].includes(draft.platform) && (
                      <div className="bg-white border rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                          Background (cover + CTA slide)
                        </p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {GRADIENTS.map((g) => (
                            <button
                              key={g}
                              title={g}
                              onClick={() => applyBackground(draft.id, { type: 'gradient', value: g })}
                              disabled={bgBusyId === draft.id}
                              style={{ background: GRADIENT_CSS[g] }}
                              className="h-8 w-8 rounded-full border-2 border-white ring-1 ring-gray-200 disabled:opacity-40"
                            />
                          ))}
                          {PATTERNS.map((p) => (
                            <button
                              key={p}
                              onClick={() => applyBackground(draft.id, { type: 'pattern', value: p })}
                              disabled={bgBusyId === draft.id}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            >
                              {p}
                            </button>
                          ))}
                          <input
                            type="color"
                            onChange={(e) => applyBackground(draft.id, { type: 'solid', value: e.target.value })}
                            disabled={bgBusyId === draft.id}
                            className="h-8 w-8 rounded-full border cursor-pointer disabled:opacity-40"
                            title="Custom solid color"
                          />
                          <label className="px-3 py-1.5 rounded-full text-xs font-semibold border text-indigo-700 border-indigo-200 hover:bg-indigo-50 cursor-pointer">
                            Upload image
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              disabled={bgBusyId === draft.id}
                              onChange={(e) => handleBackgroundImageUpload(draft.id, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                        {bgBusyId === draft.id && <p className="text-xs text-gray-400">Rendering new background…</p>}
                        {bgError && bgBusyId !== draft.id && <p className="text-xs text-red-600">{bgError}</p>}
                        {actionError && <p className="text-xs text-red-600 mt-1">{actionError}</p>}
                      </div>
                    )}
                    {videoScript && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-1 uppercase">
                          Video Script ({videoScript.format}) — {videoScript.render_status}
                        </p>
                        <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                          {(videoScript.script_segments || []).map((seg, i) => (
                            <p key={i}><span className="font-semibold">#{i + 1}:</span> {seg.text}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
