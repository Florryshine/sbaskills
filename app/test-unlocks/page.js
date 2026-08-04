'use client';

import { useState } from 'react';
import { useUnlockSystem } from '@/context/UnlockSystemContext';
import { getLevelInfo } from '@/lib/levels';
import FeatureUnlockSection from '@/components/FeatureUnlockSection';
import LockedFeature from '@/components/LockedFeature';
import Link from 'next/link';

export default function TestUnlocksPage() {
  const unlockSystem = useUnlockSystem();
  const [testLevel, setTestLevel] = useState(1);
  const [testPoints, setTestPoints] = useState(0);

  const handleLevelChange = (e) => {
    const level = parseInt(e.target.value) || 1;
    setTestLevel(level);
    // Calculate points for this level
    const levelInfo = getLevelInfo(0);
    // This is a simplified calculation - in reality, we'd need to find the minXP for this level
    setTestPoints(level * 1000);
  };

  const handlePointsChange = (e) => {
    const points = parseInt(e.target.value) || 0;
    setTestPoints(points);
    const levelInfo = getLevelInfo(points);
    setTestLevel(levelInfo.level);
  };

  if (!unlockSystem) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading unlock system...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold text-brand-blue mb-6">🧪 Test Unlock System</h1>

        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Test Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Level: {testLevel}
              </label>
              <input
                type="range"
                min="1"
                max="40"
                value={testLevel}
                onChange={handleLevelChange}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Points: {testPoints.toLocaleString()}
              </label>
              <input
                type="range"
                min="0"
                max="1000000"
                step="1000"
                value={testPoints}
                onChange={handlePointsChange}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setTestLevel(1);
                setTestPoints(0);
              }}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Reset to Level 1
            </button>
            <button
              onClick={() => {
                setTestLevel(5);
                setTestPoints(10000);
              }}
              className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition"
            >
              Set to Level 5
            </button>
            <button
              onClick={() => {
                setTestLevel(10);
                setTestPoints(100000);
              }}
              className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition"
            >
              Set to Level 10
            </button>
            <button
              onClick={() => {
                setTestLevel(40);
                setTestPoints(1000000);
              }}
              className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition"
            >
              Set to Level 40
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Unlock Status</h2>
          <p className="text-sm text-gray-500 mb-4">
            Current test level: <span className="font-bold text-brand-blue">{testLevel}</span>
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'lessons',
              'quiz',
              'dailyChallenge',
              'flashcards',
              'podcasts',
              'bossBattle',
              'discussionForum',
              'mockCBT',
              'aiMentor',
            ].map((featureId) => {
              const isUnlocked = unlockSystem.isUnlocked(featureId);
              const requiredLevel = unlockSystem.getRequiredLevel(featureId);
              const feature = unlockSystem.getAllFeatures()[featureId];
              
              return (
                <div
                  key={featureId}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isUnlocked 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{feature?.icon}</span>
                    <span className={`font-bold ${
                      isUnlocked ? 'text-green-700' : 'text-gray-400'
                    }`}>
                      {feature?.name}
                    </span>
                  </div>
                  <div className="text-xs">
                    {isUnlocked ? (
                      <span className="text-green-600">✅ Unlocked</span>
                    ) : (
                      <span className="text-gray-500">
                        🔒 Locked (Level {requiredLevel})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Locked Feature Demo</h2>
          <p className="text-sm text-gray-500 mb-4">
            Try clicking on locked features below to see the tooltip
          </p>
          
          <div className="flex flex-wrap gap-4">
            <LockedFeature featureId="flashcards" userLevel={testLevel}>
              <Link
                href="/flashcards"
                className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition inline-block"
              >
                Flashcards
              </Link>
            </LockedFeature>
            
            <LockedFeature featureId="podcasts" userLevel={testLevel}>
              <Link
                href="/podcasts"
                className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition inline-block"
              >
                Podcasts
              </Link>
            </LockedFeature>
            
            <LockedFeature featureId="bossBattle" userLevel={testLevel}>
              <Link
                href="/boss-battles"
                className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition inline-block"
              >
                Boss Battle
              </Link>
            </LockedFeature>
            
            <LockedFeature featureId="aiMentor" userLevel={testLevel}>
              <Link
                href="/ai-mentor"
                className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition inline-block"
              >
                AI Mentor
              </Link>
            </LockedFeature>
          </div>
        </div>

        <FeatureUnlockSection />

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">System Info</h2>
          <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify({
              userLevel: unlockSystem.userLevel,
              userPoints: unlockSystem.userPoints,
              unlockedFeatures: unlockSystem.unlockedFeatures,
              lockedFeatures: unlockSystem.lockedFeatures.map(f => f.featureId),
            }, null, 2)}
          </pre>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-brand-blue text-white rounded-full font-bold hover:opacity-90 transition"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
