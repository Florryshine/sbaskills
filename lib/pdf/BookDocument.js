// lib/pdf/BookDocument.js
// Generalized version of StudyNoteDocument for the "paste text -> branded
// PDF" flow: takes already-parsed (and YouTube-enriched) blocks instead
// of raw markdown, plus a theme key for the template selector. Adds
// three block types StudyNoteDocument doesn't render: callout,
// checklist, and youtube.
//
// StudyNoteDocument itself is untouched — this is a sibling, not a
// replacement, so the existing AI study-notes pipeline keeps working
// exactly as it did before.

import React from 'react';
import { Document, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { getTheme } from './themes';
import BrandLayout from './BrandLayout';
import { CoverPage, BackPage } from './CoverPage';
import { splitBold } from './parseMarkdown';
import { getCalloutType } from './calloutTypes';

function colorForRole(theme, role) {
  if (role === 'accent') return theme.accent;
  if (role === 'muted') return theme.muted;
  if (role === 'warning') return '#b45309';
  return theme.primary;
}

function buildStyles(theme) {
  return StyleSheet.create({
    h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: theme.primary, marginTop: 14, marginBottom: 8 },
    h2: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: theme.primary, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.accent, paddingBottom: 3 },
    h3: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: theme.textColor || '#1a1a1a', marginTop: 8, marginBottom: 4 },
    p: { marginBottom: 6, lineHeight: 1.5, color: theme.textColor || '#1a1a1a' },
    bold: { fontFamily: 'Helvetica-Bold' },
    listItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
    bullet: { width: 12, color: theme.accent, fontFamily: 'Helvetica-Bold' },
    listText: { flex: 1, lineHeight: 1.4, color: theme.textColor || '#1a1a1a' },
    table: { marginBottom: 10, borderWidth: 1, borderColor: '#ccc' },
    tableRow: { flexDirection: 'row' },
    tableCellHeader: { flex: 1, backgroundColor: theme.primary, color: '#fff', fontSize: 9.5, fontFamily: 'Helvetica-Bold', padding: 5, borderRightWidth: 1, borderRightColor: '#fff' },
    tableCell: { flex: 1, fontSize: 9.5, padding: 5, borderRightWidth: 1, borderRightColor: '#ccc', borderTopWidth: 1, borderTopColor: '#ccc' },

    // Callout box: colored left border + icon + label, shared look for
    // every :::variant type (summary, tip, warning, memory, challenge,
    // exercise, takeaway, further, or any custom name).
    callout: { marginBottom: 10, padding: 10, backgroundColor: '#f8f9fb', borderRadius: 4 },
    calloutLabel: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    calloutText: { fontSize: 10, lineHeight: 1.5, color: theme.textColor || '#1a1a1a' },

    checklistItem: { flexDirection: 'row', marginBottom: 5, paddingLeft: 4 },
    checklistBox: { width: 14, fontSize: 11, color: theme.primary },
    checklistText: { flex: 1, lineHeight: 1.4, color: theme.textColor || '#1a1a1a' },

    // YouTube video card
    videoCard: { marginBottom: 12, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, backgroundColor: '#fff' },
    videoThumb: { width: '100%', height: 140, objectFit: 'cover', borderRadius: 3, marginBottom: 6 },
    videoLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.accent, marginBottom: 2 },
    videoTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.textColor || '#1a1a1a', marginBottom: 2 },
    videoChannel: { fontSize: 9, color: theme.muted, marginBottom: 4 },
    videoLink: { fontSize: 9.5, color: theme.primary, textDecoration: 'none' },
  });
}

function RichText({ text, style, styles }) {
  const parts = splitBold(text);
  return (
    <Text style={style}>
      {parts.map((p, idx) => (
        <Text key={idx} style={p.bold ? styles.bold : undefined}>{p.text}</Text>
      ))}
    </Text>
  );
}

function Block({ block, index, theme, styles }) {
  switch (block.type) {
    case 'h1': return <Text style={styles.h1} key={index}>{block.text}</Text>;
    case 'h2': return <Text style={styles.h2} key={index}>{block.text}</Text>;
    case 'h3': return <Text style={styles.h3} key={index}>{block.text}</Text>;
    case 'p': return <RichText key={index} text={block.text} style={styles.p} styles={styles} />;

    case 'list':
      return (
        <View key={index}>
          {block.items.map((item, i) => (
            <View style={styles.listItem} key={i}>
              <Text style={styles.bullet}>•</Text>
              <RichText text={item} style={styles.listText} styles={styles} />
            </View>
          ))}
        </View>
      );

    case 'table':
      return (
        <View style={styles.table} key={index}>
          {block.rows.map((row, r) => (
            <View style={styles.tableRow} key={r} wrap={false}>
              {row.map((cell, c) => (
                <Text key={c} style={r === 0 ? styles.tableCellHeader : styles.tableCell}>{cell}</Text>
              ))}
            </View>
          ))}
        </View>
      );

    case 'image':
      if (!block.url || !block.url.trim()) return null;
      return (
        <View key={index} style={{ marginVertical: 8, alignItems: 'center' }}>
          <Image src={block.url} style={{ maxWidth: 400, maxHeight: 300, objectFit: 'contain' }} />
        </View>
      );

    case 'callout': {
      const { icon, label, colorRole } = getCalloutType(block.variant);
      const color = colorForRole(theme, colorRole);
      return (
        <View key={index} style={[styles.callout, { borderLeft: `4px solid ${color}` }]} wrap={false}>
          <Text style={[styles.calloutLabel, { color }]}>{icon} {label}</Text>
          <RichText text={block.text} style={styles.calloutText} styles={styles} />
        </View>
      );
    }

    case 'checklist':
      return (
        <View key={index} style={{ marginBottom: 10 }}>
          {block.items.map((item, i) => (
            <View style={styles.checklistItem} key={i}>
              <Text style={styles.checklistBox}>☐</Text>
              <RichText text={item} style={styles.checklistText} styles={styles} />
            </View>
          ))}
        </View>
      );

    case 'youtube':
      return (
        <View key={index} style={styles.videoCard} wrap={false}>
          <Text style={styles.videoLabel}>📺 RECOMMENDED VIDEO</Text>
          {block.thumbnailUrl ? (
            <Image src={block.thumbnailUrl} style={styles.videoThumb} />
          ) : null}
          {block.title ? <Text style={styles.videoTitle}>{block.title}</Text> : null}
          {block.channel ? <Text style={styles.videoChannel}>{block.channel}</Text> : null}
          <Link src={block.url} style={styles.videoLink}>Watch → {block.url}</Link>
        </View>
      );

    default:
      return null;
  }
}

export default function BookDocument({ title, subtitle, blocks, themeKey = 'brand', authorType = 'team' }) {
  const theme = getTheme(themeKey);
  const styles = buildStyles(theme);

  return (
    <Document
      title={`${title} | Shiney Brain Academy`}
      author="Shiney Brain Academy"
      subject={subtitle || title}
      keywords={`${title}, study guide, Shiney Brain Academy`}
    >
      <CoverPage title={title} subtitle={subtitle || ''} theme={theme} />
      <BrandLayout title={title} theme={theme}>
        {blocks.map((b, i) => <Block block={b} index={i} theme={theme} styles={styles} key={i} />)}
      </BrandLayout>
      <BackPage title={title} authorType={authorType} theme={theme} />
    </Document>
  );
}
