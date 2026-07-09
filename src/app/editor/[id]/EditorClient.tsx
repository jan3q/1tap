'use client';

import { useState, useTransition, useEffect } from 'react';
import { Survey, SurveySchema, Question, QuestionType } from '@/types';
import { updateSurveySchema } from '@/app/actions';
import { v4 as uuidv4 } from 'uuid';
import { ArrowUp, ArrowDown, Trash2, Plus, Save, Settings, GripVertical, CheckCircle2, Type, AlignLeft, CircleDot, CheckSquare, SlidersHorizontal, Hash, Share2, Eye } from 'lucide-react';
import Link from 'next/link';
import { RichTextField } from './RichTextField';

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
  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'results'>(initialTab);
  const [resultsSubTab, setResultsSubTab] = useState<'summary' | 'responses'>('summary');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        await updateSurveySchema(initialSurvey.id, { questions }, title, redirectUrl || null, webhookUrl || null);
        setSaved(true);
        addToast('Ustawienia i struktura ankiety zostały pomyślnie zapisane!', 'success');
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        addToast(`Błąd zapisu: ${(err as Error).message}`, 'error');
      }
    });
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: uuidv4(),
      type,
      title: '',
      required: false,
      options: ['Opcja 1']
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
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
            
            {questions.map((q, i) => (
              <div key={q.id} className="card animate-slide-down" style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                {q.required && <span style={{ position: 'absolute', top: '0.25rem', left: '0.5rem', color: '#ef4444', fontWeight: 'bold', fontSize: '1.25rem', lineHeight: 1 }} title="Pole wymagane">*</span>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-muted)' }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}>
                    <ArrowUp size={20} />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === questions.length - 1} style={{ background: 'none', border: 'none', cursor: i === questions.length - 1 ? 'default' : 'pointer', opacity: i === questions.length - 1 ? 0.3 : 1 }}>
                    <ArrowDown size={20} />
                  </button>
                </div>
                
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
                      <option value="short-text">Krótki tekst</option>
                      <option value="long-text">Długi tekst</option>
                      <option value="number">Liczba</option>
                      <option value="checkbox">Wielokrotny wybór</option>
                      <option value="radio">Pojedynczy wybór</option>
                      <option value="scale">Skala 1-10</option>
                      <option value="header">Nagłówek sekcji</option>
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
                                          Pytanie: {pq.title ? pq.title.replace(/<[^>]*>/g, '').substring(0, 25) + '...' : '(bez nazwy)'}
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
                    <button onClick={() => removeQuestion(q.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                      <Trash2 size={16} /> {q.type === 'header' ? 'Usuń sekcję' : 'Usuń'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: '2rem', borderStyle: 'dashed', backgroundColor: '#fcfcfd', textAlign: 'center', padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', marginTop: 0 }}>Dodaj element do ankiety</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <button onClick={() => addQuestion('header')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <Plus size={16}/> Nagłówek i podtytuł
              </button>
              <button onClick={() => addQuestion('short-text')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <Type size={16}/> Krótki tekst
              </button>
              <button onClick={() => addQuestion('long-text')} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', minHeight: 'auto' }}>
                <AlignLeft size={16}/> Długi tekst
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
                <SlidersHorizontal size={16}/> Skala 1-10
              </button>
            </div>
          </div>
        </>
      ) : activeTab === 'settings' ? (
        <div className="card animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
          <div>
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
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-color)' }} dangerouslySetInnerHTML={{ __html: q.title || 'Pytanie bez nazwy' }} />
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Brak odpowiedzi.</p>
                          </div>
                        );
                      }

                      return (
                        <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-color)' }} dangerouslySetInnerHTML={{ __html: q.title || 'Pytanie bez nazwy' }} />
                          
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
                                  dangerouslySetInnerHTML={{ __html: q.title || 'Pytanie bez nazwy' }} 
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
