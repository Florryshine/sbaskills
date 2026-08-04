// lib/pdf/Header.js
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { brand } from './brand';   // named import

// theme is optional so every existing caller (StudyNoteDocument, which
// never passes it) keeps rendering exactly as before.
export default function Header({ title, theme = brand }) {
  const styles = StyleSheet.create({
    header: {
      backgroundColor: theme.primary,
      padding: 12,
      marginBottom: 20,
    },
    headerText: {
      color: theme.headerTextColor || '#ffffff',
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.header} fixed>
      <Text style={styles.headerText}>{brand.name} – {title}</Text>
    </View>
  );
}
