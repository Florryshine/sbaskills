// lib/pdf/parseMarkdown.js
// Minimal markdown → block parser for study notes.
// Handles: ## / ### headings, bullet lists, | table | rows |, **bold**, plain paragraphs, images.

export function parseMarkdownToBlocks(markdown) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

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
      blocks.push({ type: 'image', alt: imageMatch[1], url: imageMatch[2] });
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
           !/!\[.*?\]\(.*?\)/.test(lines[i].trim())   // stop if next is an image
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