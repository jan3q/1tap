'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Eye, BarChart, Pencil, Search, X } from 'lucide-react';
import DeleteSurveyButton from './DeleteSurveyButton';
import { createSurvey } from './actions';
import { Survey } from '@/types';

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
  const [surveys, setSurveys] = useState(initialSurveys);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="h1" style={{ margin: 0 }}>Moje Ankiety</h1>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ display: 'flex', gap: '0.5rem' }}
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
                <Link href={`/s/${survey.id}`} className="btn btn-secondary" target="_blank" style={{ display: 'flex', gap: '0.35rem' }}>
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

            <form action={createSurvey} onSubmit={() => {
              setShowCreateModal(false);
              setNewTitle('');
              setNewDescription('');
            }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Nazwa ankiety <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                name="title"
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
                name="description"
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
                  }}
                  className="btn btn-secondary"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newTitle.trim()}
                >
                  Utwórz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
