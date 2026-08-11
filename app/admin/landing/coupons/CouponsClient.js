'use client';
import { useEffect, useState } from 'react';

const empty = { code: '', description: '', discount_type: 'fixed_price', discount_value: 1000, max_uses: '', expires_at: '' };

export default function CouponsClient() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/landing/coupons');
    const data = await res.json();
    setCoupons(data.coupons || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createCoupon(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    const res = await fetch('/api/admin/landing/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        expires_at: form.expires_at || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErrorMsg(data.error || 'Could not create coupon.'); return; }
    setForm(empty);
    load();
  }

  async function toggleActive(c) {
    await fetch(`/api/admin/landing/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  async function remove(c) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await fetch(`/api/admin/landing/coupons/${c.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>Landing page coupons</h1>

      <form onSubmit={createCoupon} style={{ display: 'grid', gap: 10, maxWidth: 420, margin: '20px 0 32px' }}>
        <input placeholder="CODE (e.g. STUDENT1K)" value={form.code}
          onChange={e => setForm({ ...form, code: e.target.value })} required />
        <input placeholder="Description (internal note)" value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })} />
        <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
          <option value="fixed_price">Fixed price with this code (₦)</option>
          <option value="amount_off">Amount off (₦)</option>
        </select>
        <input type="number" placeholder="Value" value={form.discount_value}
          onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} required />
        <input type="number" placeholder="Max uses (blank = unlimited)" value={form.max_uses}
          onChange={e => setForm({ ...form, max_uses: e.target.value })} />
        <input type="date" placeholder="Expires (optional)" value={form.expires_at}
          onChange={e => setForm({ ...form, expires_at: e.target.value })} />
        <button disabled={saving} type="submit">{saving ? 'Creating…' : 'Create coupon'}</button>
        {errorMsg && <div style={{ color: 'crimson' }}>{errorMsg}</div>}
      </form>

      {loading ? <p>Loading…</p> : (
        <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>Code</th><th>Price</th><th>Uses</th><th>Expires</th><th>Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td><b>{c.code}</b><div style={{ fontSize: 12, color: '#888' }}>{c.description}</div></td>
                <td>{c.discount_type === 'fixed_price' ? `₦${c.discount_value}` : `-₦${c.discount_value}`}</td>
                <td>{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                <td>
                  <button onClick={() => toggleActive(c)}>{c.active ? 'Active' : 'Inactive'}</button>
                </td>
                <td><button onClick={() => remove(c)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
