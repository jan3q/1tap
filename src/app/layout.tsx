import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '1tap - Kreator Ankiet',
  description: 'Prosty i intuicyjny kreator ankiet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body>
        <nav style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
          <div className="container" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="/" style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.025em' }}>
              1tap.
            </a>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>v1.0.0</span>
            </div>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
