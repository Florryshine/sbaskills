'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export default function FlashcardViewer() {
  const params = useParams();
  const id = params.id;
  const supabase = createBrowserClient();

  const [setData, setSetData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadSet() {
      setLoading(true);
      const { data, error } = await supabase
        .from('flashcard_drafts')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (error || !data) {
        setError('Flashcard set not found or not published.');
      } else {
        setSetData(data);
      }
      setLoading(false);
    }

    if (id) loadSet();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!setData) return <div className="p-8 text-center">No flashcards found.</div>;

  const cards = setData.cards || [];
  const totalCards = cards.length;

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const handleFlip = () => setIsFlipped(!isFlipped);

  const currentCard = cards[currentIndex] || { front: 'No card', back: '' };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">{setData.keyword}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {currentIndex + 1} of {totalCards}
      </p>

      <div
        className="relative w-full aspect-[4/3] cursor-pointer perspective-1000"
        onClick={handleFlip}
      >
        <div
          className={`w-full h-full transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front */}
          <div
            className="absolute inset-0 backface-hidden bg-white border-2 border-slate-200 rounded-2xl p-8 flex items-center justify-center text-center text-xl font-semibold shadow-lg"
          >
            {currentCard.front}
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 backface-hidden bg-brand-blue text-white rounded-2xl p-8 flex items-center justify-center text-center text-lg rotate-y-180 shadow-lg"
          >
            <div>
              <p>{currentCard.back}</p>
              {currentCard.explanation && (
                <p className="mt-4 text-sm text-blue-200">{currentCard.explanation}</p>
              )}
              {currentCard.memory_trick && (
                <p className="mt-2 text-sm text-yellow-300">💡 {currentCard.memory_trick}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={handlePrev}
          className="bg-gray-200 px-4 py-2 rounded-xl font-bold hover:bg-gray-300"
        >
          ← Previous
        </button>
        <button
          onClick={handleFlip}
          className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90"
        >
          Flip
        </button>
        <button
          onClick={handleNext}
          className="bg-gray-200 px-4 py-2 rounded-xl font-bold hover:bg-gray-300"
        >
          Next →
        </button>
      </div>

      <div className="mt-4 text-center text-sm text-gray-500">
        Tap card to flip • Use buttons to navigate
      </div>
    </div>
  );
}