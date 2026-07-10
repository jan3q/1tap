'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Eye, BarChart, Pencil, Search, X } from 'lucide-react';
import DeleteSurveyButton from './DeleteSurveyButton';
import { Survey } from '@/types';
import { get2FAStatus, prepare2FA, enable2FA, disable2FA, updateAdminCredentials } from '@/app/actions';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l');
}

function searchScore(survey: Survey, query: string): number {
  const nq = normalize(query);
  const nt = normalize(survey.title);
  const nd = normalize(survey.description || '');

  if (!nq) return 0;

  const queryTerms = nq.split(/\s+/).filter(t => t.length > 0);
  const titleWords = nt.split(/\s+/);
  const descWords = nd.split(/\s+/);

  let score = 0;

  for (const term of queryTerms) {
    for (const tw of titleWords) {
      if (tw === term) score += 12;
      else if (tw.startsWith(term)) score += 6;
      else if (tw.includes(term)) score += 3;
    }
    for (const dw of descWords) {
      if (dw === term) score += 8;
      else if (dw.startsWith(term)) score += 4;
      else if (dw.includes(term)) score += 2;
    }
  }

  if (nt === nq) score += 20;
  if (nd === nq) score += 15;

  return score;
}

export default function DashboardClient({ surveys: initialSurveys }: { surveys: Survey[] }) {
  const router = useRouter();
  const [surveys, setSurveys] = useState(initialSurveys);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'surveys' | 'security'>('surveys');
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [loading2fa, setLoading2fa] = useState(true);
  
  const [setupStep, setSetupStep] = useState<'idle' | 'scanning'>('idle');
  const [setupSecret, setSetupSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [setupError, setSetupError] = useState('');

  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credentialsError, setCredentialsError] = useState('');
  const [credentialsSuccess, setCredentialsSuccess] = useState('');

  useEffect(() => {
    get2FAStatus()
      .then(res => {
        setIs2faEnabled(res.enabled);
        setAdminEmail(res.username);
        setLoginEmailInput(res.username);
        setLoading2fa(false);
      })
      .catch(err => {
        console.error('Błąd wczytywania 2FA:', err);
        setLoading2fa(false);
      });
  }, []);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialsError('');
    setCredentialsSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setCredentialsError('Hasła nie są identyczne.');
      return;
    }

    try {
      const res = await updateAdminCredentials(loginEmailInput, newPassword || undefined);
      if (res.success) {
        setCredentialsSuccess('Dane logowania zostały zaktualizowane!');
        setAdminEmail(loginEmailInput);
        setNewPassword('');
        setConfirmPassword('');
        if (newPassword) {
          // Zmiana hasła wymaga ponownego zalogowania z nowym tokenem sesyjnym
          router.push('/login');
          router.refresh();
        }
      } else {
        setCredentialsError(res.error || 'Wystąpił błąd podczas zapisywania.');
      }
    } catch (err) {
      setCredentialsError('Brak autoryzacji lub błąd serwera.');
    }
  };

  const handleStartSetup = async () => {
    setSetupError('');
    try {
      const res = await prepare2FA();
      setSetupSecret(res.secret);
      setQrCodeUrl(res.otpauthUrl);
      setSetupStep('scanning');
    } catch (err) {
      setSetupError('Nie udało się wygenerować sekretu 2FA.');
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    try {
      const res = await enable2FA(setupSecret, verificationCode);
      if (res.success) {
        setIs2faEnabled(true);
        setSetupStep('idle');
        setVerificationCode('');
      } else {
        setSetupError(res.error || 'Błędny kod TOTP.');
      }
    } catch (err) {
      setSetupError('Wystąpił błąd weryfikacji.');
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError('');
    try {
      const res = await disable2FA(disableCode);
      if (res.success) {
        setIs2faEnabled(false);
        setShowDisableModal(false);
        setDisableCode('');
      } else {
        setDisableError(res.error || 'Błędny kod TOTP.');
      }
    } catch (err) {
      setDisableError('Wystąpił błąd podczas wyłączania.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() }),
      });
let data: { success?: boolean; id?: string; error?: string } | null = null;
        try { data = await res.json(); } catch { /* nie-JSON */ }

      if (res.ok && data?.success && data.id) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        router.push(`/editor/${data.id}`);
        return;
      }

      const msg = (data && data.error) || `Nie udało się utworzyć ankiety (HTTP ${res.status}).`;
      setCreateError(msg);
    } catch (err) {
      console.error('Błąd tworzenia ankiety:', err);
      setCreateError('Wystąpił błąd podczas tworzenia ankiety. Spróbuj ponownie.');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredSurveys = useMemo(() => {
    if (!searchQuery.trim()) return surveys;

    const results = surveys
      .map(s => ({ survey: s, score: searchScore(s, searchQuery) }))
      .filter(r => r.score > 0);
    
    results.sort((a, b) => b.score - a.score);

    return results.map(r => r.survey);
  }, [surveys, searchQuery]);

  return (
    <div className="container animate-fade-in">
      {/* Zakładki panelu */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('surveys')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '1rem',
            fontWeight: activeTab === 'surveys' ? 600 : 400, 
            color: activeTab === 'surveys' ? 'var(--text-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'surveys' ? '2px solid var(--text-color)' : 'none',
            paddingBottom: '0.5rem',
            marginBottom: '-0.6rem'
          }}
        >
          Moje Ankiety
        </button>
        <button 
          onClick={() => setActiveTab('security')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '1rem',
            fontWeight: activeTab === 'security' ? 600 : 400, 
            color: activeTab === 'security' ? 'var(--text-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'security' ? '2px solid var(--text-color)' : 'none',
            paddingBottom: '0.5rem',
            marginBottom: '-0.6rem'
          }}
        >
          Ustawienia
        </button>
      </div>

      {activeTab === 'surveys' ? (
        <>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 className="h1" style={{ margin: 0 }}>Moje Ankiety</h1>

            <button
              type="button"
              onClick={() => { setCreateError(null); setShowCreateModal(true); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
              }}
            >
              <Plus size={18} />
              Utwórz
            </button>
          </header>

          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Wyszukaj ankiety po tytule lub opisie..."
              className="input"
              style={{
                padding: '1rem 1rem 1rem 2.75rem',
                fontSize: '1.1rem',
                borderRadius: 'var(--radius-lg)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.25rem',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

      {surveys.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <p className="p-muted" style={{ marginBottom: '1rem' }}>Nie masz jeszcze żadnych ankiet.</p>
          <p>Stwórz swoją pierwszą ankietę powyżej!</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <p className="p-muted">Brak wyników dla &quot;{searchQuery}&quot;</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Spróbuj innych słów kluczowych.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredSurveys.map((survey) => (
            <div key={survey.id} className="card animate-slide-down" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="h2" style={{ margin: 0, fontSize: '1.2rem' }}>{survey.title}</h3>
                {survey.description && (
                  <p style={{
                    margin: '0.35rem 0 0 0',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '400px',
                  }}>
                    {survey.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span>{survey.views} wyświetleń</span>
                  <span>{survey.submissions} wypełnień</span>
                  {survey.views > 0 && (
                    <span>{Math.round((survey.submissions / survey.views) * 100)}% konwersji</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <Link href={`/editor/${survey.id}?tab=results`} className="btn btn-secondary" style={{ display: 'flex', gap: '0.35rem' }}>
                  <BarChart size={16} /> Wyniki
                </Link>
                <Link href={`/s/${survey.id}?preview=true`} className="btn btn-secondary" target="_blank" style={{ display: 'flex', gap: '0.35rem' }}>
                  <Eye size={16} /> Podgląd
                </Link>
                <Link href={`/editor/${survey.id}`} className="btn btn-primary" style={{ display: 'flex', gap: '0.35rem' }}>
                  <Pencil size={16} /> Edytuj
                </Link>
                <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3 className="h2" style={{ margin: 0, fontSize: '1.25rem', marginBottom: '0.5rem' }}>Dane logowania administratora</h3>
                <p className="p-muted" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  Zmień adres e-mail (login) lub hasło służące do logowania do panelu administratora.
                </p>

                <form onSubmit={handleUpdateCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '450px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Login (Adres e-mail administratora)</label>
                    <input
                      type="email"
                      value={loginEmailInput}
                      onChange={(e) => setLoginEmailInput(e.target.value)}
                      required
                      className="input"
                      placeholder="np. admin@1tap.pl"
                      style={{ padding: '0.65rem 0.85rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Ten adres e-mail posłuży do logowania oraz na niego będą wysyłane alerty bezpieczeństwa i powiadomienia o wypełnieniu ankiet.
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nowe hasło (pozostaw puste, jeśli nie chcesz zmieniać)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input"
                      placeholder="Wpisz nowe hasło..."
                      style={{ padding: '0.65rem 0.85rem' }}
                    />
                  </div>

                  {newPassword && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }} className="animate-slide-down">
                      <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Potwierdź nowe hasło</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required={!!newPassword}
                        className="input"
                        placeholder="Potwierdź nowe hasło..."
                        style={{ padding: '0.65rem 0.85rem' }}
                      />
                    </div>
                  )}

                  {credentialsError && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #ef4444',
                      color: '#b91c1c',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.9rem'
                    }}>
                      {credentialsError}
                    </div>
                  )}

                  {credentialsSuccess && (
                    <div style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #22c55e',
                      color: '#15803d',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.9rem'
                    }}>
                      {credentialsSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem', backgroundColor: '#3b82f6', color: '#fff' }}
                  >
                    Zapisz dane logowania
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3 className="h2" style={{ margin: 0, fontSize: '1.25rem', marginBottom: '0.5rem' }}>Weryfikacja dwuskładnikowa (2FA)</h3>
                <p className="p-muted" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  Zabezpiecz dodatkowo swoje konto. Oprócz podania hasła administratora, logowanie będzie wymagało wpisania jednorazowego kodu z aplikacji Google Authenticator na telefonie.
                </p>

                {loading2fa ? (
                  <div style={{ color: 'var(--text-muted)' }}>Ładowanie statusu weryfikacji...</div>
                ) : is2faEnabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a', fontWeight: 600 }}>
                      Dwuskładnikowe uwierzytelnianie (2FA) jest aktualnie WŁĄCZONE.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDisableError('');
                        setDisableCode('');
                        setShowDisableModal(true);
                      }}
                      className="btn btn-danger"
                      style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      Wyłącz weryfikację 2FA
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d97706', fontWeight: 600 }}>
                      Dwuskładnikowe uwierzytelnianie (2FA) jest aktualnie WYŁĄCZONE.
                    </div>
                    
                    {setupStep === 'idle' && (
                      <button
                        type="button"
                        onClick={handleStartSetup}
                        className="btn btn-primary"
                        style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem', backgroundColor: '#3b82f6', color: '#fff' }}
                      >
                        Skonfiguruj weryfikację 2FA
                      </button>
                    )}

                    {setupStep === 'scanning' && (
                      <div className="animate-slide-down" style={{ 
                        marginTop: '1rem',
                        padding: '1.5rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        maxWidth: '550px'
                      }}>
                        <div>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Krok 1: Zeskanuj kod QR</strong>
                          <p className="p-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Otwórz aplikację Google Authenticator (lub inną aplikację TOTP, np. Authy) na telefonie, naciśnij ikonę &quot;+&quot; i wybierz &quot;Zeskanuj kod QR&quot;.
                          </p>
                          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeUrl)}`} 
                              alt="Kod QR do konfiguracji 2FA" 
                              style={{ 
                                width: '180px', 
                                height: '180px', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '8px',
                                backgroundColor: '#fff',
                                padding: '10px'
                              }} 
                            />
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Klucz ręczny (jeśli nie możesz skanować):</span>
                              <code style={{ 
                                display: 'block', 
                                padding: '0.5rem', 
                                backgroundColor: '#f1f5f9', 
                                borderRadius: '4px', 
                                fontSize: '0.95rem',
                                fontWeight: 'bold',
                                marginTop: '0.25rem',
                                letterSpacing: '0.05em',
                                wordBreak: 'break-all'
                              }}>
                                {setupSecret}
                              </code>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Krok 2: Weryfikacja kodu</strong>
                          <p className="p-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Wpisz 6-cyfrowy kod, który generuje teraz aplikacja, aby potwierdzić prawidłową konfigurację.
                          </p>
                          <form onSubmit={handleVerifyAndEnable} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              required
                              style={{
                                padding: '0.6rem',
                                fontSize: '1.1rem',
                                width: '120px',
                                textAlign: 'center',
                                letterSpacing: '0.1em',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)'
                              }}
                            />
                            <button
                              type="submit"
                              className="btn btn-primary"
                              style={{ backgroundColor: '#22c55e', color: '#fff', padding: '0.65rem 1.25rem' }}
                            >
                              Potwierdź i włącz
                            </button>
                            <button
                              type="button"
                              onClick={() => setSetupStep('idle')}
                              className="btn btn-secondary"
                              style={{ padding: '0.65rem 1.25rem' }}
                            >
                              Anuluj
                            </button>
                          </form>
                        </div>

                        {setupError && (
                          <div style={{
                            backgroundColor: '#fef2f2',
                            border: '1px solid #ef4444',
                            color: '#b91c1c',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.9rem'
                          }}>
                            {setupError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDisableModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDisableModal(false);
              setDisableCode('');
              setDisableError('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              maxWidth: '450px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '2px solid var(--primary-color)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Wyłącz weryfikację dwuskładnikową</h3>
            <p className="p-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Aby wyłączyć 2FA, musisz przepisać aktualny 6-cyfrowy kod zabezpieczający ze swojej aplikacji weryfikacyjnej.
            </p>

            {disableError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #ef4444',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                marginBottom: '1rem',
              }}>
                {disableError}
              </div>
            )}

            <form onSubmit={handleDisable2FA}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Kod 2FA z telefonu
              </label>
              <input
                type="text"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input"
                required
                autoFocus
                style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.15em' }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableModal(false);
                    setDisableCode('');
                    setDisableError('');
                  }}
                  className="btn btn-secondary"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Wyłącz 2FA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setNewTitle('');
              setNewDescription('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '2px solid var(--primary-color)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Nowa ankieta</h3>

            {createError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #ef4444',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                marginBottom: '1rem',
              }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Nazwa ankiety <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="np. Badanie satysfakcji klienta"
                className="input"
                required
                autoFocus
                style={{ marginBottom: '1rem' }}
              />

              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Opis ankiety <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcjonalny)</span>
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Krótki opis co zawiera ankieta..."
                className="input"
                rows={3}
                style={{ resize: 'vertical', marginBottom: '1.5rem' }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTitle('');
                    setNewDescription('');
                    setCreateError(null);
                  }}
                  className="btn btn-secondary"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: !newTitle.trim() || isCreating ? 0.5 : 1,
                  }}
                  disabled={!newTitle.trim() || isCreating}
                >
                  {isCreating ? 'Tworzenie...' : 'Utwórz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
