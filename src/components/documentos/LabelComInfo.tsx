'use client';

import React, { useState, useRef, useEffect } from 'react';

interface LabelComInfoProps {
  texto: string;
  tagWord: string;
  corTexto?: string;
}

export default function LabelComInfo({
  texto,
  tagWord,
  corTexto = '#646464',
}: LabelComInfoProps) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fecharAoClicarFora = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', fecharAoClicarFora);
    return () => document.removeEventListener('mousedown', fecharAoClicarFora);
  }, [aberto]);

  const copiarTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tagWord);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1400);
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        marginBottom: '4px',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 700, color: corTexto }}>
        {texto}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberto((prev) => !prev);
        }}
        title="Clique para ver a variável correspondente no molde Word"
        style={{
          width: '15px',
          height: '15px',
          minWidth: '15px',
          padding: 0,
          borderRadius: '50%',
          background: aberto ? '#8B1530' : '#e2e8f0',
          color: aberto ? '#ffffff' : '#475569',
          border: 'none',
          fontSize: '9.5px',
          fontWeight: 800,
          fontFamily: 'serif',
          fontStyle: 'italic',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 1,
          transform: 'none',
        }}
      >
        i
      </button>

      {aberto && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: '#1e293b',
            color: '#ffffff',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '10.5px',
            whiteSpace: 'nowrap',
            zIndex: 99999,
            boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>
            Tag Word:{' '}
            <code
              style={{
                color: '#fde047',
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              {tagWord}
            </code>
          </span>
          <button
            type="button"
            onClick={copiarTag}
            style={{
              width: 'auto',
              padding: '2px 6px',
              fontSize: '9.5px',
              background: copiado ? '#15803d' : '#334155',
              color: '#ffffff',
              border: '1px solid #475569',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {copiado ? '✔ Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  );
}