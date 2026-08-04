import { cache } from 'react';
import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { marked } from 'marked';
import { BASE_URL, generateBlogPostMetadata } from '@/lib/seo';

// ─── Dynamically load interactive components (client-only) ────────────
const ShareButtons = nextDynamic(() => import('@/components/ShareButtons'), { ssr: false });
const MarkDoneButton = nextDynamic(() => import('@/components/MarkDoneButton'), { ssr: false });
const Comments = nextDynamic(() => import('@/components/Comments'), { ssr: false });
const PodcastPlayer = nextDynamic(() => import('@/components/PodcastPlayer'), { ssr: false });
const RatingWidget = nextDynamic(() => import('@/components/RatingWidget'), { ssr: false });

export const dynamic = 'force-dynamic';

// ─── Single, deduped post fetch ─────────────────────────────────────────
const getPost = cache(async (slug) => {
  const supabase = createServerClient();
  const { data: post, error } = await supabase
    .from('content_drafts')
    .select('*')
    .eq('url_slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return post;
});

// ─── Tool URL Mapping (fixes internal 404s) ────────────────────────────
const toolUrlMap = {
  'JAMB Aggregate Calculator': '/tools/jamb-aggregate',
  'Cut-off Mark Checker': '/tools/cut-off-mark',
  'Past Question Search': '/tools/past-questions',
  'Subject Combination Checker': '/tools/subject-combination',
  'Admission Chance Checker': '/tools/admission-chance',
  'WAEC Grade Calculator': '/tools/waec-grade-calculator',
  'Study Timetable Generator': '/tools/timetable-generator',
  'Daily Mentor': '/tools/daily-mentor',
  'Shine AI': '/tools/shine-ai',
};

// ─── Safe JSON parse ────────────────────────────────────────────────────
function safeJsonParse(value, fallback = []) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn('safeJsonParse failed, using fallback:', e.message);
    return fallback;
  }
}

// ─── Per-post SEO metadata ──────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const post = await getPost(params.slug);

  if (!post) {
    return { title: 'Post Not Found | Shiney Brain Academy' };
  }

  return generateBlogPostMetadata(post);
}

