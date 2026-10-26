'use client';

import React, { useState, useEffect } from 'react';
import {
  obterListaProgramas,
  obterListaProjetistas,
  ProjetistaConfig,
  LISTA_PROGRAMAS_PADRAO,
  LISTA_PROJETISTAS_PADRAO,
  isEnquadradoCadaVezMelhor,
  aplicarMascaraCPF,
} from '@/lib/utils';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
  CardKanban,
} from '@/types/painel';
import ModalConsolidadaRural from '@/components/documentos/ModalConsolidadaRural';
import ModalDeclaracoesAmbientais, {
  TipoDeclaracaoGeral,
} from '@/components/documentos/ModalDeclaracoesAmbientais';
import ModalRenovacaoPlanta from '@/components/documentos/ModalRenovacaoPlanta';

interface ModuloFerramentasProps {
  contratacoes: RegistroContratacao[];
  operacoesBase: OperacaoBaseDesembolso[];
  eventos: EventoDesembolso[];
  cardsKanban: CardKanban[];
  onRestaurarBackupCompleto: (dados: {
    contratacoes: RegistroContratacao[];
    operacoesBase: OperacaoBaseDesembolso[];
    eventos: EventoDesembolso[];
    cardsKanban: CardKanban[];
  }) => void;
}

const btnDocStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#1e293b',
  border: '1px solid #cbd5e1',
  padding: '7px 10px',
  fontSize: '11px',
  fontWeight: 700,
  textAlign: 'left',
  borderRadius: '6px',
  cursor: 'pointer',
  width: '100%',
};

