// lib/pdf/parseMarkdown.js
// Minimal markdown → block parser for study notes.
// Handles: ## / ### headings, bullet lists, | table | rows |, **bold**,
// plain paragraphs, images, ":::type ... :::" callout/checklist blocks,
// and bare YouTube links (auto-converted into video cards).

const YOUTUBE_URL_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|youtube\.com\/shorts\/[\w-]+)(\S*)$/i;

export function parseMarkdownToBlocks(markdown) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // ── Fenced blocks: :::type ... ::: ─────────────────────
    // :::checklist renders as tickable boxes; every other :::name
    // (summary, tip, warning, memory, challenge, exercise, takeaway,
    // further, or any custom name) renders as a styled callout box.
    const fenceMatch = line.trim().match(/^:::([a-zA-Z0-9_-]+)\s*$/);
    if (fenceMatch) {
      const variant = fenceMatch[1].toLowerCase();
      i++;
      const inner = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i]);
        i++;
      }
      i++; // skip closing :::

      if (variant === 'checklist') {
        const items = inner
          .map(l => l.trim())
          .filter(l => /^[-*]\s+/.test(l))
          .map(l => l.replace(/^[-*]\s+/, ''));
        blocks.push({ type: 'checklist', items });
      } else {
        blocks.push({ type: 'callout', variant, text: inner.join('\n').trim() });
      }
      continue;
    }

    // ── Bare YouTube link on its own line ─────────────────
    if (YOUTUBE_URL_RE.test(line.trim())) {
      blocks.push({ type: 'youtube', url: line.trim() });
      i++;
      continue;
    }

    // ── Horizontal rule / divider (---, ***, ___ on its own line) ──
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // ── Headings ────────────────────────────────────────────
    if (/^###\s+/.test(line)) {
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '').trim() });
      i++; continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '').trim() });
      i++; continue;
    }
    if (/^#\s+/.test(line)) {
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '').trim() });
      i++; continue;
    }

    // ── Table ──────────────────────────────────────────────
    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        .filter(cells => !cells.every(c => /^:?-+:?$/.test(c)));
      blocks.push({ type: 'table', rows });
      continue;
    }

    // ── Bullet list ────────────────────────────────────────
    if (/^[-*]\s+/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // ── Image ──────────────────────────────────────────────
    const imageMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const alt = imageMatch[1];
      const url = imageMatch[2];
      // Only add block if URL is not empty
      if (url && url.trim()) {
        blocks.push({ type: 'image', alt, url: url.trim() });
      } else {
        // If URL is empty, treat as plain text (e.g., "![]( )")
        blocks.push({ type: 'p', text: line.trim() });
      }
      i++;
      continue;
    }

    // ── Paragraph (consume consecutive lines) ─────────────
    const paraLines = [];
    while (i < lines.length && 
           lines[i].trim() && 
           !/^#{1,3}\s+/.test(lines[i]) && 
           !lines[i].trim().startsWith('|') && 
           !/^[-*]\s+/.test(lines[i].trim()) &&
           !/!\[.*?\]\(.*?\)/.test(lines[i].trim()) &&  // stop if next is an image
           !/^:::[a-zA-Z0-9_-]+\s*$/.test(lines[i].trim()) &&  // stop if next is a fenced block
           !YOUTUBE_URL_RE.test(lines[i].trim()) &&   // stop if next is a bare YouTube link
           !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())   // stop if next is a divider
          ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: paraLines.join(' ') });
  }

  return blocks;
}

export function splitBold(text) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false });
  return parts.length ? parts : [{ text, bold: false }];
}