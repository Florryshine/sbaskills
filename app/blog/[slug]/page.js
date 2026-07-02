import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// ─── Dynamically load interactive components (client-only) ────────────
const ShareButtons = nextDynamic(() => import('@/components/ShareButtons'), { ssr: false });
const MarkDoneButton = nextDynamic(() => import('@/components/MarkDoneButton'), { ssr: false });
const Comments = nextDynamic(() => import('@/components/Comments'), { ssr: false });

export const dynamic = 'force-dynamic';

// Configure marked options ONCE, before any conversion
marked.setOptions({
  breaks: true,   // Convert \n to <br>
  gfm: true,      // GitHub Flavored Markdown
});

export default async function BlogPostPage({ params }) {
  try {
    const supabase = createServerClient();

    const { data: post, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('url_slug', params.slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }
    if (!post) notFound();

    // ─── Parse JSON fields ──────────────────────────────────────────────
    const images = post.image_prompts ? JSON.parse(post.image_prompts) : [];
    const heroPrompt = images.find((img) => img.type === 'hero')?.description || null;
    const faq = post.schemas ? JSON.parse(post.schemas) : [];
    const internalLinks = post.internal_links || [];

    // ─── Convert markdown → HTML and sanitize ──────────────────────────
    const rawHtml = marked.parse(post.content || '');
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);

    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50">
          <article className="max-w-4xl mx-auto px-4 py-8">
            {/* ─── Hero Image ─── */}
            {post.cover_image ? (
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full h-64 md:h-80 object-cover rounded-lg mb-6"
              />
            ) : heroPrompt ? (
              <div className="relative w-full h-64 md:h-80 bg-gray-200 rounded-lg mb-6 overflow-hidden">
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 text-gray-400">
                  <span className="text-sm font-medium">📷 {heroPrompt}</span>
                </div>
              </div>
            ) : null}

            {/* ─── Title ─── */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {post.title}
            </h1>

            {/* ─── Meta info ─── */}
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-500 border-b pb-4">
              <span className="font-semibold text-gray-700">Shiney Brain Academy</span>
              <span>•</span>
              <span>
                {new Date(post.published_at || post.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span>•</span>
              <span>{Math.ceil((post.content?.split(/\s+/).length || 0) / 200)} min read</span>
            </div>

            {/* ─── Meta Description ─── */}
            {post.meta_description && (
              <p className="text-lg text-gray-600 font-medium mb-6 border-l-4 border-brand-yellow pl-4 italic">
                {post.meta_description}
              </p>
            )}

            {/* ─── Share Buttons (client-only) ─── */}
            <div className="mb-6">
              <ShareButtons
                title={post.title}
                url={`/blog/${post.url_slug}`}
                targetType="blog"
                targetId={post.id}
                description={post.meta_description || 'Read this blog post on Shiney Brain Academy!'}
              />
            </div>

            {/* ─── Main Content (sanitized HTML from Markdown) ─── */}
            <div
              className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />

            {/* ─── FAQ Section ─── */}
            {faq.length > 0 && (
              <div className="mt-10 border-t pt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {faq.map((item, i) => (
                    <div key={i} className="border-b pb-4">
                      <p className="font-semibold text-gray-800">{item.question}</p>
                      <p className="text-gray-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Internal Links ─── */}
            {internalLinks.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🔗 Related Tools & Resources</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {internalLinks.map((link, i) => {
                    // ⚠️ Assumes tool slugs match: lowercased, spaces replaced with '-'
                    const slug = link.toLowerCase().replace(/\s+/g, '-');
                    return (
                      <li key={i}>
                        <Link
                          href={`/tools/${slug}`}
                          className="text-blue-600 hover:underline"
                          target="_blank"
                        >
                          {link}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* ─── CTA / Before You Leave ─── */}
            {post.cta && (
              <div className="mt-8 p-6 bg-brand-yellow/10 rounded-lg border border-brand-yellow">
                <p className="text-lg font-medium text-gray-900">{post.cta}</p>
              </div>
            )}

            {/* ─── Mark as Done (client-only) ─── */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <MarkDoneButton
                activityType="blog"
                activityId={post.id}
                points={10}
                label="📚 Mark as Read (Earn 10 Points)"
              />
            </div>

            {/* ─── Comments (client-only) ─── */}
            <div className="mt-8">
              <Comments postId={post.id} />
            </div>
          </article>
        </main>
        <Footer />
      </>
    );
  } catch (err) {
    console.error('Blog post error:', err);
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center flex-col p-6">
          <h2 className="text-xl font-bold text-red-600">Error loading post</h2>
          <p className="text-gray-700 mt-2">{err.message}</p>
          <p className="text-sm text-gray-500 mt-1">Please try again later.</p>
        </main>
        <Footer />
      </>
    );
  }
}