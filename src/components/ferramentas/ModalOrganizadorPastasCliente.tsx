'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  executarAuditoriaCompletaDosPdfsDaPasta,
  ResultadoAuditoriaPastaPdf,
} from '@/lib/auditorInteligentePdfPasta';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import ModuloKanban from '@/components/ModuloKanban';
import {
  RegistroContratacao,
  CardKanban,
  EtapaKanban,
  OperacaoBaseDesembolso,
  EventoDesembolso,
} from '@/types/painel';
import {
  LISTA_PROJETISTAS_CURTOS,
  aplicarMascaraMoedaInput,
  aplicarMascaraDataBR,
  aplicarMascaraCPF,
  getHojeBR,
  getHojeISO,
  obterListaProgramas,
  isEnquadradoCadaVezMelhor,
} from '@/lib/utils';
import {
  salvarCoringaGavetaSync,
  removerCoringaGavetaSync,
  carregarCoringasGavetaSync,
  CoringaGavetaNuvemItem,
  salvarKanbanSync,
  salvarContratacoesSync,
  salvarDesembOpSync,
  salvarDesembEvSync,
  lerCacheLocal,
  STORAGE_KEYS_V2,
} from '@/lib/firebaseSync';
import { montarHtmlCardSincronizado } from '@/lib/integradorSincronizado';
import {
  ItemConformidadePronafA,
  ListaSalvaConformidadePronafA,
  STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A,
  classificarListaConformidadePronafA,
  ResultadoClassificacaoPronafA,
} from '@/components/ferramentas/ModalConformidadePronafA';

interface ModalOrganizadorPastasClienteProps {
  aberto: boolean;
  onFechar: () => void;
  contratacoes: RegistroContratacao[];
  cardsKanban?: CardKanban[];
  onCadastrarPropostaNoPainel?: (
    novaContratacao: RegistroContratacao,
    novoCardKanban: CardKanban
  ) => void;
}

export type CategoriaDocPasta =
  | 'IGNORAR'
  | 'ITEM_1_PROJETO_ARQ'
  | 'ITEM_2_AUT_ALTERACAO'
  | 'ITEM_3_EMBARGOS_TITULAR'
  | 'ITEM_3_EMBARGOS_CONJUGE'
  | 'ITEM_4_IMPROBIDADE_TITULAR'
  | 'ITEM_4_IMPROBIDADE_CONJUGE'
  | 'ITEM_5_CERT_SOCIOAMBIENTAL'
  | 'ITEM_6_CREA'
  | 'ITEM_7_EXTRATO_SICOR'
  | 'ITEM_8_CONTRATO_ASSESSORIA'
  | 'ITEM_9_CONSOLIDADAS'
  | 'ITEM_10_DEC_AMBIENTAIS'
  | 'ITEM_10_1_REG_AMBIENTAL'
  | 'ITEM_10_2_NAO_DESMATAMENTO'
  | 'ITEM_10_3_RECOMPOSICAO'
  | 'ITEM_10_4_OUTRA_DEC_AMBIENTAL'
  | 'ITEM_11_ESPELHO_UND'
  | 'ITEM_12_PROJETO_PDF'
  | 'ITEM_13_CAR'
  | 'ITEM_13_CONSULTA_CAR'
  | 'ITEM_14_CAF'
  | 'ITEM_15_DCAA'
  | 'ITEM_16_PARECER_TECNICO'
  | 'ITEM_17_RB_PA'
  | 'ITEM_18_ORCAMENTO'
  | 'ITEM_19_CAPA_ANALISADOR'
  | 'ITEM_20_PARECER_GERENCIAL'
  | 'ITEM_21_PARECER_SEMA'
  | 'CAD_1_IDENTIDADE_TITULAR'
  | 'CAD_1_IDENTIDADE_CONJUGE'
  | 'CAD_1_IDENTIDADE_OUTRO'
  | 'CAD_2_CERTIDAO_CASAMENTO'
  | 'CAD_3_COMP_ENDERECO'
  | 'CAD_4_COMP_RENDA'
  | 'CAD_5_PROPOSTA_CADASTRO'
  | 'CAD_6_PROCURACAO'
  | 'CAD_8_SELO_CARTORIO'
  | 'CAD_9_OUTROS_CADASTRO';

const CATEGORIAS_QUE_ACEITAM_VITI = new Set<CategoriaDocPasta>([
  'ITEM_2_AUT_ALTERACAO',
  'ITEM_8_CONTRATO_ASSESSORIA',
  'ITEM_9_CONSOLIDADAS',
  'ITEM_10_DEC_AMBIENTAIS',
  'ITEM_10_1_REG_AMBIENTAL',
  'ITEM_10_2_NAO_DESMATAMENTO',
  'ITEM_10_3_RECOMPOSICAO',
  'ITEM_10_4_OUTRA_DEC_AMBIENTAL',
  'ITEM_12_PROJETO_PDF',
  'ITEM_16_PARECER_TECNICO',
  'ITEM_18_ORCAMENTO',
  'CAD_5_PROPOSTA_CADASTRO',
]);

interface ArquivoMapeadoItem {
  id: string;
  nomeOriginal: string;
  extensao: string;
  fileObj: File;
  categoria: CategoriaDocPasta;
  isViti: boolean;
  origemGaveta?: boolean;
  subtipoAmbientalExtra?: string;
}

const DB_NAME_COFRE = 'bnb_v2_cofre_coringas_db';
const STORE_NAME_COFRE = 'arquivos_coringas';

