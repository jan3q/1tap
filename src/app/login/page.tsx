'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAdmin } from '@/app/actions';
import { Lock, ArrowRight, Eye, EyeOff, User } from 'lucide-react';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginAdmin(username, password, requires2fa ? totpCode : undefined);
      if (res.success) {
        router.push(redirectPath);
        router.refresh();
      } else if (res.requires2fa) {
        setRequires2fa(true);
        setLoading(false);
        if (res.error) {
          setError(res.error);
        }
      } else {
        setError(res.error || 'Błąd logowania');
        setLoading(false);
      }
    } catch (err) {
      setError('Błąd połączenia z serwerem');
      setLoading(false);
    }
  };

  return (
    <div 
      className="animate-fade-in"
      style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '2.2rem', 
          fontWeight: 800, 
          letterSpacing: '-0.03em', 
          color: '#ffffff',
          margin: 0,
          background: 'linear-gradient(to right, #ffffff, #a3a3a3)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          1Tap
        </h1>
        <p style={{ color: '#a3a3a3', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Panel zarządzania ankietami
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {!requires2fa ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e5e5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={14} /> Login (Adres e-mail)
              </label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="np. admin@1tap.pl"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e5e5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={14} /> Hasło administratora
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wpisz hasło..."
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.05)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#737373',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e5e5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔑 Kod weryfikacji dwuskładnikowej (2FA)
            </label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '1.25rem',
                letterSpacing: '0.25em',
                textAlign: 'center',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.target.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.05)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <p style={{ color: '#a3a3a3', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.25rem' }}>
              Wpisz 6-cyfrowy kod wygenerowany przez aplikację Google Authenticator.
            </p>
          </div>
        )}

        {error && (
          <div style={{ 
            fontSize: '0.85rem', 
            color: '#f87171', 
            backgroundColor: 'rgba(248, 113, 113, 0.1)', 
            border: '1px solid rgba(248, 113, 113, 0.2)', 
            padding: '0.75rem', 
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#ffffff',
            color: '#000000',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#e5e5e5';
          }}
          onMouseOut={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          {loading ? 'Weryfikacja...' : requires2fa ? 'Zweryfikuj i zaloguj się' : 'Zaloguj się'}
          {!loading && <ArrowRight size={18} />}
        </button>

        {requires2fa && (
          <button
            type="button"
            onClick={() => {
              setRequires2fa(false);
              setTotpCode('');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#a3a3a3',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginTop: '0.5rem'
            }}
          >
            Powrót do logowania hasłem
          </button>
        )}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0a',
      background: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)',
      padding: '1.5rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <Suspense fallback={
        <div style={{ color: '#ffffff', fontSize: '1rem' }}>Ładowanie formularza logowania...</div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
