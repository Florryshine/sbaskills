'use client';
import React, { useState } from "react";
import { 
  Sparkles, BookOpen, Layers, MessageSquare, Send, Calendar, CheckCircle, 
  HelpCircle, ThumbsUp, Trash2, Globe, Eye, Code, RefreshCw
} from "lucide-react";
import { TargetAudience, PostTone, SocialPlatform } from "../types";
import { PostPreviewer } from "./PostPreviewer";

// Quick mock Knowledge Assets to make selection super interactive and education-aligned
const PRESET_ASSETS = [
  {
    id: "ka-1",
    title: "Mastering Projectile Motion for JAMB 2026",
    subject: "Physics",
    description: "Formulas and multi-angle vector calculations for projectile flight, maximum heights, and gravity flight periods."
  },
  {
    id: "ka-2",
    title: "WAEC 2026 Core Mathematics: Quadratic Functions & Graphs",
    subject: "Mathematics",
    description: "Syllabus mapping for quadratic equations, finding vertex curves, parabolas, and solving roots visually."
  },
  {
    id: "ka-3",
    title: "Memorization Hack: The Memory Palace for Organic Chemistry Formulas",
    subject: "Chemistry",
    description: "A complete step-by-step cognitive guide to memorizing alkane structures, alkanol reactions, and benzene rings easily."
  },
  {
    id: "ka-4",
    title: "Shiney Brain Ultimate Exam Time Management Framework",
    subject: "General Study",
    description: "Study schedules, pomodoro ratios, high-stress management, and breakfast-day strategies for university level candidates."
  }
];

interface AICampaignCreatorProps {
  onCampaignGenerated: () => void;
}

