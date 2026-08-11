import { NextResponse } from 'next/server';
import { requireLandingAdmin } from '@/lib/requireLandingAdmin';
import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';

export async function GET() {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase
    .from('landing_testimonials')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ testimonials: data });
}

// Accepts multipart/form-data: student_name, quote, result_label, kind,
// product_slug, sort_order, and an optional "image" file.
export async function POST(req) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const form = await req.formData();
  const student_name = form.get('student_name');
  const quote = form.get('quote');
  const result_label = form.get('result_label') || null;
  const kind = form.get('kind') || 'testimonial';
  const product_slug = form.get('product_slug') || 'jamb-playbook';
  const sort_order = Number(form.get('sort_order') || 0);
  const file = form.get('image');

  if (!student_name || !quote) {
    return NextResponse.json({ error: 'student_name and quote are required.' }, { status: 400 });
  }

  let image_url = null;
  if (file && typeof file === 'object' && file.size > 0) {
    // ADAPT: replace with your existing Cloudinary upload helper if you
    // have one (SBA already uses Cloudinary elsewhere). This does a
    // direct unsigned/signed REST upload so the patch is self-contained.
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
    if (cloudData.secure_url) image_url = cloudData.secure_url;
  }

  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase
    .from('landing_testimonials')
    .insert({
      student_name, quote, result_label, kind, product_slug, sort_order,
      image_url, approved: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ testimonial: data });
}
