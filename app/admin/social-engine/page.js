'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const PLATFORMS = ['instagram', 'facebook', 'telegram', 'linkedin', 'x', 'pinterest', 'youtube', 'tiktok'];

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

  const filtered = platformFilter === 'all' ? drafts : drafts.filter((d) => d.platform === platformFilter);

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
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                selectedPlatforms.includes(p)
                  ? 'bg-brand-blue text-white border-brand-blue'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Leave all unchecked to generate every platform.
        </p>
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
                    {draft.body && (
                      <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
                    )}
                    {heroImage && (
                      <img src={heroImage.url} alt={draft.title} className="rounded-lg max-h-64 object-cover" />
                    )}
                    {carouselSlides.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {carouselSlides.map((s) => (
                          <img key={s.id} src={s.url} alt={`Slide ${s.position + 1}`} className="h-48 rounded-lg border" />
                        ))}
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
