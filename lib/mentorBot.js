export async function askMentor(prompt, systemPrompt = 'You are Mentor Florryshine, a friendly and motivating tutor for Nigerian students. Give specific, actionable advice.') {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.reply || 'No response generated.';
  } catch (error) {
    console.error('Error calling mentor:', error);
    return 'Sorry, I could not generate a response. Please try again later.';
  }
}