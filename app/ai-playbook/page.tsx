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
  Sparkles,
  X,
  Loader2,
  DollarSign,
  Gift,
  Clock,
  ChevronDown,
  UserCheck,
  GraduationCap,
  Zap,
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
          couponCode: "STUDENT100",
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
      q: "How will I receive the bundle after payment?",
      a: "Immediately after your Paystack payment is confirmed, you'll be redirected to the confirmation hub and our private Telegram group where all links, guides, tools, and downloadable templates are instantly ready.",
    },
    {
      q: "Is this a monthly subscription or one-time payment?",
      a: "This is a strictly one-time payment of ₦5,000. You get lifetime access to all modules and future bonus updates without any recurring monthly fees.",
    },
    {
      q: "Do I need a laptop to use this system?",
      a: "No. Everything in the playbook—from prompt workflows to study templates and AI claims—works directly on your smartphone (Android or iPhone) as well as on a computer.",
    },
    {
      q: "What if this doesn't work for my courses?",
      a: "The prompt and active-recall systems work for all academic disciplines (Sciences, Engineering, Arts, Law, Management, Medicine). You're backed by our 21-day money-back guarantee if it doesn't transform your study results.",
    },
  ];

  return (
    <main className="relative flex flex-col items-center overflow-x-hidden bg-transparent text-white selection:bg-[#FFD000] selection:text-black min-h-screen pb-36">
      
      {/* Yellow Highlight Ribbon */}
      <div className="w-full bg-[#FFD000] text-black py-2 px-4 text-center text-xs sm:text-sm font-black flex items-center justify-center space-x-2 shadow-md">
        <Clock className="w-4 h-4 text-black animate-pulse" />
        <span>
          ⚡ LIMITED FLASH OFFER: ₦5,000 CLOSING IN {String(timeLeft.hours).padStart(2, "0")}:
          {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")} (ONLY 17 SPOTS LEFT)
        </span>
      </div>

      {/* Top Header Bar */}
      <header className="w-full border-b border-white/10 bg-[#0B2F8A]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
              SHINEY BRAIN <span className="text-[#FFD000]">ACADEMY</span>
            </span>
          </div>
          <button
            onClick={handleOpenCheckout}
            className="px-5 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#FFD000] hover:bg-[#F5C400] text-black transition-all shadow-lg shadow-yellow-500/20 transform active:scale-95"
          >
            Claim Offer — ₦5,000
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="w-full max-w-6xl px-4 pt-12 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 flex flex-col space-y-6 text-left">
          
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border-2 border-[#FFD000] bg-[#FFD000]/15 text-xs font-black uppercase tracking-wider text-[#FFD000] w-fit shadow-sm">
            <Zap className="w-4 h-4 text-[#FFD000]" />
            <span>ATTENTION ALL STUDENTS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
            THE 100/100 AI{" "}
            <span className="text-[#FFD000] drop-shadow-[0_2px_12px_rgba(255,208,0,0.4)]">
              STUDENT BUNDLE
            </span>
          </h1>

          <p className="text-base sm:text-lg text-blue-100 font-semibold leading-relaxed">
            The proven study and earning system designed to give you an unfair advantage:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-bold text-white">
            <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/15">
              <CheckCircle2 className="w-5 h-5 text-[#FFD000] shrink-0" />
              <span>Cut study time in half</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/15">
              <CheckCircle2 className="w-5 h-5 text-[#FFD000] shrink-0" />
              <span>Score higher on tests & exams</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/15">
              <CheckCircle2 className="w-5 h-5 text-[#FFD000] shrink-0" />
              <span>Finish assignments in minutes</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/15">
              <CheckCircle2 className="w-5 h-5 text-[#FFD000] shrink-0" />
              <span>Start making money as a student</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={handleOpenCheckout}
              className="px-8 py-4 text-base sm:text-lg font-black rounded-xl bg-[#FFD000] hover:bg-[#F5C400] text-black transition-all shadow-xl shadow-yellow-500/30 text-center flex items-center justify-center space-x-2 transform active:scale-95 cursor-pointer"
            >
              <span>Get Everything for ₦5,000</span>
              <ArrowRight className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-blue-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#FFD000]" /> 18 Months Premium AI Method Included
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#FFD000]" /> 21-Day Money-Back Guarantee
            </span>
          </div>
        </div>

        {/* Hero Section Right: Playbook Image */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-xs sm:max-w-sm rounded-3xl p-3 bg-gradient-to-b from-[#FFD000]/30 via-white/10 to-transparent border-2 border-[#FFD000]/50 shadow-2xl shadow-blue-950/80">
            <div className="overflow-hidden rounded-2xl bg-[#08236B]">
              <img
                src="https://cdn.phototourl.com/free/2026-08-17-b9bf12f2-e477-4495-bd83-0d5dfd74e19e.png"
                alt="100/100 AI Playbook for Students"
                className="w-full h-auto object-cover rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IS THIS POSSIBLE / PAIN SECTION */}
      <section className="w-full bg-[#05184B]/80 border-y border-white/10 py-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <div className="space-y-2">
            <span className="text-xs font-extrabold text-[#FFD000] uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/15">
              HOW IS THIS POSSIBLE?
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white pt-2">
              The problem isn't your intelligence. <br className="hidden sm:inline" />
              <span className="text-[#FFD000]">The problem is your method.</span>
            </h2>
          </div>

          <div className="p-7 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 text-left space-y-4 shadow-xl">
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed font-medium">
              You're probably spending hours reading, only to forget everything the next morning. You're struggling with assignments, stressed about exams, and wondering how others seem to have it all figured out.
            </p>
            <p className="text-base sm:text-lg font-black text-[#FFD000]">
              This bundle completely fixes that.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET (SHOWCASING ALL ARTWORKS) */}
      <section className="w-full max-w-6xl px-4 py-20 space-y-12">
        <div className="text-center space-y-2">
          <span className="text-xs font-extrabold text-[#FFD000] uppercase tracking-widest bg-white/10 px-3.5 py-1.5 rounded-full border border-white/15">
            THIS BUNDLE FIXES THAT
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white pt-2">
            Here's Exactly What You're Getting Inside
          </h2>
        </div>

        {/* Visual Artwork Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          <div className="rounded-2xl overflow-hidden border-2 border-white/20 bg-white/5 p-2.5 shadow-2xl flex flex-col justify-center hover:border-[#FFD000] transition-all">
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-3f5342b7-66d5-4330-b35e-58f0a039de0f.png"
              alt="Complete 100/100 AI Playbook Bundle Art"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>

          <div className="rounded-2xl overflow-hidden border-2 border-white/20 bg-white/5 p-2.5 shadow-2xl flex flex-col justify-center hover:border-[#FFD000] transition-all">
            <img
              src="https://img.sanishtech.com/u/c526a5e31b5b303e0146072ad6bd2a24.png"
              alt="AI 100/100 Playbook Student Resources Bundle"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>

          <div className="rounded-2xl overflow-hidden border-2 border-white/20 bg-white/5 p-2.5 shadow-2xl flex flex-col justify-center md:col-span-2 lg:col-span-1 hover:border-[#FFD000] transition-all">
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-04e7c22b-e0ca-4f24-8b11-1c2c7b015390.png"
              alt="Premium AI Tools Access Breakdown"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>
        </div>

        {/* Detailed 6 Deliverables Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          <div className="rounded-2xl border-2 border-white/15 bg-white/10 backdrop-blur-md p-6 space-y-3 hover:border-[#FFD000]/60 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FFD000] text-black">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">1. The 100/100 AI Student Playbook</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">The complete step-by-step system showing you how to:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Read once and remember forever with active AI recall</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Break down complex lecture slides in minutes</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Create study schedules that actually stick</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Turn your phone into a 24/7 personal tutor</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Stop wasting time on useless rote memorization</li>
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-white/10 backdrop-blur-md p-6 space-y-3 hover:border-[#FFD000]/60 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FFD000] text-black">
                <Cloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">2. The Free Premium AI Access Method</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Step-by-step walkthrough to legitimately claim 18 months of premium tools at zero extra cost:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Advanced AI chat & reasoning models</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> 2TB high-speed cloud storage tier</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Premium AI research notebook tools</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Video & music generation credits</li>
            </ul>
            <div className="text-xs font-black text-[#FFD000]">Value: Priceless (Included Free with Bundle)</div>
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-white/10 backdrop-blur-md p-6 space-y-3 hover:border-[#FFD000]/60 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FFD000] text-black">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">3. 1,000+ AI Prompts for Students</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Stop wasting time figuring out what to ask AI:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Assignment research prompts & essay structure helpers</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Exam revision drills & mock past-question tests</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Complex topic simplification prompts</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Study plan & revision timeline generators</li>
            </ul>
            <div className="text-[11px] text-blue-200">Just copy, paste, and get results instantly.</div>
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-white/10 backdrop-blur-md p-6 space-y-3 hover:border-[#FFD000]/60 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FFD000] text-black">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">4. Student Study & Project Toolkit</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Everything organized so you never fall behind:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Study tracker templates & assignment planners</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Revision schedule builder</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Progress monitoring sheets & exam countdowns</li>
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-white/10 backdrop-blur-md p-6 space-y-3 hover:border-[#FFD000]/60 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FFD000] text-black">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">5. Student Money-Making Playbook</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Turn your AI skills into sustainable income:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Freelancing with AI & digital content creation</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Faceless video channel setups</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> High-demand student side-hustles</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Building practical digital skills that pay for life</li>
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-white/15 bg-white/10 backdrop-blur-md p-6 space-y-3 hover:border-[#FFD000]/60 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FFD000] text-black">
                <Gift className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">6. Bonus Vault</h3>
            </div>
            <p className="text-xs text-blue-200 font-semibold">Constantly updated student resources:</p>
            <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Free AI tool credits & developer allowances</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Student discounts & premium portal access</li>
              <li className="flex items-center gap-2"><span className="text-[#FFD000] font-bold">✓</span> Direct prompt templates and updates</li>
            </ul>
          </div>

        </div>
      </section>

      {/* SOCIAL PROOF / RESULTS */}
      <section className="w-full bg-[#05184B]/80 border-y border-white/10 py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFD000]/15 border border-[#FFD000]/40 text-[#FFD000] text-xs font-black">
              <UserCheck className="w-4 h-4" /> 83 Students Joined This Launch
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white pt-2">
              Real Feedback from University Students
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border-2 border-white/15 bg-white/5 backdrop-blur-md space-y-3 shadow-lg">
              <p className="text-xs text-slate-100 italic leading-relaxed font-medium">
                "I used to stay up till 2 AM reading GST and faculty notes only to forget during tests. The active recall prompts cut my reading time down to 1 hour daily and my continuous assessment scores spiked."
              </p>
              <div className="text-xs font-extrabold text-[#FFD000]">— Chinedu E., UNILAG</div>
            </div>
            <div className="p-6 rounded-2xl border-2 border-white/15 bg-white/5 backdrop-blur-md space-y-3 shadow-lg">
              <p className="text-xs text-slate-100 italic leading-relaxed font-medium">
                "The research notebook method alone is worth 10x the price. Wrote a 12-page seminar paper with cited sources in one afternoon without breaking a sweat."
              </p>
              <div className="text-xs font-extrabold text-[#FFD000]">— Amina Y., ABU Zaria</div>
            </div>
            <div className="p-6 rounded-2xl border-2 border-white/15 bg-white/5 backdrop-blur-md space-y-3 shadow-lg">
              <p className="text-xs text-slate-100 italic leading-relaxed font-medium">
                "The 18-month premium AI tools claim worked smoothly. Getting the 2TB cloud storage and prompt toolkit for just ₦5k is an absolute no-brainer."
              </p>
              <div className="text-xs font-extrabold text-[#FFD000]">— Tobi O., FUTA</div>
            </div>
          </div>
        </div>
      </section>

      {/* MEET THE CREATOR */}
      <section className="w-full max-w-4xl px-4 py-16">
        <div className="rounded-3xl border-2 border-[#FFD000]/40 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 text-left shadow-2xl">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#FFD000] p-1 shrink-0 flex items-center justify-center shadow-lg">
            <div className="w-full h-full rounded-full bg-[#08236B] flex items-center justify-center">
              <GraduationCap className="w-12 h-12 text-[#FFD000]" />
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-black text-[#FFD000] uppercase tracking-wider">Meet The Creator</span>
            <h3 className="text-xl sm:text-2xl font-black text-white">Igberhi Florry (Mentor Florryshine)</h3>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-medium">
              Founder of Shiney Brain Academy. I lived through the exact university struggle: voluminous textbooks, endless assignments, late nights, and zero spare cash. I built this AI study and monetization framework to fix that struggle once and for all—and now students use it daily to excel.
            </p>
          </div>
        </div>
      </section>

      {/* VALUE STACK & PRICING */}
      <section className="w-full max-w-3xl px-4 py-10">
        <div className="rounded-3xl border-2 border-[#FFD000] bg-gradient-to-b from-[#0B2F8A] to-[#05184B] p-6 sm:p-9 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-black text-[#FFD000] uppercase tracking-widest">
              💰 REALISTIC VALUE BREAKDOWN
            </span>
            <h3 className="text-2xl sm:text-4xl font-black text-white">The Complete Value Stack</h3>
          </div>

          <div className="divide-y divide-white/15 text-xs sm:text-sm text-white font-medium">
            <div className="py-3 flex justify-between">
              <span>100/100 AI Student Playbook System</span>
              <span className="text-blue-200">₦50,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Premium AI Access & Claim Blueprint</span>
              <span className="text-[#FFD000] font-bold">Included FREE</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>1,000+ Student AI Prompts</span>
              <span className="text-blue-200">₦30,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Study & Project Toolkit</span>
              <span className="text-blue-200">₦25,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Student Money-Making Playbook</span>
              <span className="text-blue-200">₦40,000</span>
            </div>
            <div className="py-3 flex justify-between">
              <span>Bonus Vault Access</span>
              <span className="text-blue-200">₦50,000</span>
            </div>
            <div className="pt-4 flex justify-between items-baseline font-black text-white text-base sm:text-lg">
              <span>TOTAL REAL VALUE</span>
              <span className="text-[#FFD000] text-xl sm:text-2xl">₦195,000+</span>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border-2 border-[#FFD000]/60 text-center space-y-2">
            <div className="text-xs text-[#FFD000] uppercase tracking-wider font-black">
              ⚡ Limited Launch Price (First 100 Students Only)
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="line-through text-white/50 text-xl font-bold">₦10,000</span>
              <span className="text-4xl sm:text-5xl font-black text-[#FFD000]">₦5,000</span>
            </div>
            <div className="text-xs text-white font-bold">
              Coupon code <span className="text-[#FFD000] underline">STUDENT100</span> automatically applied at checkout
            </div>
          </div>

          <button
            onClick={handleOpenCheckout}
            className="w-full py-4 text-base sm:text-lg font-black rounded-2xl bg-[#FFD000] hover:bg-[#F5C400] text-black transition-all shadow-xl shadow-yellow-500/30 text-center flex items-center justify-center space-x-2 transform active:scale-95 cursor-pointer"
          >
            <span>Get Instant Access for ₦5,000</span>
            <ArrowRight className="w-6 h-6 text-black" />
          </button>
        </div>
      </section>

      {/* 21-DAY GUARANTEE */}
      <section className="w-full max-w-3xl px-4 pb-12">
        <div className="rounded-2xl border-2 border-[#FFD000]/50 bg-white/10 backdrop-blur-md p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-lg">
          <ShieldCheck className="w-14 h-14 text-[#FFD000] shrink-0" />
          <div className="space-y-1">
            <h4 className="font-extrabold text-white text-base">🛡️ 21-DAY MONEY-BACK GUARANTEE</h4>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-medium">
              Use the playbook and prompt systems for 21 days. If you don't see tangible improvement in your study speed and exam preparedness, message our direct WhatsApp or email support for a full, prompt refund.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="w-full max-w-3xl px-4 pb-16 space-y-4">
        <div className="text-center space-y-1 mb-6">
          <span className="text-xs font-black text-[#FFD000] uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">Got Questions?</span>
          <h3 className="text-2xl sm:text-3xl font-black text-white pt-2">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md overflow-hidden">
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 sm:p-5 text-left flex justify-between items-center text-sm font-bold text-white hover:text-[#FFD000] transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? "rotate-180 text-[#FFD000]" : "text-white/60"}`} />
              </button>
              {openFaq === idx && (
                <div className="p-5 pt-0 text-xs sm:text-sm text-blue-100 leading-relaxed border-t border-white/10 font-medium">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT & SUPPORT */}
      <section className="w-full bg-[#05184B]/90 border-t border-white/10 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h3 className="text-base font-extrabold text-white">Need Direct Help With Your Order?</h3>
          <div className="flex flex-wrap justify-center items-center gap-6 text-xs sm:text-sm font-bold text-white">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#FFD000]" />
              <span>08138082009</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#FFD000]" />
              <span>shineybrainacademy@gmail.com</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full border-t border-white/10 bg-[#041238] py-8 px-4 text-center text-xs text-blue-200 space-y-2">
        <div>© {new Date().getFullYear()} Shiney Brain Academy. All rights reserved.</div>
        <div className="flex justify-center space-x-4 text-[11px] text-blue-300">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </div>
      </footer>

      {/* PERSISTENT FLOATING BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-[#08236B]/95 border-t-2 border-[#FFD000] p-3.5 backdrop-blur-lg z-40 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-2 sm:px-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white leading-tight">100/100 AI Student Bundle</span>
            <div className="flex items-center gap-2">
              <span className="text-xs line-through text-white/50">₦10,000</span>
              <span className="text-base sm:text-lg font-black text-[#FFD000]">₦5,000</span>
            </div>
          </div>
          <button
            onClick={handleOpenCheckout}
            className="px-6 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#FFD000] hover:bg-[#F5C400] text-black transition-all shadow-md shadow-yellow-500/30 transform active:scale-95 cursor-pointer"
          >
            Claim ₦5,000 Offer
          </button>
        </div>
      </div>

      {/* SECURE CHECKOUT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className="relative w-full max-w-md border-2 border-[#FFD000] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5"
            style={{ backgroundColor: "#08236B", color: "#FFFFFF" }}
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
                  className="w-full px-4 py-3.5 rounded-xl border text-sm focus:outline-none focus:border-[#FFD000] focus:ring-1 focus:ring-[#FFD000] placeholder:text-blue-300/50 font-medium"
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
                  className="w-full px-4 py-3.5 rounded-xl border text-sm focus:outline-none focus:border-[#FFD000] focus:ring-1 focus:ring-[#FFD000] placeholder:text-blue-300/50 font-medium"
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
                <span className="font-black text-[#FFD000] text-xl">₦5,000</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: "#FFD000",
                  color: "#000000",
                }}
                className="w-full py-4 px-4 rounded-xl font-black text-base transition-all shadow-xl shadow-yellow-500/30 hover:bg-[#F5C400] flex items-center justify-center space-x-2 cursor-pointer transform active:scale-95"
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
