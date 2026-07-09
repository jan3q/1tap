'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { deleteSurvey } from './actions';

export default function DeleteSurveyButton({ surveyId, surveyTitle }: { surveyId: string; surveyTitle: string }) {
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== surveyTitle) return;
    setIsDeleting(true);
    await deleteSurvey(surveyId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="btn btn-danger"
        style={{ padding: '0.5rem 0.75rem' }}
        title="Usuń ankietę"
      >
        <Trash2 size={18} />
      </button>

      {showModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setConfirmText('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '2px solid #dc2626',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <h3 style={{ color: '#dc2626', fontSize: '1.2rem', margin: 0 }}>
                Usuń ankietę
              </h3>
            </div>

            <p style={{ marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Czy na pewno chcesz usunąć ankietę{' '}
              <strong style={{ color: '#dc2626' }}>&quot;{surveyTitle}&quot;</strong>?
            </p>

            <p
              style={{
                marginBottom: '1.5rem',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '0.95rem',
                backgroundColor: '#fef2f2',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #fecaca',
              }}
            >
              Wszystkie wyniki, odpowiedzi i dane zostaną bezpowrotnie usunięte!
            </p>

            <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#374151' }}>
              Wpisz <strong style={{ userSelect: 'none' }}>{surveyTitle}</strong> aby potwierdzić:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="input"
              placeholder={surveyTitle}
              autoFocus
              style={{ marginBottom: '1.5rem', borderColor: confirmText && confirmText !== surveyTitle ? '#ef4444' : undefined }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && confirmText === surveyTitle && !isDeleting) {
                  handleDelete();
                }
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setConfirmText('');
                }}
                className="btn btn-secondary"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== surveyTitle || isDeleting}
                className="btn btn-danger"
                style={{
                  opacity: confirmText !== surveyTitle ? 0.5 : 1,
                  cursor: confirmText !== surveyTitle ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Usuwanie...' : 'Usuń'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
