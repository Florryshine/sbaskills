// lib/pdf/CoverPage.js
import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import brand from './brand';
import Header from './Header';
import Footer from './Footer';

const styles = StyleSheet.create({
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: brand.colors.primary, textAlign: 'center', marginTop: 200 },
  coverSubtitle: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 10 },
  coverBrand: { fontSize: 14, color: brand.colors.secondary, textAlign: 'center', marginTop: 260, fontFamily: 'Helvetica-Bold' },
  backPage: { paddingTop: 70, paddingBottom: 60, paddingHorizontal: 40, fontFamily: 'Helvetica' },
  backPageTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: brand.colors.primary, marginBottom: 14, marginTop: 180, textAlign: 'center' },
  backPageText: { fontSize: 11, textAlign: 'center', lineHeight: 1.6, marginBottom: 8, color: '#333' },
});

export function CoverPage({ title, subtitle }) {
  return (
    <Page size="A4" style={{ padding: 0 }}>
      <Text style={styles.coverTitle}>{title}</Text>
      <Text style={styles.coverSubtitle}>{subtitle}</Text>
      <Text style={styles.coverBrand}>{brand.name.toUpperCase()}</Text>
    </Page>
  );
}

export function BackPage({ title }) {
  return (
    <Page size="A4" style={styles.backPage}>
      <Header title={title} />
      <Footer />
      <Text style={styles.backPageTitle}>About {brand.name}</Text>
      {brand.about.map((line, i) => (
        <Text style={styles.backPageText} key={i}>{line}</Text>
      ))}
    </Page>
  );
}
