const SECRET = process.env.PAYSTACK_SECRET_KEY;
export const koboFromNaira = (n) => Math.round(Number(n) * 100);
export const nairaFromKobo = (k) => Number(k) / 100;
export async function paystackFetch(path, options = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Paystack error');
  return json.data;
}
