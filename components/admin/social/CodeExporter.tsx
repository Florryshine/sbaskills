'use client';
import React, { useState } from "react";
import { 
  Code, Folder, Copy, Check, FileCode, CheckCircle2, Terminal, ListCollapse, BookOpen
} from "lucide-react";
import { integrationFiles } from "../data/integrationFiles";

export function CodeExporter() {
  const [activeFile, setActiveFile] = useState(integrationFiles[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Intro card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950 border border-indigo-900 rounded-xl">
            <Terminal className="text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Drop-in Enterprise Codebase Exporter</h3>
            <p className="text-slate-400 text-xs">Access fully designed source files to copy and paste directly into Shiney Brain Academy's Next.js project.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-400 font-mono">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>Supabase RLS Enforced SQL</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>Postiz API Layer Client</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>Background Chron Workers</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
            <Folder size={12} className="text-indigo-400" />
            <span>Integration Files</span>
          </div>

          <div className="space-y-1.5">
            {integrationFiles.map((file) => (
              <button
                key={file.name}
                onClick={() => {
                  setActiveFile(file);
                  setCopied(false);
                }}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-2.5 ${
                  activeFile.name === file.name
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850 hover:border-slate-800"
                }`}
              >
                <FileCode size={14} className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs font-bold block truncate leading-tight">{file.name}</span>
                  <span className="text-[9px] font-mono opacity-80 block truncate mt-0.5">{file.path}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Code Content display area */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Header toolbar */}
          <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest font-extrabold bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/60">
                {activeFile.language} Source
              </span>
              <h4 className="font-semibold text-slate-100 text-xs font-mono">{activeFile.path}</h4>
            </div>

            <button
              onClick={handleCopy}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all font-mono"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Syntax Code Container */}
          <div className="p-6 bg-slate-950 overflow-auto max-h-[500px]">
            <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre font-sans">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Deployment & Integration instructions */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-400" />
          <span>Quick Setup & Deploy Architecture</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="space-y-2">
            <span className="font-bold text-indigo-400 font-mono block">Step 1: Database Provisioning</span>
            <p>
              Execute the provided SQL script in your Supabase SQL editor. It initializes the campaigns, channels, posts, active queue, and performance analytics tables inside your database, mapping indexes and establishing Row-Level Security (RLS) policies allowing secure access.
            </p>
          </div>
          <div className="space-y-2">
            <span className="font-bold text-indigo-400 font-mono block">Step 2: API Keys Configuration</span>
            <p>
              Ensure you configure `POSTIZ_API_KEY`, `POSTIZ_API_URL` and `GEMINI_API_KEY` inside your educational platform's `.env` configuration file. These keys link your active scheduler queue directly into the Postiz workspace pipeline securely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}





