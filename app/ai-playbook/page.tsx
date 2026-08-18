"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  BookOpen,
  Cloud,
  Terminal,
  Layers,
  Video,
  ShieldCheck,
  ArrowRight,
  Phone,
  Mail,
  Sparkles,
} from "lucide-react";

export default function AIPlaybookLandingPage() {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      window.location.href = "/ai-playbook/confirmation";
    } catch (err) {
      console.error("Payment error:", err);
      setLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col items-center overflow-x-hidden bg-[#070E1F] text-slate-100 selection:bg-[#FFC42B] selection:text-black min-h-screen">
      {/* Top Header Bar */}
      <header className="w-full border-b border-blue-900/40 bg-[#0B1528]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black tracking-tight text-white">
              SHINEY BRAIN <span className="text-[#FFC42B]">ACADEMY</span>
            </span>
          </div>
          <button
            onClick={handlePayment}
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-md shadow-blue-500/20"
          >
            Get It Now — ₦5,000
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="w-full max-w-6xl px-4 pt-12 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 flex flex-col space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold uppercase tracking-wider text-blue-300 w-fit">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC42B]" />
            <span>For Students</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Stop Spending 6 Hours Reading Only to{" "}
            <span className="text-[#FFC42B] underline decoration-blue-500 decoration-4">
              Forget Everything
            </span>{" "}
            the Next Morning.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            The exact AI workflow to cut study time in half, remember what you read for tests, and finish assignments in minutes without sacrificing sleep.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={handlePayment}
              disabled={loading}
              className="px-8 py-4 text-base font-bold rounded-xl bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-xl shadow-blue-600/30 text-center flex items-center justify-center space-x-2"
            >
              <span>{loading ? "Processing..." : "Get Instant Access — ₦5,000"}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400 pt-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Includes 18 Months Google AI Pro Walkthrough
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 21-Day Money Back Guarantee
            </span>
          </div>
        </div>

        {/* Hero Section Right: Playbook Image */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-xs sm:max-w-sm rounded-2xl p-2 bg-gradient-to-b from-blue-500/20 to-transparent border border-blue-500/30 shadow-2xl shadow-blue-900/50">
            <div className="overflow-hidden rounded-xl bg-[#0B1528]">
              <img
                src="https://cdn.phototourl.com/free/2026-08-17-b9bf12f2-e477-4495-bd83-0d5dfd74e19e.png"
                alt="100/100 AI Playbook of Exam Success for Students"
                className="w-full h-auto object-cover rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="w-full bg-[#0B1528] border-y border-blue-900/40 py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Being Busy Is Not the Same as Being Productive
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              Most students waste valuable semester hours using slow, outdated revision methods.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-6 space-y-3">
              <h3 className="text-base font-bold text-red-400">The Painful Route</h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span> Reading voluminous slides for 4 hours and blanking out in tests.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span> Writing 15-page assignments manually until 11:00 PM the night before.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span> Using default ChatGPT queries that spit out hallucinated or robotic text.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-900/30 bg-emerald-950/20 p-6 space-y-3">
              <h3 className="text-base font-bold text-emerald-400">The 100/100 AI System</h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> AI active-recall drilling tailored directly to your course PDF notes.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Fast research synthesis with valid citations and bullet summaries.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Claiming 18 months of Google AI Pro (Gemini Advanced + 2TB) step-by-step.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="w-full max-w-6xl px-4 py-20 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Everything You Get Inside the Bundle
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            A comprehensive, tested suite designed to put you at the top of your class.
          </p>
        </div>

        {/* Real Visual Artwork Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0B1528] p-3 shadow-xl">
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-3f5342b7-66d5-4330-b35e-58f0a039de0f.png"
              alt="Complete 100/100 AI Playbook Bundle Art"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>

          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0B1528] p-3 shadow-xl">
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-04e7c22b-e0ca-4f24-8b11-1c2c7b015390.png"
              alt="Google AI Pro 18 Months Access Breakdown"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <BookOpen className="w-7 h-7 text-[#FFC42B]" />
            <h3 className="text-base font-bold text-white">1. The 100/100 AI Playbook Core System</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Step-by-step techniques to understand tough topics, read without forgetting, and design sustainable daily study routines.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <Cloud className="w-7 h-7 text-[#1E5AFF]" />
            <h3 className="text-base font-bold text-white">2. Google AI Pro 18-Month Claim Guide</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Self-claim walkthrough unlocking Gemini Advanced, Veo video credits, Flow music, NotebookLM, and 2TB cloud storage.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <Terminal className="w-7 h-7 text-[#FFC42B]" />
            <h3 className="text-base font-bold text-white">3. 1,000+ AI Student Prompt Library</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ready-to-use prompts for quick assignment research, exam revision drilling, and complex coursework simplification.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <Layers className="w-7 h-7 text-[#1E5AFF]" />
            <h3 className="text-base font-bold text-white">4. Student Revision & Project Toolkit</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Study trackers, assignment timelines, and templates so you are never caught unprepared before exam week.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3 md:col-span-2 lg:col-span-2">
            <Video className="w-7 h-7 text-[#FFC42B]" />
            <h3 className="text-base font-bold text-white">5. Practical AI Study & Research Masterclass</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Video breakdown showing how to feed course PDFs into AI, extract key exam points, and synthesize revision sheets fast.
            </p>
          </div>
        </div>
      </section>

      {/* VALUE STACK & PRICING */}
      <section className="w-full max-w-3xl px-4 py-12">
        <div className="rounded-2xl border-2 border-blue-500/50 bg-gradient-to-b from-[#101F42] to-[#0B1528] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[#FFC42B] uppercase tracking-widest">
              Limited Student Offer
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">The Complete Value Stack</h3>
          </div>

          <div className="divide-y divide-white/10 text-xs sm:text-sm text-slate-300">
            <div className="py-2.5 flex justify-between">
              <span>The 100/100 AI Playbook Core Guide</span>
              <span className="line-through text-slate-500">₦5,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Google AI Pro 18-Month Claim Walkthrough</span>
              <span className="line-through text-slate-500">₦10,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>1,000+ Academic AI Prompts</span>
              <span className="line-through text-slate-500">₦5,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Study, Revision & Project Templates</span>
              <span className="line-through text-slate-500">₦5,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>AI Research & Study Video Masterclass</span>
              <span className="line-through text-slate-500">₦5,000</span>
            </div>
            <div className="pt-4 flex justify-between items-baseline font-bold text-white">
              <span className="text-base">Total Value</span>
              <span className="text-slate-400 line-through text-base">₦30,000</span>
            </div>
          </div>

          <div className="bg-[#070E1F]/80 p-5 rounded-xl border border-blue-500/20 text-center space-y-1">
            <div className="text-xs text-slate-400">One-Time Student Price</div>
            <div className="text-4xl font-extrabold text-[#FFC42B]">₦5,000</div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-4 text-base font-bold rounded-xl bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-lg shadow-blue-600/30 text-center flex items-center justify-center space-x-2"
          >
            <span>{loading ? "Processing..." : "Get Instant Access Now — ₦5,000"}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* 21-DAY GUARANTEE */}
      <section className="w-full max-w-3xl px-4 pb-16">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <ShieldCheck className="w-12 h-12 text-emerald-400 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm sm:text-base">21-Day Money Back Guarantee</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Test the workflows on your courses for 21 days. If they don't significantly improve your study efficiency, contact us for a full refund.
            </p>
          </div>
        </div>
      </section>

      {/* CONTACT & SUPPORT */}
      <section className="w-full bg-[#0B1528] border-t border-blue-900/40 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h3 className="text-base font-bold text-white">Have Inquiries Before Joining?</h3>
          <div className="flex flex-wrap justify-center items-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#FFC42B]" />
              <span>08138082009</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#FFC42B]" />
              <span>shineybrainacademy@gmail.com</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full border-t border-white/5 bg-[#070E1F] py-8 px-4 pb-24 text-center text-xs text-slate-500 space-y-2">
        <div>© 2026 Shiney Brain Academy. All rights reserved.</div>
        <div className="flex justify-center space-x-4 text-[11px] text-slate-400">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </div>
      </footer>

      {/* PERSISTENT FLOATING BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-[#0B1528]/95 border-t border-blue-500/30 p-3.5 backdrop-blur-md z-50 flex items-center justify-between px-4 sm:px-8 max-w-6xl mx-auto inset-x-0">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white">100/100 AI Playbook Bundle</span>
          <span className="text-sm font-black text-[#FFC42B]">₦5,000</span>
        </div>
        <button
          onClick={handlePayment}
          className="px-6 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-md shadow-blue-500/20"
        >
          Buy Now
        </button>
      </div>
    </main>
  );
}