function abrirBancoCofre(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME_COFRE, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME_COFRE)) {
        db.createObjectStore(STORE_NAME_COFRE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listarCoringasDoCofreLocal(): Promise<CoringaGavetaNuvemItem[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return [];
  try {
    const db = await abrirBancoCofre();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME_COFRE, 'readonly');
      const store = tx.objectStore(STORE_NAME_COFRE);
      const req = store.getAll();
      req.onsuccess = () =>
        resolve((req.result as CoringaGavetaNuvemItem[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function salvarCoringaNoCofreLocal(
  item: CoringaGavetaNuvemItem
): Promise<void> {
  const db = await abrirBancoCofre();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME_COFRE, 'readwrite');
    tx.objectStore(STORE_NAME_COFRE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removerCoringaDoCofreLocal(id: string): Promise<void> {
  const db = await abrirBancoCofre();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME_COFRE, 'readwrite');
    tx.objectStore(STORE_NAME_COFRE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function arrayBufferParaBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// CORRIGIDO TS2322: Retorna ArrayBuffer puro (100% compatível com new File([buffer], ...))
function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const bin = window.atob(base64.replace(/\s+/g, ''));
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return buffer;
}

function removerAcentos(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extrairPrimeiroNome(nomeCompleto: string): string {
  const limpo = (nomeCompleto || '').trim().toUpperCase();
  if (!limpo) return '';
  return limpo.split(/\s+/)[0];
}

function obterNomesCurtosDesambiguados(params: {
  titularCompleto: string;
  conjugeCompleto: string;
  procuradorCompleto: string;
  avalistaCompleto: string;
}) {
  const pTit = extrairPrimeiroNome(params.titularCompleto) || 'CLIENTE';
  const pConj = extrairPrimeiroNome(params.conjugeCompleto);
  const pProc = extrairPrimeiroNome(params.procuradorCompleto);
  const pAval = extrairPrimeiroNome(params.avalistaCompleto);

  const todos = [pTit, pConj, pProc, pAval].filter(Boolean);
  const contagem: Record<string, number> = {};
  todos.forEach((n) => {
    contagem[n] = (contagem[n] || 0) + 1;
  });

  return {
    titular: contagem[pTit] > 1 ? `${pTit} (TITULAR)` : pTit,
    conjuge: pConj ? (contagem[pConj] > 1 ? `${pConj} (CÔNJUGE)` : pConj) : '',
    procurador: pProc
      ? contagem[pProc] > 1
        ? `${pProc} (PROCURADOR)`
        : pProc
      : '',
    avalista: pAval ? (contagem[pAval] > 1 ? `${pAval} (AVALISTA)` : pAval) : '',
  };
}

function gerarTxtsZeroDaConformidadePronafA(
  itemConf: ItemConformidadePronafA | null
): string[] {
  if (!itemConf) return [];
  const alertasZero: string[] = [];

  const temConj = Boolean(itemConf.conjugeNome.trim() || itemConf.conjugeCpf.trim());
  const temProc = Boolean(
    itemConf.procuradorNome.trim() || itemConf.procuradorCpf.trim()
  );

  const elab: string[] = [];
  if (itemConf.cadastroClienteOk === 'A_ELABORAR') elab.push('DO TITULAR');
  if (temConj && itemConf.cadastroConjugeOk === 'A_ELABORAR')
    elab.push('DO CÔNJUGE');
  if (temProc && itemConf.cadastroProcuradorOk === 'A_ELABORAR')
    elab.push('DO PROCURADOR');

  if (elab.length === 3) {
    alertasZero.push(
      '0. ELABORAR CADASTRO DO TITULAR, CÔNJUGE E PROCURADOR.txt'
    );
  } else if (elab.length === 2) {
    alertasZero.push(`0. ELABORAR CADASTRO ${elab[0]} E ${elab[1]}.txt`);
  } else if (elab.length === 1) {
    alertasZero.push(`0. ELABORAR CADASTRO ${elab[0]}.txt`);
  }

  const renov: string[] = [];
  if (itemConf.cadastroClienteOk === 'A_RENOVAR') renov.push('DO TITULAR');
  if (temConj && itemConf.cadastroConjugeOk === 'A_RENOVAR')
    renov.push('DO CÔNJUGE');
  if (temProc && itemConf.cadastroProcuradorOk === 'A_RENOVAR')
    renov.push('DO PROCURADOR');

  if (renov.length === 3) {
    alertasZero.push(
      '0. RENOVAR CADASTRO DO TITULAR, CÔNJUGE E PROCURADOR.txt'
    );
  } else if (renov.length === 2) {
    alertasZero.push(`0. RENOVAR CADASTRO ${renov[0]} E ${renov[1]}.txt`);
  } else if (renov.length === 1) {
    alertasZero.push(`0. RENOVAR CADASTRO ${renov[0]}.txt`);
  }

  if (itemConf.restricaoClienteNivel === 'GRAVE') {
    alertasZero.push('0. CLIENTE COM RESTRIÇÃO GRAVE.txt');
  }
  if (temConj && itemConf.restricaoConjugeNivel === 'GRAVE') {
    alertasZero.push('0. CÔNJUGE COM RESTRIÇÃO GRAVE.txt');
  }
  if (temProc && itemConf.restricaoProcuradorNivel === 'GRAVE') {
    alertasZero.push('0. PROCURADOR COM RESTRIÇÃO GRAVE.txt');
  }

  if (
    itemConf.restricaoClienteNivel === 'LEVE' ||
    (temConj && itemConf.restricaoConjugeNivel === 'LEVE') ||
    (temProc && itemConf.restricaoProcuradorNivel === 'LEVE')
  ) {
    alertasZero.push('0. VERIFICAR RESTRIÇÃO COMERCIAL LEVE.txt');
  }

  const cc = (itemConf.contaCorrente || '').trim().toUpperCase();
  if (!cc || cc === 'NÃO' || cc === 'NAO' || cc === '-') {
    alertasZero.push('0. ABRIR CONTA CORRENTE DO CLIENTE.txt');
  }

  return alertasZero;
}

function classificarArquivoAutomaticamente(
  nomeArquivo: string,
  primeiroNomeTitular: string,
  primeiroNomeConjuge: string
): {
  categoria: CategoriaDocPasta;
  isViti: boolean;
  subtipoAmbientalExtra?: string;
} {
  const semExt = nomeArquivo.replace(/\.[^/.]+$/, '');
  const ext = (nomeArquivo.split('.').pop() || '').toUpperCase();
  const norm = removerAcentos(semExt)
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (ext === 'TXT') {
    if (norm.includes('PARECER GERENCIAL') && !norm.includes('FALTA')) {
      return { categoria: 'ITEM_20_PARECER_GERENCIAL', isViti: false };
    }
    return { categoria: 'IGNORAR', isViti: false };
  }

  if (
    ext.includes('PRONAF') ||
    ext === 'INV' ||
    ext === 'CUST' ||
    nomeArquivo.toUpperCase().includes('.PRONAF')
  ) {
    return { categoria: 'ITEM_1_PROJETO_ARQ', isViti: false };
  }

  const pareceVitiPeloNome =
    /^(RELATORIO|VITI)\b/.test(norm) ||
    /^\d+(\.\d+)?\.?\s*VITI\b/.test(norm) ||
    norm.includes('VALIDACAO ITI');

  const miolo = norm
    .replace(/^RELATORIO\s*[-–]?\s*/, '')
    .replace(/^\d+(\.\d+)?\.?\s*VITI\s*[-–]?\s*/, '')
    .replace(/^VITI\s*[-–]?\s*/, '')
    .trim();

  const mencionaConjuge = Boolean(
    primeiroNomeConjuge &&
      primeiroNomeConjuge.length > 2 &&
      new RegExp(
        `\\b${removerAcentos(primeiroNomeConjuge).toUpperCase()}\\b`
      ).test(miolo)
  );

  const finalizar = (
    categoria: CategoriaDocPasta,
    subtipoAmbientalExtra?: string
  ) => ({
    categoria,
    isViti: pareceVitiPeloNome && CATEGORIAS_QUE_ACEITAM_VITI.has(categoria),
    subtipoAmbientalExtra,
  });

  if (miolo.includes('PROPOSTA DE CADASTRO') || miolo.includes('FICHA CADASTRAL')) {
    return finalizar('CAD_5_PROPOSTA_CADASTRO');
  }

  if (/\bSELOS?\b/.test(miolo)) {
    return finalizar('CAD_8_SELO_CARTORIO');
  }

  if (
    miolo.includes('CONTRATO PARTICULAR') ||
    miolo.includes('CONTRATO DE ASSESSORIA') ||
    miolo.includes('ASSESSORIA')
  ) {
    return finalizar('ITEM_8_CONTRATO_ASSESSORIA');
  }

  if (miolo.includes('AUTORIZACAO') && miolo.includes('ALTERACAO')) {
    return finalizar('ITEM_2_AUT_ALTERACAO');
  }

  if (miolo.includes('EMBARGO') || miolo.includes('IBAMA')) {
    return finalizar(
      mencionaConjuge ? 'ITEM_3_EMBARGOS_CONJUGE' : 'ITEM_3_EMBARGOS_TITULAR'
    );
  }
  if (miolo.includes('IMPROBIDADE') || miolo.includes('CNJ')) {
    return finalizar(
      mencionaConjuge
        ? 'ITEM_4_IMPROBIDADE_CONJUGE'
        : 'ITEM_4_IMPROBIDADE_TITULAR'
    );
  }

  if (miolo.includes('SOCIOAMBIENTAL') || miolo.includes('SOCIO AMBIENTAL')) {
    return finalizar('ITEM_5_CERT_SOCIOAMBIENTAL');
  }

  if (/\b(CREA|CFTA)\b/.test(miolo)) {
    return finalizar('ITEM_6_CREA');
  }

  if (/\bSICOR\b/.test(miolo)) {
    return finalizar('ITEM_7_EXTRATO_SICOR');
  }

  if (miolo.includes('CONSOLIDADA')) {
    return finalizar('ITEM_9_CONSOLIDADAS');
  }

  if (miolo.includes('REGULARIDADE AMBIENTAL')) {
    return finalizar('ITEM_10_1_REG_AMBIENTAL');
  }
  if (miolo.includes('NAO DESMATAMENTO') || miolo.includes('DESMATAMENTO')) {
    return finalizar('ITEM_10_2_NAO_DESMATAMENTO');
  }
  if (miolo.includes('RECOMPOSICAO') || miolo.includes('RESERVA LEGAL')) {
    return finalizar('ITEM_10_3_RECOMPOSICAO');
  }
  if (
    miolo.includes('DECLARACAO AMBIENTAL') ||
    miolo.includes('DEC. AMBIENTAIS') ||
    miolo.includes('DEC AMBIENTAIS')
  ) {
    return finalizar('ITEM_10_DEC_AMBIENTAIS');
  }
  if (
    miolo.includes('BIOMA AMAZONIA') ||
    miolo.includes('SOBREPOSICAO') ||
    miolo.includes('RETIFICACAO DO CAR') ||
    miolo.includes('NAO EXPLORACAO')
  ) {
    let sub = 'DEC. AMBIENTAL COMPLEMENTAR';
    if (miolo.includes('BIOMA')) sub = 'DEC. DE BIOMA AMAZÔNIA';
    else if (miolo.includes('SOBREPOSICAO')) sub = 'DEC. DE SOBREPOSIÇÃO DO CAR';
    else if (miolo.includes('RETIFICACAO')) sub = 'DEC. DE RETIFICAÇÃO DO CAR';
    else if (miolo.includes('NAO EXPLORACAO')) sub = 'DEC. DE NÃO EXPLORAÇÃO';
    return finalizar('ITEM_10_4_OUTRA_DEC_AMBIENTAL', sub);
  }

  if (miolo.includes('ESPELHO') || miolo.includes('RELATORIO DA UND')) {
    return finalizar('ITEM_11_ESPELHO_UND');
  }

  if (miolo.includes('PARECER TECNICO')) {
    return finalizar('ITEM_16_PARECER_TECNICO');
  }

  if (miolo.includes('ORCAMENTO')) {
    return finalizar('ITEM_18_ORCAMENTO');
  }

  if (/\bPROJETO\b/.test(miolo)) {
    return finalizar('ITEM_12_PROJETO_PDF');
  }

  if (
    miolo.includes('CONSULTA DO CAR') ||
    miolo.includes('CONSULTA AO CAR') ||
    miolo.includes('DEMONSTRATIVO CAR') ||
    miolo.includes('CONSULTA CAR')
  ) {
    return finalizar('ITEM_13_CONSULTA_CAR');
  }
  if (/\bCAR\b/.test(miolo)) {
    return finalizar('ITEM_13_CAR');
  }

  if (/\bCAF\b/.test(miolo)) {
    return finalizar('ITEM_14_CAF');
  }

  if (/\bDCAA\b/.test(miolo)) {
    return finalizar('ITEM_15_DCAA');
  }

  if (/\bRB\b/.test(miolo) || miolo.includes('RELACAO DE BENEFICIARIOS')) {
    return finalizar('ITEM_17_RB_PA');
  }

  if (miolo.includes('CAPA DO ANALISADOR') || miolo.includes('ANALISADOR')) {
    return finalizar('ITEM_19_CAPA_ANALISADOR');
  }
  if (miolo.includes('PARECER GERENCIAL') && !miolo.includes('FALTA')) {
    return finalizar('ITEM_20_PARECER_GERENCIAL');
  }
  if (/\bSEMA\b/.test(miolo) || miolo.includes('DISPENSA AMBIENTAL')) {
    return finalizar('ITEM_21_PARECER_SEMA');
  }

  if (
    miolo.includes('IDENTIDADE') ||
    miolo.includes('CNH') ||
    /\b(RG|CPF)\b/.test(miolo)
  ) {
    if (mencionaConjuge) {
      return finalizar('CAD_1_IDENTIDADE_CONJUGE');
    }
    const titNorm = removerAcentos(primeiroNomeTitular).toUpperCase();
    if (titNorm && miolo.includes(titNorm)) {
      return finalizar('CAD_1_IDENTIDADE_TITULAR');
    }
    return finalizar('CAD_1_IDENTIDADE_OUTRO');
  }
  if (
    miolo.includes('CASAMENTO') ||
    miolo.includes('NASCIMENTO') ||
    miolo.includes('UNIAO ESTAVEL')
  ) {
    return finalizar('CAD_2_CERTIDAO_CASAMENTO');
  }
  if (
    miolo.includes('ENDERECO') ||
    miolo.includes('RESIDENCIA') ||
    miolo.includes('EQUATORIAL') ||
    miolo.includes('CAEMA')
  ) {
    return finalizar('CAD_3_COMP_ENDERECO');
  }
  if (
    miolo.includes('RENDA') ||
    miolo.includes('IRPF') ||
    miolo.includes('CONTRACHEQUE')
  ) {
    return finalizar('CAD_4_COMP_RENDA');
  }
  if (miolo.includes('PROCURACAO')) {
    return finalizar('CAD_6_PROCURACAO');
  }

  return finalizar('CAD_9_OUTROS_CADASTRO');
}

function calcularDestinosDoArquivo(
  item: ArquivoMapeadoItem,
  nomes: {
    titular: string;
    conjuge: string;
    procurador: string;
    avalista: string;
  },
  projetista: string,
  nomePa: string
): {
  nomeNaRaiz: string | null;
  nomeNoCadastro: string | null;
  nomeNaSocioambiental: string | null;
} {
  const ext = item.extensao ? `.${item.extensao}` : '.pdf';
  const aceitaViti = CATEGORIAS_QUE_ACEITAM_VITI.has(item.categoria);
  const prefViti = item.isViti && aceitaViti ? 'VITI - ' : '';
  const tit = nomes.titular || 'CLIENTE';
  const conj = nomes.conjuge || 'CÔNJUGE';
  const proj = (projetista || 'PROJETISTA').toUpperCase().trim();
  const pa = (nomePa || 'P.A LAGO DA CARNAÚBA').toUpperCase().trim();

  switch (item.categoria) {
    case 'IGNORAR':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };

    case 'ITEM_1_PROJETO_ARQ': {
      const mExt = item.nomeOriginal.match(
        /(\.PRONAF[A-Za-z0-9_]*|\.[A-Za-z0-9_]+)$/i
      );
      const sufixoArq = mExt ? mExt[1].toUpperCase() : '.PRONAF_A2';
      return {
        nomeNaRaiz: `1. PROJETO - ${tit}${sufixoArq}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    }
    case 'ITEM_2_AUT_ALTERACAO':
      return {
        nomeNaRaiz: `2. ${prefViti}AUTORIZAÇÃO DE ALTERAÇÃO - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_3_EMBARGOS_TITULAR':
      return {
        nomeNaRaiz: `3. EMBARGOS - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `3. EMBARGOS - ${tit}${ext}`,
      };
    case 'ITEM_3_EMBARGOS_CONJUGE':
      return {
        nomeNaRaiz: `3. EMBARGOS - ${conj}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `3. EMBARGOS - ${conj}${ext}`,
      };
    case 'ITEM_4_IMPROBIDADE_TITULAR':
      return {
        nomeNaRaiz: `4. IMPROBIDADE - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_4_IMPROBIDADE_CONJUGE':
      return {
        nomeNaRaiz: `4. IMPROBIDADE - ${conj}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_5_CERT_SOCIOAMBIENTAL':
      return {
        nomeNaRaiz: `5. CERT. SOCIOAMBIENTAL - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `1. CERTIFICAÇÃO SOCIOAMBIENTAL - ${tit}${ext}`,
      };
    case 'ITEM_6_CREA':
      return {
        nomeNaRaiz: `6. CREA - ${proj}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_7_EXTRATO_SICOR':
      return {
        nomeNaRaiz: `7. EXTRATO SICOR - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_8_CONTRATO_ASSESSORIA':
      return {
        nomeNaRaiz: `8. ${prefViti}CONTRATO DE ASSESSORIA - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_9_CONSOLIDADAS':
      return {
        nomeNaRaiz: `9. ${prefViti}DECLARAÇÕES CONSOLIDADAS - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_10_DEC_AMBIENTAIS':
      return {
        nomeNaRaiz: `10. ${prefViti}DEC. AMBIENTAIS - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `6. ${prefViti}DEC. AMBIENTAIS - ${tit}${ext}`,
      };
    case 'ITEM_10_1_REG_AMBIENTAL':
      return {
        nomeNaRaiz: `10.1. ${prefViti}DEC. DE REGULARIDADE AMBIENTAL - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `6.1. ${prefViti}DEC. DE REGULARIDADE AMBIENTAL - ${tit}${ext}`,
      };
    case 'ITEM_10_2_NAO_DESMATAMENTO':
      return {
        nomeNaRaiz: `10.2. ${prefViti}DEC. DE NÃO DESMATAMENTO - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `6.2. ${prefViti}DEC. DE NÃO DESMATAMENTO - ${tit}${ext}`,
      };
    case 'ITEM_10_3_RECOMPOSICAO':
      return {
        nomeNaRaiz: `10.3. ${prefViti}DEC. DE RECOMPOSIÇÃO - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `6.3. ${prefViti}DEC. DE RECOMPOSIÇÃO - ${tit}${ext}`,
      };
    case 'ITEM_10_4_OUTRA_DEC_AMBIENTAL': {
      const rotulo = item.subtipoAmbientalExtra || 'DEC. AMBIENTAL COMPLEMENTAR';
      return {
        nomeNaRaiz: `10.4. ${prefViti}${rotulo} - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `6.4. ${prefViti}${rotulo} - ${tit}${ext}`,
      };
    }
    case 'ITEM_11_ESPELHO_UND':
      return {
        nomeNaRaiz: `11. ESPELHO - RELATÓRIO DA UND - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_12_PROJETO_PDF':
      return {
        nomeNaRaiz: `12. ${prefViti}PROJETO - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_13_CAR':
      return {
        nomeNaRaiz: `13. CAR${pa ? ` - ${pa}` : ` - ${tit}`}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `2. CAR${pa ? ` - ${pa}` : ` - ${tit}`}${ext}`,
      };
    case 'ITEM_13_CONSULTA_CAR':
      return {
        nomeNaRaiz: `13. CONSULTA DO CAR${pa ? ` - ${pa}` : ` - ${tit}`}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `2. CONSULTA AO CAR${pa ? ` - ${pa}` : ` - ${tit}`}${ext}`,
      };
    case 'ITEM_14_CAF':
      return {
        nomeNaRaiz: `14. CAF - ${tit}${ext}`,
        nomeNoCadastro: `5. CAF - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_15_DCAA':
      return {
        nomeNaRaiz: `15. DCAA - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `4. DCAA - ${tit}${ext}`,
      };
    case 'ITEM_16_PARECER_TECNICO':
      return {
        nomeNaRaiz: `16. ${prefViti}PARECER TÉCNICO - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_17_RB_PA':
      return {
        nomeNaRaiz: `17 - RB ${pa}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_18_ORCAMENTO':
      return {
        nomeNaRaiz: `18. ${prefViti}ORÇAMENTO - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_19_CAPA_ANALISADOR':
      return {
        nomeNaRaiz: `19. CAPA DO ANALISADOR - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_20_PARECER_GERENCIAL':
      return {
        nomeNaRaiz: `20. PARECER GERENCIAL - ${tit}${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: null,
      };
    case 'ITEM_21_PARECER_SEMA':
      return {
        nomeNaRaiz: `21. PARECER DA SEMA${ext}`,
        nomeNoCadastro: null,
        nomeNaSocioambiental: `5. PARECER DA SEMA${ext}`,
      };

    case 'CAD_1_IDENTIDADE_TITULAR':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `1. IDENTIDADE - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_1_IDENTIDADE_CONJUGE':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `1. IDENTIDADE - ${conj}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_1_IDENTIDADE_OUTRO': {
      const outNome = nomes.procurador || nomes.avalista || 'ENVOLVIDO';
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `1. IDENTIDADE - ${outNome}${ext}`,
        nomeNaSocioambiental: null,
      };
    }
    case 'CAD_2_CERTIDAO_CASAMENTO':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `2. CERTIDÃO DE CASAMENTO - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_3_COMP_ENDERECO':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `3. COMPROVANTE DE ENDEREÇO - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_4_COMP_RENDA':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `4. COMPROVANTE DE RENDA - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_5_PROPOSTA_CADASTRO':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `6. ${prefViti}PROPOSTA DE CADASTRO - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_6_PROCURACAO':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `7. PROCURAÇÃO - ${nomes.procurador || tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_8_SELO_CARTORIO':
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `8. SELO DE FISCALIZAÇÃO - ${tit}${ext}`,
        nomeNaSocioambiental: null,
      };
    case 'CAD_9_OUTROS_CADASTRO':
    default:
      return {
        nomeNaRaiz: null,
        nomeNoCadastro: `9. DOC. CADASTRAL - ${item.nomeOriginal}`,
        nomeNaSocioambiental: null,
      };
  }
}

export default function ModalOrganizadorPastasCliente({
  aberto,
  onFechar,
  contratacoes,
  cardsKanban,
  onCadastrarPropostaNoPainel,
}: ModalOrganizadorPastasClienteProps) {
  const [abaAtiva, setAbaAtiva] = useState<'ORGANIZADOR' | 'COFRE'>('ORGANIZADOR');

  const [buscaClienteRapida, setBuscaClienteRapida] = useState('');
  const [titularNome, setTitularNome] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [procuradorNome, setProcuradorNome] = useState('');
  const [avalistaNome, setAvalistaNome] = useState('');
  const [projetistaNome, setProjetistaNome] = useState('ZEZÃO');
  const [paNome, setPaNome] = useState('P.A LAGO DA CARNAÚBA');
  const [isPronafA, setIsPronafA] = useState(true);
  const [gerarDuplicataCertSocioSemNumero] = useState(true);
  const [gerarTxtsLembretesFaltantes, setGerarTxtsLembretesFaltantes] =
    useState(true);

  const [dirHandleRoot, setDirHandleRoot] = useState<any>(null);
  const [nomePastaSelecionada, setNomePastaSelecionada] = useState('');
  const [arquivosMapeados, setArquivosMapeados] = useState<ArquivoMapeadoItem[]>(
    []
  );
  const [jaTemSeloNaSubpastaCadastro, setJaTemSeloNaSubpastaCadastro] =
    useState(false);
  const [
    jaTemProcuracaoOuCasamentoNoCadastro,
    setJaTemProcuracaoOuCasamentoNoCadastro,
  ] = useState(false);
  const [processando, setProcessando] = useState(false);

  const [auditoriaPdf, setAuditoriaPdf] =
    useState<ResultadoAuditoriaPastaPdf | null>(null);
  const [auditandoPdfs, setAuditandoPdfs] = useState(false);

  const [coringasSalvos, setCoringasSalvos] = useState<CoringaGavetaNuvemItem[]>(
    []
  );
  const [statusSyncCofre, setStatusSyncCofre] = useState<
    'SINCRONIZADO' | 'SINCRONIZANDO'
  >('SINCRONIZADO');
  const [novoCoringaTipo, setNovoCoringaTipo] =
    useState<CoringaGavetaNuvemItem['tipo']>('PARECER_SEMA');
  const [novoCoringaChave, setNovoCoringaChave] = useState(
    'P.A LAGO DA CARNAÚBA'
  );

  // CORRIGIDO: Inicializa de forma segura sem "= []" no cabeçalho para jamais causar loop infinito!
  const [listaContratacoes, setListaContratacoes] = useState<
    RegistroContratacao[]
  >(() => contratacoes || []);
  const [listaCards, setListaCards] = useState<CardKanban[]>(
    () => cardsKanban || []
  );
  const [listaOpBase, setListaOpBase] = useState<OperacaoBaseDesembolso[]>([]);
  const [listaEventos, setListaEventos] = useState<EventoDesembolso[]>([]);

  const [modalIniciarPronafA, setModalIniciarPronafA] =
    useState<ResultadoClassificacaoPronafA | null>(null);
  const [cadCpf, setCadCpf] = useState('');
  const [cadValor, setCadValor] = useState('');
  const [cadTipo, setCadTipo] = useState('Investimento');
  const [cadProjetista, setCadProjetista] = useState('');
  const [cadPrograma, setCadPrograma] = useState(
    'FNE/PRONAF A - RES.5.183/24 (699)'
  );
  const [cadSituacao, setCadSituacao] = useState('Na Agência');
  const [cadResponsavel, setCadResponsavel] = useState('');
  const [cadTelefone, setCadTelefone] = useState('');
  const [cadData, setCadData] = useState(() => getHojeBR());
  const [cadSitDetalhada, setCadSitDetalhada] = useState('');
  const [cadObsPendencias, setCadObsPendencias] = useState('');

  const [cardOverlayParecerId, setCardOverlayParecerId] = useState<
    string | null
  >(null);
  const [parecerGerencialExtraidoNaPasta, setParecerGerencialExtraidoNaPasta] =
    useState(false);

  const listaProgramas = useMemo(() => obterListaProgramas(), []);

  // Sincroniza listas quando o modal é aberto, lendo do cache oficial se alguma prop não tiver vindo
  useEffect(() => {
    if (!aberto) return;
    const contrAtuais =
      Array.isArray(contratacoes) && contratacoes.length > 0
        ? contratacoes
        : lerCacheLocal<RegistroContratacao[]>(STORAGE_KEYS_V2.CONTRATACOES, []);
    const cardsAtuais =
      Array.isArray(cardsKanban) && cardsKanban.length > 0
        ? cardsKanban
        : lerCacheLocal<CardKanban[]>(STORAGE_KEYS_V2.KANBAN, []);

    setListaContratacoes(contrAtuais);
    setListaCards(cardsAtuais);
    setListaOpBase(
      lerCacheLocal<OperacaoBaseDesembolso[]>(STORAGE_KEYS_V2.DESEMB_OP, [])
    );
    setListaEventos(
      lerCacheLocal<EventoDesembolso[]>(STORAGE_KEYS_V2.DESEMB_EV, [])
    );

    const sincronizarCofre = async () => {
      setStatusSyncCofre('SINCRONIZANDO');
      const locais = await listarCoringasDoCofreLocal();
      setCoringasSalvos(locais);

      try {
        const nuvem = await carregarCoringasGavetaSync();
        const mapa = new Map<string, CoringaGavetaNuvemItem>();
        locais.forEach((item) => mapa.set(item.id, item));
        nuvem.forEach((item) => mapa.set(item.id, item));

        const unificados = Array.from(mapa.values());
        setCoringasSalvos(unificados);

        for (const it of unificados) {
          await salvarCoringaNoCofreLocal(it);
          if (!nuvem.some((n) => n.id === it.id)) {
            await salvarCoringaGavetaSync(it);
          }
        }
      } catch {
        // Fallback local
      } finally {
        setStatusSyncCofre('SINCRONIZADO');
      }
    };

    sincronizarCofre();
  }, [aberto]);

  const nomesCurtos = useMemo(
    () =>
      obterNomesCurtosDesambiguados({
        titularCompleto: titularNome,
        conjugeCompleto: conjugeNome,
        procuradorCompleto: procuradorNome,
        avalistaCompleto: avalistaNome,
      }),
    [titularNome, conjugeNome, procuradorNome, avalistaNome]
  );

  // ITEM 3: Salva o parecer extraído com o nome "20. PARECER GERENCIAL - FALTA AJUSTAR.txt"
  const gravarParecerGerencialRealNaPasta = async (conteudoTexto: string) => {
    if (!dirHandleRoot || !conteudoTexto.trim()) return;
    try {
      const nomeArqFaltaAjustar = '20. PARECER GERENCIAL - FALTA AJUSTAR.txt';

      const fileHandle = await dirHandleRoot.getFileHandle(
        nomeArqFaltaAjustar,
        { create: true }
      );
      const writable = await fileHandle.createWritable();
      await writable.write(conteudoTexto);
      await writable.close();

      // Remove eventual "20. FALTA PARECER GERENCIAL.txt" se existir
      try {
        await dirHandleRoot.removeEntry('20. FALTA PARECER GERENCIAL.txt');
      } catch {
        // Ignora
      }

      setParecerGerencialExtraidoNaPasta(true);
      alert(
        `✅ Parecer completo salvo diretamente na pasta do cliente como:\n"${nomeArqFaltaAjustar}"\n\nQuando inserir os 2 IDs do banco posteriormente, basta renomeá-lo para "20. PARECER GERENCIAL".`
      );
    } catch (e) {
      console.error('Erro ao gravar parecer na pasta:', e);
    }
  };

  // ITEM 1: Se o usuário fechar o Card sem ter clicado em Extrair .TXT (pulou a etapa),
  // aí sim gera na pasta o arquivo vazio "20. FALTA PARECER GERENCIAL.txt"!
  const handleFecharOverlayParecer = async () => {
    const jaTinhaParecerNaPasta = arquivosMapeados.some(
      (a) => a.categoria === 'ITEM_20_PARECER_GERENCIAL'
    );

    if (
      !parecerGerencialExtraidoNaPasta &&
      !jaTinhaParecerNaPasta &&
      gerarTxtsLembretesFaltantes &&
      dirHandleRoot
    ) {
      try {
        const fh = await dirHandleRoot.getFileHandle(
          '20. FALTA PARECER GERENCIAL.txt',
          { create: true }
        );
        const wr = await fh.createWritable();
        await wr.write('');
        await wr.close();
      } catch {
        // Ignora
      }
    }

    setCardOverlayParecerId(null);
  };

  // Captura o texto do Parecer Gerencial diretamente da tela e salva na pasta com 1 clique
  const capturarESalvarParecerDaTelaNaPasta = async () => {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    const taParecer = textareas.find(
      (t) =>
        t.value.includes('PARECER') ||
        t.value.includes('PROPONENTE') ||
        t.value.includes('OPERACAO') ||
        t.value.includes('OPERAÇÃO') ||
        t.value.length > 100
    );

    if (taParecer && taParecer.value.trim()) {
      await gravarParecerGerencialRealNaPasta(taParecer.value);
      setCardOverlayParecerId(null);
      return;
    }

    const pres = Array.from(document.querySelectorAll('pre'));
    const preParecer = pres.find((p) => (p.innerText || '').length > 100);
    if (preParecer && preParecer.innerText.trim()) {
      await gravarParecerGerencialRealNaPasta(preParecer.innerText);
      setCardOverlayParecerId(null);
      return;
    }

    alert(
      '⚠️ Gere ou preencha o texto do Parecer Gerencial na tela antes de salvar na pasta!'
    );
  };

  // ITENS 1, 1.1 E 2: Intercepta o botão original de "Extrair .TXT" da aba Parecer Gerencial
  // SOMENTE quando aberto por dentro do Organizador de Pastas (captura 100% do texto completo + edições)!
  useEffect(() => {
    if (!cardOverlayParecerId || !dirHandleRoot) return;

    const win = window as any;
    const origShowSaveFilePicker = win.showSaveFilePicker;
    const origCreateObjectURL = URL.createObjectURL;

    // 1. Se o botão Extrair .TXT usar showSaveFilePicker, intercepta e grava direto na pasta do cliente!
    if (origShowSaveFilePicker) {
      win.showSaveFilePicker = async function (opts: any) {
        const sugName = String(opts?.suggestedName || '').toLowerCase();
        if (sugName.endsWith('.txt') || JSON.stringify(opts || {}).includes('.txt')) {
          let textoAcumulado = '';
          return {
            createWritable: async () => ({
              write: async (chunk: any) => {
                if (typeof chunk === 'string') {
                  textoAcumulado += chunk;
                } else if (chunk instanceof Blob) {
                  textoAcumulado += await chunk.text();
                } else if (chunk && typeof chunk === 'object') {
                  textoAcumulado += new TextDecoder().decode(chunk);
                }
              },
              close: async () => {
                if (textoAcumulado.trim()) {
                  await gravarParecerGerencialRealNaPasta(textoAcumulado);
                }
              },
            }),
          };
        }
        return origShowSaveFilePicker.call(win, opts);
      };
    }

    // 2. Se o botão Extrair .TXT usar Blob + URL.createObjectURL, captura o Blob inteiro e grava direto na pasta!
    URL.createObjectURL = function (obj: Blob | MediaSource) {
      if (
        obj instanceof Blob &&
        (obj.type.includes('text/plain') || obj.type === '') &&
        obj.size > 30 &&
        obj.size < 800000
      ) {
        obj
          .text()
          .then((textoCompleto) => {
            if (textoCompleto && textoCompleto.trim().length > 30) {
              gravarParecerGerencialRealNaPasta(textoCompleto);
            }
          })
          .catch(() => {});
      }
      return origCreateObjectURL.call(URL, obj);
    };

    return () => {
      if (origShowSaveFilePicker) {
        win.showSaveFilePicker = origShowSaveFilePicker;
      }
      URL.createObjectURL = origCreateObjectURL;
    };
  }, [cardOverlayParecerId, dirHandleRoot]);

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
          l.itens.forEach((it) => {
            if (it.nomeCliente.trim()) acumulados.push(it);
          });
        });
      }
    } catch {
      // Ignora erro
    }
    return acumulados;
  }, [aberto]);

  const registroConformidadeVinculado = useMemo(() => {
    const nomeLimpo = removerAcentos(titularNome).toUpperCase().trim();
    if (!nomeLimpo || nomeLimpo.length < 3) return null;
    return (
      todosItensConformidadePronafA.find((it) => {
        const nIt = removerAcentos(it.nomeCliente).toUpperCase().trim();
        return (
          nIt === nomeLimpo ||
          nIt.startsWith(nomeLimpo) ||
          nomeLimpo.startsWith(nIt)
        );
      }) || null
    );
  }, [titularNome, todosItensConformidadePronafA]);

  const opcoesClientesConhecidos = useMemo(() => {
    const lista: Array<{
      label: string;
      titular: string;
      conjuge: string;
      procurador: string;
      avalista: string;
      projetista: string;
      pronafA: boolean;
    }> = [];

    todosItensConformidadePronafA.forEach((it) => {
      lista.push({
        label: `${it.nomeCliente.toUpperCase()} (Conformidade PRONAF A)`,
        titular: it.nomeCliente.toUpperCase(),
        conjuge: it.conjugeNome.toUpperCase(),
        procurador: it.procuradorNome.toUpperCase(),
        avalista: '',
        projetista: '',
        pronafA: true,
      });
    });

    listaContratacoes.forEach((c) => {
      if (c.cliente.trim()) {
        lista.push({
          label: `${c.cliente.toUpperCase()} (${c.porte || 'Carteira'})`,
          titular: c.cliente.toUpperCase(),
          conjuge: '',
          procurador: '',
          avalista: c.avalistaNome || '',
          projetista: c.projetista || '',
          pronafA: (c.porte || '').toUpperCase().includes('PRONAF A'),
        });
      }
    });

    return lista;
  }, [todosItensConformidadePronafA, listaContratacoes]);

  const autodetectarDadosPelosArquivos = (files: File[]) => {
    let titDetectado = titularNome;
    let conjDetectado = conjugeNome;
    let procDetectado = procuradorNome;
    let paDetectado = paNome;
    let projDetectado = projetistaNome;

    files.forEach((f) => {
      const up = f.name.toUpperCase();
      if (up.includes('.PRONAF')) {
        const limpo = up
          .split('.PRONAF')[0]
          .replace(/^\d+\.\s*PROJETO\s*-\s*/, '')
          .trim();
        if (limpo && !titDetectado) titDetectado = limpo;
      }
      const matchTraco = up.match(
        /_-_\s*([A-ZÀ-Ú_ ]+?)(?:_ASSINADO|\.PDF|\s*\()/i
      );
      if (matchTraco && matchTraco[1] && !titDetectado) {
        titDetectado = matchTraco[1].replace(/_/g, ' ').trim();
      }
      const matchPa = up.match(
        /(P\.?A\.?\s+[A-ZÀ-Ú0-9 ]+?)(?:_COMPRESSED|_ASSINADO|\.PDF|$)/i
      );
      if (matchPa && matchPa[1]) {
        const pStr = matchPa[1].replace(/^PA\s+/i, 'P.A ').trim();
        paDetectado = pStr;
      }
      const matchCrea = up.match(/CREA\s*[-–]\s*([A-ZÀ-Ú0-9_ ]+?)(?:\.PDF|$)/i);
      if (matchCrea && matchCrea[1]) {
        projDetectado = matchCrea[1].trim();
      }
    });

    if (titDetectado) {
      const normTit = removerAcentos(titDetectado).toUpperCase().trim();
      const encConf = todosItensConformidadePronafA.find(
        (it) => removerAcentos(it.nomeCliente).toUpperCase().trim() === normTit
      );
      if (encConf) {
        if (encConf.conjugeNome && !conjDetectado) {
          conjDetectado = encConf.conjugeNome.toUpperCase().trim();
        }
        if (encConf.procuradorNome && !procDetectado) {
          procDetectado = encConf.procuradorNome.toUpperCase().trim();
        }
      }
    }

    const primTit = extrairPrimeiroNome(titDetectado);

    files.forEach((f) => {
      const up = removerAcentos(f.name).toUpperCase().replace(/_/g, ' ');
      if (up.startsWith('IDENTIDADE ') || up.startsWith('RG ')) {
        const resto = up
          .replace(/^(IDENTIDADE|RG)\s+/, '')
          .replace(/\.PDF$/i, '')
          .replace(/ASSINADO/g, '')
          .trim();
        const primResto = extrairPrimeiroNome(resto);
        if (primResto && primResto !== primTit && !conjDetectado) {
          conjDetectado = resto;
        }
      }
    });

    if (titDetectado && titDetectado !== titularNome) setTitularNome(titDetectado);
    if (conjDetectado && conjDetectado !== conjugeNome)
      setConjugeNome(conjDetectado);
    if (procDetectado && procDetectado !== procuradorNome)
      setProcuradorNome(procDetectado);
    if (paDetectado && paDetectado !== paNome) setPaNome(paDetectado);
    if (projDetectado && projDetectado !== projetistaNome)
      setProjetistaNome(projDetectado);

    return {
      primTit: primTit || extrairPrimeiroNome(titularNome),
      primConj: extrairPrimeiroNome(conjDetectado || conjugeNome),
      paDetectado,
      projDetectado,
    };
  };

  const processarArquivosLidos = (
    files: File[],
    primTit: string,
    primConj: string,
    projAtual: string,
    paAtual: string
  ) => {
    const arquivosReais = files.filter((f) => {
      const isTxt = f.name.toLowerCase().endsWith('.txt');
      if (!isTxt) return true;
      const up = f.name.toUpperCase();
      return up.includes('PARECER GERENCIAL') && !up.includes('FALTA');
    });

    const mapeados: ArquivoMapeadoItem[] = arquivosReais.map((file, idx) => {
      const partes = file.name.split('.');
      const ext = partes.length > 1 ? partes.pop() || 'pdf' : '';
      const classif = classificarArquivoAutomaticamente(
        file.name,
        primTit,
        primConj
      );
      return {
        id: `arq_${idx}_${Date.now()}`,
        nomeOriginal: file.name,
        extensao: ext,
        fileObj: file,
        categoria: classif.categoria,
        isViti: classif.isViti,
        subtipoAmbientalExtra: classif.subtipoAmbientalExtra,
      };
    });

    const jaTemCrea = mapeados.some((m) => m.categoria === 'ITEM_6_CREA');
    const jaTemRb = mapeados.some((m) => m.categoria === 'ITEM_17_RB_PA');
    const jaTemSema = mapeados.some((m) => m.categoria === 'ITEM_21_PARECER_SEMA');
    const jaTemCar = mapeados.some((m) => m.categoria === 'ITEM_13_CAR');

    // CORRIGIDO: Usa base64ParaArrayBuffer que retorna ArrayBuffer puro
    if (!jaTemCrea && projAtual) {
      const coringaCrea = coringasSalvos.find(
        (c) =>
          c.tipo === 'CREA_PROJETISTA' &&
          c.chaveReferencia.toUpperCase().trim() ===
            projAtual.toUpperCase().trim()
      );
      if (coringaCrea) {
        const bufferCoringa = base64ParaArrayBuffer(coringaCrea.base64Dados);
        const fileCoringa = new File(
          [bufferCoringa],
          coringaCrea.nomeArquivoOriginal,
          { type: 'application/pdf' }
        );
        mapeados.push({
          id: `coringa_crea_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaCrea.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: fileCoringa,
          categoria: 'ITEM_6_CREA',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    if (!jaTemRb && paAtual) {
      const coringaRb = coringasSalvos.find(
        (c) =>
          c.tipo === 'RB_PA' &&
          removerAcentos(c.chaveReferencia).toUpperCase().trim() ===
            removerAcentos(paAtual).toUpperCase().trim()
      );
      if (coringaRb) {
        const bufferCoringa = base64ParaArrayBuffer(coringaRb.base64Dados);
        const fileCoringa = new File(
          [bufferCoringa],
          coringaRb.nomeArquivoOriginal,
          { type: 'application/pdf' }
        );
        mapeados.push({
          id: `coringa_rb_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaRb.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: fileCoringa,
          categoria: 'ITEM_17_RB_PA',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    if (!jaTemCar && paAtual) {
      const coringaCar = coringasSalvos.find(
        (c) =>
          c.tipo === 'CAR_PA' &&
          removerAcentos(c.chaveReferencia).toUpperCase().trim() ===
            removerAcentos(paAtual).toUpperCase().trim()
      );
      if (coringaCar) {
        const bufferCoringa = base64ParaArrayBuffer(coringaCar.base64Dados);
        const fileCoringa = new File(
          [bufferCoringa],
          coringaCar.nomeArquivoOriginal,
          { type: 'application/pdf' }
        );
        mapeados.push({
          id: `coringa_car_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaCar.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: fileCoringa,
          categoria: 'ITEM_13_CAR',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    if (!jaTemSema && isPronafA) {
      const coringaSema = coringasSalvos.find((c) => c.tipo === 'PARECER_SEMA');
      if (coringaSema) {
        const bufferCoringa = base64ParaArrayBuffer(coringaSema.base64Dados);
        const fileCoringa = new File(
          [bufferCoringa],
          coringaSema.nomeArquivoOriginal,
          { type: 'application/pdf' }
        );
        mapeados.push({
          id: `coringa_sema_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaSema.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: fileCoringa,
          categoria: 'ITEM_21_PARECER_SEMA',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    setArquivosMapeados(mapeados);

    // ITEM 4: Dispara a leitura e auditoria inteligente dos 12 pontos nos PDFs da pasta!
    setAuditandoPdfs(true);
    executarAuditoriaCompletaDosPdfsDaPasta({
      arquivos: mapeados,
      titularNome: primTit,
      conjugeNome: primConj,
      paEsperado: paAtual,
      contaConformidade: registroConformidadeVinculado?.contaCorrente,
    })
      .then((resAuditoria) => {
        setAuditoriaPdf(resAuditoria);
        if (resAuditoria.valorPropostaDetectado && !cadValor) {
          setCadValor(resAuditoria.valorPropostaDetectado);
        }
      })
      .catch(() => {})
      .finally(() => setAuditandoPdfs(false));
  };

  const selecionarPastaNoComputador = async () => {
    const win = window as unknown as {
      showDirectoryPicker?: (opts: { mode: string }) => Promise<any>;
    };

    if (!win.showDirectoryPicker) {
      alert(
        '⚠️ Seu navegador atual não suporta acesso direto a pastas locais. Use o Google Chrome ou Microsoft Edge no computador!'
      );
      return;
    }

    try {
      const handle = await win.showDirectoryPicker({ mode: 'readwrite' });
      setDirHandleRoot(handle);
      setNomePastaSelecionada(handle.name);
      setParecerGerencialExtraidoNaPasta(false);

      const listaFiles: File[] = [];
      let achouSeloNoSubCadastro = false;
      let achouProcOuCasamentoNoSubCadastro = false;

      for await (const [entryName, entryHandle] of handle.entries()) {
        if (entryHandle.kind === 'file') {
          if (
            entryName.startsWith('.') ||
            entryName.toLowerCase() === 'thumbs.db'
          ) {
            continue;
          }
          const file: File = await entryHandle.getFile();
          listaFiles.push(file);
        } else if (
          entryHandle.kind === 'directory' &&
          entryName.toUpperCase() === 'CADASTRO'
        ) {
          for await (const [subName, subHandle] of entryHandle.entries()) {
            if (
              subHandle.kind === 'file' &&
              !subName.toLowerCase().endsWith('.txt')
            ) {
              const upSub = removerAcentos(subName).toUpperCase();
              if (/\bSELOS?\b/.test(upSub)) achouSeloNoSubCadastro = true;
              if (
                upSub.includes('PROCURACAO') ||
                upSub.includes('CASAMENTO')
              ) {
                achouProcOuCasamentoNoSubCadastro = true;
              }
            }
          }
        }
      }

      setJaTemSeloNaSubpastaCadastro(achouSeloNoSubCadastro);
      setJaTemProcuracaoOuCasamentoNoCadastro(achouProcOuCasamentoNoSubCadastro);

      const detectados = autodetectarDadosPelosArquivos(listaFiles);
      processarArquivosLidos(
        listaFiles,
        detectados.primTit,
        detectados.primConj,
        detectados.projDetectado || projetistaNome,
        detectados.paDetectado
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      alert('❌ Erro ao acessar a pasta selecionada.');
    }
  };

  const planoArquivosTxtLembretes = useMemo(() => {
    const txtsRaiz: string[] = [];
    const txtsSubpastaCadastro: string[] = [];

    const catsPresentes = new Set(arquivosMapeados.map((a) => a.categoria));
    const tit = nomesCurtos.titular || 'CLIENTE';
    const conj = nomesCurtos.conjuge;
    const proj = (projetistaNome || 'PROJETISTA').toUpperCase().trim();
    const pa = (paNome || 'P.A LAGO DA CARNAÚBA').toUpperCase().trim();

    const txtsZeroConformidade = gerarTxtsZeroDaConformidadePronafA(
      registroConformidadeVinculado
    );
    txtsZeroConformidade.forEach((t) => txtsRaiz.push(t));

    if (!catsPresentes.has('ITEM_1_PROJETO_ARQ')) {
      txtsRaiz.push(`1. PROJETO - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_2_AUT_ALTERACAO')) {
      txtsRaiz.push(`2. AUTORIZAÇÃO DE ALTERAÇÃO - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_3_EMBARGOS_TITULAR')) {
      txtsRaiz.push(`3. EMBARGOS - ${tit}.txt`);
    }
    if (conj && !catsPresentes.has('ITEM_3_EMBARGOS_CONJUGE')) {
      txtsRaiz.push(`3. EMBARGOS - ${conj}.txt`);
    }
    if (!catsPresentes.has('ITEM_4_IMPROBIDADE_TITULAR')) {
      txtsRaiz.push(`4. IMPROBIDADE - ${tit}.txt`);
    }
    if (conj && !catsPresentes.has('ITEM_4_IMPROBIDADE_CONJUGE')) {
      txtsRaiz.push(`4. IMPROBIDADE - ${conj}.txt`);
    }
    if (!catsPresentes.has('ITEM_5_CERT_SOCIOAMBIENTAL')) {
      txtsRaiz.push(`5. CERT. SOCIOAMBIENTAL - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_6_CREA')) {
      txtsRaiz.push(`6. CREA - ${proj}.txt`);
    }
    if (!catsPresentes.has('ITEM_7_EXTRATO_SICOR')) {
      txtsRaiz.push(`7. EXTRATO SICOR - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_8_CONTRATO_ASSESSORIA')) {
      txtsRaiz.push(`8. CONTRATO DE ASSESSORIA - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_9_CONSOLIDADAS')) {
      txtsRaiz.push(`9. DECLARAÇÕES CONSOLIDADAS - ${tit}.txt`);
    }

    txtsRaiz.push('9. VERIFICAR C-C NA CONSOLIDADA.txt');

    if (!catsPresentes.has('ITEM_10_DEC_AMBIENTAIS')) {
      txtsRaiz.push(`10. DEC. AMBIENTAIS - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_10_1_REG_AMBIENTAL')) {
      txtsRaiz.push(`10.1. DEC. DE REGULARIDADE AMBIENTAL - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_10_2_NAO_DESMATAMENTO')) {
      txtsRaiz.push(`10.2. DEC. DE NÃO DESMATAMENTO - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_10_3_RECOMPOSICAO')) {
      txtsRaiz.push(`10.3. DEC. DE RECOMPOSIÇÃO - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_11_ESPELHO_UND')) {
      txtsRaiz.push(`11. ESPELHO - RELATÓRIO DA UND - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_12_PROJETO_PDF')) {
      txtsRaiz.push(`12. PROJETO - ${tit}.txt`);
    }
    if (
      !catsPresentes.has('ITEM_13_CAR') &&
      !catsPresentes.has('ITEM_13_CONSULTA_CAR')
    ) {
      txtsRaiz.push(`13. CAR - ${pa}.txt`);
    }
    if (!catsPresentes.has('ITEM_14_CAF')) {
      txtsRaiz.push(`14. CAF - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_15_DCAA')) {
      txtsRaiz.push(`15. DCAA - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_16_PARECER_TECNICO')) {
      txtsRaiz.push(`16. PARECER TÉCNICO - ${tit}.txt`);
    }
    if (isPronafA && !catsPresentes.has('ITEM_17_RB_PA')) {
      txtsRaiz.push(`17 - RB ${pa}.txt`);
    }
    if (!catsPresentes.has('ITEM_18_ORCAMENTO')) {
      txtsRaiz.push(`18. ORÇAMENTO - ${tit}.txt`);
    }
    if (!catsPresentes.has('ITEM_19_CAPA_ANALISADOR')) {
      txtsRaiz.push(`19. CAPA DO ANALISADOR - ${tit}.txt`);
    }

    if (
      !catsPresentes.has('ITEM_20_PARECER_GERENCIAL') &&
      !parecerGerencialExtraidoNaPasta
    ) {
      txtsRaiz.push('20. FALTA PARECER GERENCIAL.txt');
    }

    if (isPronafA && !catsPresentes.has('ITEM_21_PARECER_SEMA')) {
      txtsRaiz.push('21. PARECER DA SEMA.txt');
    }

    const temProcuracaoOuCasamento =
      catsPresentes.has('CAD_6_PROCURACAO') ||
      catsPresentes.has('CAD_2_CERTIDAO_CASAMENTO') ||
      jaTemProcuracaoOuCasamentoNoCadastro;

    const temSeloPresente =
      catsPresentes.has('CAD_8_SELO_CARTORIO') || jaTemSeloNaSubpastaCadastro;

    if (temProcuracaoOuCasamento && !temSeloPresente) {
      txtsSubpastaCadastro.push('FALTA CONSULTAR SELOS.txt');
      txtsRaiz.push('0. FALTA CONSULTAR SELOS (VER PASTA CADASTRO).txt');
    }

    return { txtsRaiz, txtsSubpastaCadastro };
  }, [
    arquivosMapeados,
    nomesCurtos,
    projetistaNome,
    paNome,
    isPronafA,
    registroConformidadeVinculado,
    jaTemSeloNaSubpastaCadastro,
    jaTemProcuracaoOuCasamentoNoCadastro,
    parecerGerencialExtraidoNaPasta,
  ]);

  const avisosVitisParaConferenciaManual = useMemo(() => {
    const vitisPresentes = new Set(
      arquivosMapeados.filter((a) => a.isViti).map((a) => a.categoria)
    );
    const docsPrincipaisPresentes = new Set(
      arquivosMapeados.filter((a) => !a.isViti).map((a) => a.categoria)
    );

    const tit = nomesCurtos.titular || 'CLIENTE';
    const paresAssinaveis: Array<{ cat: CategoriaDocPasta; label: string }> = [
      { cat: 'ITEM_2_AUT_ALTERACAO', label: `2. AUTORIZAÇÃO DE ALTERAÇÃO - ${tit}` },
      { cat: 'ITEM_8_CONTRATO_ASSESSORIA', label: `8. CONTRATO DE ASSESSORIA - ${tit}` },
      { cat: 'ITEM_9_CONSOLIDADAS', label: `9. DECLARAÇÕES CONSOLIDADAS - ${tit}` },
      { cat: 'ITEM_10_DEC_AMBIENTAIS', label: `10. DEC. AMBIENTAIS - ${tit}` },
      {
        cat: 'ITEM_10_1_REG_AMBIENTAL',
        label: `10.1. DEC. DE REGULARIDADE AMBIENTAL - ${tit}`,
      },
      {
        cat: 'ITEM_10_2_NAO_DESMATAMENTO',
        label: `10.2. DEC. DE NÃO DESMATAMENTO - ${tit}`,
      },
      { cat: 'ITEM_10_3_RECOMPOSICAO', label: `10.3. DEC. DE RECOMPOSIÇÃO - ${tit}` },
      { cat: 'ITEM_12_PROJETO_PDF', label: `12. PROJETO (PDF) - ${tit}` },
      { cat: 'ITEM_16_PARECER_TECNICO', label: `16. PARECER TÉCNICO - ${tit}` },
      { cat: 'ITEM_18_ORCAMENTO', label: `18. ORÇAMENTO - ${tit}` },
      {
        cat: 'CAD_5_PROPOSTA_CADASTRO',
        label: `CAD 6. PROPOSTA DE CADASTRO - ${tit}`,
      },
    ];

    return paresAssinaveis
      .filter(
        (par) =>
          docsPrincipaisPresentes.has(par.cat) && !vitisPresentes.has(par.cat)
      )
      .map((par) => par.label);
  }, [arquivosMapeados, nomesCurtos]);

  const resumoContadores = useMemo(() => {
    let qtdRaiz = 0;
    let qtdCadastro = 0;
    let qtdSocio = 0;

    arquivosMapeados.forEach((arq) => {
      if (arq.categoria === 'IGNORAR') return;
      const d = calcularDestinosDoArquivo(
        arq,
        nomesCurtos,
        projetistaNome,
        paNome
      );
      if (d.nomeNaRaiz) qtdRaiz++;
      if (d.nomeNoCadastro) qtdCadastro++;
      if (d.nomeNaSocioambiental) qtdSocio++;
    });

    const totalTxts =
      planoArquivosTxtLembretes.txtsRaiz.length +
      planoArquivosTxtLembretes.txtsSubpastaCadastro.length;

    return { qtdRaiz, qtdCadastro, qtdSocio, totalTxts };
  }, [
    arquivosMapeados,
    nomesCurtos,
    projetistaNome,
    paNome,
    planoArquivosTxtLembretes,
  ]);

  const executarOrganizacaoDiretoNaPasta = async () => {
    if (!dirHandleRoot) {
      alert('Selecione primeiro a pasta raiz do cliente no computador!');
      return;
    }
    if (!titularNome.trim()) {
      alert('Informe o Nome do Cliente (Titular) antes de organizar a pasta!');
      return;
    }

    setProcessando(true);
    try {
      const dirCadastro = await dirHandleRoot.getDirectoryHandle('CADASTRO', {
        create: true,
      });
      const dirSocioambiental = await dirHandleRoot.getDirectoryHandle(
        'CERTIFICAÇÃO SOCIOAMBIENTAL',
        { create: true }
      );

      const nomesSalvosNaRaiz = new Set<string>();

      const gravarBufferEmPasta = async (
        pastaHandle: any,
        nomeArq: string,
        conteudo: ArrayBuffer | string
      ) => {
        const nomeSeguro = nomeArq.replace(/[/:*?"<>|]/g, '-');
        const fileHandle = await pastaHandle.getFileHandle(nomeSeguro, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(conteudo);
        await writable.close();
        return nomeSeguro;
      };

      // 1. Limpa antigos arquivos .txt vazios de lembretes na raiz
      for await (const [entryName, entryHandle] of dirHandleRoot.entries()) {
        if (
          entryHandle.kind === 'file' &&
          entryName.toLowerCase().endsWith('.txt') &&
          (!entryName.toUpperCase().includes('PARECER GERENCIAL') ||
            entryName.toUpperCase().includes('FALTA'))
        ) {
          try {
            await dirHandleRoot.removeEntry(entryName);
          } catch {
            // Ignora
          }
        }
      }

      try {
        await dirCadastro.removeEntry('FALTA CONSULTAR SELOS.txt');
      } catch {
        // Ignora
      }

      // 2. Grava todos os documentos nas respectivas pastas
      for (const item of arquivosMapeados) {
        if (item.categoria === 'IGNORAR') continue;

        const destinos = calcularDestinosDoArquivo(
          item,
          nomesCurtos,
          projetistaNome,
          paNome
        );
        const buffer = await item.fileObj.arrayBuffer();

        if (destinos.nomeNaRaiz) {
          const salvo = await gravarBufferEmPasta(
            dirHandleRoot,
            destinos.nomeNaRaiz,
            buffer
          );
          nomesSalvosNaRaiz.add(salvo);

          if (
            item.categoria === 'ITEM_5_CERT_SOCIOAMBIENTAL' &&
            !item.isViti &&
            gerarDuplicataCertSocioSemNumero
          ) {
            const nomeExtra = `- CERT. SOCIOAMBIENTAL - ${nomesCurtos.titular}.${
              item.extensao || 'pdf'
            }`;
            const salvoExtra = await gravarBufferEmPasta(
              dirHandleRoot,
              nomeExtra,
              buffer
            );
            await gravarBufferEmPasta(dirSocioambiental, nomeExtra, buffer);
            nomesSalvosNaRaiz.add(salvoExtra);
          }
        }

        if (destinos.nomeNoCadastro) {
          await gravarBufferEmPasta(
            dirCadastro,
            destinos.nomeNoCadastro,
            buffer
          );
        }

        if (destinos.nomeNaSocioambiental) {
          await gravarBufferEmPasta(
            dirSocioambiental,
            destinos.nomeNaSocioambiental,
            buffer
          );
        }

        if (!item.origemGaveta && !nomesSalvosNaRaiz.has(item.nomeOriginal)) {
          try {
            await dirHandleRoot.removeEntry(item.nomeOriginal);
          } catch {
            // Ignora
          }
        }
      }

      // 3. Grava TODOS os .TXT vazios de pendências na pasta imediatamente (incluindo "20. FALTA PARECER GERENCIAL.txt")
      // Se o usuário extrair o Parecer Gerencial no próximo passo, o sistema apaga o "20. FALTA PARECER GERENCIAL.txt" e grava o oficial!
      if (gerarTxtsLembretesFaltantes) {
        for (const nomeTxtRaiz of planoArquivosTxtLembretes.txtsRaiz) {
          if (nomeTxtRaiz === '20. FALTA PARECER GERENCIAL.txt') {
            continue; // Só será gerado se o usuário pular/fechar a etapa do Parecer!
          }
          await gravarBufferEmPasta(dirHandleRoot, nomeTxtRaiz, '');
        }
        for (const nomeTxtCad of planoArquivosTxtLembretes.txtsSubpastaCadastro) {
          await gravarBufferEmPasta(dirCadastro, nomeTxtCad, '');
        }
      }

      // 4. FLUXO AUTOMÁTICO (ITENS 3.1 E 3.2):
      const itemConfBase: ItemConformidadePronafA =
        registroConformidadeVinculado || {
          id: `temp_${Date.now()}`,
          nomeCliente: titularNome.toUpperCase().trim(),
          cpfCliente: '',
          visitado: 'SIM',
          cadastroClienteOk: 'OK',
          dataRefCadastral: getHojeBR(),
          restricaoClienteNivel: 'SEM_RESTRICAO',
          restricaoClienteDetalhe: '',
          contaCorrente: '',
          conjugeNome: conjugeNome.toUpperCase().trim(),
          conjugeCpf: '',
          cadastroConjugeOk: conjugeNome.trim() ? 'OK' : 'NAO_SE_APLICA',
          restricaoConjugeNivel: 'SEM_RESTRICAO',
          restricaoConjugeDetalhe: '',
          procuradorNome: procuradorNome.toUpperCase().trim(),
          procuradorCpf: '',
          cadastroProcuradorOk: procuradorNome.trim() ? 'OK' : 'NAO_SE_APLICA',
          restricaoProcuradorNivel: 'SEM_RESTRICAO',
          restricaoProcuradorDetalhe: '',
        };

      const classificados = classificarListaConformidadePronafA(
        [itemConfBase],
        listaContratacoes
      );
      const resClassif = classificados[0];

      if (resClassif && !resClassif.jaCadastradoNoPainel && isPronafA) {
        setModalIniciarPronafA(resClassif);
        setCadCpf(resClassif.item.cpfCliente || '');
        setCadValor(auditoriaPdf?.valorPropostaDetectado || '');
        setCadTipo('Investimento');
        setCadProjetista(projetistaNome || '');
        setCadPrograma('FNE/PRONAF A - RES.5.183/24 (699)');
        setCadSituacao('Na Agência');
        setCadResponsavel('');
        setCadTelefone('');
        setCadData(getHojeBR());
        const linhaObjetivo = auditoriaPdf?.objetivoCreditoDetectado
          ? `\n- OBJETIVO DETECTADO NO PROJETO: ${auditoriaPdf.objetivoCreditoDetectado.toUpperCase()}`
          : '';
        setCadSitDetalhada(
          (resClassif.resumoPontosOk.length > 0
            ? resClassif.resumoPontosOk.map((p) => `- ${p}`).join('\n')
            : '- PASTA DO CLIENTE ORGANIZADA NO SISTEMA') + linhaObjetivo
        );
        setCadObsPendencias(
          resClassif.resumoPendencias.length > 0
            ? resClassif.resumoPendencias.map((p) => `- ${p}`).join('\n')
            : '- SEM PENDÊNCIAS CADASTRAIS IDENTIFICADAS'
        );
        return;
      } else if (resClassif && resClassif.jaCadastradoNoPainel) {
        const cpfLimpo = itemConfBase.cpfCliente.replace(/\D/g, '');
        const nomeUp = itemConfBase.nomeCliente.toUpperCase().trim();
        const cardVinc = listaCards.find(
          (c) =>
            (cpfLimpo.length === 11 &&
              (c.cpfVinculado || '').replace(/\D/g, '') === cpfLimpo) ||
            (c.clienteVinculado || '').toUpperCase().trim() === nomeUp
        );
        if (cardVinc) {
          setCardOverlayParecerId(cardVinc.id);
          return;
        }
      }

      alert(
        `✅ Pasta "${nomePastaSelecionada}" organizada com sucesso!\n\n` +
          `• ${resumoContadores.qtdRaiz} documento(s) padronizados na Raiz\n` +
          `• ${resumoContadores.qtdCadastro} documento(s) numerados na subpasta [CADASTRO]\n` +
          `• ${resumoContadores.qtdSocio} documento(s) numerados de 1 a 6 em [CERTIFICAÇÃO SOCIOAMBIENTAL]\n` +
          `• ${resumoContadores.totalTxts} lembrete(s) .TXT gerados automaticamente!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert('❌ Erro durante a organização da pasta: ' + msg);
    } finally {
      setProcessando(false);
    }
  };

  // CORRIGIDO: Salva na base viva, no Firebase, no callback pai e dispara o evento global bnb_v2_sync_externo!
  const confirmarCadastroPropostaEAbrirParecer = async () => {
    if (!modalIniciarPronafA) return;
    if (!cadValor.trim()) {
      alert('Informe o Valor da Proposta (R$) para cadastrar a operação!');
      return;
    }

    const { item } = modalIniciarPronafA;
    const idNovaOp = String(Date.now());
    const nomeUpper = item.nomeCliente.toUpperCase().trim();
    const cpfFmt = (cadCpf || item.cpfCliente || '').trim();

    const novaContratacao: RegistroContratacao = {
      id: idNovaOp,
      porte: 'PRONAF A',
      cliente: nomeUpper,
      cpf: cpfFmt,
      valor: cadValor.trim(),
      tipo: cadTipo || 'Investimento',
      situacao: cadSituacao || 'Na Agência',
      situacaoDetalhada: cadSitDetalhada.trim(),
      projetista: cadProjetista.toUpperCase().trim(),
      responsavel: cadResponsavel.toUpperCase().trim(),
      telefone: cadTelefone.trim(),
      data: cadData || getHojeBR(),
      obs: cadObsPendencias.trim(),
      programa: cadPrograma.toUpperCase().trim(),
      cadaVezMelhor: isEnquadradoCadaVezMelhor(cadPrograma),
      tipoGarantiaKanban: 'NENHUMA',
    };

    const { html, textoPuro } = montarHtmlCardSincronizado({
      cliente: nomeUpper,
      cpf: cpfFmt,
      porte: 'PRONAF A',
      projetista: novaContratacao.projetista,
      tipo: novaContratacao.tipo,
      valor: novaContratacao.valor,
      situacaoMacro: novaContratacao.situacao,
      situacaoDetalhada: novaContratacao.situacaoDetalhada,
      pendenciasObs: novaContratacao.obs,
      programa: novaContratacao.programa,
      operacoesAgrupadas: [
        {
          id: idNovaOp,
          tipo: novaContratacao.tipo,
          valor: novaContratacao.valor,
          situacao: novaContratacao.situacao,
          detalheExtra: novaContratacao.programa,
        },
      ],
    });

    const corCard =
      modalIniciarPronafA.grupoNumero === 1
        ? 'azul'
        : modalIniciarPronafA.grupoNumero === 4
        ? 'vermelho'
        : 'amarelo';

    const etapaInicial: EtapaKanban = 'CADASTROS';

    const novoCardKanban: CardKanban = {
      id: `wk_pronafa_${idNovaOp}`,
      etapa: etapaInicial,
      statusCor: corCard,
      texto: html,
      textoPuro,
      dataModificacao: getHojeISO(),
      isNovo: true,
      propostaIdVinculada: idNovaOp,
      idsPropostasAgrupadas: [idNovaOp],
      clienteVinculado: nomeUpper,
      cpfVinculado: cpfFmt,
      porteVinculado: 'PRONAF A',
      valorVinculado: novaContratacao.valor,
      tipoOpVinculado: novaContratacao.tipo,
      situacaoVinculada: novaContratacao.situacao,
      situacaoDetalhadaVinculada: novaContratacao.situacaoDetalhada,
      obsVinculada: novaContratacao.obs,
    };

    const baseContrAtual =
      listaContratacoes.length > 0
        ? listaContratacoes
        : lerCacheLocal<RegistroContratacao[]>(STORAGE_KEYS_V2.CONTRATACOES, []);
    const baseCardsAtual =
      listaCards.length > 0
        ? listaCards
        : lerCacheLocal<CardKanban[]>(STORAGE_KEYS_V2.KANBAN, []);

    const novasContratacoes = [novaContratacao, ...baseContrAtual];
    const novosCards = [novoCardKanban, ...baseCardsAtual];

    setListaContratacoes(novasContratacoes);
    setListaCards(novosCards);

    await Promise.all([
      salvarContratacoesSync(novasContratacoes),
      salvarKanbanSync(novosCards),
    ]);

    onCadastrarPropostaNoPainel?.(novaContratacao, novoCardKanban);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bnb_v2_sync_externo', {
          detail: {
            cards: novosCards,
            contratacoes: novasContratacoes,
          },
        })
      );
    }

    setModalIniciarPronafA(null);
    setCardOverlayParecerId(novoCardKanban.id);
  };

  const baixarPacoteZipOrganizado = async () => {
    if (arquivosMapeados.length === 0) return;
    const zip = new PizZip();
    const pastaCadastro = zip.folder('CADASTRO');
    const pastaSocio = zip.folder('CERTIFICAÇÃO SOCIOAMBIENTAL');

    for (const item of arquivosMapeados) {
      if (item.categoria === 'IGNORAR') continue;
      const destinos = calcularDestinosDoArquivo(
        item,
        nomesCurtos,
        projetistaNome,
        paNome
      );
      const buffer = await item.fileObj.arrayBuffer();

      if (destinos.nomeNaRaiz) {
        zip.file(destinos.nomeNaRaiz.replace(/[/:*?"<>|]/g, '-'), buffer);
        if (
          item.categoria === 'ITEM_5_CERT_SOCIOAMBIENTAL' &&
          !item.isViti &&
          gerarDuplicataCertSocioSemNumero
        ) {
          const nomeExtra = `- CERT. SOCIOAMBIENTAL - ${nomesCurtos.titular}.${
            item.extensao || 'pdf'
          }`;
          zip.file(nomeExtra, buffer);
          pastaSocio?.file(nomeExtra, buffer);
        }
      }
      if (destinos.nomeNoCadastro) {
        pastaCadastro?.file(
          destinos.nomeNoCadastro.replace(/[/:*?"<>|]/g, '-'),
          buffer
        );
      }
      if (destinos.nomeNaSocioambiental) {
        pastaSocio?.file(
          destinos.nomeNaSocioambiental.replace(/[/:*?"<>|]/g, '-'),
          buffer
        );
      }
    }

    if (gerarTxtsLembretesFaltantes) {
      planoArquivosTxtLembretes.txtsRaiz.forEach((nomeTxt) => {
        zip.file(nomeTxt.replace(/[/:*?"<>|]/g, '-'), '');
      });
      planoArquivosTxtLembretes.txtsSubpastaCadastro.forEach((nomeTxt) => {
        pastaCadastro?.file(nomeTxt.replace(/[/:*?"<>|]/g, '-'), '');
      });
    }

    const blob = zip.generate({ type: 'blob' });
    saveAs(blob, `PASTA_ORGANIZADA_${nomesCurtos.titular}.zip`);
  };

  const handleUploadCoringaGaveta = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const chaveFinal =
      novoCoringaTipo === 'PARECER_SEMA'
        ? 'GLOBAL (TODOS OS PRONAF A)'
        : novoCoringaChave.toUpperCase().trim();

    if (!chaveFinal) {
      alert('Informe o nome do Projetista ou do P.A. antes de anexar o PDF!');
      e.target.value = '';
      return;
    }

    try {
      setStatusSyncCofre('SINCRONIZANDO');
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferParaBase64(buf);
      const novoItem: CoringaGavetaNuvemItem = {
        id: `${novoCoringaTipo}_${removerAcentos(chaveFinal).replace(
          /[^A-Z0-9]/gi,
          '_'
        )}`,
        tipo: novoCoringaTipo,
        chaveReferencia: chaveFinal,
        nomeArquivoOriginal: file.name,
        base64Dados: b64,
        dataAtualizacao: new Date().toISOString(),
      };
      await salvarCoringaNoCofreLocal(novoItem);
      await salvarCoringaGavetaSync(novoItem);
      const atualizados = await listarCoringasDoCofreLocal();
      setCoringasSalvos(atualizados);
      alert(
        `✅ Documento Coringa [${novoCoringaTipo} — ${chaveFinal}] salvo e sincronizado na Nuvem com sucesso!`
      );
    } catch {
      alert('❌ Erro ao salvar arquivo no Cofre.');
    } finally {
      setStatusSyncCofre('SINCRONIZADO');
    }
    e.target.value = '';
  };

  if (!aberto || typeof document === 'undefined') return null;

  const inputPadraoStyle: React.CSSProperties = {
    height: '34px',
    padding: '4px 10px',
    fontSize: '12px',
    lineHeight: '1.25',
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
        background: 'rgba(15, 23, 42, 0.75)',
        zIndex: 900000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#f8fafc',
          width: '97vw',
          maxWidth: '1420px',
          height: '94vh',
          borderRadius: '12px',
          boxShadow: '0 25px 55px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #8B1530',
        }}
      >
        {/* CABEÇALHO EXECUTIVO PADRÃO PAINEL BNB */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '15.5px',
                  color: '#8B1530',
                  fontWeight: 800,
                  letterSpacing: '0.2px',
                }}
              >
                🗂️ ORGANIZADOR AUTOMÁTICO DE PASTAS & DOSSIÊ DO CLIENTE
              </h3>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  background:
                    statusSyncCofre === 'SINCRONIZADO' ? '#dcfce7' : '#fef9c3',
                  color:
                    statusSyncCofre === 'SINCRONIZADO' ? '#15803d' : '#854d0e',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                {statusSyncCofre === 'SINCRONIZADO'
                  ? '☁️ Gaveta Sincronizada na Nuvem'
                  : '⏳ Sincronizando Nuvem...'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Padroniza de 1 a 21 na Raiz, numera a subpasta <b>CADASTRO</b>, numera de 1 a 6 na <b>CERTIFICAÇÃO SOCIOAMBIENTAL</b> e integra com o <b>Parecer Gerencial</b>.
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setAbaAtiva('ORGANIZADOR')}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 14px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #8B1530',
                background: abaAtiva === 'ORGANIZADOR' ? '#8B1530' : '#ffffff',
                color: abaAtiva === 'ORGANIZADOR' ? '#ffffff' : '#8B1530',
                cursor: 'pointer',
              }}
            >
              ⚡ 1. Organizar Pasta do Cliente
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('COFRE')}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 14px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #b45309',
                background: abaAtiva === 'COFRE' ? '#b45309' : '#fffbeb',
                color: abaAtiva === 'COFRE' ? '#ffffff' : '#b45309',
                cursor: 'pointer',
              }}
            >
              🗄️ 2. Gaveta de Coringas na Nuvem ({coringasSalvos.length})
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
              title="Fechar"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ABA 1: ORGANIZADOR INTELIGENTE DE PASTA */}
        {abaAtiva === 'ORGANIZADOR' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                margin: '12px 20px 0 20px',
                padding: '14px 18px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderLeft: '5px solid #8B1530',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.35fr 1.3fr 1.1fr 1fr 0.85fr 1.15fr',
                  gap: '10px',
                  alignItems: 'end',
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#8B1530',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    ⚡ Vincular Cliente do Painel / Conformidade
                  </label>
                  <input
                    type="search"
                    list="dl_clientes_organizador"
                    value={buscaClienteRapida}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBuscaClienteRapida(val);
                      const achado = opcoesClientesConhecidos.find(
                        (o) =>
                          o.label === val ||
                          o.titular === val.toUpperCase().trim()
                      );
                      if (achado) {
                        setTitularNome(achado.titular);
                        if (achado.conjuge) setConjugeNome(achado.conjuge);
                        if (achado.procurador)
                          setProcuradorNome(achado.procurador);
                        if (achado.avalista) setAvalistaNome(achado.avalista);
                        if (achado.projetista)
                          setProjetistaNome(achado.projetista);
                        setIsPronafA(achado.pronafA);
                      }
                    }}
                    placeholder="Selecione ou deixe autodetectar..."
                    style={inputPadraoStyle}
                  />
                  <datalist id="dl_clientes_organizador">
                    {opcoesClientesConhecidos.map((op, i) => (
                      <option key={i} value={op.label} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#0f172a',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    👤 Titular (Tag:{' '}
                    <span style={{ color: '#8B1530' }}>
                      {nomesCurtos.titular}
                    </span>
                    )
                  </label>
                  <input
                    type="text"
                    value={titularNome}
                    onChange={(e) =>
                      setTitularNome(e.target.value.toUpperCase())
                    }
                    placeholder="Ex: ISMAEL ANDRADE DA SILVA"
                    style={{ ...inputPadraoStyle, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    👥 Cônjuge{' '}
                    {nomesCurtos.conjuge
                      ? `(${nomesCurtos.conjuge})`
                      : '(Opcional)'}
                  </label>
                  <input
                    type="text"
                    value={conjugeNome}
                    onChange={(e) =>
                      setConjugeNome(e.target.value.toUpperCase())
                    }
                    placeholder="Ex: MARIA ZILMA DOS REIS"
                    style={inputPadraoStyle}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    📝 Procurador / Avalista
                  </label>
                  <input
                    type="text"
                    value={procuradorNome}
                    onChange={(e) =>
                      setProcuradorNome(e.target.value.toUpperCase())
                    }
                    placeholder="Se houver..."
                    style={inputPadraoStyle}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    👨‍💼 Projetista (Item 6)
                  </label>
                  <input
                    type="search"
                    list="dl_proj_organizador"
                    value={projetistaNome}
                    onChange={(e) =>
                      setProjetistaNome(e.target.value.toUpperCase())
                    }
                    placeholder="Ex: ZEZÃO"
                    style={{ ...inputPadraoStyle, fontWeight: 700 }}
                  />
                  <datalist id="dl_proj_organizador">
                    {LISTA_PROJETISTAS_CURTOS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    🏕️ Assentamento / P.A. (Itens 13 e 17)
                  </label>
                  <input
                    type="text"
                    value={paNome}
                    onChange={(e) => setPaNome(e.target.value.toUpperCase())}
                    placeholder="Ex: P.A LAGO DA CARNAÚBA"
                    style={inputPadraoStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  paddingTop: '10px',
                  borderTop: '1px dashed #e2e8f0',
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
                  <button
                    type="button"
                    onClick={selecionarPastaNoComputador}
                    style={{
                      width: 'auto',
                      height: '36px',
                      padding: '0 16px',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      background: '#8B1530',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(139, 21, 48, 0.25)',
                    }}
                  >
                    📂 1. Selecionar Pasta Raiz do Cliente no Windows
                  </button>

                  {nomePastaSelecionada && (
                    <span
                      style={{
                        background: '#fdf2f4',
                        color: '#8B1530',
                        border: '1px solid #f5c2c7',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 800,
                      }}
                    >
                      📁 {nomePastaSelecionada} ({arquivosMapeados.length} arq.)
                    </span>
                  )}

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isPronafA}
                      onChange={(e) => setIsPronafA(e.target.checked)}
                      style={{
                        width: '14px',
                        height: '14px',
                        margin: 0,
                        accentColor: '#8B1530',
                      }}
                    />
                    PRONAF A (Injetar SEMA e RB)
                  </label>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#b45309',
                      cursor: 'pointer',
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={gerarTxtsLembretesFaltantes}
                      onChange={(e) =>
                        setGerarTxtsLembretesFaltantes(e.target.checked)
                      }
                      style={{
                        width: '14px',
                        height: '14px',
                        margin: 0,
                        accentColor: '#b45309',
                      }}
                    />
                    Gerar .TXT Vazios de Pendências/Lembretes
                  </label>
                </div>

                {arquivosMapeados.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={baixarPacoteZipOrganizado}
                      style={{
                        width: 'auto',
                        height: '36px',
                        padding: '0 14px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      📦 Baixar .ZIP
                    </button>

                    <button
                      type="button"
                      disabled={processando}
                      onClick={executarOrganizacaoDiretoNaPasta}
                      style={{
                        width: 'auto',
                        height: '36px',
                        padding: '0 20px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        background: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 3px 10px rgba(21,128,61,0.3)',
                      }}
                    >
                      {processando
                        ? '⏳ Organizando Pasta...'
                        : '⚡ 2. Organizar Pasta & Iniciar Proposta / Parecer!'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CORPO PRINCIPAL DIVIDIDO EM 2 COLUNAS */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1.85fr 1fr',
                gap: '14px',
                padding: '12px 20px 18px 20px',
                overflow: 'hidden',
              }}
            >
              {/* COLUNA ESQUERDA: TABELA DE MAPEAMENTO */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    padding: '10px 16px',
                    background: '#8B1530',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span>
                    📋 1. ARQUIVOS IDENTIFICADOS NA PASTA ({arquivosMapeados.length})
                  </span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10.5px' }}>
                    <span
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      📁 Raiz: {resumoContadores.qtdRaiz}
                    </span>
                    <span
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      🪪 Cadastro: {resumoContadores.qtdCadastro}
                    </span>
                    <span
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      🌿 Socioambiental (1 a 6): {resumoContadores.qtdSocio}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {arquivosMapeados.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '60px 24px',
                        color: '#64748b',
                        fontSize: '13px',
                      }}
                    >
                      Clique em{' '}
                      <b style={{ color: '#8B1530' }}>
                        &ldquo;📂 1. Selecionar Pasta Raiz do Cliente no Windows&rdquo;
                      </b>{' '}
                      acima para carregar os arquivos enviados pelo projetista.
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '11.5px',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: '#f1f5f9',
                            textAlign: 'left',
                            color: '#334155',
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          <th
                            style={{
                              padding: '8px 10px',
                              borderBottom: '1px solid #cbd5e1',
                            }}
                          >
                            Arquivo Original na Pasta
                          </th>
                          <th
                            style={{
                              padding: '8px 10px',
                              borderBottom: '1px solid #cbd5e1',
                              width: '245px',
                            }}
                          >
                            Classificação Detectada
                          </th>
                          <th
                            style={{
                              padding: '8px 6px',
                              borderBottom: '1px solid #cbd5e1',
                              width: '54px',
                              textAlign: 'center',
                            }}
                          >
                            VITI?
                          </th>
                          <th
                            style={{
                              padding: '8px 10px',
                              borderBottom: '1px solid #cbd5e1',
                            }}
                          >
                            Novo Nome Padronizado & Destino
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {arquivosMapeados.map((arq, idx) => {
                          const dest = calcularDestinosDoArquivo(
                            arq,
                            nomesCurtos,
                            projetistaNome,
                            paNome
                          );
                          const aceitaViti = CATEGORIAS_QUE_ACEITAM_VITI.has(
                            arq.categoria
                          );

                          return (
                            <tr
                              key={arq.id}
                              style={{
                                borderBottom: '1px solid #e2e8f0',
                                background: arq.origemGaveta
                                  ? '#fffbeb'
                                  : idx % 2 === 0
                                  ? '#ffffff'
                                  : '#f8fafc',
                              }}
                            >
                              <td
                                style={{
                                  padding: '8px 10px',
                                  wordBreak: 'break-all',
                                  color: arq.origemGaveta
                                    ? '#b45309'
                                    : '#334155',
                                  fontWeight: arq.origemGaveta ? 700 : 500,
                                  lineHeight: 1.35,
                                }}
                              >
                                {arq.nomeOriginal}
                              </td>

                              <td style={{ padding: '6px 10px' }}>
                                <select
                                  value={arq.categoria}
                                  onChange={(e) => {
                                    const novaCat = e.target
                                      .value as CategoriaDocPasta;
                                    const copia = [...arquivosMapeados];
                                    copia[idx] = {
                                      ...copia[idx],
                                      categoria: novaCat,
                                      isViti: CATEGORIAS_QUE_ACEITAM_VITI.has(
                                        novaCat
                                      )
                                        ? copia[idx].isViti
                                        : false,
                                    };
                                    setArquivosMapeados(copia);
                                  }}
                                  style={{
                                    width: '100%',
                                    height: '34px',
                                    minHeight: '34px',
                                    padding: '4px 8px',
                                    fontSize: '11.5px',
                                    lineHeight: '1.25',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <optgroup label="📂 Pasta Raiz (Itens 1 a 21)">
                                    <option value="ITEM_1_PROJETO_ARQ">
                                      1. PROJETO (.PRONAF_A2)
                                    </option>
                                    <option value="ITEM_2_AUT_ALTERACAO">
                                      2. AUTORIZAÇÃO DE ALTERAÇÃO
                                    </option>
                                    <option value="ITEM_3_EMBARGOS_TITULAR">
                                      3. EMBARGOS (Titular)
                                    </option>
                                    <option value="ITEM_3_EMBARGOS_CONJUGE">
                                      3. EMBARGOS (Cônjuge)
                                    </option>
                                    <option value="ITEM_4_IMPROBIDADE_TITULAR">
                                      4. IMPROBIDADE (Titular)
                                    </option>
                                    <option value="ITEM_4_IMPROBIDADE_CONJUGE">
                                      4. IMPROBIDADE (Cônjuge)
                                    </option>
                                    <option value="ITEM_5_CERT_SOCIOAMBIENTAL">
                                      5. CERT. SOCIOAMBIENTAL
                                    </option>
                                    <option value="ITEM_6_CREA">
                                      6. CREA (Projetista)
                                    </option>
                                    <option value="ITEM_7_EXTRATO_SICOR">
                                      7. EXTRATO SICOR
                                    </option>
                                    <option value="ITEM_8_CONTRATO_ASSESSORIA">
                                      8. CONTRATO DE ASSESSORIA
                                    </option>
                                    <option value="ITEM_9_CONSOLIDADAS">
                                      9. DECLARAÇÕES CONSOLIDADAS
                                    </option>
                                    <option value="ITEM_10_DEC_AMBIENTAIS">
                                      10. DEC. AMBIENTAIS
                                    </option>
                                    <option value="ITEM_10_1_REG_AMBIENTAL">
                                      10.1. DEC. REGULARIDADE AMBIENTAL
                                    </option>
                                    <option value="ITEM_10_2_NAO_DESMATAMENTO">
                                      10.2. DEC. NÃO DESMATAMENTO
                                    </option>
                                    <option value="ITEM_10_3_RECOMPOSICAO">
                                      10.3. DEC. DE RECOMPOSIÇÃO
                                    </option>
                                    <option value="ITEM_10_4_OUTRA_DEC_AMBIENTAL">
                                      10.4. OUTRA DEC. AMBIENTAL
                                    </option>
                                    <option value="ITEM_11_ESPELHO_UND">
                                      11. ESPELHO - RELATÓRIO DA UND
                                    </option>
                                    <option value="ITEM_12_PROJETO_PDF">
                                      12. PROJETO (PDF)
                                    </option>
                                    <option value="ITEM_13_CAR">13. CAR</option>
                                    <option value="ITEM_13_CONSULTA_CAR">
                                      13. CONSULTA DO CAR
                                    </option>
                                    <option value="ITEM_14_CAF">
                                      14. CAF (Raiz + Cadastro)
                                    </option>
                                    <option value="ITEM_15_DCAA">15. DCAA</option>
                                    <option value="ITEM_16_PARECER_TECNICO">
                                      16. PARECER TÉCNICO
                                    </option>
                                    <option value="ITEM_17_RB_PA">
                                      17 - RB P.A.
                                    </option>
                                    <option value="ITEM_18_ORCAMENTO">
                                      18. ORÇAMENTO
                                    </option>
                                    <option value="ITEM_19_CAPA_ANALISADOR">
                                      19. CAPA DO ANALISADOR
                                    </option>
                                    <option value="ITEM_20_PARECER_GERENCIAL">
                                      20. PARECER GERENCIAL
                                    </option>
                                    <option value="ITEM_21_PARECER_SEMA">
                                      21. PARECER DA SEMA
                                    </option>
                                  </optgroup>
                                  <optgroup label="🪪 Subpasta CADASTRO (1 a 9)">
                                    <option value="CAD_1_IDENTIDADE_TITULAR">
                                      CAD 1. IDENTIDADE (Titular)
                                    </option>
                                    <option value="CAD_1_IDENTIDADE_CONJUGE">
                                      CAD 1. IDENTIDADE (Cônjuge)
                                    </option>
                                    <option value="CAD_1_IDENTIDADE_OUTRO">
                                      CAD 1. IDENTIDADE (Procurador/Aval.)
                                    </option>
                                    <option value="CAD_2_CERTIDAO_CASAMENTO">
                                      CAD 2. CERTIDÃO DE CASAMENTO
                                    </option>
                                    <option value="CAD_3_COMP_ENDERECO">
                                      CAD 3. COMP. DE ENDEREÇO
                                    </option>
                                    <option value="CAD_4_COMP_RENDA">
                                      CAD 4. COMP. DE RENDA
                                    </option>
                                    <option value="CAD_5_PROPOSTA_CADASTRO">
                                      CAD 6. PROPOSTA DE CADASTRO (Aceita VITI)
                                    </option>
                                    <option value="CAD_6_PROCURACAO">
                                      CAD 7. PROCURAÇÃO
                                    </option>
                                    <option value="CAD_8_SELO_CARTORIO">
                                      CAD 8. SELO DE FISCALIZAÇÃO
                                    </option>
                                    <option value="CAD_9_OUTROS_CADASTRO">
                                      CAD 9. OUTROS CADASTRAIS
                                    </option>
                                  </optgroup>
                                  <option value="IGNORAR">
                                    🚫 Ignorar / Não Mexer
                                  </option>
                                </select>
                              </td>

                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                {aceitaViti ? (
                                  <input
                                    type="checkbox"
                                    checked={arq.isViti}
                                    onChange={(e) => {
                                      const copia = [...arquivosMapeados];
                                      copia[idx] = {
                                        ...copia[idx],
                                        isViti: e.target.checked,
                                      };
                                      setArquivosMapeados(copia);
                                    }}
                                    style={{
                                      width: '15px',
                                      height: '15px',
                                      margin: 0,
                                      cursor: 'pointer',
                                      accentColor: '#8B1530',
                                    }}
                                    title="Marque se este PDF for o Relatório de Validação ITI (VITI)"
                                  />
                                ) : (
                                  <span
                                    style={{ color: '#cbd5e1', fontSize: '12px' }}
                                    title="Este tipo de documento não utiliza validação ITI"
                                  >
                                    —
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '8px 10px' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px',
                                  }}
                                >
                                  {dest.nomeNaRaiz && (
                                    <span
                                      style={{
                                        color: '#0f172a',
                                        fontWeight: 800,
                                        fontSize: '11.5px',
                                      }}
                                    >
                                      📁 Raiz:{' '}
                                      <span style={{ color: '#8B1530' }}>
                                        {dest.nomeNaRaiz}
                                      </span>
                                    </span>
                                  )}
                                  {dest.nomeNoCadastro && (
                                    <span
                                      style={{
                                        color: '#6b21a8',
                                        fontWeight: 700,
                                        fontSize: '11px',
                                      }}
                                    >
                                      🪪 Subpasta CADASTRO: {dest.nomeNoCadastro}
                                    </span>
                                  )}
                                  {dest.nomeNaSocioambiental && (
                                    <span
                                      style={{
                                        color: '#15803d',
                                        fontWeight: 700,
                                        fontSize: '11px',
                                      }}
                                    >
                                      🌿 Subpasta CERT. SOCIOAMBIENTAL:{' '}
                                      {dest.nomeNaSocioambiental}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

                  {/* COLUNA DIREITA: LEMBRETES .TXT GERADOS + CONFERÊNCIA DE ASSINATURA */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflowY: 'auto',
                }}
              >
              
              {/* NOVO BLOCO: AUDITORIA INTELIGENTE DOS 12 PONTOS LIDOS NOS PDFs DA PASTA */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    borderTop: '4px solid #0369a1',
                    padding: '12px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
                    <strong style={{ fontSize: '12px', color: '#0369a1' }}>
                      🧠 AUDITORIA AUTOMÁTICA DOS PDFs DA PASTA (12 VERIFICAÇÕES)
                    </strong>
                    {auditandoPdfs && (
                      <span style={{ fontSize: '10.5px', color: '#b45309', fontWeight: 800 }}>
                        ⏳ Lendo PDFs...
                      </span>
                    )}
                  </div>

                  {!auditoriaPdf ? (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Selecione a pasta do cliente para o sistema ler o conteúdo interno dos PDFs (Consolidada, Projeto, Orçamento, CAF, Espelho, CAR e RB).
                    </span>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                      }}
                    >
                      {auditoriaPdf.itensDiagnostico.map((diag) => {
                        const paleta =
                          diag.status === 'OK'
                            ? { bg: '#f0fdf4', borda: '#86efac', cor: '#166534', icone: '✅' }
                            : diag.status === 'ERRO'
                            ? { bg: '#fef2f2', borda: '#fca5a5', cor: '#991b1b', icone: '🚨' }
                            : diag.status === 'ALERTA'
                            ? { bg: '#fffbeb', borda: '#fde68a', cor: '#92400e', icone: '⚠️' }
                            : { bg: '#f8fafc', borda: '#e2e8f0', cor: '#334155', icone: 'ℹ️' };

                        return (
                          <div
                            key={diag.numero}
                            style={{
                              background: paleta.bg,
                              border: `1px solid ${paleta.borda}`,
                              borderRadius: '6px',
                              padding: '6px 9px',
                              fontSize: '11px',
                            }}
                          >
                            <div style={{ fontWeight: 800, color: paleta.cor }}>
                              {paleta.icone} {diag.titulo}
                            </div>
                            <div style={{ color: '#1e293b', marginTop: '2px', fontWeight: 600 }}>
                              {diag.resumo}
                            </div>
                            {diag.detalhes && diag.detalhes.length > 0 && (
                              <div
                                style={{
                                  marginTop: '4px',
                                  paddingTop: '4px',
                                  borderTop: `1px dashed ${paleta.borda}`,
                                  fontSize: '10.5px',
                                  color: '#475569',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                {diag.detalhes.map((det, idxD) => (
                                  <div key={idxD}>• {det}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              
              
              
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    borderTop: '4px solid #8B1530',
                    padding: '12px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
                    <strong style={{ fontSize: '12px', color: '#8B1530' }}>
                      📝 ARQUIVOS .TXT DE PENDÊNCIAS & LEMBRETES ({resumoContadores.totalTxts})
                    </strong>
                    {registroConformidadeVinculado && (
                      <span
                        style={{
                          fontSize: '10px',
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontWeight: 800,
                        }}
                      >
                        🔗 Na Conformidade PRONAF A
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    Arquivos <b>.txt</b> vazios criados na pasta para destacar o que falta (incluindo <b>20. FALTA PARECER GERENCIAL.txt</b> até que o parecer oficial seja salvo):
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                    }}
                  >
                    {planoArquivosTxtLembretes.txtsSubpastaCadastro.map(
                      (tCad, idxC) => (
                        <div
                          key={`cad_${idxC}`}
                          style={{
                            background: '#faf5ff',
                            color: '#6b21a8',
                            border: '1px solid #d8b4fe',
                            padding: '5px 8px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 800,
                          }}
                        >
                          🪪 [Pasta CADASTRO] {tCad}
                        </div>
                      )
                    )}

                    {planoArquivosTxtLembretes.txtsRaiz.map((tRaiz, idxR) => {
                      const isZero = tRaiz.startsWith('0.');
                      const isLembrete9 = tRaiz.startsWith('9. VERIFICAR');
                      const isParecer20 = tRaiz.startsWith('20. FALTA');
                      return (
                        <div
                          key={`raiz_${idxR}`}
                          style={{
                            background: isZero
                              ? '#fef2f2'
                              : isLembrete9
                              ? '#eff6ff'
                              : isParecer20
                              ? '#f0fdf4'
                              : '#fffbeb',
                            color: isZero
                              ? '#b91c1c'
                              : isLembrete9
                              ? '#1d4ed8'
                              : isParecer20
                              ? '#15803d'
                              : '#92400e',
                            border: `1px solid ${
                              isZero
                                ? '#fecaca'
                                : isLembrete9
                                ? '#bfdbfe'
                                : isParecer20
                                ? '#86efac'
                                : '#fde68a'
                            }`,
                            padding: '5px 8px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          📄 {tRaiz}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    borderTop: '4px solid #475569',
                    padding: '12px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '12px',
                      color: '#334155',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    🔍 CONFERÊNCIA VISUAL DE ASSINATURAS (SEM GERAR .TXT)
                  </strong>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    Documentos abaixo estão na pasta sem arquivo <b>VITI</b>. Caso tenham sido assinados manualmente, não precisam de VITI:
                  </span>
                  {avisosVitisParaConferenciaManual.length === 0 ? (
                    <div
                      style={{
                        color: '#15803d',
                        fontWeight: 800,
                        fontSize: '11.5px',
                      }}
                    >
                      ✅ Todos os documentos assináveis presentes já possuem VITI!
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#475569',
                      }}
                    >
                      {avisosVitisParaConferenciaManual.map((v, i) => (
                        <div
                          key={i}
                          style={{
                            background: '#f8fafc',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          👀 Conferir se é digital ou manual: <b>{v}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: GAVETA / COFRE DE DOCUMENTOS CORINGAS SINCRONIZADA NA NUVEM */}
        {abaAtiva === 'COFRE' && (
          <div
            style={{
              flex: 1,
              padding: '20px 24px',
              background: '#f8fafc',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderLeft: '5px solid #b45309',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '18px',
              }}
            >
              <h4
                style={{
                  margin: '0 0 6px 0',
                  color: '#8B1530',
                  fontSize: '14px',
                }}
              >
                ☁️ Cadastrar Documento Coringa na Gaveta da Nuvem (Injeção Automática)
              </h4>
              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                Todos os PDFs enviados aqui ficam salvos permanentemente no <b>Firebase (Nuvem)</b> e no cache local até que você os edite ou remova!
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.4fr 1.5fr',
                  gap: '12px',
                  alignItems: 'end',
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Tipo de Documento Coringa
                  </label>
                  <select
                    value={novoCoringaTipo}
                    onChange={(e) =>
                      setNovoCoringaTipo(
                        e.target.value as CoringaGavetaNuvemItem['tipo']
                      )
                    }
                    style={{ ...inputPadraoStyle, fontWeight: 700 }}
                  >
                    <option value="PARECER_SEMA">
                      21. PARECER DA SEMA (Global p/ Todos os PRONAF A)
                    </option>
                    <option value="CREA_PROJETISTA">
                      6. CREA DO PROJETISTA (Por Nome do Projetista)
                    </option>
                    <option value="RB_PA">
                      17 - RB DO ASSENTAMENTO (Por Nome do P.A.)
                    </option>
                    <option value="CAR_PA">
                      13. CAR GERAL DO ASSENTAMENTO (Por Nome do P.A.)
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    {novoCoringaTipo === 'PARECER_SEMA'
                      ? 'Aplicação Global'
                      : novoCoringaTipo === 'CREA_PROJETISTA'
                      ? 'Nome do Projetista (Ex: ZEZÃO)'
                      : 'Nome do Assentamento (Ex: P.A LAGO DA CARNAÚBA)'}
                  </label>
                  <input
                    type="text"
                    disabled={novoCoringaTipo === 'PARECER_SEMA'}
                    value={
                      novoCoringaTipo === 'PARECER_SEMA'
                        ? 'TODOS OS PRONAF A'
                        : novoCoringaChave
                    }
                    onChange={(e) =>
                      setNovoCoringaChave(e.target.value.toUpperCase())
                    }
                    placeholder="Ex: ZEZÃO ou P.A LAGO DA CARNAÚBA"
                    style={{ ...inputPadraoStyle, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '34px',
                      background: '#8B1530',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      margin: 0,
                    }}
                  >
                    📤 Selecionar PDF e Salvar na Nuvem
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleUploadCoringaGaveta}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px 20px',
              }}
            >
              <strong
                style={{
                  fontSize: '13px',
                  color: '#8B1530',
                  display: 'block',
                  marginBottom: '10px',
                }}
              >
                📚 DOCUMENTOS CORINGAS SINCRONIZADOS NA NUVEM ({coringasSalvos.length})
              </strong>
              {coringasSalvos.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#64748b' }}>
                  Nenhum documento coringa guardado ainda. Suba o Parecer da SEMA, os CREAs dos projetistas e as RBs acima!
                </p>
              ) : (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Categoria</th>
                      <th style={{ padding: '8px' }}>
                        Referência (Projetista / P.A. / Global)
                      </th>
                      <th style={{ padding: '8px' }}>Arquivo Base Salvo</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coringasSalvos.map((cor) => (
                      <tr
                        key={cor.id}
                        style={{ borderBottom: '1px solid #e2e8f0' }}
                      >
                        <td
                          style={{
                            padding: '8px',
                            fontWeight: 800,
                            color: '#8B1530',
                          }}
                        >
                          {cor.tipo === 'PARECER_SEMA'
                            ? '21. PARECER DA SEMA (Raiz 21 / Socioamb. 5)'
                            : cor.tipo === 'CREA_PROJETISTA'
                            ? '6. CREA DO PROJETISTA'
                            : cor.tipo === 'RB_PA'
                            ? '17 - RB DO P.A.'
                            : '13. CAR GERAL DO P.A. (Raiz 13 / Socioamb. 2)'}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700 }}>
                          {cor.chaveReferencia}
                        </td>
                        <td style={{ padding: '8px', color: '#475569' }}>
                          {cor.nomeArquivoOriginal}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              await removerCoringaDoCofreLocal(cor.id);
                              await removerCoringaGavetaSync(cor.id);
                              setCoringasSalvos(
                                await listarCoringasDoCofreLocal()
                              );
                            }}
                            style={{
                              width: 'auto',
                              padding: '4px 10px',
                              fontSize: '11px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            🗑️ Remover da Nuvem
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* PASSO AUTOMÁTICO 3.1: MODAL INICIAR PROPOSTA PRONAF A                 */}
      {/* ===================================================================== */}
      {modalIniciarPronafA && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            zIndex: 950000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '22px',
              borderRadius: '10px',
              width: '680px',
              maxWidth: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderTop: '5px solid #8B1530',
              boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '10px',
                marginBottom: '14px',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: '#8B1530',
                    fontSize: '15.5px',
                  }}
                >
                  🚀 INICIAR PROPOSTA PRONAF A & GERAR PARECER GERENCIAL
                </h3>
                <span
                  style={{
                    fontSize: '11.5px',
                    color: '#15803d',
                    fontWeight: 700,
                  }}
                >
                  ✅ Pasta organizada (com 20. FALTA PARECER GERENCIAL.txt)! Cadastre a operação abaixo para abrir o Parecer Gerencial e substituir pelo parecer oficial.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
  setModalIniciarPronafA(null);
  handleFecharOverlayParecer();
}}
                style={{
                  width: 'auto',
                  background: 'none',
                  border: 'none',
                  fontSize: '22px',
                  color: '#64748b',
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 1.2fr',
                gap: '10px',
                marginBottom: '10px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Porte</label>
                <input
                  type="text"
                  value="PRONAF A"
                  disabled
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontWeight: 800,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Cliente</label>
                <input
                  type="text"
                  value={modalIniciarPronafA.item.nomeCliente.toUpperCase()}
                  disabled
                  style={{ background: '#f8fafc', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>CPF</label>
                <input
                  type="text"
                  value={cadCpf}
                  onChange={(e) => setCadCpf(aplicarMascaraCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '10px',
                marginBottom: '10px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Tipo de Operação
                </label>
                <select
                  value={cadTipo}
                  onChange={(e) => setCadTipo(e.target.value)}
                >
                  <option value="Investimento">Investimento</option>
                  <option value="Custeio">Custeio</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#8B1530',
                  }}
                >
                  Valor da Proposta (R$) *
                </label>
                <input
                  type="text"
                  value={cadValor}
                  onChange={(e) =>
                    setCadValor(aplicarMascaraMoedaInput(e.target.value))
                  }
                  placeholder="Ex: 55.000,00"
                  autoFocus
                  style={{ fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Projetista (Detectado)
                </label>
                <input
                  type="search"
                  list="dl_proj_organizador"
                  value={cadProjetista}
                  onChange={(e) => setCadProjetista(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Situação Inicial
                </label>
                <select
                  value={cadSituacao}
                  onChange={(e) => setCadSituacao(e.target.value)}
                >
                  <option value="Com Cliente/Projetista">
                    Com Cliente/Projetista
                  </option>
                  <option value="Na Agência">Na Agência (AG)</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '10px',
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#8B1530',
                  }}
                >
                  📊 SITUAÇÃO (Para o Card do Kanban)
                </label>
                <textarea
                  rows={3}
                  value={cadSitDetalhada}
                  onChange={(e) => setCadSitDetalhada(e.target.value)}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#b45309',
                  }}
                >
                  📝 PENDÊNCIAS / OBSERVAÇÕES
                </label>
                <textarea
                  rows={3}
                  value={cadObsPendencias}
                  onChange={(e) => setCadObsPendencias(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 0.9fr 1.5fr',
                gap: '10px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Responsável BNB
                </label>
                <input
                  type="text"
                  value={cadResponsavel}
                  onChange={(e) => setCadResponsavel(e.target.value)}
                  placeholder="Analista"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Telefone Cliente
                </label>
                <input
                  type="text"
                  value={cadTelefone}
                  onChange={(e) => setCadTelefone(e.target.value)}
                  placeholder="(98) 99999-9999"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Data</label>
                <input
                  type="text"
                  value={cadData}
                  onChange={(e) =>
                    setCadData(aplicarMascaraDataBR(e.target.value))
                  }
                  maxLength={10}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  📑 Programa
                </label>
                <input
                  type="search"
                  list="dl_prog_org_pronafa"
                  value={cadPrograma}
                  onChange={(e) => setCadPrograma(e.target.value)}
                />
                <datalist id="dl_prog_org_pronafa">
                  {listaProgramas.map((pr) => (
                    <option key={pr} value={pr} />
                  ))}
                </datalist>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '18px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => {
  setModalIniciarPronafA(null);
  handleFecharOverlayParecer();
}}
                style={{
                  width: 'auto',
                  padding: '8px 16px',
                  background: '#e2e8f0',
                  color: '#334155',
                  fontSize: '12px',
                }}
              >
                Pular Cadastro (Manter 20. FALTA PARECER GERENCIAL.txt)
              </button>
              <button
                type="button"
                onClick={confirmarCadastroPropostaEAbrirParecer}
                style={{
                  width: 'auto',
                  padding: '8px 20px',
                  background: '#15803d',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                💾 Cadastrar no Kanban & Abrir Parecer Gerencial ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PASSO AUTOMÁTICO 3.2: OVERLAY DO CARD NA ABA PARECER GERENCIAL        */}
      {/* ===================================================================== */}
      {cardOverlayParecerId && (
        <>
          <div
            style={{
              position: 'fixed',
              top: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10000020,
              background: '#0f172a',
              color: '#ffffff',
              padding: '6px 16px',
              borderRadius: '30px',
              boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
              border: '1.5px solid #22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '11.5px',
            }}
          >
            <span>
              📂 Pasta ativa: <b style={{ color: '#4ade80' }}>{nomePastaSelecionada}</b> — Edite o parecer abaixo e clique no botão <b>&ldquo;Extrair .TXT&rdquo;</b> da própria aba para salvar como <b>&ldquo;20. PARECER GERENCIAL - FALTA AJUSTAR.txt&rdquo;</b>!
            </span>
            <button
              type="button"
              onClick={handleFecharOverlayParecer}
              style={{
                width: 'auto',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
              }}
            >
              ✖ Pular / Fechar
            </button>
          </div>

          <ModuloKanban
            cards={listaCards}
            contratacoes={listaContratacoes}
            operacoesBase={listaOpBase}
            eventos={listaEventos}
            modoOverlayCardUnicoId={cardOverlayParecerId}
            abaInicialOverlay="parecer"
            onFecharOverlayCardUnico={handleFecharOverlayParecer}
            /* ...mantenha os callbacks iguais... */
            onAtualizarCards={(novosCards) => {
              setListaCards(novosCards);
              salvarKanbanSync(novosCards).catch(() => {});
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('bnb_v2_sync_externo', {
                    detail: { cards: novosCards, contratacoes: listaContratacoes },
                  })
                );
              }
            }}
            onCardSincronizadoAlterado={(cardAtualizado, todosOsCards) => {
              setListaCards(todosOsCards);
              salvarKanbanSync(todosOsCards).catch(() => {});
              const novasContrat = listaContratacoes.map((r) =>
                String(r.id) === String(cardAtualizado.propostaIdVinculada)
                  ? {
                      ...r,
                      situacao: cardAtualizado.situacaoVinculada || r.situacao,
                      situacaoDetalhada:
                        cardAtualizado.situacaoDetalhadaVinculada ??
                        r.situacaoDetalhada,
                      obs: cardAtualizado.obsVinculada ?? r.obs,
                    }
                  : r
              );
              setListaContratacoes(novasContrat);
              salvarContratacoesSync(novasContrat).catch(() => {});
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('bnb_v2_sync_externo', {
                    detail: { cards: todosOsCards, contratacoes: novasContrat },
                  })
                );
              }
            }}
            onAtualizarContratacoes={(novas) => {
              setListaContratacoes(novas);
              salvarContratacoesSync(novas).catch(() => {});
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('bnb_v2_sync_externo', {
                    detail: { cards: listaCards, contratacoes: novas },
                  })
                );
              }
            }}
            onRegistroContratacaoSalvo={(_reg, todas) => {
              setListaContratacoes(todas);
              salvarContratacoesSync(todas).catch(() => {});
            }}
            onAtualizarOperacoesBase={(ops) => {
              setListaOpBase(ops);
              salvarDesembOpSync(ops).catch(() => {});
            }}
            onAtualizarEventos={(evs) => {
              setListaEventos(evs);
              salvarDesembEvSync(evs).catch(() => {});
            }}
          />
        </>
      )}
    </div>,
    document.body
  );
}