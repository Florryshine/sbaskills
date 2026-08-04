# XP Unlock System 🎯

## Overview

The XP Unlock System allows features to be unlocked as students gain XP and level up. This creates curiosity and keeps students engaged by revealing new features progressively.

## Features

- **Progressive Feature Unlocking**: Features become available as students reach specific levels
- **Configurable Unlock Levels**: Admin can modify which level each feature unlocks at
- **Visual Feedback**: Locked features appear greyed out with lock icons
- **Interactive Tooltips**: Clicking locked features shows required level
- **Animated Notifications**: "Feature Unlocked" notifications appear when leveling up
- **Mobile Responsive**: Works on all device sizes
- **No Duplicate Progress**: Uses existing XP and level system

## Default Unlock Levels

| Feature | Unlock Level | Description |
|---------|-------------|-------------|
| Lessons | 1 | Access course lessons and study materials |
| Quiz | 1 | Take quizzes to test your knowledge |
| Daily Challenge | 1 | Complete daily challenges for bonus XP |
| Flashcards | 5 | Study with interactive flashcards |
| Podcasts | 10 | Listen to educational podcasts |
| Boss Battle | 15 | Challenge AI bosses to test your skills |
| Discussion Forum | 20 | Join discussions with other students |
| Mock CBT | 30 | Practice with computer-based test simulations |
| AI Mentor | 40 | Get personalized guidance from AI mentors |

## Implementation

### Files Created

1. **`lib/featureUnlocks.js`** - Core configuration and utility functions
   - `DEFAULT_UNLOCK_LEVELS` - Default unlock levels for each feature
   - `FEATURE_METADATA` - Feature names, descriptions, icons, and routes
   - Utility functions for checking unlock status

2. **`context/UnlockSystemContext.js`** - React context for managing unlock state
   - Tracks user level, points, unlocked/locked features
   - Manages notifications for newly unlocked features
   - Provides hooks for components to check unlock status

3. **`components/FeatureUnlockedNotification.js`** - Animated notification component
   - Shows when a feature is unlocked
   - Auto-dismisses after 5 seconds
   - Includes confetti animation

4. **`components/LockedFeature.js`** - Wrapper for locked features
   - Greys out the feature
   - Shows lock icon overlay
   - Displays tooltip with required level

5. **`components/NotificationContainer.js`** - Container for notifications
   - Renders all active notifications
   - Manages notification lifecycle

6. **`components/FeatureUnlockSection.js`** - Dashboard section showing unlock status
   - Shows unlocked features with green highlight
   - Shows locked features with greyed out appearance
   - Displays progress to next unlock

7. **`app/admin/feature-unlocks/page.js`** - Admin page for managing unlock levels
   - View and edit unlock levels for each feature
   - Toggle features active/inactive
   - Reset to defaults

8. **`supabase/migrations/20260726_feature_unlock_levels.sql`** - Database migration
   - Creates `feature_unlock_levels` table
   - Stores custom unlock configurations
   - Includes RLS policies

9. **`hooks/useFeatureUnlocks.js`** - Custom hook for unlock functionality
   - Alternative to context for simpler use cases

### Files Modified

1. **`app/layout.js`** - Added UnlockSystemProvider and NotificationContainer
2. **`app/(student)/dashboard/page.js`** - Updated to use DashboardWithUnlocks
3. **`app/(student)/dashboard/DashboardWithUnlocks.js`** - New dashboard with unlock integration

### Integration with Existing System

The unlock system integrates seamlessly with the existing XP and level system:

- Uses `getLevelInfo()` from `lib/levels.js` to calculate user level
- Uses existing `user_points.total_points` for XP tracking
- No duplicate progress tracking
- No changes to existing database schema (except optional config table)

## Usage

### For Components

```jsx
'use client';

import { useUnlockSystem } from '@/context/UnlockSystemContext';

function MyComponent() {
  const unlockSystem = useUnlockSystem();
  
  // Check if a feature is unlocked
  const isFlashcardsUnlocked = unlockSystem.isUnlocked('flashcards');
  
  // Get required level for a feature
  const requiredLevel = unlockSystem.getRequiredLevel('flashcards');
  
  // Get user's current level
  const userLevel = unlockSystem.userLevel;
  
  return (
    <div>
      {!isFlashcardsUnlocked ? (
        <p>Reach Level {requiredLevel} to unlock Flashcards</p>
      ) : (
        <Link href="/flashcards">Go to Flashcards</Link>
      )}
    </div>
  );
}
```

### For Navigation

Use the `LockedFeature` component to wrap navigation links:

```jsx
<LockedFeature featureId="flashcards" userLevel={userLevel}>
  <Link href="/flashcards">Flashcards</Link>
</LockedFeature>
```

### For Admin

Admin can modify unlock levels at `/admin/feature-unlocks`:
- Edit unlock levels for each feature
- Toggle features active/inactive
- Reset to default values

## Database Schema

### feature_unlock_levels Table

```sql
CREATE TABLE public.feature_unlock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id text NOT NULL UNIQUE,
  feature_name text NOT NULL,
  unlock_level integer NOT NULL CHECK (unlock_level >= 1),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### RLS Policies

- **Admin**: Full access to manage unlock levels
- **Authenticated users**: Can read active configurations

## Customization

### Changing Default Unlock Levels

Edit `lib/featureUnlocks.js`:

```javascript
export const DEFAULT_UNLOCK_LEVELS = {
  flashcards: 5,  // Change to desired level
  podcasts: 10,
  // ...
};
```

### Adding New Features

1. Add to `DEFAULT_UNLOCK_LEVELS`:
```javascript
export const DEFAULT_UNLOCK_LEVELS = {
  // ... existing features
  newFeature: 25,
};
```

2. Add to `FEATURE_METADATA`:
```javascript
export const FEATURE_METADATA = {
  // ... existing features
  newFeature: {
    name: 'New Feature',
    description: 'Description of the new feature',
    icon: '🎉',
    route: '/new-feature',
  },
};
```

3. Add database entry (optional):
```sql
INSERT INTO feature_unlock_levels (feature_id, feature_name, unlock_level, description)
VALUES ('newFeature', 'New Feature', 25, 'Description of the new feature');
```

## Testing

1. **Verify unlock logic**: Test that features unlock at correct levels
2. **Test notifications**: Level up and verify notifications appear
3. **Test locked state**: Verify locked features show correctly
4. **Test admin interface**: Verify admin can modify unlock levels
5. **Test mobile responsiveness**: Verify works on mobile devices

## Future Enhancements

- [ ] Add unlock progress bar for next feature
- [ ] Add sound effects for unlock notifications
- [ ] Add achievement badges for unlocking features
- [ ] Add feature preview/modal for locked features
- [ ] Add analytics for feature unlock rates
- [ ] Add A/B testing for different unlock levels
