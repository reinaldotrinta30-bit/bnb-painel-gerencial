'use client';

import React, { useState, useMemo } from 'react';
import { salvarFerramentasSync } from '@/lib/firebaseSync';
import { CardKanban, RegistroContratacao } from '@/types/painel';
import ModalConsolidadaRural, {
  DadosIniciaisClienteDoc,
} from '@/components/documentos/ModalConsolidadaRural';
import ModalDeclaracoesAmbientais, {
  TipoDeclaracaoGeral,
} from '@/components/documentos/ModalDeclaracoesAmbientais';
import ModalRenovacaoPlanta from '@/components/documentos/ModalRenovacaoPlanta';

interface AbaGeradorDocumentosCardProps {
  card: CardKanban;
  operacoesCliente: RegistroContratacao[];
  todasContratacoes?: RegistroContratacao[];
}

const btnAtalhoDocStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#1e293b',
  border: '1px solid #cbd5e1',
  padding: '8px 12px',
  fontSize: '11.5px',
  fontWeight: 700,
  textAlign: 'left',
  borderRadius: '6px',
  cursor: 'pointer',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  transition: 'all 0.15s ease',
};

export default function AbaGeradorDocumentosCard({
  card,
  operacoesCliente,
  todasContratacoes = [],
}: AbaGeradorDocumentosCardProps) {
  const [opSelecionadaId, setOpSelecionadaId] = useState<string>(() => {
    const deriv = operacoesCliente.find(
      (o) => !['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
    );
    return deriv?.id || operacoesCliente[0]?.id || 'card_default';
  });

  const opAtiva = useMemo(() => {
    return (
      operacoesCliente.find((o) => String(o.id) === String(opSelecionadaId)) ||
      operacoesCliente[0]
    );
  }, [operacoesCliente, opSelecionadaId]);

  const dadosClienteCard = useMemo<DadosIniciaisClienteDoc>(() => {
    return {
      nome: (opAtiva?.cliente || card.clienteVinculado || '').toUpperCase().trim(),
      cpf: opAtiva?.cpf || card.cpfVinculado || '',
      porte: (opAtiva?.porte || card.porteVinculado || 'PRONAF V').toUpperCase().trim(),
      projetista: opAtiva?.projetista || '',
      valor: opAtiva?.valor || card.valorVinculado || '',
    };
  }, [opAtiva, card]);

  const isPortePronaf = (dadosClienteCard.porte || '').includes('PRONAF');

  // Estados de abertura dos Modais a partir do Card
  const [modalConsolidada, setModalConsolidada] = useState<'PF' | 'PRONAF' | null>(
    null
  );
  const [modalDeclGeral, setModalDeclGeral] =
    useState<TipoDeclaracaoGeral | null>(null);
  const [modalPlanta, setModalPlanta] = useState<
    'PROTOCOLO' | 'SOLICITACAO' | null
  >(null);

  const baseCarteiraParaModal =
    todasContratacoes.length > 0 ? todasContratacoes : operacoesCliente;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* BARRA SUPERIOR: DADOS VINCULADOS DO CLIENTE NO CARD */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderLeft: '5px solid #8B1530',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '13.5px', color: '#8B1530' }}>
              🗂️ CENTRAL DE DOCUMENTOS DO CLIENTE:
            </strong>
            <span
              style={{
                background: '#f8ecee',
                color: '#8B1530',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {dadosClienteCard.nome || 'CLIENTE NÃO IDENTIFICADO'}
            </span>
            {dadosClienteCard.cpf && (
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>
                CPF: {dadosClienteCard.cpf}
              </span>
            )}
            <span
              style={{
                background: isPortePronaf ? '#dcfce7' : '#e0f2fe',
                color: isPortePronaf ? '#15803d' : '#0369a1',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              PORTE: {dadosClienteCard.porte}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
            Clique em qualquer documento abaixo para abrir o gerador (.DOCX e .PDF) já preenchido com os dados deste Card.
          </span>
        </div>

        {operacoesCliente.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', margin: 0 }}>
              Operação Base:
            </label>
            <select
              value={opSelecionadaId}
              onChange={(e) => setOpSelecionadaId(e.target.value)}
              style={{
                width: 'auto',
                height: '32px',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
              }}
            >
              {operacoesCliente.map((op, i) => (
                <option key={op.id} value={op.id}>
                  Op. {i + 1}: {op.tipo} — R$ {op.valor} ({op.porte})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* VITRINE DE ATALHOS DOS 16 DOCUMENTOS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))',
          gap: '14px',
        }}
      >
        {/* COLUNA 1: CONSOLIDADAS & PLANTA NORDESTE */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #8B1530',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <strong style={{ fontSize: '12px', color: '#8B1530', marginBottom: '2px' }}>
            📑 1. DECLARAÇÕES CONSOLIDADAS & PLANTA
          </strong>

          <button
            type="button"
            onClick={() => setModalConsolidada('PRONAF')}
            style={{
              ...btnAtalhoDocStyle,
              borderColor: isPortePronaf ? '#15803d' : '#cbd5e1',
              background: isPortePronaf ? '#f0fdf4' : '#ffffff',
            }}
          >
            <span>🌱 Consolidada Rural PRONAF</span>
            {isPortePronaf && (
              <span
                style={{
                  fontSize: '9.5px',
                  background: '#15803d',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '8px',
                }}
              >
                ⭐ Recomendado
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setModalConsolidada('PF')}
            style={{
              ...btnAtalhoDocStyle,
              borderColor: !isPortePronaf ? '#0369a1' : '#cbd5e1',
              background: !isPortePronaf ? '#f0f9ff' : '#ffffff',
            }}
          >
            <span>📄 Consolidada Rural PF (Não PRONAF)</span>
            {!isPortePronaf && (
              <span
                style={{
                  fontSize: '9.5px',
                  background: '#0369a1',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '8px',
                }}
              >
                ⭐ Recomendado
              </span>
            )}
          </button>

          <div style={{ borderTop: '1px dashed #e2e8f0', margin: '4px 0' }} />

          <button
            type="button"
            onClick={() => setModalPlanta('PROTOCOLO')}
            style={btnAtalhoDocStyle}
          >
            <span>🌾 Protocolo — Renovação Planta Nordeste</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalPlanta('SOLICITACAO')}
            style={btnAtalhoDocStyle}
          >
            <span>📋 Solicitação — Renovação Planta Nordeste</span>
            <span>➔</span>
          </button>
        </div>

        {/* COLUNA 2: AS 7 DECLARAÇÕES AMBIENTAIS */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #15803d',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}
        >
          <strong style={{ fontSize: '12px', color: '#15803d', marginBottom: '2px' }}>
            🍃 2. DECLARAÇÕES AMBIENTAIS (7 MODELOS)
          </strong>

          <button
            type="button"
            onClick={() => setModalDeclGeral('REGULARIDADE_AMBIENTAL')}
            style={btnAtalhoDocStyle}
          >
            <span>🌿 Decl. de Regularidade Ambiental</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('REG_AMB_GARANTIDOR')}
            style={btnAtalhoDocStyle}
          >
            <span>🛡️ Decl. Reg. Amb. Imóvel Garantidor</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('NAO_DESMATAMENTO_2008')}
            style={btnAtalhoDocStyle}
          >
            <span>🌳 Decl. de Não Desmatamento Após 2008</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('RECOMPOSICAO')}
            style={btnAtalhoDocStyle}
          >
            <span>🌱 Declaração de Recomposição</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('BIOMA_AMAZONIA')}
            style={btnAtalhoDocStyle}
          >
            <span>🌴 Declaração de Bioma Amazônia</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('NAO_DESMAT_DESMEMBRAMENTO')}
            style={btnAtalhoDocStyle}
          >
            <span>📐 Decl. Não Desmat. e Desmembramento</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('RESERVA_AMB_ACIMA_4')}
            style={btnAtalhoDocStyle}
          >
            <span>🏞️ Decl. Reserva Ambiental (&gt; 4 Módulos)</span>
            <span>➔</span>
          </button>
        </div>

        {/* COLUNA 3: AS 4 DECLARAÇÕES DO CAR + 3 OPERACIONAIS */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #0369a1',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}
        >
          <strong style={{ fontSize: '12px', color: '#0369a1', marginBottom: '2px' }}>
            🗺️ 3. DECLARAÇÕES DO CAR & OPERACIONAIS
          </strong>

          <button
            type="button"
            onClick={() => setModalDeclGeral('RETIFICACAO_CAR')}
            style={btnAtalhoDocStyle}
          >
            <span>✏️ Declaração de Retificação do CAR</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('SOBREPOSICAO_CAR')}
            style={btnAtalhoDocStyle}
          >
            <span>🗺️ Declaração de Sobreposição do CAR</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('SOBREPOSICAO_CAR_POSSEIRO')}
            style={btnAtalhoDocStyle}
          >
            <span>🏕️ Decl. Sobreposição do CAR (Posseiro)</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('SOBREPOSICAO_CAR_DIF')}
            style={btnAtalhoDocStyle}
          >
            <span>🔄 Decl. Sobreposição de CAR Diferente</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('NAO_EXPLORACAO')}
            style={btnAtalhoDocStyle}
          >
            <span>🚫 Declaração de Não Exploração</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('PROD_AUTOMATICOS')}
            style={btnAtalhoDocStyle}
          >
            <span>⚙️ Decl. Contr. de Produtos Automáticos</span>
            <span>➔</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDeclGeral('ALTERACAO_PROPOSTA')}
            style={btnAtalhoDocStyle}
          >
            <span>📝 Decl. de Alteração da Proposta</span>
            <span>➔</span>
          </button>
        </div>
      </div>

      {/* MODAIS CONECTADOS AOS DADOS DO CARD */}
      <ModalConsolidadaRural
        aberto={modalConsolidada !== null}
        modalidade={modalConsolidada || 'PRONAF'}
        onFechar={() => setModalConsolidada(null)}
        contratacoes={baseCarteiraParaModal}
        clienteInicial={dadosClienteCard}
      />

      <ModalDeclaracoesAmbientais
        aberto={modalDeclGeral !== null}
        tipo={modalDeclGeral}
        onFechar={() => setModalDeclGeral(null)}
        contratacoes={baseCarteiraParaModal}
        clienteInicial={dadosClienteCard}
      />

      <ModalRenovacaoPlanta
        aberto={modalPlanta !== null}
        modalidade={modalPlanta}
        onFechar={() => setModalPlanta(null)}
        contratacoes={baseCarteiraParaModal}
        clienteInicial={dadosClienteCard}
      />
    </div>
  );
}