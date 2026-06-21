import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://exwnfnqpuzqrzkjprbji.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_publishable_HaX6LPhPg1kZ2g1V-7w-3A_13de8qDy';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute = pathname === '/login' || pathname === '/register';

  // Support for legacy role cookie temporarily
  const legacyRole = request.cookies.get('lab_role')?.value;
  const isAuthenticated = user || legacyRole;

  // 1. If trying to access a protected route without being logged in
  if (!isAuthenticated && !isPublicRoute && !pathname.startsWith('/api') && !pathname.includes('.')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. If already logged in, prevent accessing the login/register pages
  if (isAuthenticated && isPublicRoute) {
    if (legacyRole === 'student') {
      return NextResponse.redirect(new URL('/student', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. Role-Based Route Protection (Legacy/Temp)
  if (legacyRole === 'student' && (pathname === '/' || pathname === '/debtors')) {
    return NextResponse.redirect(new URL('/student', request.url));
  }
  if (legacyRole === 'admin' && pathname === '/student') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|css|js|.*\\..*).*)'],
};
