// lib/pdf/BrandLayout.js
import React from 'react';
import { Page, View, StyleSheet } from '@react-pdf/renderer';
import Header from './Header';
import Footer from './Footer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
  },
  content: {
    flex: 1,
  },
});

export default function BrandLayout({ title, children }) {
  return (
    <Page size="A4" style={styles.page}>
      <Header title={title} />
      <View style={styles.content}>{children}</View>
      <Footer />
    </Page>
  );
}