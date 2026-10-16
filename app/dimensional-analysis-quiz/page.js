'use client';

import { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const questions = [
  {
    question: 'Work done is equal to force multiplied by distance. If force has dimensions [MLT⁻²] and distance has dimensions [L], what is the dimensional formula of work done?',
    options: ['[MLT⁻²]', '[ML²T⁻²]', '[ML²T⁻³]', '[ML⁻¹T⁻²]'],
    answer: 1,
    explanation: 'Multiply the dimensions: [MLT⁻²] × [L] = [ML²T⁻²]. Add the powers of L.',
  },
  {
    question: 'Power is work done divided by time. What is the dimensional formula of power?',
    options: ['[ML²T⁻²]', '[MLT⁻²]', '[ML²T⁻³]', '[ML⁻¹T⁻²]'],
    answer: 2,
    explanation: 'Power = work ÷ time = [ML²T⁻²] ÷ [T] = [ML²T⁻³].',
  },
  {
    question: 'When dividing dimensional quantities with the same base, what do you do to their powers?',
    options: ['Add the powers', 'Subtract the powers', 'Multiply the powers', 'Always make the powers positive'],
    answer: 1,
    explanation: 'When dividing quantities with the same base, subtract the denominator power from the numerator power.',
  },
  {
    question: 'Which of the following is the dimensional formula of force?',
    options: ['[MLT⁻¹]', '[ML²T⁻²]', '[MLT⁻²]', '[ML²T⁻³]'],
    answer: 2,
    explanation: 'Force = mass × acceleration = [M] × [LT⁻²] = [MLT⁻²].',
  },
  {
    question: 'Which quantity has the same dimensional formula as work done?',
    options: ['Power', 'Pressure', 'Energy', 'Acceleration'],
    answer: 2,
    explanation: 'Work and energy both have dimensions [ML²T⁻²]. They are different physical concepts but share dimensions.',
  },
  {
    question: 'What is the SI unit of power?',
    options: ['Joule', 'Newton', 'Pascal', 'Watt'],
    answer: 3,
    explanation: 'Power is measured in watts (W). One watt is one joule per second.',
  },
  {
    question: 'The principle of dimensional homogeneity states that:',
    options: [
      'Every equation must contain mass',
      'All terms added or subtracted in a valid equation must have the same dimensions',
      'Every physical quantity has the same dimensions',
      'All dimensional powers must be positive',
    ],
    answer: 1,
    explanation: 'Terms that are added or subtracted in a physically valid equation must have matching dimensions.',
  },
  {
    question: 'Pressure is force divided by area. What is its dimensional formula?',
    options: ['[MLT⁻²]', '[ML⁻¹T⁻²]', '[ML²T⁻²]', '[ML⁻³]'],
    answer: 1,
    explanation: 'Pressure = [MLT⁻²] ÷ [L²] = [ML⁻¹T⁻²].',
  },
  {
    question: 'What is the dimensional formula of momentum?',
    options: ['[MLT⁻¹]', '[MLT⁻²]', '[ML²T⁻²]', '[MT⁻²]'],
    answer: 0,
    explanation: 'Momentum = mass × velocity = [M] × [LT⁻¹] = [MLT⁻¹].',
  },
  {
    question: 'Which of these is a limitation of dimensional analysis?',
    options: [
      'It can help check dimensional consistency',
      'It can help derive powers of variables',
      'It can determine every numerical constant in an equation',
      'It can help identify dimensional errors',
    ],
    answer: 2,
    explanation: 'Dimensional analysis cannot determine numerical constants such as 2 or 2π.',
  },
];

export default function DimensionalAnalysisQuizPage() {
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const score = useMemo(
    () => questions.reduce((total, q, i) => total + (answers[i] === q.answer ? 1 : 0), 0),
    [answers]
  );

  function submitQuiz(event) {
    event.preventDefault();
    if (Object.keys(answers).length !== questions.length) {
      alert('Please answer all 10 questions before submitting.');
      return;
    }
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function restartQuiz() {
    setAnswers({});
    setSubmitted(false);
    setShowReview(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl px-4">
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="bg-blue-900 px-6 py-7 text-white sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">Shiney Brain Academy • Physics</p>
              <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Dimensional Analysis Quiz</h1>
              <p className="mt-3 text-sm leading-6 text-blue-100">Topic: Work Done and Power • 10 multiple-choice questions</p>
            </div>

            <div className="p-6 sm:p-8">
              {!submitted ? (
                <>
                  <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
                    <p className="font-bold text-blue-900">Instructions</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Enter your name before starting.</li>
                      <li>Answer all 10 questions. Each question carries 1 mark.</li>
                      <li>Choose one option for each question, then submit to see your score.</li>
                      <li>Revise the lesson on dimensional formulae before attempting the quiz.</li>
                    </ul>
                  </div>

                  <form onSubmit={submitQuiz}>
                    <label htmlFor="student-name" className="mb-2 block text-sm font-bold text-slate-800">Student name</label>
                    <input
                      id="student-name"
                      value={studentName}
                      onChange={(event) => setStudentName(event.target.value)}
                      required
                      maxLength={100}
                      placeholder="Enter your full name"
                      className="mb-8 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                    />

                    <div className="space-y-6">
                      {questions.map((q, index) => (
                        <fieldset key={index} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                          <legend className="px-1 text-base font-bold leading-6 text-slate-900">
                            {index + 1}. {q.question}
                          </legend>
                          <div className="mt-3 space-y-2">
                            {q.options.map((option, optionIndex) => (
                              <label
                                key={optionIndex}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${answers[index] === optionIndex ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${index}`}
                                  value={optionIndex}
                                  checked={answers[index] === optionIndex}
                                  onChange={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))}
                                  className="mt-0.5"
                                />
                                <span><strong>{String.fromCharCode(65 + optionIndex)}.</strong> {option}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">{Object.keys(answers).length} of {questions.length} answered</p>
                      <button type="submit" className="rounded-full bg-yellow-400 px-7 py-3 font-extrabold text-slate-900 hover:bg-yellow-300">
                        Submit Quiz
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
                    <p className="text-sm font-semibold text-blue-900">Quiz submitted by</p>
                    <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{studentName}</h2>
                    <p className="mt-5 text-5xl font-black text-blue-900">{score}/10</p>
                    <p className="mt-2 text-lg font-bold">{score * 10}%</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {score >= 8 ? 'Excellent work! Keep it up.' : score >= 5 ? 'Good effort. Review the explanations and practise again.' : 'Please revise the lesson and try again.'}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">This page displays your result on this device; it does not send your score to your teacher.</p>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button onClick={() => setShowReview((value) => !value)} className="flex-1 rounded-full border border-blue-800 px-5 py-3 font-bold text-blue-900 hover:bg-blue-50">
                      {showReview ? 'Hide Answer Review' : 'Review Answers'}
                    </button>
                    <button onClick={restartQuiz} className="flex-1 rounded-full bg-yellow-400 px-5 py-3 font-bold text-slate-900 hover:bg-yellow-300">
                      Try Again
                    </button>
                  </div>

                  {showReview && (
                    <div className="mt-6 space-y-4">
                      {questions.map((q, index) => (
                        <div key={index} className="rounded-xl border border-slate-200 p-4">
                          <p className="font-bold text-slate-900">{index + 1}. {q.question}</p>
                          <p className={`mt-2 text-sm font-semibold ${answers[index] === q.answer ? 'text-green-700' : 'text-red-700'}`}>
                            Your answer: {String.fromCharCode(65 + answers[index])}. {q.options[answers[index]]}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-green-800">
                            Correct answer: {String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{q.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
          <p className="mt-5 text-center text-xs text-slate-500">Shiney Brain Academy • Where Champions Are Made</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
