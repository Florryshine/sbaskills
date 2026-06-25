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
  const fileInputRef = useRef(null);
  const videoInputRefs = useRef({});
  const pdfInputRefs = useRef({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    thumbnail_url: '',
    color: '#1a73e8',
    is_published: false,
  });
  const router = useRouter();
  const params = useParams();
  const courseId = params.id;
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
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

  // ----- UPLOAD FUNCTIONS -----
  async function uploadImage(file) {
    setUploading(true);
    setUploadProgress(0);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `courses/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('course-thumbnails')
      .upload(filePath, file);

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

  async function uploadVideo(lessonId, file) {
    setUploading(true);
    setUploadProgress(0);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `lessons/${lessonId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('lesson-videos')
      .upload(filePath, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('lesson-videos')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('lessons')
      .update({ video_url: urlData.publicUrl })
      .eq('id', lessonId);

    if (updateError) {
      alert('Update failed: ' + updateError.message);
    } else {
      setLessons(lessons.map(l => 
        l.id === lessonId ? { ...l, video_url: urlData.publicUrl } : l
      ));
      alert('Video uploaded successfully!');
    }
    setUploading(false);
    setUploadProgress(0);
  }

  async function uploadPDF(lessonId, file) {
    setUploading(true);
    setUploadProgress(0);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `lessons/${lessonId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('lesson-pdfs')
      .upload(filePath, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('lesson-pdfs')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('lessons')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', lessonId);

    if (updateError) {
      alert('Update failed: ' + updateError.message);
    } else {
      setLessons(lessons.map(l => 
        l.id === lessonId ? { ...l, pdf_url: urlData.publicUrl } : l
      ));
      alert('PDF uploaded successfully!');
    }
    setUploading(false);
    setUploadProgress(0);
  }

  // ----- COURSE CRUD -----
  async function handleSaveCourse() {
    console.log('🟢 handleSaveCourse called');
    console.log('courseId:', courseId);
    console.log('formData:', formData);

    if (!courseId || courseId === 'new') {
      alert('No course selected or this is a new course.');
      setSaving(false);
      return;
    }

    setSaving(true);
    const supabase = createBrowserClient();

    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        price: parseInt(formData.price) || 0,
        thumbnail_url: formData.thumbnail_url,
        color: formData.color,
        is_published: formData.is_published,
      };
      console.log('Updating with:', updateData);

      const { error } = await supabase
        .from('courses')
        .update(updateData)
        .eq('id', courseId);

      if (error) throw new Error(error.message);
      console.log('✅ Update successful');

      // Fetch updated course data
      const { data: updatedCourse, error: fetchError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      // Update local state with fresh data
      setCourse(updatedCourse);
      setFormData({
        title: updatedCourse.title || '',
        description: updatedCourse.description || '',
        price: updatedCourse.price?.toString() || '',
        thumbnail_url: updatedCourse.thumbnail_url || '',
        color: updatedCourse.color || '#1a73e8',
        is_published: updatedCourse.is_published || false,
      });

      alert('✅ Course updated successfully!');
    } catch (error) {
      console.error('❌ Error:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  // ----- LESSON CRUD -----
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
        is_published: true,
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

      {/* Course Details Form */}
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

      {/* Lessons Manager */}
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
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {/* Content Type Dropdown */}
                      <select
                        value={lesson.content_type || 'video'}
                        onChange={async (e) => {
                          const newType = e.target.value;
                          const supabase = createBrowserClient();
                          await supabase
                            .from('lessons')
                            .update({ content_type: newType })
                            .eq('id', lesson.id);
                          setLessons(lessons.map(l => 
                            l.id === lesson.id ? { ...l, content_type: newType } : l
                          ));
                        }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                      >
                        <option value="video">🎬 Video</option>
                        <option value="text">📝 Text</option>
                        <option value="pdf">📄 PDF</option>
                      </select>

                      {lesson.content_type === 'video' && (
                        <>
                          {lesson.video_url ? (
                            <span className="text-xs text-green-600">✅ Video uploaded</span>
                          ) : (
                            <span className="text-xs text-yellow-600">⚠️ No video yet</span>
                          )}
                          <button
                            onClick={() => videoInputRefs.current[lesson.id]?.click()}
                            className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                          >
                            📹 Upload Video
                          </button>
                          <input
                            type="file"
                            ref={(el) => { if (el) videoInputRefs.current[lesson.id] = el; }}
                            accept="video/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) uploadVideo(lesson.id, e.target.files[0]);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          {lesson.video_url && (
                            <div className="w-full mt-2">
                              <video src={lesson.video_url} controls className="h-24 rounded-lg" />
                            </div>
                          )}
                        </>
                      )}

                      {lesson.content_type === 'text' && (
                        <div className="w-full mt-2">
                          <textarea
                            placeholder="Enter lesson content (HTML allowed)"
                            rows="3"
                            value={lesson.text_content || ''}
                            onChange={async (e) => {
                              const newText = e.target.value;
                              const supabase = createBrowserClient();
                              await supabase
                                .from('lessons')
                                .update({ text_content: newText })
                                .eq('id', lesson.id);
                              setLessons(lessons.map(l => 
                                l.id === lesson.id ? { ...l, text_content: newText } : l
                              ));
                            }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      )}

                      {lesson.content_type === 'pdf' && (
                        <div className="flex items-center gap-2">
                          {lesson.pdf_url ? (
                            <a href={lesson.pdf_url} target="_blank" className="text-xs text-blue-600 underline">📄 View PDF</a>
                          ) : (
                            <span className="text-xs text-yellow-600">⚠️ No PDF yet</span>
                          )}
                          <button
                            onClick={() => pdfInputRefs.current[lesson.id]?.click()}
                            className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                          >
                            📄 Upload PDF
                          </button>
                          <input
                            type="file"
                            ref={(el) => { if (el) pdfInputRefs.current[lesson.id] = el; }}
                            accept=".pdf"
                            onChange={(e) => {
                              if (e.target.files?.[0]) uploadPDF(lesson.id, e.target.files[0]);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteLesson(lesson.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
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