export function AICampaignCreator({ onCampaignGenerated }: AICampaignCreatorProps) {
  const [selectedAsset, setSelectedAsset] = useState(PRESET_ASSETS[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  
  const [subject, setSubject] = useState("Physics");
  const [tone, setTone] = useState(PostTone.EXAM_COACH);
  const [audience, setAudience] = useState(TargetAudience.JAMB_CANDIDATES);
  
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [currentPlatformPreview, setCurrentPlatformPreview] = useState(SocialPlatform.X);
  const [loadingStep, setLoadingStep] = useState("");

  const triggerGeneration = async () => {
    setGenerating(true);
    setLoadingStep("Connecting to Shiney Brain pipeline...");
    
    // Animate some cool educational steps so they know Gemini is compiling curriculum data
    const steps = [
      "Accessing Knowledge Asset schemas...",
      "Analyzing educational syllabus maps...",
      "Invoking Gemini 3.5 AI Engine...",
      "Formulating platform-specific copywriting...",
      "Synthesizing high-fidelity image prompts...",
      "Generating call-to-action endpoints...",
      "Structuring Social Media Postiz schedule queue..."
    ];

    let currentStepIndex = 0;
    const interval = setInterval(() => {
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        setLoadingStep(steps[currentStepIndex]);
      }
    }, 1200);

    try {
      const topicText = useCustom ? customTopic : selectedAsset.title;
      const descriptionText = useCustom ? "" : selectedAsset.description;

      const response = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicText,
          subject,
          tone,
          audience,
          sourceType: "blog",
          sourceId: selectedAsset.id,
          sourceTitle: topicText + " " + descriptionText,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Generation request failed");
      }

      setGeneratedResult(data);
      if (data.posts && data.posts.length > 0) {
        // Set first generated post's platform as preview
        setCurrentPlatformPreview(data.posts[0].platform);
      }
      onCampaignGenerated();
    } catch (err: any) {
      alert("AI pipeline failed to generate. Please check GEMINI_API_KEY settings or try again. Error: " + err.message);
    } finally {
      clearInterval(interval);
      setGenerating(false);
    }
  };

  const publishImmediately = async (postId: string) => {
    try {
      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        // Update local state status to Published
        setGeneratedResult((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            posts: prev.posts.map((p: any) => 
              p.id === postId ? { ...p, status: "Published" } : p
            )
          };
        });
        onCampaignGenerated();
      }
    } catch (err) {
      console.error("Publishing immediate post failed", err);
    }
  };

  const getPostByPlatform = (platform: any) => {
    if (!generatedResult || !generatedResult.posts) return null;
    return generatedResult.posts.find((p: any) => p.platform === platform);
  };

  const handlePostSaved = (updatedPost: any) => {
    setGeneratedResult((prev: any) => {
      if (!prev) return null;
      return {
        ...prev,
        posts: prev.posts.map((p: any) =>
          p.id === updatedPost.id ? { ...p, ...updatedPost } : p
        ),
      };
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. Generation Parameters Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-violet-600/20 text-violet-400 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md font-mono">
                AI Powered Pipeline
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              <span className="text-xs text-indigo-300 font-mono">Gemini 3.5 Flash</span>
            </div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles size={18} className="text-violet-400" />
              <span>Syllabus-to-Social Content Generator</span>
            </h3>
          </div>
          <Layers className="text-slate-500" size={20} />
        </div>

        <div className="p-6 space-y-6">
          {/* Asset picker selector */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-300 font-mono flex items-center gap-2">
                <BookOpen size={13} className="text-indigo-400" />
                <span>1. Choose Knowledge Asset Source</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseCustom(false)}
                  className={`text-[10px] px-2 py-1 rounded font-mono border transition-all ${
                    !useCustom 
                      ? "bg-indigo-600 border-indigo-500 text-white" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Preset Assets
                </button>
                <button
                  onClick={() => setUseCustom(true)}
                  className={`text-[10px] px-2 py-1 rounded font-mono border transition-all ${
                    useCustom 
                      ? "bg-indigo-600 border-indigo-500 text-white" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Custom Topic
                </button>
              </div>
            </div>

            {!useCustom ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_ASSETS.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => {
                      setSelectedAsset(asset);
                      setSubject(asset.subject);
                    }}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedAsset.id === asset.id
                        ? "bg-slate-950 border-indigo-500 ring-1 ring-indigo-500/30"
                        : "bg-slate-950/40 border-slate-850 hover:border-slate-800"
                    }`}
                  >
                    <span className="text-[10px] font-bold font-mono text-indigo-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-850">
                      {asset.subject}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 mt-2 truncate">{asset.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{asset.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g. Explaining Newton's Laws of Motion with real-world examples..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 font-sans"
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Subject Category</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Physics, Chemistry"
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-sans"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tone & Target parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-mono block">2. Target Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {Object.values(TargetAudience).map((aud) => (
                  <option key={aud} value={aud}>{aud}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-mono block">3. Writing Tone Voice</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {Object.values(PostTone).map((tn) => (
                  <option key={tn} value={tn}>{tn}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generate Button / Loading */}
          <div className="pt-2">
            {!generating ? (
              <button
                onClick={triggerGeneration}
                disabled={useCustom && !customTopic}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed font-mono uppercase tracking-wider"
              >
                <Sparkles size={16} />
                <span>Generate Platform Social Campaign</span>
              </button>
            ) : (
              <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="text-indigo-400 animate-spin" />
                  <span className="text-xs font-semibold text-slate-200">Gemini content compilation active...</span>
                </div>
                <p className="text-[11px] font-mono text-indigo-400 animate-pulse">{loadingStep}</p>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full w-2/3 animate-pulse"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Generated Campaign Showcase */}
      {generatedResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                  Campaign Active
                </span>
                {generatedResult.isDemo && (
                  <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/20">
                    Playground Sandbox Template
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-100 text-base mt-2">{generatedResult.campaign.name}</h3>
              <p className="text-slate-400 text-xs">Generated for {generatedResult.campaign.audience} in "{generatedResult.campaign.tone}" tone.</p>
            </div>
            
            <div className="flex gap-2">
              <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-900 px-3 py-1.5 rounded-lg">
                Campaign ID: {generatedResult.campaign.id.substring(0, 10)}...
              </span>
            </div>
          </div>

          {/* Social Platform Toggle Selection */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-mono block">Select Social Platform Preview:</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1.5">
              {(generatedResult.posts || []).map((p: any) => (
                <button
                  key={p.platform}
                  onClick={() => setCurrentPlatformPreview(p.platform)}
                  className={`text-xs px-3 py-2 rounded-lg font-medium transition-all shrink-0 ${
                    currentPlatformPreview === p.platform
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850"
                  }`}
                >
                  {p.platform}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-view Interactive Post Frame Mockups */}
          {getPostByPlatform(currentPlatformPreview) ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Post Mockup Frame */}
              <div className="lg:col-span-7">
                <PostPreviewer post={getPostByPlatform(currentPlatformPreview)} onSaved={handlePostSaved} />
              </div>

              {/* Right Column: Copywriting Parameters & Delivery actions */}
              <div className="lg:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-5">
                <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-850">
                  <Code size={13} className="text-indigo-400" />
                  <span>Pipeline Parameters</span>
                </h4>

                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-400 font-mono">Current Status</span>
                    <span className={`text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded ${
                      getPostByPlatform(currentPlatformPreview)?.status === "Published"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}>
                      {getPostByPlatform(currentPlatformPreview)?.status}
                    </span>
                  </div>

                  {/* Best posting hours */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block mb-1">Optimal Posting Target</span>
                    <p className="text-xs text-slate-200 font-semibold bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                      {getPostByPlatform(currentPlatformPreview)?.bestPostingTime || "Unspecified"}
                    </p>
                  </div>

                  {/* AI Image prompt */}
                  {getPostByPlatform(currentPlatformPreview)?.imagePrompt && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-mono block">GenAI Image Prompt</span>
                      <div className="bg-slate-900/40 border border-slate-850 p-3 rounded-lg relative group">
                        <p className="text-[10px] font-mono text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
                          {getPostByPlatform(currentPlatformPreview)?.imagePrompt}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Alt text */}
                  {getPostByPlatform(currentPlatformPreview)?.altText && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">Accessibility Alt Text</span>
                      <p className="text-[10px] text-slate-400 italic leading-relaxed bg-slate-900 p-2 rounded-lg border border-slate-850">
                        {getPostByPlatform(currentPlatformPreview)?.altText}
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block mb-1">Hashtags</span>
                    <div className="flex flex-wrap gap-1">
                      {getPostByPlatform(currentPlatformPreview)?.hashtags.map((h: string) => (
                        <span key={h} className="text-[10px] bg-indigo-950/30 text-indigo-400 border border-indigo-900 px-2 py-0.5 rounded font-mono">
                          #{h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  {getPostByPlatform(currentPlatformPreview)?.callToAction && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">Call To Action Link Destination</span>
                      <p className="text-[10px] text-violet-400 bg-violet-950/20 border border-violet-900/40 p-2.5 rounded-lg leading-relaxed">
                        {getPostByPlatform(currentPlatformPreview)?.callToAction}
                      </p>
                    </div>
                  )}
                </div>

                {/* Delivery controls */}
                <div className="pt-2 border-t border-slate-850 flex gap-2">
                  <button
                    onClick={() => publishImmediately(getPostByPlatform(currentPlatformPreview)!.id)}
                    disabled={getPostByPlatform(currentPlatformPreview)?.status === "Published"}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <Send size={13} />
                    <span>Deliver Immediately</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs font-mono">
              Platform preview missing for {currentPlatformPreview}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}





