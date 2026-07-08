'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UploadQuestions() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id;

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('quizId', quizId);

    try {
      const res = await fetch('/api/admin/quiz/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        setFile(null);
        // Reset file input
        document.getElementById('fileInput').value = '';
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upload Questions</h1>
      <p className="mb-4 text-gray-600">
        Upload a <strong>.txt</strong>, <strong>.csv</strong>, or <strong>.xlsx</strong> file with your questions.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4">
        <div className="flex flex-col items-center gap-4">
          <input
            id="fileInput"
            type="file"
            accept=".txt,.csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <p className="text-sm text-gray-600">
              Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload Questions'}
        </button>
        <button
          onClick={() => router.push(`/admin/quizzes`)}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded">
          ✅ Saved {result.saved} out of {result.total} questions.
          {result.saved < result.total && (
            <span className="block text-sm text-yellow-600">
              (Some questions were skipped because they were incomplete.)
            </span>
          )}
        </div>
      )}

      <div className="mt-8 border-t pt-4">
        <h2 className="font-semibold mb-2">📝 Format Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded border">
            <p className="font-medium">Text file (.txt)</p>
            <pre className="whitespace-pre-wrap text-xs">
              {`1. What is 2+2?
A. 3
B. 4
C. 5
D. 6
Answer: B

2. What is the capital of Nigeria?
A. Lagos
B. Abuja
C. Kano
D. Ibadan
Answer: B`}
            </pre>
          </div>
          <div className="bg-gray-50 p-3 rounded border">
            <p className="font-medium">Excel / CSV</p>
            <pre className="whitespace-pre-wrap text-xs">
              {`Question,OptionA,OptionB,OptionC,OptionD,CorrectAnswer
What is 2+2?,3,4,5,6,B
What is the capital of Nigeria?,Lagos,Abuja,Kano,Ibadan,B`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}