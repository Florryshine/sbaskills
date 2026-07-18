'use client';
import React, { useEffect, useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend, PieChart, Pie, Cell 
} from "recharts";
import { 
  Send, AlertCircle, Clock, MousePointer, Award,
  Sparkles, Globe, ThumbsUp, CalendarClock
} from "lucide-react";
import { SocialPlatform } from "../types";

export function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/social/analytics");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load analytics stats", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#38bdf8", "#ec4899", "#22c55e", "#a855f7"];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header & Summary Cards */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Sparkles className="text-violet-400" size={20} />
          <span>Automation Core Overview</span>
        </h2>
        <p className="text-slate-400 text-xs">Real-time status tracking and click telemetry from connected Postiz pipelines.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Card 1: Published */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-3 top-3 text-emerald-500/10 group-hover:text-emerald-500/20 transition-all duration-300">
            <Send size={50} />
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider block">Published Posts</span>
          <span className="text-3xl font-extrabold text-slate-100 mt-2 block">{stats.summary.published}</span>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-400 font-mono">
            <span>● Sync with Postiz</span>
          </div>
        </div>

        {/* Card 2: Scheduled */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-3 top-3 text-indigo-500/10 group-hover:text-indigo-500/20 transition-all duration-300">
            <Clock size={50} />
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider block">Scheduled Queue</span>
          <span className="text-3xl font-extrabold text-slate-100 mt-2 block">{stats.summary.scheduled}</span>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-indigo-400 font-mono">
            <span>● 15m cron scan</span>
          </div>
        </div>

        {/* Card 3: Failed */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-3 top-3 text-rose-500/10 group-hover:text-rose-500/20 transition-all duration-300">
            <AlertCircle size={50} />
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider block">Failed / Errors</span>
          <span className="text-3xl font-extrabold text-rose-500 mt-2 block">{stats.summary.failed}</span>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-rose-400 font-mono">
            <span>● Auto retry queue</span>
          </div>
        </div>

        {/* Card 4: Total Clicks */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-3 top-3 text-cyan-500/10 group-hover:text-cyan-500/20 transition-all duration-300">
            <MousePointer size={50} />
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider block">Tracked Clicks</span>
          <span className="text-3xl font-extrabold text-slate-100 mt-2 block">{stats.summary.totalClicks}</span>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-cyan-400 font-mono">
            <span>+14.8% vs last week</span>
          </div>
        </div>

        {/* Card 5: Avg Engagement */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-3 top-3 text-pink-500/10 group-hover:text-pink-500/20 transition-all duration-300">
            <Award size={50} />
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider block">Engagement Rate</span>
          <span className="text-3xl font-extrabold text-slate-100 mt-2 block">{stats.summary.averageEngagement}%</span>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-pink-400 font-mono">
            <span>Outstanding reach</span>
          </div>
        </div>
      </div>

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Clicks by Platform */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">Platform Traffic Summary</h3>
              <p className="text-slate-400 text-xs">Total clicks generated from Shiney Brain social campaigns</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">Last 30 Days</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.platformMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="platform" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Audience Clicks" dataKey="clicks" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Engagement Rate Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">Engagement Rates</h3>
              <p className="text-slate-400 text-xs">Platform specific interaction scoring (%)</p>
            </div>
            <Globe className="text-indigo-400" size={18} />
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.platformMetrics.filter((p: any) => p.engagementRate > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="engagementRate"
                  nameKey="platform"
                >
                  {stats.platformMetrics.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono text-slate-400">
            {stats.platformMetrics.map((p: any, index: number) => (
              <div key={p.platform} className="p-1.5 bg-slate-950 rounded border border-slate-850">
                <span className="block truncate font-bold text-slate-300">{p.platform}</span>
                <span style={{ color: COLORS[index % COLORS.length] }}>{p.engagementRate || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Heatmap & Top Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap recommendation of posting schedule */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">AI Heatmap: Recommended Posting Hours</h3>
              <p className="text-slate-400 text-xs">Based on parent and student platform activity metrics</p>
            </div>
            <CalendarClock size={18} className="text-violet-400" />
          </div>

          <div className="space-y-3">
            {[
              { day: "Mondays", slots: ["08:00 AM (X)", "11:30 AM (LinkedIn)", "04:00 PM (Telegram)"], score: 95, color: "from-violet-600 to-indigo-600" },
              { day: "Tuesdays", slots: ["12:00 PM (Threads)", "04:00 PM (Telegram)", "07:00 PM (Facebook)"], score: 88, color: "from-blue-600 to-cyan-600" },
              { day: "Wednesdays", slots: ["09:00 AM (Pinterest)", "03:00 PM (Instagram)"], score: 72, color: "from-emerald-600 to-teal-600" },
              { day: "Thursdays", slots: ["10:30 AM (LinkedIn)", "06:00 PM (WhatsApp)"], score: 81, color: "from-orange-600 to-amber-600" },
              { day: "Fridays", slots: ["11:00 AM (X)", "08:00 PM (YouTube)"], score: 90, color: "from-rose-600 to-pink-600" },
            ].map((d) => (
              <div key={d.day} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-200 block">{d.day}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {d.slots.map((s) => (
                      <span key={s} className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800 font-mono">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Heat Score</span>
                  <span className="text-sm font-extrabold text-slate-200 font-mono">{d.score}%</span>
                  <div className="w-16 bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${d.color}`} style={{ width: `${d.score}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top performing content list */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">Top Performing Social Campaign Assets</h3>
              <p className="text-slate-400 text-xs">Posts generating the highest click conversion in past cycles</p>
            </div>
            <ThumbsUp size={18} className="text-emerald-400" />
          </div>

          <div className="space-y-3">
            {stats.topPosts && stats.topPosts.length > 0 ? (
              stats.topPosts.slice(0, 4).map((post: any) => (
                <div key={post.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-indigo-400 font-mono shrink-0">
                    {post.platform.substring(0, 2)}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-xs text-slate-200 truncate font-medium">{post.content}</p>
                    <div className="flex items-center gap-2.5 text-[10px] font-mono text-slate-500">
                      <span>Platform: <b className="text-slate-400">{post.platform}</b></span>
                      <span>•</span>
                      <span>Clicks: <b className="text-indigo-400">{post.clicks}</b></span>
                      <span>•</span>
                      <span>Reach: <b className="text-emerald-400">{post.engagement}%</b></span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                No published analytics data found. Complete a post delivery first.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}





