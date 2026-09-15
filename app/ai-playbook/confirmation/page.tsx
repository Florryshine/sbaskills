"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Phone, Mail } from "lucide-react";

export default function ConfirmationPage() {
  const TELEGRAM_URL = "https://t.me/+rtQ4PBtFxCtkYWNk";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = TELEGRAM_URL;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#070E1F] text-slate-100">
      <div className="max-w-md w-full rounded-2xl border border-blue-500/30 bg-[#0B1528] p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Payment Confirmed!</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Thank you for getting the <strong>100/100 AI Playbook for Students</strong>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#070E1F] border border-white/5 space-y-2 text-xs text-slate-400">
          <p>Redirecting you to the private student Telegram group in:</p>
          <span className="text-2xl font-extrabold text-[#FFC42B]">{countdown}s</span>
        </div>

        <a
          href={TELEGRAM_URL}
          className="w-full py-3.5 px-6 rounded-xl bg-[#1E5AFF] hover:bg-blue-600 text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30"
        >
          <MessageCircle className="w-5 h-5" />
          <span>Join Telegram Immediately</span>
        </a>

        <div className="pt-4 border-t border-white/5 space-y-2 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300">Need immediate help with your order?</p>
          <p className="flex items-center justify-center gap-1">
            <Phone className="w-3.5 h-3.5 text-[#FFC42B]" /> 08138082009
          </p>
          <p className="flex items-center justify-center gap-1">
            <Mail className="w-3.5 h-3.5 text-[#FFC42B]" /> shineybrainacademy@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
