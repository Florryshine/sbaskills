'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints } from '@/lib/gamification';

export default function ShareButtons({ 
  title, 
  url, 
  targetType, 
  targetId,
  description = '' 
}) {
  const [sharing, setSharing] = useState(false);
  const [user, setUser] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
  }, []);

  const getShareUrl = (platform) => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sbaskills.vercel.app';
    const shareUrl = `${baseUrl}${url}`;
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedDesc = encodeURIComponent(description);

    switch (platform) {
      case 'whatsapp':
        return `https://wa.me/?text=${encodedTitle}%0A${encodedDesc}%0A${encodedUrl}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
      case 'copy':
        return shareUrl;
      default:
        return shareUrl;
    }
  };

  const handleShare = async (platform) => {
    const shareUrl = getShareUrl(platform);
    
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('✅ Link copied to clipboard! Share it with your friends.');
      } catch (err) {
        prompt('Copy this link:', shareUrl);
      }
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
    }

    // Track share and award points (only if logged in and first time sharing this item)
    if (user) {
      await trackShare(platform);
    }
  };

  const trackShare = async (platform) => {
    try {
      // Check if already shared this item on this platform
      const { data: existing } = await supabase
        .from('shares')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('platform', platform)
        .maybeSingle();

      if (!existing) {
        // Log the share
        await supabase
          .from('shares')
          .insert({
            user_id: user.id,
            target_type: targetType,
            target_id: targetId,
            platform: platform
          });

        // Award points for first share of this item
        await addPoints(user.id, 10, `Shared ${targetType} on ${platform}`, 'share', targetId);
      }
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const platforms = [
    { id: 'whatsapp', icon: '💬', label: 'WhatsApp', color: 'bg-green-500' },
    { id: 'facebook', icon: '👍', label: 'Facebook', color: 'bg-blue-600' },
    { id: 'telegram', icon: '✈️', label: 'Telegram', color: 'bg-blue-400' },
    { id: 'twitter', icon: '🐦', label: 'Twitter', color: 'bg-black' },
    { id: 'copy', icon: '📋', label: 'Copy Link', color: 'bg-gray-600' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <span className="text-sm font-bold text-gray-600 mr-2">📤 Share:</span>
      {platforms.map((platform) => (
        <button
          key={platform.id}
          onClick={() => handleShare(platform.id)}
          disabled={sharing}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-xs font-bold hover:opacity-80 transition ${platform.color}`}
        >
          <span>{platform.icon}</span>
          <span className="hidden sm:inline">{platform.label}</span>
        </button>
      ))}
    </div>
  );
}