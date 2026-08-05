'use client';

import { useState, useEffect } from 'react';

// Only platforms with a real /api/auth/<platform>/start + callback route in the
// repo get the OAuth "Connect" button. Everything else still needs a manually
// pasted token — showing a fake Connect button for those would just 404.
const PLATFORM_META = {
  youtube: {
    name: 'YouTube',
    icon: '🟥',
    color: 'bg-red-600',
    oauth: true,
    oauthPath: '/api/auth/youtube/start',
    accountLabel: 'Channel ID',
    tokenLabel: 'Access Token',
    help: '',
  },
  tiktok: {
    name: 'TikTok',
    icon: '⚫',
    color: 'bg-black',
    oauth: true,
    oauthPath: '/api/auth/tiktok/start',
    accountLabel: 'Account ID',
    tokenLabel: 'Access Token',
    help: '',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '🔵',
    color: 'bg-blue-700',
    oauth: true,
    oauthPath: '/api/auth/linkedin/start',
    accountLabel: 'LinkedIn Member ID (numeric)',
    tokenLabel: 'OAuth2 Access Token',
    help: 'Only needed if you want to paste a token manually instead of using Connect.',
  },
  facebook: {
    name: 'Facebook',
    icon: '🟦',
    color: 'bg-blue-600',
    oauth: false,
    accountLabel: 'Page ID',
    tokenLabel: 'Page Access Token',
    help: 'From Meta for Developers → your app → Facebook Login → a long-lived Page Access Token for this Page.',
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    color: 'bg-pink-600',
    oauth: false,
    accountLabel: 'IG Business Account ID',
    tokenLabel: 'Access Token',
    help: '',
  },
  telegram: {
    name: 'Telegram',
    icon: '✈️',
    color: 'bg-sky-500',
    oauth: false,
    accountLabel: 'Chat ID (channel/group)',
    tokenLabel: 'Bot Token',
    help: 'From @BotFather. Chat ID is the channel/group your bot has been added to as an admin.',
  },
  x: {
    name: 'X',
    icon: '⬛',
    color: 'bg-gray-800',
    oauth: false,
    accountLabel: 'Account ID',
    tokenLabel: 'Access Token',
    help: '',
  },
  pinterest: {
    name: 'Pinterest',
    icon: '🟥',
    color: 'bg-red-500',
    oauth: false,
    accountLabel: 'Board ID',
    tokenLabel: 'Access Token',
    help: '',
  },
};

const PLATFORMS = Object.keys(PLATFORM_META);

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(expiresAt) {
  return !!expiresAt && new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const days = (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24);
  return days > 0 && days < 7;
}

function accountDisplay(channel) {
  const meta = channel.metadata || {};
  return (
    meta.username ||
    meta.display_name ||
    meta.title ||
    meta.name ||
    meta.sub ||
    channel.account_id ||
    channel.label
  );
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [manualOpenFor, setManualOpenFor] = useState(null); // platform key or null
  const [manualForm, setManualForm] = useState({ label: 'Main', accountId: '', token: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    if (success) {
      setBanner(`${PLATFORM_META[success]?.name || success} connected successfully.`);
      window.history.replaceState({}, '', '/admin/channels');
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

  const channelFor = (platform) => channels.find((c) => c.platform === platform && c.is_active);

  const connectOAuth = (platform) => {
    window.location.href = PLATFORM_META[platform].oauthPath;
  };

  const disconnect = async (channel) => {
    if (!confirm(`Disconnect ${PLATFORM_META[channel.platform]?.name || channel.platform}? Anything queued to publish through it will fail.`)) return;
    try {
      const res = await fetch(`/api/admin/channels?id=${channel.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const openManual = (platform) => {
    setManualOpenFor(platform);
    setManualForm({ label: 'Main', accountId: '', token: '' });
  };

  const saveManual = async (e) => {
    e.preventDefault();
    if (!manualForm.token.trim()) {
      alert('Token is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: manualOpenFor,
          label: manualForm.label.trim() || 'Main',
          account_id: manualForm.accountId.trim(),
          access_token: manualForm.token.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save channel');
      setManualOpenFor(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🔌 Social Accounts</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect accounts so Social Engine drafts can actually be published. YouTube, TikTok, and LinkedIn
        connect with one click. Other platforms still need a token pasted in manually for now.
      </p>

      {banner && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex justify-between items-center">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-green-700 font-bold">✕</button>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Loading…</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => {
            const meta = PLATFORM_META[platform];
            const channel = channelFor(platform);
            const connected = !!channel;
            const expired = connected && isExpired(channel.token_expires_at);
            const expiringSoon = connected && isExpiringSoon(channel.token_expires_at);

            return (
              <div key={platform} className="bg-white rounded-2xl shadow-sm border p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{meta.name}</h3>
                    {connected ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Connected</span>
                    ) : (
                      <span className="text-xs text-gray-400">Not Connected</span>
                    )}
                  </div>
                </div>

                {connected ? (
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Account: </span><span className="font-semibold">{accountDisplay(channel)}</span></p>
                    <p><span className="text-gray-500">Connected: </span>{formatDate(channel.created_at) || '—'}</p>
                    {channel.token_expires_at && (
                      <p>
                        <span className="text-gray-500">Expires: </span>
                        <span className={expired ? 'text-red-600 font-semibold' : expiringSoon ? 'text-orange-600 font-semibold' : ''}>
                          {formatDate(channel.token_expires_at)}
                          {expired ? ' (expired)' : expiringSoon ? ' (soon)' : ''}
                        </span>
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      {meta.oauth && (
                        <button onClick={() => connectOAuth(platform)} className="flex-1 bg-brand-blue text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-700">
                          Reconnect
                        </button>
                      )}
                      <button onClick={() => disconnect(channel)} className="flex-1 bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-200">
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : meta.oauth ? (
                  <button
                    onClick={() => connectOAuth(platform)}
                    className="w-full bg-brand-blue text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    Connect {meta.name} →
                  </button>
                ) : (
                  <button
                    onClick={() => openManual(platform)}
                    className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-200"
                  >
                    Set up manually
                  </button>
                )}

                {manualOpenFor === platform && (
                  <form onSubmit={saveManual} className="mt-4 pt-4 border-t space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Label</label>
                      <input
                        value={manualForm.label}
                        onChange={(e) => setManualForm({ ...manualForm, label: e.target.value })}
                        className="border rounded-xl px-3 py-2 text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{meta.accountLabel}</label>
                      <input
                        value={manualForm.accountId}
                        onChange={(e) => setManualForm({ ...manualForm, accountId: e.target.value })}
                        className="border rounded-xl px-3 py-2 text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{meta.tokenLabel}</label>
                      <input
                        type="password"
                        value={manualForm.token}
                        onChange={(e) => setManualForm({ ...manualForm, token: e.target.value })}
                        placeholder="Paste token here"
                        className="border rounded-xl px-3 py-2 text-sm w-full font-mono"
                      />
                      {meta.help && <p className="text-xs text-gray-400 mt-1">{meta.help}</p>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={saving} className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setManualOpenFor(null)} className="text-gray-500 text-xs font-bold px-3">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
