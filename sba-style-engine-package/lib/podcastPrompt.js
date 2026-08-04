import { parseJsonFromText } from '@/lib/robustJsonParse';
import { getPodcastStyle, DEFAULT_PODCAST_STYLE } from '@/lib/podcastStyles';

// `style` replaces the old `format` param, which was accepted but never
// actually used to change the prompt — every episode silently got the
// Q&A conversation prompt regardless of what was passed in. Old callers
// still passing `format: 'teacher_examiner'` keep working: that value
// just isn't a real style id, so it falls through to the default
// (qa_conversation) via getPodcastStyle's fallback, which is exactly
// the old always-Q&A behavior.
export function buildPodcastPrompt(post, style = DEFAULT_PODCAST_STYLE) {
  const { title, content } = post;
  const styleConfig = getPodcastStyle(style);
  return styleConfig.buildPrompt({ title, content });
}

export function parseScriptJson(text) {
  try {
    return parseJsonFromText(text, 'array');
  } catch (e) {
    console.error('JSON parse error:', e.message);
    return null;
  }
}

export function isValidScript(script) {
  return (
    Array.isArray(script) &&
    script.length >= 10 &&
    script.every(
      (line) =>
        line &&
        typeof line.speaker === 'string' &&
        typeof line.text === 'string' &&
        ['host_a', 'host_b'].includes(line.speaker)
    )
  );
}
