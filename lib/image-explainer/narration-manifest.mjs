const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function buildNarrationManifest({ scenes, clips, voicePreset, language = 'English' }) {
  if (!Array.isArray(scenes) || !Array.isArray(clips) || scenes.length === 0 || scenes.length !== clips.length) {
    throw new Error('Narration must contain exactly one completed audio clip for every script scene.');
  }
  const normalized = clips.map((clip, index) => {
    const duration = Number(clip.duration);
    if (!clip.path || !Number.isFinite(duration) || duration <= 0 || !Array.isArray(clip.words)) {
      throw new Error(`Narration clip ${index + 1} is missing a valid storage path, measured duration or word timings.`);
    }
    const words = clip.words.map((word) => ({
      word: clean(word.word, 120),
      start: Math.max(0, Number(word.start) || 0),
      end: Math.max(0, Number(word.end) || 0),
    })).filter((word) => word.word && word.end > word.start && word.start < duration)
      .map((word) => ({ ...word, end: Math.min(duration, word.end) }));
    if (!words.length) throw new Error(`Narration clip ${index + 1} has no usable word timing data.`);
    return {
      scene_index: index,
      scene_id: clean(scenes[index].id, 80) || `scene-${index + 1}`,
      storage_path: clean(clip.path, 500),
      mime_type: clip.ext === 'wav' ? 'audio/wav' : 'audio/mpeg',
      duration_seconds: Math.round(duration * 1000) / 1000,
      provider: clean(clip.provider, 40),
      voice: clean(clip.voice, 100),
      words,
    };
  });
  return {
    version: 1,
    voice_preset: clean(voicePreset, 80),
    language: clean(language, 40) || 'English',
    clip_count: normalized.length,
    total_duration_seconds: Math.round(normalized.reduce((sum, clip) => sum + clip.duration_seconds, 0) * 1000) / 1000,
    alignment: 'provider_word_boundaries_or_proportional_measured_duration',
    review_status: 'needs_admin_review',
    generated_at: new Date().toISOString(),
    clips: normalized,
  };
}

export function validateNarrationManifest(manifest, sceneCount) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.clips) || manifest.clips.length !== sceneCount) return false;
  return manifest.clips.every((clip, index) =>
    clip.scene_index === index && typeof clip.storage_path === 'string' && clip.storage_path.length > 0 &&
    Number.isFinite(clip.duration_seconds) && clip.duration_seconds > 0 &&
    Array.isArray(clip.words) && clip.words.length > 0 &&
    clip.words.every((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= 0 && word.end > word.start && word.end <= clip.duration_seconds + 0.05)
  );
}
