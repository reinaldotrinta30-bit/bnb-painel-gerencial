'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
import { salvarFerramentasSync } from '@/lib/firebaseSync';
import { parseMoeda, formatarMoedaBD } from '@/lib/utils';

interface BotaoInfoSomaEstoqueProps {
  tituloLinha: string; // Ex: "PRONAF V", "MINI", "CADA VEZ MELHOR", "PRONAF A"
  tituloColuna: string; // Ex: "AG (Agência / PCE)", "CENTRAL (S522)", "DEVOLVIDO AG", "RENOV. CUSTEIO", "F. ASSINAR", "F. CONFORMIDADE"
  propostas: RegistroContratacao[];
}

export default function BotaoInfoSomaEstoque({
  tituloLinha,
  tituloColuna,
  propostas,
}: BotaoInfoSomaEstoqueProps) {
  const [aberto, setAberto] = useState(false);

  const totalSomado = propostas.reduce((acc, p) => acc + parseMoeda(p.valor), 0);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        title={`Ver as ${propostas.length} proposta(s) que somam neste item`}
        style={{
          width: '15px',
          height: '15px',
          minWidth: '15px',
          padding: 0,
          marginLeft: '5px',
          borderRadius: '50%',
          background: propostas.length > 0 ? '#e0f2fe' : '#f1f5f9',
          color: propostas.length > 0 ? '#0369a1' : '#94a3b8',
          border: `1px solid ${propostas.length > 0 ? '#bae6fd' : '#cbd5e1'}`,
          fontSize: '9.5px',
          fontWeight: 800,
          fontFamily: 'serif',
          fontStyle: 'italic',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 1,
          verticalAlign: 'middle',
          transform: 'none',
        }}
      >
        i
      </button>

      {aberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setAberto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              zIndex: 99999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#ffffff',
                width: '92%',
                maxWidth: '760px',
                maxHeight: '85vh',
                borderRadius: '10px',
                borderTop: '5px solid #8B1530',
                boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Cabeçalho */}
              <div
                style={{
                  padding: '14px 18px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '14.5px', color: '#8B1530', fontWeight: 800 }}>
                    🔎 COMPOSIÇÃO DO VALOR: {tituloLinha} ➔ {tituloColuna}
                  </h4>
                  <span style={{ fontSize: '11.5px', color: '#475569' }}>
                    Total de <b>{propostas.length}</b> proposta(s) somando{' '}
                    <b style={{ color: '#15803d' }}>R$ {formatarMoedaBD(totalSomado)}</b>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  style={{
                    width: 'auto',
                    background: 'none',
                    border: 'none',
                    fontSize: '22px',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Lista das Propostas */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
                {propostas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '12.5px' }}>
                    Nenhuma proposta enquadrada neste item no momento.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#334155' }}>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>#</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>Cliente / CPF</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>Tipo / Programa</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>Projetista</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>Situação</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1', textAlign: 'right' }}>
                          Valor (R$)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {propostas.map((p, idx) => (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: 700, color: '#64748b' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.cliente}</div>
                            {p.cpf && (
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>{p.cpf}</div>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ fontWeight: 700 }}>{p.tipo}</div>
                            {p.programa && (
                              <div style={{ fontSize: '10px', color: '#8B1530' }}>{p.programa}</div>
                            )}
                          </td>
                          <td style={{ padding: '8px', fontSize: '11px' }}>
                            {p.projetista || '-'}
                          </td>
                          <td style={{ padding: '8px', fontSize: '11px', fontWeight: 700 }}>
                            {p.situacao}
                          </td>
                          <td
                            style={{
                              padding: '8px',
                              textAlign: 'right',
                              fontWeight: 800,
                              color: '#15803d',
                            }}
                          >
                            R$ {p.valor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                        <td colSpan={5} style={{ padding: '10px 8px', textAlign: 'right', color: '#1e293b' }}>
                          SOMA TOTAL DESTE ITEM ({propostas.length} propostas):
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#8B1530', fontSize: '13px' }}>
                          R$ {formatarMoedaBD(totalSomado)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Rodapé */}
              <div
                style={{
                  padding: '10px 18px',
                  background: '#f1f5f9',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  style={{
                    width: 'auto',
                    padding: '6px 18px',
                    background: '#8B1530',
                    color: '#fff',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}