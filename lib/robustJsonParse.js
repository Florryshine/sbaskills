// lib/robustJsonParse.js
//
// Shared JSON parser for AI-generated text (Gemini/Groq/OpenRouter/HuggingFace).
//
// THE BUG THIS FIXES:
// Every engine route used to do `text.match(/\{[\s\S]*\}/)` and then a raw
// `JSON.parse()` on the result. That works fine when every string value is a
// single line — but the moment the model returns a multi-sentence paragraph
// inside a JSON string (very common for "explanation", "content", "summary"
// fields), the AI's raw text often contains a literal newline character
// inside that string. Per the JSON spec, a literal newline inside a string
// is NOT valid — it must be escaped as \n. JSON.parse throws on it, the
// route's try/catch treats it as a provider failure, and the code moves on
// to the next provider — even though the model answered correctly. With
// enough multi-line fields, ALL providers "fail" and you get the generic
// "All providers failed" error.
//
// The old `sanitizeJsonString()` helper made this worse: it stripped control
// characters EXCEPT \n and \t — i.e. it explicitly preserved the very
// characters that break parsing.
//
// THE FIX:
// Walk the extracted JSON text character by character. Track whether we're
// currently inside a string literal (respecting backslash-escaped quotes).
// Any raw newline/carriage-return/tab found *inside* a string gets escaped
// to \n / \r / \t. Structural whitespace outside strings is left untouched.

/**
 * Escape unescaped control characters (newline, carriage return, tab) that
 * appear inside JSON string literals, without touching structural
 * whitespace outside strings.
 */
function escapeControlCharsInStrings(jsonLike) {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonLike.length; i++) {
    const ch = jsonLike[i];

    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      // strip other stray control chars that are never valid raw inside a
      // JSON string (but keep everything else, including unicode text)
      if (ch.charCodeAt(0) <= 0x1f) {
        continue;
      }
      out += ch;
      continue;
    }

    // not currently inside a string
    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }

  return out;
}

/** Best-effort repair for common trailing-comma mistakes models make. */
function stripTrailingCommas(jsonLike) {
  return jsonLike.replace(/,\s*([\]}])/g, '$1');
}

/**
 * Extract a JSON object or array from raw model output and parse it,
 * repairing the common "literal newline inside a string" issue first.
 *
 * @param {string} text raw text returned by the model
 * @param {'object'|'array'} shape whether to look for a {...} or [...] block
 * @returns {any|null} parsed JSON, or null if no candidate block was found
 * @throws if a candidate block was found but is not valid JSON even after repair
 */
function parseJsonFromText(text, shape = 'object') {
  if (!text) return null;

  const cleaned = text.replace(/```json|```/g, '').trim();
  const pattern = shape === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = cleaned.match(pattern);
  if (!match) return null;

  const repaired = escapeControlCharsInStrings(match[0]);

  try {
    return JSON.parse(repaired);
  } catch (firstError) {
    // one more pass: some models also leave trailing commas
    try {
      return JSON.parse(stripTrailingCommas(repaired));
    } catch (secondError) {
      // surface the original error — it's the more informative one
      throw firstError;
    }
  }
}

export { parseJsonFromText, escapeControlCharsInStrings };
