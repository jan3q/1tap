import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Lista publicznych ścieżek, których NIE zabezpieczamy
  const isPublicPath = 
    path.startsWith('/s/') || // Publiczne wypełnianie ankiet
    path.startsWith('/api/s/') || // Endpoint API do wysyłki odpowiedzi
    path === '/login' || // Strona logowania
    path.startsWith('/_next/') || // Zasoby deweloperskie i produkcyjne Next.js
    path.includes('.'); // Favicony, manifesty, pliki statyczne

  if (isPublicPath) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  
  // Jeśli hasło administratora nie jest ustawione w .env, to cała aplikacja jest otwarta dla łatwości lokalnego uruchamiania
  if (!adminPassword) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  // Weryfikacja tokena sesyjnego
  if (token !== adminPassword) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Przechwytujemy wszystko poza plikami statycznymi i API wysyłki ankiet
    '/((?!api/s/|_next/static|_next/image|favicon.ico).*)',
  ],
};
