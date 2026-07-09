// lib/pdf/BrandLayout.js
// Shared content-page shell: header, footer, padding. Any document
// (study notes, blog, exam pack) wraps its blocks in this.
import React from 'react';
import { Page, StyleSheet } from '@react-pdf/renderer';
import Header from './Header';
import Footer from './Footer';

const styles = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 60, paddingHorizontal: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1a1a1a' },
});

export default function BrandLayout({ title, children }) {
  return (
    <Page size="A4" style={styles.page}>
      <Header title={title} />
      <Footer />
      {children}
    </Page>
  );
}
