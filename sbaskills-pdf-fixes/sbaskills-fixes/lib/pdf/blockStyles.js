// lib/pdf/blockStyles.js
// Shared base styles for markdown-block rendering, used by both
// StudyNoteDocument and BookDocument so the two renderers can't drift
// out of sync again. Theme-aware: pass a theme object from themes.js.

import { StyleSheet } from '@react-pdf/renderer';

export function buildBlockStyles(theme) {
  return StyleSheet.create({
    h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: theme.primary, marginTop: 14, marginBottom: 8 },
    h2: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: theme.primary, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.accent, paddingBottom: 3 },
    h3: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: theme.textColor || '#1a1a1a', marginTop: 8, marginBottom: 4 },
    hr: { borderBottomWidth: 1, borderBottomColor: theme.accent || '#ccc', marginVertical: 12 },
    p: { marginBottom: 6, lineHeight: 1.5, color: theme.textColor || '#1a1a1a' },
    bold: { fontFamily: 'Helvetica-Bold' },
    listItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
    bullet: { width: 12, color: theme.accent, fontFamily: 'Helvetica-Bold' },
    listText: { flex: 1, lineHeight: 1.4, color: theme.textColor || '#1a1a1a' },
    table: { marginBottom: 10, borderWidth: 1, borderColor: '#ccc' },
    tableRow: { flexDirection: 'row' },
    tableCellHeader: { flex: 1, backgroundColor: theme.primary, color: '#fff', fontSize: 9.5, fontFamily: 'Helvetica-Bold', padding: 5, borderRightWidth: 1, borderRightColor: '#fff' },
    tableCell: { flex: 1, fontSize: 9.5, padding: 5, borderRightWidth: 1, borderRightColor: '#ccc', borderTopWidth: 1, borderTopColor: '#ccc' },
  });
}
