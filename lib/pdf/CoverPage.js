// lib/pdf/CoverPage.js
import React from 'react';
import { Page, View, Text, StyleSheet, Link, Image } from '@react-pdf/renderer';
import { brand } from './brand';
import Header from './Header';
import Footer from './Footer';

// ─── Front cover styles ──────────────────────────────────────────────
const frontStyles = StyleSheet.create({
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: brand.primary, textAlign: 'center', marginTop: 200 },
  coverSubtitle: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 10 },
  coverBrand: { fontSize: 14, color: brand.accent, textAlign: 'center', marginTop: 260, fontFamily: 'Helvetica-Bold' },
});

// ─── Back page styles ───────────────────────────────────────────────
const backStyles = StyleSheet.create({
  page: {
    paddingTop: 70,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 62,
    height: 62,
    marginBottom: 10,
  },
  mission: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    fontSize: 9,
    color: brand.muted,
    flexWrap: 'wrap',
  },
  contactItem: {
    marginHorizontal: 6,
  },
  link: {
    color: brand.primary,
    textDecoration: 'none',
  },
  cards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  card: {
    width: '30%',
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderRadius: 4,
    borderLeft: `4px solid ${brand.primary}`,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: brand.primary,
    marginBottom: 4,
  },
  cardText: {
    fontSize: 8,
    color: '#333',
    lineHeight: 1.4,
  },
  donation: {
    backgroundColor: brand.accent,
    padding: 14,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  donationLeft: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
  },
  donationRight: {
    fontSize: 9,
    color: '#000',
  },
});

// ─── Front Cover ──────────────────────────────────────────────────────
export function CoverPage({ title, subtitle }) {
  return (
    <Page size="A4" style={{ padding: 0 }}>
      <Text style={frontStyles.coverTitle}>{title}</Text>
      <Text style={frontStyles.coverSubtitle}>{subtitle}</Text>
      <Text style={frontStyles.coverBrand}>{brand.name.toUpperCase()}</Text>
    </Page>
  );
}

// ─── Back Page (magazine style) ─────────────────────────────────────
export function BackPage({ title, authorType = 'team' }) {
  const isFounder = authorType === 'founder';
  const authorTitle = isFounder ? 'About the Author: Florry Shine' : 'About the Content Team';
  const authorBio = isFounder
    ? brand.founder.bio
    : 'Our academic team consists of experienced educators and subject matter experts dedicated to creating high-quality, exam-focused study materials.';
  const authorQuote = isFounder ? `"${brand.founder.quote}"` : 'We are committed to helping every student succeed.';

  return (
    <Page size="A4" style={backStyles.page}>
      <Header title={title} />
      <Footer />

      {/* Hero section */}
      <View style={backStyles.hero}>
        <Image src={process.cwd() + '/lib/logo.jpg'} style={backStyles.logo} />
        <Text style={backStyles.mission}>{brand.about}</Text>
        <View style={backStyles.contactRow}>
          <Text style={backStyles.contactItem}>
            <Link src={brand.website} style={backStyles.link}>
              {brand.website.replace('https://', '')}
            </Link>
          </Text>
          <Text style={backStyles.contactItem}>{brand.phone}</Text>
          <Text style={backStyles.contactItem}>{brand.email}</Text>
        </View>
      </View>

      {/* Three cards */}
      <View style={backStyles.cards}>
        <View style={backStyles.card}>
          <Text style={backStyles.cardTitle}>About SBA</Text>
          <Text style={backStyles.cardText}>
            Shiney Brain Academy provides innovative learning tools — quizzes, flashcards, Boss Battles, and AI-powered study notes — to help Nigerian students excel in JAMB, WAEC, NECO, and Post‑UTME.
          </Text>
        </View>
        <View style={backStyles.card}>
          <Text style={backStyles.cardTitle}>{authorTitle}</Text>
          <Text style={backStyles.cardText}>{authorBio}</Text>
          <Text style={[backStyles.cardText, { marginTop: 4, fontStyle: 'italic' }]}>{authorQuote}</Text>
        </View>
        <View style={backStyles.card}>
          <Text style={backStyles.cardTitle}>Join the Community</Text>
          <Text style={backStyles.cardText}>
            📚 Premium study materials{'\n'}
            🧠 Practice questions{'\n'}
            ⚔️ Academic challenges{'\n'}
            🎯 Exam strategies{'\n'}
            🏆 Progress tracking
          </Text>
        </View>
      </View>

      {/* Donation band */}
      <View style={backStyles.donation}>
        <View style={backStyles.donationLeft}>
          <Text>❤️ Support our mission</Text>
          <Text style={{ fontSize: 8, fontWeight: 'normal' }}>
            Help us create more free resources and scholarships.
          </Text>
        </View>
        <View style={backStyles.donationRight}>
          <Text>{brand.donation.bank}</Text>
          <Text>{brand.donation.accountNumber}</Text>
          <Text>{brand.donation.accountName}</Text>
        </View>
      </View>
    </Page>
  );
}