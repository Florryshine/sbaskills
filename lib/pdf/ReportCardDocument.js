// lib/pdf/ReportCardDocument.js
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { brand } from './brand';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10.5, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: brand.primary, paddingBottom: 10, marginBottom: 14 },
  schoolName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: brand.primary },
  poweredBy: { fontSize: 8, color: brand.muted, marginTop: 2 },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  meta: { fontSize: 9, color: brand.muted, textAlign: 'right' },
  infoRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#f5f7fb', padding: 10, borderRadius: 4 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 8, color: brand.muted, marginBottom: 2 },
  infoValue: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  table: { borderWidth: 1, borderColor: '#ccc', marginBottom: 14 },
  tableRow: { flexDirection: 'row' },
  tableHeaderCell: { flex: 1, backgroundColor: brand.primary, color: '#fff', fontSize: 9.5, fontFamily: 'Helvetica-Bold', padding: 6, borderRightWidth: 1, borderRightColor: '#fff' },
  tableCell: { flex: 1, fontSize: 9.5, padding: 6, borderRightWidth: 1, borderRightColor: '#eee', borderTopWidth: 1, borderTopColor: '#eee' },
  commentBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 10, marginBottom: 10 },
  commentLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: brand.primary, marginBottom: 4 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, fontSize: 8, color: brand.muted, textAlign: 'center' },
});

export function ReportCardDocument({ school, reportCard }) {
  const scores = reportCard.subject_scores || [];
  // Support both the new shape (ca1/ca2/exam/total) and older rows saved
  // before that split existed (just `score`).
  const rowTotal = (s) => (s.total !== undefined ? Number(s.total) : Number(s.score) || 0);
  const average = scores.length
    ? (scores.reduce((sum, s) => sum + rowTotal(s), 0) / scores.length).toFixed(1)
    : '-';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.schoolName}>{school?.name || 'School'}</Text>
            <Text style={styles.poweredBy}>Powered by {brand.name}</Text>
          </View>
          <View>
            <Text style={styles.title}>Student Report Card</Text>
            <Text style={styles.meta}>{reportCard.term} &middot; {reportCard.session}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>STUDENT</Text>
            <Text style={styles.infoValue}>{reportCard.profiles?.full_name || '—'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>CLASS</Text>
            <Text style={styles.infoValue}>{reportCard.class_level || '—'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>POSITION</Text>
            <Text style={styles.infoValue}>
              {reportCard.position_in_class ? `${reportCard.position_in_class} of ${reportCard.class_size || '-'}` : '—'}
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>ATTENDANCE</Text>
            <Text style={styles.infoValue}>
              {reportCard.attendance_total ? `${reportCard.attendance_present}/${reportCard.attendance_total} days` : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
            <Text style={styles.tableHeaderCell}>CA1</Text>
            <Text style={styles.tableHeaderCell}>CA2</Text>
            <Text style={styles.tableHeaderCell}>Exam</Text>
            <Text style={styles.tableHeaderCell}>Total</Text>
            <Text style={styles.tableHeaderCell}>Grade</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5, borderRightWidth: 0 }]}>Remark</Text>
          </View>
          {scores.map((s, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{s.subject}</Text>
              <Text style={styles.tableCell}>{s.ca1 ?? '-'}</Text>
              <Text style={styles.tableCell}>{s.ca2 ?? '-'}</Text>
              <Text style={styles.tableCell}>{s.exam ?? '-'}</Text>
              <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>{rowTotal(s)}</Text>
              <Text style={styles.tableCell}>{s.grade || '-'}</Text>
              <Text style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}>{s.remark || '-'}</Text>
            </View>
          ))}
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Average</Text>
            <Text style={styles.tableCell}> </Text>
            <Text style={styles.tableCell}> </Text>
            <Text style={styles.tableCell}> </Text>
            <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>{average}</Text>
            <Text style={styles.tableCell}> </Text>
            <Text style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}> </Text>
          </View>
        </View>

        {reportCard.teacher_comment ? (
          <View style={styles.commentBox}>
            <Text style={styles.commentLabel}>Class Teacher's Comment</Text>
            <Text>{reportCard.teacher_comment}</Text>
          </View>
        ) : null}

        {reportCard.principal_comment ? (
          <View style={styles.commentBox}>
            <Text style={styles.commentLabel}>Principal's Comment</Text>
            <Text>{reportCard.principal_comment}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated via {brand.name} School Module &middot; {brand.website}
        </Text>
      </Page>
    </Document>
  );
}

export default ReportCardDocument;
