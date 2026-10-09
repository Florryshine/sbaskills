'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import BiteSizedLessonEditor from '@/components/BiteSizedLessonEditor';
import { COURSE_UNIVERSES } from '@/lib/universes';

export default function AdminCourseEditorPage() {
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [settingUpWeek, setSettingUpWeek] = useState(false);
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
    universe: 'GENERAL',
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
            universe: courseData.universe || 'GENERAL',
          });
        }

        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        const { data: modulesData } = await supabase
          .from('course_modules')
          .select('*')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        setLessons(lessonsData || []);
        setModules(modulesData || []);
      } else {
        setCourse({ id: 'new' });
        setFormData({
          title: '',
          description: '',
          price: '',
          thumbnail_url: '',
          color: '#1a73e8',
          is_published: false,
          universe: 'GENERAL',
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

    if (!formData.title) {
      alert('Please enter a course title before saving.');
      setSaving(false);
      return;
    }

    setSaving(true);
    const supabase = createBrowserClient();
    const isNew = !courseId || courseId === 'new';

    try {
      const courseData = {
        title: formData.title,
        description: formData.description,
        price: parseInt(formData.price) || 0,
        thumbnail_url: formData.thumbnail_url,
        color: formData.color,
        is_published: formData.is_published,
        universe: formData.universe,
      };
      console.log(isNew ? 'Inserting with:' : 'Updating with:', courseData);

      let updatedCourse, dbError;

      if (isNew) {
        const { data, error } = await supabase
          .from('courses')
          .insert(courseData)
          .select()
          .single();
        updatedCourse = data;
        dbError = error;
      } else {
        const { error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', courseId);
        dbError = error;
        if (!error) {
          const { data, error: fetchError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', courseId)
            .single();
          updatedCourse = data;
          dbError = fetchError;
        }
      }

      if (dbError) throw new Error(dbError.message);
      console.log(isNew ? '✅ Insert successful' : '✅ Update successful');

      // Update local state with fresh data
      setCourse(updatedCourse);
      setFormData({
        title: updatedCourse.title || '',
        description: updatedCourse.description || '',
        price: updatedCourse.price?.toString() || '',
        thumbnail_url: updatedCourse.thumbnail_url || '',
        color: updatedCourse.color || '#1a73e8',
        is_published: updatedCourse.is_published || false,
        universe: updatedCourse.universe || 'GENERAL',
      });

      alert(isNew ? '✅ Course created successfully!' : '✅ Course updated successfully!');

      // Move from /new to the real course id so lessons/uploads work
      if (isNew && updatedCourse?.id) {
        router.replace(`/admin/courses/${updatedCourse.id}`);
      }
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

  async function setupFirstWeek() {
    if (!courseId || courseId === 'new') {
      alert('Save the course first, then create the Week 1 plan.');
      return;
    }
    if (!confirm('Create the Week 1 starter structure for this course? Existing lessons and modules will be kept. Missing starter items will be added as unpublished drafts.')) return;

    setSettingUpWeek(true);
    try {
      const weekPlan = [
        { title: 'Week 1 · Day 1 — Welcome & Baseline', lessonTitle: 'Day 1: Welcome and Baseline Check', description: 'Introduce the class, explain how to use the course, and complete a short baseline diagnostic.', content: '<h2>Welcome to Week 1</h2><p>Start by reviewing the course goals and how lessons, practice and progress tracking work.</p><h3>Class tasks</h3><ol><li>Read the course description and learning expectations.</li><li>Write down your target score or grade.</li><li>Complete a short baseline practice set with no pressure to score perfectly.</li><li>Record the topics you found difficult.</li></ol><p><strong>Teacher:</strong> Add your class instructions and diagnostic link before publishing this lesson.</p>' },
        { title: 'Week 1 · Day 2 — English Language', lessonTitle: 'Day 2: English Language Focus', description: 'Start the English Language routine with a focused topic, practice questions and review.', content: '<h2>English Language Focus</h2><p>Choose the first English topic for this class and add your teaching notes or resource below.</p><h3>Class tasks</h3><ol><li>Review the selected topic or lesson material.</li><li>Answer a short set of English practice questions.</li><li>Read every explanation, including explanations for correct answers.</li><li>List unfamiliar words or question patterns for review.</li></ol><p><strong>Teacher:</strong> Replace this starter text with the actual Week 1 topic and class material.</p>' },
        { title: 'Week 1 · Day 3 — Subject Focus A', lessonTitle: 'Day 3: Subject Focus A', description: 'Teach one of the student’s other exam subjects and practise the topic taught.', content: '<h2>Subject Focus A</h2><p>Set the first non-English subject focus for the class.</p><h3>Class tasks</h3><ol><li>Read or attend the lesson for the selected topic.</li><li>Make concise notes on key facts, formulas or concepts.</li><li>Answer topic-based practice questions.</li><li>Write down mistakes to discuss in class.</li></ol><p><strong>Teacher:</strong> Change the subject and topic, then attach the relevant resource before publishing.</p>' },
        { title: 'Week 1 · Day 4 — Subject Focus B', lessonTitle: 'Day 4: Subject Focus B', description: 'Cover another selected exam subject and check understanding with practice.', content: '<h2>Subject Focus B</h2><p>Use this session for another subject in the class subject combination.</p><h3>Class tasks</h3><ol><li>Review the selected lesson material.</li><li>Attempt practice questions without checking answers first.</li><li>Review explanations and correct errors in your notes.</li><li>Bring difficult questions to the next class discussion.</li></ol><p><strong>Teacher:</strong> Replace this starter text with the actual subject, topic and resource before publishing.</p>' },
        { title: 'Week 1 · Day 5 — Mixed Practice & Review', lessonTitle: 'Day 5: Mixed Practice and Weekly Review', description: 'Review the week, practise across covered topics and identify next steps.', content: '<h2>Week 1 Review</h2><p>Use only topics already covered this week for this review.</p><h3>Class tasks</h3><ol><li>Complete a mixed practice set from the week’s topics.</li><li>Review your score and identify the three most difficult topics.</li><li>Revisit the explanations for every missed question.</li><li>Set one specific target for Week 2.</li></ol><p><strong>Teacher:</strong> Add the weekly quiz or practice link and the instructions for submitting questions.</p>' },
      ];
      const { data: existingModules, error: modulesError } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
      if (modulesError) throw modulesError;
      const { data: existingLessons, error: lessonsError } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
      if (lessonsError) throw lessonsError;
      let moduleRows = existingModules || [];
      let lessonRows = existingLessons || [];
      for (let index = 0; index < weekPlan.length; index++) {
        const item = weekPlan[index];
        let module = moduleRows.find(row => row.title === item.title);
        if (!module) {
          const { data, error } = await supabase.from('course_modules').insert({ course_id: courseId, title: item.title, description: item.description, order_index: moduleRows.length ? Math.max(...moduleRows.map(row => Number(row.order_index) || 0)) + 1 : index, is_published: true }).select('*').single();
          if (error) throw error;
          module = data;
          moduleRows = [...moduleRows, data];
        }
        const existingLesson = lessonRows.find(row => row.title === item.lessonTitle);
        if (!existingLesson) {
          const nextOrder = lessonRows.length ? Math.max(...lessonRows.map(row => Number(row.order_index) || 0)) + 1 : 1;
          const { data, error } = await supabase.from('lessons').insert({ course_id: courseId, module_id: module.id, title: item.lessonTitle, description: item.description, text_content: item.content, content_type: 'text', order_index: nextOrder, is_published: false }).select('*').single();
          if (error) throw error;
          lessonRows = [...lessonRows, data];
        } else if (!existingLesson.module_id) {
          const { error } = await supabase.from('lessons').update({ module_id: module.id }).eq('id', existingLesson.id);
          if (error) throw error;
          lessonRows = lessonRows.map(row => row.id === existingLesson.id ? { ...row, module_id: module.id } : row);
        }
      }
      setModules(moduleRows.sort((a, b) => a.order_index - b.order_index));
      setLessons(lessonRows.sort((a, b) => a.order_index - b.order_index));
      alert('Week 1 starter structure is ready. The five lessons are unpublished drafts. Edit the subjects, add real class materials and publish each lesson when ready.');
    } catch (error) {
      console.error('Week 1 setup failed:', error);
      alert('We could not finish the Week 1 setup: ' + (error?.message || 'Unknown error') + '. You can run setup again; existing starter items will be kept.');
    } finally {
      setSettingUpWeek(false);
    }
  }
  async function addModule() {
    const title = prompt('Module/topic title:');
    if (!title) return;
    const { data, error } = await supabase
      .from('course_modules')
      .insert({ course_id: courseId, title, order_index: modules.length, is_published: true })
      .select('*')
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setModules((current) => [...current, data].sort((a, b) => a.order_index - b.order_index));
  }

  async function assignLessonModule(lessonId, moduleId) {
    const { error } = await supabase
      .from('lessons')
      .update({ module_id: moduleId || null })
      .eq('id', lessonId);
    if (error) {
      alert(error.message);
      return;
    }
    setLessons((current) => current.map((lesson) => lesson.id === lessonId ? { ...lesson, module_id: moduleId || null } : lesson));
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Learning World</label>
            <select
              value={formData.universe}
              onChange={e => setFormData({ ...formData, universe: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
            >
              {COURSE_UNIVERSES.map((universe) => (
                <option key={universe.key} value={universe.key}>{universe.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Controls which student world this course appears in.</p>
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

      {/* Modules / Topics */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-brand-blue">Modules / Topics</h2>
            <p className="mt-1 text-xs text-slate-500">Optional grouping for mixed video and bite-sized courses. Lessons may remain ungrouped.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={setupFirstWeek} disabled={settingUpWeek || !courseId || courseId === 'new'} className="rounded-full bg-blue-50 px-4 py-2 text-xs font-bold text-brand-blue disabled:opacity-50">{settingUpWeek ? 'Preparing Week 1...' : '🗓️ Set up Week 1'}</button>
            <button onClick={addModule} className="rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark">+ Add Module</button>
          </div>
        </div>
        {modules.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {modules.map((module, index) => (
              <div key={module.id} className="rounded-xl border border-slate-100 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Module {index + 1}</p>
                <p className="font-semibold text-slate-800">{module.title}</p>
                <p className="text-xs text-slate-500">{lessons.filter((lesson) => lesson.module_id === module.id).length} lessons</p>
              </div>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">No modules yet. The course will use its flat lesson list.</p>}
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
                        <option value="bite_sized">✨ Bite-Sized</option>
                      </select>

                      <select
                        value={lesson.module_id || ''}
                        onChange={(event) => assignLessonModule(lesson.id, event.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                        aria-label="Assign lesson to module"
                      >
                        <option value="">No module</option>
                        {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
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

                      {lesson.content_type === 'bite_sized' && (
                        <BiteSizedLessonEditor
                          lesson={lesson}
                          onLessonUpdated={(updatedLesson) => {
                            setLessons((current) => current.map((item) => item.id === lesson.id ? updatedLesson : item));
                          }}
                        />
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