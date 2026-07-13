'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getUserPoints, redeemPoints, getRewards } from '@/lib/gamification';

export default function StorePage() {
  const [user, setUser] = useState(null);
  const [available, setAvailable] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState(null);
  const [message, setMessage] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/store');
        return;
      }
      setUser(user);

      const [pointsData, rewardsData] = await Promise.all([getUserPoints(user.id), getRewards()]);
      setAvailable(pointsData.available_points);
      setRewards(rewardsData);
      setLoading(false);
    }
    load();
  }, []);

  const handleRedeem = async (reward) => {
    setRedeemingId(reward.id);
    setMessage(null);
    const result = await redeemPoints(user.id, reward.id);
    if (result.success) {
      setAvailable(result.remaining);
      setMessage({ type: 'success', text: `Redeemed "${reward.title}"! 🎉` });
    } else {
      setMessage({ type: 'error', text: result.message || 'Could not redeem right now.' });
    }
    setRedeemingId(null);
  };

  if (loading) return <div className="p-8 text-center">Loading store...</div>;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue py-14 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-2">🏪 SBA Store</h1>
          <p className="text-blue-100">Spend the points you've already earned — your XP never goes down.</p>
          <div className="mt-4 inline-block bg-white/10 rounded-full px-6 py-2 font-bold text-lg">
            {available.toLocaleString()} points available
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {message && (
            <div
              className={`mb-6 rounded-xl px-4 py-3 text-sm font-semibold ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {rewards.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No rewards available right now — check back soon.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rewards.map((reward) => {
                const canAfford = available >= reward.cost_points;
                return (
                  <div key={reward.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col">
                    <p className="font-bold text-gray-800">{reward.title}</p>
                    <p className="text-sm text-gray-500 mt-1 flex-1">{reward.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-brand-blue font-extrabold">{reward.cost_points} pts</span>
                      <button
                        onClick={() => handleRedeem(reward)}
                        disabled={!canAfford || redeemingId === reward.id}
                        className="rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                      >
                        {redeemingId === reward.id ? 'Redeeming...' : canAfford ? 'Redeem' : 'Not enough points'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
