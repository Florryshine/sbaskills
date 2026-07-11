// lib/pdf/Header.js
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { brand } from './brand';   // named import

const styles = StyleSheet.create({
  header: {
    backgroundColor: brand.primary,   // now brand.primary
    padding: 12,
    marginBottom: 20,
  },
  headerText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
});

export default function Header({ title }) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.headerText}>{brand.name} – {title}</Text>
    </View>
  );
}