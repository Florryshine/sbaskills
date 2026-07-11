'use client';

import { useState, useEffect } from 'react';

// Tracks "already voted" per post in this browser so anonymous readers
// can't just refresh and vote again. Not bulletproof, but it's the same
// tradeoff every lightweight rating widget makes, and it's enough to keep
// the aggregate honest for genuine readers.
function hasAlreadyRated(postId) {
  try {
    return localStorage.getItem(`sba-rated-${postId}`) === '1';
  } catch {
    return false;
  }
}

function markAsRated(postId) {
  try {
    localStorage.setItem(`sba-rated-${postId}`, '1');
  } catch {
    // localStorage can throw in private-browsing modes — fine to ignore,
    // worst case a user can rate more than once.
  }
}

export default function RatingWidget({ postId, initialAverage = 0, initialCount = 0 }) {
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAlreadyRated(hasAlreadyRated(postId));
  }, [postId]);

  async function submitRating(rating) {
    if (alreadyRated || submitting) return;
    setSubmitting(true);
    setError(null);
    setUserRating(rating);

    try {
      const res = await fetch('/api/blog/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, rating }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not submit rating');
      }

      setAverage(data.average);
      setCount(data.count);
      markAsRated(postId);
      setAlreadyRated(true);
    } catch (err) {
      setError('Could not submit your rating. Please try again.');
      setUserRating(0);
    } finally {
      setSubmitting(false);
    }
  }

  const displayValue = hoverRating || userRating || Math.round(average);

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Rate this article</h3>

      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHoverRating(0)}
          role="radiogroup"
          aria-label="Rate this article from 1 to 5 stars"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={alreadyRated || submitting}
              onClick={() => submitRating(star)}
              onMouseEnter={() => !alreadyRated && setHoverRating(star)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              aria-checked={userRating === star}
              role="radio"
              className={`text-2xl leading-none transition ${
                alreadyRated || submitting ? 'cursor-default' : 'cursor-pointer hover:scale-110'
              }`}
              style={{
                color: star <= displayValue ? '#f5b301' : '#d1d5db',
              }}
            >
              ★
            </button>
          ))}
        </div>

        {count > 0 && (
          <span className="text-sm text-gray-600">
            {average.toFixed(1)} out of 5 ({count} rating{count === 1 ? '' : 's'})
          </span>
        )}
      </div>

      {alreadyRated && !error && (
        <p className="text-sm text-green-600 mt-2">Thanks for rating this article!</p>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
