import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function calculateDaysUntil(examDate) {
  if (!examDate) return 999;
  const exam = new Date(examDate);
  const today = new Date();
  const days = Math.ceil((exam - today) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

function calculateDaysInactive(lastActive) {
  if (!lastActive) return 0;
  const last = new Date(lastActive);
  const today = new Date();
  return Math.floor((today - last) / (1000 * 60 * 60 * 24));
}

export async function generateShineMessage(student) {
  const daysToExam = calculateDaysUntil(student.exam_date);
  const daysInactive = calculateDaysInactive(student.last_active);

  let messageType = 'motivation';
  let tone = 'friendly';

  if (daysInactive > 3) {
    messageType = 'inactivity_concern';
    tone = 'caring';
  } else if (daysToExam < 7 && daysToExam > 0) {
    messageType = 'exam_urgency';
    tone = 'urgent';
  } else if (student.confidence < 5) {
    messageType = 'encouragement';
    tone = 'very_supportive';
  }

  const prompt = `You are Shine, a caring and direct Nigerian study companion for Shiney Brain Academy. You motivate students authentically.

STUDENT PROFILE:
Name: ${student.name}
Stage: ${student.stage}
Exam: ${student.exam}
Target Score: ${student.target_scores}
Weak Subjects: ${student.weak_subjects}
Confidence Level: ${student.confidence}/10
Current Skill: ${student.skills}
Skill Progress: ${student.skill_progress}
Days Inactive: ${daysInactive}
Days Until Exam: ${daysToExam}
Goals: ${student.goals}
Availability: ${student.availability}

MESSAGE TYPE: ${messageType}
TONE: ${tone}

RULES:
1. Write casual, WhatsApp style (like a real friend)
2. Keep under 100 words
3. Give ONE specific task for today
4. Use Nigerian references if natural
5. Be authentic, not robotic
${daysInactive > 3 ? '6. Show genuine concern about their absence' : ''}
${daysToExam < 7 && daysToExam > 0 ? '6. Create urgency - exam is coming!' : ''}
${student.confidence < 5 ? '6. Be extra encouraging, remind them of their potential' : ''}

Write the message now (just the message, no other text):`;

  try {
    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      temperature: 0.7,
    });
    return message.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating message:', error);
    return `Hey ${student.name}! 👋\n\nYour ${student.exam} exam is coming up. Let's focus on ${student.weak_subjects.split(',')[0]} today. You got this! 💪`;
  }
}

// NEW: This function answers any question the student actually asks
export async function generateAIReply(student, userMessage) {
  const daysToExam = calculateDaysUntil(student.exam_date);

  const prompt = `You are Shine, a smart and caring Nigerian study coach at Shiney Brain Academy. You answer any question a student asks — study tips, exam advice, subject explanations, motivation, anything.

STUDENT PROFILE:
Name: ${student.name}
Exam: ${student.exam}
Weak Subjects: ${student.weak_subjects}
Target Score: ${student.target_scores}
Days Until Exam: ${daysToExam}
Goals: ${student.goals}

STUDENT'S MESSAGE: "${userMessage}"

RULES:
1. Directly answer what they asked — don't ignore their question
2. Keep it casual, WhatsApp style, like a smart friend
3. Under 150 words
4. Be specific and helpful, not generic
5. Use their name naturally
6. If it's a subject question, actually explain it clearly

Reply now (just the message, no other text):`;

  try {
    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      temperature: 0.7,
    });
    return message.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating AI reply:', error);
    return `Hey ${student.name}! 😊 I had a little glitch there. Can you ask me again? I'm all ears!`;
  }
}

export async function generateWelcomeMessage(name) {
  const prompt = `You are Shine, welcoming a brand new student to Shiney Brain Academy. Their name is ${name}.

Write a warm 2-sentence welcome in casual Nigerian style. Tell them to use /help to see what you can do. Just the message.`;

  try {
    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 100,
    });
    return message.choices[0].message.content.trim();
  } catch (error) {
    return `Welcome to Shiney Brain Academy, ${name}! 🚀 I'm Shine, your personal study coach — type /help to see everything I can do for you!`;
  }
}