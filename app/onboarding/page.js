'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

const states = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const subjects = ['Biology','Chemistry','Physics','Mathematics','English','Government','Economics','Commerce','Accounting','History','Geography','Computer Science','Literature in English','Christian Religious Studies','Islamic Studies','Agricultural Science','Fine Arts'];
const utmeChoices = subjects.filter((subject) => subject !== 'English');
const examOptions = ['JAMB','WAEC','NECO','GCE','BECE','University','Other'];
const initialAnswers = {
  date_of_birth: '', age_group: '', target_exams: [], interests: [], student_level: '',
  institution_name: '', institution_type: '', state: '', guardian_name: '', guardian_phone: '', guardian_email: '',
  avatar_url: '', avatar_public_id: '', testimonial_consent: false, target_score: '', previous_jamb_score: '',
  jamb_attempts: '', target_course: '', preferred_institution: '', utme_subjects: ['English'], weak_subjects: [],
  study_time: '', study_challenges: '', device_access: '', internet_access: '', support_needs: [],
  referral_source: '', goal_title: '', goal_target: '', motivation: ''
};
const steps = [
  { title: 'Let’s set up your student profile', description: 'Help us recognise you and understand your current school level.' },
  { title: 'Your exams and experience', description: 'Tell us which exams you are preparing for and any previous JAMB experience.' },
  { title: 'Your admission target', description: 'Choose a score, course, institution and the subjects you will write.' },
  { title: 'Your parent or guardian', description: 'These contact details are private and used for relevant student support.' },
  { title: 'How you learn best', description: 'Help us understand your challenges and the support that will help you.' },
  { title: 'Your goal and review', description: 'Review your details and save your profile.' }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [answers, setAnswers] = useState(initialAnswers);
  const [step, setStep] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const editMode = new URLSearchParams(window.location.search).get('edit') === '1';
      if (!active) return;
      setIsEditMode(editMode);
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data?.user) { router.replace('/login'); return; }
      setUser(data.user);
      const fields = 'full_name,date_of_birth,age_group,target_exams,interests,student_level,institution_name,institution_type,state,guardian_name,guardian_phone,guardian_email,avatar_url,avatar_public_id,testimonial_consent,target_score,previous_jamb_score,jamb_attempts,target_course,preferred_institution,utme_subjects,weak_subjects,study_time,study_challenges,device_access,internet_access,support_needs,referral_source,goal_title,goal_target,motivation,onboarding_completed';
      const { data: profile, error: profileError } = await supabase.from('profiles').select(fields).eq('id', data.user.id).maybeSingle();
      if (!active) return;
      if (profileError) {
        setErrorMessage('We could not load your saved profile. Please refresh and try again.');
      } else if (profile?.onboarding_completed && !editMode) {
        router.replace('/dashboard');
        return;
      }
      if (profile) {
        const mapped = { ...initialAnswers };
        Object.keys(initialAnswers).forEach((key) => {
          if (profile[key] !== null && profile[key] !== undefined) mapped[key] = profile[key];
        });
        mapped.target_exams = Array.isArray(profile.target_exams) ? profile.target_exams : [];
        mapped.interests = Array.isArray(profile.interests) ? profile.interests : [];
        mapped.utme_subjects = Array.isArray(profile.utme_subjects) && profile.utme_subjects.length ? profile.utme_subjects : ['English'];
        mapped.weak_subjects = Array.isArray(profile.weak_subjects) ? profile.weak_subjects : [];
        mapped.support_needs = Array.isArray(profile.support_needs) ? profile.support_needs : [];
        setAnswers((prev) => ({ ...prev, ...mapped }));
        if (profile.avatar_url) setPhotoPreview(profile.avatar_url);
      }
      try {
        const draft = window.localStorage.getItem('sba_onboarding_' + data.user.id);
        if (draft && !editMode) {
          const parsed = JSON.parse(draft);
          if (parsed.answers) setAnswers((prev) => ({ ...prev, ...parsed.answers }));
          if (Number.isInteger(parsed.step) && parsed.step >= 0 && parsed.step < steps.length) setStep(parsed.step);
        }
      } catch (e) { console.warn('Could not restore onboarding draft.', e); }
      setPageLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!user?.id || isEditMode) return;
    try { window.localStorage.setItem('sba_onboarding_' + user.id, JSON.stringify({ answers, step })); }
    catch (e) { console.warn('Could not save onboarding draft.', e); }
  }, [answers, step, user, isEditMode]);

  const update = (field, value) => setAnswers((prev) => ({ ...prev, [field]: value }));
  const toggle = (field, value) => setAnswers((prev) => ({
    ...prev,
    [field]: prev[field].includes(value) ? prev[field].filter((item) => item !== value) : [...prev[field], value]
  }));
  const toggleUtme = (value) => setAnswers((prev) => {
    const current = prev.utme_subjects.filter((item) => item !== 'English');
    const next = current.includes(value) ? current.filter((item) => item !== value) : current.length < 3 ? [...current, value] : current;
    return { ...prev, utme_subjects: ['English', ...next] };
  });

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setErrorMessage('Choose a JPG, PNG or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setErrorMessage('Your photo must be 5 MB or smaller.'); return; }
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/student-profile-photo', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Photo upload failed.');
      setAnswers((prev) => ({ ...prev, avatar_url: result.secure_url, avatar_public_id: result.public_id }));
      setPhotoPreview(result.secure_url);
    } catch (error) {
      setPhotoPreview(answers.avatar_url || '');
      setErrorMessage(error.message || 'Photo upload failed. Please try again.');
    } finally { setUploadingPhoto(false); }
  };

  const handleSubmit = async () => {
    if (!user?.id) { setErrorMessage('Your session has expired. Please sign in again.'); return; }
    if (!answers.target_exams.length) { setErrorMessage('Select at least one exam or study path.'); setStep(1); return; }
    if (answers.target_exams.includes('JAMB') && answers.utme_subjects.filter((item) => item !== 'English').length !== 3) {
      setErrorMessage('For JAMB, choose exactly three UTME subjects in addition to English.'); setStep(2); return;
    }
    if (!answers.guardian_phone.trim()) { setErrorMessage('Please add a parent or guardian phone number.'); setStep(3); return; }
    if (uploadingPhoto) { setErrorMessage('Please wait for your photo upload to finish.'); setStep(0); return; }
    setLoading(true);
    setErrorMessage('');
    try {
      const score = answers.target_score === '' ? null : Number(answers.target_score);
      const previousScore = answers.previous_jamb_score === '' ? null : Number(answers.previous_jamb_score);
      const attempts = answers.jamb_attempts === '' ? null : Number(answers.jamb_attempts);
      const payload = {
        date_of_birth: answers.date_of_birth || null,
        age_group: answers.age_group || null,
        target_exams: answers.target_exams,
        interests: answers.interests,
        student_level: answers.student_level || null,
        institution_name: answers.institution_name.trim() || null,
        institution_type: answers.institution_type || null,
        state: answers.state || null,
        guardian_name: answers.guardian_name.trim() || null,
        guardian_phone: answers.guardian_phone.trim(),
        guardian_email: answers.guardian_email.trim() || null,
        avatar_url: answers.avatar_url || null,
        avatar_public_id: answers.avatar_public_id || null,
        testimonial_consent: answers.testimonial_consent,
        target_score: score,
        previous_jamb_score: previousScore,
        jamb_attempts: attempts,
        target_course: answers.target_course.trim() || null,
        preferred_institution: answers.preferred_institution.trim() || null,
        utme_subjects: answers.utme_subjects,
        weak_subjects: answers.weak_subjects,
        study_time: answers.study_time || null,
        study_challenges: answers.study_challenges.trim() || null,
        device_access: answers.device_access || null,
        internet_access: answers.internet_access || null,
        support_needs: answers.support_needs,
        referral_source: answers.referral_source || null,
        goal_title: answers.goal_title.trim() || (score ? 'Score ' + score + ' in JAMB' : null),
        goal_target: answers.goal_target.trim() || null,
        motivation: answers.motivation || null,
        onboarding_completed: true
      };
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) throw error;
      if (answers.target_exams.includes('JAMB')) {
        const { error: targetError } = await supabase.from('student_exam_targets')
          .upsert({ user_id: user.id, exam_type: 'JAMB', exam_year: 2027, status: 'active' }, { onConflict: 'user_id,exam_type,exam_year' });
        if (targetError) console.warn('JAMB exam target record was not updated:', targetError.message);
      }
      try { window.localStorage.removeItem('sba_onboarding_' + user.id); } catch (e) {}
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setErrorMessage(error?.message || 'We could not save your details. Please try again.');
    } finally { setLoading(false); }
  };

  const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const labelClass = 'block text-sm font-semibold text-slate-700';
  const chip = (field, values) => (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button key={value} type="button" onClick={() => toggle(field, value)}
          className={'rounded-full border px-3 py-2 text-sm font-semibold ' + (answers[field].includes(value) ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400')}>
          {value}
        </button>
      ))}
    </div>
  );

  const renderStep = () => {
    if (step === 0) return (
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-4">
          <label className={labelClass}>Student headshot <span className="font-normal text-slate-400">(optional)</span></label>
          <p className="mt-1 text-xs text-slate-500">A clear face photo helps us recognise your profile. JPG, PNG or WebP, max 5 MB.</p>
          {photoPreview ? <img src={photoPreview} alt="Student profile preview" className="mt-3 h-24 w-24 rounded-full border object-cover" /> : null}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} className="mt-3 block w-full text-sm" />
          {uploadingPhoto ? <p className="mt-2 text-xs text-blue-700">Uploading photo…</p> : null}
          {answers.avatar_url ? <p className="mt-2 text-xs text-green-700">Photo saved. Choose another image to replace it.</p> : null}
        </div>
        <div><label className={labelClass}>Date of birth <span className="font-normal text-slate-400">(optional)</span></label><input type="date" className={fieldClass} value={answers.date_of_birth || ''} onChange={(e) => update('date_of_birth', e.target.value)} /></div>
        <div><label className={labelClass}>Age group</label><select className={fieldClass} value={answers.age_group} onChange={(e) => update('age_group', e.target.value)}><option value="">Prefer not to say</option><option>Under 15</option><option>15–17</option><option>18–20</option><option>21 and above</option></select></div>
        <div><label className={labelClass}>Current level</label><select className={fieldClass} value={answers.student_level} onChange={(e) => update('student_level', e.target.value)}><option value="">Select level</option><option>JSS1</option><option>JSS2</option><option>JSS3</option><option>SS1</option><option>SS2</option><option>SS3</option><option>JAMB candidate</option><option>Undergraduate</option><option>Other</option></select></div>
        <div><label className={labelClass}>School / institution type</label><select className={fieldClass} value={answers.institution_type} onChange={(e) => update('institution_type', e.target.value)}><option value="">Select type</option><option>Secondary School</option><option>University</option><option>Polytechnic</option><option>College of Education</option><option>Private Candidate</option><option>Other</option></select></div>
        <div><label className={labelClass}>School / institution name</label><input className={fieldClass} value={answers.institution_name} onChange={(e) => update('institution_name', e.target.value)} placeholder="Your school name" /></div>
        <div><label className={labelClass}>State</label><select className={fieldClass} value={answers.state} onChange={(e) => update('state', e.target.value)}><option value="">Select state</option>{states.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
    );
    if (step === 1) return (
      <div className="space-y-6">
        <div><p className={labelClass}>Which exams are you preparing for? *</p><p className="mb-3 mt-1 text-xs text-slate-500">Select all that apply.</p>{chip('target_exams', examOptions)}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Have you written JAMB before?</label><select className={fieldClass} value={answers.jamb_attempts} onChange={(e) => update('jamb_attempts', e.target.value)}><option value="">Not answered</option><option value="0">No, this is my first attempt</option><option value="1">Once</option><option value="2">Twice</option><option value="3">Three times</option><option value="4">Four or more times</option></select></div>
          <div><label className={labelClass}>Previous JAMB score <span className="font-normal text-slate-400">(optional)</span></label><input type="number" min="0" max="400" className={fieldClass} value={answers.previous_jamb_score} onChange={(e) => update('previous_jamb_score', e.target.value)} placeholder="0–400" /></div>
        </div>
        <div><p className={labelClass}>Subjects you want help with</p><p className="mb-3 mt-1 text-xs text-slate-500">Select any subjects you want to practise or improve.</p>{chip('interests', subjects)}</div>
      </div>
    );
    if (step === 2) return (
      <div className="space-y-6">
        <div><label className={labelClass}>Target JAMB score</label><select className={fieldClass} value={answers.target_score} onChange={(e) => update('target_score', e.target.value)}><option value="">Choose your target score</option>{[100,120,140,160,180,200,220,240,260,280,290,300,310,320,330,340,350,360,370,380,390,400].map((score) => <option key={score} value={score}>{score} / 400</option>)}</select><p className="mt-1 text-xs text-slate-500">Choose a score you are aiming for. You can change it later.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Intended course</label><input className={fieldClass} value={answers.target_course} onChange={(e) => update('target_course', e.target.value)} placeholder="e.g. Medicine and Surgery" /></div>
          <div><label className={labelClass}>Preferred university / institution</label><input className={fieldClass} value={answers.preferred_institution} onChange={(e) => update('preferred_institution', e.target.value)} placeholder="e.g. University of Benin" /></div>
        </div>
        <div><p className={labelClass}>UTME subject combination</p><p className="mb-3 mt-1 text-xs text-slate-500">English is included automatically. Choose exactly three other subjects for JAMB.</p><div className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">✓ English Language (compulsory)</div><div className="flex flex-wrap gap-2">{utmeChoices.map((subject) => { const selected = answers.utme_subjects.includes(subject); const disabled = !selected && answers.utme_subjects.filter((s) => s !== 'English').length >= 3; return <button key={subject} type="button" disabled={disabled} onClick={() => toggleUtme(subject)} className={'rounded-full border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ' + (selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700')}>{subject}</button>; })}</div><p className="mt-2 text-xs text-slate-500">Selected: {answers.utme_subjects.join(', ')}</p></div>
        <div><label className={labelClass}>Which subjects are hardest for you?</label><p className="mb-3 mt-1 text-xs text-slate-500">Select any you would like us to focus on.</p>{chip('weak_subjects', subjects)}</div>
      </div>
    );
    if (step === 3) return (
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label className={labelClass}>Parent / guardian name</label><input className={fieldClass} value={answers.guardian_name} onChange={(e) => update('guardian_name', e.target.value)} placeholder="Full name" /></div>
        <div><label className={labelClass}>Parent / guardian phone *</label><input type="tel" inputMode="tel" autoComplete="tel" className={fieldClass} value={answers.guardian_phone} onChange={(e) => update('guardian_phone', e.target.value)} placeholder="e.g. 08012345678" /></div>
        <div className="sm:col-span-2"><label className={labelClass}>Parent / guardian email <span className="font-normal text-slate-400">(optional)</span></label><input type="email" autoComplete="email" className={fieldClass} value={answers.guardian_email} onChange={(e) => update('guardian_email', e.target.value)} placeholder="parent@example.com" /><p className="mt-1 text-xs text-slate-500">Student and guardian contacts are saved separately and are not shown publicly.</p></div>
      </div>
    );
    if (step === 4) return (
      <div className="space-y-6">
        <div><label className={labelClass}>How much time can you study most days?</label><select className={fieldClass} value={answers.study_time} onChange={(e) => update('study_time', e.target.value)}><option value="">Select an estimate</option><option>Less than 30 minutes</option><option>30–60 minutes</option><option>1–2 hours</option><option>2–4 hours</option><option>More than 4 hours</option></select></div>
        <div><label className={labelClass}>What makes studying difficult for you?</label><textarea rows="3" className={fieldClass} value={answers.study_challenges} onChange={(e) => update('study_challenges', e.target.value)} placeholder="e.g. I forget what I read, lack materials, or struggle with calculations." /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Device available for learning</label><select className={fieldClass} value={answers.device_access} onChange={(e) => update('device_access', e.target.value)}><option value="">Select device</option><option>Smartphone</option><option>Tablet</option><option>Computer / laptop</option><option>Shared device</option><option>No reliable device</option></select></div>
          <div><label className={labelClass}>Internet access</label><select className={fieldClass} value={answers.internet_access} onChange={(e) => update('internet_access', e.target.value)}><option value="">Select access</option><option>Reliable most days</option><option>Limited / expensive data</option><option>Wi-Fi sometimes</option><option>Rarely available</option></select></div>
        </div>
        <div><p className={labelClass}>What support would help you most?</p><div className="mb-3 mt-1">{chip('support_needs', ['Live classes','Practice questions','Worked solutions','Study timetable','Reminders and accountability','Help choosing course / subjects','Mentor support','Study materials'])}</div></div>
        <div><label className={labelClass}>How did you hear about Shiney Brain Academy?</label><select className={fieldClass} value={answers.referral_source} onChange={(e) => update('referral_source', e.target.value)}><option value="">Select one</option><option>WhatsApp</option><option>Telegram</option><option>TikTok</option><option>Instagram / Facebook</option><option>Friend / family</option><option>School / teacher</option><option>Google / website</option><option>Other</option></select></div>
      </div>
    );
    return (
      <div className="space-y-5">
        <div><label className={labelClass}>Your main goal</label><input className={fieldClass} value={answers.goal_title} onChange={(e) => update('goal_title', e.target.value)} placeholder={answers.target_score ? 'Score ' + answers.target_score + ' in JAMB' : 'e.g. Prepare confidently for my exams'} /></div>
        <div><label className={labelClass}>What result are you working towards?</label><input className={fieldClass} value={answers.goal_target} onChange={(e) => update('goal_target', e.target.value)} placeholder="e.g. qualify for my first-choice course" /></div>
        <div><label className={labelClass}>What motivates you most?</label><select className={fieldClass} value={answers.motivation} onChange={(e) => update('motivation', e.target.value)}><option value="">Select one (optional)</option><option value="scholarship">Scholarship</option><option value="parents">Making my family proud</option><option value="career">My future career</option><option value="personal_growth">Personal growth</option><option value="admission">Getting admission</option></select></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <h3 className="font-bold text-slate-900">Review your key details</h3>
          <p className="mt-2"><strong>Exams:</strong> {answers.target_exams.join(', ') || 'Not selected'}</p>
          <p><strong>Target score:</strong> {answers.target_score ? answers.target_score + '/400' : 'Not set yet'}</p>
          <p><strong>Course:</strong> {answers.target_course || 'Not set yet'}</p>
          <p><strong>Institution:</strong> {answers.preferred_institution || 'Not set yet'}</p>
          <p><strong>UTME subjects:</strong> {answers.utme_subjects.join(', ')}</p>
          <p><strong>Guardian:</strong> {answers.guardian_name || 'Name not added'} {answers.guardian_phone ? '• ' + answers.guardian_phone : ''} {answers.guardian_email ? '• ' + answers.guardian_email : ''}</p>
          <p><strong>Profile photo:</strong> {answers.avatar_url ? 'Added' : 'Not added'}</p>
          <p className="mt-2 text-xs text-slate-500">You can update these details later from your student profile. Date of birth and photo are optional.</p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-600"><input type="checkbox" className="mt-1" checked={answers.testimonial_consent} onChange={(e) => update('testimonial_consent', e.target.checked)} /><span><strong>Optional:</strong> I agree that SBA may contact me to ask about a possible testimonial. This does not give permission to publish my photo or results. Students under 18 require guardian approval before public use.</span></label>
      </div>
    );
  };

  if (pageLoading || !user) return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading your student profile…</main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3"><Link href="/dashboard" className="text-sm font-bold text-blue-800 hover:underline">← Student dashboard</Link><span className="text-xs font-semibold text-slate-500">{isEditMode ? 'PROFILE SETTINGS' : 'STUDENT ONBOARDING'}</span></div>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-blue-800 px-6 py-7 text-white sm:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-100">SHINEY BRAIN ACADEMY</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{isEditMode ? 'Update your student profile' : 'Let’s build your student success profile'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">{isEditMode ? 'Update missing details from when you first registered. Your existing account and learning progress stay intact.' : 'A few useful details help us tailor your preparation and support your admission goals.'}</p>
          </div>
          <div className="p-6 sm:p-8">
            <div className="mb-7">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>Step {step + 1} of {steps.length}</span><span>{Math.round(((step + 1) / steps.length) * 100)}% complete</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: (((step + 1) / steps.length) * 100) + '%' }} /></div>
            </div>
            <h2 className="text-xl font-black text-slate-900">{steps[step].title}</h2><p className="mb-6 mt-1 text-sm text-slate-500">{steps[step].description}</p>
            {errorMessage ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div> : null}
            {renderStep()}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={() => { setErrorMessage(''); setStep(Math.max(0, step - 1)); }} disabled={step === 0 || loading} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-40">Back</button>
              {step < steps.length - 1 ? <button type="button" onClick={() => { setErrorMessage(''); setStep(Math.min(steps.length - 1, step + 1)); }} disabled={uploadingPhoto || loading} className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">Continue →</button> : <button type="button" onClick={handleSubmit} disabled={loading || uploadingPhoto} className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{loading ? 'Saving profile…' : isEditMode ? 'Save profile changes' : 'Complete onboarding'}</button>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
