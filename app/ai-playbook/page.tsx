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
} from "lucide-react";

export default function AIPlaybookLandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Dynamic urgency countdown timer
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
      a: "This is a strictly one-time payment of ₦5,000. You get lifetime access to all 6 modules and future bonus updates without any monthly fees.",
    },
    {
      q: "Do I need a laptop to use this system?",
      a: "No. Everything in the playbook—from prompt workflows to study templates and AI claims—works directly on your Android or iPhone as well as on a computer.",
    },
    {
      q: "What if this doesn't work for my department/courses?",
      a: "The prompt and active-recall systems work for all academic disciplines (Sciences, Engineering, Arts, Law, Management, Medicine). You're backed by our 21-day money-back guarantee if it doesn't transform your study results.",
    },
  ];

  return (
    <main className="relative flex flex-col items-center overflow-x-hidden bg-[#070E1F] text-slate-100 selection:bg-[#FFC42B] selection:text-black min-h-screen pb-32">
      {/* Urgency Ribbon */}
      <div className="w-full bg-[#1E5AFF] text-white py-1.5 px-4 text-center text-xs font-bold flex items-center justify-center space-x-2">
        <Clock className="w-3.5 h-3.5" />
        <span>
          Flash Launch Discount Ends In: {String(timeLeft.hours).padStart(2, "0")}:
          {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")} — Only 17 Spots Remaining
        </span>
      </div>

      {/* Top Header Bar */}
      <header className="w-full border-b border-blue-900/40 bg-[#0B1528]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg sm:text-xl font-black tracking-tight text-white">
              SHINEY BRAIN <span className="text-[#FFC42B]">ACADEMY</span>
            </span>
          </div>
          <button
            onClick={handleOpenCheckout}
            className="px-4 py-2 text-xs sm:text-sm font-extrabold rounded-lg bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-md shadow-blue-500/30"
          >
            Claim Offer — ₦5,000
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="w-full max-w-6xl px-4 pt-10 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 flex flex-col space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-xs font-extrabold uppercase tracking-wider text-[#FFC42B] w-fit">
            <span>📢 ATTENTION ALL STUDENTS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.15]">
            THE 100/100 AI{" "}
            <span className="text-[#FFC42B] underline decoration-blue-500 decoration-4">
              STUDENT BUNDLE
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-medium">
            The exact system built by a university student to:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm font-semibold text-slate-200">
            <div className="flex items-center gap-2 bg-[#0B1528] p-2.5 rounded-lg border border-blue-900/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Cut study time in half</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0B1528] p-2.5 rounded-lg border border-blue-900/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Score higher on tests</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0B1528] p-2.5 rounded-lg border border-blue-900/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Finish assignments in minutes</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0B1528] p-2.5 rounded-lg border border-blue-900/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Start making money as a student</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={handleOpenCheckout}
              className="px-8 py-4 text-base font-extrabold rounded-xl bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-xl shadow-blue-600/40 text-center flex items-center justify-center space-x-2"
            >
              <span>Get Everything for ₦5,000</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Includes 18 Months Premium AI Access Method
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 21-Day Money-Back Guarantee
            </span>
          </div>
        </div>

        {/* Hero Section Right: Playbook Image */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-xs sm:max-w-sm rounded-2xl p-2 bg-gradient-to-b from-blue-500/20 to-transparent border border-blue-500/40 shadow-2xl shadow-blue-900/60">
            <div className="overflow-hidden rounded-xl bg-[#0B1528]">
              <img
                src="https://cdn.phototourl.com/free/2026-08-17-b9bf12f2-e477-4495-bd83-0d5dfd74e19e.png"
                alt="100/100 AI Playbook for Students"
                className="w-full h-auto object-cover rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IS THIS POSSIBLE / PAIN SECTION */}
      <section className="w-full bg-[#0B1528] border-y border-blue-900/40 py-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <div className="space-y-3">
            <span className="text-xs font-bold text-[#FFC42B] uppercase tracking-widest">
              HOW IS THIS POSSIBLE?
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              The problem isn't your intelligence. <br className="hidden sm:inline" />
              The problem is your method.
            </h2>
          </div>

          <div className="p-6 rounded-2xl bg-[#070E1F] border border-red-500/30 text-left space-y-4">
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              You're probably spending hours reading, only to forget everything the next morning. You're struggling with assignments, stressed about exams, and wondering how others seem to have it all figured out.
            </p>
            <p className="text-sm sm:text-base font-bold text-[#FFC42B]">
              This bundle completely fixes that.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET (6 PILLARS - AD-SAFE REWORK) */}
      <section className="w-full max-w-6xl px-4 py-16 space-y-12">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-[#FFC42B] uppercase tracking-widest">
            THIS BUNDLE FIXES THAT
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Here's Exactly What You're Getting
          </h2>
        </div>

        {/* Visual Artwork Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0B1528] p-2 shadow-xl">
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-3f5342b7-66d5-4330-b35e-58f0a039de0f.png"
              alt="Complete 100/100 AI Playbook Bundle Art"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>

          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0B1528] p-2 shadow-xl">
            <img
              src="https://cdn.phototourl.com/free/2026-08-17-04e7c22b-e0ca-4f24-8b11-1c2c7b015390.png"
              alt="Premium AI Tools Access Breakdown"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>
        </div>

        {/* Detailed 6 Deliverables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* 1 */}
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[#FFC42B]" />
              <h3 className="text-base font-bold text-white">1. The 100/100 AI Student Playbook</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">The complete step-by-step system showing you how to:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Read once and remember forever with active AI recall</li>
              <li className="flex items-center gap-2">✓ Break down complex lecture slides in minutes</li>
              <li className="flex items-center gap-2">✓ Create study schedules that actually stick</li>
              <li className="flex items-center gap-2">✓ Turn your phone into a 24/7 personal tutor</li>
              <li className="flex items-center gap-2">✓ Stop wasting time on useless rote memorization</li>
            </ul>
          </div>

          {/* 2 - Policy Safe Premium AI Access */}
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-[#1E5AFF]" />
              <h3 className="text-base font-bold text-white">2. The Free Premium AI Access Method</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">A full step-by-step walkthrough showing you how to legitimately claim 18 months of premium tools at zero extra cost:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Advanced AI chat & reasoning models</li>
              <li className="flex items-center gap-2">✓ 2TB high-speed cloud storage tier</li>
              <li className="flex items-center gap-2">✓ Premium AI research notebook tools</li>
              <li className="flex items-center gap-2">✓ Video & music generation credits</li>
            </ul>
            <div className="text-[11px] font-bold text-[#FFC42B]">Value: Priceless (Included Free with Bundle)</div>
          </div>

          {/* 3 */}
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-[#FFC42B]" />
              <h3 className="text-base font-bold text-white">3. 1,000+ AI Prompts for Students</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">Stop wasting time figuring out what to ask AI:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Assignment research prompts & essay structure helpers</li>
              <li className="flex items-center gap-2">✓ Exam revision drills & mock past-question tests</li>
              <li className="flex items-center gap-2">✓ Complex topic simplification prompts</li>
              <li className="flex items-center gap-2">✓ Study plan & revision timeline generators</li>
            </ul>
            <div className="text-[11px] text-slate-400">Just copy, paste, and get results instantly.</div>
          </div>

          {/* 4 */}
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Layers className="w-6 h-6 text-[#1E5AFF]" />
              <h3 className="text-base font-bold text-white">4. Student Study & Project Toolkit</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">Everything organized so you never fall behind:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Study tracker templates & assignment planners</li>
              <li className="flex items-center gap-2">✓ Revision schedule builder</li>
              <li className="flex items-center gap-2">✓ Progress monitoring sheets & exam countdowns</li>
            </ul>
          </div>

          {/* 5 */}
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-[#FFC42B]" />
              <h3 className="text-base font-bold text-white">5. Student Money-Making Playbook</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">Turn your AI skills into sustainable income:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Freelancing with AI & digital content creation</li>
              <li className="flex items-center gap-2">✓ Faceless video channel setups</li>
              <li className="flex items-center gap-2">✓ High-demand student side-hustles</li>
              <li className="flex items-center gap-2">✓ Building practical digital skills that pay for life</li>
            </ul>
          </div>

          {/* 6 */}
          <div className="rounded-2xl border border-blue-900/40 bg-[#0B1528] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-[#1E5AFF]" />
              <h3 className="text-base font-bold text-white">6. Bonus Vault</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">Constantly updated student resources:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Free AI tool credits & developer allowances</li>
              <li className="flex items-center gap-2">✓ Student discounts & premium portal access</li>
              <li className="flex items-center gap-2">✓ Direct prompt templates and updates</li>
            </ul>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF / REAL STUDENT RESULTS */}
      <section className="w-full bg-[#0B1528] border-y border-blue-900/40 py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5" /> 83 Students Joined This Launch
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Real Feedback from University Students
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl border border-blue-900/40 bg-[#070E1F] space-y-3">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "I used to stay up till 2 AM reading GST and faculty notes only to forget during tests. The active recall prompts cut my reading time down to 1 hour daily and my continuous assessment scores spiked."
              </p>
              <div className="text-xs font-bold text-[#FFC42B]">— Chinedu E., UNILAG</div>
            </div>
            <div className="p-5 rounded-2xl border border-blue-900/40 bg-[#070E1F] space-y-3">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "The research notebook method alone is worth 10x the price. Wrote a 12-page seminar paper with cited sources in one afternoon without breaking a sweat."
              </p>
              <div className="text-xs font-bold text-[#FFC42B]">— Amina Y., ABU Zaria</div>
            </div>
            <div className="p-5 rounded-2xl border border-blue-900/40 bg-[#070E1F] space-y-3">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "The 18-month premium AI tools claim worked smoothly. Getting the 2TB cloud storage and prompt toolkit for just ₦5k is an absolute no-brainer."
              </p>
              <div className="text-xs font-bold text-[#FFC42B]">— Tobi O., FUTA</div>
            </div>
          </div>
        </div>
      </section>

      {/* MEET THE AUTHOR SECTION */}
      <section className="w-full max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-blue-500/30 bg-[#0B1528] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 text-left">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-[#1E5AFF] to-[#FFC42B] p-1 shrink-0 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#070E1F] flex items-center justify-center text-2xl font-black text-white">
              <GraduationCap className="w-12 h-12 text-[#FFC42B]" />
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#FFC42B] uppercase tracking-wider">Meet The Creator</span>
            <h3 className="text-xl font-bold text-white">Igberhi Florry (Mentor Florryshine)</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Founder of Shiney Brain Academy. I lived through the exact university struggle: voluminous textbooks, endless assignments, late nights, and zero spare cash. I built this AI study and monetization framework to fix that struggle once and for all—and now hundreds of students use it daily to excel.
            </p>
          </div>
        </div>
      </section>

      {/* VALUE STACK & PRICING (RECALIBRATED TO SAFE ₦195K) */}
      <section className="w-full max-w-3xl px-4 py-10">
        <div className="rounded-2xl border-2 border-blue-500/50 bg-gradient-to-b from-[#101F42] to-[#0B1528] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-[#FFC42B] uppercase tracking-widest">
              💰 REALISTIC VALUE BREAKDOWN
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">The Complete Value Stack</h3>
          </div>

          <div className="divide-y divide-white/10 text-xs sm:text-sm text-slate-300">
            <div className="py-2.5 flex justify-between">
              <span>100/100 AI Student Playbook System</span>
              <span className="text-slate-400">₦50,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Premium AI Access & Claim Blueprint</span>
              <span className="text-emerald-400 font-semibold">Included FREE</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>1,000+ Student AI Prompts</span>
              <span className="text-slate-400">₦30,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Study & Project Toolkit</span>
              <span className="text-slate-400">₦25,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Student Money-Making Playbook</span>
              <span className="text-slate-400">₦40,000</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span>Bonus Vault Access</span>
              <span className="text-slate-400">₦50,000</span>
            </div>
            <div className="pt-4 flex justify-between items-baseline font-bold text-white text-base">
              <span>TOTAL REAL VALUE</span>
              <span className="text-[#FFC42B]">₦195,000+</span>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-[#070E1F] p-5 rounded-xl border border-blue-500/30 text-center space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              ⚡ Limited Launch Price (First 100 Students Only)
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="line-through text-slate-500 text-lg sm:text-xl font-bold">₦10,000</span>
              <span className="text-3xl sm:text-4xl font-black text-[#FFC42B]">₦5,000</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold">
              Coupon code STUDENT100 automatically applied at checkout
            </div>
          </div>

          <button
            onClick={handleOpenCheckout}
            className="w-full py-4 text-base font-extrabold rounded-xl bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-lg shadow-blue-600/40 text-center flex items-center justify-center space-x-2"
          >
            <span>Get Instant Access for ₦5,000</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* 21-DAY GUARANTEE */}
      <section className="w-full max-w-3xl px-4 pb-12">
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <ShieldCheck className="w-12 h-12 text-emerald-400 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-base">🛡️ 21-DAY MONEY-BACK GUARANTEE</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Use the playbook and prompt systems for 21 days. If you don't see tangible improvement in your study speed and exam preparedness, message our direct WhatsApp or email support for a full, prompt refund.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="w-full max-w-3xl px-4 pb-16 space-y-4">
        <div className="text-center space-y-1 mb-6">
          <span className="text-xs font-bold text-[#FFC42B] uppercase tracking-wider">Got Questions?</span>
          <h3 className="text-2xl font-bold text-white">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="rounded-xl border border-blue-900/40 bg-[#0B1528] overflow-hidden">
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 text-left flex justify-between items-center text-sm font-bold text-white hover:text-[#FFC42B] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? "rotate-180 text-[#FFC42B]" : "text-slate-400"}`} />
              </button>
              {openFaq === idx && (
                <div className="p-4 pt-0 text-xs text-slate-300 leading-relaxed border-t border-white/5">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT & SUPPORT */}
      <section className="w-full bg-[#0B1528] border-t border-blue-900/40 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h3 className="text-base font-bold text-white">Need Direct Help With Your Order?</h3>
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
      <footer className="w-full border-t border-white/5 bg-[#070E1F] py-8 px-4 text-center text-xs text-slate-500 space-y-2">
        <div>© {new Date().getFullYear()} Shiney Brain Academy. All rights reserved.</div>
        <div className="flex justify-center space-x-4 text-[11px] text-slate-400">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </div>
      </footer>

      {/* PERSISTENT FLOATING BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-[#0B1528]/95 border-t border-blue-500/40 p-3 backdrop-blur-lg z-50 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-2 sm:px-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white leading-tight">100/100 AI Student Bundle</span>
            <div className="flex items-center gap-2">
              <span className="text-xs line-through text-slate-500">₦10,000</span>
              <span className="text-base font-black text-[#FFC42B]">₦5,000</span>
            </div>
          </div>
          <button
            onClick={handleOpenCheckout}
            className="px-5 py-2 text-xs sm:text-sm font-extrabold rounded-lg bg-[#1E5AFF] hover:bg-blue-600 text-white transition-all shadow-md shadow-blue-500/30"
          >
            Claim ₦5,000 Offer
          </button>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0B1528] border border-blue-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-xl font-black text-white">Instant Student Access</h3>
              <p className="text-xs text-slate-300">
                Enter your details to proceed to Paystack
              </p>
            </div>

            {error && (
              <div className="p-3 text-xs bg-red-950/50 border border-red-500/40 rounded-lg text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitCheckout} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Full Name (Optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Florryshine"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#070E1F] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Email Address (Required)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. student@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#070E1F] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#070E1F] border border-white/5 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Price:</span>
                <span className="font-extrabold text-[#FFC42B] text-lg">₦5,000</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-blue-600 text-white font-black text-sm transition-all shadow-lg shadow-blue-600/40 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Paystack...</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₦5,000 via Paystack</span>
                    <ArrowRight className="w-4 h-4" />
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
