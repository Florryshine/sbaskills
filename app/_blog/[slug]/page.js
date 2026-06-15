import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

export default async function SingleBlogPage({ params }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!post || !post.published) notFound()

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {post.cover_image && (
        <img src={post.cover_image} alt={post.title} className="w-full h-64 object-cover rounded-lg mb-8" />
      )}
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
    </div>
  )
}