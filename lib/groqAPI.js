import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Unified API handler for Gemini and Groq
export async function generateContent(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY_1;
  
  if (!apiKey) {
    throw new Error("❌ GEMINI_API_KEY is missing from environment variables.");
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({ 
      contents: [{ parts: [{ text: prompt }] }] 
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}

// Shared Gemini client factory for routes
export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY_1;
  if (!apiKey) {
    throw new Error("❌ GEMINI_API_KEY is missing from environment variables.");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Export Groq for use in other files
export { Groq as groq };