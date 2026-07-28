'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { themeList } from '@/lib/pdf/themes';
import { calloutTypes } from '@/lib/pdf/calloutTypes';

// Quick-insert snippets for the reusable ":::type ... :::" blocks, plus
// a checklist snippet. Clicking a button inserts the snippet at the
// current cursor position in the textarea, same pattern already used
// on /admin/study-note-drafts for inserting images.
const BLOCK_SNIPPETS = [
  { key: 'summary', label: `${calloutTypes.summary.icon} Summary`, snippet: ':::summary\nWrite the summary here.\n:::' },
  { key: 'tip', label: `${calloutTypes.tip.icon} Tip`, snippet: ':::tip\nWrite the tip here.\n:::' },
  { key: 'warning', label: `${calloutTypes.warning.icon} Warning`, snippet: ':::warning\nWrite the warning here.\n:::' },
  { key: 'memory', label: `${calloutTypes.memory.icon} Memory Trick`, snippet: ':::memory\nWrite the memory trick here.\n:::' },
  { key: 'challenge', label: `${calloutTypes.challenge.icon} Challenge`, snippet: ':::challenge\nWrite the challenge here.\n:::' },
  { key: 'exercise', label: `${calloutTypes.exercise.icon} Exercise`, snippet: ':::exercise\nWrite the exercise here.\n:::' },
  { key: 'takeaway', label: `${calloutTypes.takeaway.icon} Key Takeaway`, snippet: ':::takeaway\nWrite the key takeaway here.\n:::' },
  { key: 'further', label: `${calloutTypes.further.icon} Further Reading`, snippet: ':::further\nLink or note here.\n:::' },
  { key: 'checklist', label: '✅ Checklist', snippet: ':::checklist\n- First step\n- Second step\n- Third step\n:::' },
  { key: 'youtube', label: '📺 YouTube Video', snippet: 'https://www.youtube.com/watch?v=VIDEO_ID' },
];

export default function BookFromTextPage() {
  const router = useRouter();
  const textareaRef = useRef(null);
  const supabase = createBrowserClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('Shiney Brain Academy');
  const [price, setPrice] = useState('0');
  const [themeKey, setThemeKey] = useState('brand');
  const [markdown, setMarkdown] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  // Same 'books' bucket + 'covers/' folder pattern already used by
  // /admin/library/add, so covers end up in the same place regardless
  // of which admin page created the book.
  const uploadCover = async () => {
    if (!coverFile) return null;
    const fileExt = coverFile.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const path = `covers/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('books').upload(path, coverFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('books').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const insertSnippet = (snippet) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = markdown.substring(0, start);
      const after = markdown.substring(end);
      const insert = `\n\n${snippet}\n\n`;
      setMarkdown(before + insert + after);
      setTimeout(() => {
        textarea.focus();
        const newPos = start + insert.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setMarkdown(prev => prev + `\n\n${snippet}\n`);
    }
  };

  const generatePdf = async () => {
    setError('');
    setResult(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!markdown.trim()) { setError('Paste some content first.'); return; }

    setGenerating(true);
    try {
      let coverUrl = null;
      if (coverFile) {
        setUploadingCover(true);
        try {
          coverUrl = await uploadCover();
        } finally {
          setUploadingCover(false);
        }
      }

      const res = await fetch('/api/admin/books/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, author, price, markdown, themeKey, coverUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <Link href="/admin/books" className="text-sm text-brand-blue underline">← Back to Books</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">📝 Generate Book from Text</h1>
        <p className="text-sm text-slate-500 mt-1">
          Paste content from ChatGPT, DeepSeek, or anywhere else, pick a template, and click Generate — no manual formatting needed.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Title *</label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="How to Score 300+ in JAMB"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Author</label>
            <input
              type="text" value={author} onChange={e => setAuthor(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Short description</label>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Used as the PDF subtitle and library description"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Price (₦, 0 = free)</label>
            <input
              type="number" min="0" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Cover image</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCoverSelect}
              className="w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-blue file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            <p className="text-xs text-slate-400 mt-1">
              Choose from your phone's camera or photo library.
            </p>
          </div>
        </div>

        {coverPreview && (
          <div className="flex items-center gap-3">
            <img src={coverPreview} alt="Cover preview" className="w-20 h-28 object-cover rounded-lg border border-slate-200" />
            <button
              type="button"
              onClick={() => { setCoverFile(null); setCoverPreview(null); }}
              className="text-xs font-semibold text-red-600 underline"
            >
              Remove cover
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-2">Template</label>
          <div className="flex flex-wrap gap-2">
            {themeList.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setThemeKey(t.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${
                  themeKey === t.key
                    ? 'bg-brand-blue text-white border-brand-blue'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-blue'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold">Content (Markdown)</label>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {BLOCK_SNIPPETS.map(b => (
              <button
                key={b.key}
                type="button"
                onClick={() => insertSnippet(b.snippet)}
                className="rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                + {b.label}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            rows={18}
            value={markdown}
            onChange={e => setMarkdown(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            placeholder={`# Title\n\n## Introduction\n\nPaste your content here...\n\n:::tip\nA short tip goes here.\n:::\n\nhttps://www.youtube.com/watch?v=VIDEO_ID\n\n:::checklist\n- Step one\n- Step two\n:::`}
          />
          <p className="text-xs text-slate-400 mt-1">
            Supports headings (#/##/###), bullet lists, tables, **bold**, images, the block buttons above, and bare YouTube links (auto-converted into video cards).
          </p>
        </div>

        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

        {result && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm">
            <p className="font-semibold text-green-800 mb-1">✅ PDF generated!</p>
            <a href={result.fileUrl} target="_blank" rel="noreferrer" className="text-brand-blue underline break-all">
              {result.fileUrl}
            </a>
            <div className="mt-2">
              <Link href={`/admin/books/${result.bookId}`} className="text-brand-blue underline text-sm font-semibold">
                View / edit book entry →
              </Link>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={generatePdf}
            disabled={generating}
            className="rounded-full bg-brand-yellow px-6 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 disabled:opacity-50"
          >
            {uploadingCover ? 'Uploading cover…' : generating ? 'Generating…' : '✨ Generate PDF'}
          </button>
        </div>
      </section>
    </div>
  );
}
