'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

const states = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [answers, setAnswers] = useState({
    target_exams: [],
    interests: [],
    student_level: '',
    institution_name: '',
    institution_type: '',
    state: '',
    guardian_phone: '',
    avatar_url: '',
    avatar_public_id: '',
    testimonial_consent: false,
    goal_title: '',
    goal_target: '',
    motivation: '',
  });

  const steps = [
    {
      title: 'What exam are you preparing for?',
      description: 'Select all that apply',
      field: 'target_exams',
      type: 'multi-select',
      options: ['JAMB', 'WAEC', 'NECO', 'GCE', 'BECE', 'University', 'Other'],
    },
    {
      title: 'What subjects do you enjoy?',
      description: 'Select all that apply',
      field: 'interests',
      type: 'multi-select',
      options: ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'Government', 'Economics', 'Commerce', 'Accounting', 'History', 'Geography', 'Computer Science', 'Literature'],
    },
    {
      title: 'Tell us about yourself',
      description: 'Add your details so we can support you and keep your profile recognizable.',
      field: 'profile',
      type: 'profile',
    },
    {
      title: 'What is your goal this year?',
      description: 'Let us help you achieve it',
      field: 'goal',
      type: 'goal',
    },
  ];

  useEffect(() => {
    let active = true;
    const loadUserAndDraft = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data?.user) {
        router.replace('/auth/login');
        return;
      }
      setUser(data.user);
      try {
        const saved = window.localStorage.getItem('sba_onboarding_' + data.user.id);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.answers) {
            setAnswers(prev => ({ ...prev, ...draft.answers }));
            if (draft.answers.avatar_url) setPhotoPreview(draft.answers.avatar_url);
          }
          if (Number.isInteger(draft.step) && draft.step >= 0 && draft.step < steps.length) setStep(draft.step);
        }
      } catch (e) {
        console.warn('Could not restore onboarding draft.', e);
      }
      setPageLoading(false);
    };
    loadUserAndDraft();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem('sba_onboarding_' + user.id, JSON.stringify({ answers, step }));
    } catch (e) {
      console.warn('Could not save onboarding draft.', e);
    }
  }, [answers, step, user]);

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleMultiSelect = (field, value) => {
    setAnswers(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleProfileChange = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage('');

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setErrorMessage('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrorMessage('Your photo must be 5 MB or smaller.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPhotoPreview(localPreview);
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/student-profile-photo', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Photo upload failed. Please try again.');
      setAnswers(prev => ({
        ...prev,
        avatar_url: result.secure_url,
        avatar_public_id: result.public_id,
      }));
      setPhotoPreview(result.secure_url);
    } catch (error) {
      setPhotoPreview('');
      setAnswers(prev => ({ ...prev, avatar_url: '', avatar_public_id: '' }));
      setErrorMessage(error?.message || 'Photo upload failed. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      setErrorMessage('Your session has expired. Please sign in again.');
      return;
    }
    if (answers.target_exams.length === 0) {
      setErrorMessage('Please select at least one exam or study path before continuing.');
      setStep(0);
      return;
    }
    if (!answers.guardian_phone.trim()) {
      setErrorMessage('Please add a parent or guardian phone number so we can follow up when needed.');
      setStep(2);
      return;
    }
    if (!answers.avatar_url || !answers.avatar_public_id) {
      setErrorMessage('Please upload your headshot photo before completing onboarding.');
      setStep(2);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      if (answers.target_exams.includes('JAMB')) {
        const { error: targetError } = await supabase
          .from('student_exam_targets')
          .upsert({ user_id: user.id, exam_type: 'JAMB', exam_year: 2027, status: 'active' }, { onConflict: 'user_id,exam_type,exam_year' });
        if (targetError) throw new Error('Your JAMB 2027 target could not be saved. Please try again. Details: ' + targetError.message);
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          target_exams: answers.target_exams,
          interests: answers.interests,
          student_level: answers.student_level,
          institution_name: answers.institution_name,
          institution_type: answers.institution_type,
          state: answers.state,
          guardian_phone: answers.guardian_phone.trim(),
          avatar_url: answers.avatar_url,
          avatar_public_id: answers.avatar_public_id,
          testimonial_consent: answers.testimonial_consent,
          goal_title: answers.goal_title,
          goal_target: answers.goal_target,
          motivation: answers.motivation,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;
      try { window.localStorage.removeItem('sba_onboarding_' + user.id); } catch (e) {}
      router.push('/dashboard');
    } catch (e) {
      setErrorMessage(e?.message || 'We could not save your details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const current = steps[step];

    if (step === 2) {
      return (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Student Level</label>
            <select className="w-full border rounded-xl px-4 py-2" value={answers.student_level} onChange={(e) => handleProfileChange('student_level', e.target.value)}>
              <option value="">Select...</option>
              <option value="SS1">SS1</option><option value="SS2">SS2</option><option value="SS3">SS3</option>
              <option value="JAMB">JAMB</option><option value="Undergraduate">Undergraduate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Institution Type</label>
            <select className="w-full border rounded-xl px-4 py-2" value={answers.institution_type} onChange={(e) => handleProfileChange('institution_type', e.target.value)}>
              <option value="">Select...</option>
              <option value="Secondary School">Secondary School</option><option value="University">University</option>
              <option value="Polytechnic">Polytechnic</option><option value="College of Education">College of Education</option>
              <option value="Private Candidate">Private Candidate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Institution Name</label>
            <input type="text" className="w-full border rounded-xl px-4 py-2" value={answers.institution_name} onChange={(e) => handleProfileChange('institution_name', e.target.value)} placeholder="e.g. Federal Government College Enugu" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State</label>
            <select className="w-full border rounded-xl px-4 py-2" value={answers.state} onChange={(e) => handleProfileChange('state', e.target.value)}>
              <option value="">Select...</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Parent / Guardian Phone Number *</label>
            <input type="tel" required inputMode="tel" autoComplete="tel" className="w-full border rounded-xl px-4 py-2" value={answers.guardian_phone} onChange={(e) => handleProfileChange('guardian_phone', e.target.value)} placeholder="e.g. 08012345678" />
            <p className="mt-1 text-xs text-gray-500">We use this for important student-support follow-up. It is not displayed publicly.</p>
          </div>
          <div className="border rounded-2xl p-4">
            <label className="block text-sm font-medium mb-2">Student Headshot Photo *</label>
            <p className="text-xs text-gray-500 mb-3">Upload a clear photo of your face. JPG, PNG or WebP, maximum 5 MB.</p>
            {photoPreview ? <img src={photoPreview} alt="Student headshot preview" className="h-28 w-28 rounded-full object-cover border mb-3" /> : null}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} className="block w-full text-sm" />
            {uploadingPhoto && <p className="text-sm text-blue-700 mt-2">Uploading your photo securely...</p>}
            {answers.avatar_url && !uploadingPhoto && <p className="text-sm text-green-700 mt-2">Photo uploaded successfully. You can choose another photo to replace it.</p>}
          </div>
          <div className="border rounded-xl p-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={answers.testimonial_consent} onChange={(e) => handleProfileChange('testimonial_consent', e.target.checked)} />
              <span><strong>Optional:</strong> I give Shiney Brain Academy permission to consider my photo and learning results for a public testimonial. I understand I can say no; uploading a photo alone does not give this permission.</span>
            </label>
            <p className="text-xs text-gray-500 mt-2">For students under 18, guardian approval must also be obtained before anything is published.</p>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">What is your goal?</label>
            <input type="text" className="w-full border rounded-xl px-4 py-2" placeholder="e.g. Score 320 in JAMB" value={answers.goal_title} onChange={(e) => handleProfileChange('goal_title', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target</label>
            <input type="text" className="w-full border rounded-xl px-4 py-2" placeholder="e.g. Get A1 in Biology" value={answers.goal_target} onChange={(e) => handleProfileChange('goal_target', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">What motivates you?</label>
            <select className="w-full border rounded-xl px-4 py-2" value={answers.motivation} onChange={(e) => handleProfileChange('motivation', e.target.value)}>
              <option value="">Select...</option><option value="scholarship">Scholarship</option><option value="parents">Parents</option>
              <option value="career">Career</option><option value="personal_growth">Personal Growth</option>
            </select>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-3">
        {current.options.map((option) => (
          <button key={option} type="button" onClick={() => handleMultiSelect(current.field, option)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${answers[current.field]?.includes(option) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            {option}
          </button>
        ))}
      </div>
    );
  };

  if (pageLoading || !user) return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading your onboarding...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((_, i) => <div key={i} className={`h-2 w-16 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-300'}`} />)}
          </div>
          <h2 className="text-2xl font-bold">{steps[step].title}</h2>
          <p className="text-gray-500 text-sm">{steps[step].description}</p>
        </div>
        {errorMessage && <div role="alert" className="mt-4 mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>}
        {renderStep()}
        <div className="flex justify-between mt-6 gap-3">
          <button onClick={() => { setErrorMessage(''); setStep(Math.max(0, step - 1)); }} disabled={step === 0} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">Back</button>
          <button onClick={() => { setErrorMessage(''); if (step === steps.length - 1) handleSubmit(); else setStep(Math.min(steps.length - 1, step + 1)); }}
            disabled={loading || uploadingPhoto} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
            {uploadingPhoto ? 'Uploading photo...' : loading ? 'Saving...' : step === steps.length - 1 ? '🎉 Complete' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
