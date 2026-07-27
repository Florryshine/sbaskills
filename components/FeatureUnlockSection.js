'use client';

import Link from 'next/link';
import { useUnlockSystem } from '@/context/UnlockSystemContext';
import { getLockedFeatures, getFeatureById } from '@/lib/featureUnlocks';
import LockedFeature from './LockedFeature';

export default function FeatureUnlockSection() {
  const unlockSystem = useUnlockSystem();
  const { userLevel, userPoints } = unlockSystem || {};

  // Get all features
  const allFeatures = [
    { featureId: 'lessons', label: 'Lessons', emoji: '📚', route: '/courses' },
    { featureId: 'quiz', label: 'Quizzes', emoji: '📝', route: '/quizzes' },
    { featureId: 'dailyChallenge', label: 'Daily Challenge', emoji: '🎯', route: '/challenge' },
    { featureId: 'flashcards', label: 'Flashcards', emoji: '📇', route: '/flashcards' },
    { featureId: 'podcasts', label: 'Podcasts', emoji: '🎙️', route: '/podcasts' },
    { featureId: 'bossBattle', label: 'Boss Battle', emoji: '🎮', route: '/boss-battles' },
    { featureId: 'discussionForum', label: 'Discussion Forum', emoji: '💬', route: '/forum' },
    { featureId: 'mockCBT', label: 'Mock CBT', emoji: '💻', route: '/mock-cbt' },
    { featureId: 'aiMentor', label: 'AI Mentor', emoji: '🤖', route: '/ai-mentor' },
  ];

  if (!unlockSystem) return null;

  const unlockedFeatures = allFeatures.filter(f => unlockSystem.isUnlocked(f.featureId));
  const lockedFeatures = allFeatures.filter(f => !unlockSystem.isUnlocked(f.featureId));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
      <h2 className="text-xl font-extrabold text-gray-800 mb-4">
        🎯 Your Features
      </h2>
      
      {/* Unlocked Features */}
      <div className="mb-6">
        <h3 className="font-bold text-brand-blue mb-3">✨ Unlocked</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {unlockedFeatures.map((feature) => (
            <Link
              key={feature.featureId}
              href={feature.route}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition text-center"
            >
              <span className="text-2xl">{feature.emoji}</span>
              <span className="text-sm font-bold text-green-700">{feature.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Locked Features */}
      {lockedFeatures.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-500 mb-3">🔒 Coming Soon</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {lockedFeatures.map((feature) => {
              const requiredLevel = unlockSystem.getRequiredLevel(feature.featureId);
              return (
                <LockedFeature
                  key={feature.featureId}
                  featureId={feature.featureId}
                  userLevel={userLevel || 1}
                  showTooltip={true}
                >
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-not-allowed">
                    <span className="text-2xl opacity-50">{feature.emoji}</span>
                    <span className="text-sm font-bold text-gray-400">{feature.label}</span>
                    <span className="text-xs text-gray-500">Level {requiredLevel}</span>
                  </div>
                </LockedFeature>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress to next unlock */}
      {lockedFeatures.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 text-center">
            Keep earning XP to unlock more features! 
            {userLevel && lockedFeatures.length > 0 && (
              <span className="font-bold text-brand-blue">
                Next: {lockedFeatures[0].label} at Level {unlockSystem.getRequiredLevel(lockedFeatures[0].featureId)}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
