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

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({
    target_exams: [],
    interests: [],
    student_level: '',
    institution_name: '',
    institution_type: '',
    state: '',
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
      description: 'We want to personalize your experience',
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
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.push('/auth/login');
      } else {
        setUser(data.user);
      }
    });
  }, []);

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

  const handleSubmit = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        target_exams: answers.target_exams,
        interests: answers.interests,
        student_level: answers.student_level,
        institution_name: answers.institution_name,
        institution_type: answers.institution_type,
        state: answers.state,
        goal_title: answers.goal_title,
        goal_target: answers.goal_target,
        motivation: answers.motivation,
        onboarding_completed: true,
      })
      .eq('id', user?.id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      router.push('/dashboard');
    }
    setLoading(false);
  };

  const renderStep = () => {
    const current = steps[step];

    if (step === 2) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Student Level</label>
            <select
              className="w-full border rounded-xl px-4 py-2"
              value={answers.student_level}
              onChange={(e) => handleProfileChange('student_level', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="SS1">SS1</option>
              <option value="SS2">SS2</option>
              <option value="SS3">SS3</option>
              <option value="JAMB">JAMB</option>
              <option value="Undergraduate">Undergraduate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Institution Type</label>
            <select
              className="w-full border rounded-xl px-4 py-2"
              value={answers.institution_type}
              onChange={(e) => handleProfileChange('institution_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="Secondary School">Secondary School</option>
              <option value="University">University</option>
              <option value="Polytechnic">Polytechnic</option>
              <option value="College of Education">College of Education</option>
              <option value="Private Candidate">Private Candidate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Institution Name</label>
            <input
              type="text"
              className="w-full border rounded-xl px-4 py-2"
              value={answers.institution_name}
              onChange={(e) => handleProfileChange('institution_name', e.target.value)}
              placeholder="e.g. Federal Government College Enugu"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State</label>
            <select
              className="w-full border rounded-xl px-4 py-2"
              value={answers.state}
              onChange={(e) => handleProfileChange('state', e.target.value)}
            >
              <option value="">Select...</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">What is your goal?</label>
            <input
              type="text"
              className="w-full border rounded-xl px-4 py-2"
              placeholder="e.g. Score 320 in JAMB"
              value={answers.goal_title}
              onChange={(e) => handleProfileChange('goal_title', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target</label>
            <input
              type="text"
              className="w-full border rounded-xl px-4 py-2"
              placeholder="e.g. Get A1 in Biology"
              value={answers.goal_target}
              onChange={(e) => handleProfileChange('goal_target', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">What motivates you?</label>
            <select
              className="w-full border rounded-xl px-4 py-2"
              value={answers.motivation}
              onChange={(e) => handleProfileChange('motivation', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="scholarship">Scholarship</option>
              <option value="parents">Parents</option>
              <option value="career">Career</option>
              <option value="personal_growth">Personal Growth</option>
            </select>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-3">
        {current.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleMultiSelect(current.field, option)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              answers[current.field]?.includes(option)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-16 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-300'}`}
              />
            ))}
          </div>
          <h2 className="text-2xl font-bold">{steps[step].title}</h2>
          <p className="text-gray-500 text-sm">{steps[step].description}</p>
        </div>

        {renderStep()}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={step === steps.length - 1 ? handleSubmit : () => setStep(step + 1)}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : step === steps.length - 1 ? '🎉 Complete' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}