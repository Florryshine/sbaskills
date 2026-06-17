'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function AdminCourseEditorPage() {
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingLesson, setEditingLesson] = useState(null); // for inline edit
  const fileInputRef = useRef(null);
  const videoInputRefs = useRef({});
  const pdfInputRefs = useRef({});
  const router = useRouter();
  const params = useParams();
  const courseId = params.id;
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/login'); return; }

      if (courseId && courseId !== 'new') {
        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();

        if (courseData) {
          setCourse(courseData);
          setFormData({
            title: courseData.title || '',
            description: courseData.description || '',
            price: courseData.price?.toString() || '',
            thumbnail_url: courseData.thumbnail_url || '',
            color: courseData.color || '#1a73e8',
            is_published: courseData.is_published || false,
          });
        }

        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        setLessons(lessonsData || []);
      } else {
        setCourse({ id: 'new' });
        setFormData({
          title: '',
          description: '',
          price: '',
          thumbnail_url: '',
          color: '#1a73e8',
          is_published: false,
        });
        setLessons([]);
      }
      setLoading(false);
    }
    load();
  }, [courseId, router]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    thumbnail_url: '',
    color: '#1a73e8',
    is_published: false,
  });

  async function uploadImage(file) {
    setUploading(true);
    setUploadProgress(0);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `courses/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('course-thumbnails')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        onProgress: (progress) => {
          setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      });

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('course-thumbnails')
      .getPublicUrl(filePath);

    setFormData({ ...formData, thumbnail_url: urlData.publicUrl });
    setUploading(false);
    setUploadProgress(0);
    alert('Image uploaded successfully!');
  }

  async function uploadFile(lessonId, file, type) {
    setUploading(true);
    setUploadProgress(0);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const folder = type === 'video' ? 'videos' : 'pdfs';
    const filePath = `lessons/${lessonId}/${folder}/${fileName}`;
    const bucket = type === 'video' ? 'lesson-videos' : 'lesson-pdfs';

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        onProgress: (progress) => {
          setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      });

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    // Update lesson with the URL
    const updateField = type === 'video' ? { video_url: urlData.publicUrl } : { pdf_url: urlData.publicUrl };
    const { error: updateError } = await supabase
      .from('lessons')
      .update(updateField)
      .eq('id', lessonId);

    if (updateError) {
      alert('Update failed: ' + updateError.message);
    } else {
      setLessons(lessons.map(l => 
        l.id === lessonId ? { ...l, ...updateField } : l
      ));
      alert(`${type === 'video' ? 'Video' : 'PDF'} uploaded successfully!`);
    }
    setUploading(false);
    setUploadProgress(0);
  }

  // NEW: Update lesson description
  async function updateLessonDescription(lessonId, description) {
    const { error } = await supabase
      .from('lessons')
      .update({ description })
      .eq('id', lessonId);
    if (error) {
      alert(error.message);
    } else {
      setLessons(lessons.map(l => 
        l.id === lessonId ? { ...l, description } : l
      ));
      setEditingLesson(null);
    }
  }

  async function handleSaveCourse() {
    setSaving(true);
    const supabase = createBrowserClient();

    if (courseId === 'new') {
      const { data, error } = await supabase
        .from('courses')
        .insert({
          title: formData.title,
          description: formData.description,
          price: parseInt(formData.price) || 0,
          thumbnail_url: formData.thumbnail_url,
          color: formData.color,
          is_published: formData.is_published,
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
      } else {
        router.push(`/admin/courses/${data.id}`);
      }
    } else {
      await supabase
        .from('courses')
        .update({
          title: formData.title,
          description: formData.description,
          price: parseInt(formData.price) || 0,
          thumbnail_url: formData.thumbnail_url,
          color: formData.color,
          is_published: formData.is_published,
        })
        .eq('id', courseId);
      alert('Course updated!');
    }
    setSaving(false);
  }

  async function addLesson() {
    const title = prompt('Lesson title:');
    if (!title) return;
    setSaving(true);
    const supabase = createBrowserClient();
    const newOrder = lessons.length + 1;
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        course_id: courseId,
        title: title,
        description: '',
        order_index: newOrder,
        is_published: false,
      })
      .select()
      .single();
    if (error) {
      alert(error.message);
    } else {
      setLessons([...lessons, data]);
    }
    setSaving(false);
  }

  async function deleteLesson(id) {
    if (!confirm('Delete this lesson?')) return;
    const supabase = createBrowserClient();
    await supabase.from('lessons').delete().eq('id', id);
    setLessons(lessons.filter(l => l.id !== id));
  }

  if (loading) return <div className="p-8 text-center">Loading course editor...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
              {courseId === 'new' ? 'Create Course' : 'Edit Course'}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">
              {courseId === 'new' ? 'New Course' : (course?.title || 'Course Editor')}
            </h1>
          </div>
          <button
            onClick={handleSaveCourse}
            disabled={saving}
            className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition"
          >
            {saving ? 'Saving...' : (courseId === 'new' ? 'Create Course' : 'Save Changes')}
          </button>
        </div>
        <Link href="/admin/courses" className="mt-4 inline-block text-sm text-brand-blue underline">
          ← Back to Courses
        </Link>
      </section>

      {/* Course Details Form (unchanged) */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="text-base font-extrabold text-brand-blue mb-4">Course Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Price (₦)</label>
            <input
              type="number"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Thumbnail</label>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={formData.thumbnail_url}
                onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2"
                placeholder="https://..."
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                {uploading ? `Uploading... ${uploadProgress}%` : '📁 Upload Image'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) uploadImage(e.target.files[0]);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
            {formData.thumbnail_url && (
              <div className="mt-2">
                <img src={formData.thumbnail_url} alt="Thumbnail preview" className="h-24 rounded-lg object-cover" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Card Color (hex)</label>
            <input
              type="color"
              value={formData.color}
              onChange={e => setFormData({ ...formData, color: e.target.value })}
              className="w-full rounded-xl border border-slate-200 h-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={e => setFormData({ ...formData, is_published: e.target.checked })}
              className="w-5 h-5"
            />
            <label className="text-sm font-semibold text-slate-700">Published (visible to students)</label>
          </div>
        </div>
      </section>

      {/* Lessons Manager - ENHANCED */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-brand-blue">Lessons</h2>
          <button
            onClick={addLesson}
            className="rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark"
          >
            + Add Lesson
          </button>
        </div>
        {lessons.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No lessons yet. Click "Add Lesson" to start.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lessons.map((lesson, idx) => (
              <div key={lesson.id} className="py-4">
                <div className="flex items-center gap-4">
                  <div className="font-bold text-brand-blue w-8">{idx + 1}.</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{lesson.title}</p>
                    {lesson.description && (
                      <p className="text-sm text-slate-500 mt-1">{lesson.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {lesson.video_url ? (
                        <span className="text-xs text-green-600">✅ Video uploaded</span>
                      ) : (
                        <span className="text-xs text-yellow-600">⚠️ No video</span>
                      )}
                      {lesson.pdf_url ? (
                        <span className="text-xs text-green-600">✅ PDF uploaded</span>
                      ) : (
                        <span className="text-xs text-slate-400">📄 No PDF</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setEditingLesson(lesson.id)}
                      className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => videoInputRefs.current[lesson.id]?.click()}
                      className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      📹 Video
                    </button>
                    <input
                      type="file"
                      ref={(el) => { if (el) videoInputRefs.current[lesson.id] = el; }}
                      accept="video/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) uploadFile(lesson.id, e.target.files[0], 'video');
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => pdfInputRefs.current[lesson.id]?.click()}
                      className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      📄 PDF
                    </button>
                    <input
                      type="file"
                      ref={(el) => { if (el) pdfInputRefs.current[lesson.id] = el; }}
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) uploadFile(lesson.id, e.target.files[0], 'pdf');
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => deleteLesson(lesson.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline editor for description */}
                {editingLesson === lesson.id && (
                  <div className="mt-3 ml-12 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <textarea
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows="2"
                      defaultValue={lesson.description || ''}
                      placeholder="Lesson description (optional)"
                      id={`desc-${lesson.id}`}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          const desc = document.getElementById(`desc-${lesson.id}`).value;
                          updateLessonDescription(lesson.id, desc);
                        }}
                        className="bg-brand-blue text-white px-4 py-1 rounded-full text-sm font-bold hover:opacity-90"
                      >
                        Save Description
                      </button>
                      <button
                        onClick={() => setEditingLesson(null)}
                        className="bg-slate-200 px-4 py-1 rounded-full text-sm font-bold hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview uploaded video and PDF */}
                {lesson.video_url && (
                  <div className="mt-2 ml-12">
                    <video src={lesson.video_url} controls className="h-24 rounded-lg" />
                  </div>
                )}
                {lesson.pdf_url && (
                  <div className="mt-2 ml-12">
                    <a href={lesson.pdf_url} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline text-sm">
                      📄 View PDF
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {uploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-brand-yellow h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
          </div>
        )}
      </section>
    </div>
  );
}