'use client';

import { useState } from 'react';
import { getUnlockLevel, getFeatureById } from '@/lib/featureUnlocks';

export default function LockedFeature({
  featureId,
  userLevel,
  customLevels = {},
  children,
  showTooltip = true,
  className = '',
}) {
  const feature = getFeatureById(featureId);
  const requiredLevel = getUnlockLevel(featureId, customLevels);
  const isUnlocked = userLevel >= requiredLevel;
  const [showHint, setShowHint] = useState(false);

  if (!feature) {
    return <>{children}</>;
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  const handleClick = (e) => {
    if (showTooltip) {
      e.preventDefault();
      e.stopPropagation();
      setShowHint(true);
      setTimeout(() => setShowHint(false), 3000);
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onClick={handleClick}
    >
      {/* Locked state - greyed out */}
      <div className="opacity-40 grayscale cursor-not-allowed pointer-events-none">
        {children}
      </div>
      
      {/* Lock icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
          <span className="text-white text-xl">🔒</span>
        </div>
      </div>
      
      {/* Tooltip/hint */}
      {showHint && showTooltip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50">
          <div className="bg-brand-blue text-white px-4 py-2 rounded-xl shadow-lg text-sm whitespace-nowrap animate-fade-in">
            <div className="flex items-center gap-2">
              <span>{feature.icon}</span>
              <div>
                <p className="font-bold">{feature.name}</p>
                <p className="text-xs opacity-80">Reach Level {requiredLevel} to unlock</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-blue transform rotate-45 -mb-1"></div>
          </div>
        </div>
      )}
      
      {/* Persistent lock message */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
        Level {requiredLevel} required
      </div>
    </div>
  );
}
