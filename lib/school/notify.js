export async function sendEmail({ to, subject, html }) {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Email delivery failed');
  return json;
}
export async function sendWhatsApp({ to, message }) {
  const { WHATSAPP_CLOUD_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  if (!WHATSAPP_CLOUD_API_TOKEN) throw new Error('WHATSAPP_CLOUD_API_TOKEN missing');
  const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_CLOUD_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'WhatsApp delivery failed');
  return json;
}
