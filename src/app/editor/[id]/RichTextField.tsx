import React, { useRef, useState, useEffect } from 'react';

interface RichTextFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  isTextarea?: boolean; // ignorowane w wersji contentEditable
  rows?: number;        // ignorowane w wersji contentEditable
}

export function RichTextField({ value, onChange, placeholder, style, className }: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isInternalChange = useRef(false);

  // Ustawienie początkowej wartości lub aktualizacji z zewnątrz
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      editorRef.current.innerHTML = value || '';
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, arg: string = '') => {
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.rich-text-toolbar')) {
      return;
    }
    // Dajemy chwilę na zakończenie kliknięcia w toolbarze zanim go schowamy
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Pasek narzędzi formatowania - widoczny TYLKO przy aktywnym polu */}
      {isFocused && (
        <div 
          className="rich-text-toolbar animate-slide-down" 
          tabIndex={-1}
          style={{ 
            position: 'absolute', 
            top: '-2.75rem', 
            left: 0, 
            display: 'flex', 
            gap: '0.25rem', 
            alignItems: 'center', 
            backgroundColor: 'white', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-sm)', 
            padding: '0.25rem', 
            boxShadow: 'var(--shadow-md)', 
            zIndex: 100 
          }}
        >
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('bold'); }} className="btn btn-secondary" style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', fontWeight: 'bold', minHeight: 'auto' }} title="Pogrubienie">B</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('italic'); }} className="btn btn-secondary" style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', fontStyle: 'italic', minHeight: 'auto' }} title="Pochylenie">I</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('underline'); }} className="btn btn-secondary" style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', textDecoration: 'underline', minHeight: 'auto' }} title="Podkreślenie">U</button>
          
          <button 
            type="button" 
            onMouseDown={(e) => { 
              e.preventDefault(); 
              executeCommand('backColor', '#fef08a'); 
            }} 
            className="btn btn-secondary" 
            style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', backgroundColor: '#fef08a', color: 'black', minHeight: 'auto', border: '1px solid #facc15' }}
            title="Zakreślacz"
          >
            🖍️
          </button>
          
          <span style={{ width: '1px', height: '1rem', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }} />
          
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('foreColor', '#ef4444'); }} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#ef4444', border: 'none', cursor: 'pointer' }} title="Czerwony" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('foreColor', '#3b82f6'); }} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#3b82f6', border: 'none', cursor: 'pointer' }} title="Niebieski" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('foreColor', '#10b981'); }} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#10b981', border: 'none', cursor: 'pointer' }} title="Zielony" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('foreColor', '#f59e0b'); }} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#f59e0b', border: 'none', cursor: 'pointer' }} title="Pomarańczowy" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); executeCommand('foreColor', '#000000'); }} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#000000', border: 'none', cursor: 'pointer' }} title="Czarny" />
        </div>
      )}

      {/* Wizualny kontener contentEditable */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        className={className}
        style={{ 
          minHeight: '2.5rem', 
          outline: 'none', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-md)', 
          padding: '0.5rem 0.75rem', 
          backgroundColor: 'white',
          cursor: 'text',
          ...style 
        }}
      />
      
      {/* Tekst pomocniczy placeholder */}
      {!value && (
        <div style={{ position: 'absolute', top: '0.5rem', left: '0.75rem', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: style?.fontSize || 'inherit', fontWeight: style?.fontWeight || 'inherit' }}>
          {placeholder}
        </div>
      )}
    </div>
  );
}
