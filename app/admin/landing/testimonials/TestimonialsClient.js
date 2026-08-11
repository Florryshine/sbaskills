'use client';
import { useEffect, useState, useRef } from 'react';

export default function TestimonialsClient() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const formRef = useRef(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/landing/testimonials');
    const data = await res.json();
    setItems(data.testimonials || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createItem(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    const res = await fetch('/api/admin/landing/testimonials', {
      method: 'POST',
      body: new FormData(formRef.current),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErrorMsg(data.error || 'Could not save.'); return; }
    formRef.current.reset();
    load();
  }

  async function toggleApproved(item) {
    await fetch(`/api/admin/landing/testimonials/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: !item.approved }),
    });
    load();
  }

  async function remove(item) {
    if (!confirm(`Delete this entry from ${item.student_name}?`)) return;
    await fetch(`/api/admin/landing/testimonials/${item.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>Landing page testimonials &amp; screenshots</h1>

      <form ref={formRef} onSubmit={createItem} encType="multipart/form-data"
        style={{ display: 'grid', gap: 10, maxWidth: 460, margin: '20px 0 32px' }}>
        <input name="student_name" placeholder="Student name" required />
        <textarea name="quote" placeholder="Their testimonial, in their own words" required rows={3} />
        <input name="result_label" placeholder="Result, e.g. 'Scored 312 in JAMB' (optional)" />
        <select name="kind" defaultValue="testimonial">
          <option value="testimonial">Testimonial (quote)</option>
          <option value="screenshot">Screenshot (proof section)</option>
        </select>
        <input name="sort_order" type="number" placeholder="Sort order (lower = first)" defaultValue={0} />
        <label style={{ fontSize: 13, color: '#666' }}>Image / screenshot (optional)</label>
        <input name="image" type="file" accept="image/*" />
        <button disabled={saving} type="submit">{saving ? 'Saving…' : 'Add'}</button>
        {errorMsg && <div style={{ color: 'crimson' }}>{errorMsg}</div>}
      </form>

      {loading ? <p>Loading…</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 14, border: '1px solid #eee', borderRadius: 10, padding: 14 }}>
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />
              )}
              <div style={{ flex: 1 }}>
                <b>{item.student_name}</b>{' '}
                <span style={{ fontSize: 12, color: '#888' }}>({item.kind})</span>
                <p style={{ margin: '4px 0', fontSize: 14 }}>{item.quote}</p>
                {item.result_label && <div style={{ fontSize: 12, color: '#39a' }}>{item.result_label}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => toggleApproved(item)}>
                  {item.approved ? '✅ Live' : 'Approve'}
                </button>
                <button onClick={() => remove(item)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
