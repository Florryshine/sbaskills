'use client';

import { useState } from 'react';
import { Overview } from '@/components/admin/social/Overview';
import { AICampaignCreator } from '@/components/admin/social/AICampaignCreator';
import { CampaignPlanner } from '@/components/admin/social/CampaignPlanner';
import { QueueManager } from '@/components/admin/social/QueueManager';
import { ChannelManager } from '@/components/admin/social/ChannelManager';

export default function SocialDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', component: Overview },
    { id: 'creator', label: 'AI Creator', component: AICampaignCreator },
    { id: 'planner', label: 'Planner', component: CampaignPlanner },
    { id: 'queue', label: 'Queue', component: QueueManager },
    { id: 'channels', label: 'Channels', component: ChannelManager },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || Overview;

  return (
    <div className="p-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        <ActiveComponent />
      </div>
    </div>
  );
}
