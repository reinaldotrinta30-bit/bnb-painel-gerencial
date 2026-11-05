'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DadosExtraidosSocioambientalKml,
  GlebaSocioambientalItem,
  processarArquivoKmlSocioambiental,
  extrairDadosPdfCertificacaoSocioambiental,
  sincronizarNomesKmlNasGlebas,
  avaliarConformidadeSocioambientalV98,
  parseFloatBR,
} from '@/lib/analisadorSocioambientalKml';

interface ModalVerificarConformidadeSocioambientalProps {
  aberto: boolean;
  onFechar: () => void;
  onAbrirFerramentaKml?: () => void;
}

const ESTADO_VAZIO: DadosExtraidosSocioambientalKml = {
  dataAnalise: '',
  areaCarHa: '',
  areaConsolidadaHa: '',
  areaConsolidadaPerc: '',
  pastagemTotalHa: '',
  pastagemTotalPerc: '',
  appHa: '',
  appPerc: '',
  reservaLegalHa: '',
  reservaLegalPerc: '',
  trabalhoEscravo: '',
  alertasAmbientais: '',
  embargosAmbientais: '',
  desmatamentoProdes: '',
  desmatamentoProdesObs: '',
  carContiguo: '',
  sobreposicaoOutrasPropriedades: '',
  possuiBlocoGlebasNoPdf: false,
  glebas: [],
  itensLidosDoKml: [],
  logsVerificacaoKml: [],
  kmlCorrigidoTexto: null,
};

