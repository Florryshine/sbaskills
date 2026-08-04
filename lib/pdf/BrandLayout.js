// lib/pdf/BrandLayout.js
import React from 'react';
import { Page, View, StyleSheet } from '@react-pdf/renderer';
import { brand } from './brand';
import Header from './Header';
import Footer from './Footer';

// theme is optional so every existing caller (StudyNoteDocument) keeps
// its original white-page brand look untouched.
export default function BrandLayout({ title, children, theme = brand }) {
  const styles = StyleSheet.create({
    page: {
      paddingTop: 50,
      paddingBottom: 50,
      paddingHorizontal: 40,
      fontFamily: 'Helvetica',
      backgroundColor: theme.pageBackground || '#ffffff',
      color: theme.textColor || '#1a1a1a',
    },
    content: {
      flex: 1,
    },
  });

  return (
    <Page size="A4" style={styles.page}>
      <Header title={title} theme={theme} />
      <View style={styles.content}>{children}</View>
      <Footer theme={theme} />
    </Page>
  );
}
