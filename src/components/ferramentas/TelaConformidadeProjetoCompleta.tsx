'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
import { obterListaProjetistas } from '@/lib/utils';
import {
  carregarFerramentasSync,
  carregarCoringasGavetaSync,
  salvarCoringaGavetaSync,
} from '@/lib/firebaseSync';
import {
  PorteOrganizador,
  ModalidadeDerivada,
  EscopoOperacaoPasta,
  CategoriaDocPasta,
  classificarArquivoUniversal,
  isArquivoParecerGerencialReal,
} from '@/lib/motorPerfisOrganizadorPastas';
import {
  ItemConformidadePronafA,
  ListaSalvaConformidadePronafA,
  STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A,
} from '@/components/ferramentas/ModalConformidadePronafA';
import {
  aplicarMascaraCPF,
  aplicarMascaraDataBR,
  aplicarMascaraMoedaInput,
} from '@/lib/utils';
import {
  executarAuditoriaCompletaDosPdfsDaPasta,
  executarOcrEmPdfEscaneado,
  ResultadoAuditoriaPastaPdf,
  removerAcentos,
  normalizarSemAcento,
  salvarDadosExtraidosParaParecer,
} from '@/lib/auditorInteligentePdfPasta';
import ModalConferenciaDocumentacaoImoveis from '@/components/ferramentas/ModalConferenciaDocumentacaoImoveis';
import PainelConsultasRapidasAgrupadas from '@/components/ferramentas/PainelConsultasRapidasAgrupadas';
import ModalScriptCopilotDocumento from '@/components/ferramentas/ModalScriptCopilotDocumento';

interface TelaConformidadeProjetoCompletaProps {
  aberto: boolean;
  onFechar: () => void;
  contratacoes: RegistroContratacao[];
  onAbrirConferenciaImoveis?: () => void;
}

interface ArquivoLidoConformidade {
  id: string;
  nomeOriginal: string;
  caminhoSubpasta: string;
  extensao: string;
  fileObj: File;
  categoria: CategoriaDocPasta;
  isViti: boolean;
  ehTxtPendencia: boolean;
  origemGaveta?: boolean;
}

interface CoringaGavetaItem {
  id: string;
  tipo: 'CREA_PROJETISTA' | 'RB_PA' | 'CAR_PA' | 'PARECER_SEMA' | string;
  chaveReferencia: string;
  nomeArquivoOriginal: string;
  base64Dados: string;
}

interface ItemVerificacaoCompletaPasta {
  id: string;
  titulo: string;
  obrigatorio: boolean;
  presente: boolean;
  responsavel: 'ANALISTA_BANCO' | 'PROJETISTA_CLIENTE';
  detalheStatus: string;
  arquivosRelacionados: ArquivoLidoConformidade[];
}

function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const limpo = (base64 || '').includes(',')
    ? base64.split(',')[1]
    : base64 || '';
  const binStr = window.atob(limpo);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes.buffer;
}

async function obterCoringasDaGavetaUniversal(): Promise<CoringaGavetaItem[]> {
  if (typeof window === 'undefined') return [];
  const encontrados: CoringaGavetaItem[] = [];
  const idsVistos = new Set<string>();

  const adicionarLista = (arr: any) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((it) => {
      if (it && typeof it === 'object' && it.tipo && it.base64Dados) {
        const k = `${it.tipo}_${it.chaveReferencia || ''}`;
        if (!idsVistos.has(k)) {
          idsVistos.add(k);
          encontrados.push(it as CoringaGavetaItem);
        }
      }
    });
  };

  // 1. Lê do IndexedDB Oficial da Gaveta de Coringas ('bnb_v2_cofre_coringas_db')
  if (window.indexedDB) {
    try {
      const itensIdb = await new Promise<any[]>((resolve) => {
        const req = window.indexedDB.open('bnb_v2_cofre_coringas_db', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('arquivos_coringas')) {
            db.createObjectStore('arquivos_coringas', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('arquivos_coringas')) {
              resolve([]);
              return;
            }
            const tx = db.transaction('arquivos_coringas', 'readonly');
            const store = tx.objectStore('arquivos_coringas');
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => resolve(getAllReq.result || []);
            getAllReq.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        };
        req.onerror = () => resolve([]);
      });
      adicionarLista(itensIdb);
    } catch {
      // Ignora erro IDB
    }
  }

  // 2. Lê da Nuvem Firebase Oficial da Gaveta de Coringas
  try {
    const nuvemCofre = await carregarCoringasGavetaSync();
    adicionarLista(nuvemCofre);
  } catch {
    // Ignora
  }

  // 3. Fallback: verifica também o nó geral de ferramentas
  try {
    const nuvemFerr = await carregarFerramentasSync();
    if (nuvemFerr && typeof nuvemFerr === 'object') {
      Object.values(nuvemFerr).forEach((val) => adicionarLista(val));
    }
  } catch {
    // Ignora
  }

  return encontrados;
}

function converterCategoriaParaAuditor(cat: CategoriaDocPasta): string {
  const mapa: Partial<Record<CategoriaDocPasta, string>> = {
    ITEM_ARQ_ELETRONICO_PROJETO: 'ITEM_1_PROJETO_ARQ',
    ITEM_AUT_ALTERACAO: 'ITEM_2_AUT_ALTERACAO',
    ITEM_EMBARGOS_TITULAR: 'ITEM_3_EMBARGOS_TITULAR',
    ITEM_EMBARGOS_CONJUGE: 'ITEM_3_EMBARGOS_CONJUGE',
    ITEM_IMPROBIDADE_TITULAR: 'ITEM_4_IMPROBIDADE_TITULAR',
    ITEM_IMPROBIDADE_CONJUGE: 'ITEM_4_IMPROBIDADE_CONJUGE',
    ITEM_CERT_SOCIO_COM_KML: 'ITEM_5_CERT_SOCIOAMBIENTAL',
    ITEM_CERT_SOCIO_SEM_KML: 'ITEM_5_CERT_SOCIOAMBIENTAL',
    ITEM_CREA: 'ITEM_6_CREA',
    ITEM_EXTRATO_SICOR: 'ITEM_7_EXTRATO_SICOR',
    ITEM_CONTRATO_ASSESSORIA: 'ITEM_8_CONTRATO_ASSESSORIA',
    ITEM_CONSOLIDADAS: 'ITEM_9_CONSOLIDADAS',
    ITEM_DEC_AMBIENTAIS: 'ITEM_10_DEC_AMBIENTAIS',
    ITEM_DEC_REG_AMBIENTAL: 'ITEM_10_1_REG_AMBIENTAL',
    ITEM_DEC_NAO_DESMATAMENTO: 'ITEM_10_2_NAO_DESMATAMENTO',
    ITEM_DEC_RECOMPOSICAO: 'ITEM_10_3_RECOMPOSICAO',
    ITEM_DEC_REG_AMB_GARANTIDOR: 'ITEM_10_4_OUTRA_DEC_AMBIENTAL',
    ITEM_DEC_OUTRA_AMBIENTAL: 'ITEM_10_4_OUTRA_DEC_AMBIENTAL',
    ITEM_ESPELHO_UND: 'ITEM_11_ESPELHO_UND',
    ITEM_PROJETO_PDF: 'ITEM_12_PROJETO_PDF',
    ITEM_SOLICITACAO_LIMITE: 'ITEM_SOLICITACAO_LIMITE',
    ITEM_CAR: 'ITEM_13_CAR',
    ITEM_CONSULTA_CAR: 'ITEM_13_CONSULTA_CAR',
    ITEM_CAF: 'ITEM_14_CAF',
    ITEM_EXTRATO_CAF: 'ITEM_14_EXTRATO_CAF',
    ITEM_DCAA: 'ITEM_15_DCAA',
    ITEM_PARECER_TECNICO: 'ITEM_16_PARECER_TECNICO',
    ITEM_RB_PA: 'ITEM_17_RB_PA',
    ITEM_ORCAMENTO: 'ITEM_18_ORCAMENTO',
    ITEM_CAPA_ANALISADOR: 'ITEM_19_CAPA_ANALISADOR',
    ITEM_PARECER_GERENCIAL: 'ITEM_20_PARECER_GERENCIAL',
    ITEM_PARECER_SEMA: 'ITEM_21_PARECER_SEMA',
    ITEM_CND_PF: 'ITEM_CND_PF',
    ITEM_CNDT_PF: 'ITEM_CNDT_PF',
    ITEM_CCIR: 'ITEM_CCIR',
    ITEM_CND_ITR_IMOVEL: 'ITEM_CND_ITR_IMOVEL',
    ITEM_INTEIRO_TEOR: 'ITEM_INTEIRO_TEOR',
    ITEM_LAUDO_EXTERNO: 'ITEM_LAUDO_EXTERNO',
    ITEM_LAUDO_INTERNO: 'ITEM_LAUDO_INTERNO',
    ITEM_KML: 'ITEM_KML',
    CAD_1_IDENTIDADE_TITULAR: 'CAD_1_IDENTIDADE_TITULAR',
    CAD_1_IDENTIDADE_CONJUGE: 'CAD_1_IDENTIDADE_CONJUGE',
    CAD_1_IDENTIDADE_OUTRO: 'CAD_1_IDENTIDADE_OUTRO',
    CAD_2_CERTIDAO_CASAMENTO: 'CAD_2_CERTIDAO_CASAMENTO',
    CAD_5_PROPOSTA_CADASTRO: 'CAD_5_PROPOSTA_CADASTRO',
    CAD_6_PROCURACAO: 'CAD_6_PROCURACAO',
    CAD_8_SELO_CARTORIO: 'CAD_8_SELO_CARTORIO',
  };
  return mapa[cat] || cat;
}

function extrairPrimeiroNome(nome: string): string {
  return removerAcentos((nome || '').trim().split(/\s+/)[0] || '').toUpperCase();
}

const STORAGE_KEY_RAIOX_MANUAL_CLIENTES =
  'bnb_v2_raiox_manual_clientes_conformidade';

interface DadosRaioXManualCliente {
  chaveCliente: string;
  titularNome: string;
  titularCpf: string;
  titularDataNasc: string;
  estadoCivil: string;
  conjugeNome: string;
  conjugeCpf: string;
  conjugeDataNasc: string;
  procuradorNome: string;
  procuradorCpf: string;
  procuradorDataNasc: string;
  valorFinanciado: string;
  prazoMeses: string;
  carenciaMeses: string;
  contaCorrente: string;
  projetista: string;
  imovelPa: string;
  areaHa: string;
  reciboCar: string;
  atualizadoEm: string;
}

function obterMapaRaioXLocal(): Record<string, DadosRaioXManualCliente> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RAIOX_MANUAL_CLIENTES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function buscarRaioXSalvoDoCliente(
  nomeCliente: string,
  cpfCliente: string,
  nomePasta: string,
  coringasNuvem?: CoringaGavetaItem[]
): DadosRaioXManualCliente | null {
  const mapa = obterMapaRaioXLocal();
  const cpfLimpo = (cpfCliente || '').replace(/\D/g, '');
  const nomeNorm = normalizarSemAcento(nomeCliente);
  const pastaNorm = normalizarSemAcento(
    (nomePasta || '').replace(/^\d+\s*[-–.]\s*/, '')
  );

  if (cpfLimpo.length >= 9 && mapa[`CPF_${cpfLimpo}`]) {
    return mapa[`CPF_${cpfLimpo}`];
  }
  if (nomeNorm.length >= 3 && mapa[`NOME_${nomeNorm}`]) {
    return mapa[`NOME_${nomeNorm}`];
  }
  if (pastaNorm.length >= 3 && mapa[`NOME_${pastaNorm}`]) {
    return mapa[`NOME_${pastaNorm}`];
  }

  // Fallback: busca nos itens sincronizados na nuvem Firebase (tipo RAIOX_CLIENTE_CACHE)
  if (coringasNuvem && coringasNuvem.length > 0) {
    const itemNuvem = coringasNuvem.find((c) => {
      if (c.tipo !== 'RAIOX_CLIENTE_CACHE') return false;
      const refNorm = normalizarSemAcento(c.chaveReferencia);
      return (
        (cpfLimpo.length >= 9 && refNorm.includes(cpfLimpo)) ||
        (nomeNorm.length >= 4 && refNorm === nomeNorm) ||
        (pastaNorm.length >= 4 && refNorm === pastaNorm)
      );
    });
    if (itemNuvem && itemNuvem.base64Dados) {
      try {
        const jsonStr = decodeURIComponent(
          escape(window.atob(itemNuvem.base64Dados))
        );
        return JSON.parse(jsonStr) as DadosRaioXManualCliente;
      } catch {
        // Ignora erro de decode
      }
    }
  }

  return null;
}

async function salvarRaioXDoClienteLocalENuvem(
  dados: DadosRaioXManualCliente
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const mapa = obterMapaRaioXLocal();
    const cpfLimpo = (dados.titularCpf || '').replace(/\D/g, '');
    const nomeNorm = normalizarSemAcento(dados.titularNome);

    if (cpfLimpo.length >= 9) mapa[`CPF_${cpfLimpo}`] = dados;
    if (nomeNorm.length >= 3) mapa[`NOME_${nomeNorm}`] = dados;

    window.localStorage.setItem(
      STORAGE_KEY_RAIOX_MANUAL_CLIENTES,
      JSON.stringify(mapa)
    );

    const refChave = nomeNorm || cpfLimpo || 'CLIENTE';
    const jsonStr = JSON.stringify(dados);
    const b64 = window.btoa(unescape(encodeURIComponent(jsonStr)));

    await salvarCoringaGavetaSync({
      id: `RAIOX_CLIENTE_${refChave.replace(/[^A-Z0-9]/g, '_')}`,
      tipo: 'RAIOX_CLIENTE_CACHE' as any,
      chaveReferencia: `${refChave}${cpfLimpo ? `_${cpfLimpo}` : ''}`,
      nomeArquivoOriginal: `RAIOX_${refChave}.json`,
      base64Dados: b64,
      dataAtualizacao: new Date().toISOString(),
    });
  } catch {
    // Fallback local garantido
  }
}

