'use client';

import { useEffect, useState } from 'react';
import { getFeatureById } from '@/lib/featureUnlocks';

export default function FeatureUnlockedNotification({ featureId, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const feature = getFeatureById(featureId);

  useEffect(() => {
    // Trigger animation when component mounts
    setIsAnimating(true);
    
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) onDismiss();
    }, 300);
  };

  if (!isVisible || !feature) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="bg-gradient-to-r from-brand-blue to-purple-600 rounded-2xl p-6 shadow-2xl border-2 border-brand-yellow animate-pulse-slow">
        <div className="flex items-center gap-4">
          <div className="text-4xl animate-bounce-slow">{feature.icon}</div>
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-white mb-1">✨ Feature Unlocked!</h3>
            <p className="text-white/90 font-bold text-lg">{feature.name}</p>
            <p className="text-white/70 text-sm">{feature.description}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white transition-colors text-2xl ml-2"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
            NEW!
          </span>
        </div>
      </div>
      
      {/* Confetti effect */}
      <div className="absolute -top-2 -right-2 text-brand-yellow text-2xl animate-confetti">✨</div>
      <div className="absolute -top-2 -left-2 text-brand-yellow text-xl animate-confetti delay-100">✨</div>
      <div className="absolute -bottom-2 right-1/2 text-brand-yellow text-xl animate-confetti delay-200">✨</div>
    </div>
  );
}
