'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
import { aplicarMascaraCPF, aplicarMascaraMoedaInput } from '@/lib/utils';
import ModalComparadorMoldeDocx from '@/components/documentos/ModalComparadorMoldeDocx';
import {
  gerarDocumentoWordPeloMolde,
  gerarDocumentoPdfPeloMolde,
  baixarMoldeOriginalParaEdicao,
  salvarMoldeCustomizadoNoSistema,
  removerMoldeCustomizadoDoSistema,
  possuiMoldeCustomizadoSalvo,
} from '@/lib/motorWordDocx';
import {
  MOLDE_PROTOCOLO_PLANTA_BASE64,
  MOLDE_SOLICITACAO_PLANTA_BASE64,
} from '@/components/documentos/moldesBase64Originais';
import LabelComInfo from '@/components/documentos/LabelComInfo';
import { DadosIniciaisClienteDoc } from '@/components/documentos/ModalConsolidadaRural';

interface ModalRenovacaoPlantaProps {
  aberto: boolean;
  modalidade: 'PROTOCOLO' | 'SOLICITACAO' | null;
  onFechar: () => void;
  contratacoes?: RegistroContratacao[];
  clienteInicial?: DadosIniciaisClienteDoc | null;
}

interface ImovelPlantaItem {
  id: string;
  nomedoimovelbeneficiado: string;
  coordenadalatitude: string;
  coordenadalongitude: string;
  cidade_ufdoimovel: string;
}

interface OpAtivaPlantaItem {
  id: string;
  banco: string;
  dt: string;
  tipo: string;
  v_ct: string;
  v_sd: string;
  fonte: string;
  pronaf: string;
}

function obterDataExtensoHoje(): string {
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const d = new Date();
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function obterDataAbreviadaHoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
}

