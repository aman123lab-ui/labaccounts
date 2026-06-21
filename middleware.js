import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't need authentication
  const isPublicRoute = pathname === '/login' || pathname === '/register';
  
  // Get the user's role from the cookie we set during login
  const roleCookie = request.cookies.get('lab_role');
  const role = roleCookie?.value;

  // 1. If trying to access a protected route without being logged in
  if (!role && !isPublicRoute && !pathname.startsWith('/api') && !pathname.includes('.')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. If already logged in, prevent accessing the login/register pages
  if (role && isPublicRoute) {
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    } else {
      return NextResponse.redirect(new URL('/student', request.url));
    }
  }

  // 3. Role-Based Route Protection
  // If a student tries to access the admin dashboard (/) or /debtors
  if (role === 'student' && (pathname === '/' || pathname === '/debtors')) {
    return NextResponse.redirect(new URL('/student', request.url));
  }

  // If an admin tries to access the student portal
  if (role === 'admin' && pathname === '/student') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|css|js|.*\\..*).*)'],
};
