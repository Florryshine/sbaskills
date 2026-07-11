// lib/pdf/StudyNoteDocument.js
import React from 'react';
import { Document, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { brand } from './brand';
import BrandLayout from './BrandLayout';
import { CoverPage, BackPage } from './CoverPage';
import { parseMarkdownToBlocks, splitBold } from './parseMarkdown';

const styles = StyleSheet.create({
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: brand.primary, marginTop: 14, marginBottom: 8 },
  h2: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: brand.primary, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: brand.accent, paddingBottom: 3 },
  h3: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 6, lineHeight: 1.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  listItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
  bullet: { width: 12, color: brand.accent, fontFamily: 'Helvetica-Bold' },
  listText: { flex: 1, lineHeight: 1.4 },
  table: { marginBottom: 10, borderWidth: 1, borderColor: '#ccc' },
  tableRow: { flexDirection: 'row' },
  tableCellHeader: { flex: 1, backgroundColor: brand.primary, color: '#fff', fontSize: 9.5, fontFamily: 'Helvetica-Bold', padding: 5, borderRightWidth: 1, borderRightColor: '#fff' },
  tableCell: { flex: 1, fontSize: 9.5, padding: 5, borderRightWidth: 1, borderRightColor: '#ccc', borderTopWidth: 1, borderTopColor: '#ccc' },
});

function RichText({ text, style }) {
  const parts = splitBold(text);
  return (
    <Text style={style}>
      {parts.map((p, idx) => (
        <Text key={idx} style={p.bold ? styles.bold : undefined}>{p.text}</Text>
      ))}
    </Text>
  );
}

function Block({ block, index }) {
  switch (block.type) {
    case 'h1': return <Text style={styles.h1} key={index}>{block.text}</Text>;
    case 'h2': return <Text style={styles.h2} key={index}>{block.text}</Text>;
    case 'h3': return <Text style={styles.h3} key={index}>{block.text}</Text>;
    case 'p': return <RichText key={index} text={block.text} style={styles.p} />;
    case 'list':
      return (
        <View key={index}>
          {block.items.map((item, i) => (
            <View style={styles.listItem} key={i}>
              <Text style={styles.bullet}>•</Text>
              <RichText text={item} style={styles.listText} />
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
      // Guard against empty or invalid URL
      if (!block.url || !block.url.trim()) return null;
      return (
        <View key={index} style={{ marginVertical: 8, alignItems: 'center' }}>
          <Image
            src={block.url}
            style={{ maxWidth: 400, maxHeight: 300, objectFit: 'contain' }}
          />
        </View>
      );
    default:
      return null;
  }
}

export default function StudyNoteDocument({ title, keyword, markdown, authorType = 'team' }) {
  const blocks = parseMarkdownToBlocks(markdown);

  return (
    <Document title={title}>
      <CoverPage title={title} subtitle={`Exam-Ready Study Notes • ${keyword}`} />
      <BrandLayout title={title}>
        {blocks.map((b, i) => <Block block={b} index={i} key={i} />)}
      </BrandLayout>
      <BackPage title={title} authorType={authorType} />
    </Document>
  );
}