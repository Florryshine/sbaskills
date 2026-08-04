// lib/featureUnlocks.js
// XP Unlock System Configuration
// Features unlock as students gain XP and level up

/**
 * Default unlock levels for features
 * These can be overridden by admin configuration in the database
 */
export const DEFAULT_UNLOCK_LEVELS = {
  // Level 1 - Always available
  lessons: 1,
  quiz: 1,
  dailyChallenge: 1,
  
  // Level 5
  flashcards: 5,
  
  // Level 10
  podcasts: 10,
  
  // Level 15
  bossBattle: 15,
  
  // Level 20
  discussionForum: 20,
  
  // Level 30
  mockCBT: 30,
  
  // Level 40
  aiMentor: 40,
};

/**
 * Feature metadata for display purposes
 */
export const FEATURE_METADATA = {
  lessons: {
    name: 'Lessons',
    description: 'Access course lessons and study materials',
    icon: '📚',
    route: '/courses',
  },
  quiz: {
    name: 'Quiz',
    description: 'Take quizzes to test your knowledge',
    icon: '📝',
    route: '/quizzes',
  },
  dailyChallenge: {
    name: 'Daily Challenge',
    description: 'Complete daily challenges for bonus XP',
    icon: '🎯',
    route: '/challenge',
  },
  flashcards: {
    name: 'Flashcards',
    description: 'Study with interactive flashcards',
    icon: '📇',
    route: '/flashcards',
  },
  podcasts: {
    name: 'Podcasts',
    description: 'Listen to educational podcasts',
    icon: '🎙️',
    route: '/podcasts',
  },
  bossBattle: {
    name: 'Boss Battle',
    description: 'Challenge AI bosses to test your skills',
    icon: '🎮',
    route: '/boss-battles',
  },
  discussionForum: {
    name: 'Discussion Forum',
    description: 'Join discussions with other students',
    icon: '💬',
    route: '/forum',
  },
  mockCBT: {
    name: 'Mock CBT',
    description: 'Practice with computer-based test simulations',
    icon: '💻',
    route: '/mock-cbt',
  },
  aiMentor: {
    name: 'AI Mentor',
    description: 'Get personalized guidance from AI mentors',
    icon: '🤖',
    route: '/ai-mentor',
  },
};

/**
 * Get unlock level for a feature
 * @param {string} featureId - The feature identifier
 * @param {Object} customLevels - Optional custom levels from database
 * @returns {number} - The level required to unlock the feature
 */
export function getUnlockLevel(featureId, customLevels = {}) {
  return customLevels[featureId] || DEFAULT_UNLOCK_LEVELS[featureId] || 1;
}

/**
 * Check if a feature is unlocked for a user
 * @param {string} featureId - The feature identifier
 * @param {number} userLevel - The user's current level
 * @param {Object} customLevels - Optional custom levels from database
 * @returns {boolean} - Whether the feature is unlocked
 */
export function isFeatureUnlocked(featureId, userLevel, customLevels = {}) {
  const requiredLevel = getUnlockLevel(featureId, customLevels);
  return userLevel >= requiredLevel;
}

/**
 * Get the required level to unlock a feature
 * @param {string} featureId - The feature identifier
 * @param {Object} customLevels - Optional custom levels from database
 * @returns {number} - The required level
 */
export function getRequiredLevel(featureId, customLevels = {}) {
  return getUnlockLevel(featureId, customLevels);
}

/**
 * Get all features that should be unlocked at a given level
 * @param {number} userLevel - The user's current level
 * @param {Object} customLevels - Optional custom levels from database
 * @returns {Array} - Array of unlocked feature IDs
 */
export function getUnlockedFeatures(userLevel, customLevels = {}) {
  return Object.keys(FEATURE_METADATA).filter(featureId =>
    isFeatureUnlocked(featureId, userLevel, customLevels)
  );
}

/**
 * Get all locked features for a user
 * @param {number} userLevel - The user's current level
 * @param {Object} customLevels - Optional custom levels from database
 * @returns {Array} - Array of locked feature IDs with their required levels
 */
export function getLockedFeatures(userLevel, customLevels = {}) {
  return Object.entries(FEATURE_METADATA)
    .filter(([featureId]) => !isFeatureUnlocked(featureId, userLevel, customLevels))
    .map(([featureId, metadata]) => ({
      featureId,
      ...metadata,
      requiredLevel: getUnlockLevel(featureId, customLevels),
    }));
}

/**
 * Check which features were just unlocked when leveling up
 * @param {number} oldLevel - The previous level
 * @param {number} newLevel - The new level
 * @param {Object} customLevels - Optional custom levels from database
 * @returns {Array} - Array of newly unlocked feature IDs
 */
export function getNewlyUnlockedFeatures(oldLevel, newLevel, customLevels = {}) {
  const oldUnlocked = getUnlockedFeatures(oldLevel, customLevels);
  const newUnlocked = getUnlockedFeatures(newLevel, customLevels);
  return newUnlocked.filter(featureId => !oldUnlocked.includes(featureId));
}

/**
 * Get feature by ID
 * @param {string} featureId - The feature identifier
 * @returns {Object|null} - Feature metadata or null
 */
export function getFeatureById(featureId) {
  return FEATURE_METADATA[featureId] || null;
}

/**
 * Get all features
 * @returns {Object} - All feature metadata
 */
export function getAllFeatures() {
  return FEATURE_METADATA;
}
