// lib/pdf/Footer.js
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import brand from './brand';

const styles = StyleSheet.create({
  footer: {
    position: 'absolute', bottom: 20, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', fontSize: 8,
    color: brand.colors.muted, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 6,
  },
});

export default function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>{brand.name} | {brand.phone}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
