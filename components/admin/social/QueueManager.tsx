'use client';
import React, { useEffect, useState } from "react";
import { 
  Clock, CheckCircle, AlertTriangle, Play, RefreshCcw, Trash2, 
  Filter, Search, Calendar, ChevronRight, Ban, Send, Eye
} from "lucide-react";
import { JobStatus, QueueItem } from "../types";

interface QueueManagerProps {
  queueUpdatedTrigger: number;
  onQueueChanged: () => void;
}

export function QueueManager({ queueUpdatedTrigger, onQueueChanged }: QueueManagerProps) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchQueue();
  }, [queueUpdatedTrigger]);

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/social/queue");
      const data = await res.json();
      setQueue(data);
    } catch (err) {
      console.error("Failed to load post queue", err);
    } finally {
      setLoading(false);
    }
  };

  const publishNow = async (postId: string) => {
    try {
      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        fetchQueue();
        onQueueChanged();
      }
    } catch (err) {
      console.error("Failed to publish post immediately", err);
    }
  };

  const retryPost = async (postId: string) => {
    try {
      const res = await fetch("/api/social/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        fetchQueue();
        onQueueChanged();
      }
    } catch (err) {
      console.error("Failed to retry post", err);
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to cancel and delete this scheduled social post?")) return;
    try {
      const res = await fetch(`/api/social/post/${postId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchQueue();
        onQueueChanged();
      }
    } catch (err) {
      console.error("Failed to delete post", err);
    }
  };

  const getStatusStyle = (status: any) => {
    switch (status) {
      case JobStatus.PUBLISHED:
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case JobStatus.FAILED:
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case JobStatus.PROCESSING:
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse";
      default:
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    }
  };

  const filteredQueue = queue.filter((item) => {
    const matchesFilter = filter === "ALL" || item.status.toUpperCase() === filter;
    const matchesSearch = item.content.toLowerCase().includes(search.toLowerCase()) || 
                          item.platform.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Filters Header */}
      <div className="p-6 border-b border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Clock size={18} className="text-indigo-400" />
              <span>Background Job Queue Worker</span>
            </h3>
            <p className="text-slate-400 text-xs">Simulated Vercel Cron engine running in 15m intervals to execute Postiz queues.</p>
          </div>
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850 overflow-x-auto max-w-full shrink-0">
            {["ALL", "PENDING", "PUBLISHED", "FAILED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`text-[10px] font-mono px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filter === tab
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search post copy, keywords or platforms..."
              className="w-full bg-slate-950 border border-slate-805 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* Queue items list */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="p-16 text-center text-slate-500 text-xs font-mono">
          No social queue jobs found matching current filters.
        </div>
      ) : (
        <div className="divide-y divide-slate-850">
          {filteredQueue.map((item) => (
            <div key={item.id} className="p-5 hover:bg-slate-950/40 transition-all flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-slate-950 text-indigo-400 border border-slate-850 font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                    {item.platform}
                  </span>
                  <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded ${getStatusStyle(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Calendar size={11} />
                    Scheduled: {new Date(item.scheduledTime).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans line-clamp-2 max-w-2xl">
                  {item.content}
                </p>

                {item.postizPayload && (item.postizPayload.media && item.postizPayload.media.length > 0) && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-indigo-300">
                      🎨 Graphic Synced
                    </span>
                    <span>•</span>
                    <span>Postiz Mapping ID: {item.postizPayload.postizId || "None"}</span>
                  </div>
                )}
              </div>

              {/* Actions controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {item.status === JobStatus.PENDING && (
                  <button
                    onClick={() => publishNow(item.postId)}
                    title="Publish Immediately"
                    className="p-2 bg-slate-950 hover:bg-emerald-950/20 text-slate-400 hover:text-emerald-400 rounded-lg border border-slate-850 transition-all"
                  >
                    <Send size={14} />
                  </button>
                )}

                {item.status === JobStatus.FAILED && (
                  <button
                    onClick={() => retryPost(item.postId)}
                    title="Retry Postiz Queue Connection"
                    className="p-2 bg-slate-950 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-400 rounded-lg border border-slate-850 transition-all flex items-center gap-1 text-[11px] font-mono font-bold"
                  >
                    <RefreshCcw size={13} className="animate-spin-slow" />
                    <span>Retry Connection</span>
                  </button>
                )}

                <button
                  onClick={() => deletePost(item.postId)}
                  title="Delete Scheduled Post"
                  className="p-2 bg-slate-950 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-850 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}





