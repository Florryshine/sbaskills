# Blog Engine Report

## 1. Files Responsible for Blog Generation
- **`app/admin/content-engine/page.js`**: Administrator dashboard for triggering and managing automated content generation.
- **`app/admin/content-engine/upload/page.js`**: UI for uploading CSV files containing keywords to seed the content generation queue.
- **`app/api/content-engine/generate/route.js`**: Backend API endpoint that processes generation tasks, typically integrating with LLM utilities.
- **`lib/groqAPI.js`**: Integration module for connecting to Groq AI models to programmatically draft blog posts.
- **`app/admin/blog/add/page.js`**: Manual form for creating blog posts without using AI generation.

## 2. Files Responsible for Draft Preview
- **`app/admin/content-engine/drafts/page.js`**: Administrative view listing generated or manually written posts in 'draft' status.
- **`app/admin/content-engine/drafts/[id]/page.js`**: Individual draft view for content review.
- **`app/admin/content-engine/drafts/[id]/preview/page.js`**: Specialized route for previewing the rendered draft layout.

## 3. Files Responsible for Publishing
- **`app/api/content-engine/publish/route.js`**: API handler responsible for transitioning posts from 'draft' to 'published' status.
- **`app/admin/blog/[id]/edit/page.js`**: Admin editor containing action handlers to finalize and publish drafts.

## 4. Files Responsible for Rendering Published Blogs
- **`app/blog/page.js`**: Public-facing index page listing all published posts, filtered by `status = 'published'`.
- **`app/blog/[slug]/page.js`**: Dynamic route rendering an individual published blog post using its unique slug.

## 5. API Routes Involved
- **`app/api/content-engine/generate/`**: Coordinates automated generation tasks.
- **`app/api/content-engine/publish/`**: Handles publishing status updates.
- **`app/api/content-engine/queue/`**: Manages the keyword-to-content generation queue.
- **`app/api/content-engine/drafts/`**: Fetches/manages draft data.
- **`app/api/content-engine/stats/`**: Provides dashboard statistics for the content engine.

## 6. Database Tables Used
Based on codebase usage (primarily `supabase/schema.sql` and API route queries):
- **`content_drafts`**: The primary table acting as the single source of truth for both admin management (drafts) and public rendering (published posts). Contains fields: `id`, `title`, `url_slug`, `content`, `status` ('draft'/'published'), `published_at`, `category`, `cover_image`.
- **`blog_comments`**: Stores reader feedback linked to blog posts.

## 7. Storage Buckets Used
- **Cloudinary**: Handled via `lib/cloudinary.js` for hosting responsive cover images and content assets.

## 8. Components Involved
- **`components/Comments.js`**: Displays and handles comment submissions on blog posts.
- **`components/ShareButtons.js`**: Enables social media sharing for blog posts.
- **`components/AdminSidebar.js`**: Admin navigation for the blog and content engine modules.

## 9. Workflow
1. **Generate**: Admin uploads keywords (`/upload`) -> API adds to queue -> System processes queue (`/generate`) -> Draft created in `content_drafts` table.
2. **Draft**: Drafts appear in the admin dashboard (`/drafts`).
3. **Preview**: Admin reviews and edits draft (`/drafts/[id]/preview`).
4. **Publish**: Admin triggers publishing (`/publish` API) -> Status changes to `'published'`, `published_at` timestamp set.
5. **Student View**: Published blog is visible on the public index (`/blog`) and individual post pages (`/blog/[slug]`).
