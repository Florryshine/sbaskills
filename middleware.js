import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

const studentProtectedRoutes = ['/dashboard'];
const lessonProtectedPrefix = '/courses/';
const adminProtectedPrefix = '/admin';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isStudentProtected = studentProtectedRoutes.some((route) => pathname.startsWith(route));
  const isLessonProtected = pathname.includes('/lessons/');
  const isAdminProtected = pathname.startsWith(adminProtectedPrefix) && pathname !== '/admin/login';

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
  matcher: ['/dashboard/:path*', '/courses/:path*/lessons/:path*', '/admin/:path*']
};
