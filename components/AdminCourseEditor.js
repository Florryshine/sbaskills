'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

const emptyCourse = {
  title: '',
  description: '',
  price: 0,
  thumbnail_url: '',
  is_published: false
};

const emptyLesson = {
  title: '',
  description: '',
  video_url: '',
  duration: '',
  order_index: 1,
  is_published: false
};

export default function AdminCourseEditor({ course = null, initialLessons = [] }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [courseForm, setCourseForm] = useState(course || emptyCourse);
  const [lessons, setLessons] = useState(initialLessons);
  const [savingCourse, setSavingCourse] = useState(false);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingLessonId, setEditingLessonId] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);
  const [uploadingField, setUploadingField] = useState('');

  const saveCourse = async (event) => {
    event.preventDefault();

    try {
      setSavingCourse(true);

      if (course?.id) {
        const { error } = await supabase.from('courses').update(courseForm).eq('id', course.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('courses').insert(courseForm).select('*').single();
        if (error) throw error;
        router.push(`/admin/courses/${data.id}`);
      }

      router.refresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingCourse(false);
    }
  };

  const uploadAsset = async (file, fieldName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resourceType', fieldName === 'thumbnail_url' ? 'image' : 'video');

    const response = await fetch('/api/upload-video', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed.');
    }

    return data.secure_url;
  };

  const handleCourseFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingField('thumbnail_url');
      const url = await uploadAsset(file, 'thumbnail_url');
      setCourseForm((current) => ({ ...current, thumbnail_url: url }));
    } catch (error) {
      alert(error.message);
    } finally {
      setUploadingField('');
      event.target.value = '';
    }
  };

  const handleLessonVideoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingField('video_url');
      const url = await uploadAsset(file, 'video_url');
      setLessonForm((current) => ({ ...current, video_url: url }));
    } catch (error) {
      alert(error.message);
    } finally {
      setUploadingField('');
      event.target.value = '';
    }
  };

  const saveLesson = async (event) => {
    event.preventDefault();

    if (!course?.id) {
      alert('Save the course before adding lessons.');
      return;
    }

    try {
      setSavingLesson(true);

      if (editingLessonId) {
        const { data, error } = await supabase
          .from('lessons')
          .update({ ...lessonForm, course_id: course.id })
          .eq('id', editingLessonId)
          .select('*')
          .single();
        if (error) throw error;
        setLessons((current) => current.map((lesson) => (lesson.id === editingLessonId ? data : lesson)));
      } else {
        const { data, error } = await supabase
          .from('lessons')
          .insert({ ...lessonForm, course_id: course.id })
          .select('*')
          .single();
        if (error) throw error;
        setLessons((current) => [...current, data].sort((a, b) => a.order_index - b.order_index));
      }

      setLessonForm(emptyLesson);
      setEditingLessonId('');
      router.refresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingLesson(false);
    }
  };

  const editLesson = (lesson) => {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      description: lesson.description,
      video_url: lesson.video_url || '',
      duration: lesson.duration || '',
      order_index: lesson.order_index,
      is_published: lesson.is_published
    });
  };

  const deleteLesson = async (lessonId) => {
    const confirmed = window.confirm('Delete this lesson?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
      if (error) throw error;
      setLessons((current) => current.filter((lesson) => lesson.id !== lessonId));
      router.refresh();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-brand-blue">{course?.id ? 'Edit Course' : 'Create New Course'}</h2>
          <p className="mt-2 text-sm text-slate-600">Set the title, pricing, cover image, and publishing status.</p>
        </div>
        <form onSubmit={saveCourse} className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Course Title</label>
            <input
              value={courseForm.title}
              onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-brand-blue"
              required
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={courseForm.description}
              onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Price in Naira</label>
            <input
              type="number"
              min="0"
              value={courseForm.price}
              onChange={(event) => setCourseForm((current) => ({ ...current, price: Number(event.target.value) }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Publish Status</label>
            <select
              value={courseForm.is_published ? 'true' : 'false'}
              onChange={(event) => setCourseForm((current) => ({ ...current, is_published: event.target.value === 'true' }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-brand-blue"
            >
              <option value="false">Unpublished</option>
              <option value="true">Published</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Thumbnail URL</label>
            <input
              value={courseForm.thumbnail_url || ''}
              onChange={(event) => setCourseForm((current) => ({ ...current, thumbnail_url: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-brand-blue"
              placeholder="https://..."
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Upload Thumbnail</label>
            <input type="file" accept="image/*" onChange={handleCourseFileChange} className="block w-full text-sm text-slate-600" />
            {uploadingField === 'thumbnail_url' ? <p className="mt-2 text-sm text-brand-blue">Uploading thumbnail...</p> : null}
          </div>
          <div className="lg:col-span-2 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={savingCourse}
              className="rounded-full bg-brand-blue px-6 py-3 text-sm font-bold text-white disabled:opacity-70"
            >
              {savingCourse ? 'Saving...' : course?.id ? 'Update Course' : 'Create Course'}
            </button>
            {courseForm.thumbnail_url ? (
              <a href={courseForm.thumbnail_url} target="_blank" className="text-sm font-semibold text-brand-blue underline" rel="noreferrer">
                Preview Thumbnail
              </a>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-brand-blue">Lessons</h2>
          <p className="mt-2 text-sm text-slate-600">Add, edit, publish, and upload lesson videos.</p>
        </div>
        <form onSubmit={saveLesson} className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Lesson Title</label>
            <input
              value={lessonForm.title}
              onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Order Number</label>
            <input
              type="number"
              min="1"
              value={lessonForm.order_index}
              onChange={(event) => setLessonForm((current) => ({ ...current, order_index: Number(event.target.value) }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              rows={4}
              value={lessonForm.description}
              onChange={(event) => setLessonForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Duration</label>
            <input
              value={lessonForm.duration}
              onChange={(event) => setLessonForm((current) => ({ ...current, duration: event.target.value }))}
              placeholder="e.g. 18 mins"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Publish Status</label>
            <select
              value={lessonForm.is_published ? 'true' : 'false'}
              onChange={(event) => setLessonForm((current) => ({ ...current, is_published: event.target.value === 'true' }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
            >
              <option value="false">Unpublished</option>
              <option value="true">Published</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Video URL</label>
            <input
              value={lessonForm.video_url || ''}
              onChange={(event) => setLessonForm((current) => ({ ...current, video_url: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              placeholder="https://res.cloudinary.com/..."
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Upload Video</label>
            <input type="file" accept="video/*" onChange={handleLessonVideoChange} className="block w-full text-sm text-slate-600" />
            {uploadingField === 'video_url' ? <p className="mt-2 text-sm text-brand-blue">Uploading video...</p> : null}
          </div>
          <div className="lg:col-span-2 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={savingLesson} className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark disabled:opacity-70">
              {savingLesson ? 'Saving lesson...' : editingLessonId ? 'Update Lesson' : 'Add Lesson'}
            </button>
            {editingLessonId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingLessonId('');
                  setLessonForm(emptyLesson);
                }}
                className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-10 space-y-4">
          {lessons.length ? (
            lessons
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((lesson) => (
                <div key={lesson.id} className="rounded-2xl border border-slate-100 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold text-brand-blue">{lesson.order_index}. {lesson.title}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${lesson.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {lesson.is_published ? 'Published' : 'Draft'}
                        </span>
                        {!lesson.video_url ? <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-dark">Coming Soon</span> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{lesson.description}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{lesson.duration || 'No duration set'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => editLesson(lesson)} className="rounded-full border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue">
                        Edit
                      </button>
                      <button onClick={() => deleteLesson(lesson.id)} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              Save the course first, then start adding lessons.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
