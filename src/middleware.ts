import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', path);
  
  // Lista publicznych ścieżek, których NIE zabezpieczamy
  const isPublicPath = 
    path.startsWith('/s/') || // Publiczne wypełnianie ankiet
    path.startsWith('/api/s/') || // Endpoint API do wysyłki odpowiedzi
    path === '/login' || // Strona logowania
    path.startsWith('/_next/') || // Zasoby deweloperskie i produkcyjne Next.js
    path.includes('.'); // Favicony, manifesty, pliki statyczne

  if (isPublicPath) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    });
  }

  const token = request.cookies.get('auth_token')?.value || '';

  try {
    const checkUrl = new URL('/api/auth/check', request.url);
    const res = await fetch(checkUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (!data.required || data.authenticated) {
        return NextResponse.next({
          request: {
            headers: requestHeaders,
          }
        });
      }
    }
  } catch (e) {
    console.error('[Middleware Check Error]:', e);
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Przechwytujemy wszystko poza plikami statycznymi i API wysyłki ankiet
    '/((?!api/s/|_next/static|_next/image|favicon.ico).*)',
  ],
};
