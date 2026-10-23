'use client';

import React, { useState, useEffect } from 'react';
import {
  obterListaProgramas,
  obterListaProjetistas,
  ProjetistaConfig,
  LISTA_PROGRAMAS_PADRAO,
  LISTA_PROJETISTAS_PADRAO,
  isEnquadradoCadaVezMelhor,
} from '@/lib/utils';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
  CardKanban,
} from '@/types/painel';

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
          alert('❌ Arquivo de backup inválido.');
        }
      } catch {
        alert('❌ Erro ao ler arquivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px', background: '#f4f7f9' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '17px' }}>
              🛠️ CENTRAL DE FERRAMENTAS E PARÂMETROS DO SISTEMA
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--support-gray)' }}>
              Gerencie os Programas de Crédito, contatos de WhatsApp dos Projetistas e Backups Unificados.
            </span>
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
              }}
            >
              💾 Baixar Backup Geral Unificado
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px' }}>
          {/* COLUNA 1: GESTÃO DE PROGRAMAS DE CRÉDITO */}
          <div className="person-card" style={{ background: '#fff', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--primary-color)', fontSize: '14px' }}>
                📑 PROGRAMAS DE CRÉDITO ({programas.length})
              </strong>
              <button
                onClick={() => salvarProgramas(LISTA_PROGRAMAS_PADRAO)}
                style={{ background: 'transparent', color: '#666', border: '1px solid #ccc', padding: '3px 8px', fontSize: '10px' }}
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
                style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '12px' }}
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
                            style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '13px' }}
                            title="Editar Programa"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() =>
                              salvarProgramas(programas.filter((_, i) => i !== idx))
                            }
                            style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '13px' }}
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

          {/* COLUNA 2: GESTÃO DE PROJETISTAS E TELEFONES DE WHATSAPP */}
          <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--primary-color)', fontSize: '14px' }}>
                👨‍💼 PROJETISTAS & WHATSAPP PARA COBRANÇA ({projetistas.length})
              </strong>
              <button
                onClick={() => salvarProjetistas(LISTA_PROJETISTAS_PADRAO)}
                style={{ background: 'transparent', color: '#666', border: '1px solid #ccc', padding: '3px 8px', fontSize: '10px' }}
              >
                Restaurar Padrão
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1.6fr 1.2fr auto', alignItems: 'end', marginBottom: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Nome Curto (Usado no Card)</label>
                <input
                  type="text"
                  value={projCurto}
                  onChange={(e) => setProjCurto(e.target.value)}
                  placeholder="Ex: DEIMID"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Nome Completo</label>
                <input
                  type="text"
                  value={projCompleto}
                  onChange={(e) => setProjCompleto(e.target.value)}
                  placeholder="Nome completo..."
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#15803d' }}>
                  📲 WhatsApp (DDD + Número)
                </label>
                <input
                  type="text"
                  value={projFone}
                  onChange={(e) => setProjFone(e.target.value)}
                  placeholder="Ex: 98988887777"
                />
              </div>
              <button
                onClick={adicionarOuEditarProjetista}
                className="btn-save"
                style={{ height: '36px', padding: '0 14px', fontSize: '12px' }}
              >
                {editandoProjIdx !== null ? '✔ Salvar' : '+ Salvar'}
              </button>
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="conf-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: '10px' }}>NOME CURTO</th>
                    <th style={{ textAlign: 'left' }}>NOME COMPLETO</th>
                    <th>📲 WHATSAPP</th>
                    <th style={{ width: '80px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {projetistas.map((p, idx) => (
                    <tr key={p.nomeCurto + idx}>
                      <td style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 'bold' }}>
                        {p.nomeCurto}
                      </td>
                      <td style={{ textAlign: 'left', fontSize: '11px', color: '#555' }}>
                        {p.nomeCompleto || '-'}
                      </td>
                      <td style={{ fontWeight: 'bold', color: p.telefone ? '#15803d' : '#999' }}>
                        {p.telefone || 'Sem nº cadastrado'}
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
                          style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '13px' }}
                          title="Editar Projetista / WhatsApp"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() =>
                            salvarProjetistas(projetistas.filter((_, i) => i !== idx))
                          }
                          style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '13px' }}
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
    </div>
  );
}