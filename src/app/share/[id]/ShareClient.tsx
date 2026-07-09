'use client';

import { useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { Clipboard, Download } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export default function ShareClient({
  surveyId,
  surveyUrl,
  iframeCode,
  embedCode
}: {
  surveyId: string;
  surveyUrl: string;
  iframeCode: string;
  embedCode: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, message, type }]);
    // Min 15 sekund aktywny, chyba że użytkownik zamknie
    setTimeout(() => {
      removeToast(id);
    }, 15000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast(`Skopiowano ${label} do schowka!`, 'success');
    } catch (err) {
      addToast(`Błąd podczas kopiowania: ${(err as Error).message}`, 'error');
    }
  };

  const downloadHtmlFile = () => {
    const element = document.createElement("a");
    const file = new Blob([embedCode], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = `formflow-ankieta-${surveyId}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addToast("Pobrano plik HTML z ankietą!", "success");
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="h1" style={{ margin: 0 }}>Udostępnij ankietę</h1>
        <Link href={`/editor/${surveyId}`} className="btn btn-secondary">
          Powrót do edytora
        </Link>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div className="card">
          <h2 className="h2">Bezpośredni link</h2>
          <p className="p-muted" style={{ marginBottom: '1rem' }}>Wyślij ten link swoim odbiorcom.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              readOnly 
              value={surveyUrl} 
              className="input" 
              style={{ backgroundColor: '#f9fafb', color: 'var(--text-color)' }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button onClick={() => copyToClipboard(surveyUrl, 'link do ankiety')} className="btn btn-primary">
              <Clipboard size={18} />
              Kopiuj
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="h2">Wariant 1: iFrame (Zalecane)</h2>
          <p className="p-muted" style={{ marginBottom: '1rem' }}>Wklej ten kod na swoją stronę, by osadzić ankietę w bezpiecznym oknie (iFrame).</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea 
              readOnly 
              value={iframeCode}
              className="input"
              rows={4}
              style={{ backgroundColor: '#f9fafb', fontFamily: 'monospace', fontSize: '0.9rem' }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button onClick={() => copyToClipboard(iframeCode, 'kod iframe')} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Clipboard size={18} />
              Kopiuj kod iFrame
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="h2">Wariant 2: Pełny kod HTML/CSS/JS (Czysta wklejka)</h2>
          <p className="p-muted" style={{ marginBottom: '1rem' }}>Kompletny kod ankiety do wklejenia na czystą stronę. Dane są wysyłane bezpośrednio do Twojego serwera przez interfejs CORS.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <textarea 
              readOnly 
              value={embedCode}
              className="input"
              rows={6}
              style={{ backgroundColor: '#f9fafb', fontFamily: 'monospace', fontSize: '0.9rem' }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => copyToClipboard(embedCode, 'pelny kod HTML')} className="btn btn-primary">
                <Clipboard size={18} />
                Kopiuj kod
              </button>
              <button onClick={downloadHtmlFile} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Download size={18} />
                Pobierz jako plik .html
              </button>
            </div>
          </div>
        </div>

      </div>

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