export default function ModuloFerramentas({
  contratacoes,
  operacoesBase,
  eventos,
  cardsKanban,
  onRestaurarBackupCompleto,
}: ModuloFerramentasProps) {
  const [programas, setProgramas] = useState<string[]>([]);
  const [novoPrograma, setNovoPrograma] = useState('');
  const [editandoProgIdx, setEditandoProgIdx] = useState<number | null>(null);

  const [projetistas, setProjetistas] = useState<ProjetistaConfig[]>([]);
  const [projCurto, setProjCurto] = useState('');
  const [projCompleto, setProjCompleto] = useState('');
  const [projReg, setProjReg] = useState('');
  const [projCpf, setProjCpf] = useState('');
  const [projFone, setProjFone] = useState('');
  const [editandoProjIdx, setEditandoProjIdx] = useState<number | null>(null);

  // Estados dos Modais do Gerador de Documentos Word (.DOCX)
  const [modalConsolidada, setModalConsolidada] = useState<'PF' | 'PRONAF' | null>(null);
  const [modalDeclGeral, setModalDeclGeral] = useState<TipoDeclaracaoGeral | null>(null);
  const [modalPlanta, setModalPlanta] = useState<'PROTOCOLO' | 'SOLICITACAO' | null>(
    null
  );

  useEffect(() => {
    setProgramas(obterListaProgramas());
    setProjetistas(obterListaProjetistas());
  }, []);

  const salvarProgramas = (novaLista: string[]) => {
    setProgramas(novaLista);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'bnb_v2_config_programas',
        JSON.stringify(novaLista)
      );
    }
  };

  const adicionarOuEditarPrograma = () => {
    const limpo = novoPrograma.toUpperCase().trim();
    if (!limpo) return;

    if (editandoProgIdx !== null) {
      const copia = [...programas];
      copia[editandoProgIdx] = limpo;
      salvarProgramas(copia);
      setEditandoProgIdx(null);
    } else {
      if (!programas.includes(limpo)) {
        salvarProgramas([...programas, limpo]);
      }
    }
    setNovoPrograma('');
  };

  const salvarProjetistas = (novaLista: ProjetistaConfig[]) => {
    setProjetistas(novaLista);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'bnb_v2_config_projetistas',
        JSON.stringify(novaLista)
      );
    }
  };

  const adicionarOuEditarProjetista = () => {
    if (!projCurto.trim()) {
      alert('Informe ao menos o Nome Curto do Projetista (ex: DEIMID)!');
      return;
    }

    const item: ProjetistaConfig = {
      nomeCurto: projCurto.toUpperCase().trim(),
      nomeCompleto: projCompleto.toUpperCase().trim(),
      registro: projReg.trim(),
      cpf: projCpf.trim(),
      telefone: projFone.replace(/\D/g, ''),
    };

    if (editandoProjIdx !== null) {
      const copia = [...projetistas];
      copia[editandoProjIdx] = item;
      salvarProjetistas(copia);
      setEditandoProjIdx(null);
    } else {
      salvarProjetistas([...projetistas, item]);
    }

    setProjCurto('');
    setProjCompleto('');
    setProjReg('');
    setProjCpf('');
    setProjFone('');
  };

  const exportarBackupUnificado = () => {
    const pacote = {
      versao: 'BNB_PAINEL_V2',
      dataExportacao: new Date().toISOString(),
      contratacoes,
      operacoesBase,
      eventos,
      cardsKanban,
      programas,
      projetistas,
    };
    const blob = new Blob([JSON.stringify(pacote, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const hoje = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_GERAL_PAINEL_BNB_${hoje}.json`;
    a.click();
  };

  const importarBackupUnificado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(String(ev.target?.result));
        if (dados.contratacoes && dados.cardsKanban) {
          if (dados.programas) salvarProgramas(dados.programas);
          if (dados.projetistas) salvarProjetistas(dados.projetistas);
          onRestaurarBackupCompleto({
            contratacoes: dados.contratacoes || [],
            operacoesBase: dados.operacoesBase || [],
            eventos: dados.eventos || [],
            cardsKanban: dados.cardsKanban || [],
          });
          alert('✅ Backup Geral Unificado restaurado com sucesso!');
        } else {
          alert('❌ Ficheiro de backup inválido.');
        }
      } catch {
        alert('❌ Erro ao ler ficheiro JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px', background: '#f4f7f9' }}>
      <div style={{ maxWidth: '1260px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* BLOCO SUPERIOR: BACKUP UNIFICADO DO SISTEMA */}
        <div
          className="person-card"
          style={{
            borderLeftColor: 'var(--primary-color)',
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            marginBottom: 0,
            paddingBottom: '15px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '17px' }}>
              🛠️ CENTRAL DE FERRAMENTAS, GERADOR DE DOCUMENTOS E PARÂMETROS
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <label
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#333',
                padding: '8px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                marginBottom: 0,
              }}
            >
              📂 Restaurar Backup Geral (.JSON)
              <input
                type="file"
                accept=".json"
                onChange={importarBackupUnificado}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={exportarBackupUnificado}
              style={{
                background: 'var(--primary-color)',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '12px',
                width: 'auto',
              }}
            >
              💾 Baixar Backup Geral Unificado
            </button>
          </div>
        </div>

        {/* CENTRAL GERADORA DE TODOS OS 16 DOCUMENTOS OFICIAIS (.DOCX) */}
        <div
          className="person-card"
          style={{
            borderLeftColor: '#8B1530',
            background: '#ffffff',
            marginBottom: 0,
            paddingBottom: '18px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px dashed var(--border-color)',
              paddingBottom: '10px',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <strong style={{ color: 'var(--primary-color)', fontSize: '14.5px' }}>
                📄 GERADOR de DOCUMENTOS E DECLARAÇÕES
              </strong>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#64748b' }}>
                Em qualquer documento abaixo, pode clicar em &ldquo;📥 Baixar Molde .DOCX&rdquo; para editar cláusulas no Word e clicar em &ldquo;📤 Atualizar Molde .DOCX&rdquo; para substituir!
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(275px, 1fr))',
              gap: '14px',
            }}
          >
            {/* 1. CONSOLIDADAS + RENOVAÇÃO PLANTA NORDESTE */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #8B1530',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <strong style={{ fontSize: '11.5px', color: '#8B1530', marginBottom: '2px' }}>
                📑 1. CONSOLIDADAS & PLANTA NORDESTE
              </strong>
              <button
                type="button"
                onClick={() => setModalConsolidada('PF')}
                style={btnDocStyle}
              >
                📄 Consolidada Rural PF (Não PRONAF)
              </button>
              <button
                type="button"
                onClick={() => setModalConsolidada('PRONAF')}
                style={btnDocStyle}
              >
                🌱 Consolidada Rural PRONAF
              </button>
              <button
                type="button"
                onClick={() => setModalPlanta('PROTOCOLO')}
                style={btnDocStyle}
              >
                🌾 Protocolo — Renovação Planta Nordeste
              </button>
              <button
                type="button"
                onClick={() => setModalPlanta('SOLICITACAO')}
                style={btnDocStyle}
              >
                📋 Solicitação — Renovação Planta Nordeste
              </button>
            </div>

            {/* 2. AS 7 DECLARAÇÕES AMBIENTAIS */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #15803d',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <strong style={{ fontSize: '11.5px', color: '#15803d', marginBottom: '2px' }}>
                🍃 2. DECLARAÇÕES AMBIENTAIS (7 MODELOS)
              </strong>
              <button
                type="button"
                onClick={() => setModalDeclGeral('REGULARIDADE_AMBIENTAL')}
                style={btnDocStyle}
              >
                🌿 Decl. de Regularidade Ambiental
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('REG_AMB_GARANTIDOR')}
                style={btnDocStyle}
              >
                🛡️ Decl. Reg. Amb. Imóvel Garantidor
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('NAO_DESMATAMENTO_2008')}
                style={btnDocStyle}
              >
                🌳 Decl. de Não Desmatamento Após 2008
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('RECOMPOSICAO')}
                style={btnDocStyle}
              >
                🌱 Declaração de Recomposição
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('BIOMA_AMAZONIA')}
                style={btnDocStyle}
              >
                🌴 Declaração de Bioma Amazônia
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('NAO_DESMAT_DESMEMBRAMENTO')}
                style={btnDocStyle}
              >
                📐 Decl. Não Desmat. e Desmembramento
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('RESERVA_AMB_ACIMA_4')}
                style={btnDocStyle}
              >
                🏞️ Decl. Reserva Ambiental (&gt; 4 Módulos)
              </button>
            </div>

            {/* 3. AS 4 DECLARAÇÕES DO CAR + 3 OPERACIONAIS */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #0369a1',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <strong style={{ fontSize: '11.5px', color: '#0369a1', marginBottom: '2px' }}>
                🗺️ 3. DECLARAÇÕES DO CAR & OPERACIONAIS
              </strong>
              <button
                type="button"
                onClick={() => setModalDeclGeral('RETIFICACAO_CAR')}
                style={btnDocStyle}
              >
                ✏️ Declaração de Retificação do CAR
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('SOBREPOSICAO_CAR')}
                style={btnDocStyle}
              >
                🗺️ Declaração de Sobreposição do CAR
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('SOBREPOSICAO_CAR_POSSEIRO')}
                style={btnDocStyle}
              >
                🏕️ Decl. Sobreposição do CAR (Posseiro)
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('SOBREPOSICAO_CAR_DIF')}
                style={btnDocStyle}
              >
                🔄 Decl. Sobreposição de CAR Diferente
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('NAO_EXPLORACAO')}
                style={btnDocStyle}
              >
                🚫 Declaração de Não Exploração
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('PROD_AUTOMATICOS')}
                style={btnDocStyle}
              >
                ⚙️ Decl. Contr. de Produtos Automáticos
              </button>
              <button
                type="button"
                onClick={() => setModalDeclGeral('ALTERACAO_PROPOSTA')}
                style={btnDocStyle}
              >
                📝 Decl. de Alteração da Proposta
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          {/* COLUNA 1: GESTÃO DE PROGRAMAS DE CRÉDITO */}
          <div className="person-card" style={{ background: '#fff', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--primary-color)', fontSize: '14px' }}>
                📑 PROGRAMAS DE CRÉDITO ({programas.length})
              </strong>
              <button
                onClick={() => salvarProgramas(LISTA_PROGRAMAS_PADRAO)}
                style={{ background: 'transparent', color: '#666', border: '1px solid #ccc', padding: '3px 8px', fontSize: '10px', width: 'auto' }}
              >
                Restaurar Padrão
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={novoPrograma}
                onChange={(e) => setNovoPrograma(e.target.value)}
                placeholder="Ex: PRONAF ECO (408)"
              />
              <button
                onClick={adicionarOuEditarPrograma}
                className="btn-save"
                style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '12px', width: 'auto' }}
              >
                {editandoProgIdx !== null ? '✔ Atualizar' : '+ Adicionar'}
              </button>
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="conf-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: '10px' }}>PROGRAMA</th>
                    <th style={{ width: '90px' }}>CADA VEZ MELHOR</th>
                    <th style={{ width: '80px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {programas.map((prog, idx) => {
                    const cvm = isEnquadradoCadaVezMelhor(prog);
                    return (
                      <tr key={prog + idx}>
                        <td style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 'bold' }}>
                          {prog}
                        </td>
                        <td>
                          {cvm ? (
                            <span style={{ background: '#fce4ec', color: '#ad1457', padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }}>
                              SIM (CVM)
                            </span>
                          ) : (
                            <span style={{ color: '#999', fontSize: '11px' }}>Não</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setNovoPrograma(prog);
                              setEditandoProgIdx(idx);
                            }}
                            style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '13px', width: 'auto' }}
                            title="Editar Programa"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() =>
                              salvarProgramas(programas.filter((_, i) => i !== idx))
                            }
                            style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '13px', width: 'auto' }}
                            title="Remover Programa"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* COLUNA 2: GESTÃO DE PROJETISTAS */}
          <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--primary-color)', fontSize: '14px' }}>
                👨‍💼 PROJETISTAS (WHATSAPP, CREA/CFTA & CPF) ({projetistas.length})
              </strong>
              <button
                onClick={() => salvarProjetistas(LISTA_PROJETISTAS_PADRAO)}
                style={{ background: 'transparent', color: '#666', border: '1px solid #ccc', padding: '3px 8px', fontSize: '10px', width: 'auto' }}
              >
                Restaurar Padrão
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1.1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '11px' }}>Nome Curto (Card)</label>
                <input
                  type="text"
                  value={projCurto}
                  onChange={(e) => setProjCurto(e.target.value)}
                  placeholder="Ex: DEIMID"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px' }}>Nome Completo (Declarações)</label>
                <input
                  type="text"
                  value={projCompleto}
                  onChange={(e) => setProjCompleto(e.target.value)}
                  placeholder="Nome completo..."
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#15803d' }}>📲 WhatsApp</label>
                <input
                  type="text"
                  value={projFone}
                  onChange={(e) => setProjFone(e.target.value)}
                  placeholder="98988887777"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr auto', gap: '8px', alignItems: 'end', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px' }}>Nº Registro (CREA / CFTA)</label>
                <input
                  type="text"
                  value={projReg}
                  onChange={(e) => setProjReg(e.target.value)}
                  placeholder="Ex: CREA/MA 123456"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px' }}>CPF do Projetista</label>
                <input
                  type="text"
                  value={projCpf}
                  onChange={(e) => setProjCpf(aplicarMascaraCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <button
                onClick={adicionarOuEditarProjetista}
                className="btn-save"
                style={{ height: '36px', padding: '0 16px', fontSize: '12px', width: 'auto' }}
              >
                {editandoProjIdx !== null ? '✔ Atualizar' : '+ Salvar'}
              </button>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <table className="conf-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: '8px' }}>CURTO</th>
                    <th style={{ textAlign: 'left' }}>NOME COMPLETO / REGISTRO</th>
                    <th>CPF</th>
                    <th>📲 WHATSAPP</th>
                    <th style={{ width: '70px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {projetistas.map((p, idx) => (
                    <tr key={p.nomeCurto + idx}>
                      <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }}>
                        {p.nomeCurto}
                      </td>
                      <td style={{ textAlign: 'left', fontSize: '11px', color: '#334155' }}>
                        <div>{p.nomeCompleto || '-'}</div>
                        {p.registro && (
                          <span style={{ fontSize: '10px', color: '#8B1530', fontWeight: 700 }}>
                            {p.registro}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '11px' }}>{p.cpf || '-'}</td>
                      <td style={{ fontWeight: 'bold', color: p.telefone ? '#15803d' : '#999' }}>
                        {p.telefone || 'S/ nº'}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setProjCurto(p.nomeCurto);
                            setProjCompleto(p.nomeCompleto || '');
                            setProjReg(p.registro || '');
                            setProjCpf(p.cpf || '');
                            setProjFone(p.telefone || '');
                            setEditandoProjIdx(idx);
                          }}
                          style={{ background: 'none', border: 'none', padding: '2px 4px', fontSize: '13px', width: 'auto' }}
                          title="Editar Projetista"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() =>
                            salvarProjetistas(projetistas.filter((_, i) => i !== idx))
                          }
                          style={{ background: 'none', border: 'none', padding: '2px 4px', fontSize: '13px', width: 'auto' }}
                          title="Excluir Projetista"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAIS DE GERAÇÃO DE DOCUMENTOS WORD */}
      <ModalConsolidadaRural
        aberto={modalConsolidada !== null}
        modalidade={modalConsolidada || 'PF'}
        onFechar={() => setModalConsolidada(null)}
        contratacoes={contratacoes}
      />

      <ModalDeclaracoesAmbientais
        aberto={modalDeclGeral !== null}
        tipo={modalDeclGeral}
        onFechar={() => setModalDeclGeral(null)}
        contratacoes={contratacoes}
      />

      <ModalRenovacaoPlanta
        aberto={modalPlanta !== null}
        modalidade={modalPlanta}
        onFechar={() => setModalPlanta(null)}
        contratacoes={contratacoes}
      />
    </div>
  );
}