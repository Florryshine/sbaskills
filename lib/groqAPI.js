import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---- Parse API keys ----
const groqKeys = (process.env.GROQ_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(k => k.length > 0);

const geminiKeys = (process.env.GEMINI_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(k => k.length > 0);

let groqIndex = 0;
let geminiIndex = 0;

function getGroqClient() {
  if (groqKeys.length === 0) return null;
  const key = groqKeys[groqIndex % groqKeys.length];
  groqIndex = (groqIndex + 1) % groqKeys.length;
  return new Groq({ apiKey: key });
}

function getGeminiClient() {
  if (geminiKeys.length === 0) return null;
  const key = geminiKeys[geminiIndex % geminiKeys.length];
  geminiIndex = (geminiIndex + 1) % geminiKeys.length;
  return new GoogleGenerativeAI(key);
}
// -------------------------------

function calculateDaysUntil(examDate) { /* ... unchanged ... */ }
function calculateDaysInactive(lastActive) { /* ... unchanged ... */ }

// Helper to generate with fallback
async function generateWithFallback(prompt, maxTokens = 200, temperature = 0.7) {
  // Try Groq first
  const groqClient = getGroqClient();
  if (groqClient) {
    try {
      const response = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        temperature: temperature,
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.warn('Groq failed, falling back to Gemini:', error.message);
    }
  }

  // Fallback to Gemini
  const geminiClient = getGeminiClient();
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return result.response.text().trim();
    } catch (error) {
      console.error('Gemini also failed:', error.message);
      throw error;
    }
  }

  throw new Error('No API keys available');
}

// ---- Updated functions using the fallback ----
export async function generateShineMessage(student) {
  const daysToExam = calculateDaysUntil(student.exam_date);
  const daysInactive = calculateDaysInactive(student.last_active);
  // ... build prompt as before (unchanged) ...
  // Then:
  const prompt = `...`; // same as before
  try {
    return await generateWithFallback(prompt, 200, 0.7);
  } catch (error) {
    return `Hey ${student.name}! 👋 Your ${student.exam} exam is coming up. Let's focus on ${student.weak_subjects.split(',')[0]} today. You got this! 💪`;
  }
}

export async function generateAIReply(student, userMessage) {
  // ... build prompt as before ...
  const prompt = `...`;
  try {
    return await generateWithFallback(prompt, 300, 0.7);
  } catch (error) {
    return `Hey ${student.name}! 😊 I had a little glitch there. Can you ask me again? I'm all ears!`;
  }
}

export async function generateWelcomeMessage(name) {
  const prompt = `You are Shine, welcoming a brand new student to Shiney Brain Academy. Their name is ${name}. Write a warm 2-sentence welcome in casual Nigerian style. Tell them to use /help to see what you can do. Just the message.`;
  try {
    return await generateWithFallback(prompt, 100, 0.7);
  } catch (error) {
    return `Welcome to Shiney Brain Academy, ${name}! 🚀 I'm Shine, your personal study coach — type /help to see everything I can do for you!`;
  }
}

// ---- Exports ----
export { getGroqClient, getGeminiClient };