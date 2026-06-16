'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function AdminCourseEditorPage() {
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    const supabase = createBrowserClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/login'); return; }

      // Load course details
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

        // Load lessons
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        setLessons(lessonsData || []);
      } else {
        // New course mode
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

  async function handleSaveCourse() {
    setSaving(true);
    const supabase = createBrowserClient();

    if (courseId === 'new') {
      // Create new course
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
      // Update existing
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Thumbnail URL</label>
            <input
              type="text"
              value={formData.thumbnail_url}
              onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
              placeholder="https://..."
            />
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
              <div key={lesson.id} className="flex items-center gap-4 py-3">
                <div className="font-bold text-brand-blue w-8">{idx + 1}.</div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{lesson.title}</p>
                  {!lesson.video_url && <p className="text-xs text-yellow-600">⚠️ No video yet</p>}
                </div>
                <button
                  onClick={() => deleteLesson(lesson.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}