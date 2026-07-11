'use client';

import { useState, useEffect, useRef } from 'react';
import { SurveySchema, Question } from '@/types';
import { submitSurveyResponse } from '@/app/actions';
import { getScaleValues } from '@/lib/utils';

export default function SurveyClient({ 
  surveyId,
  title,
  schema,
  isPreview = false
}: { 
  surveyId: string;
  title: string;
  schema: SurveySchema;
  isPreview?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
    
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    const isPreviewMode = typeof window !== 'undefined' && window.location.search.includes('preview=true');
    const hasCompletedCookie = getCookie(`survey_completed_${surveyId}`) === 'true';

    if (hasCompletedCookie && !isPreviewMode && !isPreview) {
      setAlreadyCompleted(true);
    }
  }, [surveyId, isPreview]);

  const visibleQuestions = schema.questions.filter(q => {
    if (q.type === 'header') return true;
    if (!q.logic || !q.logic.conditions || q.logic.conditions.length === 0) return true;
    
    const { strategy, conditions } = q.logic;
    const evaluateCondition = (cond: any) => {
      const { fieldId, operator, value } = cond;
      const answer = answers[fieldId];
      switch (operator) {
        case 'empty': return answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0);
        case 'not-empty': return answer !== undefined && answer !== '' && (!Array.isArray(answer) || answer.length > 0);
        case 'equals':
          if (Array.isArray(answer)) return answer.some(v => String(v).toLowerCase() === String(value).toLowerCase());
          return String(answer).toLowerCase() === String(value).toLowerCase();
        case 'not-equals':
          if (Array.isArray(answer)) return !answer.some(v => String(v).toLowerCase() === String(value).toLowerCase());
          return String(answer).toLowerCase() !== String(value).toLowerCase();
        case 'contains':
          if (Array.isArray(answer)) return answer.some(v => String(v).toLowerCase().includes(String(value).toLowerCase()));
          return String(answer || '').toLowerCase().includes(String(value || '').toLowerCase());
        case 'not-contains':
          if (Array.isArray(answer)) return !answer.some(v => String(v).toLowerCase().includes(String(value).toLowerCase()));
          return !String(answer || '').toLowerCase().includes(String(value || '').toLowerCase());
        case 'greater': return Number(answer) > Number(value);
        case 'less': return Number(answer) < Number(value);
        default: return true;
      }
    };
    if (strategy === 'any') return conditions.some((cond: any) => evaluateCondition(cond));
    return conditions.every((cond: any) => evaluateCondition(cond));
  });

  const inputableQuestions = visibleQuestions.filter(q => q.type !== 'header');

  const focusQuestion = (index: number) => {
    if (index < 0) return;
    setFocusedIndex(index);
    if (focusedIndex === index) {
      const el = questionRefs.current[index];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleNext = () => {
    if (focusedIndex === null) return;
    
    // HTML5 validation check for the active question container
    const el = questionRefs.current[focusedIndex];
    if (el) {
      const inputs = el.querySelectorAll('input, textarea, select');
      let allValid = true;
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (!input.checkValidity()) {
          input.reportValidity();
          allValid = false;
          break;
        }
      }
      if (!allValid) return;
    }
    
    if (focusedIndex < inputableQuestions.length - 1) {
      setFocusedIndex(focusedIndex + 1);
    }
  };

  useEffect(() => {
    if (focusedIndex !== null && focusedIndex < inputableQuestions.length) {
      const el = questionRefs.current[focusedIndex];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedIndex, inputableQuestions]);

  useEffect(() => {
    const autoAdvance = (currentIdx: number, forceValid: boolean = false) => {
      setTimeout(() => {
        if (schema.oneQuestionPerPage) {
          if (!forceValid) {
            // In oneQuestionPerPage mode, autoAdvance only if the question is valid.
            const el = questionRefs.current[currentIdx];
            if (el) {
              const inputs = el.querySelectorAll('input, textarea, select');
              let allValid = true;
              for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
                if (!input.checkValidity()) {
                  allValid = false;
                  break;
                }
              }
              if (!allValid) return;
            }
          }
          if (currentIdx < inputableQuestions.length - 1) {
            setFocusedIndex(currentIdx + 1);
          }
        } else {
          focusQuestion(currentIdx + 1);
        }
      }, 250);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitted || isSubmitting) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.target.type === 'text' || e.target.type === 'number' || e.target.tagName === 'TEXTAREA') return;
      }

      const q = focusedIndex !== null && focusedIndex < inputableQuestions.length 
        ? inputableQuestions[focusedIndex] : null;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        let next = focusedIndex !== null ? focusedIndex + dir : 0;
        if (next < 0) next = 0;
        if (next >= inputableQuestions.length) next = inputableQuestions.length - 1;
        
        if (schema.oneQuestionPerPage) {
          if (dir === 1) {
            handleNext();
          } else {
            setFocusedIndex(next);
          }
        } else {
          focusQuestion(next);
        }
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (schema.oneQuestionPerPage) {
          if (focusedIndex !== null && focusedIndex < inputableQuestions.length - 1) {
            handleNext();
          } else {
            if (formRef.current) {
              formRef.current.requestSubmit();
            }
          }
        } else {
          if (formRef.current) {
            formRef.current.requestSubmit();
          }
        }
        return;
      }

      // Quick answer keys 1-9 & Space bar are ONLY allowed if oneQuestionPerPage is active
      if (schema.oneQuestionPerPage) {
        const numKey = parseInt(e.key);
        if (q && !isNaN(numKey) && numKey >= 1 && numKey <= 9) {
          if (q.type === 'radio' && q.options && numKey <= q.options.length) {
            e.preventDefault();
            handleInput(q.id, q.options[numKey - 1]);
            if (focusedIndex !== null) {
              autoAdvance(focusedIndex, true);
            }
          } else if (q.type === 'checkbox' && q.options && numKey <= q.options.length) {
            e.preventDefault();
            const opt = q.options[numKey - 1];
            const current = answers[q.id] || [];
            const newVal = current.includes(opt) 
              ? current.filter((v: string) => v !== opt)
              : [...current, opt];
            handleInput(q.id, newVal);
          } else if (q.type === 'scale') {
            e.preventDefault();
            const scaleVals = getScaleValues(q);
            if (numKey <= scaleVals.length) {
              handleInput(q.id, scaleVals[numKey - 1].toString());
              if (focusedIndex !== null) {
                autoAdvance(focusedIndex, true);
              }
            }
          }
          return;
        }

        if (e.key === ' ' && q) {
          if (q.type === 'checkbox' && q.options && q.options.length > 0) {
            e.preventDefault();
            const firstOpt = q.options[0];
            const current = answers[q.id] || [];
            const newVal = current.includes(firstOpt)
              ? current.filter((v: string) => v !== firstOpt)
              : [...current, firstOpt];
            handleInput(q.id, newVal);
          } else if (q.type === 'radio' && q.options && q.options.length > 0) {
            e.preventDefault();
            handleInput(q.id, q.options[0]);
            if (focusedIndex !== null) {
              autoAdvance(focusedIndex, true);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, inputableQuestions, answers, submitted, isSubmitting, schema.oneQuestionPerPage]);

  if (!mounted) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Ładowanie ankiety...
      </div>
    );
  }

  const isDark = schema.theme === 'dark';
  let btn = schema.buttonColor || '#000000';
  if (isDark && btn === '#000000') {
    btn = '#ffffff';
  }

  const isColorLight = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 160;
    }
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 160;
    }
    return false;
  };

  const themeStyle: React.CSSProperties = isDark
    ? ({
        '--bg-color': '#0f172a',
        '--text-color': '#e5e7eb',
        '--text-muted': '#94a3b8',
        '--border-color': '#1e293b',
        '--card-bg': '#1e293b',
        '--primary-color': btn,
        '--primary-hover': btn,
        '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.4)',
        '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)',
        '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)',
        backgroundColor: '#0f172a',
        color: '#e5e7eb',
        minHeight: '100vh',
      } as React.CSSProperties)
    : ({
        '--primary-color': btn,
        '--primary-hover': btn,
      } as React.CSSProperties);

  const lightTextOnBtn = !isColorLight(btn);

  if (alreadyCompleted) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 className="h1" style={{ fontSize: '2rem' }}>Dziękujemy!</h1>
        <p className="p-muted" style={{ marginTop: '1rem' }}>Już wypełniłeś tę ankietę. Zabezpieczenie chroni przed wielokrotnym przesyłaniem odpowiedzi.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const visibleAnswers: Record<string, any> = {};
    schema.questions.forEach(q => {
      const isVisible = visibleQuestions.includes(q);
      if (isVisible) {
        const ans = answers[q.id];
        if (q.customAnswer && (q.type === 'radio' || q.type === 'checkbox')) {
          const customKey = `${q.id}_custom`;
          visibleAnswers[q.id] = ans || '';
          visibleAnswers[customKey] = answers[customKey] || '';
        } else {
          visibleAnswers[q.id] = ans || '';
        }
      }
    });

    if (isPreview) {
      setSubmitted(true);
      setIsSubmitting(false);
      return;
    }

    const res = await submitSurveyResponse(surveyId, visibleAnswers);

    if (res && res.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }

    setSubmitted(true);
    setIsSubmitting(false);
  };

  const handleInput = (id: string, value: any) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const align = schema.submitBtnAlign || 'right';
  const size = schema.submitBtnSize || 'medium';
  const btnText = schema.submitBtnText || 'Wyślij odpowiedź';

  let padding = '0.85rem 1.75rem';
  let fontSize = '1.05rem';
  if (size === 'small') {
    padding = '0.5rem 1rem';
    fontSize = '0.9rem';
  } else if (size === 'large') {
    padding = '1.25rem 2.5rem';
    fontSize = '1.2rem';
  }

  const questionsToRender = schema.oneQuestionPerPage
    ? (() => {
        if (focusedIndex === null || focusedIndex < 0 || focusedIndex >= inputableQuestions.length) {
          return [];
        }
        const activeQuestion = inputableQuestions[focusedIndex];
        const activeQuestionIdx = visibleQuestions.indexOf(activeQuestion);
        if (activeQuestionIdx === -1) return [];

        let prevInputableIdx = -1;
        if (focusedIndex > 0) {
          const prevQuestion = inputableQuestions[focusedIndex - 1];
          prevInputableIdx = visibleQuestions.indexOf(prevQuestion);
        }

        return visibleQuestions.slice(prevInputableIdx + 1, activeQuestionIdx + 1);
      })()
    : schema.questions.filter(q => visibleQuestions.includes(q));

  if (submitted) {
    return (
      <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 className="h1">Dziękujemy!</h1>
        <p className="p-muted">Twoja odpowiedź została zapisana.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={themeStyle}>
      {schema.header && (
        <h1 className="h1" style={{ marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: schema.header }} />
      )}
      {schema.description && (
        <p className="p-muted" style={{ marginBottom: '2rem', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: schema.description }} />
      )}
      
      {schema.oneQuestionPerPage && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: isDark ? '#1e293b' : '#f3f4f6', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#374151', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⌨️</span>
          <span>
            <strong>Szybki wybór:</strong> Użyj cyfr <strong>1-9</strong> na klawiaturze, aby wybrać odpowiedź · <strong>Enter</strong> przejdź dalej / wyślij
          </span>
        </div>
      )}

      {schema.oneQuestionPerPage && inputableQuestions.length > 0 && (
        <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: isDark ? '#aaa' : '#666' }}>
            <span>Krok {(focusedIndex || 0) + 1} z {schema.questions.filter(q => q.type !== 'header').length}</span>
            <span>{Math.round((((focusedIndex || 0)) / schema.questions.filter(q => q.type !== 'header').length) * 100)}% ukończono</span>
          </div>
          <div style={{ height: '6px', backgroundColor: isDark ? '#333' : '#eee', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(((focusedIndex || 0) + 1) / schema.questions.filter(q => q.type !== 'header').length) * 100}%`, height: '100%', backgroundColor: btn, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {schema.questions.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Ta ankieta jest jeszcze pusta.</p>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {questionsToRender.map((q, idx) => {
            const inputIdx = inputableQuestions.indexOf(q);
            const isFocused = inputIdx !== -1 && inputIdx === focusedIndex;

            return (
              <div 
                key={q.id} 
                className="animate-slide-down" 
                style={{ 
                  ...((isFocused && !schema.oneQuestionPerPage) ? { outline: `2px solid ${btn}`, outlineOffset: '8px', borderRadius: 'var(--radius-md)' } : {}),
                  animationDelay: `${idx * 0.1}s` 
                }}
              >
                {q.type === 'header' ? (
                  <div style={{ margin: '1.5rem 0 1.5rem 0' }}>
                    <h2 className="h1" style={{ marginBottom: '0.35rem', fontSize: '1.5rem', border: 'none', padding: 0 }} dangerouslySetInnerHTML={{ __html: q.title || 'Nagłówek sekcji' }} />
                    {q.description && (
                      <p className="p-muted" style={{ fontSize: '0.95rem', margin: 0 }} dangerouslySetInnerHTML={{ __html: q.description }} />
                    )}
                  </div>
                ) : (
                  <div 
                    ref={(el) => { questionRefs.current[inputIdx] = el; }}
                    onClick={() => focusQuestion(inputIdx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <label className="h2" style={{ display: 'block', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                      <span dangerouslySetInnerHTML={{ __html: q.title || '' }} /> {q.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {q.description && (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '-0.25rem', marginBottom: '0.75rem' }} dangerouslySetInnerHTML={{ __html: q.description }} />
                    )}
                  </div>
                )}

              {q.type === 'short-text' && (
                <input 
                  type="text" 
                  className="input" 
                  required={q.required}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleInput(q.id, e.target.value)}
                  placeholder="Twoja odpowiedź..."
                  style={{ fontSize: '1.1rem', padding: '1rem' }}
                />
              )}

              {q.type === 'long-text' && (
                <textarea 
                  className="input" 
                  required={q.required}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleInput(q.id, e.target.value)}
                  placeholder="Wpisz dłuższą odpowiedź..."
                  rows={4}
                  style={{ fontSize: '1.1rem', padding: '1rem', resize: 'vertical' }}
                />
              )}

              {q.type === 'number' && (
                <input 
                  type="number" 
                  className="input" 
                  required={q.required}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleInput(q.id, e.target.value)}
                  placeholder="123"
                  style={{ fontSize: '1.1rem', padding: '1rem', width: '100%', maxWidth: '300px' }}
                />
              )}

              {q.type === 'radio' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {q.options.map((opt, i) => (
                    <label key={i} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', borderColor: answers[q.id] === opt ? 'var(--text-color)' : 'var(--border-color)', backgroundColor: answers[q.id] === opt ? (isDark ? '#334155' : '#f9fafb') : 'var(--card-bg)' }}>
                      <input
                        type="radio"
                        name={q.id}
                        required={q.required && !q.customAnswer}
                        checked={answers[q.id] === opt}
                        onChange={() => {
                          handleInput(q.id, opt);
                          if (schema.oneQuestionPerPage) {
                            setTimeout(() => {
                              if (inputIdx < inputableQuestions.length - 1) {
                                setFocusedIndex(inputIdx + 1);
                              }
                            }, 100);
                          } else {
                            setTimeout(() => {
                              focusQuestion(inputIdx + 1);
                            }, 100);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {schema.oneQuestionPerPage && (
                          <span style={{
                            fontSize: '0.7rem',
                            color: isDark ? '#cbd5e1' : '#374151',
                            backgroundColor: isDark ? '#334155' : '#f3f4f6',
                            border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                            borderRadius: '4px',
                            padding: '1px 5px',
                            fontWeight: 600,
                            minWidth: '1.2rem',
                            textAlign: 'center',
                            boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                            fontFamily: 'monospace'
                          }}>{i + 1}</span>
                        )}
                        <div style={{
                          width: 18,
                          height: 18,
                          borderRadius: 18,
                          border: answers[q.id] === opt ? '2px solid var(--text-color)' : '2px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--card-bg)',
                          flexShrink: 0
                        }}>
                          {answers[q.id] === opt && <div style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: 'var(--text-color)' }} />}
                        </div>
                      </div>
                      <span style={{ fontSize: '1.1rem' }}>{opt}</span>
                    </label>
                  ))}
                  {q.customAnswer && (
                    <input 
                      type="text" 
                      className="input" 
                      required={q.required && !answers[q.id]}
                      value={answers[`${q.id}_custom`] || ''}
                      onChange={(e) => {
                        handleInput(`${q.id}_custom`, e.target.value);
                        handleInput(q.id, e.target.value);
                      }}
                      placeholder="Inna odpowiedź..."
                      style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
                    />
                  )}
                </div>
              )}

              {q.type === 'checkbox' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {q.options.map((opt, i) => {
                    const isChecked = (answers[q.id] || []).includes(opt);
                    return (
                      <label key={i} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', borderColor: isChecked ? 'var(--text-color)' : 'var(--border-color)', backgroundColor: isChecked ? (isDark ? '#334155' : '#f9fafb') : 'var(--card-bg)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = answers[q.id] || [];
                            const newVal = e.target.checked
                              ? [...current, opt]
                              : current.filter((v: string) => v !== opt);
                            handleInput(q.id, newVal);
                          }}
                          style={{ display: 'none' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {schema.oneQuestionPerPage && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: isDark ? '#cbd5e1' : '#374151',
                              backgroundColor: isDark ? '#334155' : '#f3f4f6',
                              border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
                              borderRadius: '4px',
                              padding: '1px 5px',
                              fontWeight: 600,
                              minWidth: '1.2rem',
                              textAlign: 'center',
                              boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                              fontFamily: 'monospace'
                            }}>{i + 1}</span>
                          )}
                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: isChecked ? '2px solid var(--text-color)' : '2px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--card-bg)',
                            flexShrink: 0
                          }}>
                            {isChecked && <div style={{ width: 8, height: 8, backgroundColor: 'var(--text-color)' }} />}
                          </div>
                        </div>
                        <span style={{ fontSize: '1.1rem' }}>{opt}</span>
                      </label>
                    );
                  })}
                  {q.customAnswer && (
                    <input 
                      type="text" 
                      className="input" 
                      value={answers[`${q.id}_custom`] || ''}
                      onChange={(e) => {
                        handleInput(`${q.id}_custom`, e.target.value);
                      }}
                      placeholder="Inna odpowiedź..."
                      style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
                    />
                  )}
                </div>
              )}

              {q.type === 'scale' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {getScaleValues(q).map((num, numIdx) => (
                    <label key={numIdx} style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={q.id}
                        required={q.required}
                        checked={answers[q.id] === num.toString()}
                        onChange={() => {
                          handleInput(q.id, num.toString());
                          if (schema.oneQuestionPerPage) {
                            setTimeout(() => {
                              if (inputIdx < inputableQuestions.length - 1) {
                                setFocusedIndex(inputIdx + 1);
                              }
                            }, 100);
                          } else {
                            setTimeout(() => {
                              focusQuestion(inputIdx + 1);
                            }, 100);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        minWidth: '3rem',
                        height: '3.5rem',
                        padding: '0.25rem 0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: answers[q.id] === num.toString() ? 'var(--primary-color)' : 'var(--card-bg)',
                        color: answers[q.id] === num.toString() ? (lightTextOnBtn ? '#fff' : '#1a1a1a') : 'var(--text-color)',
                        fontWeight: answers[q.id] === num.toString() ? 600 : 400,
                        transition: 'all 0.2s',
                        gap: '0.2rem'
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>{num}</span>
                        {schema.oneQuestionPerPage && numIdx < 9 && (
                          <span style={{
                            fontSize: '0.65rem',
                            color: answers[q.id] === num.toString() 
                              ? (lightTextOnBtn ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)')
                              : 'var(--text-muted)',
                            backgroundColor: answers[q.id] === num.toString() 
                              ? (lightTextOnBtn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)')
                              : (isDark ? '#1e293b' : '#f3f4f6'),
                            border: `1px solid ${answers[q.id] === num.toString() ? 'transparent' : (isDark ? '#334155' : '#e5e7eb')}`,
                            borderRadius: '3px',
                            padding: '0 4px',
                            fontWeight: 600,
                            minWidth: '1.1rem',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}>{numIdx + 1}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

            </div>
          );})}

          {schema.oneQuestionPerPage ? (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '2rem',
              borderTop: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
              paddingTop: '1.5rem',
              gap: '1rem'
            }}>
              <div>
                {(focusedIndex || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setFocusedIndex((focusedIndex || 0) - 1)}
                    className="btn btn-secondary"
                    style={{
                      padding,
                      fontSize,
                      backgroundColor: 'transparent',
                      border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                      color: 'var(--text-color)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all 0.2s',
                    }}
                  >
                    ← Wstecz
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {(focusedIndex || 0) < inputableQuestions.length - 1 ? (
                  <>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      lub naciśnij Enter ⌨
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="btn btn-primary"
                      style={{
                        padding,
                        fontSize,
                        backgroundColor: btn,
                        color: lightTextOnBtn ? '#fff' : '#1a1a1a',
                        border: btn.toLowerCase() === '#ffffff' ? '1px solid #ccc' : 'none',
                        transition: 'all 0.2s',
                        boxShadow: `0 2px 6px ${btn}44`,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                      }}
                    >
                      Dalej →
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      lub naciśnij Enter ⌨
                    </span>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{
                        padding,
                        fontSize,
                        backgroundColor: btn,
                        color: lightTextOnBtn ? '#fff' : '#1a1a1a',
                        border: btn.toLowerCase() === '#ffffff' ? '1px solid #ccc' : 'none',
                        transition: 'all 0.2s',
                        boxShadow: `0 2px 6px ${btn}44`,
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                      }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Wysyłanie...' : btnText}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (() => {
            const wrapperStyle: React.CSSProperties = {
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              width: '100%',
            };

            const helperStyle: React.CSSProperties = {
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              padding: '0.5rem 0',
            };

            if (align === 'left') {
              wrapperStyle.justifyContent = 'flex-start';
            } else if (align === 'center') {
              wrapperStyle.justifyContent = 'center';
            } else if (align === 'right') {
              wrapperStyle.justifyContent = 'flex-end';
              wrapperStyle.flexDirection = 'row-reverse';
            } else if (align === 'full') {
              wrapperStyle.flexDirection = 'column';
              wrapperStyle.alignItems = 'stretch';
              helperStyle.textAlign = 'center';
            }

            return (
              <div style={wrapperStyle}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding,
                    fontSize,
                    backgroundColor: btn,
                    color: lightTextOnBtn ? '#fff' : '#1a1a1a',
                    width: align === 'full' ? '100%' : 'auto',
                    border: btn.toLowerCase() === '#ffffff' ? '1px solid #ccc' : 'none',
                    transition: 'all 0.2s',
                    boxShadow: `0 2px 6px ${btn}44`,
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Wysyłanie...' : btnText}
                </button>
                <span style={helperStyle}>
                  lub naciśnij Enter ⌨
                </span>
              </div>
            );
          })()}
        </form>
      )}
    </div>
  );
}
