import React from 'react';
import { View, Text, StyleSheet, Link } from '@react-pdf/renderer';
import { brand } from './brand';

const styles = StyleSheet.create({
  footer: {
    position: 'absolute', bottom: 20, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', fontSize: 8,
    color: brand.muted, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 6,
  },
  link: {
    color: brand.primary,
    textDecoration: 'none',
  },
});

export default function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {brand.name} | {brand.phone}
        {' '}|{' '}
        <Link src={brand.website} style={styles.link}>
          {brand.website.replace('https://', '')}
        </Link>
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}