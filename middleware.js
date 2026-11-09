import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

const studentProtectedRoutes = ['/dashboard'];
const lessonProtectedPrefix = '/courses/';
const adminProtectedPrefix = '/admin';

// API routes that use service-role clients or perform administrative,
// publishing, generation, or OAuth-channel operations must be protected
// independently of the admin page middleware.
function isAdminApiRequest(pathname) {
  // This endpoint intentionally remains public: landing pages use it only
  // to decide whether to show optional admin-only controls.
  if (pathname === '/api/admin/landing/is-admin') return false;

  // Cron endpoints authenticate with CRON_SECRET in their route handlers.
  if (
    pathname === '/api/publish/cron-worker' ||
    pathname === '/api/social/cron-worker'
  ) {
    return false;
  }

  const protectedPrefixes = [
    '/api/admin/',
    '/api/engines/',
    '/api/content-engine/',
    '/api/content-factory/',
    '/api/publish/',
    '/api/asset-images/',
    '/api/boss-battles/',
    '/api/social/',
    '/api/study-notes/',
    '/api/auth/facebook/',
    '/api/auth/linkedin/',
    '/api/auth/tiktok/',
    '/api/auth/youtube/',
  ];

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;

  return (
    pathname === '/api/debug' ||
    pathname === '/api/learning-core/generate'
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const isStudentProtected = studentProtectedRoutes.some((route) => pathname.startsWith(route));
  const isLessonProtected = pathname.startsWith(lessonProtectedPrefix) && pathname.includes('/lessons/');
  const isAdminProtected = pathname.startsWith(adminProtectedPrefix) && pathname !== '/admin/login';

  if (isAdminApiRequest(pathname)) {
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return response;
  }

  if ((isStudentProtected || isLessonProtected) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminProtected) {
    if (!user) {
      const adminLoginUrl = request.nextUrl.clone();
      adminLoginUrl.pathname = '/admin/login';
      return NextResponse.redirect(adminLoginUrl);
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (profile?.role !== 'admin') {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/courses/:path*/lessons/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/engines/:path*',
    '/api/content-engine/:path*',
    '/api/content-factory/:path*',
    '/api/publish/:path*',
    '/api/asset-images/:path*',
    '/api/boss-battles/:path*',
    '/api/social/:path*',
    '/api/study-notes/:path*',
    '/api/learning-core/generate',
    '/api/debug',
    '/api/auth/facebook/:path*',
    '/api/auth/linkedin/:path*',
    '/api/auth/tiktok/:path*',
    '/api/auth/youtube/:path*',
  ],
};
