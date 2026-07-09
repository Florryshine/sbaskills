// lib/pdf/Header.js
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import brand from './brand';

const styles = StyleSheet.create({
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 50,
    backgroundColor: brand.colors.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
  },
  headerText: { color: '#fff', fontSize: 12, fontFamily: 'Helvetica-Bold' },
  headerSubText: { color: '#fff', fontSize: 9 },
  goldBar: { position: 'absolute', top: 50, left: 0, right: 0, height: 3, backgroundColor: brand.colors.secondary },
});

export default function Header({ title }) {
  return (
    <>
      <View style={styles.header} fixed>
        <Text style={styles.headerText}>{brand.name}</Text>
        <Text style={styles.headerSubText}>{title}</Text>
      </View>
      <View style={styles.goldBar} fixed />
    </>
  );
}
