'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { 
  getUnlockedFeatures, 
  getLockedFeatures, 
  getNewlyUnlockedFeatures,
  DEFAULT_UNLOCK_LEVELS,
  getAllFeatures,
  getRequiredLevel,
  isFeatureUnlocked as checkIsFeatureUnlocked
} from '@/lib/featureUnlocks';
import { getLevelInfo } from '@/lib/levels';

/**
 * Custom hook for managing feature unlocks
 * Integrates with the existing XP and level system
 */
export function useFeatureUnlocks(userId) {
  const [userLevel, setUserLevel] = useState(1);
  const [userPoints, setUserPoints] = useState(0);
  const [unlockedFeatures, setUnlockedFeatures] = useState([]);
  const [lockedFeatures, setLockedFeatures] = useState([]);
  const [customLevels, setCustomLevels] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createBrowserClient();

  // Load custom unlock levels from database
  const loadCustomLevels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('feature_unlock_levels')
        .select('feature_id, unlock_level')
        .eq('is_active', true);
      
      if (!error && data) {
        const levels = {};
        data.forEach(row => {
          levels[row.feature_id] = row.unlock_level;
        });
        setCustomLevels(levels);
      }
    } catch (e) {
      console.log('No custom unlock levels table found, using defaults');
    }
  }, [supabase]);

  // Load user data
  const loadUserData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      // Get user points
      const { data: pointsData } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', userId)
        .single();
      
      const totalPoints = pointsData?.total_points || 0;
      setUserPoints(totalPoints);
      
      // Calculate level
      const levelInfo = getLevelInfo(totalPoints);
      const newLevel = levelInfo.level;
      setUserLevel(newLevel);
      
      // Update unlocked features
      updateUnlockState(newLevel);
      
      setLoading(false);
    } catch (e) {
      console.error('Error loading user data:', e);
      setLoading(false);
    }
  }, [userId, supabase, updateUnlockState]);

  // Update unlock state based on level
  const updateUnlockState = useCallback((level) => {
    const unlocked = getUnlockedFeatures(level, customLevels);
    const locked = getLockedFeatures(level, customLevels);
    setUnlockedFeatures(unlocked);
    setLockedFeatures(locked);
  }, [customLevels]);

  // Check for newly unlocked features when leveling up
  const checkForNewUnlocks = useCallback((oldLevel, newLevel) => {
    const newlyUnlocked = getNewlyUnlockedFeatures(oldLevel, newLevel, customLevels);
    
    if (newlyUnlocked.length > 0) {
      // Show notifications for each newly unlocked feature
      newlyUnlocked.forEach(featureId => {
        const notificationId = Date.now() + Math.random();
        setNotifications(prev => [...prev, { 
          id: notificationId, 
          featureId,
          createdAt: Date.now()
        }]);
      });
    }
    
    // Update unlock state
    updateUnlockState(newLevel);
  }, [customLevels, updateUnlockState]);

  // Handle level up (called from gamification system)
  const handleLevelUp = useCallback((newPoints) => {
    const oldLevel = userLevel;
    const levelInfo = getLevelInfo(newPoints);
    const newLevel = levelInfo.level;
    
    if (newLevel > oldLevel) {
      setUserPoints(newPoints);
      setUserLevel(newLevel);
      checkForNewUnlocks(oldLevel, newLevel);
    }
  }, [userLevel, checkForNewUnlocks]);

  // Dismiss a notification
  const dismissNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Check if a specific feature is unlocked
  const isFeatureUnlocked = useCallback((featureId) => {
    return checkIsFeatureUnlocked(featureId, userLevel, customLevels);
  }, [userLevel, customLevels]);

  // Get required level for a feature
  const getFeatureRequiredLevel = useCallback((featureId) => {
    return getRequiredLevel(featureId, customLevels);
  }, [customLevels]);

  // Refresh user data
  const refresh = useCallback(async () => {
    await loadUserData();
  }, [loadUserData]);

  // Load initial data
  useEffect(() => {
    loadCustomLevels();
    loadUserData();
  }, [loadCustomLevels, loadUserData]);

  // Update unlock state when custom levels change
  useEffect(() => {
    if (userLevel > 0) {
      updateUnlockState(userLevel);
    }
  }, [customLevels, userLevel, updateUnlockState]);

  return {
    userLevel,
    userPoints,
    unlockedFeatures,
    lockedFeatures,
    notifications,
    loading,
    isFeatureUnlocked,
    getFeatureRequiredLevel,
    handleLevelUp,
    dismissNotification,
    refresh,
    getAllFeatures,
  };
}

export default useFeatureUnlocks;
