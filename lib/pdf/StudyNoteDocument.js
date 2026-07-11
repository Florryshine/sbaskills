// lib/pdf/StudyNoteDocument.js
import React from 'react';
import { Document, Text, View, StyleSheet, Image } from '@react-pdf/renderer';   // added Image
import { brand } from './brand';
import BrandLayout from './BrandLayout';
import { CoverPage, BackPage } from './CoverPage';
import { parseMarkdownToBlocks, splitBold } from './parseMarkdown';

// ... (styles unchanged)

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
    // ─── NEW: Image block ──────────────────────────────
    case 'image':
      return (
        <View key={index} style={{ marginVertical: 8, alignItems: 'center' }}>
          <Image
            src={block.url}
            style={{ maxWidth: 400, maxHeight: 300, objectFit: 'contain' }}
          />
        </View>
      );
    default: return null;
  }
}

// ... (rest unchanged: RichText, StudyNoteDocument)