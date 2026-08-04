'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, FileText, ArrowLeft, Download, CheckCircle, AlertCircle } from 'lucide-react';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a CSV file.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/content-engine/queue', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (res.ok) {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => router.push('/admin/content-engine/queue'), 1500);
      }
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'keyword,category,priority,subject,exam_type,learning_objectives\n';
    const sample = [
      'JAMB Aggregate Calculator,JAMB,High,,,',
      'WAEC Grade Calculator,WAEC,High,,,',
      '"Isotopes and Isobars",Chemistry,High,Chemistry,JAMB;WAEC,"Define isotopes.;Differentiate isotopes from isobars.;Solve isotope questions."',
      'How to Study for JAMB,Study Tips,High,,,',
      'Best AI Tools for Students,Digital Skills,Low,,,',
    ].join('\n') + '\n';
    const csv = headers + sample;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content-engine-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin/content-engine" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#1a73e8] flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upload Keywords</h1>
              <p className="text-sm text-gray-500">Import a CSV file to build your generation queue</p>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-[#1a73e8] transition-colors">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[#1a73e8]" />
            </div>
            <p className="text-gray-700 font-medium mb-1">
              {file ? file.name : 'Choose a CSV file'}
            </p>
            <p className="text-gray-400 text-sm mb-4">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV format required'}
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <div className="flex flex-wrap gap-3 justify-center">
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 bg-[#1a73e8] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#1557b0] transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" /> Select CSV
              </label>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" /> Download Template
              </button>
            </div>
          </div>

          {result && (
            <div className={`mt-6 rounded-2xl p-4 border ${
              result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
            }`}>
              <div className="flex items-center gap-3">
                {result.error ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                <div>
                  <p className={`font-medium ${result.error ? 'text-red-700' : 'text-green-700'}`}>
                    {result.error || result.message || 'Upload successful!'}
                  </p>
                  {result.count && (
                    <p className="text-sm text-green-600">{result.count} keywords added to queue</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-[#1a73e8] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#1557b0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload & Create Queue'}
            </button>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">CSV Format</h3>
            <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-600 overflow-x-auto">
              <div>keyword,category,priority,subject,exam_type,learning_objectives</div>
              <div className="text-[#1a73e8]">JAMB Aggregate Calculator,JAMB,High,,,</div>
              <div className="text-[#1a73e8]">
                {'"Isotopes and Isobars",Chemistry,High,Chemistry,JAMB;WAEC,"Define isotopes.;Differentiate isotopes from isobars."'}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Only <span className="font-semibold text-gray-500">keyword</span> is required. <span className="font-semibold text-gray-500">category</span> and <span className="font-semibold text-gray-500">priority</span> control queue sorting.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-semibold text-gray-500">subject</span>, <span className="font-semibold text-gray-500">exam_type</span>, and <span className="font-semibold text-gray-500">learning_objectives</span> are optional AI hints — the model still researches the topic itself, but these anchor it to the exact exam context you specify instead of generic coverage.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              For <span className="font-semibold text-gray-500">exam_type</span> and <span className="font-semibold text-gray-500">learning_objectives</span> with multiple values, separate them with <code className="bg-gray-100 px-1 rounded">;</code> and wrap the whole field in quotes, e.g. <code className="bg-gray-100 px-1 rounded">"JAMB;WAEC"</code>.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Categories: JAMB, WAEC, NECO, University, Post-UTME, Career, Study Tips, Digital Skills
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}