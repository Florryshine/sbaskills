'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { DEFAULT_UNLOCK_LEVELS, FEATURE_METADATA } from '@/lib/featureUnlocks';

export default function FeatureUnlocksAdmin() {
  const [unlockLevels, setUnlockLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadUnlockLevels();
  }, []);

  const loadUnlockLevels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('feature_unlock_levels')
        .select('*')
        .order('unlock_level', { ascending: true });
      
      if (error) throw error;
      
      // Merge with defaults to ensure all features are represented
      const allFeatures = Object.entries(FEATURE_METADATA).map(([featureId, metadata]) => ({
        feature_id: featureId,
        feature_name: metadata.name,
        description: metadata.description,
        unlock_level: DEFAULT_UNLOCK_LEVELS[featureId] || 1,
        is_active: true,
      }));
      
      // Merge with database data
      const merged = allFeatures.map(defaultFeature => {
        const dbFeature = data?.find(f => f.feature_id === defaultFeature.feature_id);
        return dbFeature || defaultFeature;
      });
      
      setUnlockLevels(merged);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLevelChange = (featureId, newLevel) => {
    setUnlockLevels(prev => 
      prev.map(f => 
        f.feature_id === featureId 
          ? { ...f, unlock_level: Math.max(1, parseInt(newLevel) || 1) }
          : f
      )
    );
  };

  const handleToggleActive = (featureId) => {
    setUnlockLevels(prev => 
      prev.map(f => 
        f.feature_id === featureId 
          ? { ...f, is_active: !f.is_active }
          : f
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Upsert all features
      const { error } = await supabase
        .from('feature_unlock_levels')
        .upsert(unlockLevels.map(f => ({
          feature_id: f.feature_id,
          feature_name: f.feature_name,
          description: f.description,
          unlock_level: f.unlock_level,
          is_active: f.is_active,
        })), {
          onConflict: 'feature_id',
        });
      
      if (error) throw error;
      
      setSuccess('✅ Unlock levels saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setUnlockLevels(
      Object.entries(FEATURE_METADATA).map(([featureId, metadata]) => ({
        feature_id: featureId,
        feature_name: metadata.name,
        description: metadata.description,
        unlock_level: DEFAULT_UNLOCK_LEVELS[featureId] || 1,
        is_active: true,
      }))
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Loading unlock levels...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">⭐ Feature Unlock Levels</h1>
          <p className="text-gray-500 mt-1">
            Configure at which level each feature becomes available to students
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetToDefaults}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Feature</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unlock Level</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {unlockLevels.map((feature) => (
              <tr key={feature.feature_id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{FEATURE_METADATA[feature.feature_id]?.icon || '🔧'}</span>
                    <span className="font-bold text-gray-800">{feature.feature_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={feature.unlock_level}
                    onChange={(e) => handleLevelChange(feature.feature_id, e.target.value)}
                    min="1"
                    max="100"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleActive(feature.feature_id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${feature.is_active 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                  >
                    {feature.is_active ? '✅ Active' : '❌ Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-brand-blue mb-2">💡 Tips:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Features with lower unlock levels appear first to new students</li>
          <li>• Set a feature to inactive to hide it completely (even from unlocked users)</li>
          <li>• Changes take effect immediately for all students</li>
          <li>• Students will see animated notifications when features unlock</li>
        </ul>
      </div>
    </div>
  );
}
