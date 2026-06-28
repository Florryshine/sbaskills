'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// ── Constants ─────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SLOT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
  { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
  { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-800' },
  { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
  { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-800' },
  { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-800' },
];

// ── Your Models ────────────────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.0',
  'gemini-3.5',
];

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
];

// ── Helpers ──────────────────────────────────────────────────
const colorCache = {};
let colorIdx = 0;

function subjectColor(subject) {
  if (!colorCache[subject]) {
    colorCache[subject] = SLOT_COLORS[colorIdx % SLOT_COLORS.length];
    colorIdx++;
  }
  return colorCache[subject];
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ── Prompt builder ────────────────────────────────────────────
function buildPrompt({ subjects, weakSubjects, availableDays, hoursPerDay, examDate, notes }) {
  const days = daysUntil(examDate);
  return `You are an expert academic coach for Nigerian secondary school and university students preparing for JAMB and Post-UTME exams.

Generate a personalised weekly study timetable as a JSON object.

Student details:
- Subjects: ${subjects.join(', ')}
- Weak subjects (needs more time): ${weakSubjects.length ? weakSubjects.join(', ') : 'None specified'}
- Available study days: ${availableDays.join(', ')}
- Daily study hours available: ${hoursPerDay} hours
${examDate ? `- Exam date: ${examDate} (${days} days away)` : ''}
${notes ? `- Additional preferences: ${notes}` : ''}

Rules:
1. Distribute subjects smartly across available days
2. Give weak subjects 30-50% more time slots than strong ones
3. Never schedule more than 2 consecutive hours of the same subject
4. Add short break slots (15 mins) between every 1.5-2 hour session
5. If exam is within 14 days, prioritise past questions and revision
6. Start sessions at realistic times (e.g. 7:00 AM or 8:00 AM)
7. Each study session should be 1-2 hours

Return ONLY valid JSON, no markdown, no explanation:
{
  "summary": "2 personalised sentences about the study strategy",
  "weeklyPlan": {
    "Monday": [
      { "time": "8:00 AM - 9:30 AM", "subject": "Mathematics", "focus": "Quadratic Equations", "type": "study" },
      { "time": "9:30 AM - 9:45 AM", "subject": "Break", "focus": "Rest and hydrate", "type": "break" }
    ]
  },
  "tips": ["tip 1", "tip 2"],
  "subjectHoursPerWeek": { "Mathematics": 6, "Physics": 4 }
}`;
}

// ── JSON parser ───────────────────────────────────────────────
function parseJSON(text) {
  const cleaned = text.replace(/```json|```/gi, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Invalid JSON response from AI');
}

// ── API callers ───────────────────────────────────────────────
async function callGemini(key, model, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );
  const data = await res.json();
  if (data?.error) throw new Error(`Gemini ${model}: ${data.error.message}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model}: empty response`);
  return parseJSON(text);
}

async function callGroq(key, model, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });
  const data = await res.json();
  if (data?.error) throw new Error(`Groq ${model}: ${data.error.message}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq ${model}: empty response`);
  return parseJSON(text);
}

async function generateWithFallback(prompt) {
  const geminiKeys = [
    process.env.NEXT_PUBLIC_GEMINI_API_KEY_1,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY_2,
  ].filter(Boolean);
  const groqKeys = [
    process.env.NEXT_PUBLIC_GROQ_API_KEY_1,
    process.env.NEXT_PUBLIC_GROQ_API_KEY_2,
  ].filter(Boolean);

  const errors = [];

  // Try each Gemini key × each model
  for (const key of geminiKeys) {
    for (const model of GEMINI_MODELS) {
      try { return await callGemini(key, model, prompt); }
      catch (e) { errors.push(e.message); }
    }
  }

  // Try each Groq key × each model
  for (const key of groqKeys) {
    for (const model of GROQ_MODELS) {
      try { return await callGroq(key, model, prompt); }
      catch (e) { errors.push(e.message); }
    }
  }

  throw new Error(`All API keys failed.\n${errors.join('\n')}`);
}

// ── PDF export ────────────────────────────────────────────────
function exportPDF(timetable, subjects) {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let html = `<html><head><title>Study Timetable – Shiney Brain Academy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; font-size: 13px; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #1565C0; padding-bottom: 16px; }
    .header h1 { color: #1565C0; font-size: 22px; }
    .header p { color: #64748b; font-size: 12px; margin-top: 4px; }
    .summary { background: #eff6ff; border-left: 4px solid #1565C0; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px; line-height: 1.6; }
    h2 { color: #1565C0; font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #1565C0; color: white; padding: 7px 10px; text-align: left; font-size: 12px; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) td { background: #f8fafc; }
    .break-row td { color: #94a3b8; font-style: italic; }
    .tips { background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; margin-top: 16px; }
    .tips li { margin: 6px 0 0 16px; }
    .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style></head><body>
  <div class="header">
    <h1>📚 My Personalised Study Timetable</h1>
    <p>Generated by Shiney Brain Academy · ${today}</p>
    <p>Subjects: ${subjects.join(' · ')}</p>
  </div>`;

  if (timetable.summary) html += `<div class="summary">${timetable.summary}</div>`;

  if (timetable.weeklyPlan) {
    Object.entries(timetable.weeklyPlan).forEach(([day, sessions]) => {
      html += `<h2>${day}</h2><table><tr><th>Time</th><th>Subject</th><th>Focus / Topic</th></tr>`;
      sessions.forEach(s => {
        const cls = s.type === 'break' ? 'break-row' : '';
        html += `<tr class="${cls}"><td>${s.time}</td><td>${s.subject}</td><td>${s.focus}</td></tr>`;
      });
      html += `</table>`;
    });
  }

  if (timetable.tips?.length) {
    html += `<div class="tips"><h2>💡 Study Tips</h2><ul>`;
    timetable.tips.forEach(t => { html += `<li>${t}</li>`; });
    html += `</ul></div>`;
  }

  html += `<div class="footer">Shiney Brain Academy · shineybrainacademy.com · Stay consistent, stay winning! 🌟</div></body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ── Main component ────────────────────────────────────────────
export default function StudyTimetablePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timetable, setTimetable] = useState(null);

  const [subjects, setSubjects] = useState(['', '']);
  const [weakSubjects, setWeakSubjects] = useState([]);
  const [availableDays, setAvailableDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [examDate, setExamDate] = useState('');
  const [notes, setNotes] = useState('');

  const validSubjects = subjects.filter(s => s.trim());
  const examDaysLeft = daysUntil(examDate);

  const updateSubject = (i, val) => setSubjects(prev => prev.map((s, idx) => idx === i ? val : s));
  const addSubject = () => setSubjects(prev => [...prev, '']);
  const removeSubject = (i) => setSubjects(prev => prev.filter((_, idx) => idx !== i));
  const toggleDay = (day) => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const toggleWeak = (sub) => setWeakSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const prompt = buildPrompt({ subjects: validSubjects, weakSubjects, availableDays, hoursPerDay, examDate, notes });
      const result = await generateWithFallback(prompt);
      setTimetable(result);
      setStep(4);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setTimetable(null);
    setSubjects(['', '']);
    setWeakSubjects([]);
    setExamDate('');
    setNotes('');
    setError('');
    colorIdx = 0;
    Object.keys(colorCache).forEach(k => delete colorCache[k]);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
        <div className="max-w-2xl mx-auto px-4">

          {/* Header */}
          <div className="bg-[#1565C0] text-white py-10 px-4 text-center rounded-2xl mb-8">
            <div className="text-4xl mb-2">📅</div>
            <h1 className="text-2xl md:text-3xl font-bold">Study Timetable Generator</h1>
            <p className="text-blue-200 text-sm mt-1">AI‑powered · Personalised · Exam‑ready</p>
          </div>

          {/* Progress indicator */}
          {step < 4 && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {['Subjects', 'Schedule', 'Preferences'].map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-[#1565C0] text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${step === i + 1 ? 'text-[#1565C0]' : 'text-gray-400'}`}>{label}</span>
                  {i < 2 && <div className="w-6 sm:w-10 h-px bg-gray-300 mx-1" />}
                </div>
              ))}
            </div>
          )}

          {/* STEP 1: Subjects */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-[#1565C0] mb-1">What subjects are you studying?</h2>
              <p className="text-gray-500 text-sm mb-5">Add your JAMB or Post‑UTME subjects</p>

              <div className="space-y-3 mb-3">
                {subjects.map((sub, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={sub}
                      onChange={e => updateSubject(i, e.target.value)}
                      placeholder={`Subject ${i + 1}  e.g. Mathematics`}
                      className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    {subjects.length > 2 && (
                      <button onClick={() => removeSubject(i)} className="text-red-400 hover:text-red-600 w-8 text-xl font-bold">×</button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addSubject} className="text-blue-600 text-sm font-medium hover:underline mb-6 block">
                + Add another subject
              </button>

              {validSubjects.length >= 2 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Which are your weakest subjects? <span className="text-gray-400">(AI gives them more time)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {validSubjects.map(sub => (
                      <button
                        key={sub}
                        onClick={() => toggleWeak(sub)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          weakSubjects.includes(sub)
                            ? 'bg-red-50 border-red-400 text-red-700 font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {weakSubjects.includes(sub) ? '⚠️ ' : ''}{sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={validSubjects.length < 1}
                className="w-full bg-[#1565C0] text-white py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                Next: Set Schedule →
              </button>
            </div>
          )}

          {/* STEP 2: Schedule */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-[#1565C0] mb-1">Set your study schedule</h2>
              <p className="text-gray-500 text-sm mb-5">Tell us when you are available</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Available days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                        availableDays.includes(day)
                          ? 'bg-[#1565C0] text-white border-[#1565C0] font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Hours per day: <span className="text-[#1565C0] font-bold text-base">{hoursPerDay} hrs</span>
                </label>
                <input
                  type="range" min={1} max={12} value={hoursPerDay}
                  onChange={e => setHoursPerDay(Number(e.target.value))}
                  className="w-full accent-[#1565C0]"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 hr</span><span>6 hrs</span><span>12 hrs</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exam / Test date <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="date" value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {examDate && examDaysLeft !== null && (
                  <p className={`text-xs mt-1 font-medium ${examDaysLeft < 14 ? 'text-red-500' : 'text-blue-600'}`}>
                    {examDaysLeft < 14
                      ? `🚨 Only ${examDaysLeft} days left! AI will focus on revision and past questions.`
                      : `📅 ${examDaysLeft} days until exam — AI will plan a full progressive schedule.`}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={availableDays.length < 1}
                  className="flex-1 bg-[#1565C0] text-white py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors"
                >
                  Next: Preferences →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preferences */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-[#1565C0] mb-1">Any special preferences?</h2>
              <p className="text-gray-500 text-sm mb-5">Help the AI personalise your plan even more</p>

              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. I prefer studying Maths in the morning. I have church on Sunday mornings. I want to focus on past questions for Chemistry..."
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none mb-5"
              />

              <div className="bg-blue-50 rounded-xl p-4 mb-5 text-sm">
                <p className="font-semibold text-blue-800 mb-2">📋 Your timetable will be based on:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• <strong>{validSubjects.length} subjects:</strong> {validSubjects.join(', ')}</li>
                  {weakSubjects.length > 0 && <li>• <strong>Weak subjects:</strong> {weakSubjects.join(', ')}</li>}
                  <li>• <strong>{hoursPerDay} hours/day</strong> across {availableDays.length} days ({availableDays.join(', ')})</li>
                  {examDate && (
                    <li>• <strong>Exam date:</strong> {new Date(examDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })} ({examDaysLeft} days away)</li>
                  )}
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4 leading-relaxed">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">← Back</button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex-1 bg-[#f0a500] text-white py-3 rounded-xl font-bold disabled:opacity-60 hover:bg-[#d4920a] transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Generating your timetable...
                    </span>
                  ) : '✨ Generate My Timetable'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Result */}
          {step === 4 && timetable && (
            <div>
              {timetable.summary && (
                <div className="bg-[#1565C0] text-white rounded-2xl p-5 mb-5">
                  <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-1">Your AI Study Strategy</p>
                  <p className="text-sm leading-relaxed">{timetable.summary}</p>
                </div>
              )}

              {timetable.subjectHoursPerWeek && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
                  <h3 className="font-bold text-[#1565C0] text-sm mb-3">Weekly Hours Per Subject</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(timetable.subjectHoursPerWeek).map(([sub, hrs]) => {
                      const c = subjectColor(sub);
                      return (
                        <div key={sub} className={`px-3 py-2 rounded-lg border text-xs font-medium ${c.bg} ${c.border} ${c.text}`}>
                          {sub}: <span className="font-bold">{hrs}h/week</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-5">
                {timetable.weeklyPlan && Object.entries(timetable.weeklyPlan).map(([day, sessions]) => (
                  <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-[#1565C0] text-white px-5 py-3 flex justify-between items-center">
                      <h3 className="font-bold">{day}</h3>
                      <span className="text-xs text-blue-200">{sessions.filter(s => s.type !== 'break').length} sessions</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {sessions.map((session, i) => {
                        const c = session.type !== 'break' ? subjectColor(session.subject) : null;
                        return (
                          <div key={i} className={`px-5 py-3 flex gap-4 items-start ${session.type === 'break' ? 'bg-gray-50' : ''}`}>
                            <span className="text-xs text-gray-400 font-mono w-28 shrink-0 pt-0.5">{session.time}</span>
                            {session.type === 'break' ? (
                              <span className="text-xs text-gray-400 italic">☕ {session.subject} — {session.focus}</span>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border mb-1 ${c.bg} ${c.border} ${c.text}`}>
                                  {session.subject}
                                </span>
                                <p className="text-sm text-gray-700 leading-snug">{session.focus}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {timetable.tips?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 mb-5">
                  <h3 className="font-bold text-yellow-800 mb-3">💡 Tips from Your AI Study Coach</h3>
                  <ul className="space-y-2">
                    {timetable.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-yellow-700 flex gap-2">
                        <span className="shrink-0 font-bold">{i + 1}.</span> {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => exportPDF(timetable, validSubjects)}
                  className="flex-1 bg-[#1565C0] text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  📄 Download as PDF
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  🔄 Start Over
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 mt-5">
                Powered by Shiney Brain Academy AI · Stay consistent, stay winning! 🌟
              </p>
            </div>
          )}

        </div>
      </div>
      <Footer />
    </>
  );
}