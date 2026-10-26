'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
import { aplicarMascaraCPF, aplicarMascaraMoedaInput } from '@/lib/utils';
import {
  gerarDocumentoWordPeloMolde,
  gerarDocumentoPdfPeloMolde,
  baixarMoldeOriginalParaEdicao,
  salvarMoldeCustomizadoNoSistema,
  removerMoldeCustomizadoDoSistema,
  possuiMoldeCustomizadoSalvo,
} from '@/lib/motorWordDocx';
import {
  MOLDE_CONSOLIDADA_PF_BASE64,
  MOLDE_CONSOLIDADA_PRONAF_BASE64,
} from '@/components/documentos/moldesBase64Originais';
import LabelComInfo from '@/components/documentos/LabelComInfo';

export interface DadosIniciaisClienteDoc {
  nome?: string;
  cpf?: string;
  porte?: string;
  projetista?: string;
  valor?: string;
}

interface ModalConsolidadaRuralProps {
  aberto: boolean;
  modalidade: 'PF' | 'PRONAF';
  onFechar: () => void;
  contratacoes?: RegistroContratacao[];
  clienteInicial?: DadosIniciaisClienteDoc | null;
}

interface ImovelIntegranteItem {
  id: string;
  nome: string;
  matricula: string;
  registro: string;
  cidadeUf: string;
}

interface OperacaoAtivaItem {
  id: string;
  banco: string;
  dt: string;
  tipo: string;
  v_ct: string;
  v_sd: string;
  fonte: string;
  bonus: 'NENHUM' | '200' | '700';
  pronaf: 'N' | 'S';
}

interface ProagroItem {
  id: string;
  banco: string;
  dt: string;
  v_cr: string;
  v_pr: string;
  v_inv: string;
  cid: string;
  ativ: string;
  prog: string;
  cob: string;
}

interface CeiItem {
  id: string;
  mat: string;
  reg: string;
  nome: string;
}

