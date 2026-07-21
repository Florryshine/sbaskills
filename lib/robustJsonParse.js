// lib/robustJsonParse.js
//
// Turns raw LLM text output into parsed JSON. Models routinely wrap JSON
// in ```json fences, add a sentence before/after it, use smart quotes,
// or leave a trailing comma — a bare JSON.parse() fails on all of these
// and silently returning [] on failure (the old behavior) is why quiz,
// flashcards, boss-battle, blog, study-notes, and visual-blueprint were
// failing "All providers failed" even when the model generated good
// content. This does progressively more aggressive cleanup until one
// attempt parses, and only gives up after all of them fail.
//
// `expect` is 'object' or 'array' — used to pick the right {}/[] pair
// when extracting the JSON blob out of surrounding prose, and to decide
// what a "no valid JSON found" fallback should look like.

function stripCodeFences(text) {
  // Strip ```json ... ``` or ``` ... ``` fences, keeping the inner content.
  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

function extractBalancedBlock(text, openChar, closeChar) {
  const start = text.indexOf(openChar);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function removeTrailingCommas(text) {
  return text.replace(/,(\s*[\]}])/g, '$1');
}

function normalizeSmartQuotes(text) {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function removeControlChars(text) {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function parseJsonFromText(text, expect = 'object') {
  if (text === null || text === undefined) return null;
  const raw = String(text);
  const fallback = expect === 'array' ? [] : null;

  const candidates = [];

  // 1. Try the raw text as-is.
  candidates.push(raw);

  // 2. Strip markdown code fences.
  const unfenced = stripCodeFences(raw);
  candidates.push(unfenced);

  // 3. Extract the outermost balanced {...} or [...] block from the
  //    unfenced text (handles leading/trailing prose around the JSON).
  const openChar = expect === 'array' ? '[' : '{';
  const closeChar = expect === 'array' ? ']' : '}';
  const extracted = extractBalancedBlock(unfenced, openChar, closeChar);
  if (extracted) candidates.push(extracted);

  // 4. Same extraction, but also try the other bracket type in case the
  //    caller's `expect` was wrong (e.g. model returned an array when an
  //    object was expected).
  const otherOpen = openChar === '{' ? '[' : '{';
  const otherClose = openChar === '{' ? ']' : '}';
  const extractedOther = extractBalancedBlock(unfenced, otherOpen, otherClose);
  if (extractedOther) candidates.push(extractedOther);

  // Try each candidate as-is, then with progressively more cleanup applied.
  for (const candidate of candidates) {
    const attempts = [
      candidate,
      normalizeSmartQuotes(candidate),
      removeControlChars(normalizeSmartQuotes(candidate)),
      removeTrailingCommas(removeControlChars(normalizeSmartQuotes(candidate))),
    ];
    for (const attempt of attempts) {
      try {
        const parsed = JSON.parse(attempt);
        if (parsed !== null && parsed !== undefined) return parsed;
      } catch (e) {
        // try next attempt
      }
    }
  }

  return fallback;
}
