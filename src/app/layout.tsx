import type { Metadata } from 'next'
import './globals.css'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getSystemSetting } from '@/lib/db'

export const metadata: Metadata = {
  title: '1tap - Kreator Ankiet',
  description: 'Prosty i intuicyjny kreator ankiet',
}

async function logoutAction() {
  'use server'
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
  redirect('/login')
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const adminPassword = process.env.ADMIN_PASSWORD
  const savedToken = getSystemSetting('session_token')
  const activeToken = savedToken || adminPassword

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const isSurveyPage = pathname.startsWith('/s/')
  const isPublicApi = pathname.startsWith('/api/') || pathname.startsWith('/share/')
  const isLoginPage = pathname === '/login'

  const customUser = getSystemSetting('admin_username');
  const customPass = getSystemSetting('admin_password');
  const isAuthRequired = !!process.env.ADMIN_PASSWORD || !!customUser || !!customPass;

  const isAuthenticated = !isAuthRequired || (!!activeToken && token === activeToken);

  if (!isAuthenticated && !isSurveyPage && !isLoginPage && !isPublicApi) {
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  const showLogout = isAuthenticated && isAuthRequired && !isSurveyPage && !isLoginPage && !isPublicApi;

  return (
    <html lang="pl">
      <body>
        {!isSurveyPage && (
          <nav style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
            <div className="container" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a href="/" style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.025em' }}>
                1tap.
              </a>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {showLogout && (
                  <form action={logoutAction}>
                    <button type="submit" style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.85rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                    }} title="Wyloguj">
                      <LogOut size={16} /> Wyloguj
                    </button>
                  </form>
                )}
              </div>
            </div>
          </nav>
        )}
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
