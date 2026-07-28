'use client';

import { useState, useMemo } from 'react';

// ── shared helpers ──────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sequence Builder ─────────────────────────────────────────────────────
// Student places shuffled steps into slots, in the order they think is
// correct, then checks their answer against step_order.
function SequenceBuilder({ steps }) {
  const shuffled = useMemo(() => shuffle(steps), [steps]);
  const [pool, setPool] = useState(shuffled);
  const [placed, setPlaced] = useState([]);
  const [result, setResult] = useState(null); // null | 'correct' | 'incorrect'

  function placeStep(step) {
    if (result) return;
    setPlaced([...placed, step]);
    setPool(pool.filter((s) => s.id !== step.id));
  }

  function removeStep(step) {
    if (result) return;
    setPlaced(placed.filter((s) => s.id !== step.id));
    setPool([...pool, step]);
  }

  function check() {
    const correct = placed.every((s, i) => s.step_order === i + 1);
    setResult(correct && placed.length === steps.length ? 'correct' : 'incorrect');
  }

  function reset() {
    setPool(shuffle(steps));
    setPlaced([]);
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Tap the steps below in the order you think is correct.
      </p>

      <div className="space-y-2 min-h-[3rem]">
        {placed.map((s, i) => (
          <button
            key={s.id}
            onClick={() => removeStep(s)}
            className="w-full text-left px-4 py-3 rounded-lg bg-indigo-600 text-white flex items-center gap-3"
          >
            <span className="font-bold">{i + 1}.</span>
            <span>{s.label}</span>
          </button>
        ))}
        {placed.length === 0 && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg py-6 text-center text-gray-400">
            Your ordered sequence will appear here
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {pool.map((s) => (
          <button
            key={s.id}
            onClick={() => placeStep(s)}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={check}
          disabled={placed.length !== steps.length || !!result}
          className="px-5 py-2 rounded-lg bg-green-600 disabled:bg-gray-300 text-white font-semibold"
        >
          Check Order
        </button>
        {result && (
          <button onClick={reset} className="px-5 py-2 rounded-lg bg-gray-200 font-semibold">
            Try Again
          </button>
        )}
        {result === 'correct' && (
          <span className="text-green-600 font-semibold">🎉 Correct order!</span>
        )}
        {result === 'incorrect' && (
          <span className="text-red-600 font-semibold">Not quite — check again</span>
        )}
      </div>
    </div>
  );
}

// ── Sequence Memory (Simon-Says style recall) ────────────────────────────
// Flashes the correct order once, then the student reconstructs it by
// tapping shuffled buttons in the same order.
function SequenceMemory({ steps }) {
  const shuffled = useMemo(() => shuffle(steps), [steps]);
  const [phase, setPhase] = useState('ready'); // ready | showing | recall | done
  const [flashIndex, setFlashIndex] = useState(-1);
  const [answer, setAnswer] = useState([]);
  const [result, setResult] = useState(null);

  function startShow() {
    setPhase('showing');
    setAnswer([]);
    setResult(null);
    let i = 0;
    setFlashIndex(0);
    const interval = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(interval);
        setFlashIndex(-1);
        setPhase('recall');
      } else {
        setFlashIndex(i);
      }
    }, 1000);
  }

  function pick(step) {
    if (phase !== 'recall' || result) return;
    const next = [...answer, step];
    setAnswer(next);
    if (next.length === steps.length) {
      const correct = next.every((s, i) => s.step_order === i + 1);
      setResult(correct ? 'correct' : 'incorrect');
      setPhase('done');
    }
  }

  function reset() {
    setPhase('ready');
    setAnswer([]);
    setResult(null);
    setFlashIndex(-1);
  }

  return (
    <div className="space-y-6">
      {phase === 'ready' && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            Watch the {steps.length}-step sequence flash by, then tap the steps back in order.
          </p>
          <button
            onClick={startShow}
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold"
          >
            Start
          </button>
        </div>
      )}

      {phase === 'showing' && (
        <div className="text-center py-8">
          <div className="inline-block px-8 py-6 rounded-xl bg-indigo-600 text-white text-xl font-bold min-w-[16rem]">
            {steps[flashIndex]?.label}
          </div>
          <p className="text-gray-400 mt-3">
            Step {flashIndex + 1} of {steps.length}
          </p>
        </div>
      )}

      {(phase === 'recall' || phase === 'done') && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
            {answer.map((s, i) => (
              <span key={s.id} className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
                {i + 1}. {s.label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {shuffled.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s)}
                disabled={answer.includes(s) || !!result}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-800 font-medium"
              >
                {s.label}
              </button>
            ))}
          </div>

          {result === 'correct' && (
            <p className="text-green-600 font-semibold">🎉 You recalled it perfectly!</p>
          )}
          {result === 'incorrect' && (
            <p className="text-red-600 font-semibold">Not quite the right order — give it another go.</p>
          )}
          {result && (
            <button onClick={reset} className="px-5 py-2 rounded-lg bg-gray-200 font-semibold">
              Play Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Definition Match ──────────────────────────────────────────────────────
// Click a term, then click its matching definition. Correct pairs lock in
// green; wrong guesses flash red and clear the selection.
function DefinitionMatch({ definitions }) {
  const terms = useMemo(
    () => shuffle(definitions.map((d, i) => ({ ...d, key: `t-${i}` }))),
    [definitions]
  );
  const defs = useMemo(
    () => shuffle(definitions.map((d, i) => ({ ...d, key: `d-${i}` }))),
    [definitions]
  );

  const [selectedTerm, setSelectedTerm] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [wrongFlash, setWrongFlash] = useState(null);

  function pickTerm(t) {
    if (matched.has(t.term)) return;
    setSelectedTerm(t);
  }

  function pickDefinition(d) {
    if (!selectedTerm || matched.has(d.term)) return;
    if (d.term === selectedTerm.term) {
      setMatched(new Set([...matched, d.term]));
      setSelectedTerm(null);
    } else {
      setWrongFlash(d.key);
      setTimeout(() => setWrongFlash(null), 500);
      setSelectedTerm(null);
    }
  }

  const done = matched.size === definitions.length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Tap a term, then tap its matching definition.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          {terms.map((t) => (
            <button
              key={t.key}
              onClick={() => pickTerm(t)}
              disabled={matched.has(t.term)}
              className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition
                ${matched.has(t.term) ? 'bg-green-100 text-green-700' :
                  selectedTerm?.term === t.term ? 'bg-indigo-600 text-white' :
                  'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
            >
              {t.term}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {defs.map((d) => (
            <button
              key={d.key}
              onClick={() => pickDefinition(d)}
              disabled={matched.has(d.term)}
              className={`w-full text-left px-4 py-3 rounded-lg transition
                ${matched.has(d.term) ? 'bg-green-100 text-green-700' :
                  wrongFlash === d.key ? 'bg-red-200 text-red-700' :
                  'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}
            >
              {d.definition}
            </button>
          ))}
        </div>
      </div>
      {done && <p className="text-green-600 font-semibold">🎉 All matched!</p>}
    </div>
  );
}

// ── Page shell with tabs ──────────────────────────────────────────────────
export default function GamesClient({ asset, steps }) {
  const hasSequence = steps && steps.length >= 2;
  const definitions = Array.isArray(asset.definitions) ? asset.definitions.filter((d) => d?.term && d?.definition) : [];
  const hasDefinitions = definitions.length >= 2;

  const availableTabs = [
    hasSequence && { id: 'builder', label: 'Sequence Builder' },
    hasSequence && { id: 'memory', label: 'Sequence Memory' },
    hasDefinitions && { id: 'match', label: 'Definition Match' },
  ].filter(Boolean);

  const [tab, setTab] = useState(availableTabs[0]?.id);

  if (availableTabs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">{asset.keyword}</h1>
        <p className="text-gray-500">
          No games are available for this topic yet — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wide">
        {asset.subject}
      </p>
      <h1 className="text-2xl font-bold mb-6">{asset.keyword}</h1>

      <div className="flex gap-2 mb-8 border-b border-gray-200">
        {availableTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 font-semibold border-b-2 -mb-px transition
              ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'builder' && <SequenceBuilder steps={steps} />}
      {tab === 'memory' && <SequenceMemory steps={steps} />}
      {tab === 'match' && <DefinitionMatch definitions={definitions} />}
    </div>
  );
}
