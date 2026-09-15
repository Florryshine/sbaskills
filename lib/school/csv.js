export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
      else current += char;
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
}
export function rowsToCsv(headers, rows) {
  const head = headers.join(',');
  const body = rows.map(row => headers.map(h => {
    const val = String(row[h] || '').replace(/"/g, '""');
    return val.includes(',') || val.includes('"') ? `"${val}"` : val;
  }).join(',')).join('\n');
  return head + '\n' + body;
}