export default function TelaConformidadeProjetoCompleta({
  aberto,
  onFechar,
  contratacoes,
  onAbrirConferenciaImoveis,
}: TelaConformidadeProjetoCompletaProps) {
  const [dirHandleRoot, setDirHandleRoot] = useState<any>(null);
  const [nomePasta, setNomePasta] = useState('');
  const [arquivosLidos, setArquivosLidos] = useState<ArquivoLidoConformidade[]>(
    []
  );
  const [subpastasEncontradas, setSubpastasEncontradas] = useState<string[]>(
    []
  );
  const [porteAtivo, setPorteAtivo] = useState<PorteOrganizador>('PRONAF_V');
  const [escopoAtivo, setEscopoAtivo] =
    useState<EscopoOperacaoPasta>('DERIVADA_PURA');
  const [modalidadeAtiva, setModalidadeAtiva] =
    useState<ModalidadeDerivada>('INVESTIMENTO');

  const [titularDetectado, setTitularDetectado] = useState('');
  const [conjugeDetectado, setConjugeDetectado] = useState('');
  const [paDetectado, setPaDetectado] = useState('');
  const [projetistaDetectado, setProjetistaDetectado] = useState('');

  const [auditoriaPdf, setAuditoriaPdf] =
    useState<ResultadoAuditoriaPastaPdf | null>(null);
  const [auditando, setAuditando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<
    'TODOS' | 'PROBLEMAS' | 'OK'
  >('TODOS');
  const [modalImoveisAberto, setModalImoveisAberto] = useState(false);
  const [modalCopilotAberto, setModalCopilotAberto] = useState(false);

  // ITEM 5: Estado do Leitor Leve de PDF Integrado na Coluna Central (Lupinha 🔎)
  const [arquivoVisualizando, setArquivoVisualizando] =
    useState<ArquivoLidoConformidade | null>(null);
  const [urlPdfVisualizando, setUrlPdfVisualizando] = useState<string | null>(
    null
  );
  const [painelEdicaoRapidaAberto, setPainelEdicaoRapidaAberto] =
    useState(false);
  const [textosOcrExtraidos, setTextosOcrExtraidos] = useState<
    Record<string, string>
  >({});
  const [executandoOcr, setExecutandoOcr] = useState(false);
  const [progressoOcrMsg, setProgressoOcrMsg] = useState('');

  // Reconstrói dinamicamente os alertas e diagnósticos (Itens 1, 2 e 10) sempre que o OCR,
  // o Copilot ou a edição manual trouxerem novos dados (fazendo sumir os avisos antigos de "Não foi possível ler")!
  const reconstruirAuditoriaComDadosAtuais = (
    baseAud: ResultadoAuditoriaPastaPdf,
    novos: {
      titular: string;
      cpfTit: string;
      nascTit: string;
      estCivil: string;
      conjuge: string;
      cpfConj: string;
      nascConj: string;
      procNome: string;
      cpfProc: string;
      nascProc: string;
      valor: string;
      prazo: string;
      carencia: string;
      cc: string;
      projetista: string;
      imovel: string;
      area: string;
      car: string;
      itensTexto: string;
    }
  ): ResultadoAuditoriaPastaPdf => {
    const linhasItens = (novos.itensTexto || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const novosDadosProj = {
      ...baseAud.dadosProjetoParaParecer,
      clienteNome: novos.titular,
      clienteCpf: novos.cpfTit,
      clienteDataNascimento: novos.nascTit,
      estadoCivil: novos.estCivil,
      conjugeNome: novos.conjuge,
      conjugeCpf: novos.cpfConj,
      conjugeDataNascimento: novos.nascConj,
      procuradorNomeExtraido: novos.procNome,
      procuradorCpfExtraido: novos.cpfProc,
      procuradorDataNascimento: novos.nascProc,
      valorTotalFinanciado: novos.valor,
      prazoMeses: novos.prazo,
      carenciaMeses: novos.carencia,
      contaCorrenteExtraida: novos.cc,
      projetistaNomeCurtoDetectado: novos.projetista,
      denominacaoImovelPa: novos.imovel,
      areaImovelHa: novos.area,
      textoItensInversaoFormatado: novos.itensTexto,
    };

    const novosDiags = baseAud.itensDiagnostico.map((diag) => {
      // Atualiza o Item 1 (Conta Corrente na Consolidada) se a conta foi lida via OCR/Copilot/Manual
      if (diag.numero === 1 && novos.cc.trim()) {
        return {
          ...diag,
          status: 'OK' as const,
          resumo: `✅ Conta Corrente identificada/confirmada na Consolidada: ${novos.cc.trim()}.`,
        };
      }

      // Atualiza o Item 2 (Valor, Prazo, Carência e Inversões do Projeto) removendo o alerta de "Não foi possível extrair"
      if (
        diag.numero === 2 &&
        (novos.valor.trim() ||
          novos.prazo.trim() ||
          novos.carencia.trim() ||
          linhasItens.length > 0)
      ) {
        return {
          ...diag,
          titulo:
            escopoAtivo === 'LIMITE_PURO'
              ? '2. Valor do Limite Identificado no PDF'
              : '2. Valor, Prazo, Carência, Elaborador e Inversões Extraídos do Projeto',
          status: 'OK' as const,
          resumo: `Valor: R$ ${novos.valor.trim() || '0,00'}${
            novos.prazo.trim() ? ` • Prazo: ${novos.prazo.trim()} meses` : ''
          }${
            novos.carencia.trim()
              ? ` • Carência: ${novos.carencia.trim()} meses`
              : ''
          }${
            novos.projetista.trim()
              ? ` • Elaborador: ${novos.projetista.trim()}`
              : ''
          }`,
          detalhes: [
            novosDadosProj.programaCredito
              ? `📑 Programa lido no PDF: ${novosDadosProj.programaCredito}`
              : '',
            ...linhasItens.map(
              (linha) => `📦 Inversão: ${linha.replace(/^[-•*]\s*/, '')}`
            ),
          ].filter(Boolean),
        };
      }

      // Atualiza o Item 10 (Estado Civil e Cônjuge) conforme o que estiver definido no Raio-X
      if (diag.numero === 10) {
        const estUp = novos.estCivil.toUpperCase().trim();
        const semConjuge =
          estUp.includes('SOLTEIR') ||
          estUp.includes('DIVORCIAD') ||
          estUp.includes('VIUV') ||
          estUp.includes('VIÚV') ||
          (!novos.conjuge.trim() && !estUp.includes('CASAD') && !estUp.includes('UNIAO') && !estUp.includes('UNIÃO'));

        if (semConjuge) {
          return {
            ...diag,
            status: 'OK' as const,
            resumo: `Titular ${
              novos.estCivil || 'Solteiro(a)'
            } / Sem Cônjuge (Não exige certidões nem documentos de cônjuge).`,
          };
        }
      }

      return diag;
    });

    return {
      ...baseAud,
      valorPropostaDetectado: novos.valor,
      prazoMesesDetectado: novos.prazo,
      carenciaMesesDetectada: novos.carencia,
      contaCorrenteConsolidada: novos.cc,
      statusContaConsolidada: novos.cc.trim()
        ? 'OK'
        : baseAud.statusContaConsolidada,
      carEspecificoDetectado: novos.car,
      estadoCivilDetectado: novos.estCivil,
      conjugeDetectadoNosPdfs: novos.conjuge,
      projetistaCurtoDetectado: novos.projetista,
      paDetectadoNoProjeto: novos.imovel,
      textoItensInversaoFormatado: novos.itensTexto,
      dadosProjetoParaParecer: novosDadosProj,
      itensDiagnostico: novosDiags,
    };
  };

  // ITEM 1 e 4: Executa OCR Óptico (Tesseract.js) nas páginas do PDF aberto na Lupinha,
  // reclassifica o documento se necessário e atualiza imediatamente os alertas, Raio-X e Inversões!
  const rodarOcrNoPdfAbertoEReauditar = async (
    arqAlvo: ArquivoLidoConformidade
  ) => {
    if (executandoOcr) return;
    setExecutandoOcr(true);
    setProgressoOcrMsg(`⏳ Iniciando OCR em "${arqAlvo.nomeOriginal}"...`);
    try {
      const textoExtraidoOcr = await executarOcrEmPdfEscaneado(
        arqAlvo.fileObj,
        (msg) => setProgressoOcrMsg(msg)
      );

      if (!textoExtraidoOcr || textoExtraidoOcr.trim().length < 20) {
        alert(
          '⚠️ O OCR não conseguiu identificar texto legível suficiente nas imagens deste PDF.'
        );
        return;
      }

      const novoMapaOcr = {
        ...textosOcrExtraidos,
        [arqAlvo.nomeOriginal]: textoExtraidoOcr,
      };
      setTextosOcrExtraidos(novoMapaOcr);

      setProgressoOcrMsg(
        '🔄 Re-auditando documentos e atualizando alertas com o texto do OCR...'
      );

      const resAud = await executarAuditoriaCompletaDosPdfsDaPasta({
        arquivos: arquivosLidos
          .filter((m) => !m.ehTxtPendencia)
          .map((m) => ({
            fileObj: m.fileObj,
            categoria: converterCategoriaParaAuditor(m.categoria),
            isViti: m.isViti,
            nomeOriginal: m.nomeOriginal,
          })),
        titularNome: titularDetectado,
        conjugeNome: conjugeDetectado,
        paEsperado: paDetectado,
        porteSelecionado: porteAtivo,
        escopoSelecionado: escopoAtivo,
        modalidadeDerivada: modalidadeAtiva,
        textosOcrOverride: novoMapaOcr,
      });

      // Se o OCR permitiu identificar a categoria real de um PDF antes não identificado, atualiza na lista!
      const mapaConteudo = resAud.reclassificacoesPorConteudo || {};
      const mapaSocio = resAud.reclassificacoesSocioambiental || {};
      setArquivosLidos((prev) =>
        prev.map((m) => {
          if (m.ehTxtPendencia || m.isViti) return m;
          const catS = mapaSocio[m.nomeOriginal];
          if (catS) return { ...m, categoria: catS };
          const catC = mapaConteudo[m.nomeOriginal] as
            | CategoriaDocPasta
            | undefined;
          if (catC && m.categoria === 'OUTROS_NAO_IDENTIFICADO') {
            return { ...m, categoria: catC };
          }
          return m;
        })
      );

      // Atualiza imediatamente o Raio-X e a Gaveta de Transcrição com tudo o que o OCR descobriu!
      const d = resAud.dadosProjetoParaParecer;
      const novoTit = d?.clienteNome || titularDetectado;
      const novoCpfTit = d?.clienteCpf || editCpfTitular;
      const novoNascTit = d?.clienteDataNascimento || editNascTitular;
      const novoEstCivil = resAud.estadoCivilDetectado || editEstadoCivil;
      const novoConj = resAud.conjugeDetectadoNosPdfs || conjugeDetectado;
      const novoCpfConj = d?.conjugeCpf || editCpfConjuge;
      const novoNascConj = d?.conjugeDataNascimento || editNascConjuge;
      const novoProc = d?.procuradorNomeExtraido || editProcuradorNome;
      const novoCpfProc = d?.procuradorCpfExtraido || editCpfProcurador;
      const novoNascProc = d?.procuradorDataNascimento || editNascProcurador;
      const novoVal = resAud.valorPropostaDetectado || editValorProj;
      const novoPrazo = resAud.prazoMesesDetectado || editPrazoProj;
      const novaCar = resAud.carenciaMesesDetectada || editCarenciaProj;
      const novaCc = resAud.contaCorrenteConsolidada || editCcConsol;
      const novoProj = resAud.projetistaCurtoDetectado || projetistaDetectado;
      const novoPa = resAud.paDetectadoNoProjeto || paDetectado;
      const novaArea = d?.areaImovelHa || editAreaHa;
      const novoCar = resAud.carEspecificoDetectado || editCarRecibo;
      const novosItens = resAud.textoItensInversaoFormatado || editItensTexto;

      setTitularDetectado(novoTit);
      setEditCpfTitular(novoCpfTit);
      setEditNascTitular(novoNascTit);
      setEditEstadoCivil(novoEstCivil);
      setConjugeDetectado(novoConj);
      setEditCpfConjuge(novoCpfConj);
      setEditNascConjuge(novoNascConj);
      setEditProcuradorNome(novoProc);
      setEditCpfProcurador(novoCpfProc);
      setEditNascProcurador(novoNascProc);
      setEditValorProj(novoVal);
      setEditPrazoProj(novoPrazo);
      setEditCarenciaProj(novaCar);
      setEditCcConsol(novaCc);
      setProjetistaDetectado(novoProj);
      setPaDetectado(novoPa);
      setEditAreaHa(novaArea);
      setEditCarRecibo(novoCar);
      setEditItensTexto(novosItens);

      const audAtualizada = reconstruirAuditoriaComDadosAtuais(resAud, {
        titular: novoTit,
        cpfTit: novoCpfTit,
        nascTit: novoNascTit,
        estCivil: novoEstCivil,
        conjuge: novoConj,
        cpfConj: novoCpfConj,
        nascConj: novoNascConj,
        procNome: novoProc,
        cpfProc: novoCpfProc,
        nascProc: novoNascProc,
        valor: novoVal,
        prazo: novoPrazo,
        carencia: novaCar,
        cc: novaCc,
        projetista: novoProj,
        imovel: novoPa,
        area: novaArea,
        car: novoCar,
        itensTexto: novosItens,
      });

      setAuditoriaPdf(audAtualizada);
      salvarDadosExtraidosParaParecer(audAtualizada.dadosProjetoParaParecer);

      // Se o arquivo lido via OCR era o Projeto ou Consolidada, já abre a barra de conferência para mostrar os dados preenchidos!
      if (
        arqAlvo.categoria === 'ITEM_PROJETO_PDF' ||
        arqAlvo.categoria === 'ITEM_CONSOLIDADAS' ||
        resAud.valorPropostaDetectado ||
        resAud.textoItensInversaoFormatado ||
        resAud.contaCorrenteConsolidada
      ) {
        setPainelEdicaoRapidaAberto(true);
      }

      alert(
        `✅ OCR concluído com sucesso em "${arqAlvo.nomeOriginal}"!\n\nOs alertas, o Raio-X e os dados do documento foram revalidados e atualizados!`
      );
    } catch (err) {
      console.error('Erro no OCR:', err);
      alert('❌ Erro ao processar OCR neste documento.');
    } finally {
      setExecutandoOcr(false);
      setProgressoOcrMsg('');
    }
  };
  // Estados Editáveis do "📋 RAIO-X EXTRAÍDO DO PROJETO" (Sincronizados com Nuvem + Cache Parecer)
  const [editCpfTitular, setEditCpfTitular] = useState('');
  const [editNascTitular, setEditNascTitular] = useState('');
  const [editEstadoCivil, setEditEstadoCivil] = useState('');
  const [editCpfConjuge, setEditCpfConjuge] = useState('');
  const [editNascConjuge, setEditNascConjuge] = useState('');
  const [editProcuradorNome, setEditProcuradorNome] = useState('');
  const [editCpfProcurador, setEditCpfProcurador] = useState('');
  const [editNascProcurador, setEditNascProcurador] = useState('');
  const [editValorProj, setEditValorProj] = useState('');
  const [editPrazoProj, setEditPrazoProj] = useState('');
  const [editCarenciaProj, setEditCarenciaProj] = useState('');
  const [editCcConsol, setEditCcConsol] = useState('');
  const [editAreaHa, setEditAreaHa] = useState('');
  const [editCarRecibo, setEditCarRecibo] = useState('');
  const [editItensTexto, setEditItensTexto] = useState('');
  const [statusSalvoRaioX, setStatusSalvoRaioX] = useState('');
  const [modoEdicaoRaioX, setModoEdicaoRaioX] = useState(false);
  const [chaveCopiadaRaioX, setChaveCopiadaRaioX] = useState('');

  const copiarValorRaioX = (chave: string, valor: string) => {
    if (!valor || !valor.trim()) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(valor.trim()).catch(() => {});
    }
    setChaveCopiadaRaioX(chave);
    setTimeout(() => setChaveCopiadaRaioX(''), 2000);
  };

  // Carrega todos os registros do Modal de Conformidade PRONAF A
  const todosItensConformidadePronafA = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const acumulados: ItemConformidadePronafA[] = [];
    try {
      const raw = window.localStorage.getItem(
        STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A
      );
      if (raw) {
        const listas: ListaSalvaConformidadePronafA[] = JSON.parse(raw);
        listas.forEach((l) => {
          (l.itens || []).forEach((it) => {
            if (it.nomeCliente && it.nomeCliente.trim()) {
              acumulados.push(it);
            }
          });
        });
      }
    } catch {
      // Ignora erro
    }
    return acumulados;
  }, [aberto, nomePasta]);

  // Cruza o cliente atual com a Planilha de Conformidade PRONAF A
  const registroConformidadePronafAVinculado = useMemo(() => {
    const nomeLimpo = normalizarSemAcento(titularDetectado || nomePasta);
    const cpfLimpo = (
      editCpfTitular ||
      auditoriaPdf?.dadosProjetoParaParecer?.clienteCpf ||
      ''
    ).replace(/\D/g, '');

    if (nomeLimpo.length < 3 && cpfLimpo.length < 9) return null;

    return (
      todosItensConformidadePronafA.find((it) => {
        const itCpf = (it.cpfCliente || '').replace(/\D/g, '');
        if (cpfLimpo.length >= 9 && itCpf === cpfLimpo) return true;

        const nIt = normalizarSemAcento(it.nomeCliente);
        const primIt = extrairPrimeiroNome(nIt);
        return (
          nIt === nomeLimpo ||
          (nomeLimpo.length >= 5 &&
            (nIt.startsWith(nomeLimpo) || nomeLimpo.startsWith(nIt))) ||
          (nomeLimpo.split(/\s+/).length === 1 && primIt === nomeLimpo)
        );
      }) || null
    );
  }, [
    titularDetectado,
    nomePasta,
    editCpfTitular,
    auditoriaPdf,
    todosItensConformidadePronafA,
  ]);

  // Diagnóstico de Restrições e Pendências vindas do Modal de Conformidade PRONAF A
  const alertasConformidadePronafA = useMemo(() => {
    const reg = registroConformidadePronafAVinculado;
    if (!reg) return [];

    const apontamentos: Array<{
      id: string;
      nivel: 'ERRO' | 'ALERTA' | 'OK';
      texto: string;
      responsavel: 'ANALISTA_BANCO' | 'PROJETISTA_CLIENTE';
    }> = [];

    // 1. Visita Técnica / Gerencial
    if (
      reg.visitado &&
      (reg.visitado.toUpperCase() === 'NAO' ||
        reg.visitado.toUpperCase() === 'NÃO')
    ) {
      apontamentos.push({
        id: 'CONF_VISITA',
        nivel: 'ALERTA',
        texto:
          '⚠️ Conformidade PRONAF A: Cliente consta como NÃO VISITADO na planilha de conformidade.',
        responsavel: 'ANALISTA_BANCO',
      });
    }

    // 2. Situação Cadastral do Titular (S400)
    const cadCliUp = (reg.cadastroClienteOk || '').toUpperCase().trim();
    if (cadCliUp && cadCliUp !== 'OK') {
      apontamentos.push({
        id: 'CONF_CAD_TITULAR',
        nivel: 'ERRO',
        texto: `🚨 Conformidade PRONAF A: Cadastro do Titular consta como "${
          reg.cadastroClienteOk
        }"${
          reg.dataRefCadastral ? ` (Data ref.: ${reg.dataRefCadastral})` : ''
        }.`,
        responsavel: 'ANALISTA_BANCO',
      });
    }

    // 3. Restrições do Titular
    const restCliUp = (reg.restricaoClienteNivel || '').toUpperCase().trim();
    if (restCliUp && restCliUp !== 'SEM_RESTRICAO') {
      const ehGrave =
        restCliUp.includes('GRAVE') || restCliUp.includes('IMPEDITIV');
      apontamentos.push({
        id: 'CONF_REST_TITULAR',
        nivel: ehGrave ? 'ERRO' : 'ALERTA',
        texto: `${
          ehGrave ? '🚨 IMPEDIMENTO' : '⚠️ RESTRIÇÃO LEVE'
        } na Conformidade PRONAF A (Titular): ${
          reg.restricaoClienteDetalhe || reg.restricaoClienteNivel
        }${
          !ehGrave
            ? ' (Incluir justificativa no item 2.2 do Parecer Gerencial)'
            : ''
        }.`,
        responsavel: ehGrave ? 'PROJETISTA_CLIENTE' : 'ANALISTA_BANCO',
      });
    }

    // 4. Cadastro e Restrições do Cônjuge
    if (reg.conjugeNome && reg.conjugeNome.trim()) {
      const cadConjUp = (reg.cadastroConjugeOk || '').toUpperCase().trim();
      if (
        cadConjUp &&
        cadConjUp !== 'OK' &&
        cadConjUp !== 'NAO_SE_APLICA' &&
        cadConjUp !== 'NÃO SE APLICA'
      ) {
        apontamentos.push({
          id: 'CONF_CAD_CONJUGE',
          nivel: 'ERRO',
          texto: `🚨 Conformidade PRONAF A: Cadastro do Cônjuge (${reg.conjugeNome}) consta como "${reg.cadastroConjugeOk}".`,
          responsavel: 'ANALISTA_BANCO',
        });
      }

      const restConjUp = (reg.restricaoConjugeNivel || '').toUpperCase().trim();
      if (
        restConjUp &&
        restConjUp !== 'SEM_RESTRICAO' &&
        restConjUp !== 'NAO_SE_APLICA'
      ) {
        const ehGrave =
          restConjUp.includes('GRAVE') || restConjUp.includes('IMPEDITIV');
        apontamentos.push({
          id: 'CONF_REST_CONJUGE',
          nivel: ehGrave ? 'ERRO' : 'ALERTA',
          texto: `${
            ehGrave ? '🚨 IMPEDIMENTO' : '⚠️ RESTRIÇÃO LEVE'
          } na Conformidade PRONAF A (Cônjuge - ${reg.conjugeNome}): ${
            reg.restricaoConjugeDetalhe || reg.restricaoConjugeNivel
          }.`,
          responsavel: ehGrave ? 'PROJETISTA_CLIENTE' : 'ANALISTA_BANCO',
        });
      }
    }

    // 5. Cadastro e Restrições do Procurador
    if (reg.procuradorNome && reg.procuradorNome.trim()) {
      const cadProcUp = (reg.cadastroProcuradorOk || '').toUpperCase().trim();
      if (
        cadProcUp &&
        cadProcUp !== 'OK' &&
        cadProcUp !== 'NAO_SE_APLICA' &&
        cadProcUp !== 'NÃO SE APLICA'
      ) {
        apontamentos.push({
          id: 'CONF_CAD_PROC',
          nivel: 'ERRO',
          texto: `🚨 Conformidade PRONAF A: Cadastro do Procurador (${reg.procuradorNome}) consta como "${reg.cadastroProcuradorOk}".`,
          responsavel: 'ANALISTA_BANCO',
        });
      }

      const restProcUp = (reg.restricaoProcuradorNivel || '')
        .toUpperCase()
        .trim();
      if (
        restProcUp &&
        restProcUp !== 'SEM_RESTRICAO' &&
        restProcUp !== 'NAO_SE_APLICA'
      ) {
        const ehGrave =
          restProcUp.includes('GRAVE') || restProcUp.includes('IMPEDITIV');
        apontamentos.push({
          id: 'CONF_REST_PROC',
          nivel: ehGrave ? 'ERRO' : 'ALERTA',
          texto: `${
            ehGrave ? '🚨 IMPEDIMENTO' : '⚠️ RESTRIÇÃO LEVE'
          } na Conformidade PRONAF A (Procurador - ${reg.procuradorNome}): ${
            reg.restricaoProcuradorDetalhe || reg.restricaoProcuradorNivel
          }.`,
          responsavel: ehGrave ? 'PROJETISTA_CLIENTE' : 'ANALISTA_BANCO',
        });
      }
    }

    // 6. Conta Corrente na Planilha de Conformidade
    const ccReg = (reg.contaCorrente || '').toUpperCase().trim();
    if (!ccReg || ccReg.includes('SEM CONTA') || ccReg.includes('ABRIR')) {
      apontamentos.push({
        id: 'CONF_SEM_CONTA',
        nivel: 'ERRO',
        texto: `🚨 Conformidade PRONAF A: Cliente está "${
          reg.contaCorrente || 'SEM CONTA CORRENTE'
        }" na planilha de conformidade!`,
        responsavel: 'ANALISTA_BANCO',
      });
    }

    return apontamentos;
  }, [registroConformidadePronafAVinculado]);

  // Controla para que a carga inicial do Raio-X ocorra apenas ao abrir a pasta (sem nunca sobrescrever ou travar edições manuais!)
  const [pastaRaioXInicializada, setPastaRaioXInicializada] = useState('');

  useEffect(() => {
    if (!auditoriaPdf || !nomePasta) return;
    if (pastaRaioXInicializada === nomePasta) return;

    const d = auditoriaPdf.dadosProjetoParaParecer;
    const regConf = registroConformidadePronafAVinculado;

    const contr = contratacoes.find(
      (c) =>
        removerAcentos(c.cliente).toUpperCase().trim() ===
        removerAcentos(d?.clienteNome || titularDetectado)
          .toUpperCase()
          .trim()
    );

    const cpfInicial =
      d?.clienteCpf || regConf?.cpfCliente || contr?.cpf || '';
    const salvoManual = buscarRaioXSalvoDoCliente(
      d?.clienteNome || titularDetectado,
      cpfInicial,
      nomePasta
    );

    // Usa coalescência nula (??) quando existe salvoManual: se o usuário apagou um campo errado e deixou "",
    // respeita o "" sem forçar de volta o dado equivocado da varredura!
    const titFinal = salvoManual
      ? salvoManual.titularNome ?? ''
      : d?.clienteNome || titularDetectado || '';
    const conjFinal = salvoManual
      ? salvoManual.conjugeNome ?? ''
      : auditoriaPdf.conjugeDetectadoNosPdfs ||
        conjugeDetectado ||
        regConf?.conjugeNome ||
        '';
    const projFinal = salvoManual
      ? salvoManual.projetista ?? ''
      : auditoriaPdf.projetistaCurtoDetectado || projetistaDetectado || '';
    const paFinal = salvoManual
      ? salvoManual.imovelPa ?? ''
      : auditoriaPdf.paDetectadoNoProjeto || paDetectado || '';

    const cpfTitFinal = salvoManual ? salvoManual.titularCpf ?? '' : cpfInicial;
    const nascTitFinal = salvoManual
      ? salvoManual.titularDataNasc ?? ''
      : d?.clienteDataNascimento || '';
    const estCivilFinal = salvoManual
      ? salvoManual.estadoCivil ?? ''
      : auditoriaPdf.estadoCivilDetectado || '';
    const cpfConjFinal = salvoManual
      ? salvoManual.conjugeCpf ?? ''
      : d?.conjugeCpf || regConf?.conjugeCpf || '';
    const nascConjFinal = salvoManual
      ? salvoManual.conjugeDataNasc ?? ''
      : d?.conjugeDataNascimento || '';
    const procNomeFinal = salvoManual
      ? salvoManual.procuradorNome ?? ''
      : d?.procuradorNomeExtraido || regConf?.procuradorNome || '';
    const cpfProcFinal = salvoManual
      ? salvoManual.procuradorCpf ?? ''
      : d?.procuradorCpfExtraido || regConf?.procuradorCpf || '';
    const nascProcFinal = salvoManual
      ? salvoManual.procuradorDataNasc ?? ''
      : d?.procuradorDataNascimento || '';
    const valFinal = salvoManual
      ? salvoManual.valorFinanciado ?? ''
      : auditoriaPdf.valorPropostaDetectado || '';
    const prazoFinal = salvoManual
      ? salvoManual.prazoMeses ?? ''
      : auditoriaPdf.prazoMesesDetectado || '';
    const carFinal = salvoManual
      ? salvoManual.carenciaMeses ?? ''
      : auditoriaPdf.carenciaMesesDetectada || '';
    const ccFinal = salvoManual
      ? salvoManual.contaCorrente ?? ''
      : auditoriaPdf.contaCorrenteConsolidada || regConf?.contaCorrente || '';
    const areaFinal = salvoManual
      ? salvoManual.areaHa ?? ''
      : d?.areaImovelHa || '';
    const carReciboFinal = salvoManual
      ? salvoManual.reciboCar ?? ''
      : auditoriaPdf.carEspecificoDetectado || '';
    const itensFinal = auditoriaPdf.textoItensInversaoFormatado || '';

    setTitularDetectado(titFinal);
    setConjugeDetectado(conjFinal);
    setProjetistaDetectado(projFinal);
    setPaDetectado(paFinal);
    setEditCpfTitular(cpfTitFinal);
    setEditNascTitular(nascTitFinal);
    setEditEstadoCivil(estCivilFinal);
    setEditCpfConjuge(cpfConjFinal);
    setEditNascConjuge(nascConjFinal);
    setEditProcuradorNome(procNomeFinal);
    setEditCpfProcurador(cpfProcFinal);
    setEditNascProcurador(nascProcFinal);
    setEditValorProj(valFinal);
    setEditPrazoProj(prazoFinal);
    setEditCarenciaProj(carFinal);
    setEditCcConsol(ccFinal);
    setEditAreaHa(areaFinal);
    setEditCarRecibo(carReciboFinal);
    setEditItensTexto(itensFinal);

    setPastaRaioXInicializada(nomePasta);

    if (salvoManual) {
      setAuditoriaPdf((prev) =>
        prev
          ? reconstruirAuditoriaComDadosAtuais(prev, {
              titular: titFinal,
              cpfTit: cpfTitFinal,
              nascTit: nascTitFinal,
              estCivil: estCivilFinal,
              conjuge: conjFinal,
              cpfConj: cpfConjFinal,
              nascConj: nascConjFinal,
              procNome: procNomeFinal,
              cpfProc: cpfProcFinal,
              nascProc: nascProcFinal,
              valor: valFinal,
              prazo: prazoFinal,
              carencia: carFinal,
              cc: ccFinal,
              projetista: projFinal,
              imovel: paFinal,
              area: areaFinal,
              car: carReciboFinal,
              itensTexto: itensFinal,
            })
          : prev
      );
    }
  }, [auditoriaPdf, nomePasta, pastaRaioXInicializada, registroConformidadePronafAVinculado]);

  const salvarAjustesManuaisDaLupinha = async (
    silencioso = false,
    overridesOpcionais?: Partial<{
      titular: string;
      cpfTit: string;
      nascTit: string;
      estCivil: string;
      conjuge: string;
      cpfConj: string;
      nascConj: string;
      procNome: string;
      cpfProc: string;
      nascProc: string;
      valor: string;
      prazo: string;
      carencia: string;
      cc: string;
      projetista: string;
      imovel: string;
      area: string;
      car: string;
      itensTexto: string;
    }>
  ) => {
    const atual = {
      titular: overridesOpcionais?.titular ?? titularDetectado,
      cpfTit: overridesOpcionais?.cpfTit ?? editCpfTitular,
      nascTit: overridesOpcionais?.nascTit ?? editNascTitular,
      estCivil: overridesOpcionais?.estCivil ?? editEstadoCivil,
      conjuge: overridesOpcionais?.conjuge ?? conjugeDetectado,
      cpfConj: overridesOpcionais?.cpfConj ?? editCpfConjuge,
      nascConj: overridesOpcionais?.nascConj ?? editNascConjuge,
      procNome: overridesOpcionais?.procNome ?? editProcuradorNome,
      cpfProc: overridesOpcionais?.cpfProc ?? editCpfProcurador,
      nascProc: overridesOpcionais?.nascProc ?? editNascProcurador,
      valor: overridesOpcionais?.valor ?? editValorProj,
      prazo: overridesOpcionais?.prazo ?? editPrazoProj,
      carencia: overridesOpcionais?.carencia ?? editCarenciaProj,
      cc: overridesOpcionais?.cc ?? editCcConsol,
      projetista: overridesOpcionais?.projetista ?? projetistaDetectado,
      imovel: overridesOpcionais?.imovel ?? paDetectado,
      area: overridesOpcionais?.area ?? editAreaHa,
      car: overridesOpcionais?.car ?? editCarRecibo,
      itensTexto: overridesOpcionais?.itensTexto ?? editItensTexto,
    };

    const pacoteRaioX: DadosRaioXManualCliente = {
      chaveCliente: normalizarSemAcento(atual.titular || nomePasta),
      titularNome: atual.titular,
      titularCpf: atual.cpfTit,
      titularDataNasc: atual.nascTit,
      estadoCivil: atual.estCivil,
      conjugeNome: atual.conjuge,
      conjugeCpf: atual.cpfConj,
      conjugeDataNasc: atual.nascConj,
      procuradorNome: atual.procNome,
      procuradorCpf: atual.cpfProc,
      procuradorDataNasc: atual.nascProc,
      valorFinanciado: atual.valor,
      prazoMeses: atual.prazo,
      carenciaMeses: atual.carencia,
      contaCorrente: atual.cc,
      projetista: atual.projetista,
      imovelPa: atual.imovel,
      areaHa: atual.area,
      reciboCar: atual.car,
      atualizadoEm: new Date().toISOString(),
    };

    await salvarRaioXDoClienteLocalENuvem(pacoteRaioX);

    if (auditoriaPdf) {
      const audReconstruida = reconstruirAuditoriaComDadosAtuais(
        auditoriaPdf,
        atual
      );
      salvarDadosExtraidosParaParecer(audReconstruida.dadosProjetoParaParecer);
      setAuditoriaPdf(audReconstruida);
    }

    setStatusSalvoRaioX('☁️ Salvo na Nuvem!');
    setTimeout(() => setStatusSalvoRaioX(''), 3500);

    if (!silencioso) {
      setPainelEdicaoRapidaAberto(false);
      alert(
        '✅ Dados atualizados no Raio-X, nos Alertas da Auditoria e no Cache do Parecer!'
      );
    }
  };

  useEffect(() => {
    if (!arquivoVisualizando) {
      setUrlPdfVisualizando(null);
      return;
    }
    const url = URL.createObjectURL(arquivoVisualizando.fileObj);
    setUrlPdfVisualizando(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [arquivoVisualizando]);

  const executarVarreduraCompletaDaPasta = async (
    handle: any,
    forcarPorte?: PorteOrganizador,
    forcarEscopo?: EscopoOperacaoPasta,
    forcarModalidade?: ModalidadeDerivada
  ) => {
    setDirHandleRoot(handle);
    setNomePasta(handle.name);
    setPastaRaioXInicializada('');
    setAuditando(true);
    setArquivoVisualizando(null);

    const entradasBrutas: Array<{ file: File; subpasta: string }> = [];
    const subpastasSet = new Set<string>();

    const varrerRecursivo = async (
      dirAtual: any,
      caminhoRel: string,
      profundidade = 0
    ) => {
      if (profundidade > 4) return;
      try {
        for await (const [entryName, entryHandle] of dirAtual.entries()) {
          if (
            !entryName ||
            entryName.startsWith('.') ||
            entryName.startsWith('~$') ||
            entryName.toLowerCase() === 'thumbs.db' ||
            entryName.toLowerCase() === 'desktop.ini'
          ) {
            continue;
          }

          if (entryHandle.kind === 'file') {
            try {
              const file: File = await entryHandle.getFile();
              entradasBrutas.push({ file, subpasta: caminhoRel });
            } catch {
              // Ignora arquivo bloqueado
            }
          } else if (entryHandle.kind === 'directory') {
            const novoCaminho = caminhoRel
              ? `${caminhoRel}/${entryName}`
              : entryName;
            subpastasSet.add(entryName.toUpperCase().trim());
            await varrerRecursivo(entryHandle, novoCaminho, profundidade + 1);
          }
        }
      } catch {
        // Ignora pasta bloqueada
      }
    };

    await varrerRecursivo(handle, '', 0);
    setSubpastasEncontradas(Array.from(subpastasSet));

    let porteDet: PorteOrganizador = forcarPorte || porteAtivo;
    let escopoDet: EscopoOperacaoPasta = forcarEscopo || escopoAtivo;
    let modDet: ModalidadeDerivada = forcarModalidade || modalidadeAtiva;
    let titDet = '';
    let conjDet = '';
    let paDet = '';
    let projDet = '';
    let achouLimite =
      subpastasSet.has('LCGH') || subpastasSet.has('LCGA') || false;
    let achouDerivada =
      subpastasSet.has('INVESTIMENTO') ||
      subpastasSet.has('CUSTEIO') ||
      false;

    if (subpastasSet.has('CUSTEIO') && !forcarModalidade) {
      modDet = 'CUSTEIO';
    } else if (subpastasSet.has('INVESTIMENTO') && !forcarModalidade) {
      modDet = 'INVESTIMENTO';
    }

    entradasBrutas.forEach(({ file }) => {
      const up = file.name.toUpperCase();
      if (!forcarPorte) {
        if (up.includes('.PRONAF_A') || up.includes('RB DO P.A')) {
          porteDet = 'PRONAF_A';
        } else if (up.includes('.INVUR')) {
          porteDet = 'MINI_PEQUENO';
          achouDerivada = true;
        } else if (up.includes('.PRONAF')) {
          if (porteDet !== 'PRONAF_A') porteDet = 'PRONAF_V';
          achouDerivada = true;
        }
      }
      if (!forcarModalidade && up.includes('.CUSTEIO')) {
        modDet = 'CUSTEIO';
        achouDerivada = true;
      }
      if (
        up.includes('SOLICITACAO DE ABERTURA') ||
        up.includes('SOLICITACAO DE LIMITE') ||
        up.includes('SOLICITACAO DO LIMITE')
      ) {
        achouLimite = true;
      }

      const matchJaOrg = up.match(
        /^\d+(?:\.\d+)?\.\s*(?:PROJETO|DECLARA[ÇC][ÕO]ES CONSOLIDADAS|CONTRATO DE ASSESSORIA|CAF|DCAA)\s*[-–]\s*([A-ZÀ-Ú ]+?)\.(?:PDF|PRONAF|INVUR)/i
      );
      if (matchJaOrg && matchJaOrg[1] && !titDet) {
        titDet = matchJaOrg[1].trim();
      }
      const matchPa = up.match(
        /(P\.?A\.?\s+[A-ZÀ-Ú0-9 ]+?)(?:_COMPRESSED|_ASSINADO|\.PDF|$)/i
      );
      if (matchPa && matchPa[1]) {
        paDet = matchPa[1].replace(/^PA\s+/i, 'P.A ').trim();
      }
      const matchCrea = up.match(
        /CREA\s*[-–]\s*([A-ZÀ-Ú0-9_ ]+?)(?:\.PDF|$)/i
      );
      if (matchCrea && matchCrea[1]) {
        projDet = matchCrea[1].trim();
      }
    });

if (!titDet && handle.name) {
      titDet = handle.name
        .replace(/^\d+\s*[-–.]\s*/, '')
        .toUpperCase()
        .trim();
    }

    // Autodetecta o nome do Cônjuge se houver um segundo arquivo "IDENTIDADE - NOME" diferente do Titular na pasta!
    const primTitTemp = extrairPrimeiroNome(titDet);
    entradasBrutas.forEach(({ file }) => {
      const up = removerAcentos(file.name)
        .toUpperCase()
        .replace(/_/g, ' ')
        .replace(/^\d+\.\s*/, '')
        .trim();
      if (up.startsWith('IDENTIDADE ') || up.startsWith('RG ')) {
        const resto = up
          .replace(/^(IDENTIDADE|RG)\s*[-–]?\s*/, '')
          .replace(/\.PDF$/i, '')
          .replace(/ASSINADO/g, '')
          .trim();
        const primResto = extrairPrimeiroNome(resto);
        if (primResto && primResto !== primTitTemp && !conjDet) {
          conjDet = resto;
        }
      }
    });

    if (!forcarEscopo) {
      if (porteDet === 'PRONAF_A') {
        escopoDet = 'PRONAF_A_PADRAO';
      } else if (achouLimite && achouDerivada) {
        escopoDet = 'COMBO_DERIVADA_E_LIMITE';
      } else if (achouLimite && !achouDerivada) {
        escopoDet = 'LIMITE_PURO';
      } else {
        escopoDet = 'DERIVADA_PURA';
      }
    }

    const primTit = extrairPrimeiroNome(titDet);
    const primConj = extrairPrimeiroNome(conjDet);

    const mapeados: ArquivoLidoConformidade[] = entradasBrutas.map(
      ({ file, subpasta }, idx) => {
        const partes = file.name.split('.');
        const ext = partes.length > 1 ? (partes.pop() || '').toLowerCase() : '';
        // QUALQUER arquivo .TXT criado pelo Organizador (Embargos, Improbidade, CNDT, SICOR, Falta..., etc.)
        // é um lembrete de pendência, EXCETO o Parecer Gerencial quando já for o parecer real sem "FALTA"!
        const ehTxtPendencia =
          ext === 'txt' && !isArquivoParecerGerencialReal(file.name);

        const classif = classificarArquivoUniversal(
          file.name,
          primTit,
          primConj,
          escopoDet
        );

        return {
          id: `conf_arq_${idx}_${Date.now()}`,
          nomeOriginal: file.name,
          caminhoSubpasta: subpasta,
          extensao: ext,
          fileObj: file,
          categoria: classif.categoria,
          isViti: classif.isViti,
          ehTxtPendencia,
        };
      }
    );

    // =========================================================================
    // ITEM 3: SINCRONIZAÇÃO COM A GAVETA DE CORINGAS DO ORGANIZADOR
    // (Injeta RB do P.A., CREA, CAR do P.A. e Parecer SEMA se faltarem na pasta!)
    // =========================================================================
    const coringasSalvos = await obterCoringasDaGavetaUniversal();

    // 1º Passo: Fazemos uma leitura rápida do Projeto se paDet ou projDet ainda estiverem vazios
    let paAlvoGaveta = paDet;
    let projAlvoGaveta = projDet;

    try {
      // Injeta preliminarmente se já soubermos paAlvoGaveta ou projAlvoGaveta
      const injetarCoringaSeFaltar = async (
        cat: CategoriaDocPasta,
        tipoCoringa: string,
        chaveBusca?: string,
        nomePadraoGravar?: string
      ) => {
        const jaTem = mapeados.some((m) => m.categoria === cat);
        if (jaTem) return;

        const coringa = coringasSalvos.find((c) => {
          if (c.tipo !== tipoCoringa) return false;
          if (!chaveBusca) return true;
          const refNorm = normalizarSemAcento(c.chaveReferencia);
          const buscaNorm = normalizarSemAcento(chaveBusca);
          return (
            refNorm === buscaNorm ||
            refNorm.includes(buscaNorm) ||
            buscaNorm.includes(refNorm)
          );
        });

        if (coringa) {
          const buffer = base64ParaArrayBuffer(coringa.base64Dados);
          const nomeFinal =
            nomePadraoGravar || coringa.nomeArquivoOriginal || `${tipoCoringa}.pdf`;
          const fileCoringa = new File([buffer], nomeFinal, {
            type: 'application/pdf',
          });

          // Grava fisicamente na pasta do cliente para que a pasta já fique completa!
          try {
            const fh = await handle.getFileHandle(nomeFinal, { create: true });
            const wr = await fh.createWritable();
            await wr.write(buffer);
            await wr.close();
          } catch {
            // Se somente leitura, mantém em memória
          }

          mapeados.push({
            id: `coringa_${tipoCoringa}_${Date.now()}`,
            nomeOriginal: `[GAVETA SINCRONIZADA] ${nomeFinal}`,
            caminhoSubpasta: '',
            extensao: 'pdf',
            fileObj: fileCoringa,
            categoria: cat,
            isViti: false,
            ehTxtPendencia: false,
            origemGaveta: true,
          });
        }
      };

      // Executa primeira auditoria rápida ou injeta direto
      let resAud = await executarAuditoriaCompletaDosPdfsDaPasta({
        arquivos: mapeados
          .filter((m) => !m.ehTxtPendencia)
          .map((m) => ({
            fileObj: m.fileObj,
            categoria: converterCategoriaParaAuditor(m.categoria),
            isViti: m.isViti,
            nomeOriginal: m.nomeOriginal,
          })),
        titularNome: titDet,
        conjugeNome: conjDet,
        paEsperado: paDet,
        porteSelecionado: porteDet,
        escopoSelecionado: escopoDet,
        modalidadeDerivada: modDet,
      });

      paAlvoGaveta = resAud.paDetectadoNoProjeto || paDet;
      projAlvoGaveta = resAud.projetistaCurtoDetectado || projDet;
      if (!forcarPorte && resAud.dadosProjetoParaParecer?.porteSugeridoPeloPdf) {
        porteDet = resAud.dadosProjetoParaParecer.porteSugeridoPeloPdf;
      }

      const qtdAntes = mapeados.length;
      if (escopoDet !== 'LIMITE_PURO' && projAlvoGaveta) {
        await injetarCoringaSeFaltar(
          'ITEM_CREA',
          'CREA_PROJETISTA',
          projAlvoGaveta,
          `19. CREA - ${projAlvoGaveta.toUpperCase()}.pdf`
        );
      }
      if (porteDet === 'PRONAF_A' && paAlvoGaveta) {
        await injetarCoringaSeFaltar(
          'ITEM_RB_PA',
          'RB_PA',
          paAlvoGaveta,
          `17. RB DO ${paAlvoGaveta.toUpperCase()}.pdf`
        );
      }
      if (paAlvoGaveta) {
        await injetarCoringaSeFaltar(
          'ITEM_CAR',
          'CAR_PA',
          paAlvoGaveta,
          `13. CAR - ${paAlvoGaveta.toUpperCase()}.pdf`
        );
      }
      if (porteDet === 'PRONAF_A') {
        await injetarCoringaSeFaltar(
          'ITEM_PARECER_SEMA',
          'PARECER_SEMA',
          undefined,
          `21. PARECER SEMA.pdf`
        );
      }

      // Se algum Coringa da Gaveta foi injetado agora, re-executa a auditoria com ele presente!
      if (mapeados.length > qtdAntes) {
        resAud = await executarAuditoriaCompletaDosPdfsDaPasta({
          arquivos: mapeados
            .filter((m) => !m.ehTxtPendencia)
            .map((m) => ({
              fileObj: m.fileObj,
              categoria: converterCategoriaParaAuditor(m.categoria),
              isViti: m.isViti,
              nomeOriginal: m.nomeOriginal,
            })),
          titularNome: resAud.dadosProjetoParaParecer?.clienteNome || titDet,
          conjugeNome: resAud.conjugeDetectadoNosPdfs || conjDet,
          paEsperado: paAlvoGaveta,
          porteSelecionado: porteDet,
          escopoSelecionado: escopoDet,
          modalidadeDerivada: modDet,
        });
      }

      // PARTE 7.1 + ITEM 1 E 2: Classificação Híbrida (Nome do Arquivo + Conteúdo do PDF + Nome do Cônjuge extraído do Projeto)
      const mapaConteudo = resAud.reclassificacoesPorConteudo || {};
      const mapaSocio = resAud.reclassificacoesSocioambiental || {};
      const primTitFinal = extrairPrimeiroNome(
        resAud.dadosProjetoParaParecer?.clienteNome || titDet
      );
      const primConjFinal = extrairPrimeiroNome(
        resAud.conjugeDetectadoNosPdfs || conjDet
      );

      const mapeadosReclassificados = mapeados.map((m) => {
        if (m.ehTxtPendencia || m.isViti) return m;

        const catSocio = mapaSocio[m.nomeOriginal];
        if (catSocio) return { ...m, categoria: catSocio };

        // 1. Reavalia pelo nome do arquivo agora que sabemos o nome exato do Titular e do Cônjuge lidos do Projeto!
        const reclassifPorNome = classificarArquivoUniversal(
          m.nomeOriginal,
          primTitFinal,
          primConjFinal,
          escopoDet,
          resAud.dadosProjetoParaParecer?.imoveisVinculados
        );

        let categoriaHibrida = m.categoria;
        if (
          reclassifPorNome.categoria !== 'OUTROS_NAO_IDENTIFICADO' &&
          (categoriaHibrida === 'OUTROS_NAO_IDENTIFICADO' ||
            categoriaHibrida === 'CAD_1_IDENTIDADE_OUTRO' ||
            reclassifPorNome.categoria === 'CAD_1_IDENTIDADE_CONJUGE')
        ) {
          categoriaHibrida = reclassifPorNome.categoria;
        }

        // 2. Combina com o classificador de conteúdo interno do PDF
        const catCont = mapaConteudo[m.nomeOriginal] as
          | CategoriaDocPasta
          | undefined;
        if (
          catCont &&
          (categoriaHibrida === 'OUTROS_NAO_IDENTIFICADO' ||
            categoriaHibrida === 'CAD_9_OUTROS_CADASTRO' ||
            categoriaHibrida === 'ITEM_DEC_OUTRA_AMBIENTAL' ||
            catCont === 'CAD_1_IDENTIDADE_CONJUGE')
        ) {
          categoriaHibrida = catCont;
        }

        return { ...m, categoria: categoriaHibrida };
      });

      setPorteAtivo(porteDet);
      setEscopoAtivo(escopoDet);
      setModalidadeAtiva(modDet);
      setArquivosLidos(mapeadosReclassificados);
      setAuditoriaPdf(resAud);

      if (resAud.dadosProjetoParaParecer?.clienteNome) {
        setTitularDetectado(resAud.dadosProjetoParaParecer.clienteNome);
      } else {
        setTitularDetectado(titDet);
      }
      if (resAud.conjugeDetectadoNosPdfs) {
        setConjugeDetectado(resAud.conjugeDetectadoNosPdfs);
      }
      if (projAlvoGaveta) setProjetistaDetectado(projAlvoGaveta);
      if (paAlvoGaveta) setPaDetectado(paAlvoGaveta);
    } catch (err) {
      console.error('Erro na auditoria de conformidade:', err);
    } finally {
      setAuditando(false);
    }
  };

  const selecionarPastaParaAuditoria = async () => {
    const win = window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: string }) => Promise<any>;
    };
    if (!win.showDirectoryPicker) {
      alert(
        '⚠️ Seu navegador atual não suporta leitura direta de pastas. Utilize o Google Chrome ou Microsoft Edge no computador!'
      );
      return;
    }

    try {
      const handle = await win.showDirectoryPicker({ mode: 'readwrite' });
      await executarVarreduraCompletaDaPasta(handle);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      try {
        const handleFallback = await win.showDirectoryPicker();
        await executarVarreduraCompletaDaPasta(handleFallback);
      } catch {
        // Cancelado
      }
    }
  };

  // Abre a janela nativa do Windows Explorer diretamente dentro da subpasta onde o arquivo está localizado!
  const abrirLocalDoArquivoNoExplorer = async (
    arq: ArquivoLidoConformidade
  ) => {
    const caminhoLegivel = arq.caminhoSubpasta
      ? `${nomePasta}\\${arq.caminhoSubpasta.replace(/\//g, '\\')}\\${arq.nomeOriginal}`
      : `${nomePasta}\\${arq.nomeOriginal}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(arq.nomeOriginal);
      } catch {
        // Ignora
      }
    }

    if (!dirHandleRoot) {
      alert(`📂 Local do arquivo:\n${caminhoLegivel}`);
      return;
    }

    try {
      let pastaAlvoHandle = dirHandleRoot;
      if (arq.caminhoSubpasta) {
        const partes = arq.caminhoSubpasta.split('/').filter(Boolean);
        for (const p of partes) {
          pastaAlvoHandle = await pastaAlvoHandle.getDirectoryHandle(p, {
            create: false,
          });
        }
      }

      const win = window as unknown as {
        showOpenFilePicker?: (opts?: any) => Promise<any>;
      };

      if (win.showOpenFilePicker) {
        // Abre o Windows Explorer diretamente na subpasta do arquivo (e o nome do arquivo já vai copiado no Ctrl+V!)
        await win.showOpenFilePicker({
          startIn: pastaAlvoHandle,
          multiple: false,
        });
      } else {
        alert(
          `📂 Localização do arquivo:\n${caminhoLegivel}\n\n(Nome copiado para a área de transferência!)`
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      alert(
        `📂 Localização do arquivo:\n${caminhoLegivel}\n\n(O nome "${arq.nomeOriginal}" foi copiado para o seu Ctrl+V!)`
      );
    }
  };

  // Apaga o documento defeituoso diretamente da pasta/subpasta do cliente e re-audita a proposta!
  const apagarDocumentoDiretoDaPasta = async (arq: ArquivoLidoConformidade) => {
    if (!dirHandleRoot) {
      alert('⚠️ Pasta raiz não disponível para exclusão física.');
      return;
    }

    const confirmar = window.confirm(
      `🗑️ APAGAR DOCUMENTO DA PASTA\n\nTem certeza que deseja EXCLUIR permanentemente o arquivo:\n"${arq.nomeOriginal}"\n${
        arq.caminhoSubpasta
          ? `(Subpasta: ${arq.caminhoSubpasta})`
          : '(Na Raiz da Pasta)'
      }?`
    );
    if (!confirmar) return;

    try {
      let pastaAlvoHandle = dirHandleRoot;
      if (arq.caminhoSubpasta) {
        const partes = arq.caminhoSubpasta.split('/').filter(Boolean);
        for (const p of partes) {
          pastaAlvoHandle = await pastaAlvoHandle.getDirectoryHandle(p, {
            create: false,
          });
        }
      }

      await pastaAlvoHandle.removeEntry(arq.nomeOriginal);
      setArquivoVisualizando(null);
      setPainelEdicaoRapidaAberto(false);
      await executarVarreduraCompletaDaPasta(
        dirHandleRoot,
        porteAtivo,
        escopoAtivo,
        modalidadeAtiva
      );
      alert(
        `✅ Arquivo "${arq.nomeOriginal}" apagado da pasta e auditoria atualizada!`
      );
    } catch (err: any) {
      alert(
        `❌ Não foi possível apagar o arquivo "${arq.nomeOriginal}": ${
          err?.message || 'Verifique se ele não está aberto em outro programa.'
        }`
      );
    }
  };

  const salvarKmlCorrigidoNaPasta = async () => {
    const infoKml = auditoriaPdf?.kmlCorrigidoAutomaticamente;
    if (!dirHandleRoot || !infoKml) return;
    try {
      const fh = await dirHandleRoot.getFileHandle(infoKml.nomeArquivo, {
        create: true,
      });
      const wr = await fh.createWritable();
      await wr.write(infoKml.conteudoKml);
      await wr.close();
      alert(
        `✅ Polígonos abertos do arquivo "${infoKml.nomeArquivo}" foram fechados e salvos na pasta!`
      );
      await executarVarreduraCompletaDaPasta(dirHandleRoot);
    } catch {
      alert('❌ Não foi possível gravar o KML corrigido na pasta.');
    }
  };

  // ===========================================================================
  // ITENS 5, 5.1 E 5.2: VARREDURA COMPLETA DE TODOS OS DOCUMENTOS FALTANTES
  // SEPARADOS ENTRE "TAREFAS DO ANALISTA" E "PENDÊNCIAS DO PROJETISTA/CLIENTE"
  // ===========================================================================
  const lembretesTxtRestantes = useMemo(
    () => arquivosLidos.filter((a) => a.ehTxtPendencia),
    [arquivosLidos]
  );

  const matrizCompletaDocumentos = useMemo((): ItemVerificacaoCompletaPasta[] => {
    if (arquivosLidos.length === 0) return [];

    // Documentos reais entregues ordenados do MAIS RECENTE para o mais antigo (lastModified decrescente)
    const validos = [...arquivosLidos]
      .filter((a) => !a.ehTxtPendencia && a.extensao !== 'txt')
      .sort(
        (a, b) => (b.fileObj.lastModified || 0) - (a.fileObj.lastModified || 0)
      );
    const buscarArqs = (
      categorias: CategoriaDocPasta[],
      termosNome: string[] = []
    ): ArquivoLidoConformidade[] => {
      return validos.filter((a) => {
        if (categorias.includes(a.categoria)) return true;
        const nUp = removerAcentos(a.nomeOriginal).toUpperCase();
        return termosNome.some((t) => nUp.includes(t));
      });
    };

    const isPronafA = porteAtivo === 'PRONAF_A';
    const isPronafV = porteAtivo === 'PRONAF_V';
    const isMiniPequeno = porteAtivo === 'MINI_PEQUENO';
    const temDerivada = escopoAtivo !== 'LIMITE_PURO';
    const temLimite =
      escopoAtivo === 'LIMITE_PURO' ||
      escopoAtivo === 'COMBO_DERIVADA_E_LIMITE';
    const estCivilAtivo = (
      editEstadoCivil ||
      auditoriaPdf?.estadoCivilDetectado ||
      ''
    ).toUpperCase();
    const temConjuge = Boolean(
      conjugeDetectado.trim() ||
        estCivilAtivo.includes('CASAD') ||
        estCivilAtivo.includes('UNIAO') ||
        estCivilAtivo.includes('UNIÃO')
    );

    const itens: ItemVerificacaoCompletaPasta[] = [];

    // -------------------------------------------------------------------------
    // GRUPO 1: TAREFAS E CONSULTAS QUE O ANALISTA (USUÁRIO) FAZ NO DIA (5.1)
    // -------------------------------------------------------------------------
    // ITEM 1: Quando for CUSTEIO de qualquer porte, NÃO exige Capa do Analisador!
    const isOperacaoCusteio =
      temDerivada && modalidadeAtiva === 'CUSTEIO';

    if (!isOperacaoCusteio) {
      const arqsCapa = buscarArqs(['ITEM_CAPA_ANALISADOR'], [
        'CAPA DO ANALISADOR',
        '1. CAPA',
        '19. CAPA',
        'CAPA DA PROPOSTA',
        'CAPA -',
      ]);
      itens.push({
        id: 'AN_CAPA',
        titulo: 'Capa do Analisador',
        obrigatorio: true,
        presente: arqsCapa.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsCapa.length > 0
            ? 'Capa localizada na pasta.'
            : 'Falta inserir a Capa da Proposta / Analisador.',
        arquivosRelacionados: arqsCapa,
      });
    }

    const arqsEmbargos = buscarArqs(
      ['ITEM_EMBARGOS_TITULAR', 'ITEM_EMBARGOS_CONJUGE'],
      ['EMBARGO', 'IBAMA']
    );
    itens.push({
      id: 'AN_EMBARGOS',
      titulo: 'Consulta de Embargos (IBAMA)',
      obrigatorio: true,
      presente: arqsEmbargos.length > 0,
      responsavel: 'ANALISTA_BANCO',
      detalheStatus:
        arqsEmbargos.length > 0
          ? `${arqsEmbargos.length} certidão(ões) de Embargos na pasta.`
          : 'Falta emitir e salvar a Certidão de Embargos (IBAMA).',
      arquivosRelacionados: arqsEmbargos,
    });

    const arqsImprobidade = buscarArqs(
      ['ITEM_IMPROBIDADE_TITULAR', 'ITEM_IMPROBIDADE_CONJUGE'],
      ['IMPROBIDADE', 'CNJ']
    );
    itens.push({
      id: 'AN_IMPROBIDADE',
      titulo: 'Consulta de Improbidade Administrativa (CNJ)',
      obrigatorio: true,
      presente: arqsImprobidade.length > 0,
      responsavel: 'ANALISTA_BANCO',
      detalheStatus:
        arqsImprobidade.length > 0
          ? `${arqsImprobidade.length} certidão(ões) do CNJ na pasta.`
          : 'Falta emitir e salvar a Certidão de Improbidade (CNJ).',
      arquivosRelacionados: arqsImprobidade,
    });

    if (temDerivada) {
      const arqsCertSocio = buscarArqs(
        [
          'ITEM_CERT_SOCIO_COM_KML',
          'ITEM_CERT_SOCIO_SEM_KML',
        ],
        ['CERTIFICACAO SOCIOAMBIENTAL', 'SOCIOAMBIENTAL']
      );
      itens.push({
        id: 'AN_CERT_SOCIO_DERIV',
        titulo: isPronafA
          ? '5. Certificação Socioambiental (PDF)'
          : 'Certificação Socioambiental COM KML (Glebas)',
        obrigatorio: true,
        presente: arqsCertSocio.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsCertSocio.length > 0
            ? 'Certificação Socioambiental localizada na pasta.'
            : 'Falta emitir e salvar o PDF da Certificação Socioambiental.',
        arquivosRelacionados: arqsCertSocio,
      });

      const arqsSicor = buscarArqs(
        ['ITEM_EXTRATO_SICOR' as CategoriaDocPasta],
        ['SICOR', 'EXTRATO SICOR']
      );
      itens.push({
        id: 'AN_SICOR',
        titulo: 'Extrato SICOR (Consulta BACEN)',
        obrigatorio: true,
        presente: arqsSicor.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsSicor.length > 0
            ? 'Extrato SICOR presente na pasta.'
            : 'Falta emitir e salvar o Extrato SICOR na pasta.',
        arquivosRelacionados: arqsSicor,
      });
    }

    if (temLimite) {
      const arqsCertSemKml = buscarArqs(
        ['ITEM_CERT_SOCIO_SEM_KML', 'ITEM_CERT_SOCIO_COM_KML'],
        ['CERTIFICACAO SOCIOAMBIENTAL', 'SOCIOAMBIENTAL']
      );
      itens.push({
        id: 'AN_CERT_SOCIO_LIM',
        titulo: 'Certificação Socioambiental SEM KML (Para LCGH/LCGA)',
        obrigatorio: true,
        presente: arqsCertSemKml.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsCertSemKml.length > 0
            ? 'Certificação Socioambiental localizada.'
            : 'Falta emitir a Certificação Socioambiental SEM KML para o Limite.',
        arquivosRelacionados: arqsCertSemKml,
      });
    }

    if (!isPronafA || temLimite) {
      const arqsCnd = buscarArqs(['ITEM_CND_PF'], [
        'CND -',
        'CND PF',
        'CERTIDAO NEGATIVA DE DEBITOS RELATIVOS AOS TRIBUTOS FEDERAIS',
      ]);
      itens.push({
        id: 'AN_CND_PF',
        titulo: 'CND Federal (Pessoa Física)',
        obrigatorio: true,
        presente: arqsCnd.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsCnd.length > 0
            ? 'CND PF localizada na pasta.'
            : 'Falta emitir a CND Federal (Receita) do cliente.',
        arquivosRelacionados: arqsCnd,
      });

      const arqsCndt = buscarArqs(['ITEM_CNDT_PF'], ['CNDT', 'TRABALHISTA']);
      itens.push({
        id: 'AN_CNDT_PF',
        titulo: 'CNDT (Certidão Negativa de Débitos Trabalhistas)',
        obrigatorio: true,
        presente: arqsCndt.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsCndt.length > 0
            ? 'CNDT localizada na pasta.'
            : 'Falta emitir a CNDT Trabalhista no dia.',
        arquivosRelacionados: arqsCndt,
      });
    }

    const arqsProcCas = buscarArqs(
      ['CAD_6_PROCURACAO', 'CAD_2_CERTIDAO_CASAMENTO'],
      ['PROCURACAO', 'CASAMENTO']
    );
    if (arqsProcCas.length > 0) {
      const arqsSelo = buscarArqs(['CAD_8_SELO_CARTORIO'], ['SELO']);
      itens.push({
        id: 'AN_SELOS',
        titulo: 'Consulta de Selos Cartorários (TJMA)',
        obrigatorio: true,
        presente: arqsSelo.length > 0,
        responsavel: 'ANALISTA_BANCO',
        detalheStatus:
          arqsSelo.length > 0
            ? 'Consulta de Selo Cartorário presente.'
            : 'Há Procuração/Certidão de Casamento na pasta e falta consultar o Selo TJMA.',
        arquivosRelacionados: arqsSelo.length > 0 ? arqsSelo : arqsProcCas,
      });
    }

    const faltamVitiCount = (
      auditoriaPdf?.arquivosComAssinaturaDigital || []
    ).filter((s) => s.includes('FALTA VITI')).length;
    const arqsViti = validos.filter((a) => a.isViti);
    itens.push({
      id: 'AN_VITI',
      titulo: 'Validações ITI de Assinaturas Digitais (VITI)',
      obrigatorio: true,
      presente: faltamVitiCount === 0,
      responsavel: 'ANALISTA_BANCO',
      detalheStatus:
        faltamVitiCount === 0
          ? 'Todos os PDFs assinados digitalmente estão com VITI validado.'
          : `Falta validar no ITI ${faltamVitiCount} documento(s) assinado(s) digitalmente!`,
      arquivosRelacionados: arqsViti,
    });

    const arqsConsol = buscarArqs(['ITEM_CONSOLIDADAS'], ['CONSOLIDADA']);
    const ccConfirmada =
       Boolean(editCcConsol.trim()) ||
      Boolean(auditoriaPdf?.contaCorrenteConsolidada);
    const statusCc = auditoriaPdf?.statusContaConsolidada;

    itens.push({
      id: 'AN_CC_CONSOLIDADA',
      titulo: 'Conta Corrente na Declaração Consolidada',
      obrigatorio: true,
      presente: arqsConsol.length > 0 && ccConfirmada,
      responsavel:
        arqsConsol.length > 0 && !ccConfirmada && statusCc === 'FALTA'
          ? 'PROJETISTA_CLIENTE'
          : 'ANALISTA_BANCO',
      detalheStatus:
        arqsConsol.length === 0
          ? 'Falta a Declaração Consolidada na pasta.'
          : ccConfirmada
          ? `✅ Conta Corrente (${
              editCcConsol || auditoriaPdf?.contaCorrenteConsolidada
            }${
              auditoriaPdf?.agenciaConsolidadaDetectada
                ? ` • Ag. ${auditoriaPdf.agenciaConsolidadaDetectada}`
                : ''
            }) confirmada no trecho de débito da Consolidada.`
          : statusCc === 'NAO_LIDO'
          ? '⚠️ Não foi possível ler o texto da Consolidada (PDF em imagem). Abra na Lupinha (🔎) e use "🧠 Ler Imagem via OCR" ou confira visualmente.'
          : '🚨 FALTA A CONTA CORRENTE no trecho "conta de depósito de livre movimentação de número..." da Consolidada!',
      arquivosRelacionados: arqsConsol,
    });

    const arqsParecerGer = arquivosLidos.filter(
      (a) =>
        !a.ehTxtPendencia &&
        (isArquivoParecerGerencialReal(a.nomeOriginal) ||
          a.categoria === 'ITEM_PARECER_GERENCIAL')
    );
    itens.push({
      id: 'AN_PARECER_GERENCIAL',
      titulo: '20. Parecer Gerencial (.TXT)',
      obrigatorio: true,
      presente: arqsParecerGer.length > 0,
      responsavel: 'ANALISTA_BANCO',
      detalheStatus:
        arqsParecerGer.length > 0
          ? 'Parecer Gerencial presente na pasta.'
          : 'Falta gerar o Parecer Gerencial (.TXT) na pasta.',
      arquivosRelacionados: arqsParecerGer,
    });

    // -------------------------------------------------------------------------
    // GRUPO 2: DOCUMENTOS DO PROJETISTA / CLIENTE (COBRAR SE FALTAREM - 5.2)
    // -------------------------------------------------------------------------
    if (temDerivada) {
      const arqsProjPdf = buscarArqs(['ITEM_PROJETO_PDF'], ['12. PROJETO', 'PROJETO -']);
      itens.push({
        id: 'PR_PROJETO_PDF',
        titulo: 'Projeto Técnico em PDF (Assinado)',
        obrigatorio: true,
        presente: arqsProjPdf.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsProjPdf.length > 0
            ? 'Projeto em PDF localizado.'
            : 'Falta o PDF do Projeto Técnico na pasta!',
        arquivosRelacionados: arqsProjPdf,
      });

      const arqsPlanilhaProj = validos.filter((a) => {
        const extLow = a.extensao.toLowerCase();
        const nomeUp = a.nomeOriginal.toUpperCase();
        return (
          a.categoria === 'ITEM_ARQ_ELETRONICO_PROJETO' ||
          /^(pronaf|invur|custeio)/i.test(extLow) ||
          /\.(PRONAF[_A0-9]*|INVUR[_0-9]*|CUSTEIO[_0-9]*)$/i.test(nomeUp)
        );
      });
      itens.push({
        id: 'PR_PLANILHA_PROJETO',
        titulo: 'Arquivo da Planilha do Projeto (.PRONAF / .INVUR / .CUSTEIO)',
        obrigatorio: true,
        presente: arqsPlanilhaProj.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsPlanilhaProj.length > 0
            ? `Planilha (${arqsPlanilhaProj[0].nomeOriginal}) localizada.`
            : 'Falta o arquivo da planilha eletrônica do projeto (.PRONAF / .INVUR / .CUSTEIO)!',
        arquivosRelacionados: arqsPlanilhaProj,
      });

      if (!isPronafA) {
        const arqsKml = buscarArqs(['ITEM_KML'], ['.KML']);
        itens.push({
          id: 'PR_KML',
          titulo: 'Arquivo Geodésico .KML das Glebas',
          obrigatorio: true,
          presente: arqsKml.length > 0,
          responsavel: 'PROJETISTA_CLIENTE',
          detalheStatus:
            arqsKml.length > 0
              ? `Arquivo KML (${arqsKml[0].nomeOriginal}) localizado.`
              : 'Falta o arquivo .KML do projeto na pasta!',
          arquivosRelacionados: arqsKml,
        });
      }

      if (modalidadeAtiva === 'INVESTIMENTO') {
        const arqsOrc = buscarArqs(['ITEM_ORCAMENTO'], ['ORCAMENTO', '18. ORCAMENTO']);
        itens.push({
          id: 'PR_ORCAMENTO',
          titulo: '18. Orçamento / Plano Simples (PDF)',
          obrigatorio: true,
          presente: arqsOrc.length > 0,
          responsavel: 'PROJETISTA_CLIENTE',
          detalheStatus:
            arqsOrc.length > 0
              ? 'Orçamento em PDF localizado.'
              : 'Falta o PDF do Orçamento na pasta!',
          arquivosRelacionados: arqsOrc,
        });
      }

      // Parecer Técnico NÃO é obrigatório para PRONAF V!
      if (!isPronafV) {
        const arqsParTec = buscarArqs(['ITEM_PARECER_TECNICO'], [
          'PARECER TECNICO',
          '16. PARECER',
        ]);
        itens.push({
          id: 'PR_PARECER_TECNICO',
          titulo: '16. Parecer Técnico do Projetista',
          obrigatorio: true,
          presente: arqsParTec.length > 0,
          responsavel: 'PROJETISTA_CLIENTE',
          detalheStatus:
            arqsParTec.length > 0
              ? 'Parecer Técnico localizado.'
              : 'Falta o Parecer Técnico do projetista!',
          arquivosRelacionados: arqsParTec,
        });
      }

      // Ficha Sanitária (AGED): Obrigatória em PRONAF V e MINI sempre que for CUSTEIO
      // ou quando for INVESTIMENTO que envolva aquisição de animais/semoventes!
      if (isPronafV || isMiniPequeno) {
        const textoItensProjNorm = normalizarSemAcento(
          (auditoriaPdf?.textoItensInversaoFormatado || '') +
            ' ' +
            (auditoriaPdf?.dadosProjetoParaParecer?.atividadePrincipal || '')
        );
        const envolveAquisicaoAnimais =
          /\b(BOVIN|VACAS?|MATRIZ|MATRIZES|REPRODUTOR|TOURO|BEZERR|GARROT|NOVILH|OVIN|CAPRIN|SUIN|AVES|PEIXE|PISCICULTURA|ANIMAIS|SEMOVENTE)\b/.test(
            textoItensProjNorm
          );

        if (modalidadeAtiva === 'CUSTEIO' || envolveAquisicaoAnimais) {
          const arqsFichaSan = buscarArqs(['ITEM_FICHA_SANITARIA'], [
            'FICHA SANITARIA',
            'AGED',
            'EXTRATO DE REBANHO',
          ]);
          itens.push({
            id: 'PR_FICHA_SANITARIA',
            titulo: '6. Ficha Sanitária / AGED Vigente',
            obrigatorio: true,
            presente: arqsFichaSan.length > 0,
            responsavel: 'PROJETISTA_CLIENTE',
            detalheStatus:
              arqsFichaSan.length > 0
                ? `Ficha Sanitária (${arqsFichaSan[0].nomeOriginal}) localizada.`
                : `Falta a Ficha Sanitária (AGED) na pasta (${
                    modalidadeAtiva === 'CUSTEIO'
                      ? 'Obrigatória para Custeio'
                      : 'Obrigatória p/ Aquisição de Animais'
                  })!`,
            arquivosRelacionados: arqsFichaSan,
          });
        }
      }

      const arqsCrea = buscarArqs(['ITEM_CREA'], ['CREA', 'CFTA']);
      itens.push({
        id: 'PR_CREA',
        titulo: '19. Carteira Profissional CREA / CFTA do Projetista',
        obrigatorio: true,
        presente: arqsCrea.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsCrea.length > 0
            ? 'CREA/CFTA localizado (Pasta / Gaveta).'
            : 'Falta o documento CREA/CFTA do projetista!',
        arquivosRelacionados: arqsCrea,
      });
    }

    if (temLimite) {
      const arqsSolLim = buscarArqs(['ITEM_SOLICITACAO_LIMITE'], [
        'SOLICITACAO DE ABERTURA',
        'SOLICITACAO DE LIMITE',
        'SOLICITACAO DO LIMITE',
      ]);
      itens.push({
        id: 'PR_SOL_LIMITE',
        titulo: 'Solicitação de Abertura do Limite (LCGH / LCGA)',
        obrigatorio: true,
        presente: arqsSolLim.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsSolLim.length > 0
            ? 'Solicitação de Limite localizada.'
            : 'Falta a Solicitação de Abertura de Limite (LCGH/LCGA)!',
        arquivosRelacionados: arqsSolLim,
      });
    }

    itens.push({
      id: 'PR_CONSOLIDADA',
      titulo: '9. Declarações Consolidadas Assinadas',
      obrigatorio: true,
      presente: arqsConsol.length > 0,
      responsavel: 'PROJETISTA_CLIENTE',
      detalheStatus:
        arqsConsol.length > 0
          ? 'Declarações Consolidadas presentes.'
          : 'Falta o arquivo de Declarações Consolidadas assinado pelo cliente!',
      arquivosRelacionados: arqsConsol,
    });

    const arqsDecRegAmb = buscarArqs(
      ['ITEM_DEC_REG_AMBIENTAL', 'ITEM_DEC_OUTRA_AMBIENTAL'],
      ['REGULARIDADE AMBIENTAL', 'DECLARACOES AMBIENTAIS']
    );
    itens.push({
      id: 'PR_DEC_AMBIENTAL',
      titulo: '10. Declaração de Regularidade Ambiental Assinada',
      obrigatorio: true,
      presente: arqsDecRegAmb.length > 0,
      responsavel: 'PROJETISTA_CLIENTE',
      detalheStatus:
        arqsDecRegAmb.length > 0
          ? 'Declaração Ambiental localizada.'
          : 'Falta a Declaração de Regularidade Ambiental assinada!',
      arquivosRelacionados: arqsDecRegAmb,
    });

    const arqsCar = buscarArqs(['ITEM_CAR'], ['13. CAR', 'RECIBO CAR', 'CAR -']);
    itens.push({
      id: 'PR_CAR',
      titulo: '13. Recibo / Demonstrativo do CAR',
      obrigatorio: true,
      presente: arqsCar.length > 0,
      responsavel: 'PROJETISTA_CLIENTE',
      detalheStatus:
        arqsCar.length > 0
          ? 'CAR localizado na pasta.'
          : 'Falta o arquivo do CAR do imóvel na pasta!',
      arquivosRelacionados: arqsCar,
    });

    if ((isPronafA || isPronafV) && temDerivada) {
      const arqsCaf = buscarArqs(['ITEM_CAF'], ['14. CAF', 'CAF -', 'DAP']);
      itens.push({
        id: 'PR_CAF',
        titulo: '14. CAF / DAP Vigente',
        obrigatorio: true,
        presente: arqsCaf.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsCaf.length > 0
            ? 'CAF / DAP localizada.'
            : 'Falta o documento CAF / DAP na pasta!',
        arquivosRelacionados: arqsCaf,
      });

      const arqsDcaa = buscarArqs(['ITEM_DCAA'], ['15. DCAA', 'DCAA']);
      itens.push({
        id: 'PR_DCAA',
        titulo: '15. DCAA (Dispensa Ambiental)',
        obrigatorio: true,
        presente: arqsDcaa.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsDcaa.length > 0
            ? 'DCAA localizada.'
            : 'Falta a DCAA na pasta!',
        arquivosRelacionados: arqsDcaa,
      });
    }

    if (isPronafA && temDerivada) {
      const arqsEspelho = buscarArqs(['ITEM_ESPELHO_UND'], [
        '11. ESPELHO',
        'ESPELHO',
        'RELATORIO DA UND',
      ]);
      itens.push({
        id: 'PR_ESPELHO_UND',
        titulo: '11. Espelho / Relatório da UND Familiar',
        obrigatorio: true,
        presente: arqsEspelho.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsEspelho.length > 0
            ? 'Espelho da UND localizado.'
            : 'Falta o Espelho da UND Familiar na pasta!',
        arquivosRelacionados: arqsEspelho,
      });

      const arqsRb = buscarArqs(['ITEM_RB_PA'], ['17. RB', 'RELACAO DE BENEFICIARIOS']);
      itens.push({
        id: 'PR_RB_PA',
        titulo: '17. Relação de Beneficiários (RB do P.A.)',
        obrigatorio: true,
        presente: arqsRb.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsRb.length > 0
            ? 'RB do P.A. localizada (Pasta / Gaveta).'
            : 'Falta a RB do P.A. na pasta!',
        arquivosRelacionados: arqsRb,
      });
    }

    if (isMiniPequeno || temLimite) {
      const arqsMat = buscarArqs(
        ['ITEM_INTEIRO_TEOR', 'ITEM_TITULO_DOMINIO', 'ITEM_DOC_IMOVEL_GENERICO'],
        ['INTEIRO TEOR', 'MATRICULA', 'TITULO', 'ESCRITURA']
      );
      itens.push({
        id: 'PR_MATRICULA_IMOVEL',
        titulo: 'Certidão de Inteiro Teor / Matrícula ou Título do Imóvel',
        obrigatorio: true,
        presente: arqsMat.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsMat.length > 0
            ? `${arqsMat.length} documento(s) de propriedade localizado(s).`
            : 'Falta a Certidão de Inteiro Teor / Matrícula do Imóvel!',
        arquivosRelacionados: arqsMat,
      });

      const arqsCcir = buscarArqs(['ITEM_CCIR'], ['CCIR']);
      itens.push({
        id: 'PR_CCIR',
        titulo: 'CCIR Vigente do Imóvel',
        obrigatorio: true,
        presente: arqsCcir.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsCcir.length > 0 ? 'CCIR localizado.' : 'Falta o CCIR do imóvel!',
        arquivosRelacionados: arqsCcir,
      });

      const arqsItr = buscarArqs(['ITEM_CND_ITR_IMOVEL'], ['ITR']);
      itens.push({
        id: 'PR_ITR',
        titulo: 'CND de ITR do Imóvel',
        obrigatorio: true,
        presente: arqsItr.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsItr.length > 0
            ? 'CND de ITR localizada.'
            : 'Falta a CND de ITR do imóvel!',
        arquivosRelacionados: arqsItr,
      });
    }

    const arqsIdTit = buscarArqs(['CAD_1_IDENTIDADE_TITULAR'], [
      'IDENTIDADE',
      'RG ',
      'CNH',
    ]);
    itens.push({
      id: 'PR_ID_TITULAR',
      titulo: 'Documento de Identificação do Titular (Cadastro)',
      obrigatorio: true,
      presente: arqsIdTit.length > 0,
      responsavel: 'PROJETISTA_CLIENTE',
      detalheStatus:
        arqsIdTit.length > 0
          ? 'Identidade do Titular localizada.'
          : 'Falta o Documento de Identificação do Titular no Cadastro!',
      arquivosRelacionados: arqsIdTit,
    });

    if (temConjuge) {
      const primTitComp = extrairPrimeiroNome(titularDetectado);
      const primConjComp = extrairPrimeiroNome(conjugeDetectado);

      const arqsIdConj = validos.filter((a) => {
        if (a.categoria === 'CAD_1_IDENTIDADE_CONJUGE') return true;
        const nUp = removerAcentos(a.nomeOriginal).toUpperCase();
        if (
          primConjComp.length >= 3 &&
          /\b(IDENTIDADE|RG|CNH|CIN)\b/.test(nUp) &&
          nUp.includes(primConjComp)
        ) {
          return true;
        }
        // Se for um segundo arquivo "IDENTIDADE - ..." na pasta que não tem o nome do titular
        if (
          (a.categoria === 'CAD_1_IDENTIDADE_OUTRO' ||
            /\b(IDENTIDADE|RG)\b/.test(nUp)) &&
          primTitComp.length >= 3 &&
          !nUp.includes(primTitComp)
        ) {
          return true;
        }
        return false;
      });

      itens.push({
        id: 'PR_ID_CONJUGE',
        titulo: `Documento de Identificação do Cônjuge / Companheiro(a) (${
          conjugeDetectado || 'Cônjuge'
        })`,
        obrigatorio: true,
        presente: arqsIdConj.length > 0,
        responsavel: 'PROJETISTA_CLIENTE',
        detalheStatus:
          arqsIdConj.length > 0
            ? `Identidade do(a) Cônjuge (${arqsIdConj[0].nomeOriginal}) localizada.`
            : 'Falta o Documento de Identificação do(a) Cônjuge no Cadastro!',
        arquivosRelacionados: arqsIdConj,
      });

      // Se o Estado Civil no Raio-X/Projeto for CASADO(A), cobra obrigatoriamente a Certidão de Casamento!
      const ehCasadoNoProjeto = estCivilAtivo.includes('CASAD');
      if (ehCasadoNoProjeto) {
        const arqsCasamento = buscarArqs(['CAD_2_CERTIDAO_CASAMENTO'], [
          'CASAMENTO',
          'CERTIDAO DE CASAMENTO',
        ]);
        itens.push({
          id: 'PR_CERTIDAO_CASAMENTO',
          titulo: 'Certidão de Casamento (Obrigatória p/ Estado Civil Casado)',
          obrigatorio: true,
          presente: arqsCasamento.length > 0,
          responsavel: 'PROJETISTA_CLIENTE',
          detalheStatus:
            arqsCasamento.length > 0
              ? 'Certidão de Casamento localizada no Cadastro.'
              : 'Estado civil no projeto é CASADO(A), mas falta a Certidão de Casamento!',
          arquivosRelacionados: arqsCasamento,
        });
      }
    }

    // ITEM 2.3: Não duplica alertas mostrando o Lembrete .TXT separado!
    // Em vez disso, verifica se cada item ausente possui ou não um lembrete .TXT correspondente na pasta,
    // e avisa na própria mensagem do item ausente caso NÃO haja um lembrete .TXT daquela falta!
    const MAPA_TERMOS_TXT_POR_ID: Record<string, string[]> = {
      AN_CAPA: ['CAPA DO ANALISADOR', 'CAPA'],
      AN_EMBARGOS: ['EMBARGOS', 'EMBARGO'],
      AN_IMPROBIDADE: ['IMPROBIDADE'],
      AN_CERT_SOCIO_DERIV: ['CERTIFICACAO SOCIOAMBIENTAL', 'SOCIOAMBIENTAL'],
      AN_CERT_SOCIO_LIM: ['CERTIFICACAO SOCIOAMBIENTAL', 'SOCIOAMBIENTAL'],
      AN_SICOR: ['EXTRATO SICOR', 'SICOR'],
      AN_CND_PF: ['CND -', 'CND PF', 'CND '],
      AN_CNDT_PF: ['CNDT'],
      AN_SELOS: ['SELO'],
      AN_VITI: ['VITI', 'ITI'],
      AN_CC_CONSOLIDADA: ['VERIFICAR C-C', 'CONTA CORRENTE', 'CONSOLIDADA'],
      AN_PARECER_GERENCIAL: ['FALTA PARECER GERENCIAL', 'PARECER GERENCIAL'],
      PR_PROJETO_PDF: ['PROJETO'],
      PR_PLANILHA_PROJETO: ['ARQUIVO ELETRONICO', 'PROJETO'],
      PR_KML: ['KML'],
      PR_ORCAMENTO: ['ORCAMENTO'],
      PR_PARECER_TECNICO: ['PARECER TECNICO'],
      PR_CREA: ['CREA'],
      PR_SOL_LIMITE: ['SOLICITACAO DE ABERTURA', 'SOLICITACAO DE LIMITE'],
      PR_CONSOLIDADA: ['DECLARACOES CONSOLIDADAS', 'CONSOLIDADA'],
      PR_DEC_AMBIENTAL: ['REGULARIDADE AMBIENTAL', 'DECLARACOES AMBIENTAIS'],
      PR_CAR: ['CAR'],
      PR_CAF: ['CAF', 'DAP'],
      PR_DCAA: ['DCAA'],
      PR_ESPELHO_UND: ['ESPELHO', 'RELATORIO DA UND'],
      PR_RB_PA: ['RB DO', 'RELACAO DE BENEFICIARIOS'],
      PR_MATRICULA_IMOVEL: ['INTEIRO TEOR', 'MATRICULA', 'TITULO', 'IMOVEL'],
      PR_CCIR: ['CCIR'],
      PR_ITR: ['ITR'],
      PR_ID_TITULAR: ['IDENTIDADE', 'RG'],
      PR_ID_CONJUGE: ['IDENTIDADE', 'CONJUGE'],
      PR_CERTIDAO_CASAMENTO: ['CASAMENTO'],
    };

    const nomesTxtsNorm = lembretesTxtRestantes.map((t) =>
      removerAcentos(t.nomeOriginal).toUpperCase()
    );

    const itensComVerificacaoDeLembrete = itens.map((item) => {
      if (item.presente) return item;
      const termos = MAPA_TERMOS_TXT_POR_ID[item.id] || [];
      const temTxtNaPasta =
        termos.length > 0 &&
        nomesTxtsNorm.some((nomeTxt) =>
          termos.some((termo) => nomeTxt.includes(termo))
        );

      return {
        ...item,
        detalheStatus: temTxtNaPasta
          ? item.detalheStatus
          : `${item.detalheStatus} ⚠️ (Não há lembrete .TXT dessa falta na pasta)`,
      };
    });

    // Inclui também os alertas e restrições vindos do Modal de Conformidade PRONAF A!
    alertasConformidadePronafA.forEach((al) => {
      itensComVerificacaoDeLembrete.push({
        id: al.id,
        titulo: al.texto,
        obrigatorio: true,
        presente: false,
        responsavel: al.responsavel,
        detalheStatus:
          'Identificado no cruzamento com a Planilha de Conformidade PRONAF A.',
        arquivosRelacionados: [],
      });
    });

    return itensComVerificacaoDeLembrete;
  }, [
    arquivosLidos,
    lembretesTxtRestantes,
    alertasConformidadePronafA,
    porteAtivo,
    escopoAtivo,
    modalidadeAtiva,
    titularDetectado,
    conjugeDetectado,
    auditoriaPdf,
  ]);

  const tarefasFaltantesAnalista = useMemo(
    () =>
      matrizCompletaDocumentos.filter(
        (i) => i.responsavel === 'ANALISTA_BANCO' && !i.presente
      ),
    [matrizCompletaDocumentos]
  );

  const pendenciasFaltantesProjetista = useMemo(
    () =>
      matrizCompletaDocumentos.filter(
        (i) => i.responsavel === 'PROJETISTA_CLIENTE' && !i.presente
      ),
    [matrizCompletaDocumentos]
  );

  // Associa arquivos PDF a cada um dos 16 itens de diagnóstico para exibir o botão da Lupinha 🔎
  const obterArquivosParaDiagnostico = (
    numeroDiag: number
  ): ArquivoLidoConformidade[] => {
    const validos = arquivosLidos.filter(
      (a) => !a.ehTxtPendencia && a.extensao === 'pdf'
    );
    const porCat = (cats: CategoriaDocPasta[]) =>
      validos.filter((a) => cats.includes(a.categoria));

    switch (numeroDiag) {
      case 1:
        return porCat(['ITEM_CONSOLIDADAS']);
      case 2:
      case 8:
      case 9:
      case 14:
        return porCat([
          'ITEM_PROJETO_PDF',
          'ITEM_ORCAMENTO',
          'ITEM_SOLICITACAO_LIMITE',
          'ITEM_CONTRATO_ASSESSORIA',
        ]);
      case 3:
        return porCat([
          'CAD_6_PROCURACAO',
          'CAD_2_CERTIDAO_CASAMENTO',
          'CAD_8_SELO_CARTORIO',
        ]);
      case 4:
        return porCat([
          'ITEM_CONSOLIDADAS',
          'ITEM_PROJETO_PDF',
          'ITEM_ORCAMENTO',
          'ITEM_PARECER_TECNICO',
          'ITEM_CONTRATO_ASSESSORIA',
          'ITEM_DEC_REG_AMBIENTAL',
        ]);
      case 5:
        return porCat([
          'ITEM_ESPELHO_UND',
          'ITEM_CAR',
          'ITEM_CONSULTA_CAR',
          'ITEM_PROJETO_PDF',
        ]);
      case 6:
        return porCat([
          'ITEM_CAF',
          'ITEM_EXTRATO_CAF',
          'ITEM_CND_PF',
          'ITEM_CCIR',
          'ITEM_CND_ITR_IMOVEL',
        ]);
      case 10:
        return porCat([
          'CAD_1_IDENTIDADE_TITULAR',
          'CAD_1_IDENTIDADE_CONJUGE',
          'CAD_2_CERTIDAO_CASAMENTO',
        ]);
      case 12:
        return porCat(['ITEM_RB_PA']);
      case 13:
        return porCat(['ITEM_CERT_SOCIO_COM_KML', 'ITEM_CERT_SOCIO_SEM_KML']);
      case 13.5:
        return porCat(['ITEM_CERT_SOCIO_SEM_KML', 'ITEM_CERT_SOCIO_COM_KML']);
      case 15:
        return porCat([
          'ITEM_CND_PF',
          'ITEM_CNDT_PF',
          'ITEM_CND_ITR_IMOVEL',
          'ITEM_CCIR',
          'ITEM_INTEIRO_TEOR',
        ]);
      case 16:
        return validos.filter((a) => {
          const nUp = removerAcentos(a.nomeOriginal).toUpperCase();
          if (nUp.includes('PROPOSTA DE CADASTRO')) return false;
          return (
            /\bS400\b/.test(nUp) ||
            nUp.includes('FICHA CADASTRAL') ||
            nUp.includes('FICHA CADASTRO')
          );
        });
      default:
        return [];
    }
  };

  const arquivosImovelPreCarregadosDaPasta = useMemo(() => {
    const CATEGORIAS_IMOVEL = new Set<CategoriaDocPasta>([
      'ITEM_INTEIRO_TEOR',
      'ITEM_TITULO_DOMINIO',
      'ITEM_CCIR',
      'ITEM_CND_ITR_IMOVEL',
      'ITEM_CAR',
      'ITEM_CONSULTA_CAR',
      'ITEM_DOC_IMOVEL_GENERICO',
    ]);
    return arquivosLidos
      .filter(
        (a) =>
          !a.ehTxtPendencia &&
          a.extensao === 'pdf' &&
          (CATEGORIAS_IMOVEL.has(a.categoria) ||
            a.caminhoSubpasta.toUpperCase().includes('IMÓVEL') ||
            a.caminhoSubpasta.toUpperCase().includes('IMOVEL') ||
            a.caminhoSubpasta.toUpperCase().includes('LCGH') ||
            a.caminhoSubpasta.toUpperCase().includes('LCGA'))
      )
      .map((a) => ({
        file: a.fileObj,
        caminhoSubpasta: a.caminhoSubpasta,
      }));
  }, [arquivosLidos]);

  const diagnosticosFiltrados = useMemo(() => {
    const lista = auditoriaPdf?.itensDiagnostico || [];
    if (filtroStatus === 'PROBLEMAS') {
      return lista.filter((d) => d.status === 'ERRO' || d.status === 'ALERTA');
    }
    if (filtroStatus === 'OK') {
      return lista.filter((d) => d.status === 'OK' || d.status === 'INFO');
    }
    return lista;
  }, [auditoriaPdf, filtroStatus]);

  const resumoSemaforo = useMemo(() => {
    const lista = auditoriaPdf?.itensDiagnostico || [];
    const qtdErros =
      lista.filter((d) => d.status === 'ERRO').length +
      pendenciasFaltantesProjetista.length;
    const qtdAlertas =
      lista.filter((d) => d.status === 'ALERTA').length +
      tarefasFaltantesAnalista.length;
    const qtdOk =
      lista.filter((d) => d.status === 'OK').length +
      matrizCompletaDocumentos.filter((m) => m.presente).length;

    let statusGlobal: 'APTO' | 'RESSALVAS' | 'IMPEDIMENTO' | 'AGUARDANDO' =
      'AGUARDANDO';
    if (arquivosLidos.length > 0) {
      if (qtdErros > 0) statusGlobal = 'IMPEDIMENTO';
      else if (qtdAlertas > 0) statusGlobal = 'RESSALVAS';
      else statusGlobal = 'APTO';
    }

    return { qtdErros, qtdAlertas, qtdOk, statusGlobal };
  }, [
    auditoriaPdf,
    pendenciasFaltantesProjetista.length,
    tarefasFaltantesAnalista.length,
    matrizCompletaDocumentos,
    arquivosLidos.length,
  ]);

  const cpfTitular =
    editCpfTitular ||
    auditoriaPdf?.dadosProjetoParaParecer?.clienteCpf ||
    registroConformidadePronafAVinculado?.cpfCliente ||
    '';

  const cpfConjuge =
    editCpfConjuge ||
    auditoriaPdf?.dadosProjetoParaParecer?.conjugeCpf ||
    registroConformidadePronafAVinculado?.conjugeCpf ||
    '';

  const montarRelatorioConformidadeWhatsApp = (): string => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    let msg = `*RELATÓRIO DE CONFORMIDADE DO PROJETO - ${hoje}*\n`;
    msg += `👤 *Cliente:* ${titularDetectado || nomePasta}${
      cpfTitular ? ` | CPF: ${cpfTitular}` : ''
    }\n`;
    msg += `🚜 *Enquadramento:* ${porteAtivo.replace(
      '_',
      ' '
    )} (${escopoAtivo.replace(/_/g, ' ')})\n`;
    if (auditoriaPdf?.valorPropostaDetectado) {
      msg += `💰 *Valor Financiado:* R$ ${auditoriaPdf.valorPropostaDetectado}\n`;
    }
    msg += `\n`;

    if (pendenciasFaltantesProjetista.length > 0) {
      msg += `___________________\n📂 *DOCUMENTOS FALTANTES PARA ENVIAR (PROJETISTA / CLIENTE):*\n___________________\n\n`;
      pendenciasFaltantesProjetista.forEach((p) => {
        msg += `❌ *${p.titulo}*\n   • ${p.detalheStatus}\n`;
      });
      msg += `\n`;
    }

    const problemas = (auditoriaPdf?.itensDiagnostico || []).filter(
      (d) => d.status === 'ERRO' || d.status === 'ALERTA'
    );
    if (problemas.length > 0) {
      msg += `___________________\n🚨 *APONTAMENTOS TÉCNICOS NA AUDITORIA DOS ARQUIVOS:*\n___________________\n\n`;
      problemas.forEach((d) => {
        msg += `${d.status === 'ERRO' ? '❌' : '⚠️'} *${d.titulo}*\n   • ${
          d.resumo
        }\n`;
        (d.detalhes || [])
          .filter((det) => det.includes('🚨') || det.includes('⚠️'))
          .forEach((det) => {
            msg += `   • ${det}\n`;
          });
        msg += `\n`;
      });
    }

    if (tarefasFaltantesAnalista.length > 0) {
      msg += `___________________\n🏦 *TAREFAS INTERNAS / EMISSÕES DO ANALISTA NO DIA:*\n___________________\n\n`;
      tarefasFaltantesAnalista.forEach((t) => {
        msg += `▪️ ${t.titulo}\n`;
      });
    }

    return msg.trim();
  };

  const enviarRelatorioWhatsApp = async (apenasCopiar: boolean) => {
    const texto = montarRelatorioConformidadeWhatsApp();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(texto);
      } catch {
        // Ignora
      }
    }
    if (apenasCopiar) {
      alert('📋 Relatório de Conformidade copiado para o seu Ctrl+V!');
      return;
    }

    const projs = obterListaProjetistas();
    const alvo = (projetistaDetectado || '').toUpperCase().trim();
    const cad = projs.find(
      (p) =>
        p.nomeCurto.toUpperCase().trim() === alvo ||
        (p.nomeCompleto && p.nomeCompleto.toUpperCase().includes(alvo))
    );
    const fone = (cad?.telefone || '').replace(/\D/g, '');
    if (!fone) {
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`,
        '_blank'
      );
      return;
    }
    const ddi = fone.startsWith('55') ? fone : `55${fone}`;
    window.open(
      `https://wa.me/${ddi}?text=${encodeURIComponent(texto)}`,
      '_blank'
    );
  };

  if (!aberto || typeof document === 'undefined') return null;

  const dProj = auditoriaPdf?.dadosProjetoParaParecer;

  // ITEM 6: Estilo corrigido dos <select> para nunca cortar verticalmente o texto
  const selectPerfilStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '4px 8px',
    fontSize: '11px',
    lineHeight: '1.25',
    fontWeight: 800,
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxSizing: 'border-box',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f1f5f9',
        zIndex: 960000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* CABEÇALHO FIXO DE TELA CHEIA */}
      <header
        style={{
          background: 'linear-gradient(90deg, #004C27 0%, #065f46 100%)',
          color: '#ffffff',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          borderBottom: '3px solid #D99700',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              width: 'auto',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⬅️ Voltar ao Painel
          </button>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '0.3px',
                color: '#ffffff',
              }}
            >
              🛡️ VERIFICADOR GERAL DE CONFORMIDADE DO PROJETO (AUDITORIA PRÉ-ENVIO)
            </h2>
            <span style={{ fontSize: '11.5px', color: '#d1fae5' }}>
              Varredura completa de PDFs, KML, Gaveta de Coringas, Tarefas do
              Analista vs Pendências do Projetista e Leitor Integrado (🔎).
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={selecionarPastaParaAuditoria}
            style={{
              width: 'auto',
              padding: '9px 18px',
              background: '#D99700',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
            }}
          >
            📂 Selecionar Pasta da Proposta p/ Auditoria
          </button>

          {dirHandleRoot && (
            <>
              <button
                type="button"
                onClick={() => executarVarreduraCompletaDaPasta(dirHandleRoot)}
                style={{
                  width: 'auto',
                  padding: '8px 14px',
                  background: '#ffffff',
                  color: '#004C27',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🔄 Re-Auditar Pasta
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirHandleRoot(null);
                  setNomePasta('');
                  setArquivosLidos([]);
                  setAuditoriaPdf(null);
                  setTitularDetectado('');
                  setConjugeDetectado('');
                  setArquivoVisualizando(null);
                }}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🧹 Limpar
              </button>
            </>
          )}
        </div>
      </header>

      {/* CORPO EM 3 COLUNAS ESTRATÉGICAS */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '345px 1fr 375px',
          gap: '16px',
          padding: '16px 22px',
          overflow: 'hidden',
        }}
      >
        {/* COLUNA 1 (ESQUERDA): RESUMO EXECUTIVO DA PROPOSTA & SEMÁFORO GLOBAL */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {/* CARD SEMÁFORO DE VEREDITO */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              borderTop: `6px solid ${
                resumoSemaforo.statusGlobal === 'APTO'
                  ? '#16a34a'
                  : resumoSemaforo.statusGlobal === 'RESSALVAS'
                  ? '#f59e0b'
                  : resumoSemaforo.statusGlobal === 'IMPEDIMENTO'
                  ? '#dc2626'
                  : '#64748b'
              }`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
              }}
            >
              Veredito de Conformidade da Pasta
            </div>
            <div
              style={{
                marginTop: '4px',
                fontSize: '15px',
                fontWeight: 900,
                color:
                  resumoSemaforo.statusGlobal === 'APTO'
                    ? '#15803d'
                    : resumoSemaforo.statusGlobal === 'RESSALVAS'
                    ? '#b45309'
                    : resumoSemaforo.statusGlobal === 'IMPEDIMENTO'
                    ? '#b91c1c'
                    : '#334155',
              }}
            >
              {auditando
                ? '⏳ Auditando documentos...'
                : resumoSemaforo.statusGlobal === 'APTO'
                ? '✅ PASTA 100% APTA PARA ENVIO'
                : resumoSemaforo.statusGlobal === 'RESSALVAS'
                ? '⚠️ APTO COM TAREFAS DO ANALISTA'
                : resumoSemaforo.statusGlobal === 'IMPEDIMENTO'
                ? '🚨 PENDÊNCIAS / NÃO CONFORME'
                : '📂 Selecione uma pasta acima'}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                marginTop: '10px',
              }}
            >
              <div
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  padding: '6px',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 900 }}>
                  {resumoSemaforo.qtdOk}
                </div>
                <div style={{ fontSize: '9.5px', fontWeight: 800 }}>
                  ITENS OK
                </div>
              </div>
              <div
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '6px',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 900 }}>
                  {tarefasFaltantesAnalista.length}
                </div>
                <div style={{ fontSize: '9.5px', fontWeight: 800 }}>
                  SUAS TAREFAS
                </div>
              </div>
              <div
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '6px',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 900 }}>
                  {resumoSemaforo.qtdErros}
                </div>
                <div style={{ fontSize: '9.5px', fontWeight: 800 }}>
                  PROJETISTA
                </div>
              </div>
            </div>
          </div>

          {/* PERFIL E PARÂMETROS DA AUDITORIA (ITEM 6 CORRIGIDO) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <strong style={{ fontSize: '12px', color: '#004C27' }}>
              ⚙️ PERFIL DE AUDITORIA DA PASTA
            </strong>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Porte do Cliente
              </label>
              <select
                value={porteAtivo}
                onChange={(e) => {
                  const p = e.target.value as PorteOrganizador;
                  setPorteAtivo(p);
                  if (dirHandleRoot) {
                    executarVarreduraCompletaDaPasta(
                      dirHandleRoot,
                      p,
                      escopoAtivo,
                      modalidadeAtiva
                    );
                  }
                }}
                style={selectPerfilStyle}
              >
                <option value="PRONAF_A">PRONAF A</option>
                <option value="PRONAF_V">PRONAF V</option>
                <option value="MINI_PEQUENO">MINI / PEQUENO / DEMAIS</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Escopo da Operação na Pasta
              </label>
              <select
                value={escopoAtivo}
                onChange={(e) => {
                  const esc = e.target.value as EscopoOperacaoPasta;
                  setEscopoAtivo(esc);
                  if (dirHandleRoot) {
                    executarVarreduraCompletaDaPasta(
                      dirHandleRoot,
                      porteAtivo,
                      esc,
                      modalidadeAtiva
                    );
                  }
                }}
                style={selectPerfilStyle}
              >
                <option value="PRONAF_A_PADRAO">PRONAF A Padrão</option>
                <option value="DERIVADA_PURA">
                  Operação Derivada (Investimento / Custeio)
                </option>
                <option value="LIMITE_PURO">Somente Limite (LCGH / LCGA)</option>
                <option value="COMBO_DERIVADA_E_LIMITE">
                  Combo: Derivada + Limite (LCGH / LCGA)
                </option>
              </select>
            </div>

            {escopoAtivo !== 'LIMITE_PURO' && porteAtivo !== 'PRONAF_A' && (
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: '3px',
                  }}
                >
                  Finalidade da Derivada
                </label>
                <select
                  value={modalidadeAtiva}
                  onChange={(e) => {
                    const m = e.target.value as ModalidadeDerivada;
                    setModalidadeAtiva(m);
                    if (dirHandleRoot) {
                      executarVarreduraCompletaDaPasta(
                        dirHandleRoot,
                        porteAtivo,
                        escopoAtivo,
                        m
                      );
                    }
                  }}
                  style={selectPerfilStyle}
                >
                  <option value="INVESTIMENTO">INVESTIMENTO</option>
                  <option value="CUSTEIO">CUSTEIO</option>
                </select>
              </div>
            )}
          </div>

         {/* ITEM 2.1: RAIO-X DO PROJETO (MODO LEITURA COM BOTÃO COPIAR POR PADRÃO | DUPLO CLIQUE PARA EDITAR) */}
          <div
            onDoubleClick={() => {
              if (!modoEdicaoRaioX) setModoEdicaoRaioX(true);
            }}
            title={
              modoEdicaoRaioX
                ? 'Modo de edição ativo'
                : '💡 Dê 2 cliques neste quadro para editar manualmente qualquer campo'
            }
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              padding: '12px 14px',
              border: modoEdicaoRaioX
                ? '2px solid #004C27'
                : '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
              fontSize: '11px',
              userSelect: 'text',
              cursor: modoEdicaoRaioX ? 'default' : 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px dashed #cbd5e1',
                paddingBottom: '6px',
              }}
            >
              <div>
                <strong style={{ fontSize: '11.5px', color: '#004C27' }}>
                  📋 RAIO-X EXTRAÍDO DO PROJETO
                </strong>
                <span
                  style={{
                    display: 'block',
                    fontSize: '9.5px',
                    color: '#64748b',
                  }}
                >
                  {modoEdicaoRaioX
                    ? '✏️ Editando campos (Salva na Nuvem)'
                    : '💡 Duplo clique no quadro p/ editar'}
                </span>
              </div>

              {modoEdicaoRaioX ? (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await salvarAjustesManuaisDaLupinha(true);
                    setModoEdicaoRaioX(false);
                  }}
                  style={{
                    width: 'auto',
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: '#004C27',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  ✅ Concluir
                </button>
              ) : (
                statusSalvoRaioX && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#15803d',
                    }}
                  >
                    {statusSalvoRaioX}
                  </span>
                )
              )}
            </div>

            {registroConformidadePronafAVinculado && (
              <div
                style={{
                  background:
                    alertasConformidadePronafA.length > 0
                      ? '#fffbeb'
                      : '#f0fdf4',
                  border: `1px solid ${
                    alertasConformidadePronafA.length > 0
                      ? '#fcd34d'
                      : '#86efac'
                  }`,
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '10.5px',
                }}
              >
                <strong
                  style={{
                    color:
                      alertasConformidadePronafA.length > 0
                        ? '#b45309'
                        : '#15803d',
                    display: 'block',
                  }}
                >
                  🔗 Vinculado à Conformidade PRONAF A:
                </strong>
                <span>
                  Visita: <b>{registroConformidadePronafAVinculado.visitado}</b>{' '}
                  • Cad:{' '}
                  <b>{registroConformidadePronafAVinculado.cadastroClienteOk}</b>{' '}
                  • C/C:{' '}
                  <b>
                    {registroConformidadePronafAVinculado.contaCorrente || '-'}
                  </b>
                </span>
              </div>
            )}

            {!modoEdicaoRaioX ? (
              /* MODO PADRÃO (SOMENTE LEITURA + SELEÇÃO DE TEXTO + BOTÃOZINHO DE COPIAR EM CADA ITEM PREENCHIDO) */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                {[
                  {
                    id: 'pasta',
                    label: '📁 Pasta',
                    valor: nomePasta,
                  },
                  {
                    id: 'titular',
                    label: '👤 Titular',
                    valor: titularDetectado,
                  },
                  {
                    id: 'cpf_tit',
                    label: '🪪 CPF Titular',
                    valor: editCpfTitular,
                  },
                  {
                    id: 'nasc_tit',
                    label: '🎂 Nasc. Titular',
                    valor: editNascTitular,
                  },
                  {
                    id: 'est_civil',
                    label: '💍 Estado Civil',
                    valor: editEstadoCivil,
                  },
                  ...(conjugeDetectado || editCpfConjuge || editNascConjuge
                    ? [
                        {
                          id: 'conj_nome',
                          label: '👥 Cônjuge',
                          valor: conjugeDetectado,
                        },
                        {
                          id: 'conj_cpf',
                          label: '🪪 CPF Cônjuge',
                          valor: editCpfConjuge,
                        },
                        {
                          id: 'conj_nasc',
                          label: '🎂 Nasc. Cônjuge',
                          valor: editNascConjuge,
                        },
                      ]
                    : []),
                  ...(editProcuradorNome ||
                  editCpfProcurador ||
                  editNascProcurador
                    ? [
                        {
                          id: 'proc_nome',
                          label: '🤝 Proc./Aval.',
                          valor: editProcuradorNome,
                        },
                        {
                          id: 'proc_cpf',
                          label: '🪪 CPF Proc./Aval.',
                          valor: editCpfProcurador,
                        },
                        {
                          id: 'proc_nasc',
                          label: '🎂 Nasc. Proc./Aval.',
                          valor: editNascProcurador,
                        },
                      ]
                    : []),
                  {
                    id: 'valor',
                    label: '💰 Valor Financiado',
                    valor: editValorProj ? `R$ ${editValorProj}` : '',
                    valorCopy: editValorProj,
                  },
                  {
                    id: 'prazo',
                    label: '⏱️ Prazo / Carência',
                    valor:
                      editPrazoProj || editCarenciaProj
                        ? `${editPrazoProj || '-'}m / ${
                            editCarenciaProj || '0'
                          }m`
                        : '',
                    valorCopy: `${editPrazoProj || ''}/${
                      editCarenciaProj || ''
                    }`,
                  },
                  {
                    id: 'cc',
                    label: '🏦 C/C Consolidada',
                    valor: editCcConsol,
                  },
                  {
                    id: 'proj',
                    label: '👨‍💼 Projetista',
                    valor: projetistaDetectado,
                  },
                  {
                    id: 'imovel',
                    label: '📍 Imóvel / P.A.',
                    valor: paDetectado,
                  },
                  {
                    id: 'area',
                    label: '📐 Área (ha)',
                    valor: editAreaHa ? `${editAreaHa} ha` : '',
                    valorCopy: editAreaHa,
                  },
                  {
                    id: 'car',
                    label: '🗺️ Recibo CAR',
                    valor: editCarRecibo,
                  },
                ].map((row) => {
                  const valLimpo = (row.valor || '').trim();
                  const valParaCopiar = (row.valorCopy ?? valLimpo).trim();
                  const foiCopiado = chaveCopiadaRaioX === row.id;

                  return (
                    <div
                      key={row.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: valLimpo ? '#f8fafc' : '#fffbeb',
                        border: valLimpo
                          ? '1px solid #e2e8f0'
                          : '1px dashed #fcd34d',
                      }}
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <strong style={{ color: '#334155' }}>
                          {row.label}:
                        </strong>{' '}
                        {valLimpo ? (
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#0f172a',
                              wordBreak: 'break-all',
                            }}
                          >
                            {valLimpo}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              color: '#b45309',
                              fontStyle: 'italic',
                            }}
                          >
                            Não lido (2 cliques p/ inserir)
                          </span>
                        )}
                      </div>

                      {valLimpo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copiarValorRaioX(row.id, valParaCopiar);
                          }}
                          title={`Copiar "${valParaCopiar}"`}
                          style={{
                            width: 'auto',
                            padding: '1px 5px',
                            fontSize: '10px',
                            fontWeight: 800,
                            background: foiCopiado ? '#dcfce7' : '#ffffff',
                            color: foiCopiado ? '#15803d' : '#64748b',
                            border: `1px solid ${
                              foiCopiado ? '#86efac' : '#cbd5e1'
                            }`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {foiCopiado ? '✔' : '📋'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODO DE EDIÇÃO (ATIVADO APÓS DUPLO CLIQUE NO QUADRO) */
              (() => {
                const estiloCampoRaioX = (
                  val: string
                ): React.CSSProperties => ({
                  width: '100%',
                  height: '26px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: val.trim()
                    ? '1px solid #cbd5e1'
                    : '1px dashed #f59e0b',
                  background: val.trim() ? '#f8fafc' : '#fffbeb',
                  color: '#0f172a',
                });

                return (
                  <>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800 }}>
                        👤 Nome do Titular:
                      </label>
                      <input
                        type="text"
                        value={titularDetectado}
                        onChange={(e) =>
                          setTitularDetectado(e.target.value.toUpperCase())
                        }
                        onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                        placeholder="Não identificado — digite..."
                        style={estiloCampoRaioX(titularDetectado)}
                      />
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.15fr 1fr',
                        gap: '6px',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          🪪 CPF Titular:
                        </label>
                        <input
                          type="text"
                          value={editCpfTitular}
                          onChange={(e) =>
                            setEditCpfTitular(aplicarMascaraCPF(e.target.value))
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          style={estiloCampoRaioX(editCpfTitular)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          🎂 Nasc. Titular (CND):
                        </label>
                        <input
                          type="text"
                          value={editNascTitular}
                          onChange={(e) =>
                            setEditNascTitular(
                              aplicarMascaraDataBR(e.target.value)
                            )
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          style={estiloCampoRaioX(editNascTitular)}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800 }}>
                        💍 Estado Civil:
                      </label>
                      <select
                        value={editEstadoCivil}
                        onChange={(e) => {
                          setEditEstadoCivil(e.target.value);
                          setTimeout(
                            () => salvarAjustesManuaisDaLupinha(true),
                            50
                          );
                        }}
                        style={estiloCampoRaioX(editEstadoCivil)}
                      >
                        <option value="">
                          Não identificado — selecione...
                        </option>
                        <option value="SOLTEIRO(A)">SOLTEIRO(A)</option>
                        <option value="CASADO(A)">
                          CASADO(A) (Exige Cert. Casamento)
                        </option>
                        <option value="UNIÃO ESTÁVEL">
                          UNIÃO ESTÁVEL (Dispensa Cert. Casamento)
                        </option>
                        <option value="DIVORCIADO(A)">DIVORCIADO(A)</option>
                        <option value="VIÚVO(A)">VIÚVO(A)</option>
                      </select>
                    </div>

                    <div
                      style={{
                        background: '#faf5ff',
                        border: '1px solid #e9d5ff',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#6b21a8',
                          }}
                        >
                          👥 Nome do Cônjuge / Companheiro(a):
                        </label>
                        <input
                          type="text"
                          value={conjugeDetectado}
                          onChange={(e) =>
                            setConjugeDetectado(e.target.value.toUpperCase())
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="Sem cônjuge ou digite aqui..."
                          style={estiloCampoRaioX(conjugeDetectado)}
                        />
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.15fr 1fr',
                          gap: '6px',
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#6b21a8',
                            }}
                          >
                            🪪 CPF Cônjuge:
                          </label>
                          <input
                            type="text"
                            value={editCpfConjuge}
                            onChange={(e) =>
                              setEditCpfConjuge(
                                aplicarMascaraCPF(e.target.value)
                              )
                            }
                            onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            style={estiloCampoRaioX(editCpfConjuge)}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#6b21a8',
                            }}
                          >
                            🎂 Nasc. Cônjuge:
                          </label>
                          <input
                            type="text"
                            value={editNascConjuge}
                            onChange={(e) =>
                              setEditNascConjuge(
                                aplicarMascaraDataBR(e.target.value)
                              )
                            }
                            onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                            placeholder="DD/MM/AAAA"
                            maxLength={10}
                            style={estiloCampoRaioX(editNascConjuge)}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#0369a1',
                          }}
                        >
                          🤝 Procurador / Avalista (Se houver):
                        </label>
                        <input
                          type="text"
                          value={editProcuradorNome}
                          onChange={(e) =>
                            setEditProcuradorNome(e.target.value.toUpperCase())
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="Nome do Procurador/Avalista..."
                          style={estiloCampoRaioX(editProcuradorNome)}
                        />
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.15fr 1fr',
                          gap: '6px',
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#0369a1',
                            }}
                          >
                            🪪 CPF Proc./Aval.:
                          </label>
                          <input
                            type="text"
                            value={editCpfProcurador}
                            onChange={(e) =>
                              setEditCpfProcurador(
                                aplicarMascaraCPF(e.target.value)
                              )
                            }
                            onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            style={estiloCampoRaioX(editCpfProcurador)}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#0369a1',
                            }}
                          >
                            🎂 Nasc. Proc./Aval.:
                          </label>
                          <input
                            type="text"
                            value={editNascProcurador}
                            onChange={(e) =>
                              setEditNascProcurador(
                                aplicarMascaraDataBR(e.target.value)
                              )
                            }
                            onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                            placeholder="DD/MM/AAAA"
                            maxLength={10}
                            style={estiloCampoRaioX(editNascProcurador)}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 0.7fr 0.7fr',
                        gap: '5px',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          💰 Valor (R$):
                        </label>
                        <input
                          type="text"
                          value={editValorProj}
                          onChange={(e) =>
                            setEditValorProj(
                              aplicarMascaraMoedaInput(e.target.value)
                            )
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="0,00"
                          style={estiloCampoRaioX(editValorProj)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          ⏱️ Prazo (m):
                        </label>
                        <input
                          type="text"
                          value={editPrazoProj}
                          onChange={(e) => setEditPrazoProj(e.target.value)}
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="120"
                          style={estiloCampoRaioX(editPrazoProj)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          ⏳ Carên.(m):
                        </label>
                        <input
                          type="text"
                          value={editCarenciaProj}
                          onChange={(e) => setEditCarenciaProj(e.target.value)}
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="36"
                          style={estiloCampoRaioX(editCarenciaProj)}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '6px',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          🏦 C/C Consolidada:
                        </label>
                        <input
                          type="text"
                          value={editCcConsol}
                          onChange={(e) => setEditCcConsol(e.target.value)}
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="Ex: 67274-8"
                          style={estiloCampoRaioX(editCcConsol)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          👨‍💼 Projetista:
                        </label>
                        <input
                          type="text"
                          value={projetistaDetectado}
                          onChange={(e) =>
                            setProjetistaDetectado(e.target.value.toUpperCase())
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="Projetista..."
                          style={estiloCampoRaioX(projetistaDetectado)}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 0.7fr',
                        gap: '6px',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          📍 Imóvel / P.A.:
                        </label>
                        <input
                          type="text"
                          value={paDetectado}
                          onChange={(e) =>
                            setPaDetectado(e.target.value.toUpperCase())
                          }
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="P.A. / Fazenda..."
                          style={estiloCampoRaioX(paDetectado)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800 }}>
                          📐 Área (ha):
                        </label>
                        <input
                          type="text"
                          value={editAreaHa}
                          onChange={(e) => setEditAreaHa(e.target.value)}
                          onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                          placeholder="ha"
                          style={estiloCampoRaioX(editAreaHa)}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800 }}>
                        🗺️ Recibo CAR:
                      </label>
                      <input
                        type="text"
                        value={editCarRecibo}
                        onChange={(e) =>
                          setEditCarRecibo(e.target.value.toUpperCase())
                        }
                        onBlur={() => salvarAjustesManuaisDaLupinha(true)}
                        placeholder="MA-210..."
                        style={estiloCampoRaioX(editCarRecibo)}
                      />
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </aside>

        {/* COLUNA 2 (CENTRAL): MANTÉM O RELATÓRIO MONTADO NO DOM PARA NUNCA PERDER A POSIÇÃO DE ROLAGEM AO FECHAR O PDF (ITEM 2.2) */}
        <main
          style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* LEITOR DE PDF SOBREPOSTO QUANDO ATIVO */}
          {arquivoVisualizando && urlPdfVisualizando && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
              }}
            >
              <div
                style={{
                  padding: '10px 16px',
                  background: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🔎</span>
                  <div style={{ overflow: 'hidden' }}>
                    <strong
                      style={{
                        fontSize: '12.5px',
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {arquivoVisualizando.nomeOriginal}
                    </strong>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      Subpasta:{' '}
                      {arquivoVisualizando.caminhoSubpasta || 'Raiz da Pasta'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    disabled={executandoOcr}
                    onClick={() =>
                      rodarOcrNoPdfAbertoEReauditar(arquivoVisualizando)
                    }
                    style={{
                      width: 'auto',
                      padding: '6px 12px',
                      background: executandoOcr
                        ? '#b45309'
                        : textosOcrExtraidos[arquivoVisualizando.nomeOriginal]
                        ? '#0d9488'
                        : '#7c3aed',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: executandoOcr ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title="Extrai o texto de PDFs escaneados como imagem (via OCR óptico) e re-audita automaticamente prazos, valores, Inteiro Teor (15 anos + aquisição) e cláusulas!"
                  >
                    {executandoOcr
                      ? `⏳ ${progressoOcrMsg || 'Lendo OCR...'}`
                      : textosOcrExtraidos[arquivoVisualizando.nomeOriginal]
                      ? '✅ OCR Aplicado (Re-executar OCR)'
                      : '🧠 Ler OCR & Re-Auditar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalCopilotAberto(true)}
                    style={{
                      width: 'auto',
                      padding: '6px 12px',
                      background: 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)',
                      color: '#ffffff',
                      border: '1px solid #93c5fd',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                    }}
                    title="Gera o Script personalizado com os dados deste cliente e regras do documento para colar no Microsoft Copilot!"
                  >
                    🤖 Copilot
                  </button>    


                  <button
                    type="button"
                    onClick={() =>
                      setPainelEdicaoRapidaAberto(!painelEdicaoRapidaAberto)
                    }
                    style={{
                      width: 'auto',
                      padding: '6px 12px',
                      background: painelEdicaoRapidaAberto
                        ? '#f59e0b'
                        : '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✏️{' '}
                    {painelEdicaoRapidaAberto
                      ? 'Ocultar Painel de Transcrição'
                      : 'Editar Dados'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      abrirLocalDoArquivoNoExplorer(arquivoVisualizando)
                    }
                    style={{
                      width: 'auto',
                      padding: '6px 12px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title="Abre a pasta/subpasta onde este arquivo está localizado no Windows Explorer (e copia o nome do arquivo)"
                  >
                    📂 
                  </button>

                  {!arquivoVisualizando.origemGaveta && (
                    <button
                      type="button"
                      onClick={() =>
                        apagarDocumentoDiretoDaPasta(arquivoVisualizando)
                      }
                      style={{
                        width: 'auto',
                        padding: '6px 12px',
                        background: '#991b1b',
                        color: '#ffffff',
                        border: '1px solid #f87171',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      title="Apaga este arquivo permanentemente da pasta do cliente e re-audita a proposta"
                    >
                      🗑️
                    </button>
                  )}

                  <a
                    href={urlPdfVisualizando}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      background: '#334155',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ↗️ Nova Guia
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setArquivoVisualizando(null);
                      setPainelEdicaoRapidaAberto(false);
                    }}
                    style={{
                      width: 'auto',
                      padding: '6px 14px',
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✖ Fechar
                  </button>
                </div>
              </div>

              {painelEdicaoRapidaAberto && (
                <div
                  style={{
                    background: '#fffbeb',
                    borderBottom: '2px solid #f59e0b',
                    padding: '10px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#92400e',
                        }}
                      >
                        💰 Valor Financiado (R$)
                      </label>
                      <input
                        type="text"
                        value={editValorProj}
                        onChange={(e) => setEditValorProj(e.target.value)}
                        style={{
                          width: '100%',
                          height: '28px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#92400e',
                        }}
                      >
                        ⏱️ Prazo (Meses)
                      </label>
                      <input
                        type="text"
                        value={editPrazoProj}
                        onChange={(e) => setEditPrazoProj(e.target.value)}
                        placeholder="Ex: 120"
                        style={{
                          width: '100%',
                          height: '28px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#92400e',
                        }}
                      >
                        ⏳ Carência (Meses)
                      </label>
                      <input
                        type="text"
                        value={editCarenciaProj}
                        onChange={(e) => setEditCarenciaProj(e.target.value)}
                        placeholder="Ex: 36"
                        style={{
                          width: '100%',
                          height: '28px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#92400e',
                        }}
                      >
                        🏦 C/C Consolidada
                      </label>
                      <input
                        type="text"
                        value={editCcConsol}
                        onChange={(e) => setEditCcConsol(e.target.value)}
                        placeholder="Ex: 67274-8"
                        style={{
                          width: '100%',
                          height: '28px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => salvarAjustesManuaisDaLupinha(false)}
                      style={{
                        width: 'auto',
                        height: '28px',
                        padding: '0 14px',
                        background: '#004C27',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      💾 Salvar no Cache do Parecer
                    </button>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#92400e',
                      }}
                    >
                      📦 Itens de Inversão Lidos (Confira no PDF abaixo ou
                      ajuste se necessário):
                    </label>
                    <textarea
                      rows={2}
                      value={editItensTexto}
                      onChange={(e) => setEditItensTexto(e.target.value)}
                      placeholder="- 10 UNID de MATRIZES BOVINAS: R$ 35.000,00..."
                      style={{
                        width: '100%',
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #fcd34d',
                        background: '#ffffff',
                      }}
                    />
                  </div>
                </div>
              )}

              <iframe
                src={urlPdfVisualizando}
                title={arquivoVisualizando.nomeOriginal}
                style={{
                  flex: 1,
                  width: '100%',
                  border: 'none',
                  background: '#334155',
                }}
              />
            </div>
          )}

          {/* RELATÓRIO DE VARREDURA PROFUNDA (SEMPRE MONTADO PARA PRESERVAR O SCROLL) */}
          <div
            style={{
              padding: '12px 16px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>
              🔍 RELATÓRIO DE VARREDURA PROFUNDA ({arquivosLidos.length}{' '}
              arquivos inspecionados)
            </strong>

            <div style={{ display: 'flex', gap: '6px' }}>
              {(['TODOS', 'PROBLEMAS', 'OK'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltroStatus(f)}
                  style={{
                    width: 'auto',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: filtroStatus === f ? '#004C27' : '#ffffff',
                    color: filtroStatus === f ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                  }}
                >
                  {f === 'TODOS'
                    ? '📋 Mostrar Todos'
                    : f === 'PROBLEMAS'
                    ? '🚨 Apenas Pendências / Alertas'
                    : '✅ Apenas Itens OK'}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {arquivosLidos.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#64748b',
                }}
              >
                <div style={{ fontSize: '42px', marginBottom: '10px' }}>🛡️</div>
                <h3 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>
                  Nenhuma pasta carregada para auditoria
                </h3>
                <p
                  style={{
                    fontSize: '12.5px',
                    maxWidth: '520px',
                    margin: '0 auto',
                  }}
                >
                  Clique no botão amarelo{' '}
                  <b>
                    &ldquo;📂 Selecionar Pasta da Proposta p/ Auditoria&rdquo;
                  </b>{' '}
                  no topo da tela para escanear todas as subpastas, PDFs, KML e
                  certidões do cliente.
                </p>
              </div>
            ) : (
              <>
                {/* PAINEL 1 (ITEM 5.2): PENDÊNCIAS DO PROJETISTA / CLIENTE */}
                {pendenciasFaltantesProjetista.length > 0 &&
                  filtroStatus !== 'OK' && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        borderLeft: '6px solid #dc2626',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '12.5px',
                          color: '#991b1b',
                          display: 'block',
                          marginBottom: '8px',
                        }}
                      >
                        👨‍💼 DOCUMENTOS FALTANTES PARA COBRAR DO PROJETISTA /
                        CLIENTE ({pendenciasFaltantesProjetista.length}):
                      </strong>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {pendenciasFaltantesProjetista.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              padding: '7px 10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '11.5px',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#991b1b' }}>
                                ❌ {item.titulo}:
                              </strong>{' '}
                              <span style={{ color: '#334155' }}>
                                {item.detalheStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* PAINEL 2 (ITEM 5.1): TAREFAS / CONSULTAS DO ANALISTA NO DIA */}
                {tarefasFaltantesAnalista.length > 0 &&
                  filtroStatus !== 'OK' && (
                    <div
                      style={{
                        background: '#fffbeb',
                        border: '1px solid #fcd34d',
                        borderLeft: '6px solid #d97706',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '12.5px',
                          color: '#92400e',
                          display: 'block',
                          marginBottom: '8px',
                        }}
                      >
                        🏦 TAREFAS E CONSULTAS DO ANALISTA (EMITIR / VALIDAR NO
                        DIA) ({tarefasFaltantesAnalista.length}):
                      </strong>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {tarefasFaltantesAnalista.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #fde68a',
                              borderRadius: '6px',
                              padding: '7px 10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '11.5px',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#b45309' }}>
                                ⚡ {item.titulo}:
                              </strong>{' '}
                              <span style={{ color: '#334155' }}>
                                {item.detalheStatus}
                              </span>
                            </div>

                            {item.arquivosRelacionados.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {item.arquivosRelacionados.map((arq) => (
                                  <button
                                    key={arq.id}
                                    type="button"
                                    onClick={() => setArquivoVisualizando(arq)}
                                    style={{
                                      width: 'auto',
                                      padding: '3px 8px',
                                      fontSize: '10.5px',
                                      fontWeight: 800,
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      border: '1px solid #bfdbfe',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                    title={`Abrir ${arq.nomeOriginal} aqui no painel`}
                                  >
                                    🔎 Ver PDF
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* PAINEL 3: DIAGNÓSTICOS DE CONTEÚDO COM LUPINHA (🔎) */}
                {diagnosticosFiltrados.map((diag) => {
                  const corBorda =
                    diag.status === 'ERRO'
                      ? '#dc2626'
                      : diag.status === 'ALERTA'
                      ? '#f59e0b'
                      : '#16a34a';
                  const corFundo =
                    diag.status === 'ERRO'
                      ? '#fef2f2'
                      : diag.status === 'ALERTA'
                      ? '#fffbeb'
                      : '#f0fdf4';

                  const arqsVinculados = obterArquivosParaDiagnostico(
                    diag.numero
                  );

                  return (
                    <div
                      key={diag.numero}
                      style={{
                        background: corFundo,
                        border: `1px solid ${corBorda}`,
                        borderLeft: `5px solid ${corBorda}`,
                        borderRadius: '8px',
                        padding: '10px 14px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginBottom: '6px',
                        }}
                      >
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                          {diag.status === 'ERRO'
                            ? '🚨 '
                            : diag.status === 'ALERTA'
                            ? '⚠️ '
                            : '✅ '}
                          {diag.titulo}
                        </strong>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {arqsVinculados.map((arq) => (
                            <button
                              key={arq.id}
                              type="button"
                              onClick={() => setArquivoVisualizando(arq)}
                              style={{
                                width: 'auto',
                                padding: '2px 8px',
                                fontSize: '10px',
                                fontWeight: 800,
                                background: '#ffffff',
                                color: '#1d4ed8',
                                border: '1px solid #93c5fd',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title={`Inspecionar "${arq.nomeOriginal}" no leitor integrado`}
                            >
                              🔎{' '}
                              {arq.nomeOriginal.length > 26
                                ? arq.nomeOriginal.slice(0, 24) + '...'
                                : arq.nomeOriginal}
                            </button>
                          ))}

                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: '#ffffff',
                              color: corBorda,
                              border: `1px solid ${corBorda}`,
                            }}
                          >
                            {diag.status}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#334155',
                          fontWeight: 600,
                        }}
                      >
                        {diag.resumo}
                      </div>

                      {diag.detalhes && diag.detalhes.length > 0 && (
                        <div
                          style={{
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px dashed rgba(0,0,0,0.12)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            fontSize: '11px',
                            color: '#1e293b',
                          }}
                        >
                          {diag.detalhes.map((det, idxD) => (
                            <div key={idxD}>{det}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* PAINEL 4: TODOS OS DOCUMENTOS VALIDADOS NA PASTA COM LUPINHA (🔎) */}
                {filtroStatus !== 'PROBLEMAS' && (
                  <div
                    style={{
                      background: '#f8fafc',
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
                      📂 DOCUMENTOS PRESENTES NA PASTA — CLIQUE EM 🔎 PARA ABRIR
                      O PDF AQUI NA TELA:
                    </strong>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '6px',
                      }}
                    >
                      {arquivosLidos
                        .filter(
                          (a) => !a.ehTxtPendencia && a.extensao === 'pdf'
                        )
                        .map((arq) => (
                          <button
                            key={arq.id}
                            type="button"
                            onClick={() => setArquivoVisualizando(arq)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#1e293b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              textAlign: 'left',
                            }}
                            title="Clique para abrir este PDF no painel central"
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              📄 {arq.nomeOriginal}
                            </span>
                            <span
                              style={{
                                fontSize: '12px',
                                color: '#1d4ed8',
                                flexShrink: 0,
                              }}
                            >
                              🔎
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* COLUNA 3 (DIREITA): CENTRAL DE AÇÕES, CONSULTAS AGRUPADAS E SCANNER DE IMÓVEIS */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {/* CARD 1: CONSULTAS DO DIA COM AGRUPAMENTO (ITEM 2 E 4) */}
          <PainelConsultasRapidasAgrupadas
            cpfTitular={cpfTitular}
            dataNascTitular={
              editNascTitular || dProj?.clienteDataNascimento || ''
            }
            cpfConjuge={cpfConjuge}
            dataNascConjuge={
              editNascConjuge || dProj?.conjugeDataNascimento || ''
            }
            cpfProcuradorOuAvalista={
              editCpfProcurador ||
              dProj?.procuradorCpfExtraido ||
              registroConformidadePronafAVinculado?.procuradorCpf ||
              ''
            }
            dataNascProcuradorOuAvalista={
              editNascProcurador || dProj?.procuradorDataNascimento || ''
            }
            carRecibo={
              editCarRecibo || auditoriaPdf?.carEspecificoDetectado || ''
            }
          />

          {/* CARD 2: BOTÃO EXCLUSIVO DE AUDITORIA DE DOCUMENTAÇÃO DE IMÓVEIS */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '14px 16px',
              boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
            }}
          >
            <strong
              style={{
                fontSize: '12.5px',
                display: 'block',
                marginBottom: '5px',
              }}
            >
              🏡 AUDITORIA ESPECÍFICA DE DOCUMENTOS DE IMÓVEIS
            </strong>
            <p
              style={{
                fontSize: '11px',
                color: '#dbeafe',
                margin: '0 0 10px 0',
                lineHeight: 1.35,
              }}
            >
              Audite separadamente vários PDFs de Matrículas (Inteiro Teor 15
              anos / 30 dias), CCIR, CND/ITR, CAR e Títulos de Domínio.
            </p>
            <button
              type="button"
              onClick={() => {
                if (onAbrirConferenciaImoveis) {
                  onAbrirConferenciaImoveis();
                } else {
                  setModalImoveisAberto(true);
                }
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: '#ffffff',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              🔍 Conferir Documentação de Imóveis (Multi-PDF)
            </button>
          </div>

          {/* CARD 3: CORREÇÃO AUTOMÁTICA DE POLÍGONOS DO KML NA PASTA */}
          {auditoriaPdf?.kmlCorrigidoAutomaticamente && (
            <div
              style={{
                background: '#fffbeb',
                border: '2px solid #f59e0b',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <strong
                style={{
                  fontSize: '12px',
                  color: '#b45309',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                🔧 CORREÇÃO AUTOMÁTICA DE KML DISPONÍVEL
              </strong>
              <p
                style={{
                  fontSize: '11.5px',
                  color: '#78350f',
                  margin: '0 0 10px 0',
                }}
              >
                O arquivo{' '}
                <b>{auditoriaPdf.kmlCorrigidoAutomaticamente.nomeArquivo}</b>{' '}
                possui polígono(s) aberto(s).
              </p>
              <button
                type="button"
                onClick={salvarKmlCorrigidoNaPasta}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: '#004C27',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🔧 Fechar Polígonos do .KML Direto na Pasta
              </button>
            </div>
          )}

          {/* CARD 4: COBRANÇA DE PENDÊNCIAS NO WHATSAPP DO PROJETISTA */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <strong style={{ fontSize: '12px', color: '#15803d' }}>
              📲 RELATÓRIO DE CRÍTICAS PARA O PROJETISTA
            </strong>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Separa automaticamente o que falta o projetista enviar do que é
              consulta interna da agência ({projetistaDetectado || 'Proj.'}).
            </span>

            <button
              type="button"
              disabled={arquivosLidos.length === 0}
              onClick={() => enviarRelatorioWhatsApp(false)}
              style={{
                width: '100%',
                padding: '9px',
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              📲 Enviar Relatório p/ WhatsApp ({projetistaDetectado || 'Proj.'})
            </button>

            <button
              type="button"
              disabled={arquivosLidos.length === 0}
              onClick={() => enviarRelatorioWhatsApp(true)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              📋 Apenas Copiar Relatório Formatado
            </button>
          </div>
        </aside>
      </div>

      <ModalConferenciaDocumentacaoImoveis
        aberto={modalImoveisAberto}
        onFechar={() => setModalImoveisAberto(false)}
        titularEsperado={titularDetectado}
        cpfEsperado={cpfTitular}
        areaProjetoEsperadaHa={dProj?.areaImovelHa || ''}
        imovelEsperadoNome={paDetectado}
        arquivosImovelDaPasta={arquivosImovelPreCarregadosDaPasta}
      />

      {arquivoVisualizando && (
        <ModalScriptCopilotDocumento
          aberto={modalCopilotAberto}
          onFechar={() => setModalCopilotAberto(false)}
          fileObj={arquivoVisualizando.fileObj}
          onAbrirLocalArquivo={() =>
            abrirLocalDoArquivoNoExplorer(arquivoVisualizando)
          }
          contexto={{
            nomeArquivo: arquivoVisualizando.nomeOriginal,
            categoria: arquivoVisualizando.categoria,
            porte: porteAtivo,
            escopo: escopoAtivo,
            modalidadeDerivada: modalidadeAtiva,
            titularNome: titularDetectado,
            titularCpf: cpfTitular,
            estadoCivil: editEstadoCivil,
            conjugeNome: conjugeDetectado,
            conjugeCpf: cpfConjuge,
            imovelNome: paDetectado,
            areaEsperadaHa: editAreaHa || dProj?.areaImovelHa || '',
            valorProposta: editValorProj,
            prazoMeses: editPrazoProj,
            carenciaMeses: editCarenciaProj,
          }}
          onImportarDadosDoCopilot={(dados: any) => {
            const novoVal = dados.valorFinanciado || editValorProj;
            const novoPr = dados.prazoMeses || editPrazoProj;
            const novaCar = dados.carenciaMeses || editCarenciaProj;
            const novaCc = dados.contaCorrente || editCcConsol;
            const novoEst = dados.estadoCivil || editEstadoCivil;
            const novoConj = dados.conjugeNome ?? conjugeDetectado;
            const novoCpfConj = dados.conjugeCpf || editCpfConjuge;
            const novoNascConj = dados.conjugeNasc || editNascConjuge;
            const novoNascTit = dados.titularNasc || editNascTitular;
            const novaArea = dados.areaHa || editAreaHa;
            const novosItens = dados.itensInversao || editItensTexto;

            setEditValorProj(novoVal);
            setEditPrazoProj(novoPr);
            setEditCarenciaProj(novaCar);
            setEditCcConsol(novaCc);
            setEditEstadoCivil(novoEst);
            setConjugeDetectado(novoConj);
            setEditCpfConjuge(novoCpfConj);
            setEditNascConjuge(novoNascConj);
            setEditNascTitular(novoNascTit);
            setEditAreaHa(novaArea);
            setEditItensTexto(novosItens);

            setPainelEdicaoRapidaAberto(true);
            salvarAjustesManuaisDaLupinha(true, {
              valor: novoVal,
              prazo: novoPr,
              carencia: novaCar,
              cc: novaCc,
              estCivil: novoEst,
              conjuge: novoConj,
              cpfConj: novoCpfConj,
              nascConj: novoNascConj,
              nascTit: novoNascTit,
              area: novaArea,
              itensTexto: novosItens,
            });
          }}
        />
      )}
    </div>,
    document.body
  );
}