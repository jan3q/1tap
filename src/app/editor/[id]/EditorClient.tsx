'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Survey, SurveySchema, Question, QuestionType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { ArrowUp, ArrowDown, Trash2, Plus, Save, Settings, GripVertical, CheckCircle2, Type, AlignLeft, CircleDot, CheckSquare, SlidersHorizontal, Hash, Share2, Eye, Check, Shield, Copy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RichTextField } from './RichTextField';
import { getScaleValues } from '@/lib/utils';

const MANUAL_COLORS: { name: string; hex: string }[] = [
  { name: 'Niebieski', hex: '#3b82f6' },
  { name: 'Fioletowy', hex: '#a855f7' },
  { name: 'Żółty', hex: '#eab308' },
  { name: 'Pomarańczowy', hex: '#f97316' },
  { name: 'Czerwony', hex: '#ef4444' },
  { name: 'Czarny', hex: '#1a1a1a' },
  { name: 'Zielony', hex: '#22c55e' },
];

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        backgroundColor: checked ? 'var(--primary-color)' : '#e4e4e7',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        transition: 'background-color 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0
      }}
    >
      <span
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
          transition: 'transform 0.2s ease',
          display: 'block'
        }}
      />
    </button>
  );
}

export default function EditorClient({ 
  initialSurvey,
  initialResponses,
  initialTab = 'editor',
  actualAppUrl = 'http://localhost:3001',
  configuredAppUrl = ''
}: { 
  initialSurvey: Omit<Survey, 'schema_json'> & { schema: SurveySchema };
  initialResponses: any[];
  initialTab?: 'editor' | 'settings' | 'results';
  actualAppUrl?: string;
  configuredAppUrl?: string;
}) {
  const [title, setTitle] = useState(initialSurvey.title);
  const [description, setDescription] = useState(initialSurvey.description || '');
  const [questions, setQuestions] = useState<Question[]>(() => {
    const list = [...(initialSurvey.schema.questions || [])];
    const hasGlobalHeader = initialSurvey.schema.header || initialSurvey.schema.description;
    const hasHeaderBlock = list.some(q => q.type === 'header');
    
    // Migracja starego schematu
    if (hasGlobalHeader && !hasHeaderBlock) {
      list.unshift({
        id: 'legacy-header',
        type: 'header',
        title: initialSurvey.schema.header || '',
        description: initialSurvey.schema.description || '',
        required: false
      });
    }
    return list;
  });
  const [redirectUrl, setRedirectUrl] = useState(initialSurvey.redirect_url || '');
  const [webhookUrl, setWebhookUrl] = useState(initialSurvey.webhook_url || '');
  const [theme, setTheme] = useState<'light' | 'dark'>(initialSurvey.schema.theme || 'light');
  const [buttonColor, setButtonColor] = useState(initialSurvey.schema.buttonColor || '#000000');
  const [submitBtnText, setSubmitBtnText] = useState(initialSurvey.schema.submitBtnText || 'Wyślij odpowiedź');
  const [submitBtnSize, setSubmitBtnSize] = useState<'small' | 'medium' | 'large'>(initialSurvey.schema.submitBtnSize || 'medium');
  const [submitBtnAlign, setSubmitBtnAlign] = useState<'left' | 'right' | 'center' | 'full'>(initialSurvey.schema.submitBtnAlign || 'right');
  const [emailNotifications, setEmailNotifications] = useState<boolean>(initialSurvey.schema.emailNotifications || false);
  const [oneQuestionPerPage, setOneQuestionPerPage] = useState<boolean>(initialSurvey.schema.oneQuestionPerPage || false);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(initialSurvey.schema.showProgressBar !== false);
  const [showBtnConfig, setShowBtnConfig] = useState(false);
  const [manualConnections, setManualConnections] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'results'>(initialTab);
  const [resultsSubTab, setResultsSubTab] = useState<'summary' | 'responses'>('summary');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([]);
  const router = useRouter();
  const [showConnections, setShowConnections] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const CONNECTION_COLORS = useMemo(() => [
    '#3b82f6', // niebieski
    '#f97316', // pomarańczowy
    '#a855f7', // fioletowy
    '#eab308', // żółty
    '#1e3a5f', // granatowy
    '#ef4444', // czerwony
    '#14b8a6', // turkusowy
    '#1a1a1a', // czarny
    '#22c55e', // zielony
  ], []);

  const questionGroups = useMemo(() => {
    // Automatyczne powiązania (z logiki warunkowej) widoczne tylko gdy
    // włączono "Pokaż powiązania" oraz wyłączono tryb samodzielny.
    if (!showConnections || manualConnections) return new Map<string, number[]>();
    const groups = new Map<string, number[]>();
    let groupIdx = 0;

    questions.forEach(q => {
      if (q.logic?.conditions && q.logic.conditions.length > 0) {
        const allIds = new Set<string>();
        allIds.add(q.id);
        q.logic.conditions.forEach(cond => {
          if (cond.fieldId) allIds.add(cond.fieldId);
        });

        allIds.forEach(id => {
          if (!groups.has(id)) groups.set(id, []);
          groups.get(id)!.push(groupIdx);
        });
        groupIdx++;
      }
    });

    return groups;
  }, [questions, showConnections, manualConnections]);

  const manualColorActive = showConnections && manualConnections;

  if (!mounted) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Ładowanie edytora...
      </div>
    );
  }

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 15000); // 15 sekund
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const schema = { 
          questions, 
          theme, 
          buttonColor,
          submitBtnText,
          submitBtnSize,
          submitBtnAlign,
          emailNotifications,
          oneQuestionPerPage,
          showProgressBar
        };
        const res = await fetch(`/api/surveys/${initialSurvey.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema, title, redirectUrl: redirectUrl || null, webhookUrl: webhookUrl || null, description: description || null }),
        });
        let data: { success?: boolean; error?: string } | null = null;
        try { data = await res.json(); } catch { /* nie-JSON */ }

        if (res.ok && data?.success) {
          setSaved(true);
          addToast('Ustawienia i struktura ankiety zostały pomyślnie zapisane!', 'success');
          setTimeout(() => setSaved(false), 2000);
          router.refresh();
        } else {
          addToast(`Błąd zapisu: ${(data && data.error) || `HTTP ${res.status}`}`, 'error');
        }
      } catch (err) {
        addToast(`Błąd zapisu: ${(err as Error).message}`, 'error');
      }
    });
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: uuidv4(),
      type,
      title: type === 'gdpr' ? 'Zgoda' : '',
      description: type === 'gdpr' ? 'Przeczytałem/am politykę prywatności i akceptuję jej treść. Wyrażam zgodę na otrzymywanie wiadomości na wskazany email także o charakterze marketingowym.' : undefined,
      required: type === 'gdpr' ? true : false,
      options: type === 'radio' || type === 'checkbox' ? ['Opcja 1'] : undefined,
      scaleMin: type === 'scale' ? 1 : undefined,
      scaleMax: type === 'scale' ? 10 : undefined,
      scaleStep: type === 'scale' ? 1 : undefined,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const getQuestionConnections = (questionId: string): { targets: Question[]; sources: Question[] } => {
    const targets = questions.filter(q => 
      q.id !== questionId && q.logic?.conditions?.some(c => c.fieldId === questionId)
    );
    const question = questions.find(q => q.id === questionId);
    const sources = question?.logic?.conditions
      ?.map(c => questions.find(q => q.id === c.fieldId))
      .filter(Boolean) as Question[] || [];
    return { targets, sources };
  };

  const handleDeleteClick = (id: string) => {
    const { targets, sources } = getQuestionConnections(id);
    if (targets.length > 0 || sources.length > 0) {
      setDeleteQuestionId(id);
    } else {
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const confirmDeleteQuestion = () => {
    if (deleteQuestionId) {
      setQuestions(questions.filter(q => q.id !== deleteQuestionId));
      setDeleteQuestionId(null);
    }
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const duplicateQuestion = (index: number) => {
    const qToDuplicate = questions[index];
    const newId = uuidv4();
    const duplicatedQuestion = {
      ...qToDuplicate,
      id: newId,
      title: qToDuplicate.title ? qToDuplicate.title + ' (kopia)' : '',
      options: qToDuplicate.options ? [...qToDuplicate.options] : undefined,
      logic: qToDuplicate.logic ? JSON.parse(JSON.stringify(qToDuplicate.logic)) : undefined
    };
    const newQ = [...questions];
    newQ.splice(index + 1, 0, duplicatedQuestion);
    setQuestions(newQ);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newQ = [...questions];
    [newQ[index - 1], newQ[index]] = [newQ[index], newQ[index - 1]];
    setQuestions(newQ);
  };

  const moveDown = (index: number) => {
    if (index === questions.length - 1) return;
    const newQ = [...questions];
    [newQ[index], newQ[index + 1]] = [newQ[index + 1], newQ[index]];
    setQuestions(newQ);
  };

  const cleanConfigUrl = configuredAppUrl ? configuredAppUrl.replace(/\/$/, '') : '';
  const cleanActualUrl = actualAppUrl ? actualAppUrl.replace(/\/$/, '') : '';
  const hasDomainMismatch = cleanConfigUrl && cleanConfigUrl !== cleanActualUrl;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '6rem' }}>
      {hasDomainMismatch && (
        <div style={{ 
          backgroundColor: '#fffbeb', 
          borderColor: '#f59e0b', 
          borderWidth: '1px', 
          borderStyle: 'solid', 
          borderRadius: 'var(--radius-md)', 
          padding: '1rem', 
          marginBottom: '1.5rem', 
          color: '#b45309', 
          fontSize: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <strong style={{ fontWeight: 700 }}>⚠️ Wykryto niezgodność konfiguracji domeny</strong>
          <span>Ta instalacja aplikacji działa pod adresem <strong>{cleanActualUrl}</strong>, ale w ustawieniach systemowych (plik `.env`) zdefiniowano stały adres produkcyjny <strong>{cleanConfigUrl}</strong>. Zweryfikuj zmienną środowiskową <code>NEXT_PUBLIC_APP_URL</code> przed kopiowaniem kodów wklejek.</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <input 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h1"
          style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', margin: 0, padding: 0 }}
          placeholder="Tytuł ankiety..."
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/s/${initialSurvey.id}?preview=true`} className="btn btn-secondary" target="_blank" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Eye size={16} /> Podgląd
          </Link>
          <Link href={`/share/${initialSurvey.id}`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Share2 size={16} /> Udostępnij
          </Link>
          <button onClick={handleSave} className="btn btn-primary" disabled={isPending}>
            {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
            {isPending ? 'Zapisywanie...' : saved ? 'Zapisano' : 'Zapisz'}
          </button>
        </div>
      </div>

      {/* Zakładki */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('editor')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '1rem',
            fontWeight: activeTab === 'editor' ? 600 : 400, 
            color: activeTab === 'editor' ? 'var(--text-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'editor' ? '2px solid var(--text-color)' : 'none',
            paddingBottom: '0.5rem',
            marginBottom: '-0.6rem'
          }}
        >
          Kreator pytań
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '1rem',
            fontWeight: activeTab === 'settings' ? 600 : 400, 
            color: activeTab === 'settings' ? 'var(--text-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'settings' ? '2px solid var(--text-color)' : 'none',
            paddingBottom: '0.5rem',
            marginBottom: '-0.6rem'
          }}
        >
          Ustawienia
        </button>
        <button 
          onClick={() => setActiveTab('results')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '1rem',
            fontWeight: activeTab === 'results' ? 600 : 400, 
            color: activeTab === 'results' ? 'var(--text-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'results' ? '2px solid var(--text-color)' : 'none',
            paddingBottom: '0.5rem',
            marginBottom: '-0.6rem'
          }}
        >
          Wyniki ({initialResponses.length})
        </button>
      </div>

      {activeTab === 'editor' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {questions.length === 0 && (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                Zacznij budować ankietę dodając pierwszy element.
              </div>
            )}
            
            {questions.map((q, i) => {
              const groups = questionGroups.get(q.id);
              const isConnected = groups && groups.length > 0 && showConnections;
              const firstColor = isConnected && groups ? CONNECTION_COLORS[groups[0] % CONNECTION_COLORS.length] : undefined;
              const boxShadowStyle = isConnected && groups
                ? groups.map((gIdx, gi) => `0 0 0 ${(gi + 1) * 3}px ${CONNECTION_COLORS[gIdx % CONNECTION_COLORS.length]}`).join(', ')
                : undefined;
              const manualColor = manualColorActive ? q.colorTag : undefined;
              return (
              <div key={q.id} className="card animate-slide-down" style={{ 
                display: 'flex', gap: '1rem', position: 'relative',
                ...(isConnected ? {
                  border: 'none',
                  backgroundColor: `${firstColor}0D`,
                  boxShadow: boxShadowStyle,
                } : {}),
                ...(manualColor ? {
                  border: 'none',
                  boxShadow: `0 0 0 3px ${manualColor}`,
                  backgroundColor: `${manualColor}0D`,
                } : {}),
                ...(focusedQuestionId === q.id ? {
                  border: (isConnected || manualColor) ? 'none' : '1px solid #333',
                  boxShadow: isConnected 
                    ? `${boxShadowStyle}, 0 0 0 1px #333 inset` 
                    : manualColor
                      ? `0 0 0 3px ${manualColor}, 0 0 0 1px #333 inset`
                      : '0 0 0 1px #333',
                  backgroundColor: isConnected ? `${firstColor}0D` : manualColor ? `${manualColor}0D` : '#f0f0f3',
                } : {}),
              }}
              onClick={() => setFocusedQuestionId(q.id)}
              tabIndex={0}
              onFocus={() => setFocusedQuestionId(q.id)}
              >
                {q.required && <span style={{ position: 'absolute', top: '0.25rem', left: '0.5rem', color: '#ef4444', fontWeight: 'bold', fontSize: '1.25rem', lineHeight: 1 }} title="Pole wymagane">*</span>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-muted)' }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}>
                    <ArrowUp size={20} />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === questions.length - 1} style={{ background: 'none', border: 'none', cursor: i === questions.length - 1 ? 'default' : 'pointer', opacity: i === questions.length - 1 ? 0.3 : 1 }}>
                    <ArrowDown size={20} />
                  </button>
                </div>

                {manualColorActive && (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '0.15rem' }}
                    title="Kolory powiązania"
                  >
                    {MANUAL_COLORS.map(c => {
                      const isActive = (q.colorTag || '') === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => updateQuestion(q.id, isActive ? { colorTag: undefined } : { colorTag: c.hex })}
                          title={`${c.name}${isActive ? ' (kliknij aby odznaczyć)' : ''}`}
                          aria-label={`${c.name}${isActive ? ' — zaznaczony' : ''}`}
                          aria-pressed={isActive}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            border: isActive ? '2px solid var(--text-color)' : '2px solid rgba(0,0,0,0.15)',
                            backgroundColor: c.hex,
                            cursor: 'pointer',
                            padding: 0,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}` : 'none',
                            transition: 'box-shadow 0.15s ease, transform 0.1s ease',
                            transform: isActive ? 'scale(1.08)' : 'scale(1)',
                          }}
                        >
                          {isActive && (
                            <Check size={14} color={c.hex === '#eab308' || c.hex === '#22c55e' ? '#1a1a1a' : '#fff'} strokeWidth={3} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {q.type === 'header' ? (
                        <>
                          <RichTextField 
                            value={q.title}
                            onChange={(val) => updateQuestion(q.id, { title: val })}
                            placeholder="Wpisz główny nagłówek sekcji..."
                            className="input"
                            style={{ fontSize: '1.4rem', fontWeight: 700, padding: '0.5rem 0', border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: 0, boxShadow: 'none' }}
                          />
                          <RichTextField 
                            value={q.description || ''}
                            onChange={(val) => updateQuestion(q.id, { description: val })}
                            placeholder="Wpisz podnagłówek / opis sekcji (opcjonalnie)..."
                            className="input"
                            style={{ fontSize: '0.95rem', padding: '0.25rem 0', border: 'none', borderBottom: '1px dashed var(--border-color)', borderRadius: 0, boxShadow: 'none' }}
                          />
                        </>
                      ) : (
                        <>
                          <RichTextField 
                            value={q.title}
                            onChange={(val) => updateQuestion(q.id, { title: val })}
                            placeholder="Wpisz swoje pytanie..."
                            className="input"
                            style={{ fontSize: '1.2rem', fontWeight: 500, padding: '0.5rem 0', border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: 0, boxShadow: 'none' }}
                          />
                          <RichTextField 
                            value={q.description || ''}
                            onChange={(val) => updateQuestion(q.id, { description: val })}
                            placeholder="Dodaj objaśnienie / pomocniczy opis (opcjonalnie)..."
                            className="input"
                            style={{ fontSize: '0.9rem', color: 'var(--text-muted)', padding: '0.2rem 0', border: 'none', borderBottom: '1px dashed var(--border-color)', borderRadius: 0, boxShadow: 'none' }}
                          />
                        </>
                      )}
                    </div>
                    <select 
                      value={q.type}
                      onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                      className="input"
                      style={{ width: 'auto' }}
                    >
                      <option value="short-text">Krótkie pytanie</option>
                      <option value="long-text">Długie pytanie</option>
                      <option value="number">Liczba</option>
                      <option value="checkbox">Wielokrotny wybór</option>
                      <option value="radio">Pojedynczy wybór</option>
                      <option value="scale">Skala 1-10</option>
                      <option value="header">Nagłówek sekcji</option>
                      <option value="gdpr">Zgoda RODO / GDPR</option>
                    </select>
                  </div>

                  {/* Specific fields based on type */}
                  {(q.type === 'radio' || q.type === 'checkbox') && (
                    <div style={{ paddingLeft: '1rem' }}>
                      {q.options?.map((opt, optIdx) => (
                        <div key={optIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                          {q.type === 'radio' ? (
                            <div style={{width: 18, height: 18, borderRadius: 18, border: '2px solid var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                              <div style={{width: 8, height: 8, borderRadius: 8, backgroundColor: 'var(--text-color)'}} />
                            </div>
                          ) : (
                            <div style={{width: 18, height: 18, borderRadius: 4, border: '2px solid var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                              <div style={{width: 8, height: 8, backgroundColor: 'var(--text-color)'}} />
                            </div>
                          )}
                          <input 
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(q.options || [])];
                              newOpts[optIdx] = e.target.value;
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            className="input"
                            style={{ padding: '0.25rem 0.5rem', border: '1px solid transparent' }}
                          />
                          <button onClick={() => {
                            const newOpts = [...(q.options || [])];
                            newOpts.splice(optIdx, 1);
                            updateQuestion(q.id, { options: newOpts });
                          }} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => {
                         updateQuestion(q.id, { options: [...(q.options || []), `Opcja ${(q.options?.length || 0) + 1}`] });
                      }} className="btn btn-secondary" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        + Dodaj opcję
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginTop: '0.75rem', userSelect: 'none' }}>
                        <Switch 
                          checked={q.customAnswer || false}
                          onChange={(val) => updateQuestion(q.id, { customAnswer: val })}
                        />
                        Własna odpowiedź
                      </label>
                    </div>
                  )}

                  {q.type === 'scale' && (
                    <div style={{ paddingLeft: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Od
                        <input
                          type="number"
                          value={q.scaleMin ?? 1}
                          onChange={(e) => updateQuestion(q.id, { scaleMin: e.target.value === '' ? undefined : Number(e.target.value) })}
                          className="input"
                          style={{ width: '90px', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
                          placeholder="1"
                          step="any"
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Do
                        <input
                          type="number"
                          value={q.scaleMax ?? 10}
                          onChange={(e) => updateQuestion(q.id, { scaleMax: e.target.value === '' ? undefined : Number(e.target.value) })}
                          className="input"
                          style={{ width: '90px', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
                          placeholder="10"
                          step="any"
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Krok
                        <input
                          type="number"
                          value={q.scaleStep ?? 1}
                          onChange={(e) => updateQuestion(q.id, { scaleStep: e.target.value === '' ? undefined : Number(e.target.value) })}
                          className="input"
                          style={{ width: '90px', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
                          placeholder="1"
                          step="any"
                        />
                      </label>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: '0.45rem' }}>
                        Wartości: {(() => {
                          const vals = getScaleValues(q);
                          const previewVals = vals.slice(0, 5);
                          return previewVals.join(', ') + (vals.length > 5 ? ', …' : '');
                        })()}
                      </span>
                    </div>
                  )}

                  {i > 0 && q.type !== 'header' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, marginBottom: q.logic ? '0.5rem' : 0 }}>
                        <Switch 
                          checked={!!q.logic} 
                          onChange={(val) => {
                            if (val) {
                              const prevQuestions = questions.slice(0, i).filter(pq => pq.type !== 'header');
                              if (prevQuestions.length === 0) {
                                addToast('Nie można włączyć logiki: brak wcześniejszych pytań z odpowiedziami.', 'error');
                                return;
                              }
                              updateQuestion(q.id, { 
                                logic: { 
                                  strategy: 'all',
                                  conditions: [{
                                    id: uuidv4(),
                                    fieldId: prevQuestions[0].id, 
                                    operator: 'equals',
                                    value: '' 
                                  }]
                                } 
                              });
                            } else {
                              updateQuestion(q.id, { logic: undefined });
                            }
                          }}
                        />
                        Włącz logikę warunkową (pokaż tylko pod warunkiem)
                      </label>

                      {q.logic && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>
                            <span>Logika warunków:</span>
                            <div style={{ display: 'inline-flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              <button
                                type="button"
                                onClick={() => updateQuestion(q.id, { logic: { ...q.logic!, strategy: 'all' } })}
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '4px',
                                  backgroundColor: q.logic.strategy === 'all' ? '#dbeafe' : 'transparent',
                                  color: q.logic.strategy === 'all' ? '#1e40af' : '#64748b',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transform: q.logic.strategy === 'all' ? 'scale(1.05)' : 'scale(0.95)',
                                  transition: 'transform 0.15s ease, background-color 0.15s ease'
                                }}
                              >
                                Wszystkie warunki (I)
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuestion(q.id, { logic: { ...q.logic!, strategy: 'any' } })}
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '4px',
                                  backgroundColor: q.logic.strategy === 'any' ? '#fef3c7' : 'transparent',
                                  color: q.logic.strategy === 'any' ? '#92400e' : '#64748b',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transform: q.logic.strategy === 'any' ? 'scale(1.05)' : 'scale(0.95)',
                                  transition: 'transform 0.15s ease, background-color 0.15s ease'
                                }}
                              >
                                Dowolny warunek (LUB)
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {q.logic.conditions.map((cond, condIdx) => {
                              const targetQ = questions.find(pq => pq.id === cond.fieldId);
                              const hasOptions = targetQ && (targetQ.type === 'radio' || targetQ.type === 'checkbox');
                              const prevQuestions = questions.slice(0, i).filter(pq => pq.type !== 'header');

                              return (
                                <div key={cond.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    
                                    <select 
                                      value={cond.fieldId}
                                      onChange={(e) => {
                                        const newConds = [...q.logic!.conditions];
                                        newConds[condIdx] = { ...cond, fieldId: e.target.value, value: '' };
                                        updateQuestion(q.id, { logic: { ...q.logic!, conditions: newConds } });
                                      }}
                                      className="input"
                                      style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                    >
                                      {prevQuestions.map((pq, idx) => (
                                        <option key={pq.id} value={pq.id}>
                                          Pytanie: {pq.title ? pq.title.replace(/<[^>]*>/g, '').substring(0, 25) + '...' : '\u00A0'}
                                        </option>
                                      ))}
                                    </select>

                                    <select 
                                      value={cond.operator}
                                      onChange={(e) => {
                                        const newConds = [...q.logic!.conditions];
                                        newConds[condIdx] = { ...cond, operator: e.target.value as any };
                                        updateQuestion(q.id, { logic: { ...q.logic!, conditions: newConds } });
                                      }}
                                      className="input"
                                      style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                    >
                                      <option value="equals">=</option>
                                      <option value="not-equals">!= (to NIE - Y)</option>
                                      <option value="contains">zawiera</option>
                                      <option value="not-contains">nie zawiera</option>
                                      <option value="empty">jest puste</option>
                                      <option value="not-empty">nie jest puste</option>
                                      <option value="greater">&gt;</option>
                                      <option value="less">&lt;</option>
                                    </select>

                                    {!['empty', 'not-empty'].includes(cond.operator) && (
                                      hasOptions ? (
                                        <select
                                          value={cond.value || ''}
                                          onChange={(e) => {
                                            const newConds = [...q.logic!.conditions];
                                            newConds[condIdx] = { ...cond, value: e.target.value };
                                            updateQuestion(q.id, { logic: { ...q.logic!, conditions: newConds } });
                                          }}
                                          className="input"
                                          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                        >
                                          <option value="">-- wybierz opcję --</option>
                                          {targetQ.options?.map((opt, oIdx) => (
                                            <option key={oIdx} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input 
                                          type="text"
                                          value={cond.value || ''}
                                          onChange={(e) => {
                                            const newConds = [...q.logic!.conditions];
                                            newConds[condIdx] = { ...cond, value: e.target.value };
                                            updateQuestion(q.id, { logic: { ...q.logic!, conditions: newConds } });
                                          }}
                                          placeholder="Wartość..."
                                          className="input"
                                          style={{ width: '120px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                        />
                                      )
                                    )}

                                    {q.logic?.conditions && q.logic.conditions.length > 1 && (
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          const newConds = q.logic!.conditions.filter(c => c.id !== cond.id);
                                          updateQuestion(q.id, { logic: { ...q.logic!, conditions: newConds } });
                                        }}
                                        className="btn btn-danger"
                                        style={{ padding: '0.15rem 0.35rem', fontSize: '0.75rem', minHeight: 'auto' }}
                                      >
                                        Usuń
                                      </button>
                                    )}
                                  </div>

                                  {q.logic?.conditions && condIdx < q.logic.conditions.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '1rem', margin: '0.5rem 0' }}>
                                      <div style={{ display: 'inline-flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                        <button 
                                          type="button"
                                          onClick={() => updateQuestion(q.id, { logic: { ...q.logic!, strategy: 'all' } })}
                                          style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 'bold', 
                                            padding: '0.2rem 0.6rem', 
                                            borderRadius: '4px', 
                                            backgroundColor: q.logic!.strategy === 'all' ? '#dbeafe' : 'transparent',
                                            color: q.logic!.strategy === 'all' ? '#1e40af' : '#64748b',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transform: q.logic!.strategy === 'all' ? 'scale(1.1)' : 'scale(0.9)',
                                            transition: 'transform 0.15s ease, background-color 0.15s ease'
                                          }}
                                          title="Wszystkie warunki muszą być spełnione"
                                        >
                                          I
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => updateQuestion(q.id, { logic: { ...q.logic!, strategy: 'any' } })}
                                          style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 'bold', 
                                            padding: '0.2rem 0.6rem', 
                                            borderRadius: '4px', 
                                            backgroundColor: q.logic!.strategy === 'any' ? '#fef3c7' : 'transparent',
                                            color: q.logic!.strategy === 'any' ? '#92400e' : '#64748b',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transform: q.logic!.strategy === 'any' ? 'scale(1.1)' : 'scale(0.9)',
                                            transition: 'transform 0.15s ease, background-color 0.15s ease'
                                          }}
                                          title="Dowolny warunek może być spełniony"
                                        >
                                          LUB
                                        </button>
                                      </div>
                                      <div style={{ flex: 1, height: '1px', borderBottom: '1px dashed var(--border-color)', marginLeft: '0.5rem' }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <button 
                            type="button" 
                            onClick={() => {
                              const prevQuestions = questions.slice(0, i).filter(pq => pq.type !== 'header');
                              const newCond = {
                                id: uuidv4(),
                                fieldId: prevQuestions[0].id,
                                operator: 'equals' as const,
                                value: ''
                              };
                              updateQuestion(q.id, { logic: { ...q.logic!, conditions: [...q.logic!.conditions, newCond] } });
                            }}
                            className="btn btn-secondary"
                            style={{ alignSelf: 'flex-start', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                          >
                            + Dodaj warunek
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    {q.type !== 'header' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginRight: 'auto', userSelect: 'none' }}>
                        <Switch 
                          checked={q.required}
                          onChange={(val) => updateQuestion(q.id, { required: val })}
                        />
                        Wymagane
                      </label>
                    )}
                    <button onClick={() => duplicateQuestion(i)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem' }} title="Duplikuj">
                      <Copy size={16} /> Duplikuj
                    </button>
                    <button onClick={() => handleDeleteClick(q.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                      <Trash2 size={16} /> {q.type === 'header' ? 'Usuń sekcję' : 'Usuń'}
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: '2rem', borderStyle: 'dashed', backgroundColor: '#fcfcfd', textAlign: 'center', padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', marginTop: 0 }}>Dodaj element do ankiety</h4>
            <button onClick={() => addQuestion('header')} className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.85rem', minHeight: 'auto', border: '1px solid var(--border-color)', backgroundColor: '#f8fafc', fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-color)', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)', marginBottom: '0.75rem' }}>
              <Plus size={18}/> Nagłówek i podtytuł
            </button>
            <div className="add-element-grid">
              <button onClick={() => addQuestion('short-text')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <Type size={16}/> Krótkie pytanie
              </button>
              <button onClick={() => addQuestion('long-text')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <AlignLeft size={16}/> Długie pytanie
              </button>
              <button onClick={() => addQuestion('number')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <Hash size={16}/> Liczba
              </button>
              <button onClick={() => addQuestion('radio')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <CircleDot size={16}/> Jeden wybór
              </button>
              <button onClick={() => addQuestion('checkbox')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <CheckSquare size={16}/> Wiele wyborów
              </button>
              <button onClick={() => addQuestion('scale')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <SlidersHorizontal size={16}/> Skala
              </button>
              <button onClick={() => addQuestion('gdpr')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <Shield size={16}/> Zgoda RODO
              </button>
            </div>
          </div>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#eff6ff',
            border: '2px solid #3b82f6',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 14px rgba(59,130,246,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🔗</span>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#1e40af' }}>Pokaż powiązania</strong>
                  <p style={{ fontSize: '0.8rem', color: '#3b82f6', margin: 0 }}>Pola połączone logiką warunkową zostaną podświetlone tym samym kolorem</p>
                </div>
              </div>
              <Switch checked={showConnections} onChange={(v) => { setShowConnections(v); if (!v) setManualConnections(false); }} />
            </div>

            {showConnections && (
              <div style={{
                borderTop: '1px dashed #93c5fd',
                paddingTop: '0.75rem',
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                paddingLeft: '0.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.95rem' }}>🎨</span>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: '#1e40af' }}>Samodzielne powiązanie</strong>
                    <p style={{ fontSize: '0.78rem', color: '#3b82f6', margin: 0 }}>
                      Automatyczne oznaczenia znikają. Klikaj kolory po lewej stronie pytania, aby nadać mu kolor ramki (ponowne kliknięcie odznacza).
                    </p>
                    {manualConnections && (
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', alignItems: 'center' }}>
                        {MANUAL_COLORS.map(c => (
                          <span key={c.hex} title={c.name} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(0,0,0,0.2)', display: 'inline-block' }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Switch checked={manualConnections} onChange={setManualConnections} />
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'settings' ? (
        <div className="card animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
          <div>
            <h3 className="h2" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Motyw i wygląd</h3>
            <p className="p-muted" style={{ marginBottom: '1rem' }}>Dostosuj wygląd publicznej strony ankiety. Zmiany zapisz przyciskiem „Zapisz&quot;.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Motyw</label>
                <div style={{ display: 'inline-flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      if (buttonColor === '#ffffff') {
                        setButtonColor('#000000');
                      }
                    }}
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: theme === 'light' ? '#fff' : 'transparent',
                      color: theme === 'light' ? 'var(--text-color)' : 'var(--text-muted)',
                      boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    ☀️ Jasny
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      if (buttonColor === '#000000') {
                        setButtonColor('#ffffff');
                      }
                    }}
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: theme === 'dark' ? '#1e293b' : 'transparent',
                      color: theme === 'dark' ? '#e5e7eb' : 'var(--text-muted)',
                      boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    🌙 Ciemny
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Kolor przycisków</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    style={{ width: '42px', height: '42px', padding: 0, border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' }}
                    aria-label="Wybierz kolor przycisków"
                  />
                  <input
                    type="text"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="input"
                    style={{ width: '110px', padding: '0.45rem 0.6rem', fontSize: '0.9rem', textTransform: 'uppercase' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Szybki wybór:</span>
                  {['#ffffff', '#000000', '#3b82f6', '#a855f7', '#ef4444', '#22c55e', '#f97316', '#eab308'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setButtonColor(c)}
                      aria-label={`Ustaw kolor ${c}`}
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%', backgroundColor: c,
                        border: buttonColor.toLowerCase() === c ? '2px solid var(--text-color)' : '2px solid rgba(0,0,0,0.15)',
                        cursor: 'pointer', padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>Przycisk wyślij odpowiedź</label>
                <p className="p-muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  Kliknij przycisk poniżej, aby zmienić napis na nim, dostosować rozmiar oraz wyrównanie układu.
                </p>
                
                <div style={{ 
                  border: '1px dashed var(--border-color)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '1.5rem', 
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  display: 'flex',
                  justifyContent: submitBtnAlign === 'left' ? 'flex-start' : submitBtnAlign === 'center' ? 'center' : submitBtnAlign === 'right' ? 'flex-end' : 'stretch',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowBtnConfig(!showBtnConfig)}
                    style={{
                      padding: submitBtnSize === 'small' ? '0.5rem 1rem' : submitBtnSize === 'large' ? '1.25rem 2.5rem' : '0.85rem 1.75rem',
                      fontSize: submitBtnSize === 'small' ? '0.85rem' : submitBtnSize === 'large' ? '1.2rem' : '1.05rem',
                      backgroundColor: buttonColor,
                      color: (['#eab308', '#22c55e', '#f97316', '#ffffff', '#fff'].includes(buttonColor.toLowerCase()) || (theme === 'dark' && buttonColor.toLowerCase() === '#ffffff')) ? '#1a1a1a' : '#fff',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)',
                      border: buttonColor.toLowerCase() === '#ffffff' ? '1px solid #ccc' : 'none',
                      cursor: 'pointer',
                      boxShadow: `0 2px 8px ${buttonColor}44`,
                      width: submitBtnAlign === 'full' ? '100%' : 'auto',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {submitBtnText}
                  </button>
                </div>

                {showBtnConfig && (
                  <div className="animate-slide-down" style={{ 
                    padding: '1.25rem', 
                    backgroundColor: '#f1f5f9', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem' }}>Konfiguracja przycisku</strong>
                      <button 
                        type="button" 
                        onClick={() => setShowBtnConfig(false)}
                        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Zamknij ×
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Napis na przycisku</label>
                        <input 
                          type="text"
                          value={submitBtnText}
                          onChange={(e) => setSubmitBtnText(e.target.value)}
                          placeholder="Wyślij odpowiedź"
                          className="input"
                          style={{ fontSize: '0.9rem', padding: '0.45rem 0.6rem', backgroundColor: '#fff' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Rozmiar</label>
                          <select
                            value={submitBtnSize}
                            onChange={(e) => setSubmitBtnSize(e.target.value as any)}
                            className="input"
                            style={{ fontSize: '0.9rem', padding: '0.45rem 0.6rem', backgroundColor: '#fff' }}
                          >
                            <option value="small">Mały</option>
                            <option value="medium">Średni</option>
                            <option value="large">Duży</option>
                          </select>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Układ / Wyrównanie</label>
                          <select
                            value={submitBtnAlign}
                            onChange={(e) => setSubmitBtnAlign(e.target.value as any)}
                            className="input"
                            style={{ fontSize: '0.9rem', padding: '0.45rem 0.6rem', backgroundColor: '#fff' }}
                          >
                            <option value="left">Do lewej</option>
                            <option value="center">Do środka</option>
                            <option value="right">Do prawej</option>
                            <option value="full">Pełna szerokość</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3 className="h2" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Opis ankiety</h3>
            <p className="p-muted" style={{ marginBottom: '1rem' }}>Opcjonalny opis ułatwiający wyszukiwanie i organizację ankiet.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis co zawiera ankieta..."
              className="input"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3 className="h2" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Przekierowanie po przesłaniu ankiety</h3>
            <p className="p-muted" style={{ marginBottom: '1rem' }}>Podaj adres URL strony, na którą automatycznie przekierujemy użytkownika po pomyślnym przesłaniu odpowiedzi.</p>
            <input 
              type="url" 
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://twojastrona.pl/podziekowanie"
              className="input"
              style={{ marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Proponowane:</span>
              <button onClick={() => setRedirectUrl('https://jangulczynski.pl')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>jangulczynski.pl</button>
              <button onClick={() => setRedirectUrl('https://sekretarkaai.pl')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>sekretarkaai.pl</button>
              <button onClick={() => setRedirectUrl('https://youtube.com/@JanGulczynski')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>YouTube @JanGulczynski</button>
              {redirectUrl && (
                <button onClick={() => setRedirectUrl('')} className="btn btn-danger" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'none' }}>Wyczyść</button>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3 className="h2" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Webhook URL</h3>
            <p className="p-muted" style={{ marginBottom: '1rem' }}>Wyślemy zapytanie POST (JSON z odpowiedziami) na ten URL, gdy ktoś prześle ankietę.</p>
            <input 
              type="url" 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://twojserwer.pl/api/webhook"
              className="input"
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="h2" style={{ fontSize: '1.25rem', margin: 0 }}>Powiadomienia e-mail</h3>
                <p className="p-muted" style={{ marginTop: '0.25rem', marginBottom: 0 }}>Wyślij odpowiedzi na adres e-mail administratora po każdym wypełnieniu ankiety.</p>
              </div>
              <Switch checked={emailNotifications} onChange={setEmailNotifications} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h3 className="h2" style={{ fontSize: '1.25rem', margin: 0 }}>Jedno pytanie na stronę</h3>
                <p className="p-muted" style={{ marginTop: '0.25rem', marginBottom: 0 }}>Wyświetlaj tylko jedno pytanie na raz i automatycznie przechodź do kolejnego po zaznaczeniu odpowiedzi.</p>
              </div>
              <Switch checked={oneQuestionPerPage} onChange={setOneQuestionPerPage} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h3 className="h2" style={{ fontSize: '1.25rem', margin: 0 }}>Pasek postępu</h3>
                <p className="p-muted" style={{ marginTop: '0.25rem', marginBottom: 0 }}>Pokazuj wskaźnik postępu wypełniania ankiety.</p>
              </div>
              <Switch checked={showProgressBar} onChange={setShowProgressBar} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h3 className="h2" style={{ fontSize: '1.4rem', margin: 0 }}>Statystyki i Wyniki</h3>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Łącznie: <strong>{initialResponses.length}</strong> wypełnień</span>
          </div>

          {initialResponses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Brak zarejestrowanych odpowiedzi dla tej ankiety. Udostępnij ją, aby zbierać wyniki!
            </div>
          ) : (
            <>
              {/* Przełącznik sub-zakładek */}
              <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', alignSelf: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => setResultsSubTab('summary')}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: resultsSubTab === 'summary' ? '#ffffff' : 'transparent',
                    color: resultsSubTab === 'summary' ? 'var(--text-color)' : 'var(--text-muted)',
                    boxShadow: resultsSubTab === 'summary' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Podsumowanie wizualne
                </button>
                <button
                  type="button"
                  onClick={() => setResultsSubTab('responses')}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: resultsSubTab === 'responses' ? '#ffffff' : 'transparent',
                    color: resultsSubTab === 'responses' ? 'var(--text-color)' : 'var(--text-muted)',
                    boxShadow: resultsSubTab === 'responses' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Odpowiedzi ({initialResponses.length})
                </button>
              </div>

              {resultsSubTab === 'summary' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginTop: '0.5rem' }}>
                  {(() => {
                    // Obliczanie statystyk w locie
                    const stats: Record<string, { type: string, total: number, counts: Record<string, number>, sum: number, avg?: number, textList: string[] }> = {};
                    
                    questions.forEach(q => {
                      if (q.type === 'header') return;
                      stats[q.id] = {
                        type: q.type,
                        total: 0,
                        counts: {},
                        textList: [],
                        sum: 0
                      };
                    });

                    initialResponses.forEach(res => {
                      try {
                        const answersMap = JSON.parse(res.answers_json) as Record<string, any>;
                        questions.forEach(q => {
                          if (q.type === 'header') return;
                          const ans = answersMap[q.id];
                          if (ans !== undefined && ans !== '' && stats[q.id]) {
                            stats[q.id].total++;
                            if (q.type === 'radio' || q.type === 'checkbox') {
                              const options = Array.isArray(ans) ? ans : [ans];
                              options.forEach(opt => {
                                stats[q.id].counts[opt] = (stats[q.id].counts[opt] || 0) + 1;
                              });
                            } else if (q.type === 'scale' || q.type === 'number') {
                              const val = Number(ans);
                              if (!isNaN(val)) {
                                stats[q.id].sum += val;
                              }
                            } else {
                              stats[q.id].textList.push(String(ans));
                            }
                          }
                        });
                      } catch (e) {
                        console.error('Error parsing response for stats:', e);
                      }
                    });

                    questions.forEach(q => {
                      if (q.type === 'header') return;
                      const s = stats[q.id];
                      if (s && (q.type === 'scale' || q.type === 'number') && s.total > 0) {
                        s.avg = Number((s.sum / s.total).toFixed(1));
                      }
                    });

                    return questions.filter(q => q.type !== 'header').map((q) => {
                      const s = stats[q.id];
                      if (!s || s.total === 0) {
                        return (
                          <div key={q.id} style={{ backgroundColor: '#fafafa', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-color)' }} dangerouslySetInnerHTML={{ __html: q.title || '' }} />
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Brak odpowiedzi.</p>
                          </div>
                        );
                      }

                      return (
                        <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-color)' }} dangerouslySetInnerHTML={{ __html: q.title || '' }} />
                          
                          {(q.type === 'radio' || q.type === 'checkbox') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {q.options?.map((opt, oIdx) => {
                                const count = s.counts[opt] || 0;
                                const pct = s.total > 0 ? Math.round((count / s.total) * 100) : 0;
                                return (
                                  <div key={oIdx} style={{ fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                      <span style={{ fontWeight: 500 }}>{opt}</span>
                                      <span style={{ color: 'var(--text-muted)' }}>{pct}% ({count} gł.)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {(q.type === 'scale' || q.type === 'number') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                              <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-color)', minWidth: '100px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Średnia</span>
                                <strong style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>{s.avg || 0}</strong>
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', margin: 0 }}>
                                  Suma ocen: <strong>{s.sum}</strong> z <strong>{s.total}</strong> przesłanych odpowiedzi.
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                                  Typ pytania: {q.type === 'scale' ? 'Skala ocen (1-10)' : 'Liczba'}
                                </p>
                              </div>
                            </div>
                          )}

                          {(q.type === 'short-text' || q.type === 'long-text') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Ostatnie odpowiedzi:</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {s.textList.map((txt, tIdx) => (
                                  <div key={tIdx} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #cbd5e1', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                    &quot;{txt}&quot;
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {initialResponses.map((res, resIdx) => {
                    const answersMap = JSON.parse(res.answers_json) as Record<string, any>;
                    const date = new Date(res.created_at).toLocaleString('pl-PL');
                    return (
                      <div key={res.id} className="card animate-fade-in" style={{ borderLeft: '4px solid var(--primary-color)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <span>Odpowiedź #{initialResponses.length - resIdx}</span>
                          <span>Data: {date}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {questions.map((q) => {
                            if (q.type === 'header') return null;
                            const ans = answersMap[q.id];
                            let renderedAnswer = '(brak odpowiedzi)';
                            if (ans !== undefined && ans !== '') {
                              if (Array.isArray(ans)) {
                                renderedAnswer = ans.join(', ');
                              } else {
                                renderedAnswer = String(ans);
                              }
                            }
                            return (
                              <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1rem', fontSize: '0.95rem' }}>
                                <span 
                                  style={{ fontWeight: 600, color: 'var(--text-muted)' }} 
                                  dangerouslySetInnerHTML={{ __html: q.title || '' }} 
                                />
                                <span style={{ color: 'var(--text-color)' }}>{renderedAnswer}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal potwierdzenia usunięcia pytania */}
      {deleteQuestionId && (() => {
        const question = questions.find(q => q.id === deleteQuestionId);
        const { targets, sources } = getQuestionConnections(deleteQuestionId);
        const allConnected = [...targets, ...sources].filter((q, i, arr) => arr.findIndex(x => x.id === q.id) === i);
        if (!question) return null;
        return (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: '1rem',
          }}
            onClick={(e) => { if (e.target === e.currentTarget) setDeleteQuestionId(null); }}
          >
            <div style={{
              backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', padding: '2rem',
              maxWidth: '500px', width: '100%', boxShadow: 'var(--shadow-lg)',
              border: '2px solid #dc2626',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <h3 style={{ color: '#dc2626', fontSize: '1.15rem', margin: 0 }}>Pole powiązane</h3>
              </div>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Pole <strong style={{ color: '#dc2626' }}>&quot;{question.title ? question.title.replace(/<[^>]*>/g, '') : '(bez nazwy)'}&quot;</strong> jest powiązane z innymi polami poprzez logikę warunkową.
              </p>
              {allConnected.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Powiązane pola:</p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem', color: '#374151' }}>
                    {allConnected.map(cq => (
                      <li key={cq.id} style={{ marginBottom: '0.25rem' }}>
                        {cq.title ? cq.title.replace(/<[^>]*>/g, '') : '(bez nazwy)'}
                        {targets.some(t => t.id === cq.id) && ' — to pole ma warunek odnoszący się do usuwanego pola'}
                        {sources.some(s => s.id === cq.id) && ' — usuwane pole ma warunek odnoszący się do tego pola'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Usunięcie tego pola spowoduje również usunięcie jego logiki warunkowej. Czy na pewno chcesz usunąć?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDeleteQuestionId(null)} className="btn btn-secondary">Anuluj</button>
                <button type="button" onClick={confirmDeleteQuestion} className="btn btn-danger">Usuń</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toasts Container */}
      <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 1000, maxWidth: '350px' }}>
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className="animate-slide-down card"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '1.25rem 1rem', 
              backgroundColor: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
              borderColor: toast.type === 'success' ? '#10b981' : '#ef4444',
              borderLeftWidth: '6px',
              color: toast.type === 'success' ? '#065f46' : '#991b1b',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: 'inherit', 
                marginLeft: '1.5rem',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
