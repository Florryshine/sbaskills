"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  BookOpen,
  Cloud,
  Terminal,
  Layers,
  ShieldCheck,
  ArrowRight,
  Phone,
  Mail,
  X,
  Loader2,
  DollarSign,
  Gift,
  Clock,
  ChevronDown,
  UserCheck,
  GraduationCap,
  Zap,
  Flame,
  TrendingUp,
} from "lucide-react";

export default function AIPlaybookLandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Urgency countdown timer
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 27, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenCheckout = () => {
    setIsModalOpen(true);
    setError("");
  };

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/landing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          productSlug: "ai-playbook",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.authorization_url) {
        throw new Error(data.error || "Failed to initialize Paystack.");
      }

      window.location.href = data.authorization_url;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How will I receive the playbook and bonuses after payment?",
      a: "Immediately after your Paystack payment is confirmed, you'll be redirected to the confirmation hub and our private Telegram group where the complete 100/100 AI Playbook, prompt libraries, bonus tools, and templates are instantly ready for download.",
    },
    {
      q: "Is this a monthly subscription or one-time payment?",
      a: "This is a strictly one-time payment of ₦5,000. You get lifetime access to all 14 chapters, prompts, and future bonus updates without any recurring monthly fees.",
    },
    {
      q: "Will this work for my course (Medicine, Law, Engineering, Social Sciences)?",
      a: "Yes! The Active Recall, Mock Exam generation, and research frameworks work seamlessly across all academic departments. Whether you study STEM, Arts, Management, or Social Sciences, the AI prompts adapt directly to your course syllabus.",
    },
    {
      q: "Do I need a laptop to use this system?",
      a: "No. Everything in the playbook—from prompt workflows to study templates and AI tools—works directly on your smartphone (Android or iPhone) as well as on a computer.",
    },
  ];

  return (
    <main
      className="relative flex flex-col items-center overflow-x-hidden min-h-screen pb-36"
      style={{ backgroundColor: "#08236B", color: "#FFFFFF" }}
    >
      {/* 1. TOP FLASH BANNER */}
      <div
        className="w-full py-2.5 px-4 text-center text-xs sm:text-sm font-black flex items-center justify-center space-x-2 shadow-md"
        style={{ backgroundColor: "#FFD000", color: "#000000" }}
      >
        <Clock className="w-4 h-4 text-black shrink-0" />
        <span>
          ⚡ LIMITED LAUNCH OFFER: ₦5,000 CLOSING IN {String(timeLeft.hours).padStart(2, "0")}:
          {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")} (ONLY 17 SLOTS LEFT)
        </span>
      </div>

      {/* 2. TOP HEADER BAR */}
      <header
        className="w-full border-b sticky top-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(11, 47, 138, 0.95)",
          borderColor: "rgba(255, 255, 255, 0.15)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
              SHINEY BRAIN <span style={{ color: "#FFD000" }}>ACADEMY</span>
            </span>
          </div>
          <button
            onClick={handleOpenCheckout}
            style={{ backgroundColor: "#FFD000", color: "#000000" }}
            className="px-5 py-2.5 text-xs sm:text-sm font-black rounded-xl shadow-lg hover:opacity-90 transition-all cursor-pointer"
          >
            Claim Offer — ₦5,000
          </button>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="w-full max-w-6xl px-4 pt-10 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 flex flex-col space-y-6 text-left">
          
          <div
            className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border-2 text-xs font-black uppercase tracking-wider w-fit"
            style={{
              borderColor: "#FFD000",
              backgroundColor: "rgba(255, 208, 0, 0.15)",
              color: "#FFD000",
            }}
          >
            <Zap className="w-4 h-4 shrink-0" style={{ color: "#FFD000" }} />
            <span>FOR ALL UNIVERSITY STUDENTS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
            100/100 AI PLAYBOOK FOR <br className="hidden sm:inline" />
            <span style={{ color: "#FFD000" }}>UNIVERSITY STUDENTS</span>
          </h1>

          <p className="text-base sm:text-xl font-bold text-blue-100 leading-snug">
            Pass Exams, Save Time, Build Valuable Skills & Graduate Ahead of Your Peers Using AI.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-bold text-white">
            <div
              className="flex items-center gap-2.5 p-3 rounded-xl border"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.2)" }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#FFD000" }} />
              <span>Read Once & Remember for Exams</span>
            </div>
            <div
              className="flex items-center gap-2.5 p-3 rounded-xl border"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.2)" }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#FFD000" }} />
              <span>Score Higher with AI Mock Exams</span>
            </div>
            <div
              className="flex items-center gap-2.5 p-3 rounded-xl border"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.2)" }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#FFD000" }} />
              <span>Finish 3-Day Assignments in Hours</span>
            </div>
            <div
              className="flex items-center gap-2.5 p-3 rounded-xl border"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.2)" }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#FFD000" }} />
              <span>Make ₦50k-₦200k/mo While in School</span>
            </div>
          </div>

          {/* MAIN HERO CTA BUTTON */}
          <div className="pt-2">
            <button
              onClick={handleOpenCheckout}
              style={{ backgroundColor: "#FFD000", color: "#000000" }}
              className="w-full sm:w-auto px-10 py-4 text-base sm:text-lg font-black rounded-2xl shadow-xl flex items-center justify-center space-x-3 hover:opacity-90 transition-all cursor-pointer"
            >
              <span>Get the Playbook + Bundle for ₦5,000</span>
              <ArrowRight className="w-5 h-5 text-black shrink-0" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-blue-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" style={{ color: "#FFD000" }} /> 18 Months Premium AI Method Included
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" style={{ color: "#FFD000" }} /> 21-Day Money-Back Guarantee
            </span>
          </div>
        </div>

        {/* Hero Section Right: Playbook Image */}
        <div className="lg:col-span-5 flex justify-center">
          <div
            className="relative w-full max-w-xs sm:max-w-sm rounded-3xl p-3 border-2 shadow-2xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderColor: "#FFD000",
            }}
          >
            <div className="overflow-hidden rounded-2xl">
              <img
                src="https://cdn.phototourl.com/free/2026-08-17-b9bf12f2-e477-4495-bd83-0d5dfd74e19e.png"
                alt="100/100 AI Playbook for University Students"
                className="w-full h-auto object-cover rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE 4 ACUTE UNIVERSITY PAIN POINTS (DEEP EMOTIONAL HOOK) */}
      <section
        className="w-full border-y py-16 px-4"
        style={{
          backgroundColor: "#05184B",
          borderColor: "rgba(255, 255, 255, 0.15)",
        }}
      >
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span
              className="text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border"
              style={{
                color: "#FFD000",
                borderColor: "#FFD000",
                backgroundColor: "rgba(255, 208, 0, 0.1)",
              }}
            >
              THE BRUTAL REALITY OF UNIVERSITY LIFE
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white pt-2">
              Working Harder Isn't Working. <br className="hidden sm:inline" />
              <span style={{ color: "#FFD000" }}>The problem isn't your brain — it's your method.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="p-6 rounded-2xl border-2 space-y-3"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(239, 68, 68, 0.4)" }}
            >
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Flame className="w-5 h-5 text-red-400" />
                <span>1. The 100-Page Passive Reading Trap</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                You spend 6 hours in the library reading voluminous PDFs and highlighting every line. By the next morning, 90% of it is completely gone from your memory.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border-2 space-y-3"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(239, 68, 68, 0.4)" }}
            >
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Flame className="w-5 h-5 text-red-400" />
                <span>2. Exam Hall Panic & Blind Guesswork</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                Walking into the hall with racing heart and sweaty palms because you never practiced real exam-standard questions under timed conditions.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border-2 space-y-3"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(239, 68, 68, 0.4)" }}
            >
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Flame className="w-5 h-5 text-red-400" />
                <span>3. 11:00 PM Assignment & Seminar Panic</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                Staring at a blank screen for days, or worse, raw copy-pasting from default AI and risking zero marks, suspension, or expulsion for academic misconduct.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border-2 space-y-3"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(239, 68, 68, 0.4)" }}
            >
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Flame className="w-5 h-5 text-red-400" />
                <span>4. The "Broke Graduate" Trap</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                Spending 4 to 5 years collecting a paper degree, while possessing zero high-income digital skills, no portfolio, and no income stream to survive post-graduation.
              </p>
            </div>
          </div>

          <div
            className="p-6 rounded-2xl border text-center space-y-2"
            style={{
              backgroundColor: "rgba(255, 208, 0, 0.1)",
              borderColor: "#FFD000",
            }}
          >
            <h3 className="text-lg sm:text-xl font-black text-white">
              The 100/100 AI Playbook was written to destroy these 4 problems forever.
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 font-medium">
              It turns your smartphone into a 24/7 personal tutor, exam simulator, research assistant, and cash-generating machine.
            </p>
          </div>
        </div>
      </section>

      {/* 5. WHAT YOU GET (CORE BOOK + 5 ACCELERATORS) */}
      <section className="w-full max-w-6xl px-4 py-20 space-y-12">
        <div className="text-center space-y-2">
          <span
            className="text-xs font-extrabold uppercase tracking-widest px-3.5 py-1.5 rounded-full border"
            style={{
              color: "#FFD000",
              borderColor: "#FFD000",
              backgroundColor: "rgba(255, 208, 0, 0.1)",
            }}
          >
            THE COMPLETE ACADEMIC & FINANCIAL ENGINE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white pt-2">
            Everything You Get Inside the 100/100 Bundle
          </h2>
        </div>

        {/* Visual Artwork Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          <div
            className="rounded-2xl overflow-hidden border-2 p-2.5 shadow-2xl flex flex-col justify-center"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.2)" }}
          >
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-3f5342b7-66d5-4330-b35e-58f0a039de0f.png"
              alt="Complete 100/100 AI Playbook Bundle Art"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>

          <div
            className="rounded-2xl overflow-hidden border-2 p-2.5 shadow-2xl flex flex-col justify-center"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.2)" }}
          >
            <img
              src="https://img.sanishtech.com/u/c526a5e31b5b303e0146072ad6bd2a24.png"
              alt="AI 100/100 Playbook Student Resources Bundle"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>

          <div
            className="rounded-2xl overflow-hidden border-2 p-2.5 shadow-2xl flex flex-col justify-center md:col-span-2 lg:col-span-1"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.2)" }}
          >
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-04e7c22b-e0ca-4f24-8b11-1c2c7b015390.png"
              alt="Premium AI Tools Access Breakdown"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>
        </div>

        {/* Detailed 6 Deliverables Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          {/* 1. Core Playbook */}
          <div
            className="rounded-2xl border-2 p-6 space-y-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "#FFD000" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFD000", color: "#000000" }}>
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">1. The 100/100 AI Student Playbook (Core 175-Page Guide)</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">The complete 14-chapter system showing you how to:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Master the <strong>6-Step Active Recall System</strong> (Preview $\rightarrow$ Read $\rightarrow$ Question $\rightarrow$ Recall $\rightarrow$ Review $\rightarrow$ Teach)</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Generate <strong>AI Timed Mock Exams</strong> (40 objectives + 5 theory questions) directly from your course outline</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Execute the <strong>8-Step Ethical Assignment Workflow</strong> without plagiarism</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Structure Seminar Papers & Final-Year Projects in weeks using Mendeley & APA 7th citations</li>
            </ul>
          </div>

          {/* 2. Free Premium AI Access */}
          <div
            className="rounded-2xl border-2 p-6 space-y-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFD000", color: "#000000" }}>
                <Cloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">2. 18 Months Free Premium AI Access Method</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Step-by-step walkthrough to legitimately claim 18 months of premium AI tools:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Advanced AI reasoning models for complex coursework</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> 2TB high-speed cloud storage tier for all project files</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Premium AI research notebook tools for instant literature reviews</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Video & music generation credits</li>
            </ul>
            <div className="text-xs font-black" style={{ color: "#FFD000" }}>Value: Priceless (Included Free with Bundle)</div>
          </div>

          {/* 3. Prompts Library */}
          <div
            className="rounded-2xl border-2 p-6 space-y-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFD000", color: "#000000" }}>
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">3. 1,000+ Academic AI Prompts Library</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Never struggle with what to ask AI again:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Assignment research prompts & essay structure helpers</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Exam revision drills & mock past-question tests</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> 24-Hour emergency exam revision frameworks</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Memory mnemonics and analogy generators</li>
            </ul>
            <div className="text-[11px] text-blue-200">Copy, paste, and get instant results.</div>
          </div>

          {/* 4. Student Study & Project Toolkit */}
          <div
            className="rounded-2xl border-2 p-6 space-y-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFD000", color: "#000000" }}>
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">4. Student Study & Project Toolkit</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Keep your entire semester running with military precision:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Semester dashboard & assignment priority planners</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Spaced repetition revision schedule builders</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Progress monitoring sheets & exam countdown systems</li>
            </ul>
          </div>

          {/* 5. Student Money-Making Playbook */}
          <div
            className="rounded-2xl border-2 p-6 space-y-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "#FFD000" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFD000", color: "#000000" }}>
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">5. Student Money-Making Playbook</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Turn your AI mastery into steady campus cash:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> <strong>Ethical Campus Services:</strong> AI tutoring, editing, and study guide packs (make ₦20k-₦50k/wk)</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> <strong>Freelancing:</strong> Writing, design, and data analysis client acquisition templates</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> <strong>Digital Products:</strong> How to package and sell revision materials online</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> <strong>Post-Graduation Career:</strong> ATS-friendly CV & LinkedIn optimization prompts</li>
            </ul>
          </div>

          {/* 6. Bonus Vault */}
          <div
            className="rounded-2xl border-2 p-6 space-y-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFD000", color: "#000000" }}>
                <Gift className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">6. Bonus Vault & 30-Day Success Plan</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Day-by-day action roadmap for total academic transformation:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> The 30-Day AI Success Plan (Week 1: Toolkit $\rightarrow$ Week 4: Scale & Monetize)</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Student discounts & free developer tools access list</li>
              <li className="flex items-center gap-2"><span style={{ color: "#FFD000", fontWeight: "bold" }}>✓</span> Private Telegram student community access</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. SOCIAL PROOF */}
      <section
        className="w-full border-y py-16 px-4"
        style={{
          backgroundColor: "#05184B",
          borderColor: "rgba(255, 255, 255, 0.15)",
        }}
      >
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-black"
              style={{
                color: "#FFD000",
                borderColor: "#FFD000",
                backgroundColor: "rgba(255, 208, 0, 0.1)",
              }}
            >
              <UserCheck className="w-4 h-4" /> 83 Students Joined This Launch
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white pt-2">
              Real Feedback from University Students
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="p-6 rounded-2xl border-2 space-y-3 shadow-lg"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.15)" }}
            >
              <p className="text-xs text-slate-100 italic leading-relaxed font-medium">
                "I used to stay up till 2 AM reading GST and faculty notes only to forget during tests. The active recall prompts cut my reading time down to 1 hour daily and my continuous assessment scores spiked."
              </p>
              <div className="text-xs font-extrabold" style={{ color: "#FFD000" }}>— Chinedu E., UNILAG</div>
            </div>
            <div
              className="p-6 rounded-2xl border-2 space-y-3 shadow-lg"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.15)" }}
            >
              <p className="text-xs text-slate-100 italic leading-relaxed font-medium">
                "The research notebook method alone is worth 10x the price. Wrote a 12-page seminar paper with cited sources in one afternoon without breaking a sweat."
              </p>
              <div className="text-xs font-extrabold" style={{ color: "#FFD000" }}>— Amina Y., ABU Zaria</div>
            </div>
            <div
              className="p-6 rounded-2xl border-2 space-y-3 shadow-lg"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.15)" }}
            >
              <p className="text-xs text-slate-100 italic leading-relaxed font-medium">
                "The 18-month premium AI tools claim worked smoothly. Getting the 2TB cloud storage and prompt toolkit for just ₦5k is an absolute no-brainer."
              </p>
              <div className="text-xs font-extrabold" style={{ color: "#FFD000" }}>— Tobi O., FUTA</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. MEET THE CREATOR */}
      <section className="w-full max-w-4xl px-4 py-16">
        <div
          className="rounded-3xl border-2 p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 text-left shadow-2xl"
          style={{
            borderColor: "#FFD000",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 shrink-0 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: "#FFD000" }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#08236B" }}
            >
              <GraduationCap className="w-12 h-12" style={{ color: "#FFD000" }} />
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: "#FFD000" }}>Meet The Author</span>
            <h3 className="text-xl sm:text-2xl font-black text-white">Igberhi Florry (Mentor Florryshine)</h3>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-medium">
              Founder of Shiney Brain Academy. I lived through the exact university struggle: voluminous textbooks, endless assignments, late nights, and zero spare cash. I built this AI study and monetization framework to fix that struggle once and for all—and now students use it daily to excel.
            </p>
          </div>
        </div>
      </section>

      {/* 8. VALUE STACK & PRICING */}
      <section className="w-full max-w-3xl px-4 py-10">
        <div
          className="rounded-3xl border-2 p-6 sm:p-9 shadow-2xl space-y-6"
          style={{
            borderColor: "#FFD000",
            backgroundColor: "#05184B",
          }}
        >
          <div className="text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#FFD000" }}>
              💰 WHAT IS THIS SYSTEM WORTH?
            </span>
            <h3 className="text-2xl sm:text-4xl font-black text-white">The Complete Value Stack</h3>
          </div>

          <div
            className="divide-y text-xs sm:text-sm text-white font-medium"
            style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            <div className="py-3 flex justify-between">
              <span>100/100 AI Playbook for University Students</span>
              <span className="text-blue-200">₦50,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>18 Months Premium AI Access Method</span>
              <span style={{ color: "#FFD000", fontWeight: "bold" }}>Included FREE</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>1,000+ Academic Student AI Prompts</span>
              <span className="text-blue-200">₦30,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Student Study & Project Toolkit</span>
              <span className="text-blue-200">₦25,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Student Money-Making Playbook</span>
              <span className="text-blue-200">₦40,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Bonus Vault & 30-Day Plan</span>
              <span className="text-blue-200">₦50,000</span>
            </div>
            <div className="pt-4 flex justify-between items-baseline font-black text-white text-base sm:text-lg">
              <span>TOTAL REAL VALUE</span>
              <span className="text-xl sm:text-2xl" style={{ color: "#FFD000" }}>₦195,000+</span>
            </div>
          </div>

          {/* Pricing Box */}
          <div
            className="p-6 rounded-2xl border-2 text-center space-y-2"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderColor: "#FFD000",
            }}
          >
            <div className="text-xs uppercase tracking-wider font-black" style={{ color: "#FFD000" }}>
              ⚡ Limited Launch Offer (First 100 Students Only)
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="line-through text-white/50 text-xl font-bold">₦10,000</span>
              <span className="text-4xl sm:text-5xl font-black" style={{ color: "#FFD000" }}>₦5,000</span>
            </div>
            <div className="text-xs text-white font-bold">
              Discount automatically applied for launch access
            </div>
          </div>

          <button
            onClick={handleOpenCheckout}
            style={{ backgroundColor: "#FFD000", color: "#000000" }}
            className="w-full py-4 text-base sm:text-lg font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 hover:opacity-90 transition-all cursor-pointer"
          >
            <span>Get the Playbook + Bundle for ₦5,000</span>
            <ArrowRight className="w-6 h-6 text-black shrink-0" />
          </button>
        </div>
      </section>

      {/* 9. 21-DAY GUARANTEE */}
      <section className="w-full max-w-3xl px-4 pb-12">
        <div
          className="rounded-2xl border-2 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-lg"
          style={{
            borderColor: "#FFD000",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <ShieldCheck className="w-14 h-14 shrink-0" style={{ color: "#FFD000" }} />
          <div className="space-y-1">
            <h4 className="font-extrabold text-white text-base">🛡️ 21-DAY MONEY-BACK GUARANTEE</h4>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-medium">
              Use the playbook and prompt systems for 21 days. If you don't see tangible improvement in your study speed and exam preparedness, message our direct WhatsApp or email support for a full, prompt refund.
            </p>
          </div>
        </div>
      </section>

      {/* 10. FAQ SECTION */}
      <section className="w-full max-w-3xl px-4 pb-16 space-y-4">
        <div className="text-center space-y-1 mb-6">
          <span
            className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ color: "#FFD000", backgroundColor: "rgba(255, 208, 0, 0.15)" }}
          >
            Got Questions?
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white pt-2">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.15)" }}
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 sm:p-5 text-left flex justify-between items-center text-sm font-bold text-white hover:text-yellow-300 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} style={{ color: "#FFD000" }} />
              </button>
              {openFaq === idx && (
                <div
                  className="p-5 pt-0 text-xs sm:text-sm text-blue-100 leading-relaxed border-t font-medium"
                  style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 11. CONTACT & SUPPORT */}
      <section
        className="w-full border-t py-10 px-4"
        style={{
          backgroundColor: "#05184B",
          borderColor: "rgba(255, 255, 255, 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h3 className="text-base font-extrabold text-white">Need Direct Help With Your Order?</h3>
          <div className="flex flex-wrap justify-center items-center gap-6 text-xs sm:text-sm font-bold text-white">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" style={{ color: "#FFD000" }} />
              <span>08138082009</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" style={{ color: "#FFD000" }} />
              <span>shineybrainacademy@gmail.com</span>
            </div>
          </div>
        </div>
      </section>

      {/* 12. FOOTER */}
      <footer
        className="w-full border-t py-8 px-4 text-center text-xs space-y-2"
        style={{
          backgroundColor: "#041238",
          borderColor: "rgba(255, 255, 255, 0.1)",
          color: "#94A3B8",
        }}
      >
        <div>© 2026 Shiney Brain Academy. All rights reserved.</div>
        <div className="flex justify-center space-x-4 text-[11px] text-blue-300">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </div>
      </footer>

      {/* 13. PERSISTENT FLOATING BOTTOM BAR */}
      <div
        className="fixed bottom-0 left-0 right-0 w-full p-3.5 z-40 border-t-2 shadow-2xl"
        style={{
          backgroundColor: "#08236B",
          borderColor: "#FFD000",
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between px-2 sm:px-4">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-white leading-tight">100/100 AI Playbook for University Students</span>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs line-through text-white/60 font-semibold">₦10,000</span>
              <span className="text-base sm:text-lg font-black" style={{ color: "#FFD000" }}>₦5,000</span>
            </div>
          </div>
          <button
            onClick={handleOpenCheckout}
            style={{ backgroundColor: "#FFD000", color: "#000000" }}
            className="px-5 py-2.5 text-xs sm:text-sm font-black rounded-xl shadow-lg hover:opacity-90 transition-all cursor-pointer shrink-0"
          >
            Claim ₦5,000 Offer
          </button>
        </div>
      </div>

      {/* 14. SECURE CHECKOUT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="relative w-full max-w-md border-2 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5"
            style={{ backgroundColor: "#08236B", borderColor: "#FFD000", color: "#FFFFFF" }}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-2xl font-black text-white">Instant Student Access</h3>
              <p className="text-xs text-blue-200 font-medium">
                Enter your details to proceed to Paystack
              </p>
            </div>

            {error && (
              <div
                className="p-3 text-xs font-bold rounded-xl border border-red-500 text-red-200"
                style={{ backgroundColor: "rgba(127, 29, 29, 0.6)" }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitCheckout} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-white block">Full Name (Optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Florryshine"
                  style={{
                    backgroundColor: "#05184B",
                    color: "#FFFFFF",
                    borderColor: "rgba(255, 255, 255, 0.25)",
                  }}
                  className="w-full px-4 py-3.5 rounded-xl border text-sm focus:outline-none placeholder:text-blue-300/50 font-medium"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-white block">Email Address (Required)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. student@gmail.com"
                  style={{
                    backgroundColor: "#05184B",
                    color: "#FFFFFF",
                    borderColor: "rgba(255, 255, 255, 0.25)",
                  }}
                  className="w-full px-4 py-3.5 rounded-xl border text-sm focus:outline-none placeholder:text-blue-300/50 font-medium"
                />
              </div>

              <div
                className="p-4 rounded-xl border-2 flex justify-between items-center text-xs"
                style={{
                  backgroundColor: "#05184B",
                  borderColor: "rgba(255, 208, 0, 0.4)",
                }}
              >
                <span className="text-blue-200 font-bold">Total Payable:</span>
                <span className="font-black text-xl" style={{ color: "#FFD000" }}>₦5,000</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: "#FFD000",
                  color: "#000000",
                }}
                className="w-full py-4 px-4 rounded-xl font-black text-base transition-all shadow-xl hover:opacity-90 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                    <span>Connecting to Paystack...</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₦5,000 via Paystack</span>
                    <ArrowRight className="w-5 h-5 text-black" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
