'use client';
import React from "react";
import { Share2, Activity, ShieldCheck, HelpCircle } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-lg text-white">
          <Share2 size={22} className="animate-pulse" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">Shiney Brain Academy</h1>
          <p className="text-xs text-indigo-400 font-mono">Social Media Automation Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Postiz Active Connectors</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-all">
          <ShieldCheck size={14} className="text-violet-400" />
          <span>RLS Enforced</span>
        </div>
      </div>
    </header>
  );
}