export default function ModalRenovacaoPlanta({
  aberto,
  modalidade,
  onFechar,
  contratacoes = [],
  clienteInicial = null,
}: ModalRenovacaoPlantaProps) {
  const isProtocolo = modalidade === 'PROTOCOLO';
  const chaveMolde = isProtocolo ? 'PLANTA_PROTOCOLO' : 'PLANTA_SOLICITACAO';
  const caminhoPublicDocx = isProtocolo
    ? '/moldes-word/protocolo-planta-nordeste.docx'
    : '/moldes-word/solicitacao-planta-nordeste.docx';
  const base64Fallback = isProtocolo
    ? MOLDE_PROTOCOLO_PLANTA_BASE64
    : MOLDE_SOLICITACAO_PLANTA_BASE64;

  const [temMoldeCustom, setTemMoldeCustom] = useState(false);
  const inputUploadMoldeRef = useRef<HTMLInputElement>(null);

  const [clienteBusca, setClienteBusca] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [estadocivil, setEstadocivil] = useState('CASADO(A)');
  const [tipodedoc, setTipodedoc] = useState('RG');
  const [numdodoc, setNumdodoc] = useState('');
  const [emissorUf, setEmissorUf] = useState('SSP - MA');
  const [dataemissaododoc, setDataemissaododoc] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cep, setCep] = useState('');
  const [profissao, setProfissao] = useState('PRODUTOR RURAL');

  const [numerodaccb, setNumerodaccb] = useState('');
  const [valordapropostaoriginal, setValordapropostaoriginal] = useState('');
  const [dtEmissaoCcb, setDtEmissaoCcb] = useState('');
  const [datadoCET, setDatadoCET] = useState(() => obterDataAbreviadaHoje());
  const [dataExtenso, setDataExtenso] = useState(() => obterDataExtensoHoje());

  const [novovalorfinanciado, setNovovalorfinanciado] = useState('');
  const [safra, setSafra] = useState('2026/2027');
  const [tipoAtividade, setTipoAtividade] = useState('BOVINOCULTURA DE CORTE');

  const [comparadorAberto, setComparadorAberto] = useState(false);
  const [arquivoComparacao, setArquivoComparacao] = useState<File | null>(null);
  const inputCompararMoldeRef = useRef<HTMLInputElement>(null);

  const [imoveis, setImoveis] = useState<ImovelPlantaItem[]>([
    {
      id: 'imp_1',
      nomedoimovelbeneficiado: '',
      coordenadalatitude: '',
      coordenadalongitude: '',
      cidade_ufdoimovel: 'SANTA INÊS - MA',
    },
  ]);
  const [opsAtivas, setOpsAtivas] = useState<OpAtivaPlantaItem[]>([]);

  useEffect(() => {
    if (aberto && modalidade) {
      setTemMoldeCustom(possuiMoldeCustomizadoSalvo(chaveMolde));
      setDatadoCET(obterDataAbreviadaHoje());
      setDataExtenso(obterDataExtensoHoje());

      if (clienteInicial) {
        const nIni = (clienteInicial.nome || '').toUpperCase().trim();
        const cIni = clienteInicial.cpf || '';
        setNome(nIni);
        setCpf(cIni);
        setClienteBusca(nIni ? `${nIni} (${cIni || 'S/ CPF'})` : '');
        if (clienteInicial.valor) {
          setValordapropostaoriginal(clienteInicial.valor);
          setNovovalorfinanciado(clienteInicial.valor);
        }
      }
    }
  }, [aberto, modalidade, chaveMolde, clienteInicial]);

  const clientesUnicosCarteira = useMemo(() => {
    const mapa = new Map<string, RegistroContratacao>();
    contratacoes.forEach((r) => {
      const ch = (r.cpf || r.cliente || '').trim();
      if (ch && !mapa.has(ch)) mapa.set(ch, r);
    });
    return Array.from(mapa.values());
  }, [contratacoes]);

  const selecionarClienteDaCarteira = (termo: string) => {
    setClienteBusca(termo);
    const achado = contratacoes.find(
      (r) =>
        `${r.cliente} (${r.cpf || 'S/ CPF'})` === termo ||
        r.cliente.toUpperCase() === termo.toUpperCase().trim()
    );
    if (achado) {
      setNome(achado.cliente.toUpperCase());
      setCpf(achado.cpf || '');
      if (achado.valor) {
        setValordapropostaoriginal(achado.valor);
        setNovovalorfinanciado(achado.valor);
      }
    }
  };

  if (!aberto || !modalidade || typeof document === 'undefined') return null;

  const handleUploadNovoMolde = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await salvarMoldeCustomizadoNoSistema(chaveMolde, file, caminhoPublicDocx);
      setTemMoldeCustom(true);
      alert(`✅ Novo molde Word (${file.name}) salvo com sucesso!`);
    } catch {
      alert('❌ Erro ao ler o arquivo .docx.');
    }
    e.target.value = '';
  };

  const montarPacoteDados = () => {
    const temOps = opsAtivas.length > 0;

    const dadosWord: Record<string, unknown> = {
      nome: nome.toUpperCase().trim() || '[NOME]',
      cpf: cpf || '[CPF]',
      tipodedoc: tipodedoc.toUpperCase(),
      numdodoc: numdodoc || '[Nº DOC]',
      emissor_uf: emissorUf.toUpperCase(),
      dataemissaododoc: dataemissaododoc || '',
      estadocivil: estadocivil.toUpperCase(),
      enderecocompletotitular: endereco.toUpperCase(),
      cep: cep || '',
      profissao: profissao.toUpperCase(),

      datadoCET,
      numerodaccb: numerodaccb || '[Nº CCB]',
      valordapropostaoriginal: valordapropostaoriginal || '0,00',
      datadeemissaoporextenso: dtEmissaoCcb,
      datadeemissaoabreviada: dtEmissaoCcb,
      data_extenso: dataExtenso,

      novovalorfinanciado: novovalorfinanciado || valordapropostaoriginal || '0,00',
      safra: safra || '2026/2027',
      TIPODEATIVIDADE: tipoAtividade.toUpperCase(),

      imoveis: imoveis.map((im) => ({
        nomedoimovelbeneficiado: im.nomedoimovelbeneficiado.toUpperCase(),
        coordenadalatitude: im.coordenadalatitude,
        coordenadalongitude: im.coordenadalongitude,
        cidade_ufdoimovel: im.cidade_ufdoimovel.toUpperCase(),
      })),
      ops_ativas: opsAtivas,
      ops_proagro: [],

      chk_op_nao: temOps ? ' ' : 'X',
      chk_ops_sim: temOps ? 'X' : ' ',
      chk_pro_nao: 'X',
      chk_proagro_nao: 'X',
      chk_pro_sim: ' ',
      chk_proagro_sim: ' ',
    };

    const partesNome = (nome || 'CLIENTE').trim().toUpperCase().split(/\s+/);
    const doisPrimeiros = partesNome.slice(0, 2).join(' ');
    const prefixo = isProtocolo
      ? 'PROTOCOLO PLANTA NORDESTE'
      : 'SOLICITACAO PLANTA NORDESTE';
    const nomeArq = `${prefixo} - ${doisPrimeiros}.docx`;

    return { dadosWord, nomeArq };
  };

  const handleGerarDocumento = async (formato: 'DOCX' | 'PDF') => {
    const { dadosWord, nomeArq } = montarPacoteDados();
    try {
      if (formato === 'PDF') {
        await gerarDocumentoPdfPeloMolde({
          chaveMolde,
          caminhoPublicDocx,
          base64Fallback,
          dados: dadosWord,
          nomeArquivoSaida: nomeArq,
        });
      } else {
        await gerarDocumentoWordPeloMolde({
          chaveMolde,
          caminhoPublicDocx,
          base64Fallback,
          dados: dadosWord,
          nomeArquivoSaida: nomeArq,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert('⚠️ Atenção:\n\n' + msg);
    }
  };

  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        zIndex: 20000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '94%',
          maxWidth: '900px',
          maxHeight: '92vh',
          borderRadius: '12px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #8B1530',
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '14px 20px',
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
            <h3 style={{ margin: 0, fontSize: '15px', color: '#8B1530', fontWeight: 800 }}>
              🌾 RENOVAÇÃO PLANTA NORDESTE —{' '}
              {isProtocolo ? 'PROTOCOLO' : 'SOLICITAÇÃO DE RENOVAÇÃO'}
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {temMoldeCustom
                ? '🟢 Usando Molde .DOCX atualizado por você'
                : '⚪ Usando Molde .DOCX padrão'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <input
              ref={inputCompararMoldeRef}
              type="file"
              accept=".docx,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setArquivoComparacao(file);
                setComparadorAberto(true);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputCompararMoldeRef.current?.click()}
              style={{
                width: 'auto',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Importar modelo mais recente do Banco e comparar lado a lado todas as diferenças com o modelo atual"
            >
              📤 Comparar Modelo
            </button>    
                
            <input
              ref={inputUploadMoldeRef}
              type="file"
              accept=".docx"
              style={{ display: 'none' }}
              onChange={handleUploadNovoMolde}
            />
            <button
              type="button"
              onClick={() =>
                baixarMoldeOriginalParaEdicao({
                  chaveMolde,
                  caminhoPublicDocx,
                  base64Fallback,
                  nomeArquivoDownload: `MOLDE_${chaveMolde}.docx`,
                }).catch((e) => alert(e.message))
              }
              style={{
                width: 'auto',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            >
              📥 Baixar Molde .DOCX
            </button>
            <button
              type="button"
              onClick={() => inputUploadMoldeRef.current?.click()}
              style={{
                width: 'auto',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
              }}
            >
              📤 Atualizar Molde .DOCX
            </button>
            {temMoldeCustom && (
              <button
                type="button"
                onClick={() => {
                  removerMoldeCustomizadoDoSistema(chaveMolde);
                  setTemMoldeCustom(false);
                }}
                style={{
                  width: 'auto',
                  padding: '6px 8px',
                  fontSize: '10.5px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                }}
              >
                ↺ Resetar
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
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

        {/* CORPO */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {clientesUnicosCarteira.length > 0 && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <strong style={{ fontSize: '12px', color: '#92400e' }}>
                ⚡ Cliente Selecionado / Trocar Cliente:
              </strong>
              <input
                type="search"
                list="dl_clientes_planta"
                value={clienteBusca}
                onChange={(e) => selecionarClienteDaCarteira(e.target.value)}
                placeholder="Selecione o cliente..."
                style={{ flex: 1, height: '32px', fontSize: '12px' }}
              />
              <datalist id="dl_clientes_planta">
                {clientesUnicosCarteira.map((c) => (
                  <option key={c.id} value={`${c.cliente} (${c.cpf || 'S/ CPF'})`} />
                ))}
              </datalist>
            </div>
          )}

          {/* 1. DADOS DO TITULAR */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <strong style={{ fontSize: '12px', color: '#8B1530', display: 'block', marginBottom: '10px' }}>
              1. DADOS DO TITULAR
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <LabelComInfo texto="Nome Completo" tagWord="{nome}" />
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="CPF" tagWord="{cpf}" />
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))}
                  maxLength={14}
                />
              </div>
              <div>
                <LabelComInfo texto="Estado Civil" tagWord="{estadocivil}" />
                <input
                  type="text"
                  value={estadocivil}
                  onChange={(e) => setEstadocivil(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <LabelComInfo texto="Tipo Doc" tagWord="{tipodedoc}" />
                <select value={tipodedoc} onChange={(e) => setTipodedoc(e.target.value)}>
                  <option value="RG">RG</option>
                  <option value="CNH">CNH</option>
                </select>
              </div>
              <div>
                <LabelComInfo texto="Nº Documento" tagWord="{numdodoc}" />
                <input
                  type="text"
                  value={numdodoc}
                  onChange={(e) => setNumdodoc(e.target.value)}
                />
              </div>
              <div>
                <LabelComInfo texto="Emissor - UF" tagWord="{emissor_uf}" />
                <input
                  type="text"
                  value={emissorUf}
                  onChange={(e) => setEmissorUf(e.target.value)}
                />
              </div>
              <div>
                <LabelComInfo texto="Data Emissão" tagWord="{dataemissaododoc}" />
                <input
                  type="text"
                  value={dataemissaododoc}
                  onChange={(e) => setDataemissaododoc(e.target.value)}
                  placeholder="DD/MM/AAAA"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div>
                <LabelComInfo texto="Endereço Completo" tagWord="{enderecocompletotitular}" />
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>
              <div>
                <LabelComInfo texto="CEP" tagWord="{cep}" />
                <input type="text" value={cep} onChange={(e) => setCep(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="Profissão" tagWord="{profissao}" />
                <input
                  type="text"
                  value={profissao}
                  onChange={(e) => setProfissao(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. DADOS DA OPERAÇÃO / CCB */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <strong style={{ fontSize: '12px', color: '#8B1530', display: 'block', marginBottom: '10px' }}>
              2. DADOS DA OPERAÇÃO DE CUSTEIO / CCB
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr 1.2fr', gap: '10px' }}>
              <div>
                <LabelComInfo texto="Nº da CCB" tagWord="{numerodaccb}" />
                <input
                  type="text"
                  value={numerodaccb}
                  onChange={(e) => setNumerodaccb(e.target.value)}
                />
              </div>
              <div>
                <LabelComInfo texto="Valor Original (R$)" tagWord="{valordapropostaoriginal}" />
                <input
                  type="text"
                  value={valordapropostaoriginal}
                  onChange={(e) =>
                    setValordapropostaoriginal(aplicarMascaraMoedaInput(e.target.value))
                  }
                />
              </div>
              <div>
                <LabelComInfo
                  texto="Data Emissão da CCB"
                  tagWord="{datadeemissaoporextenso} / {datadeemissaoabreviada}"
                />
                <input
                  type="text"
                  value={dtEmissaoCcb}
                  onChange={(e) => setDtEmissaoCcb(e.target.value)}
                  placeholder="DD/MM/AAAA ou Extenso"
                />
              </div>
              <div>
                <LabelComInfo texto="Data Emissão CET" tagWord="{datadoCET}" />
                <input
                  type="text"
                  value={datadoCET}
                  onChange={(e) => setDatadoCET(e.target.value)}
                />
              </div>
              <div>
                <LabelComInfo texto="Data Assinatura" tagWord="{data_extenso}" />
                <input
                  type="text"
                  value={dataExtenso}
                  onChange={(e) => setDataExtenso(e.target.value)}
                />
              </div>
            </div>

            {!isProtocolo && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px', marginTop: '10px' }}>
                <div>
                  <LabelComInfo texto="Novo Valor Financiado (R$)" tagWord="{novovalorfinanciado}" />
                  <input
                    type="text"
                    value={novovalorfinanciado}
                    onChange={(e) =>
                      setNovovalorfinanciado(aplicarMascaraMoedaInput(e.target.value))
                    }
                  />
                </div>
                <div>
                  <LabelComInfo texto="Safra" tagWord="{safra}" />
                  <input type="text" value={safra} onChange={(e) => setSafra(e.target.value)} />
                </div>
                <div>
                  <LabelComInfo texto="Tipo de Atividade" tagWord="{TIPODEATIVIDADE}" />
                  <input
                    type="text"
                    value={tipoAtividade}
                    onChange={(e) => setTipoAtividade(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. IMÓVEIS E COORDENADAS */}
          {!isProtocolo && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <LabelComInfo
                  texto="📍 3. IMÓVEL(IS) BENEFICIADO(S) E COORDENADAS"
                  tagWord="{#imoveis} {nomedoimovelbeneficiado} {coordenadalatitude} {coordenadalongitude} {cidade_ufdoimovel} {/imoveis}"
                  corTexto="#15803d"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImoveis([
                      ...imoveis,
                      {
                        id: `imp_${Date.now()}`,
                        nomedoimovelbeneficiado: '',
                        coordenadalatitude: '',
                        coordenadalongitude: '',
                        cidade_ufdoimovel: 'SANTA INÊS - MA',
                      },
                    ])
                  }
                  style={{
                    width: 'auto',
                    padding: '3px 10px',
                    fontSize: '11px',
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    fontWeight: 700,
                  }}
                >
                  + Adicionar Imóvel
                </button>
              </div>

              {imoveis.map((im, idx) => (
                <div
                  key={im.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.8fr 1fr 1fr 1.2fr auto',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <input
                    type="text"
                    value={im.nomedoimovelbeneficiado}
                    onChange={(e) => {
                      const n = [...imoveis];
                      n[idx].nomedoimovelbeneficiado = e.target.value;
                      setImoveis(n);
                    }}
                    placeholder="Nome do Imóvel Beneficiado"
                  />
                  <input
                    type="text"
                    value={im.coordenadalatitude}
                    onChange={(e) => {
                      const n = [...imoveis];
                      n[idx].coordenadalatitude = e.target.value;
                      setImoveis(n);
                    }}
                    placeholder="Latitude"
                  />
                  <input
                    type="text"
                    value={im.coordenadalongitude}
                    onChange={(e) => {
                      const n = [...imoveis];
                      n[idx].coordenadalongitude = e.target.value;
                      setImoveis(n);
                    }}
                    placeholder="Longitude"
                  />
                  <input
                    type="text"
                    value={im.cidade_ufdoimovel}
                    onChange={(e) => {
                      const n = [...imoveis];
                      n[idx].cidade_ufdoimovel = e.target.value;
                      setImoveis(n);
                    }}
                    placeholder="Cidade - UF"
                  />
                  {imoveis.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setImoveis(imoveis.filter((_, i) => i !== idx))}
                      style={{
                        width: 'auto',
                        padding: '4px 8px',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: 'none',
                        borderRadius: '4px',
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <LabelComInfo texto="💳 Outras Operações Ativas (Opcional)" tagWord="{#ops_ativas}" />
                  <button
                    type="button"
                    onClick={() =>
                      setOpsAtivas([
                        ...opsAtivas,
                        {
                          id: `ops_${Date.now()}`,
                          banco: 'BNB',
                          dt: '',
                          tipo: 'INVESTIMENTO',
                          v_ct: '',
                          v_sd: '',
                          fonte: 'FNE',
                          pronaf: 'NÃO',
                        },
                      ])
                    }
                    style={{
                      width: 'auto',
                      padding: '2px 8px',
                      fontSize: '11px',
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                    }}
                  >
                    + Adicionar Operação
                  </button>
                </div>

                {opsAtivas.map((op, idx) => (
                  <div
                    key={op.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr) auto',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <input
                      type="text"
                      value={op.banco}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].banco = e.target.value;
                        setOpsAtivas(n);
                      }}
                      placeholder="Banco"
                    />
                    <input
                      type="text"
                      value={op.dt}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].dt = e.target.value;
                        setOpsAtivas(n);
                      }}
                      placeholder="Data"
                    />
                    <input
                      type="text"
                      value={op.tipo}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].tipo = e.target.value;
                        setOpsAtivas(n);
                      }}
                      placeholder="Tipo"
                    />
                    <input
                      type="text"
                      value={op.v_ct}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].v_ct = aplicarMascaraMoedaInput(e.target.value);
                        setOpsAtivas(n);
                      }}
                      placeholder="V. Contr."
                    />
                    <input
                      type="text"
                      value={op.v_sd}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].v_sd = aplicarMascaraMoedaInput(e.target.value);
                        setOpsAtivas(n);
                      }}
                      placeholder="Saldo Dev."
                    />
                    <input
                      type="text"
                      value={op.fonte}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].fonte = e.target.value;
                        setOpsAtivas(n);
                      }}
                      placeholder="Fonte"
                    />
                    <input
                      type="text"
                      value={op.pronaf}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].pronaf = e.target.value;
                        setOpsAtivas(n);
                      }}
                      placeholder="Pronaf?"
                    />
                    <button
                      type="button"
                      onClick={() => setOpsAtivas(opsAtivas.filter((_, i) => i !== idx))}
                      style={{
                        width: 'auto',
                        padding: '4px 8px',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: 'none',
                        borderRadius: '4px',
                      }}
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ COM DUPLA OPÇÃO: PDF + WORD */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f1f5f9',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onFechar}
            style={{
              width: 'auto',
              padding: '8px 16px',
              fontSize: '12px',
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: 700,
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleGerarDocumento('PDF')}
            style={{
              width: 'auto',
              padding: '8px 18px',
              fontSize: '12.5px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📄 Gerar em PDF
          </button>

          <button
            type="button"
            onClick={() => handleGerarDocumento('DOCX')}
            style={{
              width: 'auto',
              padding: '8px 20px',
              fontSize: '12.5px',
              background: '#8B1530',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📝 Gerar em Word (.DOCX)
          </button>
        </div>
      </div>

    <ModalComparadorMoldeDocx
          aberto={comparadorAberto}
          onFechar={() => setComparadorAberto(false)}
          tituloDocumento={chaveMolde}
          chaveMolde={chaveMolde}
          caminhoPublicDocx={caminhoPublicDocx}
          base64Fallback={base64Fallback}
          arquivoNovoInicial={arquivoComparacao}
          onMoldeAtualizadoComSucesso={() => setTemMoldeCustom(true)}
        />        


    </div>,
    document.body
  );
}