'use client';

// app/admin/lesson-loops/page.js
//
// Pick a knowledge asset -> generate a 2-minute landscape lesson script
// (script+narration+backgrounds run in the background — see
// lesson-loops/generate's header — so this page polls
// /api/admin/lesson-loops/status until it flips from 'generating' to
// 'draft'/'failed') -> record it with LessonLoopRecorder -> saved into
// content_assets/media_files plus per-platform (YouTube/Facebook/TikTok)
// metadata rows, ready for the existing social-engine review dashboard.
//
// Needs a `lesson-loops` bucket in Supabase storage (public read,
// authenticated upload — same policy shape as `quote-loops`) before the
// first save.

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import LessonLoopRecorder from '@/components/LessonLoopRecorder';
import PublishToChannels from '@/components/admin/PublishToChannels';
import { updateContentAsset } from '@/lib/admin/updateContentAsset';

const POLL_INTERVAL_MS = 3000;

export default function LessonLoopsPage() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const pollTimerRef = useRef(null);

  // Inline edit. Unlike the other loops, each segment's spoken "text" here
  // already has real narration audio baked in (synthesizeLine, see
  // lesson-loops/generate's header) — editing it does NOT regenerate that
  // audio, so we flag it clearly rather than pretend it's free. Editing
  // onScreenText is safe either way — it's just the on-screen caption.
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSegments, setEditSegments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const startEdit = (draft) => {
    setEditingId(draft.id);
    setEditTitle(draft.title || '');
    setEditSegments((draft.metadata?.segments || []).map((s) => ({ ...s })));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const updateSegmentField = (index, field, value) => {
    setEditSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const saveEdit = async (draft) => {
    if (!editTitle.trim() || editSegments.some((s) => !s.text.trim() || !s.onScreenText?.trim())) {
      setEditError('Title, and every segment\u2019s spoken line + on-screen text, all need content');
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const trimmedSegments = editSegments.map((s) => ({
        ...s,
        text: s.text.trim(),
        onScreenText: s.onScreenText.trim(),
      }));
      const hookSegment = trimmedSegments.find((s) => s.type === 'hook');
      await updateContentAsset(draft.id, {
        title: editTitle.trim(),
        body: hookSegment?.text || draft.body,
        metadata: { ...draft.metadata, segments: trimmedSegments },
      });
      setEditingId(null);
      await loadExistingDrafts(selectedAssetId);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setAssets(data || []));

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const loadExistingDrafts = async (assetId) => {
    try {
      const res = await fetch(`/api/admin/lesson-loops/list?knowledgeAssetId=${assetId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load drafts');
      setDrafts(data.contentAssets || []);
      return data.contentAssets || [];
    } catch (err) {
      setErrorMsg(err.message);
      setDrafts([]);
      return [];
    }
  };

  useEffect(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (selectedAssetId) loadExistingDrafts(selectedAssetId);
    else setDrafts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId]);

  const pollUntilReady = (contentAssetId) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/lesson-loops/status?contentAssetId=${contentAssetId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Status check failed');

        if (data.status === 'generating') {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        if (data.status === 'failed') {
          setErrorMsg(`Generation failed: ${data.errorMessage || 'unknown error'}`);
          setGenerating(false);
          await loadExistingDrafts(selectedAssetId);
          return;
        }
        // status === 'draft' — ready.
        setGenerating(false);
        await loadExistingDrafts(selectedAssetId);
      } catch (err) {
        setErrorMsg(err.message);
        setGenerating(false);
      }
    };
    poll();
  };

  const handleGenerate = async () => {
    if (!selectedAssetId) return;
    setGenerating(true);
    setErrorMsg(null);
    setWarnings([]);
    try {
      const res = await fetch('/api/admin/lesson-loops/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed to start');
      await loadExistingDrafts(selectedAssetId);
      pollUntilReady(data.contentAssetId);
    } catch (err) {
      setErrorMsg(err.message);
      setGenerating(false);
    }
  };

  const hasVideo = (draft) => (draft.media_files || []).some((m) => m.media_type === 'video' && m.role === 'primary');

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📘 2-Minute Lesson Loops</h1>
        <p className="text-sm text-gray-500">
          Landscape, narrated micro-lessons — hook → teach → example → answer → follow. Built for a real
          YouTube upload, cross-posted to Facebook and TikTok.
        </p>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <label className="block text-sm font-semibold">Knowledge asset / topic</label>
        <select
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select a topic…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.keyword} {a.subject ? `— ${a.subject}` : ''}
            </option>
          ))}
        </select>

        <button
          onClick={handleGenerate}
          disabled={!selectedAssetId || generating}
          className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
        >
          {generating ? '✨ Generating (script + narration)…' : '✨ Generate Lesson'}
        </button>
        {generating && (
          <p className="text-xs text-gray-400">
            Script, narration, and backgrounds are being generated in the background — this can take a
            minute for a full 2-minute lesson. Feel free to leave this page; it'll show up in the drafts list
            below once ready.
          </p>
        )}

        {errorMsg && <p className="text-sm text-red-600">⚠️ {errorMsg}</p>}
        {warnings.map((w, i) => (
          <p key={i} className="text-sm text-amber-600">
            ⚠️ {w}
          </p>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-sm text-gray-500 uppercase">Drafts</h2>
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-xl border p-4">
              {editingId === draft.id ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-500">Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-amber-600">
                    ⚠️ Editing "Spoken line" below changes what's on screen as text but does NOT
                    regenerate the narration audio — the voiceover will still say the old words until
                    you regenerate this lesson. Editing "On-screen text" is always safe.
                  </p>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {editSegments.map((seg, i) => (
                      <div key={i} className="border rounded-lg p-2 space-y-1">
                        <span className="text-xs font-semibold text-gray-400">{seg.label || seg.type}</span>
                        <label className="block text-xs text-gray-500">Spoken line (narration)</label>
                        <textarea
                          value={seg.text}
                          onChange={(e) => updateSegmentField(i, 'text', e.target.value)}
                          rows={2}
                          className="w-full border rounded-lg px-2 py-1 text-sm"
                        />
                        <label className="block text-xs text-gray-500">On-screen text</label>
                        <textarea
                          value={seg.onScreenText || ''}
                          onChange={(e) => updateSegmentField(i, 'onScreenText', e.target.value)}
                          rows={1}
                          className="w-full border rounded-lg px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  {editError && <p className="text-sm text-red-600">⚠️ {editError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(draft)}
                      disabled={saving}
                      className="bg-brand-blue text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{draft.title}</p>
                    {draft.status === 'generating' && (
                      <p className="text-sm text-amber-600 mt-0.5">⏳ Generating script + narration…</p>
                    )}
                    {draft.status === 'failed' && (
                      <p className="text-sm text-red-600 mt-0.5">
                        ⚠️ Failed: {draft.metadata?.error_message || 'unknown error'}
                      </p>
                    )}
                    {draft.metadata?.segments && (
                      <p className="text-xs text-gray-500 mt-1">
                        {draft.metadata.segments.length} segments · ~{Math.round(draft.metadata.totalDurationSeconds || 0)}s
                        · {hasVideo(draft) ? '✅ recorded' : '⏳ not recorded'}
                      </p>
                    )}
                  </div>
                  {draft.status === 'draft' && (
                    <div className="flex gap-2 whitespace-nowrap">
                      {draft.metadata?.segments && (
                        <button
                          onClick={() => startEdit(draft)}
                          className="bg-white border text-gray-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => setActiveDraft(draft)}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200"
                      >
                        {hasVideo(draft) ? 'Re-record' : 'Record'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {editingId !== draft.id && draft.metadata?.youtube && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-gray-500 font-semibold">
                    View platform metadata (YouTube / Facebook / TikTok)
                  </summary>
                  <div className="mt-2 space-y-3 bg-gray-50 rounded-lg p-3">
                    <div>
                      <p className="font-bold text-xs text-gray-500 uppercase">YouTube title</p>
                      <p>{draft.metadata.youtube.title}</p>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-500 uppercase">YouTube description</p>
                      <p className="whitespace-pre-wrap text-gray-700">{draft.metadata.youtube.description}</p>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-500 uppercase">YouTube tags</p>
                      <p className="text-gray-700">{(draft.metadata.youtube.tags || []).join(', ')}</p>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-500 uppercase">Facebook caption</p>
                      <p className="text-gray-700">{draft.metadata.facebook?.caption}</p>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-500 uppercase">TikTok caption</p>
                      <p className="text-gray-700">
                        {draft.metadata.tiktok?.caption} {(draft.metadata.tiktok?.hashtags || []).join(' ')}
                      </p>
                    </div>
                  </div>
                </details>
              )}

              {hasVideo(draft) && <PublishToChannels contentAssetId={draft.id} />}
            </div>
          ))}
        </div>
      )}

      {activeDraft && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Recording: “{activeDraft.title}”</h2>
            <button onClick={() => setActiveDraft(null)} className="text-sm text-gray-400 hover:text-gray-600">
              ✕ Close
            </button>
          </div>
          <LessonLoopRecorder
            contentAsset={activeDraft}
            onSaved={() => loadExistingDrafts(selectedAssetId)}
          />
        </div>
      )}
    </div>
  );
}
