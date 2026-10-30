'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
import {
  parseMoeda,
  formatarMoedaBD,
  aplicarMascaraMoedaInput,
} from '@/lib/utils';

export interface SimulacaoEstoqueCarteira {
  idsDesmarcados: string[];
  valoresCustomizados: Record<string, string>;
  modoFlexivelAtivo?: boolean;
}

interface BotaoInfoSomaEstoqueProps {
  tituloLinha: string;
  tituloColuna: string;
  propostas: RegistroContratacao[];
  simulacao: SimulacaoEstoqueCarteira;
  onToggleProposta: (idProposta: string) => void;
  onToggleVariasPropostas: (ids: string[], marcar: boolean) => void;
  onAlterarValorProvisorio: (idProposta: string, novoValor: string | null) => void;
  onToggleModoFlexivel: (ativo: boolean) => void;
  onAbrirCardKanbanCliente?: (proposta: RegistroContratacao) => void;
}

export default function BotaoInfoSomaEstoque({
  tituloLinha,
  tituloColuna,
  propostas,
  simulacao,
  onToggleProposta,
  onToggleVariasPropostas,
  onAlterarValorProvisorio,
  onToggleModoFlexivel,
  onAbrirCardKanbanCliente,
}: BotaoInfoSomaEstoqueProps) {
  const [aberto, setAberto] = useState(false);
  const [editandoValorId, setEditandoValorId] = useState<string | null>(null);
  const [valorTempInput, setValorTempInput] = useState('');

  const idsDesmarcadosSet = new Set(simulacao.idsDesmarcados || []);
  const mostrarCheckboxes = Boolean(simulacao.modoFlexivelAtivo);

  const obterValorEfetivoStr = (p: RegistroContratacao): string => {
    const custom = simulacao.valoresCustomizados?.[String(p.id)];
    return custom !== undefined ? custom : p.valor;
  };

  const propostasAtivas = propostas.filter(
    (p) => !idsDesmarcadosSet.has(String(p.id))
  );

  const totalSomadoAtivo = propostasAtivas.reduce(
    (acc, p) => acc + parseMoeda(obterValorEfetivoStr(p)),
    0
  );

  const totalOriginalSemCortes = propostas.reduce(
    (acc, p) => acc + parseMoeda(p.valor),
    0
  );

  const temHipotesesNesteBloco = propostas.some(
    (p) =>
      idsDesmarcadosSet.has(String(p.id)) ||
      simulacao.valoresCustomizados?.[String(p.id)] !== undefined
  );

  const iniciarEdicaoDuploClique = (p: RegistroContratacao) => {
    setEditandoValorId(String(p.id));
    setValorTempInput(obterValorEfetivoStr(p));
  };

  const confirmarEdicaoValor = (p: RegistroContratacao) => {
    const idStr = String(p.id);
    const limpo = valorTempInput.trim();
    if (!limpo || limpo === p.valor) {
      onAlterarValorProvisorio(idStr, null);
    } else {
      onAlterarValorProvisorio(idStr, limpo);
    }
    setEditandoValorId(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        title={
          temHipotesesNesteBloco
            ? `⚡ Simulação ativa neste item (${propostasAtivas.length}/${propostas.length} propostas consideradas). Clique para ver/flexibilizar.`
            : `Ver as ${propostas.length} proposta(s) que somam neste item`
        }
        style={{
          width: '16px',
          height: '16px',
          minWidth: '16px',
          padding: 0,
          marginLeft: '6px',
          borderRadius: '50%',
          background: temHipotesesNesteBloco
            ? '#fef3c7'
            : propostas.length > 0
            ? '#e0f2fe'
            : '#f1f5f9',
          color: temHipotesesNesteBloco
            ? '#b45309'
            : propostas.length > 0
            ? '#0369a1'
            : '#94a3b8',
          border: `1px solid ${
            temHipotesesNesteBloco
              ? '#f59e0b'
              : propostas.length > 0
              ? '#bae6fd'
              : '#cbd5e1'
          }`,
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
            onClick={() => {
              setEditandoValorId(null);
              setAberto(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              /* zIndex 900000 permite que o Card Expandido do Kanban (9999999) abra por cima sem fechar este modal */
              zIndex: 900000,
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
                width: '94%',
                maxWidth: '880px',
                maxHeight: '88vh',
                borderRadius: '10px',
                borderTop: '5px solid #8B1530',
                boxShadow: '0 20px 45px rgba(0,0,0,0.38)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* CABEÇALHO DO MODAL */}
              <div
                style={{
                  padding: '14px 18px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '14.5px',
                      color: '#8B1530',
                      fontWeight: 800,
                    }}
                  >
                    🔎 COMPOSIÇÃO DO VALOR: {tituloLinha} ➔ {tituloColuna}
                  </h4>
                  <span style={{ fontSize: '11.5px', color: '#475569' }}>
                    Considerando <b>{propostasAtivas.length}</b> de{' '}
                    <b>{propostas.length}</b> proposta(s) • Soma Ativa:{' '}
                    <b style={{ color: '#15803d' }}>
                      R$ {formatarMoedaBD(totalSomadoAtivo)}
                    </b>
                    {totalSomadoAtivo !== totalOriginalSemCortes && (
                      <span style={{ marginLeft: '8px', color: '#b45309' }}>
                        (Original: R$ {formatarMoedaBD(totalOriginalSemCortes)})
                      </span>
                    )}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onToggleModoFlexivel(!mostrarCheckboxes)}
                    style={{
                      width: 'auto',
                      padding: '6px 12px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      background: mostrarCheckboxes ? '#8B1530' : '#fffbeb',
                      color: mostrarCheckboxes ? '#ffffff' : '#b45309',
                      border: `1px solid ${
                        mostrarCheckboxes ? '#8B1530' : '#fde68a'
                      }`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    title="Ativa/desativa as caixinhas de seleção para testar cenários hipotéticos de estoque"
                  >
                    🎛️ {mostrarCheckboxes ? 'Ocultar Marcadores' : 'Flexibilizar Estoque'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditandoValorId(null);
                      setAberto(false);
                    }}
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
              </div>

              {/* BARRA DE INSTRUÇÃO */}
              <div
                style={{
                  padding: '8px 18px',
                  background: mostrarCheckboxes ? '#fffbeb' : '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: '#475569' }}>
                  💡 Clique no botão <b style={{ color: '#8B1530' }}>(i)</b> ao lado do nome do cliente para abrir e editar o <b>Card Expandido do Kanban</b> por cima desta tela, ou dê <b>duplo clique</b> no valor para simular.
                </span>

                {mostrarCheckboxes && propostas.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleVariasPropostas(
                          propostas.map((p) => String(p.id)),
                          true
                        )
                      }
                      style={{
                        width: 'auto',
                        padding: '3px 9px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ☑ Marcar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleVariasPropostas(
                          propostas.map((p) => String(p.id)),
                          false
                        )
                      }
                      style={{
                        width: 'auto',
                        padding: '3px 9px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ☐ Desmarcar Todas
                    </button>
                  </div>
                )}
              </div>

              {/* TABELA DE PROPOSTAS */}
              <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
                {propostas.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: '#64748b',
                      fontSize: '12.5px',
                    }}
                  >
                    Nenhuma proposta enquadrada neste item no momento.
                  </div>
                ) : (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12px',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#f1f5f9',
                          textAlign: 'left',
                          color: '#334155',
                        }}
                      >
                        {mostrarCheckboxes && (
                          <th
                            style={{
                              padding: '8px',
                              borderBottom: '1px solid #cbd5e1',
                              width: '32px',
                              textAlign: 'center',
                            }}
                          >
                            ✓
                          </th>
                        )}
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1', width: '36px' }}>
                          #
                        </th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>
                          Cliente / CPF (Atalho Kanban)
                        </th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>
                          Tipo / Programa
                        </th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>
                          Projetista
                        </th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e1' }}>
                          Situação
                        </th>
                        <th
                          style={{
                            padding: '8px',
                            borderBottom: '1px solid #cbd5e1',
                            textAlign: 'right',
                            width: '165px',
                          }}
                        >
                          Valor (R$) ✏️
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {propostas.map((p, idx) => {
                        const idStr = String(p.id);
                        const estaConsiderada = !idsDesmarcadosSet.has(idStr);
                        const valorEfetivo = obterValorEfetivoStr(p);
                        const temValorCustom =
                          simulacao.valoresCustomizados?.[idStr] !== undefined;
                        const estaEditandoEste = editandoValorId === idStr;

                        return (
                          <tr
                            key={idStr || idx}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              opacity: estaConsiderada ? 1 : 0.48,
                              background: !estaConsiderada
                                ? '#f8fafc'
                                : temValorCustom
                                ? '#fffbeb'
                                : 'transparent',
                            }}
                          >
                            {mostrarCheckboxes && (
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={estaConsiderada}
                                  onChange={() => onToggleProposta(idStr)}
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    margin: 0,
                                    cursor: 'pointer',
                                    accentColor: '#15803d',
                                  }}
                                />
                              </td>
                            )}
                            <td
                              style={{
                                padding: '8px',
                                fontWeight: 700,
                                color: '#64748b',
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    textDecoration: estaConsiderada
                                      ? 'none'
                                      : 'line-through',
                                  }}
                                >
                                  {p.cliente}
                                </span>

                                {/* BOTÃO (i) DO CLIENTE: ABRE O CARD EXPANDIDO DO KANBAN POR CIMA DESTE MODAL */}
                                {onAbrirCardKanbanCliente && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAbrirCardKanbanCliente(p);
                                    }}
                                    title="Abrir Card Expandido do Kanban deste cliente por cima desta janela (Edição real no Kanban)"
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      minWidth: '18px',
                                      padding: 0,
                                      borderRadius: '50%',
                                      background: '#fdf2f4',
                                      color: '#8B1530',
                                      border: '1px solid #f5c2c7',
                                      fontSize: '10.5px',
                                      fontWeight: 800,
                                      fontFamily: 'serif',
                                      fontStyle: 'italic',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      lineHeight: 1,
                                      transform: 'none',
                                      boxShadow: '0 1px 2px rgba(139,21,48,0.12)',
                                    }}
                                  >
                                    i
                                  </button>
                                )}
                              </div>
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                {p.cpf || 'S/ CPF'} •{' '}
                                <b style={{ color: '#475569' }}>{p.porte}</b>
                              </div>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 700 }}>{p.tipo}</div>
                              {p.programa && (
                                <div style={{ fontSize: '10px', color: '#8B1530' }}>
                                  {p.programa}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px', fontSize: '11px' }}>
                              {p.projetista || '-'}
                            </td>
                            <td
                              style={{
                                padding: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              {p.situacao}
                            </td>
                            <td
                              onDoubleClick={() => iniciarEdicaoDuploClique(p)}
                              title="Dê duplo clique para alterar provisoriamente este valor na simulação"
                              style={{
                                padding: '8px',
                                textAlign: 'right',
                                fontWeight: 800,
                                color: temValorCustom ? '#b45309' : '#15803d',
                                cursor: 'pointer',
                                userSelect: 'none',
                              }}
                            >
                              {estaEditandoEste ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '4px',
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={valorTempInput}
                                    onChange={(e) =>
                                      setValorTempInput(
                                        aplicarMascaraMoedaInput(e.target.value)
                                      )
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') confirmarEdicaoValor(p);
                                      if (e.key === 'Escape') setEditandoValorId(null);
                                    }}
                                    onBlur={() => confirmarEdicaoValor(p)}
                                    autoFocus
                                    style={{
                                      width: '105px',
                                      height: '26px',
                                      fontSize: '11.5px',
                                      fontWeight: 800,
                                      textAlign: 'right',
                                      padding: '2px 6px',
                                      border: '1.5px solid #8B1530',
                                      borderRadius: '4px',
                                    }}
                                  />
                                </div>
                              ) : (
                                <div>
                                  <span>R$ {valorEfetivo}</span>
                                  {temValorCustom && (
                                    <div
                                      style={{
                                        fontSize: '9.5px',
                                        color: '#64748b',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Orig: R$ {p.valor}{' '}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onAlterarValorProvisorio(idStr, null);
                                        }}
                                        title="Restaurar valor original"
                                        style={{
                                          width: 'auto',
                                          padding: '0 4px',
                                          fontSize: '9.5px',
                                          background: '#fee2e2',
                                          color: '#b91c1c',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        ↺
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                        <td
                          colSpan={mostrarCheckboxes ? 6 : 5}
                          style={{
                            padding: '10px 8px',
                            textAlign: 'right',
                            color: '#1e293b',
                          }}
                        >
                          SOMA CONSIDERADA NESTE ITEM ({propostasAtivas.length} de{' '}
                          {propostas.length} propostas):
                        </td>
                        <td
                          style={{
                            padding: '10px 8px',
                            textAlign: 'right',
                            color: '#8B1530',
                            fontSize: '13px',
                          }}
                        >
                          R$ {formatarMoedaBD(totalSomadoAtivo)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* RODAPÉ */}
              <div
                style={{
                  padding: '10px 18px',
                  background: '#f1f5f9',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  🔒 As simulações de estoque ficam restritas a esta aba; já as edições feitas pelo botão <b>(i)</b> do cliente salvam diretamente no Kanban oficial.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoValorId(null);
                    setAberto(false);
                  }}
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