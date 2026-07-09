'use client';

import { useState, useEffect } from 'react';
import { SurveySchema } from '@/types';
import { submitSurveyResponse } from '@/app/actions';

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

  useEffect(() => {
    setMounted(true);
    
    // Sprawdzamy ciasteczko blokujące na kliencie
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

  if (!mounted) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Ładowanie ankiety...
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 className="h1" style={{ fontSize: '2rem' }}>Dziękujemy!</h1>
        <p className="p-muted" style={{ marginTop: '1rem' }}>Już wypełniłeś tę ankietę. Zabezpieczenie chroni przed wielokrotnym przesyłaniem odpowiedzi.</p>
      </div>
    );
  }

  const shouldShowQuestion = (q: any) => {
    if (!q.logic || !q.logic.conditions || q.logic.conditions.length === 0) return true;
    
    const { strategy, conditions } = q.logic;

    const evaluateCondition = (cond: any) => {
      const { fieldId, operator, value } = cond;
      const answer = answers[fieldId];

      switch (operator) {
        case 'empty':
          return answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0);
        case 'not-empty':
          return answer !== undefined && answer !== '' && (!Array.isArray(answer) || answer.length > 0);
        case 'equals':
          if (Array.isArray(answer)) {
            return answer.some(v => String(v).toLowerCase() === String(value).toLowerCase());
          }
          return String(answer).toLowerCase() === String(value).toLowerCase();
        case 'not-equals':
          if (Array.isArray(answer)) {
            return !answer.some(v => String(v).toLowerCase() === String(value).toLowerCase());
          }
          return String(answer).toLowerCase() !== String(value).toLowerCase();
        case 'contains':
          if (Array.isArray(answer)) {
            return answer.some(v => String(v).toLowerCase().includes(String(value).toLowerCase()));
          }
          return String(answer || '').toLowerCase().includes(String(value || '').toLowerCase());
        case 'not-contains':
          if (Array.isArray(answer)) {
            return !answer.some(v => String(v).toLowerCase().includes(String(value).toLowerCase()));
          }
          return !String(answer || '').toLowerCase().includes(String(value || '').toLowerCase());
        case 'greater':
          return Number(answer) > Number(value);
        case 'less':
          return Number(answer) < Number(value);
        default:
          return true;
      }
    };

    if (strategy === 'any') {
      return conditions.some((cond: any) => evaluateCondition(cond));
    } else {
      return conditions.every((cond: any) => evaluateCondition(cond));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const visibleAnswers: Record<string, any> = {};
    schema.questions.forEach(q => {
      if (shouldShowQuestion(q)) {
        visibleAnswers[q.id] = answers[q.id] || '';
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

  if (submitted) {
    return (
      <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 className="h1">Dziękujemy!</h1>
        <p className="p-muted">Twoja odpowiedź została zapisana.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Nagłówek i opis ankiety ze schematu */}
      {schema.header && (
        <h1 className="h1" style={{ marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: schema.header }} />
      )}
      {schema.description && (
        <p className="p-muted" style={{ marginBottom: '2rem', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: schema.description }} />
      )}
      
      {schema.questions.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Ta ankieta jest jeszcze pusta.</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {schema.questions.map((q, idx) => {
            if (!shouldShowQuestion(q)) return null;
            return (
              <div key={q.id} className="animate-slide-down" style={{ animationDelay: `${idx * 0.1}s` }}>
                {q.type === 'header' ? (
                  <div style={{ margin: '1.5rem 0 1.5rem 0' }}>
                    <h2 className="h1" style={{ marginBottom: '0.35rem', fontSize: '1.5rem', border: 'none', padding: 0 }} dangerouslySetInnerHTML={{ __html: q.title || 'Nagłówek sekcji' }} />
                    {q.description && (
                      <p className="p-muted" style={{ fontSize: '0.95rem', margin: 0 }} dangerouslySetInnerHTML={{ __html: q.description }} />
                    )}
                  </div>
                ) : (
                  <>
                    <label className="h2" style={{ display: 'block', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                      <span dangerouslySetInnerHTML={{ __html: q.title || 'Pytanie bez nazwy' }} /> {q.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {q.description && (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '-0.25rem', marginBottom: '0.75rem' }} dangerouslySetInnerHTML={{ __html: q.description }} />
                    )}
                  </>
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
                    <label key={i} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', borderColor: answers[q.id] === opt ? 'var(--text-color)' : 'var(--border-color)', backgroundColor: answers[q.id] === opt ? '#f9fafb' : 'white' }}>
                      <input 
                        type="radio" 
                        name={q.id}
                        required={q.required}
                        checked={answers[q.id] === opt}
                        onChange={() => handleInput(q.id, opt)}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 18,
                        border: answers[q.id] === opt ? '2px solid var(--text-color)' : '2px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'white',
                        flexShrink: 0
                      }}>
                        {answers[q.id] === opt && <div style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: 'var(--text-color)' }} />}
                      </div>
                      <span style={{ fontSize: '1.1rem' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {q.options.map((opt, i) => {
                    const isChecked = (answers[q.id] || []).includes(opt);
                    return (
                      <label key={i} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', borderColor: isChecked ? 'var(--text-color)' : 'var(--border-color)', backgroundColor: isChecked ? '#f9fafb' : 'white' }}>
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
                        <div style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: isChecked ? '2px solid var(--text-color)' : '2px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'white',
                          flexShrink: 0
                        }}>
                          {isChecked && <div style={{ width: 8, height: 8, backgroundColor: 'var(--text-color)' }} />}
                        </div>
                        <span style={{ fontSize: '1.1rem' }}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.type === 'scale' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <label key={num} style={{ cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name={q.id}
                        required={q.required}
                        checked={answers[q.id] === num.toString()}
                        onChange={() => handleInput(q.id, num.toString())}
                        style={{ display: 'none' }}
                      />
                      <div style={{ 
                        width: '3rem', 
                        height: '3rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: answers[q.id] === num.toString() ? 'var(--primary-color)' : 'white',
                        color: answers[q.id] === num.toString() ? 'white' : 'var(--text-color)',
                        fontWeight: answers[q.id] === num.toString() ? 600 : 400,
                        transition: 'all 0.2s'
                      }}>
                        {num}
                      </div>
                    </label>
                  ))}
                </div>
              )}

            </div>
          );})}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '1rem 2rem', fontSize: '1.1rem', marginTop: '1rem', alignSelf: 'flex-start' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wysyłanie...' : 'Wyślij odpowiedź'}
          </button>
        </form>
      )}
    </div>
  );
}
