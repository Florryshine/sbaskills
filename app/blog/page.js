import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'

export default async function BlogPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Shiney Brain Blog</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts?.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`}>
            <div className="border rounded-lg overflow-hidden hover:shadow-lg transition">
              {post.cover_image && (
                <Image src={post.cover_image} alt={post.title} width={400} height={200} className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                <p className="text-gray-600">{post.excerpt}</p>
                <span className="text-sm text-blue-600 mt-2 inline-block">Read more →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}