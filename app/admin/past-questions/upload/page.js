'use client';

import { useState, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadPastQuestions() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState([]);
  const fileInputRef = useRef(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  // Parses one CSV line, respecting quoted fields that may contain commas
  // (e.g. "What is 2, 4, 6, 8 the next number in?"). A naive line.split(',')
  // breaks on exactly this kind of question text.
  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setMessage('');

    // Preview CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1, 6).map(line => parseCsvLine(line));
      setPreview({ headers, rows: rows.filter(r => r.length === headers.length) });
    };
    reader.readAsText(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a CSV file.');
      return;
    }

    setUploading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = parseCsvLine(lines[0]);

      const questions = [];
      const skipped = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length !== headers.length) {
          skipped.push(i + 1);
          continue;
        }
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx] || '';
        });
        if (obj.year) obj.year = parseInt(obj.year) || null;
        questions.push(obj);
      }

      if (questions.length === 0) {
        alert('No valid rows found. Check that every row has the same number of columns as the header.');
        setUploading(false);
        return;
      }

      // Insert into Supabase
      const { error } = await supabase
        .from('past_questions')
        .insert(questions);

      if (error) {
        alert('Error: ' + error.message);
      } else {
        let msg = `✅ Successfully uploaded ${questions.length} questions!`;
        if (skipped.length > 0) {
          msg += ` (Skipped ${skipped.length} row(s) with a mismatched column count: line ${skipped.join(', ')})`;
        }
        setMessage(msg);
        setFile(null);
        setPreview([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      setUploading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">📤 Upload Past Questions (CSV)</h1>
        <p className="text-sm text-gray-500">Upload a CSV file with past questions. First row must be headers.</p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400">Required CSV headers:</p>
          <code className="text-xs bg-slate-100 p-1 rounded">subject, topic, year, exam_type, question, option_a, option_b, option_c, option_d, correct_answer, explanation</code>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileChange}
            className="flex-1"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>

        {message && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
            {message}
          </div>
        )}

        {preview.rows && preview.rows.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Preview (first 5 rows):</p>
            <div className="overflow-x-auto text-sm">
              <table className="min-w-full border">
                <thead className="bg-slate-50">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="border px-2 py-1 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="border px-2 py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}