'use client';

import { useMemo, useState } from 'react';

const QUESTION_TYPES = new Set(['guided_practice', 'practice', 'quick_check', 'true_false', 'scenario', 'error_analysis']);

function questionFor(screen) {
  if (screen?.question && typeof screen.question === 'object') return screen.question;
  return null;
}

function isCorrect(question, selected) {
  if (!question) return false;
  if (Number.isInteger(question.correctIndex)) return selected === question.correctIndex;
  if (question.correctAnswer !== undefined) return selected === question.correctAnswer;
  return false;
}

export default function LessonScreenPlayer({ lesson, screens = [], completed = false, initialScreenIndex = 0, onProgress, onComplete, onExit }) {
  const [currentIndex, setCurrentIndex] = useState(initialScreenIndex);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState({});

  const orderedScreens = useMemo(
    () => screens.slice().sort((a, b) => a.order_index - b.order_index),
    [screens]
  );
  const screen = orderedScreens[currentIndex];
  const question = questionFor(screen);
  const isQuestion = QUESTION_TYPES.has(screen?.type) || Boolean(question);
  const selected = answers[screen?.id];
  const hasSubmitted = submitted[screen?.id] === true;
  const answerCorrect = hasSubmitted && isCorrect(question, selected);
  const progress = orderedScreens.length ? Math.round(((currentIndex + 1) / orderedScreens.length) * 100) : 0;

  if (!orderedScreens.length) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-extrabold text-gray-900">This lesson is not ready yet</h2>
        <p className="mt-2 text-gray-600">The lesson screens have not been published.</p>
        {onExit ? <button type="button" onClick={onExit} className="mt-5 rounded-full bg-brand-blue px-5 py-3 font-bold text-white">Back to course</button> : null}
      </div>
    );
  }

  function chooseAnswer(value) {
    if (hasSubmitted) return;
    setAnswers((current) => ({ ...current, [screen.id]: value }));
  }

  function submitAnswer() {
    if (selected === undefined || selected === null) return;
    const correct = isCorrect(question, selected);
    setSubmitted((current) => ({ ...current, [screen.id]: true }));
    onProgress?.({ screenIndex: currentIndex, screenId: screen.id, attempted: true, correct });
  }

  function next() {
    if (currentIndex >= orderedScreens.length - 1) {
      onProgress?.({ screenIndex: currentIndex, screenId: screen.id });
      if (!completed) onComplete?.();
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    onProgress?.({ screenIndex: nextIndex, screenId: orderedScreens[nextIndex]?.id });
  }

  const options = Array.isArray(question?.options) ? question.options : [];
  const trueFalseOptions = screen?.type === 'true_false' && options.length === 0 ? ['true', 'false'] : options;

  return (
    <div className="min-h-[70vh] bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-5 flex items-center gap-3">
          {onExit ? (
            <button type="button" onClick={onExit} aria-label="Close lesson" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:border-brand-blue">
              ← Back
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">
              <span className="truncate">{lesson?.title || 'Lesson'}</span>
              <span className="shrink-0">{currentIndex + 1} of {orderedScreens.length}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200" aria-label={`Lesson progress ${progress}%`} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
              <div className="h-full rounded-full bg-brand-yellow transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <article className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue">{screen.type.replaceAll('_', ' ')}</span>
            {screen.difficulty ? <span className="text-xs font-semibold capitalize text-gray-500">{screen.difficulty}</span> : null}
          </div>

          {screen.image_url ? (
            <img src={screen.image_url} alt={screen.image_alt || ''} className="mb-6 max-h-72 w-full rounded-2xl object-cover" />
          ) : null}

          <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">{screen.headline || screen.title}</h1>
          {screen.body ? <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-gray-700">{screen.body}</p> : null}

          {isQuestion ? (
            <div className="mt-8" aria-live="polite">
              <p className="text-lg font-bold text-gray-900">{question?.prompt || question?.question || 'Try this practice activity.'}</p>
              {screen.guidance ? <p className="mt-2 text-sm text-gray-600">{screen.guidance}</p> : null}
              {trueFalseOptions.length ? (
                <div className="mt-5 grid gap-3">
                  {trueFalseOptions.map((option, index) => {
                    const value = options.length ? index : option;
                    const selectedOption = selected === value;
                    const correctOption = hasSubmitted && isCorrect(question, value);
                    return (
                      <button
                        type="button"
                        key={`${option}-${index}`}
                        onClick={() => chooseAnswer(value)}
                        aria-pressed={selectedOption}
                        className={`rounded-2xl border px-4 py-3 text-left font-semibold transition ${selectedOption ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-gray-200 hover:border-brand-blue'} ${correctOption ? 'border-green-500 bg-green-50 text-green-700' : ''}`}
                      >
                        {typeof option === 'string' ? option : JSON.stringify(option)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={selected || ''}
                  disabled={hasSubmitted}
                  onChange={(event) => chooseAnswer(event.target.value)}
                  rows={4}
                  className="mt-5 w-full rounded-2xl border border-gray-200 px-4 py-3"
                  placeholder="Write your answer..."
                />
              )}
              {!hasSubmitted ? (
                <button type="button" onClick={submitAnswer} disabled={selected === undefined || selected === null || selected === ''} className="mt-5 rounded-full bg-brand-blue px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                  Check answer
                </button>
              ) : (
                <div className={`mt-5 rounded-2xl p-4 ${answerCorrect ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
                  <p className="font-extrabold">{answerCorrect ? 'Correct' : 'Good attempt — review the explanation'}</p>
                  {question?.explanation ? <p className="mt-1 leading-7">{question.explanation}</p> : null}
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-10 flex justify-end">
            <button type="button" onClick={next} disabled={completed || (isQuestion && !hasSubmitted)} className={`rounded-full px-7 py-3 font-extrabold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${completed ? 'bg-green-100 text-green-700' : 'bg-brand-yellow text-brand-dark'}`}>
              {completed ? 'Lesson completed' : currentIndex >= orderedScreens.length - 1 ? 'Complete lesson' : 'Next'}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