interface VariavelExtraItem {
  id: string;
  chave: string;
  valor: string;
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

export default function ModalConsolidadaRural({
  aberto,
  modalidade,
  onFechar,
  contratacoes = [],
  clienteInicial = null,
}: ModalConsolidadaRuralProps) {
  const chaveMolde = modalidade === 'PRONAF' ? 'CONSOLIDADA_PRONAF' : 'CONSOLIDADA_PF';
  const caminhoPublicDocx =
    modalidade === 'PRONAF'
      ? '/moldes-word/consolidada-rural-pronaf.docx'
      : '/moldes-word/consolidada-rural-pf.docx';
  const base64Fallback =
    modalidade === 'PRONAF'
      ? MOLDE_CONSOLIDADA_PRONAF_BASE64
      : MOLDE_CONSOLIDADA_PF_BASE64;

  const [temMoldeCustom, setTemMoldeCustom] = useState(false);
  const inputUploadMoldeRef = useRef<HTMLInputElement>(null);

  const [clienteBusca, setClienteBusca] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [tipoDoc, setTipoDoc] = useState('RG');
  const [numDoc, setNumDoc] = useState('');
  const [orgaoDoc, setOrgaoDoc] = useState('SSP');
  const [ufDoc, setUfDoc] = useState('MA');
  const [endereco, setEndereco] = useState('');
  const [cep, setCep] = useState('');
  const [contaCorrente, setContaCorrente] = useState('');
  const [safra, setSafra] = useState('2026/2027');
  const [dataExtenso, setDataExtenso] = useState(() => obterDataExtensoHoje());

  const [juntaComercial, setJuntaComercial] = useState<'NÃO' | 'SIM'>('NÃO');
  const [temOutrasOps, setTemOutrasOps] = useState<'NÃO' | 'SIM'>('NÃO');
  const [temProagro, setTemProagro] = useState<'NÃO' | 'SIM'>('NÃO');
  const [renegStatus, setRenegStatus] = useState<'NAO_POSSUI' | 'POSSUI_PAGAS'>('NAO_POSSUI');
  const [temCei, setTemCei] = useState<'NÃO' | 'SIM'>('NÃO');
  const [numCei, setNumCei] = useState('');

  const [imoveis, setImoveis] = useState<ImovelIntegranteItem[]>([
    { id: 'imo_1', nome: '', matricula: '', registro: '', cidadeUf: '' },
  ]);
  const [opsAtivas, setOpsAtivas] = useState<OperacaoAtivaItem[]>([]);
  const [opsProagro, setOpsProagro] = useState<ProagroItem[]>([]);
  const [listaCei] = useState<CeiItem[]>([]);
  const [variaveisExtras, setVariaveisExtras] = useState<VariavelExtraItem[]>([]);

  useEffect(() => {
    if (aberto) {
      setTemMoldeCustom(possuiMoldeCustomizadoSalvo(chaveMolde));
      setDataExtenso(obterDataExtensoHoje());
      if (clienteInicial) {
        const nIni = (clienteInicial.nome || '').toUpperCase().trim();
        const cIni = clienteInicial.cpf || '';
        setNome(nIni);
        setCpf(cIni);
        setClienteBusca(nIni ? `${nIni} (${cIni || 'S/ CPF'})` : '');
      }
    }
  }, [aberto, chaveMolde, clienteInicial]);

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
    }
  };

  if (!aberto || typeof document === 'undefined') return null;

  const handleUploadNovoMolde = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await salvarMoldeCustomizadoNoSistema(chaveMolde, file);
      setTemMoldeCustom(true);
      alert(
        `✅ Novo molde Word (${file.name}) salvo com sucesso! Todas as próximas emissões em DOCX e PDF usarão este modelo atualizado.`
      );
    } catch {
      alert('❌ Erro ao ler o arquivo .docx.');
    }
    e.target.value = '';
  };

  const montarPacoteDados = () => {
    const listaImsFormatada = imoveis
      .filter((im) => im.nome.trim() !== '')
      .map((im, i) => {
        const c = im.cidadeUf.toUpperCase().trim();
        let cid = c;
        let uf = 'MA';
        if (c.includes('-')) {
          const parts = c.split('-');
          cid = parts[0].trim();
          uf = parts[1].trim() || 'MA';
        }
        return {
          idx: i + 1,
          nome: im.nome.toUpperCase().trim(),
          matricula: im.matricula.trim(),
          registro: im.registro.trim() || 'Não informado',
          cidade: cid,
          estado: uf,
          localidade: cid,
        };
      });

    const opsAtivasFormatadas =
      temOutrasOps === 'SIM'
        ? opsAtivas.map((op) => ({
            banco: op.banco,
            dt: op.dt,
            tipo: op.tipo,
            v_ct: op.v_ct,
            v_sd: op.v_sd,
            fonte: op.fonte,
            b200: op.bonus === '200' ? 'S' : 'N',
            b700: op.bonus === '700' ? 'S' : 'N',
            pronaf: op.pronaf,
          }))
        : [];

    const opsProagroFormatadas =
      temProagro === 'SIM'
        ? opsProagro.map((pr) => ({
            banco: pr.banco,
            dt: pr.dt,
            v_cr: pr.v_cr,
            v_pr: pr.v_pr,
            v_inv: pr.v_inv,
            cid: pr.cid,
            ativ: pr.ativ,
            prog: pr.prog,
            cob: pr.cob,
          }))
        : [];

    const tabelaCeiFormatada =
      temCei === 'SIM'
        ? listaCei.map((c) => ({
            mat: c.mat,
            reg: c.reg,
            nome: c.nome,
          }))
        : [];

    const isEmpresario = juntaComercial === 'SIM';
    const boolOutrasOps = temOutrasOps === 'SIM';
    const boolProagro = temProagro === 'SIM';
    const boolCei = temCei === 'SIM';

    const mapaExtras: Record<string, string> = {};
    variaveisExtras.forEach((v) => {
      const ch = v.chave.replace(/[{}]/g, '').trim();
      if (ch) mapaExtras[ch] = v.valor;
    });

    const dadosWord: Record<string, unknown> = {
      nome: nome.toUpperCase().trim() || '[NOME]',
      tipo_doc: tipoDoc,
      num_doc: numDoc || '[NÚMERO]',
      orgao_doc: orgaoDoc || 'SSP',
      uf_doc: ufDoc || 'MA',
      cpf: cpf || '[CPF]',
      endereco: endereco || '[ENDEREÇO]',
      cep: cep || '[CEP]',
      conta_corrente: contaCorrente || '[CONTA]',
      safra: safra || '2026/2027',
      data_extenso: dataExtenso || obterDataExtensoHoje(),

      chk_op_nao: !boolOutrasOps ? 'X' : ' ',
      chk_op_sim: boolOutrasOps ? 'X' : ' ',
      chk_ops_nao: !boolOutrasOps ? 'X' : ' ',
      chk_ops_sim: boolOutrasOps ? 'X' : ' ',
      chk_pro_nao: !boolProagro ? 'X' : ' ',
      chk_pro_sim: boolProagro ? 'X' : ' ',
      chk_reneg_nao: renegStatus !== 'POSSUI_PAGAS' ? 'X' : ' ',
      chk_reneg_sim: renegStatus === 'POSSUI_PAGAS' ? 'X' : ' ',
      chk_reneg_pagas: renegStatus === 'POSSUI_PAGAS' ? 'X' : ' ',
      chk_cei_nao: !boolCei ? 'X' : ' ',
      chk_cei_sim: boolCei ? 'X' : ' ',
      num_cei: boolCei ? numCei || '[CEI]' : '[Não se aplica]',
      chk_prev_emp: isEmpresario ? 'X' : ' ',
      chk_prev_rur: !isEmpresario && listaImsFormatada.length > 0 ? 'X' : ' ',
      chk_prev_nenhum: !isEmpresario && listaImsFormatada.length === 0 ? 'X' : ' ',
      chk_onus_nao: listaImsFormatada.length === 0 ? 'X' : ' ',
      chk_onus_sim: listaImsFormatada.length > 0 ? 'X' : ' ',
      chk_forr_nao: listaImsFormatada.length === 0 ? 'X' : ' ',
      chk_forr_sim: listaImsFormatada.length > 0 ? 'X' : ' ',

      imoveis: listaImsFormatada,
      ops_ativas: opsAtivasFormatadas,
      ops_proagro: opsProagroFormatadas,
      tabela_cei: tabelaCeiFormatada,
      ...mapaExtras,
    };

    const partesNome = (nome || 'CLIENTE').trim().toUpperCase().split(/\s+/);
    const doisPrimeiros = partesNome.slice(0, 2).join(' ');
    const nomeArq = `DEC. CONSOLIDADA ${modalidade} - ${doisPrimeiros}.docx`;

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
          maxWidth: '920px',
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
              📄 DECLARAÇÃO CONSOLIDADA RURAL —{' '}
              {modalidade === 'PRONAF' ? 'PRONAF' : 'PESSOA FÍSICA (NÃO PRONAF)'}
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {temMoldeCustom
                ? '🟢 Usando Molde .DOCX atualizado por você'
                : '⚪ Usando Molde .DOCX padrão do sistema'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                  nomeArquivoDownload: `MOLDE_EDITAVEL_CONSOLIDADA_${modalidade}.docx`,
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
                cursor: 'pointer',
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
                cursor: 'pointer',
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
                  cursor: 'pointer',
                }}
              >
                ↺ Resetar Molde
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
                padding: '0 4px',
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
            gap: '16px',
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
                flexWrap: 'wrap',
              }}
            >
              <strong style={{ fontSize: '12px', color: '#92400e' }}>
                ⚡ Cliente Selecionado / Trocar Cliente:
              </strong>
              <input
                type="search"
                list="dl_clientes_consolidada"
                value={clienteBusca}
                onChange={(e) => selecionarClienteDaCarteira(e.target.value)}
                placeholder="Digite o nome ou CPF de um cliente cadastrado..."
                style={{ flex: 1, height: '32px', fontSize: '12px' }}
              />
              <datalist id="dl_clientes_consolidada">
                {clientesUnicosCarteira.map((c) => (
                  <option key={c.id} value={`${c.cliente} (${c.cpf || 'S/ CPF'})`} />
                ))}
              </datalist>
            </div>
          )}

          {/* 1. IDENTIFICAÇÃO E DOCUMENTOS DO PROPONENTE */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <strong style={{ fontSize: '12.5px', color: '#8B1530', display: 'block', marginBottom: '10px' }}>
              1. IDENTIFICAÇÃO E ENDEREÇO DO PROPONENTE
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 0.8fr 1fr 0.7fr 0.5fr', gap: '10px', marginBottom: '10px' }}>
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
                <LabelComInfo texto="Doc." tagWord="{tipo_doc}" />
                <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                  <option value="RG">RG</option>
                  <option value="CNH">CNH</option>
                </select>
              </div>
              <div>
                <LabelComInfo texto="Nº Doc" tagWord="{num_doc}" />
                <input type="text" value={numDoc} onChange={(e) => setNumDoc(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="Órgão" tagWord="{orgao_doc}" />
                <input type="text" value={orgaoDoc} onChange={(e) => setOrgaoDoc(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="UF" tagWord="{uf_doc}" />
                <input type="text" value={ufDoc} onChange={(e) => setUfDoc(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.9fr 1fr 0.9fr 1.4fr', gap: '10px' }}>
              <div>
                <LabelComInfo texto="Endereço Completo" tagWord="{endereco}" />
                <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="CEP" tagWord="{cep}" />
                <input type="text" value={cep} onChange={(e) => setCep(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="Conta Corrente" tagWord="{conta_corrente}" />
                <input
                  type="text"
                  value={contaCorrente}
                  onChange={(e) => setContaCorrente(e.target.value)}
                />
              </div>
              <div>
                <LabelComInfo texto="Safra" tagWord="{safra}" />
                <input type="text" value={safra} onChange={(e) => setSafra(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="Data por Extenso" tagWord="{data_extenso}" />
                <input
                  type="text"
                  value={dataExtenso}
                  onChange={(e) => setDataExtenso(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. IMÓVEIS INTEGRANTES DO PLEITO */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <LabelComInfo
                texto="📍 2. IMÓVEL(IS) INTEGRANTE(S)"
                tagWord="{#imoveis} {nome} {matricula} {registro} {cidade} {estado} {/imoveis}"
                corTexto="#15803d"
              />
              <button
                type="button"
                onClick={() =>
                  setImoveis([
                    ...imoveis,
                    {
                      id: `imo_${Date.now()}`,
                      nome: '',
                      matricula: '',
                      registro: '',
                      cidadeUf: '',
                    },
                  ])
                }
                style={{
                  width: 'auto',
                  padding: '4px 10px',
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
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={im.nome}
                  onChange={(e) => {
                    const novos = [...imoveis];
                    novos[idx].nome = e.target.value;
                    setImoveis(novos);
                  }}
                  placeholder="Nome do Imóvel / Fazenda"
                />
                <input
                  type="text"
                  value={im.matricula}
                  onChange={(e) => {
                    const novos = [...imoveis];
                    novos[idx].matricula = e.target.value;
                    setImoveis(novos);
                  }}
                  placeholder="Matrícula nº"
                />
                <input
                  type="text"
                  value={im.registro}
                  onChange={(e) => {
                    const novos = [...imoveis];
                    novos[idx].registro = e.target.value;
                    setImoveis(novos);
                  }}
                  placeholder="Registro Cartorário"
                />
                <input
                  type="text"
                  value={im.cidadeUf}
                  onChange={(e) => {
                    const novos = [...imoveis];
                    novos[idx].cidadeUf = e.target.value;
                    setImoveis(novos);
                  }}
                  placeholder="Cidade - UF (Ex: BOM JARDIM - MA)"
                />
                {imoveis.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setImoveis(imoveis.filter((_, i) => i !== idx))}
                    style={{
                      width: 'auto',
                      padding: '6px 10px',
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
          </div>

          {/* 3. ENQUADRAMENTOS OPCIONAIS */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <strong style={{ fontSize: '12.5px', color: '#8B1530', display: 'block', marginBottom: '10px' }}>
              3. QUESTIONÁRIO DE ENQUADRAMENTO
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <div>
                <LabelComInfo texto="Registro na Junta Comercial?" tagWord="{chk_prev_emp} / {chk_prev_rur}" />
                <select
                  value={juntaComercial}
                  onChange={(e) => setJuntaComercial(e.target.value as 'NÃO' | 'SIM')}
                >
                  <option value="NÃO">NÃO (Pessoa Física Rural)</option>
                  <option value="SIM">SIM (Empresário)</option>
                </select>
              </div>

              <div>
                <LabelComInfo texto="Dívidas Renegociadas?" tagWord="{chk_reneg_nao} / {chk_reneg_pagas}" />
                <select
                  value={renegStatus}
                  onChange={(e) =>
                    setRenegStatus(e.target.value as 'NAO_POSSUI' | 'POSSUI_PAGAS')
                  }
                >
                  <option value="NAO_POSSUI">NÃO POSSUI</option>
                  <option value="POSSUI_PAGAS">POSSUI (EM DIA / PAGAS)</option>
                </select>
              </div>

              <div>
                <LabelComInfo texto="Informar Operações Vigentes?" tagWord="{#ops_ativas}" />
                <select
                  value={temOutrasOps}
                  onChange={(e) => {
                    const val = e.target.value as 'NÃO' | 'SIM';
                    setTemOutrasOps(val);
                    if (val === 'SIM' && opsAtivas.length === 0) {
                      setOpsAtivas([
                        {
                          id: `op_${Date.now()}`,
                          banco: 'BNB',
                          dt: '',
                          tipo: 'INVESTIMENTO',
                          v_ct: '',
                          v_sd: '',
                          fonte: 'FNE',
                          bonus: 'NENHUM',
                          pronaf: modalidade === 'PRONAF' ? 'S' : 'N',
                        },
                      ]);
                    }
                  }}
                >
                  <option value="NÃO">NÃO (Padrão Modelo Novo)</option>
                  <option value="SIM">SIM (Apenas Molde Antigo)</option>
                </select>
              </div>

              <div>
                <LabelComInfo texto="Enquadramento PROAGRO?" tagWord="{#ops_proagro}" />
                <select
                  value={temProagro}
                  onChange={(e) => {
                    const val = e.target.value as 'NÃO' | 'SIM';
                    setTemProagro(val);
                    if (val === 'SIM' && opsProagro.length === 0) {
                      setOpsProagro([
                        {
                          id: `pro_${Date.now()}`,
                          banco: 'BNB',
                          dt: '',
                          v_cr: '',
                          v_pr: '',
                          v_inv: '',
                          cid: '',
                          ativ: '',
                          prog: '',
                          cob: '',
                        },
                      ]);
                    }
                  }}
                >
                  <option value="NÃO">NÃO</option>
                  <option value="SIM">SIM</option>
                </select>
              </div>

              <div>
                <LabelComInfo texto="Possui Matrícula CEI?" tagWord="{num_cei}" />
                <select
                  value={temCei}
                  onChange={(e) => setTemCei(e.target.value as 'NÃO' | 'SIM')}
                >
                  <option value="NÃO">NÃO</option>
                  <option value="SIM">SIM</option>
                </select>
              </div>

              {temCei === 'SIM' && (
                <div>
                  <LabelComInfo texto="Nº do CEI" tagWord="{num_cei}" />
                  <input type="text" value={numCei} onChange={(e) => setNumCei(e.target.value)} />
                </div>
              )}
            </div>

            {temOutrasOps === 'SIM' && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <LabelComInfo texto="💳 Operações de Crédito Vigentes" tagWord="{#ops_ativas}" />
                  <button
                    type="button"
                    onClick={() =>
                      setOpsAtivas([
                        ...opsAtivas,
                        {
                          id: `op_${Date.now()}`,
                          banco: 'BNB',
                          dt: '',
                          tipo: 'INVESTIMENTO',
                          v_ct: '',
                          v_sd: '',
                          fonte: 'FNE',
                          bonus: 'NENHUM',
                          pronaf: modalidade === 'PRONAF' ? 'S' : 'N',
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
                    + Operação
                  </button>
                </div>
                {opsAtivas.map((op, idx) => (
                  <div
                    key={op.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '0.8fr 0.9fr 1.1fr 1fr 1fr 0.7fr auto',
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
                      placeholder="Data Contr."
                    />
                    <select
                      value={op.tipo}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].tipo = e.target.value;
                        setOpsAtivas(n);
                      }}
                    >
                      <option value="INVESTIMENTO">INVESTIMENTO</option>
                      <option value="CUSTEIO">CUSTEIO</option>
                      <option value="COMERCIALIZAÇÃO">COMERCIALIZAÇÃO</option>
                    </select>
                    <input
                      type="text"
                      value={op.v_ct}
                      onChange={(e) => {
                        const n = [...opsAtivas];
                        n[idx].v_ct = aplicarMascaraMoedaInput(e.target.value);
                        setOpsAtivas(n);
                      }}
                      placeholder="V. Contrato"
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
            )}
          </div>

          {/* 4. VARIÁVEIS EXTRAS DINÂMICAS */}
          <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px 14px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <LabelComInfo
                texto="➕ 4. Variáveis Extras do Molde Word (Opcional)"
                tagWord="{sua_nova_variavel}"
              />
              <button
                type="button"
                onClick={() =>
                  setVariaveisExtras([
                    ...variaveisExtras,
                    { id: `ext_${Date.now()}`, chave: '', valor: '' },
                  ])
                }
                style={{
                  width: 'auto',
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: '#ffffff',
                  color: '#8B1530',
                  border: '1px solid #8B1530',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                + Nova Etiqueta
              </button>
            </div>

            {variaveisExtras.map((v, idx) => (
              <div
                key={v.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr auto',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                <input
                  type="text"
                  value={v.chave}
                  onChange={(e) => {
                    const n = [...variaveisExtras];
                    n[idx].chave = e.target.value;
                    setVariaveisExtras(n);
                  }}
                  placeholder="Nome da tag no Word (Ex: numero_caf)"
                />
                <input
                  type="text"
                  value={v.valor}
                  onChange={(e) => {
                    const n = [...variaveisExtras];
                    n[idx].valor = e.target.value;
                    setVariaveisExtras(n);
                  }}
                  placeholder="Valor que aparecerá no documento"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVariaveisExtras(variaveisExtras.filter((_, i) => i !== idx))
                  }
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

        {/* RODAPÉ COM DUPLA OPÇÃO: GERAR PDF + GERAR WORD (.DOCX) */}
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
    </div>,
    document.body
  );
}