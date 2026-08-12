import { NextResponse } from 'next/server';
import { requireLandingAdmin } from '@/lib/requireLandingAdmin';
import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';

const PRODUCT_SLUG = 'jamb-playbook';

// Powers the tap-to-upload buttons on the live landing page's "proof"
// section. Each of the 3 phone boxes is identified by `slot` (0, 1, 2),
// stored as sort_order on a kind:'screenshot' row. Unlike the general
// admin form, rows created here are auto-approved so they appear on the
// page immediately — no separate approval step, since the admin is
// looking at the live page while doing this.
//
// POST: multipart/form-data with "slot" (0-2) and "image" (file).
//       Replaces whatever screenshot currently occupies that slot.
// DELETE: JSON body { slot }. Clears that slot back to placeholder.

export async function POST(req) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const form = await req.formData();
  const slot = Number(form.get('slot'));
  const file = form.get('image');

  if (![0, 1, 2].includes(slot)) {
    return NextResponse.json({ error: 'Invalid slot.' }, { status: 400 });
  }
  if (!file || typeof file !== 'object' || file.size === 0) {
    return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${bytes.toString('base64')}`;

  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: (() => {
        const fd = new FormData();
        fd.append('file', base64);
        fd.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET);
        fd.append('folder', 'landing/jamb-playbook');
        return fd;
      })(),
    }
  );
  const cloudData = await cloudRes.json();
  if (!cloudData.secure_url) {
    return NextResponse.json({ error: 'Image upload failed.' }, { status: 502 });
  }

  const supabase = landingSupabaseAdmin();

  // A slot is identified by (product_slug, kind:'screenshot', sort_order).
  // Replace whatever's currently there rather than stacking duplicates.
  const { data: existing } = await supabase
    .from('landing_testimonials')
    .select('id')
    .eq('product_slug', PRODUCT_SLUG)
    .eq('kind', 'screenshot')
    .eq('sort_order', slot)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await supabase
      .from('landing_testimonials')
      .update({ image_url: cloudData.secure_url, approved: true })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    row = data;
  } else {
    const { data, error } = await supabase
      .from('landing_testimonials')
      .insert({
        student_name: 'Student',
        quote: '',
        kind: 'screenshot',
        product_slug: PRODUCT_SLUG,
        sort_order: slot,
        image_url: cloudData.secure_url,
        approved: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    row = data;
  }

  return NextResponse.json({ testimonial: row });
}

export async function DELETE(req) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const slot = Number(body.slot);
  if (![0, 1, 2].includes(slot)) {
    return NextResponse.json({ error: 'Invalid slot.' }, { status: 400 });
  }

  const supabase = landingSupabaseAdmin();
  const { error } = await supabase
    .from('landing_testimonials')
    .delete()
    .eq('product_slug', PRODUCT_SLUG)
    .eq('kind', 'screenshot')
    .eq('sort_order', slot);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
