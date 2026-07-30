// lib/pdf/StudyNoteDocument.js
import React from 'react';
import { Document, Text, View, Image } from '@react-pdf/renderer';
import BrandLayout from './BrandLayout';
import { CoverPage, BackPage } from './CoverPage';
import { parseMarkdownToBlocks, splitBold } from './parseMarkdown';
import { getTheme } from './themes';
import { buildBlockStyles } from './blockStyles';

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

function Block({ block, index, styles }) {
  switch (block.type) {
    case 'h1':
      // Force a fresh page for every new top-level topic except the
      // very first one (that one already starts on a fresh page).
      return <Text style={styles.h1} key={index} break={index > 0}>{block.text}</Text>;
    case 'h2': return <Text style={styles.h2} key={index}>{block.text}</Text>;
    case 'h3': return <Text style={styles.h3} key={index}>{block.text}</Text>;
    case 'hr': return <View style={styles.hr} key={index} />;
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

// themeKey lets callers pick a visual style ('brand' | 'modern' | 'workbook'
// | 'premium' | 'minimal' | 'dark' — see themes.js). Defaults to the
// original brand look so existing callers are unaffected.
export default function StudyNoteDocument({ title, keyword, markdown, authorType = 'team', themeKey = 'brand' }) {
  const blocks = parseMarkdownToBlocks(markdown);
  const theme = getTheme(themeKey);
  const styles = buildBlockStyles(theme);

  return (
    <Document
      title={`${title} | Shiney Brain Academy`}
      author="Shiney Brain Academy"
      subject={`${keyword} Revision Notes`}
      keywords={`${keyword}, study notes, exam preparation, JAMB, WAEC, NECO, Shiney Brain Academy`}
    >
      <CoverPage title={title} subtitle={`Exam-Ready Study Notes • ${keyword}`} theme={theme} />
      <BrandLayout title={title} theme={theme}>
        {blocks.map((b, i) => <Block block={b} index={i} styles={styles} key={i} />)}
      </BrandLayout>
      <BackPage title={title} authorType={authorType} theme={theme} />
    </Document>
  );
}