export default async function BlogPostPage({ params }) {
  try {
    const supabase = createServerClient();
    const post = await getPost(params.slug);
    if (!post) notFound();

    // ─── Parse JSON fields ───────────────────────────────────────────────
    const images = safeJsonParse(post.image_prompts, []);
    const heroPrompt = images.find((img) => img.type === 'hero')?.description || null;
    const faq = safeJsonParse(post.schemas, []);
    const internalLinks = safeJsonParse(post.internal_links, []);

    // ─── Fetch real published posts for internal links ──────────────────
    let postTitleToSlug = {};
    if (internalLinks.length > 0) {
      const { data: allPosts } = await supabase
        .from('content_drafts')
        .select('title, url_slug')
        .eq('status', 'published');
      postTitleToSlug = Object.fromEntries(
        (allPosts || [])
          .filter((p) => p.title && p.url_slug)
          .map((p) => [p.title, p.url_slug])
      );
    }

    function resolveInternalLink(label) {
      if (toolUrlMap[label]) {
        return { href: toolUrlMap[label], isTool: true };
      }
      if (postTitleToSlug[label] && postTitleToSlug[label] !== post.url_slug) {
        return { href: `/blog/${postTitleToSlug[label]}`, isTool: false };
      }
      return null;
    }

    const resolvedLinks = internalLinks
      .map((label) => ({ label, resolved: resolveInternalLink(label) }))
      .filter((item) => item.resolved !== null);

    // ─── Podcast episode ──────────────────────────────────────────────────
    let podcastSegments = [];
    let podcastEpisode = null;
    const { data: fetchedPodcastEpisode } = await supabase
      .from('podcast_episodes')
      .select('id, title')
      .eq('content_draft_id', post.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    podcastEpisode = fetchedPodcastEpisode;

    if (podcastEpisode) {
      const { data: segments } = await supabase
        .from('podcast_segments')
        .select('position, speaker, text, audio_url, duration_seconds')
        .eq('episode_id', podcastEpisode.id)
        .order('position', { ascending: true });
      podcastSegments = segments || [];
    }

    // ─── Convert markdown → HTML ────────────────────────────────────────
    let htmlContent = post.content || '';
    try {
      marked.setOptions({ breaks: true, gfm: true });
      htmlContent = marked.parse(post.content || '');
    } catch (e) {
      console.warn('Markdown parsing failed, using raw content:', e);
    }

    // ─── Rating aggregate ────────────────────────────────────────────────
    const { data: ratingRows } = await supabase
      .from('blog_post_ratings')
      .select('rating')
      .eq('post_id', post.id);

    const ratingCount = ratingRows?.length || 0;
    const ratingAverage =
      ratingCount > 0
        ? Math.round((ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10
        : 0;

    // ─── Structured data ──────────────────────────────────────────────────
    const MIN_RATINGS_FOR_SCHEMA = 3;
    const postUrl = `${BASE_URL}/blog/${post.url_slug}`;
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.meta_description || undefined,
      image: post.cover_image ? [post.cover_image] : undefined,
      datePublished: post.published_at || post.created_at || undefined,
      dateModified: post.updated_at || post.published_at || post.created_at || undefined,
      author: {
        '@type': 'Organization',
        name: 'Shiney Brain Academy',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Shiney Brain Academy',
        logo: {
          '@type': 'ImageObject',
          url: `${BASE_URL}/logo.png`,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': postUrl,
      },
      ...(ratingCount >= MIN_RATINGS_FOR_SCHEMA
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: ratingAverage,
              reviewCount: ratingCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };

    const faqSchema =
      faq.length > 0
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }
        : null;

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
        {faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
          />
        )}
        <Navbar />
        <main className="min-h-screen bg-gray-50">
          <article className="max-w-4xl mx-auto px-4 py-8">
            {/* ─── Hero Image ─── */}
            {post.cover_image ? (
              <div className="relative w-full h-64 md:h-80 rounded-lg mb-6 overflow-hidden">
                <Image
                  src={post.cover_image}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority
                />
              </div>
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

            {/* ─── Meta info (AUTHOR & DATE added here) ─── */}
            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-500 border-b pb-4">
              <span className="font-semibold text-gray-700">
                {post.author || 'Igberhi Florry (mentor Florryshine)'}
              </span>
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

            {/* ─── Share Buttons ─── */}
            <div className="mb-6">
              <ShareButtons
                title={post.title}
                url={`/blog/${post.url_slug}`}
                targetType="blog"
                targetId={post.id}
                description={post.meta_description || 'Read this blog post on Shiney Brain Academy!'}
              />
            </div>

            {/* ─── Main Content ─── */}
            <div
              className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {/* ─── Reader Rating ─── */}
            <RatingWidget postId={post.id} initialAverage={ratingAverage} initialCount={ratingCount} />

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
            {resolvedLinks.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🔗 Related Tools & Resources</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {resolvedLinks.map(({ label, resolved }, i) => (
                    <li key={i}>
                      <Link
                        href={resolved.href}
                        className="text-blue-600 hover:underline"
                        target={resolved.isTool ? '_blank' : undefined}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ─── CTA ─── */}
            {post.cta && (
              <div className="mt-8 p-6 bg-brand-yellow/10 rounded-lg border border-brand-yellow">
                <p className="text-lg font-medium text-gray-900">{post.cta}</p>
              </div>
            )}

            {/* ─── Mark as Done ─── */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <MarkDoneButton
                activityType="blog"
                activityId={post.id}
                points={10}
                label="📚 Mark as Read (Earn 10 Points)"
              />
            </div>

            {/* ─── Podcast ─── */}
            {podcastSegments.length > 0 && (
              <div className="mt-8">
                <PodcastPlayer segments={podcastSegments} title={podcastEpisode?.title || post.title} />
              </div>
            )}

            {/* ─── Comments ─── */}
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