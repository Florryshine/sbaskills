import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';
import { getProduct } from '@/lib/landingProducts';
import LandingClient from './LandingClient';

export const metadata = {
  title: "100/100 JAMB AI Playbook — You're Not Failing, You're Missing a System",
  description:
    'The JAMB AI Study System — playbook, past questions, textbooks, planner, and 500+ prompts. By Shiney Brain Academy.',
};

export default async function JambPlaybookPage() {
  const supabase = landingSupabaseAdmin();
  const { data: testimonials } = await supabase
    .from('landing_testimonials')
    .select('*')
    .eq('product_slug', 'jamb-playbook')
    .eq('approved', true)
    .order('sort_order', { ascending: true });

  const product = getProduct('jamb-playbook');

  return (
    <LandingClient
      basePrice={product.price}
      screenshots={(testimonials || []).filter(t => t.kind === 'screenshot')}
      quotes={(testimonials || []).filter(t => t.kind === 'testimonial')}
    />
  );
}
