export function parseJsonFromText(text) { try { return JSON.parse(text); } catch (e) { return []; } }
