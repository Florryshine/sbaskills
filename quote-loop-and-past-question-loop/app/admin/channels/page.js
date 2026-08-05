'use client';

import { useState, useEffect } from 'react';

const PLATFORM_FIELDS = {
  facebook: {
    accountLabel: 'Page ID',
    accountPlaceholder: 'e.g. 102938475610203',
    tokenLabel: 'Page Access Token',
    help: 'From Meta for Developers → your app → Facebook Login → a long-lived Page Access Token for this Page.',
  },
  telegram: {
    accountLabel: 'Chat ID (channel/group)',
    accountPlaceholder: 'e.g. -1001234567890 or @yourchannel',
    tokenLabel: 'Bot Token',
    help: 'From @BotFather. Chat ID is the channel/group your bot has been added to as an admin.',
  },
  linkedin: {
    accountLabel: 'LinkedIn Member ID (numeric)',
    accountPlaceholder: 'e.g. 78945612',
    tokenLabel: 'OAuth2 Access Token',
    help: 'From your LinkedIn Developer app, after completing the OAuth2 flow with w_member_social scope.',
  },
  instagram: { accountLabel: 'IG Business Account ID', accountPlaceholder: '', tokenLabel: 'Access Token', help: '' },
  x: { accountLabel: 'Account ID', accountPlaceholder: '', tokenLabel: 'Access Token', help: '' },
  pinterest: { accountLabel: 'Board ID', accountPlaceholder: '', tokenLabel: 'Access Token', help: '' },
  youtube: {
    accountLabel: 'Channel ID',
    accountPlaceholder: '',
    tokenLabel: 'Access Token',
    help: 'YouTube access tokens expire in ~1hr and need a refresh_token to keep working — use "Connect YouTube" above instead of pasting one here.',
  },
  tiktok: {
    accountLabel: 'Account ID',
    accountPlaceholder: '',
    tokenLabel: 'Access Token',
    help: 'TikTok access tokens expire in 24hr and need a refresh_token to keep working — use "Connect TikTok" above instead of pasting one here.',
  },
};

const PLATFORMS = Object.keys(PLATFORM_FIELDS);

// These two need a real OAuth round trip (PKCE for TikTok, offline+consent
// for YouTube's refresh_token) — a pasted-in token alone can't produce
// that, so they get a "Connect" button instead of relying on the manual
// form below. See app/api/auth/{tiktok,youtube}/start.
const OAUTH_PLATFORMS = {
  tiktok: { label: 'TikTok', startUrl: '/api/auth/tiktok/start', color: 'bg-black' },
  youtube: { label: 'YouTube', startUrl: '/api/auth/youtube/start', color: 'bg-red-600' },
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [oauthNotice, setOauthNotice] = useState(null);

  const [platform, setPlatform] = useState('facebook');
  const [label, setLabel] = useState('Main');
  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const fields = PLATFORM_FIELDS[platform];

  useEffect(() => {
    load();
    // Reads ?success=tiktok / ?error=... left by the OAuth callback routes.
    // Parsed from window.location directly (not useSearchParams) so this
    // stays a plain client component with no Suspense boundary required.
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const oauthError = params.get('error');
    if (success) setOauthNotice({ type: 'success', text: `${success} connected.` });
    if (oauthError) setOauthNotice({ type: 'error', text: oauthError });
    if (success || oauthError) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/channels');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load channels');
      setChannels(json.data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!accessToken.trim()) { alert('Access token / bot token is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          label: label.trim() || 'Main',
          account_id: accountId.trim(),
          access_token: accessToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save channel');
      setAccountId('');
      setAccessToken('');
      await load();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  const toggleActive = async (id, is_active) => {
    await fetch('/api/admin/channels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this channel? Anything queued to publish through it will fail.')) return;
    await fetch(`/api/admin/channels?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🔌 Channels</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect real accounts so Social Engine drafts can actually be published.
        Tokens are stored server-side only — the list below never shows the full value again.
      </p>

      {oauthNotice && (
        <div
          className={`rounded-xl border p-3 mb-6 text-sm ${
            oauthNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {oauthNotice.type === 'success' ? '✅ ' : '⚠️ '}
          {oauthNotice.text}
        </div>
      )}

      {/* ── OAuth connect — TikTok and YouTube need a real consent round trip
          (PKCE / offline+consent) to get a working refresh_token; a pasted
          token alone can't produce that. ── */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8">
        <h2 className="font-bold mb-3">Connect via OAuth</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(OAUTH_PLATFORMS).map(([key, cfg]) => (
            <a
              key={key}
              href={cfg.startUrl}
              className={`${cfg.color} text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 inline-block`}
            >
              Connect {cfg.label}
            </a>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Requires the platform's client ID/secret to be set in your environment first (see .env.example).
        </p>
      </div>

      {/* ── Add / update a channel ── */}
      <form onSubmit={save} className="bg-white rounded-2xl shadow-sm border p-4 mb-8 space-y-3">
        <h2 className="font-bold">Connect a channel</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm w-full"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Main"
              className="border rounded-xl px-3 py-2 text-sm w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{fields.accountLabel}</label>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder={fields.accountPlaceholder}
            className="border rounded-xl px-3 py-2 text-sm w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{fields.tokenLabel}</label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Paste token here"
            className="border rounded-xl px-3 py-2 text-sm w-full font-mono"
          />
          {fields.help && <p className="text-xs text-gray-400 mt-1">{fields.help}</p>}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-brand-blue text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Channel'}
        </button>
        <p className="text-xs text-gray-400">
          Saving with the same platform + label again updates that channel's token instead of creating a duplicate.
        </p>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* ── Existing channels ── */}
      {loading ? (
        <div className="text-center py-8">Loading…</div>
      ) : channels.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No channels connected yet.</div>
      ) : (
        <div className="grid gap-3">
          {channels.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-wide text-brand-blue bg-blue-50 rounded-full px-2 py-0.5 mr-2">
                  {c.platform}
                </span>
                <span className="font-bold">{c.label}</span>
                <p className="text-sm text-gray-500 mt-1">
                  {c.account_id || '—'} • Token: <span className="font-mono">{c.access_token}</span>
                  {' • '}
                  <span className={c.is_active ? 'text-green-600 font-semibold' : 'text-gray-400 font-semibold'}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(c.id, c.is_active)}
                  className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200"
                >
                  {c.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
