'use client';

import React from 'react';
import { CardKanban, EtapaKanban } from '@/types/painel';

interface ModalInspecaoKanbanProps {
  aberto: boolean;
  onFechar: () => void;
  card?: CardKanban;
  fallbackTitulo?: string;
  fallbackHtml?: string;
  onIrParaKanban: (cardId?: string, etapa?: EtapaKanban) => void;
}

const NOMES_ETAPAS: Record<EtapaKanban, string> = {
  NOTAS: '📌 NOTAS / LEMBRETES',
  CADASTROS: '📂 CADASTROS',
  PCE: '⚡ PCE (SOLICITAÇÕES)',
  S522: '🏛️ S522 / CENTRAL',
  CONTRATOS: '📝 CONTRATOS / RENOVAÇÕES',
  DESEMBOLSOS: '💸 DESEMBOLSOS',
  ACOMPANHAMENTO: '📈 ACOMPANHAMENTO',
};

export default function ModalInspecaoKanban({
  aberto,
  onFechar,
  card,
  fallbackTitulo,
  fallbackHtml,
  onIrParaKanban,
}: ModalInspecaoKanbanProps) {
  if (!aberto) return null;

  const corBordaEsquerda =
    card?.statusCor === 'vermelho'
      ? '#d93025'
      : card?.statusCor === 'azul'
      ? '#1a73e8'
      : card?.statusCor === 'verde'
      ? '#137333'
      : '#f29900';

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.72)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '82%',
          maxWidth: '780px',
          maxHeight: '85vh',
          background: '#ffffff',
          borderRadius: '8px',
          borderLeft: `6px solid ${corBordaEsquerda}`,
          boxShadow: '0 12px 35px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* CABEÇALHO DO MODAL (ESTILO MODO FOCO DO KANBAN) */}
        <div
          style={{
            background: '#f9f9f9',
            borderBottom: '1px solid #e0e0e0',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'var(--primary-color)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '4px 10px',
                borderRadius: '12px',
                textTransform: 'uppercase',
              }}
            >
              {card ? NOMES_ETAPAS[card.etapa] : '🔎 INSPEÇÃO DA PROPOSTA'}
            </span>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
              {card?.dataModificacao
                ? `Última atualização: ${card.dataModificacao.split('-').reverse().join('/')}`
                : fallbackTitulo || 'Visualização Somente Leitura'}
            </span>
          </div>

          <button
            onClick={onFechar}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#555',
              fontSize: '24px',
              fontWeight: 'bold',
              padding: '0 6px',
              lineHeight: 1,
            }}
            title="Fechar Visualização"
          >
            &times;
          </button>
        </div>

        {/* CORPO DA NOTA (SOMENTE LEITURA, IDÊNTICO AO CARD EXPANDIDO DO KANBAN) */}
        <div
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            fontSize: '14px',
            color: '#333',
            lineHeight: 1.65,
            background: '#fff',
          }}
        >
          {card ? (
            <div dangerouslySetInnerHTML={{ __html: card.texto }} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: fallbackHtml || 'Nenhuma nota encontrada.' }} />
          )}
        </div>

        {/* RODAPÉ COM O BOTÃO ATALHO DIRETO PARA O KANBAN */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f4f5f7',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
            🔒 Modo de leitura. Para editar ou mover esta nota, utilize o atalho ao lado:
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onFechar}
              style={{
                background: 'var(--support-gray)',
                color: '#fff',
                padding: '9px 16px',
                fontSize: '12px',
                borderRadius: '4px',
              }}
            >
              Fechar
            </button>

            <button
              onClick={() => onIrParaKanban(card?.id, card?.etapa)}
              style={{
                background: 'var(--primary-color)',
                color: '#fff',
                padding: '9px 18px',
                fontSize: '12px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(139,21,48,0.3)',
              }}
            >
              <span>📋</span> Ir para esta Nota no Kanban ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}