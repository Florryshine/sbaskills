'use client';
import React, { useEffect, useState } from "react";
import { 
  Plus, RefreshCw, Unlink, CheckCircle2, ShieldAlert, KeyRound, 
  Settings, ExternalLink, Sparkles, Database, HelpCircle
} from "lucide-react";
import { SocialChannel, SocialPlatform } from "../types";

interface ChannelManagerProps {
  channelsUpdatedTrigger: number;
  onChannelsChanged: () => void;
}

export function ChannelManager({ channelsUpdatedTrigger, onChannelsChanged }: ChannelManagerProps) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Connect Form State
  const [platform, setPlatform] = useState(SocialPlatform.X);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Settings state
  const [postizApiKey, setPostizApiKey] = useState("pk_postiz_live_88a91c3be3bfa881e");
  const [postizWorkspaceId, setPostizWorkspaceId] = useState("ws_shiney_brain_academy");

  useEffect(() => {
    fetchChannels();
  }, [channelsUpdatedTrigger]);

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/social/channels");
      const data = await res.json();
      setChannels(data);
    } catch (err) {
      console.error("Failed to load connected channels", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          handle,
          name: name || `${platform} Profile`,
        }),
      });

      if (res.ok) {
        setHandle("");
        setName("");
        fetchChannels();
        onChannelsChanged();
      }
    } catch (err) {
      console.error("Failed to connect channel", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this social channel from the Postiz API workspace?")) return;

    try {
      const res = await fetch(`/api/social/channels/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchChannels();
        onChannelsChanged();
      }
    } catch (err) {
      console.error("Failed to disconnect channel", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Left Form Column: Channel connector */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl h-fit space-y-6">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles size={18} className="text-violet-400" />
            <span>Postiz API Account Link</span>
          </h3>
          <p className="text-slate-400 text-xs mt-1">Connect new platforms to your active Shiney Brain educational workspace.</p>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-mono block">Social Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
            >
              {Object.values(SocialPlatform).map((plat) => (
                <option key={plat} value={plat}>{plat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-mono block">Profile Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shiney Brain Academy Study Group"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-mono block">Social Handle / Address</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. @ShineyBrain"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={syncing || !handle}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider font-mono"
          >
            {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            <span>Sync account with Postiz</span>
          </button>
        </form>

        <div className="border-t border-slate-850 pt-4 space-y-3.5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <Database size={13} className="text-violet-400" />
              <span>Workspace Sync Keys</span>
            </span>
            <Settings size={13} className="cursor-pointer hover:text-slate-200" />
          </div>

          <div className="space-y-2">
            <div className="relative">
              <KeyRound size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                disabled
                value={postizApiKey}
                className="w-full bg-slate-950/40 border border-slate-850 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-500 font-mono focus:outline-none"
              />
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 text-[10px] text-slate-400 flex items-center gap-2 font-mono">
              <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
              <span>Workspace ID Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Right Column: Channels list */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-100">Synchronized Postiz Pipelines</h3>
            <p className="text-slate-400 text-xs">These active channel mappings are verified for API delivery.</p>
          </div>
          <button 
            onClick={fetchChannels} 
            className="p-2 bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-850 text-slate-400 hover:text-slate-200 transition-all"
            title="Refresh list"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
            No connected channels found. Link a new profile to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <div 
                key={channel.id} 
                className="bg-slate-950 border border-slate-850 hover:border-slate-800 p-4 rounded-xl flex items-start justify-between gap-4 transition-all"
              >
                <div className="flex gap-3">
                  <img 
                    src={channel.avatarUrl} 
                    alt={channel.name} 
                    className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0"
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-100 text-xs truncate block">{channel.name}</span>
                      <span className="bg-indigo-600/10 text-indigo-400 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">
                        {channel.platform}
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-mono block truncate">{channel.handle}</span>
                    <span className="text-[9px] text-slate-500 font-mono block">ID: {channel.postizChannelId}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDisconnect(channel.id)}
                  title="Unlink Pipeline"
                  className="p-1.5 bg-slate-900 hover:bg-rose-950/20 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-850 transition-all shrink-0"
                >
                  <Unlink size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





