// lib/pdf/templates/PremiumEbook.js
import React from 'react';
import { Document, Text, View, StyleSheet, Image, Page, Font } from '@react-pdf/renderer';
import { parseMarkdownToBlocks, splitBold } from '../parseMarkdown';

// Register fonts - keeping it simple with Inter and Montserrat
Font.register({
  family: 'Inter',
  src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.ttf',
});

Font.register({
  family: 'Inter-Bold',
  src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.ttf',
});

Font.register({
  family: 'Montserrat',
  src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@4.5.14/files/montserrat-latin-600-normal.ttf',
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: 'Inter',
    backgroundColor: '#ffffff',
  },
  // Section-specific styles for known headings
  sectionBox: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleSection: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  objectiveSection: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  contextSection: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  taskSection: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  requirementsSection: {
    backgroundColor: '#fce7f3',
    borderColor: '#fbcfe8',
  },
  outputFormatSection: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  examTipSection: {
    backgroundColor: '#fef9c3',
    borderColor: '#fde047',
  },
  memoryTrickSection: {
    backgroundColor: '#ede9fe',
    borderColor: '#c4b5fd',
  },
  pastQuestionSection: {
    backgroundColor: '#ffedd5',
    borderColor: '#fdba74',
  },
  answerSection: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  summarySection: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  // Typography
  h1: { 
    fontSize: 24, 
    fontFamily: 'Montserrat', 
    color: '#1e3a8a', 
    marginTop: 20, 
    marginBottom: 12,
    fontWeight: 600,
  },
  h2: { 
    fontSize: 18, 
    fontFamily: 'Montserrat', 
    color: '#1e40af', 
    marginTop: 16, 
    marginBottom: 8,
    fontWeight: 600,
  },
  h3: { 
    fontSize: 14, 
    fontFamily: 'Inter-Bold', 
    color: '#1e293b', 
    marginTop: 12, 
    marginBottom: 6,
  },
  p: { 
    marginBottom: 8, 
    lineHeight: 1.6,
    fontSize: 11,
    color: '#374151',
  },
  bold: { 
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  listItem: { 
    flexDirection: 'row', 
    marginBottom: 6, 
    paddingLeft: 4,
  },
  bullet: { 
    width: 16, 
    color: '#3b82f6', 
    fontFamily: 'Inter-Bold',
    fontSize: 11,
  },
  listText: { 
    flex: 1, 
    lineHeight: 1.5,
    fontSize: 11,
    color: '#374151',
  },
  table: { 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableRow: { 
    flexDirection: 'row',
  },
  tableCellHeader: { 
    flex: 1, 
    backgroundColor: '#3b82f6', 
    color: '#ffffff', 
    fontSize: 10, 
    fontFamily: 'Inter-Bold', 
    padding: 8, 
    borderRightWidth: 1, 
    borderRightColor: '#ffffff',
  },
  tableCell: { 
    flex: 1, 
    fontSize: 10, 
    padding: 8, 
    borderRightWidth: 1, 
    borderRightColor: '#e5e7eb', 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat',
    fontWeight: 600,
    color: '#1e3a8a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  image: {
    maxWidth: 450,
    maxHeight: 320,
    objectFit: 'contain',
    borderRadius: 8,
  },
});

// Map heading text to section style
const getSectionStyle = (heading) => {
  const normalized = heading.toLowerCase().trim();
  
  if (normalized === 'role') return styles.roleSection;
  if (normalized === 'objective') return styles.objectiveSection;
  if (normalized === 'context') return styles.contextSection;
  if (normalized === 'task') return styles.taskSection;
  if (normalized === 'requirements') return styles.requirementsSection;
  if (normalized === 'output format') return styles.outputFormatSection;
  if (normalized === 'exam tip') return styles.examTipSection;
  if (normalized === 'memory trick') return styles.memoryTrickSection;
  if (normalized === 'past question') return styles.pastQuestionSection;
  if (normalized === 'answer') return styles.answerSection;
  if (normalized === 'summary') return styles.summarySection;
  
  return styles.sectionBox;
};

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

function Block({ block, index, inSection }) {
  switch (block.type) {
    case 'h1': 
      return <Text style={styles.h1} key={index}>{block.text}</Text>;
    case 'h2': 
      return <Text style={styles.h2} key={index}>{block.text}</Text>;
    case 'h3': 
      return <Text style={styles.h3} key={index}>{block.text}</Text>;
    case 'p': 
      return <RichText key={index} text={block.text} style={inSection ? { ...styles.p, marginBottom: 6 } : styles.p} />;
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
      if (!block.url || !block.url.trim()) return null;
      return (
        <View key={index} style={styles.imageContainer}>
          <Image src={block.url} style={styles.image} />
        </View>
      );
    default:
      return null;
  }
}

function ContentSection({ title, blocks }) {
  const sectionStyle = getSectionStyle(title);
  
  return (
    <View style={[styles.sectionBox, sectionStyle]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {blocks.map((b, i) => <Block block={b} index={i} key={i} inSection={true} />)}
    </View>
  );
}

export default function PremiumEbookDocument({ title, keyword, markdown, authorType = 'team' }) {
  const blocks = parseMarkdownToBlocks(markdown);
  
  // Group blocks into sections based on known headings
  const sections = [];
  let currentSection = null;
  let currentBlocks = [];
  
  blocks.forEach((block) => {
    if (block.type === 'h2' || block.type === 'h3') {
      // Save previous section if exists
      if (currentSection && currentBlocks.length > 0) {
        sections.push({ title: currentSection, blocks: currentBlocks });
      }
      
      // Start new section
      currentSection = block.text;
      currentBlocks = [];
    } else if (currentSection) {
      currentBlocks.push(block);
    } else {
      // Blocks before any section header
      sections.push({ title: null, blocks: [block] });
    }
  });
  
  // Don't forget the last section
  if (currentSection && currentBlocks.length > 0) {
    sections.push({ title: currentSection, blocks: currentBlocks });
  }
  
  return (
    <Document
      title={`${title} | Shiney Brain Academy`}
      author="Shiney Brain Academy"
      subject={`${keyword} - Premium Ebook`}
      keywords={`${keyword}, study notes, exam preparation, JAMB, WAEC, NECO, Shiney Brain Academy`}
    >
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.h1}>{title}</Text>
        {keyword && (
          <Text style={{ ...styles.p, color: '#6b7280', marginBottom: 16 }}>
            {keyword}
          </Text>
        )}
        
        {/* Render sections */}
        {sections.map((section, idx) => {
          if (section.title) {
            return <ContentSection key={idx} title={section.title} blocks={section.blocks} />;
          } else {
            // Render blocks without section wrapper
            return section.blocks.map((b, i) => <Block key={`${idx}-${i}`} block={b} index={i} inSection={false} />);
          }
        })}
      </Page>
    </Document>
  );
}