export default function ModalVerificarConformidadeSocioambiental({
  aberto,
  onFechar,
  onAbrirFerramentaKml,
}: ModalVerificarConformidadeSocioambientalProps) {
  const [dados, setDados] =
    useState<DadosExtraidosSocioambientalKml>(ESTADO_VAZIO);
  const [nomeArquivoKml, setNomeArquivoKml] = useState('');
  const [nomeArquivoPdf, setNomeArquivoPdf] = useState('');
  const [nomeImovel, setNomeImovel] = useState('');
  const [areaImovelHa, setAreaImovelHa] = useState('');
  const [dataAquisicaoISO, setDataAquisicaoISO] = useState('');
  const [isentoAte4MfAntes2008, setIsentoAte4MfAntes2008] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Importador Inteligente: aceita selecionar o .KML e o .PDF juntos na mesma janela do Windows (ou separados)
  const handleImportarArquivos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessando(true);
    try {
      const arqKml = files.find((f) =>
        /\.(kml|kmz)$/i.test(f.name.toLowerCase())
      );
      const arqPdf = files.find((f) => /\.pdf$/i.test(f.name.toLowerCase()));

      let itensKmlAtuais = [...dados.itensLidosDoKml];
      let logsKmlAtuais = [...dados.logsVerificacaoKml];
      let kmlCorrigidoAtual = dados.kmlCorrigidoTexto;

      if (arqKml) {
        setNomeArquivoKml(arqKml.name);
        const resKml = await processarArquivoKmlSocioambiental(arqKml);
        itensKmlAtuais = resKml.itensEncontrados;
        logsKmlAtuais = resKml.logs;
        kmlCorrigidoAtual = resKml.kmlCorrigidoTexto;
      }

      if (arqPdf) {
        setNomeArquivoPdf(arqPdf.name);
        const extraidoPdf = await extrairDadosPdfCertificacaoSocioambiental(
          arqPdf,
          itensKmlAtuais
        );
        if (extraidoPdf.areaCarHa && !areaImovelHa) {
          setAreaImovelHa(extraidoPdf.areaCarHa);
        }
        setDados({
          ...extraidoPdf,
          itensLidosDoKml: itensKmlAtuais,
          logsVerificacaoKml: logsKmlAtuais,
          kmlCorrigidoTexto: kmlCorrigidoAtual,
        });
      } else if (arqKml) {
        // Se importou apenas o KML depois de já ter importado o PDF (ou antes do PDF)
        const glebasBase: GlebaSocioambientalItem[] =
          dados.glebas.length > 0
            ? dados.glebas.map((g, idx) => ({
                ...g,
                itemKml: itensKmlAtuais[idx] || g.itemKml,
              }))
            : itensKmlAtuais.map((itemNome, idx) => ({
                id: `gl_${idx + 1}_${Date.now()}`,
                nomeArea: `Area ${idx + 1}`,
                itemKml: itemNome,
                tamanhoHa: '',
                percentualNoCar: '100,00%',
                possuiSobreposicao: 'NÃO',
                sobreposicoesDetalhe: [],
              }));

        setDados(
          sincronizarNomesKmlNasGlebas({
            ...dados,
            glebas: glebasBase,
            itensLidosDoKml: itensKmlAtuais,
            logsVerificacaoKml: logsKmlAtuais,
            kmlCorrigidoTexto: kmlCorrigidoAtual,
          })
        );
      }
    } catch (err) {
      console.error('Erro ao analisar KML/Certificação:', err);
      alert('❌ Erro ao ler os arquivos selecionados.');
    } finally {
      setProcessando(false);
      e.target.value = '';
    }
  };

  const baixarKmlCorrigido = () => {
    if (!dados.kmlCorrigidoTexto) return;
    const blob = new Blob([dados.kmlCorrigidoTexto], {
      type: 'application/vnd.google-earth.kml+xml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(nomeImovel || nomeArquivoKml || 'PROJETO').replace(
      /\.kml$/i,
      ''
    )}_KML_Corrigido.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const diagnostico = useMemo(
    () =>
      avaliarConformidadeSocioambientalV98({
        dados,
        areaImovelHa: areaImovelHa || dados.areaCarHa,
        dataAquisicaoISO,
        forcarAte4ModulosAntes2008: isentoAte4MfAntes2008,
      }),
    [dados, areaImovelHa, dataAquisicaoISO, isentoAte4MfAntes2008]
  );

  if (!aberto || typeof document === 'undefined') return null;

  const numAreaImovel = parseFloatBR(areaImovelHa || dados.areaCarHa);

  const inputStyle: React.CSSProperties = {
    height: '32px',
    padding: '4px 8px',
    fontSize: '11.5px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    width: '100%',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.76)',
        zIndex: 940000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#f8fafc',
          width: '96vw',
          maxWidth: '1380px',
          height: '94vh',
          borderRadius: '12px',
          boxShadow: '0 25px 55px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #004C27',
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '12px 22px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '15.5px',
                color: '#004C27',
                fontWeight: 800,
              }}
            >
              🌿 VERIFICADOR DE CONFORMIDADE SOCIOAMBIENTAL & CRUZAMENTO KML
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Importe o <b>.KML</b> do projeto e o <b>.PDF</b> da Certificação
              Socioambiental para auditar Reserva Legal (16%), APP, PRODES,
              Trabalho Escravo, Embargos e Glebas.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onAbrirFerramentaKml && (
              <button
                type="button"
                onClick={onAbrirFerramentaKml}
                style={{
                  width: 'auto',
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  background: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                🗺️ Abrir Editor Geodésico de KML (Mapa)
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDados(ESTADO_VAZIO);
                setNomeArquivoKml('');
                setNomeArquivoPdf('');
              }}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              🗑️ Limpar Análise
            </button>

            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0 6px',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* BARRA DE IMPORTAÇÃO DE ARQUIVOS (.KML + .PDF) E REGRAS DO IMÓVEL */}
        <div
          style={{
            margin: '12px 20px 0 20px',
            padding: '12px 16px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderLeft: '5px solid #004C27',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '36px',
                  padding: '0 18px',
                  background: '#004C27',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  margin: 0,
                  boxShadow: '0 2px 6px rgba(0, 76, 39, 0.25)',
                }}
              >
                {processando
                  ? '⏳ Extraindo e Cruzando Dados...'
                  : '📂 Importar KML + PDF da Certificação Socioambiental'}
                <input
                  type="file"
                  accept=".kml,.kmz,.pdf"
                  multiple
                  onChange={handleImportarArquivos}
                  style={{ display: 'none' }}
                />
              </label>

              {nomeArquivoKml && (
                <span
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #86efac',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  🗺️ KML: {nomeArquivoKml} ({dados.itensLidosDoKml.length}{' '}
                  glebas)
                </span>
              )}

              {nomeArquivoPdf && (
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  📄 PDF: {nomeArquivoPdf}{' '}
                  {dados.possuiBlocoGlebasNoPdf
                    ? '(Com Glebas/KML)'
                    : '(Sem Glebas / Garantia)'}
                </span>
              )}

              {dados.kmlCorrigidoTexto && (
                <button
                  type="button"
                  onClick={baixarKmlCorrigido}
                  style={{
                    width: 'auto',
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  📥 Baixar KML Corrigido (Polígonos Fechados)
                </button>
              )}
            </div>

            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
              💡 Dica: Pode selecionar o arquivo <b>.KML</b> e o <b>.PDF</b>{' '}
              juntos segurando a tecla <b>Ctrl</b> na janela!
            </span>
          </div>

          {/* PARÂMETROS DO IMÓVEL (4 MÓDULOS FISCAIS E DATA DE AQUISIÇÃO 22/07/2008) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 0.9fr 1fr 0.9fr 1.6fr',
              gap: '10px',
              alignItems: 'end',
              paddingTop: '8px',
              borderTop: '1px dashed #e2e8f0',
            }}
          >
            <div>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                🏡 Nome do Imóvel Analisado
              </label>
              <input
                type="text"
                value={nomeImovel}
                onChange={(e) => setNomeImovel(e.target.value.toUpperCase())}
                placeholder="Ex: FAZENDA SÃO JOSÉ"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                📅 Data da Análise (PDF)
              </label>
              <input
                type="date"
                value={dados.dataAnalise}
                onChange={(e) =>
                  setDados({ ...dados, dataAnalise: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                📐 Área do Imóvel / CAR (ha){' '}
                {numAreaImovel > 0 && (
                  <span
                    style={{
                      color: numAreaImovel <= 240 ? '#15803d' : '#b45309',
                      fontWeight: 800,
                    }}
                  >
                    ({numAreaImovel <= 240 ? '≤ 4 MF' : '> 4 MF'})
                  </span>
                )}
              </label>
              <input
                type="text"
                value={areaImovelHa || dados.areaCarHa}
                onChange={(e) => {
                  setAreaImovelHa(e.target.value);
                  setDados({ ...dados, areaCarHa: e.target.value });
                }}
                placeholder="Ex: 120,50"
                style={{ ...inputStyle, fontWeight: 700 }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                📜 Data Aquisição Imóvel
              </label>
              <input
                type="date"
                value={dataAquisicaoISO}
                onChange={(e) => setDataAquisicaoISO(e.target.value)}
                style={inputStyle}
              />
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#15803d',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '6px 10px',
                borderRadius: '6px',
                height: '32px',
                cursor: 'pointer',
                margin: 0,
              }}
            >
              <input
                type="checkbox"
                checked={isentoAte4MfAntes2008}
                onChange={(e) => setIsentoAte4MfAntes2008(e.target.checked)}
                style={{
                  width: '14px',
                  height: '14px',
                  margin: 0,
                  accentColor: '#15803d',
                }}
              />
              Até 4 MF adquirido antes de 22/07/2008 (Isento RL 16%)
            </label>
          </div>
        </div>

        {/* CORPO PRINCIPAL EM 2 COLUNAS */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr',
            gap: '14px',
            padding: '12px 20px 18px 20px',
            overflow: 'hidden',
          }}
        >
          {/* COLUNA ESQUERDA: QUADRO DE ÁREAS, RISCOS E GLEBAS DO V98 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {/* 1. ÁREAS E PERCENTUAIS DO CAR */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <strong
                style={{
                  fontSize: '12px',
                  color: '#004C27',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                📊 1. ÁREAS E PERCENTUAIS EXTRAÍDOS DA CERTIFICAÇÃO (SOBRE O
                CAR)
              </strong>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#334155',
                    }}
                  >
                    Área Consolidada (ha / %)
                  </label>
                  <div
                    style={{ display: 'flex', gap: '4px', marginTop: '4px' }}
                  >
                    <input
                      type="text"
                      value={dados.areaConsolidadaHa}
                      onChange={(e) =>
                        setDados({
                          ...dados,
                          areaConsolidadaHa: e.target.value,
                        })
                      }
                      placeholder="ha"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={dados.areaConsolidadaPerc}
                      onChange={(e) =>
                        setDados({
                          ...dados,
                          areaConsolidadaPerc: e.target.value,
                        })
                      }
                      placeholder="%"
                      style={{ ...inputStyle, fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#334155',
                    }}
                  >
                    Pastagem Total (ha / %)
                  </label>
                  <div
                    style={{ display: 'flex', gap: '4px', marginTop: '4px' }}
                  >
                    <input
                      type="text"
                      value={dados.pastagemTotalHa}
                      onChange={(e) =>
                        setDados({ ...dados, pastagemTotalHa: e.target.value })
                      }
                      placeholder="ha"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={dados.pastagemTotalPerc}
                      onChange={(e) =>
                        setDados({
                          ...dados,
                          pastagemTotalPerc: e.target.value,
                        })
                      }
                      placeholder="%"
                      style={{ ...inputStyle, fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#334155',
                    }}
                  >
                    APP Preservação (ha / %)
                  </label>
                  <div
                    style={{ display: 'flex', gap: '4px', marginTop: '4px' }}
                  >
                    <input
                      type="text"
                      value={dados.appHa}
                      onChange={(e) =>
                        setDados({ ...dados, appHa: e.target.value })
                      }
                      placeholder="ha"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={dados.appPerc}
                      onChange={(e) =>
                        setDados({ ...dados, appPerc: e.target.value })
                      }
                      placeholder="%"
                      style={{ ...inputStyle, fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: '#f0fdf4',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                  }}
                >
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#166534',
                    }}
                  >
                    Reserva Legal (ha / % CAR)
                  </label>
                  <div
                    style={{ display: 'flex', gap: '4px', marginTop: '4px' }}
                  >
                    <input
                      type="text"
                      value={dados.reservaLegalHa}
                      onChange={(e) =>
                        setDados({ ...dados, reservaLegalHa: e.target.value })
                      }
                      placeholder="ha"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={dados.reservaLegalPerc}
                      onChange={(e) =>
                        setDados({ ...dados, reservaLegalPerc: e.target.value })
                      }
                      placeholder="% RL"
                      style={{
                        ...inputStyle,
                        fontWeight: 800,
                        color: '#166534',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. APONTAMENTOS E RISCOS AMBIENTAIS / SOCIAIS */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <strong
                style={{
                  fontSize: '12px',
                  color: '#8B1530',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                🚨 2. APONTAMENTOS DE RISCO SOCIOAMBIENTAL (TRABALHO ESCRAVO,
                PRODES, EMBARGOS E SOBREPOSIÇÕES)
              </strong>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                }}
              >
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                    Trabalho Escravo?
                  </label>
                  <select
                    value={dados.trabalhoEscravo}
                    onChange={(e) =>
                      setDados({
                        ...dados,
                        trabalhoEscravo: e.target.value as any,
                      })
                    }
                    style={{
                      ...inputStyle,
                      fontWeight: 800,
                      color:
                        dados.trabalhoEscravo === 'SIM' ? '#b91c1c' : '#15803d',
                    }}
                  >
                    <option value="">Selecione...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM (Impedimento)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                    Alertas Ambientais?
                  </label>
                  <select
                    value={dados.alertasAmbientais}
                    onChange={(e) =>
                      setDados({
                        ...dados,
                        alertasAmbientais: e.target.value as any,
                      })
                    }
                    style={{
                      ...inputStyle,
                      fontWeight: 800,
                      color:
                        dados.alertasAmbientais === 'SIM'
                          ? '#b91c1c'
                          : '#15803d',
                    }}
                  >
                    <option value="">Selecione...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM (Impedimento)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                    Embargos Identificados?
                  </label>
                  <select
                    value={dados.embargosAmbientais}
                    onChange={(e) =>
                      setDados({
                        ...dados,
                        embargosAmbientais: e.target.value as any,
                      })
                    }
                    style={{
                      ...inputStyle,
                      fontWeight: 800,
                      color:
                        dados.embargosAmbientais === 'SIM'
                          ? '#b91c1c'
                          : '#15803d',
                    }}
                  >
                    <option value="">Selecione...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM (Impedimento)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                    Desmatamento PRODES?
                  </label>
                  <select
                    value={dados.desmatamentoProdes}
                    onChange={(e) =>
                      setDados({
                        ...dados,
                        desmatamentoProdes: e.target.value as any,
                      })
                    }
                    style={{
                      ...inputStyle,
                      fontWeight: 800,
                      color:
                        dados.desmatamentoProdes === 'SIM'
                          ? '#b91c1c'
                          : '#15803d',
                    }}
                  >
                    <option value="">Selecione...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM (Após 31/07/2019)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                    CAR Contíguo Identificado?
                  </label>
                  <select
                    value={dados.carContiguo}
                    onChange={(e) =>
                      setDados({ ...dados, carContiguo: e.target.value as any })
                    }
                    style={{ ...inputStyle, fontWeight: 700 }}
                  >
                    <option value="">Selecione...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                    Sobreposição c/ Outros Imóveis?
                  </label>
                  <select
                    value={dados.sobreposicaoOutrasPropriedades}
                    onChange={(e) =>
                      setDados({
                        ...dados,
                        sobreposicaoOutrasPropriedades: e.target.value as any,
                      })
                    }
                    style={{
                      ...inputStyle,
                      fontWeight: 800,
                      color:
                        dados.sobreposicaoOutrasPropriedades ===
                        'SIM E COM RESTRIÇÕES'
                          ? '#b91c1c'
                          : dados.sobreposicaoOutrasPropriedades.startsWith(
                              'SIM'
                            )
                          ? '#b45309'
                          : '#15803d',
                    }}
                  >
                    <option value="">Selecione...</option>
                    <option value="NÃO">NÃO</option>
                    <option value="SIM, MAS SEM RESTRIÇÕES IDENTIFICADAS">
                      SIM, MAS SEM RESTRIÇÕES IDENTIFICADAS
                    </option>
                    <option value="SIM E COM RESTRIÇÕES">
                      SIM E COM RESTRIÇÕES
                    </option>
                  </select>
                </div>
              </div>

              {dados.desmatamentoProdes === 'SIM' && (
                <div style={{ marginTop: '8px' }}>
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#b91c1c',
                    }}
                  >
                    Observação do Desmatamento PRODES Extraída:
                  </label>
                  <input
                    type="text"
                    value={dados.desmatamentoProdesObs}
                    onChange={(e) =>
                      setDados({
                        ...dados,
                        desmatamentoProdesObs: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            {/* 3. TABELA DE GLEBAS SINCRONIZADAS (KML x CERTIFICAÇÃO) */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <strong style={{ fontSize: '12px', color: '#004C27' }}>
                  🚜 3. ANÁLISE DAS GLEBAS DO PROJETO (KML × CERTIFICAÇÃO
                  SOCIOAMBIENTAL) ({dados.glebas.length})
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    const novaGl: GlebaSocioambientalItem = {
                      id: `gl_${Date.now()}`,
                      nomeArea: `Area ${dados.glebas.length + 1}`,
                      itemKml: '',
                      tamanhoHa: '',
                      percentualNoCar: '100,00%',
                      possuiSobreposicao: 'NÃO',
                      sobreposicoesDetalhe: [],
                    };
                    setDados(
                      sincronizarNomesKmlNasGlebas({
                        ...dados,
                        glebas: [...dados.glebas, novaGl],
                      })
                    );
                  }}
                  style={{
                    width: 'auto',
                    height: '28px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  + Adicionar Gleba
                </button>
              </div>

              {dados.glebas.length === 0 ? (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#64748b',
                    padding: '16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '6px',
                  }}
                >
                  Importe o <b>.KML</b> e o <b>.PDF</b> acima (ou clique em
                  &ldquo;+ Adicionar Gleba&rdquo;) para auditar o percentual no
                  CAR e as sobreposições de cada área.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {dados.glebas.map((gl, idxG) => (
                    <div
                      key={gl.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 10px',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '1fr 1.6fr 0.8fr 0.8fr 0.8fr auto',
                          gap: '8px',
                          alignItems: 'end',
                        }}
                      >
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700 }}>
                            Gleba (PDF)
                          </label>
                          <input
                            type="text"
                            value={gl.nomeArea}
                            onChange={(e) => {
                              const novas = [...dados.glebas];
                              novas[idxG] = {
                                ...novas[idxG],
                                nomeArea: e.target.value,
                              };
                              setDados(
                                sincronizarNomesKmlNasGlebas({
                                  ...dados,
                                  glebas: novas,
                                })
                              );
                            }}
                            style={{ ...inputStyle, fontWeight: 700 }}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#004C27',
                            }}
                          >
                            Item Sincronizado (KML)
                          </label>
                          <input
                            type="text"
                            value={gl.itemKml}
                            onChange={(e) => {
                              const novas = [...dados.glebas];
                              novas[idxG] = {
                                ...novas[idxG],
                                itemKml: e.target.value,
                              };
                              setDados(
                                sincronizarNomesKmlNasGlebas({
                                  ...dados,
                                  glebas: novas,
                                })
                              );
                            }}
                            placeholder="Ex: PASTAGEM, CERCA, CURRAL..."
                            style={{ ...inputStyle, fontWeight: 800 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700 }}>
                            Área (ha)
                          </label>
                          <input
                            type="text"
                            value={gl.tamanhoHa}
                            onChange={(e) => {
                              const novas = [...dados.glebas];
                              novas[idxG] = {
                                ...novas[idxG],
                                tamanhoHa: e.target.value,
                              };
                              setDados({ ...dados, glebas: novas });
                            }}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700 }}>
                            % no CAR
                          </label>
                          <input
                            type="text"
                            value={gl.percentualNoCar}
                            onChange={(e) => {
                              const novas = [...dados.glebas];
                              novas[idxG] = {
                                ...novas[idxG],
                                percentualNoCar: e.target.value,
                              };
                              setDados({ ...dados, glebas: novas });
                            }}
                            style={{
                              ...inputStyle,
                              fontWeight: 800,
                              color:
                                parseFloatBR(gl.percentualNoCar) < 100
                                  ? '#b91c1c'
                                  : '#15803d',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700 }}>
                            Sobreposição?
                          </label>
                          <select
                            value={gl.possuiSobreposicao}
                            onChange={(e) => {
                              const val = e.target.value as 'NÃO' | 'SIM';
                              const novas = [...dados.glebas];
                              novas[idxG] = {
                                ...novas[idxG],
                                possuiSobreposicao: val,
                                sobreposicoesDetalhe:
                                  val === 'SIM' &&
                                  novas[idxG].sobreposicoesDetalhe.length === 0
                                    ? ['']
                                    : novas[idxG].sobreposicoesDetalhe,
                              };
                              setDados({ ...dados, glebas: novas });
                            }}
                            style={inputStyle}
                          >
                            <option value="NÃO">NÃO</option>
                            <option value="SIM">SIM</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const novas = dados.glebas.filter(
                              (_, i) => i !== idxG
                            );
                            setDados({ ...dados, glebas: novas });
                          }}
                          style={{
                            width: 'auto',
                            height: '32px',
                            padding: '0 8px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      </div>

                      {(gl.possuiSobreposicao === 'SIM' ||
                        gl.sobreposicoesDetalhe.length > 0) && (
                        <div
                          style={{
                            marginTop: '8px',
                            paddingLeft: '10px',
                            borderLeft: '3px solid #f59e0b',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          {gl.sobreposicoesDetalhe.map((sobTxt, idxS) => {
                            const qtdLinhas = Math.max(
                              2,
                              sobTxt.split('\n').length
                            );
                            return (
                              <div
                                key={idxS}
                                style={{
                                  display: 'flex',
                                  gap: '6px',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <textarea
                                  rows={qtdLinhas}
                                  value={sobTxt}
                                  ref={(el) => {
                                    if (el) {
                                      el.style.height = 'auto';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                  onChange={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                    const novas = [...dados.glebas];
                                    const dets = [
                                      ...novas[idxG].sobreposicoesDetalhe,
                                    ];
                                    dets[idxS] = e.target.value;
                                    novas[idxG] = {
                                      ...novas[idxG],
                                      sobreposicoesDetalhe: dets,
                                    };
                                    setDados({ ...dados, glebas: novas });
                                  }}
                                  placeholder="Descreva a sobreposição (Área sobreposta, ha e %)"
                                  style={{
                                    flex: 1,
                                    width: '100%',
                                    minHeight: '38px',
                                    height: 'auto',
                                    overflow: 'hidden',
                                    resize: 'none',
                                    lineHeight: '1.45',
                                    fontSize: '11.5px',
                                    fontFamily: 'inherit',
                                    padding: '6px 10px',
                                    borderRadius: '5px',
                                    border: '1px solid #f59e0b',
                                    background: '#fffbeb',
                                    color: '#78350f',
                                    fontWeight: 600,
                                    boxSizing: 'border-box',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const novas = [...dados.glebas];
                                    const dets = novas[
                                      idxG
                                    ].sobreposicoesDetalhe.filter(
                                      (_, i) => i !== idxS
                                    );
                                    novas[idxG] = {
                                      ...novas[idxG],
                                      sobreposicoesDetalhe: dets,
                                      possuiSobreposicao:
                                        dets.length === 0 ? 'NÃO' : 'SIM',
                                    };
                                    setDados({ ...dados, glebas: novas });
                                  }}
                                  title="Remover este detalhe de sobreposição"
                                  style={{
                                    width: 'auto',
                                    height: '28px',
                                    padding: '0 8px',
                                    fontSize: '11px',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✖
                                </button>
                              </div>
                            );
                          })}

                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                const novas = [...dados.glebas];
                                novas[idxG] = {
                                  ...novas[idxG],
                                  possuiSobreposicao: 'SIM',
                                  sobreposicoesDetalhe: [
                                    ...novas[idxG].sobreposicoesDetalhe,
                                    '',
                                  ],
                                };
                                setDados({ ...dados, glebas: novas });
                              }}
                              style={{
                                width: 'auto',
                                padding: '3px 10px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                background: 'transparent',
                                color: '#b45309',
                                border: '1px dashed #f59e0b',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              + Adicionar Detalhe de Sobreposição / Restrição
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: DIAGNÓSTICO DE CONFORMIDADE GERAL + LOG GEODÉSICO DO KML */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
            }}
          >
            {/* QUADRO DE RESULTADO GERAL (IDÊNTICO AO V98) */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                borderTop: `5px solid ${
                  diagnostico.statusGeral === 'IMPEDIMENTO'
                    ? '#dc2626'
                    : diagnostico.statusGeral === 'APROVADO' ||
                      diagnostico.statusGeral === 'APROVADO_COM_RESSALVAS'
                    ? '#16a34a'
                    : '#64748b'
                }`,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                  ⚖️ DIAGNÓSTICO DE CONFORMIDADE SOCIOAMBIENTAL
                </strong>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background:
                      diagnostico.statusGeral === 'IMPEDIMENTO'
                        ? '#fef2f2'
                        : diagnostico.statusGeral.startsWith('APROVADO')
                        ? '#dcfce7'
                        : '#f1f5f9',
                    color:
                      diagnostico.statusGeral === 'IMPEDIMENTO'
                        ? '#b91c1c'
                        : diagnostico.statusGeral.startsWith('APROVADO')
                        ? '#15803d'
                        : '#475569',
                  }}
                >
                  {diagnostico.statusGeral === 'IMPEDIMENTO'
                    ? '🚨 NÃO CONFORME / IMPEDIMENTO'
                    : diagnostico.statusGeral === 'APROVADO_COM_RESSALVAS'
                    ? '✅ EM CONFORMIDADE (COM JUSTIFICATIVAS)'
                    : diagnostico.statusGeral === 'APROVADO'
                    ? '✅ 100% EM CONFORMIDADE'
                    : '⏳ AGUARDANDO IMPORTAÇÃO'}
                </span>
              </div>

              {diagnostico.errosCriticos.length > 0 && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '10px 12px',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '11.5px',
                      color: '#991b1b',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    🚨 NÃO CONFORMIDADES / IMPEDIMENTOS CRÍTICOS (
                    {diagnostico.errosCriticos.length}):
                  </strong>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '11.5px',
                      color: '#7f1d1d',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {diagnostico.errosCriticos.map((er, i) => (
                      <li key={i} style={{ fontWeight: 700 }}>
                        {er}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {diagnostico.justificativasERessalvas.length > 0 && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <strong style={{ fontSize: '11.5px', color: '#166534' }}>
                      ✅ JUSTIFICATIVAS AUTOMÁTICAS & EXIGÊNCIAS DOCUMENTAIS:
                    </strong>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          diagnostico.justificativasERessalvas.join('\n\n')
                        );
                        alert('📋 Justificativas copiadas!');
                      }}
                      style={{
                        width: 'auto',
                        padding: '3px 8px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        background: '#ffffff',
                        color: '#166534',
                        border: '1px solid #86efac',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      📋 Copiar Justificativas
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={Math.min(
                      10,
                      diagnostico.justificativasERessalvas.length * 2 + 2
                    )}
                    value={diagnostico.justificativasERessalvas.join('\n\n')}
                    style={{
                      width: '100%',
                      fontSize: '11.5px',
                      padding: '8px',
                      borderRadius: '5px',
                      border: '1px solid #bbf7d0',
                      background: '#ffffff',
                      color: '#14532d',
                      fontWeight: 600,
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
            </div>

            {/* LOG DO VERIFICADOR GEODÉSICO DE POLÍGONOS DO KML */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                borderTop: '4px solid #D99700',
                padding: '12px 14px',
              }}
            >
              <strong
                style={{
                  fontSize: '12px',
                  color: '#92400e',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                🗺️ AUDITORIA GEOMÉTRICA DOS POLÍGONOS DO KML (
                {dados.logsVerificacaoKml.length})
              </strong>
              {dados.logsVerificacaoKml.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Nenhum arquivo KML importado ainda.
                </span>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {dados.logsVerificacaoKml.map((lg, i) => {
                    const foiCorrigido = lg.includes('[CORRIGIDO]');
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '5px 8px',
                          borderRadius: '5px',
                          background: foiCorrigido ? '#fffbeb' : '#f0fdf4',
                          color: foiCorrigido ? '#b45309' : '#166534',
                          border: `1px solid ${
                            foiCorrigido ? '#fde68a' : '#bbf7d0'
                          }`,
                        }}
                      >
                        {lg}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}