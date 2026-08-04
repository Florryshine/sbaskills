'use client';

import { useUnlockSystem } from '@/context/UnlockSystemContext';
import FeatureUnlockedNotification from './FeatureUnlockedNotification';

export default function NotificationContainer() {
  const { notifications, dismissNotification } = useUnlockSystem();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.map((notification) => (
        <FeatureUnlockedNotification
          key={notification.id}
          featureId={notification.featureId}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}
    </div>
  );
}
