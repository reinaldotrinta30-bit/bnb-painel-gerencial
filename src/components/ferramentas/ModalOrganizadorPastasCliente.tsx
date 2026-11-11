'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import ModuloKanban from '@/components/ModuloKanban';
import PainelConsultasRapidasAgrupadas from '@/components/ferramentas/PainelConsultasRapidasAgrupadas';
import {
  executarAuditoriaCompletaDosPdfsDaPasta,
  ResultadoAuditoriaPastaPdf,
  limparCacheDadosProjetoParecer,
  salvarDadosExtraidosParaParecer,
} from '@/lib/auditorInteligentePdfPasta';
import {
  PorteOrganizador,
  EscopoOperacaoPasta,
  ModalidadeDerivada,
  ModalidadeLimite,
  GarantiaDerivada,
  ConfiguracaoPerfilPasta,
  CategoriaDocPasta,
  CATEGORIAS_QUE_ACEITAM_VITI,
  classificarArquivoUniversal,
  calcularTodosDestinosDoArquivo,
  gerarLembretesTxtPorPerfil,
  obterNomesCurtosDesambiguados,
  extrairPrimeiroNome,
  isArquivoParecerGerencialReal,
} from '@/lib/motorPerfisOrganizadorPastas';
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
  obterListaProjetistas,
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

interface ArquivoMapeadoItem {
  id: string;
  nomeOriginal: string;
  extensao: string;
  fileObj: File;
  categoria: CategoriaDocPasta;
  isViti: boolean;
  origemGaveta?: boolean;
  origemSubpasta?: string;
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

// Converte a categoria universal para os códigos esperados pelo auditorInteligentePdfPasta.ts
function converterCategoriaParaAuditorPdf(cat: CategoriaDocPasta): string {
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
    ITEM_CAR: 'ITEM_13_CAR',
    ITEM_CONSULTA_CAR: 'ITEM_13_CONSULTA_CAR',
    ITEM_CAF: 'ITEM_14_CAF',
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
  };
  return mapa[cat] || cat;
}

const OPCOES_SELECT_CATEGORIA: Array<{
  grupo: string;
  itens: Array<{ valor: CategoriaDocPasta; label: string }>;
}> = [
  {
    grupo: '📂 Documentos do Projeto, Limite, Imóvel e Ambientais',
    itens: [
      {
        valor: 'ITEM_ARQ_ELETRONICO_PROJETO',
        label: 'ARQUIVO ELETRÔNICO (.PRONAF / .INVUR / .CUSTEIO)',
      },
      { valor: 'ITEM_PROJETO_PDF', label: 'PLANO / PROPOSTA / PROJETO (PDF)' },
      { valor: 'ITEM_CAPA_ANALISADOR', label: 'CAPA DO ANALISADOR' },
      { valor: 'ITEM_KML', label: 'ARQUIVO GEODÉSICO (.KML)' },
      {
        valor: 'ITEM_PLANILHA_GEODESICA',
        label: 'PLANILHA DE COORDENADAS GEODÉSICAS (CUSTEIO)',
      },
      {
        valor: 'ITEM_SOLICITACAO_LIMITE',
        label: 'SOLICITAÇÃO DE ABERTURA DE LIMITE (LCGH/LCGA)',
      },
      { valor: 'ITEM_CAF', label: 'DAP / CAF (RAIZ + CADASTRO)' },
      { valor: 'ITEM_EXTRATO_CAF', label: 'EXTRATO DA CAF (CONSULTA DO DIA)' },
      { valor: 'ITEM_CAR', label: 'CAR (CADASTRO AMBIENTAL RURAL)' },
      { valor: 'ITEM_CONSULTA_CAR', label: 'CONSULTA AO CAR / DEMONSTRATIVO' },
      {
        valor: 'ITEM_AUT_ALTERACAO',
        label: 'AUTORIZAÇÃO DE MODIFICAÇÃO / ALTERAÇÃO DO PROJETO',
      },
      {
        valor: 'ITEM_EMBARGOS_TITULAR',
        label: 'CERTIDÃO DE EMBARGOS (TITULAR)',
      },
      {
        valor: 'ITEM_EMBARGOS_CONJUGE',
        label: 'CERTIDÃO DE EMBARGOS (CÔNJUGE)',
      },
      { valor: 'ITEM_IMPROBIDADE_TITULAR', label: 'IMPROBIDADE CNJ (TITULAR)' },
      { valor: 'ITEM_IMPROBIDADE_CONJUGE', label: 'IMPROBIDADE CNJ (CÔNJUGE)' },
      { valor: 'ITEM_CND_PF', label: 'CND PESSOA FÍSICA (RECEITA FEDERAL)' },
      { valor: 'ITEM_CNDT_PF', label: 'CNDT (DÉBITOS TRABALHISTAS)' },
      { valor: 'ITEM_EXTRATO_SICOR', label: 'EXTRATO SICOR' },
      {
        valor: 'ITEM_CERT_SOCIO_COM_KML',
        label: 'CERTIFICAÇÃO SOCIOAMBIENTAL (COM KML)',
      },
      {
        valor: 'ITEM_CERT_SOCIO_SEM_KML',
        label: 'CERTIFICAÇÃO SOCIOAMBIENTAL (SEM KML / GARANTIA)',
      },
      { valor: 'ITEM_CREA', label: 'REGULARIDADE DO PROJETISTA (CREA / CFTA)' },
      { valor: 'ITEM_CONTRATO_ASSESSORIA', label: 'CONTRATO DE ASSESSORIA' },
      { valor: 'ITEM_CCIR', label: 'CCIR (ANO VIGENTE)' },
      { valor: 'ITEM_CND_ITR_IMOVEL', label: 'CND / ITR DO IMÓVEL' },
      {
        valor: 'ITEM_LAUDO_EXTERNO',
        label: 'LAUDO DE AVALIAÇÃO EXTERNO (PROJETISTA / CONVALIDAÇÃO)',
      },
      {
        valor: 'ITEM_LAUDO_INTERNO',
        label: 'LAUDO DE AVALIAÇÃO INTERNO DO BANCO (> R$ 600 MIL)',
      },
      { valor: 'ITEM_DCAA', label: 'DCAA (DISPENSA AMBIENTAL)' },
      { valor: 'ITEM_FICHA_SANITARIA', label: 'FICHA SANITÁRIA (AGED)' },
      { valor: 'ITEM_ORCAMENTO', label: 'CARTA-PROPOSTA / ORÇAMENTO' },
      {
        valor: 'ITEM_CONSOLIDADAS',
        label: 'DECLARAÇÕES CONSOLIDADAS (PRONAF OU PF)',
      },
      { valor: 'ITEM_DEC_AMBIENTAIS', label: 'DECLARAÇÕES AMBIENTAIS (GERAL)' },
      {
        valor: 'ITEM_DEC_REG_AMBIENTAL',
        label: 'DEC. DE REGULARIDADE AMBIENTAL',
      },
      {
        valor: 'ITEM_DEC_NAO_DESMATAMENTO',
        label: 'DEC. DE NÃO DESMATAMENTO APÓS 2008',
      },
      { valor: 'ITEM_DEC_RECOMPOSICAO', label: 'DEC. DE RECOMPOSIÇÃO DE RL' },
      {
        valor: 'ITEM_DEC_REG_AMB_GARANTIDOR',
        label: 'DEC. REG. AMB. DO IMÓVEL GARANTIDOR',
      },
      {
        valor: 'ITEM_DEC_OUTRA_AMBIENTAL',
        label: 'OUTRA DECLARAÇÃO AMBIENTAL / CAR',
      },
      {
        valor: 'ITEM_TITULO_DOMINIO',
        label: '4. TÍTULO DE DOMÍNIO (SUBSTITUI ECPV)',
      },
      {
        valor: 'ITEM_ECPV_ESCRITURA',
        label: '5. ECPV / ESCRITURA PÚBLICA DE COMPRA E VENDA',
      },
      {
        valor: 'ITEM_INTEIRO_TEOR',
        label: '6. INTEIRO TEOR DA MATRÍCULA (HISTÓRICO 15 ANOS)',
      },
      {
        valor: 'ITEM_SELO_IMOVEL',
        label: '6. SELO CORRESPONDENTE DO IMÓVEL (SELO 1, SELO 2...)',
      },
      {
        valor: 'ITEM_MEMORIAL_DESCRITIVO',
        label: '7. MEMORIAL DESCRITIVO DO IMÓVEL',
      },
      {
        valor: 'ITEM_AUT_DEBITO_CONTA',
        label: '14. AUTORIZAÇÃO DE DÉBITO EM CONTA (OPCIONAL)',
      },
      {
        valor: 'ITEM_CND_CONJUGE',
        label: 'CND PESSOA FÍSICA (CÔNJUGE)',
      },
      {
        valor: 'ITEM_CNDT_CONJUGE',
        label: 'CNDT TRABALHISTA (CÔNJUGE)',
      },
      {
        valor: 'ITEM_PLANO_ATIVIDADE_RURAL',
        label: 'PLANO DE ATIVIDADE RURAL (PDF)',
      },
      {
        valor: 'ITEM_DEC_NAO_TRABALHO_INFANTIL',
        label: 'DEC. DE NÃO TRABALHO INFANTIL',
      },
      {
        valor: 'ITEM_DOC_IMOVEL_GENERICO',
        label: 'DOC. DO IMÓVEL - XXXXX (NUMERAÇÃO INTEIRO TEOR)',
      },
      {
        valor: 'OUTROS_NAO_IDENTIFICADO',
        label: '📦 MOVER PARA SUBPASTA [OUTROS]',
      },
      { valor: 'ITEM_ESPELHO_UND', label: 'ESPELHO - RELATÓRIO DA UND' },
      { valor: 'ITEM_PARECER_TECNICO', label: 'PARECER TÉCNICO' },
      { valor: 'ITEM_RB_PA', label: 'RELAÇÃO DE BENEFICIÁRIOS (RB DO P.A.)' },
      { valor: 'ITEM_PARECER_GERENCIAL', label: 'PARECER GERENCIAL' },
      { valor: 'ITEM_PARECER_SEMA', label: 'PARECER DA SEMA' },
    ],
  },
  {
    grupo: '🪪 Subpasta CADASTRO (1 a 9)',
    itens: [
      {
        valor: 'CAD_1_IDENTIDADE_TITULAR',
        label: 'CAD 1. IDENTIDADE (TITULAR)',
      },
      {
        valor: 'CAD_1_IDENTIDADE_CONJUGE',
        label: 'CAD 1. IDENTIDADE (CÔNJUGE)',
      },
      {
        valor: 'CAD_1_IDENTIDADE_OUTRO',
        label: 'CAD 1. IDENTIDADE (PROCURADOR / AVALISTA)',
      },
      {
        valor: 'CAD_2_CERTIDAO_CASAMENTO',
        label: 'CAD 2. CERTIDÃO DE CASAMENTO',
      },
      {
        valor: 'CAD_3_COMP_ENDERECO',
        label: 'CAD 3. COMPROVANTE DE ENDEREÇO',
      },
      { valor: 'CAD_4_COMP_RENDA', label: 'CAD 4. COMPROVANTE DE RENDA' },
      {
        valor: 'CAD_5_PROPOSTA_CADASTRO',
        label: 'CAD 6. PROPOSTA DE CADASTRO (ACEITA VITI)',
      },
      { valor: 'CAD_6_PROCURACAO', label: 'CAD 7. PROCURAÇÃO' },
      {
        valor: 'CAD_8_SELO_CARTORIO',
        label: 'CAD 8. SELO DE FISCALIZAÇÃO CARTORÁRIA',
      },
      { valor: 'CAD_9_OUTROS_CADASTRO', label: 'CAD 9. OUTROS CADASTRAIS' },
    ],
  },
];

export default function ModalOrganizadorPastasCliente({
  aberto,
  onFechar,
  contratacoes,
  cardsKanban,
  onCadastrarPropostaNoPainel,
}: ModalOrganizadorPastasClienteProps) {
  const [abaAtiva, setAbaAtiva] = useState<'ORGANIZADOR' | 'COFRE'>(
    'ORGANIZADOR'
  );

  // Configuração do Perfil da Pasta (Porte, Escopo, Modalidade e Garantia)
  const [portePerfil, setPortePerfil] = useState<PorteOrganizador>('PRONAF_A');
  const [escopoPasta, setEscopoPasta] =
    useState<EscopoOperacaoPasta>('PRONAF_A_PADRAO');
  const [modalidadeDerivada, setModalidadeDerivada] =
    useState<ModalidadeDerivada>('INVESTIMENTO');
  const [modalidadeLimite, setModalidadeLimite] =
    useState<ModalidadeLimite>('LCGH');
  const [garantiaDerivada, setGarantiaDerivada] =
    useState<GarantiaDerivada>('SEM_GARANTIA');
  const [imovelAvaliadoAcima600k, setImovelAvaliadoAcima600k] = useState(false);

  // Dados dos Envolvidos
  const [buscaClienteRapida, setBuscaClienteRapida] = useState('');
  const [titularNome, setTitularNome] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [procuradorNome, setProcuradorNome] = useState('');
  const [avalistaNome, setAvalistaNome] = useState('');
  const [projetistaNome, setProjetistaNome] = useState('ZEZÃO');
  const [paNome, setPaNome] = useState('P.A LAGO DA CARNAÚBA');
  const [gerarTxtsLembretesFaltantes, setGerarTxtsLembretesFaltantes] =
    useState(true);

  // Estados de leitura da pasta local
  const [dirHandleRoot, setDirHandleRoot] = useState<any>(null);
  const [nomePastaSelecionada, setNomePastaSelecionada] = useState('');
  const [pastaJaEraOrganizada, setPastaJaEraOrganizada] = useState(false);
  const [arquivosMapeados, setArquivosMapeados] = useState<
    ArquivoMapeadoItem[]
  >([]);
  const [jaTemSeloNaSubpastaCadastro, setJaTemSeloNaSubpastaCadastro] =
    useState(false);
  const [
    jaTemProcuracaoOuCasamentoNoCadastro,
    setJaTemProcuracaoOuCasamentoNoCadastro,
  ] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Auditoria de PDFs
  const [auditoriaPdf, setAuditoriaPdf] =
    useState<ResultadoAuditoriaPastaPdf | null>(null);
  const [auditandoPdfs, setAuditandoPdfs] = useState(false);

  // Gaveta de Coringas na Nuvem
  const [coringasSalvos, setCoringasSalvos] = useState<
    CoringaGavetaNuvemItem[]
  >([]);
  const [statusSyncCofre, setStatusSyncCofre] = useState<
    'SINCRONIZADO' | 'SINCRONIZANDO'
  >('SINCRONIZADO');
  const [novoCoringaTipo, setNovoCoringaTipo] =
    useState<CoringaGavetaNuvemItem['tipo']>('PARECER_SEMA');
  const [novoCoringaChave, setNovoCoringaChave] = useState(
    'P.A LAGO DA CARNAÚBA'
  );

  // Listas vivas p/ integração com Kanban e Parecer Gerencial
  const [listaContratacoes, setListaContratacoes] = useState<
    RegistroContratacao[]
  >(() => contratacoes || []);
  const [listaCards, setListaCards] = useState<CardKanban[]>(
    () => cardsKanban || []
  );
  const [listaOpBase, setListaOpBase] = useState<OperacaoBaseDesembolso[]>([]);
  const [listaEventos, setListaEventos] = useState<EventoDesembolso[]>([]);

  const [modalIniciarProposta, setModalIniciarProposta] =
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

  const cfgPerfil: ConfiguracaoPerfilPasta = useMemo(
    () => ({
      porte: portePerfil,
      escopo:
        portePerfil === 'PRONAF_A' && escopoPasta !== 'LIMITE_PURO'
          ? 'PRONAF_A_PADRAO'
          : escopoPasta,
      modalidadeDerivada,
      modalidadeLimite,
      garantiaDerivada:
        portePerfil === 'PRONAF_A' ? 'SEM_GARANTIA' : garantiaDerivada,
      imovelAvaliadoAcima600k,
      titularNome,
      conjugeNome,
      procuradorNome,
      avalistaNome,
      projetistaNome,
      paOuImovelNome: paNome,
      imoveisExtraidosPdf:
        auditoriaPdf?.dadosProjetoParaParecer?.imoveisVinculados,
    }),
    [
      portePerfil,
      escopoPasta,
      modalidadeDerivada,
      modalidadeLimite,
      garantiaDerivada,
      imovelAvaliadoAcima600k,
      titularNome,
      conjugeNome,
      procuradorNome,
      avalistaNome,
      projetistaNome,
      paNome,
      auditoriaPdf,
    ]
  );

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

  // Obtém (ou cria recursivamente) qualquer subpasta como "LCGH/CERTIFICAÇÃO SOCIOAMBIENTAL"
  const obterSubpastaHandle = async (
    rootHandle: any,
    caminhoRelativo: string
  ) => {
    if (!caminhoRelativo) return rootHandle;
    const partes = caminhoRelativo.split('/').filter(Boolean);
    let atual = rootHandle;
    for (const p of partes) {
      atual = await atual.getDirectoryHandle(p, { create: true });
    }
    return atual;
  };

  // Grava o Parecer Gerencial extraído com o número exato do perfil ativo (20, 28, 29 ou 19)
  const gravarParecerGerencialRealNaPasta = async (conteudoTexto: string) => {
    if (!dirHandleRoot || !conteudoTexto.trim()) return;
    try {
      const destinosParecer = calcularTodosDestinosDoArquivo(
        {
          nomeOriginal: 'PARECER GERENCIAL - FALTA AJUSTAR.txt',
          extensao: 'txt',
          categoria: 'ITEM_PARECER_GERENCIAL',
          isViti: false,
        },
        cfgPerfil
      );

      for (const dest of destinosParecer) {
        const pastaAlvo = await obterSubpastaHandle(
          dirHandleRoot,
          dest.pastaRelativa
        );
        const nomeSeguro = dest.nomeArquivoFinal.replace(/[/:*?"<>|]/g, '-');
        const fh = await pastaAlvo.getFileHandle(nomeSeguro, { create: true });
        const wr = await fh.createWritable();
        await wr.write(conteudoTexto);
        await wr.close();

        // Remove eventual ".txt" de "FALTA PARECER GERENCIAL" daquela pasta
        for (const numP of ['19', '20', '28', '29']) {
          try {
            await pastaAlvo.removeEntry(
              `${numP}. FALTA PARECER GERENCIAL.txt`
            );
          } catch {
            // Ignora
          }
        }
      }

      setParecerGerencialExtraidoNaPasta(true);
      const exemploNome =
        destinosParecer[0]?.nomeArquivoFinal ||
        '20. PARECER GERENCIAL - FALTA AJUSTAR.txt';
      alert(
        `✅ Parecer completo salvo diretamente na pasta do cliente como:\n"${exemploNome}"!`
      );
    } catch (e) {
      console.error('Erro ao gravar parecer na pasta:', e);
    }
  };

  // PASSO 3: Salva o arquivo .KML com os polígonos matematicamente fechados direto na pasta do cliente!
  const salvarKmlCorrigidoDiretoNaPasta = async () => {
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
        `✅ Polígonos abertos do arquivo "${infoKml.nomeArquivo}" foram fechados e salvos diretamente na pasta do cliente!`
      );
      await escanearHandleDaPasta(dirHandleRoot);
    } catch (e) {
      console.error('Erro ao gravar KML corrigido na pasta:', e);
      alert('❌ Não foi possível gravar o KML corrigido na pasta.');
    }
  };

  // Se o utilizador fechar/saltar a etapa do Parecer sem extrair, grava o "<Nº>. FALTA PARECER GERENCIAL.txt"
  const handleFecharOverlayParecer = async () => {
    const jaTinhaParecerNaPasta = arquivosMapeados.some(
      (a) => a.categoria === 'ITEM_PARECER_GERENCIAL'
    );

    if (
      !parecerGerencialExtraidoNaPasta &&
      !jaTinhaParecerNaPasta &&
      gerarTxtsLembretesFaltantes &&
      dirHandleRoot
    ) {
      for (const lemb of planoLembretesTxt) {
        if (lemb.nomeArquivoTxt.includes('FALTA PARECER GERENCIAL')) {
          try {
            const pastaAlvo = await obterSubpastaHandle(
              dirHandleRoot,
              lemb.pastaRelativa
            );
            const fh = await pastaAlvo.getFileHandle(lemb.nomeArquivoTxt, {
              create: true,
            });
            const wr = await fh.createWritable();
            await wr.write('');
            await wr.close();
          } catch {
            // Ignora
          }
        }
      }
    }
    setCardOverlayParecerId(null);
  };

  useEffect(() => {
    if (
      !cardOverlayParecerId ||
      !dirHandleRoot ||
      typeof window === 'undefined'
    ) {
      return;
    }
    const win = window as unknown as {
      __salvarParecerDiretoNaPastaOrganizador?: (
        conteudo: string
      ) => Promise<void>;
    };
    win.__salvarParecerDiretoNaPastaOrganizador = async (
      conteudoTexto: string
    ) => {
      await gravarParecerGerencialRealNaPasta(conteudoTexto);
    };
    return () => {
      delete win.__salvarParecerDiretoNaPastaOrganizador;
    };
  }, [cardOverlayParecerId, dirHandleRoot, cfgPerfil]);

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
        const primIt = extrairPrimeiroNome(nIt);
        return (
          nIt === nomeLimpo ||
          nIt.startsWith(nomeLimpo) ||
          nomeLimpo.startsWith(nIt) ||
          (nomeLimpo.split(/\s+/).length === 1 && primIt === nomeLimpo)
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
      porte: PorteOrganizador;
      escopoSugerido: EscopoOperacaoPasta;
      modDerivada: ModalidadeDerivada;
      modLimite: ModalidadeLimite;
      garDerivada: GarantiaDerivada;
    }> = [];

    todosItensConformidadePronafA.forEach((it) => {
      lista.push({
        label: `${it.nomeCliente.toUpperCase()} (Conformidade PRONAF A)`,
        titular: it.nomeCliente.toUpperCase(),
        conjuge: it.conjugeNome.toUpperCase(),
        procurador: it.procuradorNome.toUpperCase(),
        avalista: '',
        projetista: '',
        porte: 'PRONAF_A',
        escopoSugerido: 'PRONAF_A_PADRAO',
        modDerivada: 'INVESTIMENTO',
        modLimite: 'LCGH',
        garDerivada: 'SEM_GARANTIA',
      });
    });

    // Agrupa operações por cliente na aba Contratações para detectar automaticamente se tem Derivada + Limite (Combo)!
    const porCliente = new Map<string, RegistroContratacao[]>();
    listaContratacoes.forEach((c) => {
      const ch = c.cliente.toUpperCase().trim();
      if (!ch) return;
      if (!porCliente.has(ch)) porCliente.set(ch, []);
      porCliente.get(ch)!.push(c);
    });

    porCliente.forEach((ops, nomeCli) => {
      const prim = ops[0];
      const prtUp = (prim.porte || '').toUpperCase();
      const porteDet: PorteOrganizador = prtUp.includes('PRONAF A')
        ? 'PRONAF_A'
        : prtUp.includes('PRONAF')
        ? 'PRONAF_V'
        : 'MINI_PEQUENO';

      const opLim = ops.find((o) =>
        ['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
      );
      const opDer = ops.find(
        (o) => !['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
      );

      let escopoSug: EscopoOperacaoPasta =
        porteDet === 'PRONAF_A' ? 'PRONAF_A_PADRAO' : 'DERIVADA_PURA';
      if (opLim && opDer && porteDet !== 'PRONAF_A') {
        escopoSug = 'COMBO_DERIVADA_E_LIMITE';
      } else if (opLim && !opDer) {
        escopoSug = 'LIMITE_PURO';
      }

      const modDer: ModalidadeDerivada = (opDer?.tipo || '')
        .toUpperCase()
        .includes('CUSTEIO')
        ? 'CUSTEIO'
        : 'INVESTIMENTO';
      const modLim: ModalidadeLimite =
        (opLim?.tipo || '').toUpperCase().trim() === 'LCGA' ? 'LCGA' : 'LCGH';
      const garDer: GarantiaDerivada =
        opLim ||
        ['LCGH', 'LCGA'].includes(
          (opDer?.tipoGarantiaKanban || '').toUpperCase()
        )
          ? 'LCGH_LCGA'
          : opDer?.avalistaNome || opDer?.tipoGarantiaKanban === 'AVAL'
          ? 'AVAL'
          : 'SEM_GARANTIA';

      lista.push({
        label: `${nomeCli} (${prim.porte || 'Carteira'} • ${ops
          .map((o) => o.tipo)
          .join(' + ')})`,
        titular: nomeCli,
        conjuge: '',
        procurador: '',
        avalista: prim.avalistaNome || '',
        projetista: prim.projetista || '',
        porte: porteDet,
        escopoSugerido: escopoSug,
        modDerivada: modDer,
        modLimite: modLim,
        garDerivada: garDer,
      });
    });

    return lista;
  }, [todosItensConformidadePronafA, listaContratacoes]);

  const autodetectarDadosPelosArquivos = (
    files: File[],
    nomeDaPastaRaiz?: string
  ) => {
    let titDetectado = titularNome;
    let conjDetectado = conjugeNome;
    let procDetectado = procuradorNome;
    let paDetectado = paNome;
    let projDetectado = projetistaNome;
    let porteSugerido: PorteOrganizador | null = null;
    let modDerivSugerida: ModalidadeDerivada | null = null;
    let achouDocLimite = false;
    let achouDocDerivada = false;

    files.forEach((f) => {
      if (!f || !f.name) return;
      const up = f.name.toUpperCase();

      if (up.includes('.PRONAF_A')) {
        porteSugerido = 'PRONAF_A';
        achouDocDerivada = true;
      } else if (up.includes('.PRONAF')) {
        if (!porteSugerido) porteSugerido = 'PRONAF_V';
        achouDocDerivada = true;
      } else if (up.includes('.INVUR')) {
        porteSugerido = 'MINI_PEQUENO';
        achouDocDerivada = true;
      }
      if (up.includes('.CUSTEIO')) {
        modDerivSugerida = 'CUSTEIO';
        achouDocDerivada = true;
      }
      if (
        up.includes('SOLICITACAO DE ABERTURA') ||
        up.includes('SOLICITACAO DE LIMITE') ||
        up.includes('SOLICITACAO DO LIMITE')
      ) {
        achouDocLimite = true;
      }

      if (
        up.includes('.PRONAF') ||
        up.includes('.INVUR') ||
        up.includes('.CUSTEIO')
      ) {
        const limpo = up
          .split(/\.(?:PRONAF|INVUR|CUSTEIO)/)[0]
          .replace(/^\d+\.\s*PROJETO\s*[-–]\s*/, '')
          .trim();
        if (limpo && !titDetectado) titDetectado = limpo;
      }
      const matchTraco = up.match(
        /_-_\s*([A-ZÀ-Ú_ ]+?)(?:_ASSINADO|\.PDF|\s*\()/i
      );
      if (matchTraco && matchTraco[1] && !titDetectado) {
        titDetectado = matchTraco[1].replace(/_/g, ' ').trim();
      }
      const matchJaOrg = up.match(
        /^\d+(?:\.\d+)?\.\s*(?:PROJETO|DECLARA[ÇC][ÕO]ES CONSOLIDADAS|CONTRATO DE ASSESSORIA|CAF|DCAA)\s*[-–]\s*([A-ZÀ-Ú ]+?)\.(?:PDF|PRONAF|INVUR)/i
      );
      if (matchJaOrg && matchJaOrg[1] && !titDetectado) {
        titDetectado = matchJaOrg[1].trim();
      }
      const matchPa = up.match(
        /(P\.?A\.?\s+[A-ZÀ-Ú0-9 ]+?)(?:_COMPRESSED|_ASSINADO|\.PDF|$)/i
      );
      if (matchPa && matchPa[1]) {
        paDetectado = matchPa[1].replace(/^PA\s+/i, 'P.A ').trim();
      }
      const matchCrea = up.match(
        /CREA\s*[-–]\s*([A-ZÀ-Ú0-9_ ]+?)(?:\.PDF|$)/i
      );
      if (matchCrea && matchCrea[1]) {
        projDetectado = matchCrea[1].trim();
      }
    });

    if (!titDetectado && nomeDaPastaRaiz) {
      const limpoPasta = nomeDaPastaRaiz
        .replace(/^\d+\s*[-–.]\s*/, '')
        .toUpperCase()
        .trim();
      if (limpoPasta.length >= 3) titDetectado = limpoPasta;
    }

    if (titDetectado) {
      const normTit = removerAcentos(titDetectado).toUpperCase().trim();
      const encConf = todosItensConformidadePronafA.find((it) => {
        const nIt = removerAcentos(it.nomeCliente).toUpperCase().trim();
        return (
          nIt === normTit ||
          (normTit.split(/\s+/).length === 1 &&
            extrairPrimeiroNome(nIt) === extrairPrimeiroNome(normTit))
        );
      });
      if (encConf) {
        titDetectado = encConf.nomeCliente.toUpperCase().trim();
        if (encConf.conjugeNome)
          conjDetectado = encConf.conjugeNome.toUpperCase().trim();
        if (encConf.procuradorNome)
          procDetectado = encConf.procuradorNome.toUpperCase().trim();
        porteSugerido = 'PRONAF_A';
      }
    }

    const primTit = extrairPrimeiroNome(titDetectado || titularNome);
    files.forEach((f) => {
      if (!f || !f.name) return;
      const up = removerAcentos(f.name)
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
        if (primResto && primResto !== primTit && !conjDetectado) {
          conjDetectado = resto;
        }
      }
    });

    const titFinal = titDetectado || titularNome;
    const conjFinal = conjugeNome || conjDetectado;
    const procFinal = procuradorNome || procDetectado;

    if (titFinal) setTitularNome(titFinal);
    setConjugeNome(conjFinal);
    setProcuradorNome(procFinal);
    if (paDetectado) setPaNome(paDetectado);
    if (projDetectado) setProjetistaNome(projDetectado);

    let escopoFinal = escopoPasta;
    if (porteSugerido) {
      setPortePerfil(porteSugerido);
      if (porteSugerido === 'PRONAF_A') {
        escopoFinal = 'PRONAF_A_PADRAO';
        setEscopoPasta('PRONAF_A_PADRAO');
      } else if (achouDocLimite && achouDocDerivada) {
        escopoFinal = 'COMBO_DERIVADA_E_LIMITE';
        setEscopoPasta('COMBO_DERIVADA_E_LIMITE');
      } else if (achouDocLimite && !achouDocDerivada) {
        escopoFinal = 'LIMITE_PURO';
        setEscopoPasta('LIMITE_PURO');
      } else if (escopoPasta === 'PRONAF_A_PADRAO') {
        escopoFinal = 'DERIVADA_PURA';
        setEscopoPasta('DERIVADA_PURA');
      }
    }
    if (modDerivSugerida) setModalidadeDerivada(modDerivSugerida);

    return {
      primTit: extrairPrimeiroNome(titFinal),
      primConj: extrairPrimeiroNome(conjFinal),
      paDetectado,
      projDetectado,
      escopoFinal,
      porteFinal: porteSugerido || portePerfil,
    };
  };

  // Blindado: aceita tanto Array<{ file: File; origemSubpasta?: string }> quanto File[]
  const processarArquivosLidos = (
    entradasBrutas: Array<{ file: File; origemSubpasta?: string } | File>,
    primTit: string,
    primConj: string,
    projAtual: string,
    paAtual: string,
    escopoAtivo: EscopoOperacaoPasta = escopoPasta,
    porteAtivo: PorteOrganizador = portePerfil
  ) => {
    const entradasNormalizadas: Array<{
      file: File;
      origemSubpasta?: string;
    }> = [];

    for (const item of entradasBrutas || []) {
      if (item instanceof File && item.name) {
        entradasNormalizadas.push({ file: item });
      } else if (
        item &&
        typeof item === 'object' &&
        'file' in item &&
        item.file &&
        item.file.name
      ) {
        entradasNormalizadas.push({
          file: item.file,
          origemSubpasta: item.origemSubpasta,
        });
      }
    }

    const entradasFiltradas = entradasNormalizadas.filter(({ file }) => {
      const nomeUp = file.name.toUpperCase().trim();
      if (nomeUp.startsWith('- CERT') || nomeUp.startsWith('-CERT')) {
        return false;
      }
      const isTxt = nomeUp.endsWith('.TXT');
      if (!isTxt) return true;
      return isArquivoParecerGerencialReal(file.name);
    });

    const mapeadosBrutos: ArquivoMapeadoItem[] = entradasFiltradas.map(
      ({ file, origemSubpasta }, idx) => {
        const partes = file.name.split('.');
        const ext = partes.length > 1 ? partes.pop() || 'pdf' : '';
        const classif = classificarArquivoUniversal(
          file.name,
          primTit,
          primConj,
          escopoAtivo,
          auditoriaPdf?.dadosProjetoParaParecer?.imoveisVinculados
        );
        return {
          id: `arq_${idx}_${Date.now()}`,
          nomeOriginal: file.name,
          extensao: ext,
          fileObj: file,
          categoria: classif.categoria,
          isViti: classif.isViti,
          origemSubpasta,
          subtipoAmbientalExtra: classif.subtipoAmbientalExtra,
        };
      }
    );

    // Ordena do arquivo MAIS RECENTE para o mais antigo (lastModified decrescente)!
    // Assim, se houver mais de 1 CND, CNDT, Embargos, Improbidade, S400, SICOR, etc., prevalece sempre o mais recente!
    const mapeadosOrdenadosRecentes = [...mapeadosBrutos].sort(
      (a, b) => (b.fileObj.lastModified || 0) - (a.fileObj.lastModified || 0)
    );

    const vistosPorChave = new Set<string>();
    const mapeados: ArquivoMapeadoItem[] = [];
    mapeadosOrdenadosRecentes.forEach((m) => {
      const permiteMultiplosArquivos =
        m.categoria === 'OUTROS_NAO_IDENTIFICADO' ||
        m.categoria === 'CAD_9_OUTROS_CADASTRO' ||
        m.categoria === 'CAD_8_SELO_CARTORIO' ||
        m.categoria === 'ITEM_DEC_OUTRA_AMBIENTAL' ||
        m.categoria === 'ITEM_KML' ||
        m.categoria === 'ITEM_PLANILHA_GEODESICA' ||
        m.categoria === 'ITEM_CERT_SOCIO_COM_KML' ||
        m.categoria === 'ITEM_CERT_SOCIO_SEM_KML' ||
        m.categoria === 'ITEM_DOC_IMOVEL_GENERICO' ||
        m.categoria === 'ITEM_INTEIRO_TEOR' ||
        m.categoria === 'ITEM_SELO_IMOVEL' ||
        m.categoria === 'ITEM_MEMORIAL_DESCRITIVO' ||
        m.categoria === 'ITEM_TITULO_DOMINIO' ||
        m.categoria === 'ITEM_ECPV_ESCRITURA' ||
        m.categoria === 'ITEM_LAUDO_INTERNO' ||
        m.categoria === 'ITEM_LAUDO_EXTERNO' ||
        m.categoria === 'ITEM_CAR' ||
        m.categoria === 'ITEM_CONSULTA_CAR' ||
        m.categoria === 'ITEM_CCIR' ||
        m.categoria === 'ITEM_CND_ITR_IMOVEL';

      const chaveUnica = permiteMultiplosArquivos
        ? `${m.categoria}_${m.nomeOriginal}`
        : `${m.categoria}_${m.isViti ? 'VITI' : 'DOC'}`;

      if (!vistosPorChave.has(chaveUnica)) {
        vistosPorChave.add(chaveUnica);
        mapeados.push(m);
      }
    });

    const jaTemCrea = mapeados.some((m) => m.categoria === 'ITEM_CREA');
    const jaTemRb = mapeados.some((m) => m.categoria === 'ITEM_RB_PA');
    const jaTemSema = mapeados.some((m) => m.categoria === 'ITEM_PARECER_SEMA');
    const jaTemCar = mapeados.some((m) => m.categoria === 'ITEM_CAR');

    if (!jaTemCrea && projAtual && escopoAtivo !== 'LIMITE_PURO') {
      const coringaCrea = coringasSalvos.find(
        (c) =>
          c.tipo === 'CREA_PROJETISTA' &&
          c.chaveReferencia.toUpperCase().trim() ===
            projAtual.toUpperCase().trim()
      );
      if (coringaCrea) {
        const bufferCoringa = base64ParaArrayBuffer(coringaCrea.base64Dados);
        mapeados.push({
          id: `coringa_crea_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaCrea.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: new File([bufferCoringa], coringaCrea.nomeArquivoOriginal, {
            type: 'application/pdf',
          }),
          categoria: 'ITEM_CREA',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    if (!jaTemRb && paAtual && porteAtivo === 'PRONAF_A') {
      const coringaRb = coringasSalvos.find(
        (c) =>
          c.tipo === 'RB_PA' &&
          removerAcentos(c.chaveReferencia).toUpperCase().trim() ===
            removerAcentos(paAtual).toUpperCase().trim()
      );
      if (coringaRb) {
        const bufferCoringa = base64ParaArrayBuffer(coringaRb.base64Dados);
        mapeados.push({
          id: `coringa_rb_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaRb.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: new File([bufferCoringa], coringaRb.nomeArquivoOriginal, {
            type: 'application/pdf',
          }),
          categoria: 'ITEM_RB_PA',
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
        mapeados.push({
          id: `coringa_car_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaCar.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: new File([bufferCoringa], coringaCar.nomeArquivoOriginal, {
            type: 'application/pdf',
          }),
          categoria: 'ITEM_CAR',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    if (!jaTemSema && porteAtivo === 'PRONAF_A') {
      const coringaSema = coringasSalvos.find((c) => c.tipo === 'PARECER_SEMA');
      if (coringaSema) {
        const bufferCoringa = base64ParaArrayBuffer(coringaSema.base64Dados);
        mapeados.push({
          id: `coringa_sema_${Date.now()}`,
          nomeOriginal: `[GAVETA NUVEM] ${coringaSema.nomeArquivoOriginal}`,
          extensao: 'pdf',
          fileObj: new File([bufferCoringa], coringaSema.nomeArquivoOriginal, {
            type: 'application/pdf',
          }),
          categoria: 'ITEM_PARECER_SEMA',
          isViti: false,
          origemGaveta: true,
        });
      }
    }

    setArquivosMapeados(mapeados);
  };

  useEffect(() => {
    if (arquivosMapeados.length === 0) {
      setAuditoriaPdf(null);
      return;
    }

    let cancelado = false;
    setAuditandoPdfs(true);

    executarAuditoriaCompletaDosPdfsDaPasta({
      arquivos: arquivosMapeados.map((m) => ({
        fileObj: m.fileObj,
        categoria: converterCategoriaParaAuditorPdf(m.categoria),
        isViti: m.isViti,
        nomeOriginal: m.nomeOriginal,
      })),
      titularNome: nomesCurtos.titular,
      conjugeNome: nomesCurtos.conjuge,
      paEsperado: paNome,
      contaConformidade:
        portePerfil === 'PRONAF_A'
          ? registroConformidadeVinculado?.contaCorrente
          : undefined,
      porteSelecionado: portePerfil,
      escopoSelecionado: cfgPerfil.escopo,
      modalidadeDerivada,
    })
      .then((resAuditoria) => {
        if (cancelado) return;
        setAuditoriaPdf(resAuditoria);

        // PARTE 7.1 + PASSO 3: Reclassificação Semântica pelo Conteúdo Interno do PDF (mesmo com nome de arquivo bagunçado!)
        if (
          resAuditoria.reclassificacoesPorConteudo ||
          resAuditoria.reclassificacoesSocioambiental
        ) {
          const mapaConteudo = resAuditoria.reclassificacoesPorConteudo || {};
          const mapaSocio = resAuditoria.reclassificacoesSocioambiental || {};

          setArquivosMapeados((prev) => {
            let mudouAlgum = false;
            const novaLista = prev.map((item) => {
              if (item.categoria === 'IGNORAR' || item.isViti) return item;

              const novaCatSocio = mapaSocio[item.nomeOriginal];
              if (
                novaCatSocio &&
                (item.categoria === 'ITEM_CERT_SOCIO_COM_KML' ||
                  item.categoria === 'ITEM_CERT_SOCIO_SEM_KML') &&
                item.categoria !== novaCatSocio
              ) {
                mudouAlgum = true;
                return { ...item, categoria: novaCatSocio };
              }

              const novaCatConteudo = mapaConteudo[
                item.nomeOriginal
              ] as CategoriaDocPasta | undefined;
              // Reclassifica pelo conteúdo sempre que o nome do arquivo não tinha sido identificado (OUTROS)
              // ou quando era uma declaração/certidão genérica!
              if (
                novaCatConteudo &&
                item.categoria !== novaCatConteudo &&
                (item.categoria === 'OUTROS_NAO_IDENTIFICADO' ||
                  item.categoria === 'CAD_9_OUTROS_CADASTRO' ||
                  item.categoria === 'ITEM_DEC_AMBIENTAIS' ||
                  item.categoria === 'ITEM_DEC_OUTRA_AMBIENTAL')
              ) {
                mudouAlgum = true;
                return { ...item, categoria: novaCatConteudo };
              }
              return item;
            });
            return mudouAlgum ? novaLista : prev;
          });
        }

        if (resAuditoria.valorPropostaDetectado) {
          setCadValor(resAuditoria.valorPropostaDetectado);
        }
        if (resAuditoria.projetistaCurtoDetectado) {
          setProjetistaNome(resAuditoria.projetistaCurtoDetectado);
          setCadProjetista(resAuditoria.projetistaCurtoDetectado);
        }
        if (resAuditoria.conjugeDetectadoNosPdfs && !conjugeNome) {
          setConjugeNome(resAuditoria.conjugeDetectadoNosPdfs);
        }

        const dPdf = resAuditoria.dadosProjetoParaParecer;
        if (dPdf && procuradorNome.trim()) {
          dPdf.procuradorNomeExtraido = procuradorNome.toUpperCase().trim();
          salvarDadosExtraidosParaParecer(dPdf);
        }
        if (dPdf?.imovelAvaliadoAcima600kDetectado) {
          setImovelAvaliadoAcima600k(true);
        }
        if (
          dPdf.imoveisVinculados.some((im) => im.compoeGarantia) &&
          portePerfil !== 'PRONAF_A'
        ) {
          setGarantiaDerivada('LCGH_LCGA');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setAuditandoPdfs(false);
      });

    return () => {
      cancelado = true;
    };
  }, [
    arquivosMapeados,
    portePerfil,
    cfgPerfil.escopo,
    modalidadeDerivada,
    paNome,
  ]);

  // Varredura recursiva tolerante a falhas de arquivos temporários do Windows/OneDrive
  const escanearHandleDaPasta = async (handle: any) => {
    setDirHandleRoot(handle);
    setNomePastaSelecionada(handle.name);
    setParecerGerencialExtraidoNaPasta(false);

    const entradasLidas: Array<{ file: File; origemSubpasta?: string }> = [];
    let achouSeloNoSubCadastro = false;
    let achouProcOuCasamentoNoSubCadastro = false;
    let tinhaSubpastaOrganizada = false;

    const PASTAS_PADRAO_SISTEMA = new Set([
      'CADASTRO',
      'LCGH',
      'LCGA',
      'INVESTIMENTO',
      'CUSTEIO',
      'CERTIFICAÇÃO SOCIOAMBIENTAL',
      'DOCUMENTAÇÃO DO(S) IMÓVEL(IS)',
      'OUTROS',
    ]);

    const varrerDiretorioRecursivo = async (
      dirAtual: any,
      caminhoRelativo: string,
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
              entradasLidas.push({
                file,
                origemSubpasta: caminhoRelativo || undefined,
              });

              if (caminhoRelativo.toUpperCase().includes('CADASTRO')) {
                const upSub = removerAcentos(entryName).toUpperCase();
                if (/\bSELOS?\b/.test(upSub)) achouSeloNoSubCadastro = true;
                if (
                  upSub.includes('PROCURACAO') ||
                  upSub.includes('CASAMENTO')
                ) {
                  achouProcOuCasamentoNoSubCadastro = true;
                }
              }
            } catch (errFile) {
              console.warn(
                `Arquivo ignorado durante leitura (${entryName}):`,
                errFile
              );
            }
          } else if (entryHandle.kind === 'directory') {
            const upDir = entryName.toUpperCase().trim();
            if (PASTAS_PADRAO_SISTEMA.has(upDir)) {
              tinhaSubpastaOrganizada = true;
            }
            const novoCaminho = caminhoRelativo
              ? `${caminhoRelativo}/${entryName}`
              : entryName;
            await varrerDiretorioRecursivo(
              entryHandle,
              novoCaminho,
              profundidade + 1
            );
          }
        }
      } catch (errDir) {
        console.warn(
          `Subpasta ignorada durante leitura (${caminhoRelativo}):`,
          errDir
        );
      }
    };

    await varrerDiretorioRecursivo(handle, '', 0);

    setPastaJaEraOrganizada(tinhaSubpastaOrganizada);
    setJaTemSeloNaSubpastaCadastro(achouSeloNoSubCadastro);
    setJaTemProcuracaoOuCasamentoNoCadastro(achouProcOuCasamentoNoSubCadastro);

    const todosFiles = entradasLidas.map((e) => e.file);
    const detectados = autodetectarDadosPelosArquivos(todosFiles, handle.name);
    processarArquivosLidos(
      entradasLidas,
      detectados.primTit,
      detectados.primConj,
      detectados.projDetectado || projetistaNome,
      detectados.paDetectado,
      detectados.escopoFinal,
      detectados.porteFinal
    );
  };

  // ITEM 3: Limpa completamente a pasta carregada, os campos do cliente e o cache do projeto para iniciar outra pasta do zero
  const limparConsultaOrganizadorDoZero = () => {
    setDirHandleRoot(null);
    setNomePastaSelecionada('');
    setPastaJaEraOrganizada(false);
    setArquivosMapeados([]);
    setAuditoriaPdf(null);
    setAuditandoPdfs(false);
    setJaTemSeloNaSubpastaCadastro(false);
    setJaTemProcuracaoOuCasamentoNoCadastro(false);
    setParecerGerencialExtraidoNaPasta(false);
    setBuscaClienteRapida('');
    setTitularNome('');
    setConjugeNome('');
    setProcuradorNome('');
    setAvalistaNome('');
    setCadCpf('');
    setCadValor('');
    setImovelAvaliadoAcima600k(false);
    limparCacheDadosProjetoParecer();
  };

  const selecionarPastaNoComputador = async () => {
    const win = window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: string }) => Promise<any>;
    };
    if (!win.showDirectoryPicker) {
      alert(
        '⚠️ Seu navegador atual não suporta acesso direto a pastas locais. Use o Google Chrome ou Microsoft Edge no computador!'
      );
      return;
    }

    let handle: any = null;
    try {
      handle = await win.showDirectoryPicker({ mode: 'readwrite' });
    } catch (errPick: unknown) {
      if (errPick instanceof Error && errPick.name === 'AbortError') return;
      try {
        handle = await win.showDirectoryPicker();
      } catch (errFallback: unknown) {
        if (errFallback instanceof Error && errFallback.name === 'AbortError')
          return;
        const detalhe =
          errFallback instanceof Error ? errFallback.message : String(errFallback);
        alert(`❌ O navegador bloqueou o acesso à pasta: ${detalhe}`);
        return;
      }
    }

    if (!handle) return;

    try {
      await escanearHandleDaPasta(handle);
    } catch (errScan: unknown) {
      console.error('Erro detalhado ao escanear pasta:', errScan);
      const detalhe =
        errScan instanceof Error ? errScan.message : String(errScan);
      alert(`❌ Erro ao processar os arquivos da pasta: ${detalhe}`);
    }
  };

  // Ordena a lista de arquivos exatamente pela numeração do Perfil Ativo!
  const arquivosMapeadosOrdenados = useMemo(() => {
    return [...arquivosMapeados].sort((a, b) => {
      const destA = calcularTodosDestinosDoArquivo(a, cfgPerfil);
      const destB = calcularTodosDestinosDoArquivo(b, cfgPerfil);
      const ordA = destA.length > 0 ? destA[0].ordemExibicao : 999;
      const ordB = destB.length > 0 ? destB[0].ordemExibicao : 999;
      if (ordA !== ordB) return ordA - ordB;
      return a.nomeOriginal.localeCompare(b.nomeOriginal);
    });
  }, [arquivosMapeados, cfgPerfil]);

  const planoLembretesTxt = useMemo(() => {
    const catsPresentes = new Set(arquivosMapeados.map((a) => a.categoria));
    return gerarLembretesTxtPorPerfil({
      categoriasPresentes: catsPresentes,
      cfg: cfgPerfil,
      registroConformidadePronafA:
        cfgPerfil.porte === 'PRONAF_A' ? registroConformidadeVinculado : null,
      jaTemSeloNoCadastro: jaTemSeloNaSubpastaCadastro,
      jaTemProcuracaoOuCasamentoNoCadastro,
      parecerGerencialExtraidoNaPasta,
    });
  }, [
    arquivosMapeados,
    cfgPerfil,
    registroConformidadeVinculado,
    jaTemSeloNaSubpastaCadastro,
    jaTemProcuracaoOuCasamentoNoCadastro,
    parecerGerencialExtraidoNaPasta,
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
      const gravadosPorPasta = new Map<string, Set<string>>();

      const registrarArquivoPreservado = (
        caminhoRelativo: string,
        nomeArq: string
      ) => {
        const chavePasta = (caminhoRelativo || '').toUpperCase().trim();
        if (!gravadosPorPasta.has(chavePasta)) {
          gravadosPorPasta.set(chavePasta, new Set());
        }
        gravadosPorPasta.get(chavePasta)!.add(nomeArq);
      };

      const gravarEmSubpasta = async (
        caminhoRelativo: string,
        nomeArq: string,
        conteudo: ArrayBuffer | string
      ) => {
        const pastaHandle = await obterSubpastaHandle(
          dirHandleRoot,
          caminhoRelativo
        );
        const nomeSeguro = nomeArq.replace(/[/:*?"<>|]/g, '-');
        const fileHandle = await pastaHandle.getFileHandle(nomeSeguro, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(conteudo);
        await writable.close();

        registrarArquivoPreservado(caminhoRelativo, nomeSeguro);
        return nomeSeguro;
      };

      // Função de leitura resiliente: se o File em cache expirou após uma organização anterior,
      // busca o File atualizado diretamente pelo FileHandle da pasta!
      const lerBufferSeguroDoItem = async (
        item: ArquivoMapeadoItem
      ): Promise<ArrayBuffer | null> => {
        try {
          return await item.fileObj.arrayBuffer();
        } catch {
          try {
            const pastaOrigemHandle = await obterSubpastaHandle(
              dirHandleRoot,
              item.origemSubpasta || ''
            );
            const fh = await pastaOrigemHandle.getFileHandle(
              item.nomeOriginal,
              { create: false }
            );
            const freshFile = await fh.getFile();
            return await freshFile.arrayBuffer();
          } catch (errReleitura) {
            console.warn(
              `Arquivo já movido ou inacessível (${item.nomeOriginal}):`,
              errReleitura
            );
            return null;
          }
        }
      };

      // 1. Limpa recursivamente antigos .txt de lembretes na raiz e em todas as subpastas (preservando o Parecer Gerencial real!)
      const limparTxtsAntigosRecursivo = async (
        hPasta: any,
        profundidade = 0
      ) => {
        if (profundidade > 3) return;
        try {
          for await (const [entryName, entryHandle] of hPasta.entries()) {
            if (
              entryHandle.kind === 'file' &&
              entryName.toLowerCase().endsWith('.txt') &&
              !isArquivoParecerGerencialReal(entryName)
            ) {
              try {
                await hPasta.removeEntry(entryName);
              } catch {
                // Ignora
              }
            } else if (entryHandle.kind === 'directory') {
              await limparTxtsAntigosRecursivo(entryHandle, profundidade + 1);
            }
          }
        } catch {
          // Ignora pasta bloqueada
        }
      };

      await limparTxtsAntigosRecursivo(dirHandleRoot, 0);

      // 2. Processa cada arquivo, PULANDO os destinos que já estão organizados no lugar certo!
      let qtdArquivosMovidosOuRenomeados = 0;

      for (const item of arquivosMapeados) {
        if (item.categoria === 'IGNORAR') continue;
        const destinos = calcularTodosDestinosDoArquivo(item, cfgPerfil);
        if (destinos.length === 0) continue;

        const pastaOrigemNorm = (item.origemSubpasta || '')
          .toUpperCase()
          .trim();

        // Verifica quais destinos realmente precisam ser gravados
        const destinosPendentes: typeof destinos = [];
        for (const dest of destinos) {
          const nomeSeguro = dest.nomeArquivoFinal.replace(/[/:*?"<>|]/g, '-');
          const pastaDestNorm = (dest.pastaRelativa || '').toUpperCase().trim();

          // Se o arquivo já está exatamente nessa pasta e com esse mesmo nome, não regrava!
          if (
            !item.origemGaveta &&
            pastaOrigemNorm === pastaDestNorm &&
            item.nomeOriginal === nomeSeguro
          ) {
            registrarArquivoPreservado(dest.pastaRelativa, nomeSeguro);
            continue;
          }

          // Se for um arquivo da Gaveta e já existir na subpasta de destino, não precisa sobrescrever
          if (item.origemGaveta) {
            try {
              const pH = await obterSubpastaHandle(
                dirHandleRoot,
                dest.pastaRelativa
              );
              await pH.getFileHandle(nomeSeguro, { create: false });
              registrarArquivoPreservado(dest.pastaRelativa, nomeSeguro);
              continue;
            } catch {
              // Ainda não existe na pasta, vai gravar abaixo
            }
          }

          destinosPendentes.push(dest);
        }

        let bufferCache: ArrayBuffer | null = null;

        if (destinosPendentes.length > 0) {
          bufferCache = await lerBufferSeguroDoItem(item);
          if (bufferCache) {
            for (const dest of destinosPendentes) {
              await gravarEmSubpasta(
                dest.pastaRelativa,
                dest.nomeArquivoFinal,
                bufferCache
              );
              qtdArquivosMovidosOuRenomeados++;
            }
          }
        }

        // No PRONAF A, garante a cópia "- CERT. SOCIOAMBIENTAL - NOME.pdf" se ainda não existir
        if (
          cfgPerfil.porte === 'PRONAF_A' &&
          (item.categoria === 'ITEM_CERT_SOCIO_COM_KML' ||
            item.categoria === 'ITEM_CERT_SOCIO_SEM_KML') &&
          !item.isViti
        ) {
          const nomeExtra = `- CERT. SOCIOAMBIENTAL - ${nomesCurtos.titular}.${
            item.extensao || 'pdf'
          }`.replace(/[/:*?"<>|]/g, '-');

          for (const subCert of ['', 'CERTIFICAÇÃO SOCIOAMBIENTAL']) {
            let jaExisteCopia = false;
            try {
              const pH = await obterSubpastaHandle(dirHandleRoot, subCert);
              await pH.getFileHandle(nomeExtra, { create: false });
              jaExisteCopia = true;
              registrarArquivoPreservado(subCert, nomeExtra);
            } catch {
              jaExisteCopia = false;
            }

            if (!jaExisteCopia) {
              if (!bufferCache) bufferCache = await lerBufferSeguroDoItem(item);
              if (bufferCache) {
                await gravarEmSubpasta(subCert, nomeExtra, bufferCache);
              }
            }
          }
        }

        // Remove o arquivo original antigo APENAS se ele mudou de nome ou mudou de pasta
        if (!item.origemGaveta) {
          const conjSalvosNaOrigem = gravadosPorPasta.get(pastaOrigemNorm);
          if (
            !conjSalvosNaOrigem ||
            !conjSalvosNaOrigem.has(item.nomeOriginal)
          ) {
            try {
              const handleOrigem = await obterSubpastaHandle(
                dirHandleRoot,
                item.origemSubpasta || ''
              );
              await handleOrigem.removeEntry(item.nomeOriginal);
            } catch {
              // Ignora se já removido
            }
          }
        }
      }

      // 2.5. VARREDURA E LIMPEZA ESTRATÉGICA DE ÁRVORES ANTIGAS:
      // Qualquer arquivo excedente/antigo que não faça parte dos destinos oficiais (gravadosPorPasta)
      // é movido para dentro de "OUTROS/<Subpasta Antiga>", e as pastas antigas/vazias são removidas da raiz!
      const varrerELimparArvoreAntiga = async (
        dirAtual: any,
        caminhoRel: string,
        profundidade = 0
      ): Promise<boolean> => {
        if (profundidade > 4) return false;
        const caminhoUp = (caminhoRel || '').toUpperCase().trim();

        // Nunca mexe no que já está guardado dentro da pasta OUTROS
        if (caminhoUp === 'OUTROS' || caminhoUp.startsWith('OUTROS/')) {
          return true;
        }

        const entradasAtuais: Array<[string, any]> = [];
        try {
          for await (const entry of dirAtual.entries()) {
            entradasAtuais.push(entry);
          }
        } catch {
          return false;
        }

        let possuiConteudoOficial = false;

        for (const [entryName, entryHandle] of entradasAtuais) {
          if (
            !entryName ||
            entryName.startsWith('.') ||
            entryName.startsWith('~$')
          ) {
            continue;
          }

          if (entryHandle.kind === 'file') {
            const isParecerReal = isArquivoParecerGerencialReal(entryName);
            const isTxtLembrete =
              entryName.toLowerCase().endsWith('.txt') && !isParecerReal;
            if (isParecerReal || isTxtLembrete) {
              possuiConteudoOficial = true;
              continue;
            }

            const salvosNestaPasta = gravadosPorPasta.get(caminhoUp);
            const fazParteDaArvoreOficial = Boolean(
              salvosNestaPasta && salvosNestaPasta.has(entryName)
            );

            if (fazParteDaArvoreOficial) {
              possuiConteudoOficial = true;
            } else {
              // Arquivo de uma pasta antiga ou versão duplicada descartada -> Move para OUTROS mantendo a subpasta de origem!
              try {
                const fileSobra: File = await entryHandle.getFile();
                const bufferSobra = await fileSobra.arrayBuffer();
                const destinoOutrosRel = caminhoRel
                  ? `OUTROS/${caminhoRel}`
                  : 'OUTROS';
                await gravarEmSubpasta(destinoOutrosRel, entryName, bufferSobra);
                await dirAtual.removeEntry(entryName);
              } catch {
                // Ignora se bloqueado
              }
            }
          } else if (entryHandle.kind === 'directory') {
            const subCaminho = caminhoRel
              ? `${caminhoRel}/${entryName}`
              : entryName;
            const subCaminhoUp = subCaminho.toUpperCase().trim();

            if (subCaminhoUp === 'OUTROS') {
              possuiConteudoOficial = true;
              continue;
            }

            const subTemOficial = await varrerELimparArvoreAntiga(
              entryHandle,
              subCaminho,
              profundidade + 1
            );

            if (subTemOficial) {
              possuiConteudoOficial = true;
            } else {
              // A pasta antiga ficou vazia (ou todo o seu conteúdo não pertinente já foi movido p/ OUTROS) -> Remove a pasta antiga!
              try {
                await dirAtual.removeEntry(entryName, { recursive: true });
              } catch {
                // Ignora se o sistema operacional bloquear
              }
            }
          }
        }

        return possuiConteudoOficial;
      };

      await varrerELimparArvoreAntiga(dirHandleRoot, '', 0);

      // 3. Verifica se já existe Parecer Gerencial real na pasta
      let jaTemParecerGerencialNaPasta =
        arquivosMapeados.some(
          (a) => a.categoria === 'ITEM_PARECER_GERENCIAL'
        ) || parecerGerencialExtraidoNaPasta;

      if (!jaTemParecerGerencialNaPasta) {
        try {
          for await (const [entryName, entryH] of dirHandleRoot.entries()) {
            if (
              entryH.kind === 'file' &&
              isArquivoParecerGerencialReal(entryName)
            ) {
              jaTemParecerGerencialNaPasta = true;
              break;
            }
          }
        } catch {
          // Ignora
        }
      }

      // 4. Grava os .TXT vazios apenas do que ainda faltar na pasta
      if (gerarTxtsLembretesFaltantes) {
        for (const lemb of planoLembretesTxt) {
          if (
            lemb.nomeArquivoTxt.includes('FALTA PARECER GERENCIAL') &&
            !jaTemParecerGerencialNaPasta
          ) {
            continue;
          }
          await gravarEmSubpasta(lemb.pastaRelativa, lemb.nomeArquivoTxt, '');
        }
      }

      // Re-escaneia a pasta para atualizar todos os FileHandles com os nomes novos
      await escanearHandleDaPasta(dirHandleRoot);

      // 5. ITEM 1.1: Verifica se o cliente já possui Card no Kanban / Contratações
      const nomeTitNorm = removerAcentos(titularNome).toUpperCase().trim();
      const cpfTitLimpo = (
        auditoriaPdf?.dadosProjetoParaParecer?.clienteCpf ||
        registroConformidadeVinculado?.cpfCliente ||
        cadCpf ||
        ''
      ).replace(/\D/g, '');

      const cardExistenteNoKanban = listaCards.find((c) => {
        const cNome = removerAcentos(c.clienteVinculado || '')
          .toUpperCase()
          .trim();
        const cCpf = (c.cpfVinculado || '').replace(/\D/g, '');
        return (
          (cpfTitLimpo.length === 11 && cCpf === cpfTitLimpo) ||
          (nomeTitNorm.length >= 4 && cNome === nomeTitNorm)
        );
      });

      const jaEstaNasContratacoes = listaContratacoes.some((r) => {
        const rNome = removerAcentos(r.cliente || '')
          .toUpperCase()
          .trim();
        const rCpf = (r.cpf || '').replace(/\D/g, '');
        return (
          (cpfTitLimpo.length === 11 && rCpf === cpfTitLimpo) ||
          (nomeTitNorm.length >= 4 && rNome === nomeTitNorm)
        );
      });

      const jaCadastradoNoPainel = Boolean(
        cardExistenteNoKanban || jaEstaNasContratacoes
      );

      // Se a pasta já tem o cliente no Kanban E já tem o Parecer Gerencial na pasta,
      // não abre novamente os modais de Kanban/Parecer — finaliza direto!
      if (jaCadastradoNoPainel && jaTemParecerGerencialNaPasta) {
        alert(
          `✅ Organização complementar concluída!\n\n• ${qtdArquivosMovidosOuRenomeados} arquivo(s) novo(s)/restante(s) organizado(s).\n• Cliente já consta no Kanban e o Parecer Gerencial já está salvo na pasta.`
        );
        return;
      }

      const itemConfBase: ItemConformidadePronafA =
        registroConformidadeVinculado || {
          id: `temp_${Date.now()}`,
          nomeCliente: titularNome.toUpperCase().trim(),
          cpfCliente: cpfTitLimpo,
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

      if (!jaCadastradoNoPainel && resClassif) {
        setModalIniciarProposta(resClassif);
        setCadCpf(
          auditoriaPdf?.dadosProjetoParaParecer?.clienteCpf ||
            resClassif.item.cpfCliente ||
            ''
        );
        setCadValor(auditoriaPdf?.valorPropostaDetectado || '');
        setCadTipo(
          cfgPerfil.escopo === 'LIMITE_PURO'
            ? cfgPerfil.modalidadeLimite
            : cfgPerfil.modalidadeDerivada === 'CUSTEIO'
            ? 'Custeio'
            : 'Investimento'
        );
        setCadProjetista(projetistaNome || '');
        setCadPrograma(
          cfgPerfil.porte === 'PRONAF_A'
            ? 'FNE/PRONAF A - RES.5.183/24 (699)'
            : cfgPerfil.porte === 'PRONAF_V'
            ? 'FNE /PRONAF - COMUM (FNE) (433)'
            : 'FNE /RURAL (226)'
        );
        setCadSituacao('Na Agência');
        setCadData(getHojeBR());
        setCadSitDetalhada(
          `- PASTA DO CLIENTE ORGANIZADA (${cfgPerfil.porte.replace(
            '_',
            ' '
          )} • ${cfgPerfil.escopo})`
        );
        setCadObsPendencias(
          planoLembretesTxt.length > 0
            ? planoLembretesTxt
                .slice(0, 6)
                .map((l) => `- ${l.nomeArquivoTxt.replace(/\.txt$/i, '')}`)
                .join('\n')
            : '- DOCUMENTAÇÃO CONFERIDA'
        );
        return;
      } else if (
        jaCadastradoNoPainel &&
        !jaTemParecerGerencialNaPasta &&
        cardExistenteNoKanban
      ) {
        setCardOverlayParecerId(cardExistenteNoKanban.id);
        return;
      }

      alert(
        `✅ Pasta "${nomePastaSelecionada}" organizada e atualizada com sucesso (${qtdArquivosMovidosOuRenomeados} arquivo(s) ajustado(s))!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert('❌ Erro durante a organização da pasta: ' + msg);
    } finally {
      setProcessando(false);
    }
  };

  const confirmarCadastroPropostaEAbrirParecer = async () => {
    if (!modalIniciarProposta) return;
    if (!cadValor.trim()) {
      alert('Informe o Valor da Proposta (R$) para cadastrar a operação!');
      return;
    }

    const { item } = modalIniciarProposta;
    const idNovaOp = String(Date.now());
    const nomeUpper = item.nomeCliente.toUpperCase().trim();
    const cpfFmt = (cadCpf || item.cpfCliente || '').trim();
    const porteFormatado =
      cfgPerfil.porte === 'PRONAF_A'
        ? 'PRONAF A'
        : cfgPerfil.porte === 'PRONAF_V'
        ? 'PRONAF V'
        : 'MINI';

    const novaContratacao: RegistroContratacao = {
      id: idNovaOp,
      porte: porteFormatado,
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
      tipoGarantiaKanban:
        cfgPerfil.garantiaDerivada === 'LCGH_LCGA'
          ? cfgPerfil.modalidadeLimite
          : cfgPerfil.garantiaDerivada === 'AVAL'
          ? 'AVAL'
          : 'NENHUMA',
    };

    const { html, textoPuro } = montarHtmlCardSincronizado({
      cliente: nomeUpper,
      cpf: cpfFmt,
      porte: porteFormatado,
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

    const etapaInicial: EtapaKanban = 'CADASTROS';
    const novoCardKanban: CardKanban = {
      id: `wk_org_${idNovaOp}`,
      etapa: etapaInicial,
      statusCor: 'azul',
      texto: html,
      textoPuro,
      dataModificacao: getHojeISO(),
      isNovo: true,
      propostaIdVinculada: idNovaOp,
      idsPropostasAgrupadas: [idNovaOp],
      clienteVinculado: nomeUpper,
      cpfVinculado: cpfFmt,
      porteVinculado: porteFormatado,
      valorVinculado: novaContratacao.valor,
      tipoOpVinculado: novaContratacao.tipo,
      situacaoVinculada: novaContratacao.situacao,
      situacaoDetalhadaVinculada: novaContratacao.situacaoDetalhada,
      obsVinculada: novaContratacao.obs,
    };

    const novasContratacoes = [novaContratacao, ...listaContratacoes];
    const novosCards = [novoCardKanban, ...listaCards];

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
          detail: { cards: novosCards, contratacoes: novasContratacoes },
        })
      );
    }

    setModalIniciarProposta(null);
    setCardOverlayParecerId(novoCardKanban.id);
  };

  // =========================================================================
  // ETAPA 2: BARRA DE CONSULTAS COM AUTO-COPY (CPF / CAR) E WHATSAPP CRÍTICAS
  // =========================================================================
  const [alvoCpfAutoCopy, setAlvoCpfAutoCopy] = useState<'TITULAR' | 'CONJUGE'>(
    'TITULAR'
  );
  const [feedbackAutoCopy, setFeedbackAutoCopy] = useState<string>('');

  const cpfTitularDetectado = useMemo(() => {
    if (auditoriaPdf?.dadosProjetoParaParecer?.clienteCpf) {
      return auditoriaPdf.dadosProjetoParaParecer.clienteCpf;
    }
    if (registroConformidadeVinculado?.cpfCliente) {
      return registroConformidadeVinculado.cpfCliente;
    }
    const contr = listaContratacoes.find(
      (c) =>
        removerAcentos(c.cliente).toUpperCase().trim() ===
        removerAcentos(titularNome).toUpperCase().trim()
    );
    return contr?.cpf || cadCpf || '';
  }, [
    auditoriaPdf,
    registroConformidadeVinculado,
    listaContratacoes,
    titularNome,
    cadCpf,
  ]);

  const cpfConjugeDetectado = useMemo(() => {
    if (auditoriaPdf?.dadosProjetoParaParecer?.conjugeCpf) {
      return auditoriaPdf.dadosProjetoParaParecer.conjugeCpf;
    }
    if (registroConformidadeVinculado?.conjugeCpf) {
      return registroConformidadeVinculado.conjugeCpf;
    }
    return '';
  }, [auditoriaPdf, registroConformidadeVinculado]);

  const carReciboDetectado = useMemo(() => {
    return auditoriaPdf?.carEspecificoDetectado || '';
  }, [auditoriaPdf]);

  const abrirLinkComAutoCopy = async (
    url: string,
    rotuloLink: string,
    tipoDadoCopiar: 'CPF' | 'CAR' | 'NENHUM' = 'CPF'
  ) => {
    let valorParaCopiar = '';
    let descricaoCopiada = '';

    if (tipoDadoCopiar === 'CAR') {
      valorParaCopiar = carReciboDetectado;
      descricaoCopiada = valorParaCopiar
        ? `CAR (${valorParaCopiar}) copiado!`
        : 'Link aberto (CAR não detectado no texto)';
    } else if (tipoDadoCopiar === 'CPF') {
      const cpfBruto =
        alvoCpfAutoCopy === 'CONJUGE' && cpfConjugeDetectado
          ? cpfConjugeDetectado
          : cpfTitularDetectado;
      valorParaCopiar = cpfBruto.replace(/\D/g, '');
      descricaoCopiada = valorParaCopiar
        ? `CPF ${
            alvoCpfAutoCopy === 'CONJUGE' ? 'Cônjuge' : 'Titular'
          } (${cpfBruto}) copiado!`
        : 'Link aberto (CPF ainda não identificado)';
    } else {
      descricaoCopiada = `Abrindo ${rotuloLink}...`;
    }

    if (valorParaCopiar && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(valorParaCopiar);
      } catch {
        // Ignora falha de permissão de clipboard
      }
    }

    setFeedbackAutoCopy(`⚡ ${rotuloLink}: ${descricaoCopiada}`);
    setTimeout(() => setFeedbackAutoCopy(''), 4500);

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const montarTextoRelatorioCriticasWhatsApp = (): string => {
    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const cliNome = (titularNome || nomePastaSelecionada || 'CLIENTE')
      .toUpperCase()
      .trim();
    const cpfTxt = cpfTitularDetectado ? ` | CPF: ${cpfTitularDetectado}` : '';
    const escopoTxt = `${cfgPerfil.porte.replace('_', ' ')} (${cfgPerfil.escopo.replace(
      /_/g,
      ' '
    )})`;

    let msg = `*RELATÓRIO DE CRÍTICAS E PENDÊNCIAS - ${hoje}*\n`;
    msg += `👤 *Cliente:* ${cliNome}${cpfTxt}\n`;
    msg += `🚜 *Enquadramento:* ${escopoTxt}\n`;
    if (paNome) msg += `📍 *Imóvel / P.A.:* ${paNome}\n`;
    if (auditoriaPdf?.valorPropostaDetectado) {
      msg += `💰 *Valor Identificado:* R$ ${auditoriaPdf.valorPropostaDetectado}\n`;
    }
    msg += `\n`;

    // 1. Críticas e Erros da Auditoria de PDFs e KML
    const diagsComCritica = (auditoriaPdf?.itensDiagnostico || []).filter(
      (d) => d.status === 'ERRO' || d.status === 'ALERTA'
    );

    if (diagsComCritica.length > 0) {
      msg += `___________________\n🚨 *CRÍTICAS DA AUDITORIA (PDFs / KML / CADASTRO):*\n___________________\n\n`;
      diagsComCritica.forEach((d) => {
        const icone = d.status === 'ERRO' ? '❌' : '⚠️';
        msg += `${icone} *${d.titulo}:*\n   • ${d.resumo}\n`;
        if (d.detalhes && d.detalhes.length > 0) {
          d.detalhes
            .filter(
              (det) =>
                det.includes('🚨') ||
                det.includes('⚠️') ||
                det.includes('[IMPEDIMENTO]')
            )
            .forEach((det) => {
              msg += `   • ${det}\n`;
            });
        }
        msg += `\n`;
      });
    }

    // 2. Separa Documentos Faltantes do Projetista/Cliente vs Ações Internas da Agência
    const txtsInternosAgencia: string[] = [];
    const txtsPendentesProjetista: string[] = [];

    planoLembretesTxt.forEach((lemb) => {
      const nUp = lemb.nomeArquivoTxt.toUpperCase();
      const limpo = lemb.nomeArquivoTxt.replace(/\.txt$/i, '');
      const prefixoPasta = lemb.pastaRelativa ? `[${lemb.pastaRelativa}] ` : '';

      const ehRotinaInternaBanco =
        nUp.includes('FALTA PARECER GERENCIAL') ||
        nUp.includes('VERIFICAR C-C NA CONSOLIDADA') ||
        nUp.includes('FALTA CONSULTAR SELOS') ||
        nUp.includes('EMITIR CNDT NO DIA') ||
        nUp.includes('CONSULTAR EXTRATO DA CAF NO DIA') ||
        nUp.includes('ELABORAR CADASTRO') ||
        nUp.includes('RENOVAR CADASTRO') ||
        nUp.includes('EMBARGOS') ||
        nUp.includes('IMPROBIDADE') ||
        nUp.includes('EXTRATO SICOR') ||
        nUp.includes('ESPELHO - RELATÓRIO DA UND');

      if (ehRotinaInternaBanco) {
        txtsInternosAgencia.push(`▪️ ${prefixoPasta}${limpo}`);
      } else {
        txtsPendentesProjetista.push(`▪️ ${prefixoPasta}${limpo}`);
      }
    });

    if (txtsPendentesProjetista.length > 0) {
      msg += `___________________\n📂 *DOCUMENTOS FALTANTES NA PASTA (PROJETISTA / CLIENTE):*\n___________________\n\n`;
      msg += `${txtsPendentesProjetista.join('\n')}\n\n`;
    }

    if (txtsInternosAgencia.length > 0) {
      msg += `___________________\n🏦 *PENDÊNCIAS INTERNAS / EMISSÕES DO DIA (AGÊNCIA):*\n___________________\n\n`;
      msg += `${txtsInternosAgencia.join('\n')}\n`;
    }

    if (
      diagsComCritica.length === 0 &&
      txtsPendentesProjetista.length === 0 &&
      txtsInternosAgencia.length === 0
    ) {
      msg += `✅ *PASTA 100% EM CONFORMIDADE!* Nenhuma crítica ou pendência documental identificada.\n`;
    }

    return msg.trim();
  };

  const enviarRelatorioCriticasWhatsAppProjetista = async (
    apenasCopiar = false
  ) => {
    const textoRelatorio = montarTextoRelatorioCriticasWhatsApp();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(textoRelatorio);
      } catch {
        // Ignora erro
      }
    }

    if (apenasCopiar) {
      alert(
        '📋 Relatório de Críticas copiado para a área de transferência no formato do WhatsApp!'
      );
      return;
    }

    const listaProjs = obterListaProjetistas();
    const projAlvo = (projetistaNome || '').toUpperCase().trim();
    const cadastroProj = listaProjs.find(
      (p) =>
        p.nomeCurto.toUpperCase().trim() === projAlvo ||
        (p.nomeCompleto && p.nomeCompleto.toUpperCase().includes(projAlvo))
    );

    const foneLimpo = (cadastroProj?.telefone || '').replace(/\D/g, '');
    if (!foneLimpo) {
      alert(
        `📋 O Relatório de Críticas já foi COPIADO para o seu Ctrl+V!\n\n⚠️ O projetista "${
          projAlvo || 'Não informado'
        }" ainda não possui número de WhatsApp cadastrado na aba Ferramentas. Abrindo o WhatsApp Web para você escolher o contato e colar!`
      );
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(
          textoRelatorio
        )}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    const ddiFone = foneLimpo.startsWith('55') ? foneLimpo : `55${foneLimpo}`;
    window.open(
      `https://wa.me/${ddiFone}?text=${encodeURIComponent(textoRelatorio)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const baixarPacoteZipOrganizado = async () => {
    if (arquivosMapeados.length === 0) return;
    const zip = new PizZip();

    for (const item of arquivosMapeados) {
      if (item.categoria === 'IGNORAR') continue;
      const destinos = calcularTodosDestinosDoArquivo(item, cfgPerfil);
      const buffer = await item.fileObj.arrayBuffer();

      for (const dest of destinos) {
        const nomeSeguro = dest.nomeArquivoFinal.replace(/[/:*?"<>|]/g, '-');
        const caminhoZip = dest.pastaRelativa
          ? `${dest.pastaRelativa}/${nomeSeguro}`
          : nomeSeguro;
        zip.file(caminhoZip, buffer);
      }
    }

    if (gerarTxtsLembretesFaltantes) {
      planoLembretesTxt.forEach((lemb) => {
        const nomeSeguro = lemb.nomeArquivoTxt.replace(/[/:*?"<>|]/g, '-');
        const caminhoZip = lemb.pastaRelativa
          ? `${lemb.pastaRelativa}/${nomeSeguro}`
          : nomeSeguro;
        zip.file(caminhoZip, '');
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
      setCoringasSalvos(await listarCoringasDoCofreLocal());
      alert(
        `✅ Documento Coringa [${novoCoringaTipo} — ${chaveFinal}] salvo e sincronizado na Nuvem!`
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
    height: '32px',
    padding: '4px 8px',
    fontSize: '11.5px',
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
          maxWidth: '1440px',
          height: '95vh',
          borderRadius: '12px',
          boxShadow: '0 25px 55px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #8B1530',
        }}
      >
        {/* CABEÇALHO EXECUTIVO */}
        <div
          style={{
            padding: '10px 20px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  color: '#8B1530',
                  fontWeight: 800,
                }}
              >
                🗂️ ORGANIZADOR MULTI-PORTE DE PASTAS & AUDITORIA DE PROJETOS
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
                  ? '☁️ Gaveta na Nuvem OK'
                  : '⏳ Sincronizando...'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Suporta <b>PRONAF A</b>, <b>PRONAF V (Comum)</b>,{' '}
              <b>MINI / PEQUENO</b>, <b>Limites LCGH/LCGA</b> e{' '}
              <b>Combo (Derivada + Limite)</b> com cópia cruzada entre
              subpastas.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setAbaAtiva('ORGANIZADOR')}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #8B1530',
                background: abaAtiva === 'ORGANIZADOR' ? '#8B1530' : '#ffffff',
                color: abaAtiva === 'ORGANIZADOR' ? '#ffffff' : '#8B1530',
                cursor: 'pointer',
              }}
            >
              ⚡ 1. Organizar / Auditar Pasta
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('COFRE')}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #b45309',
                background: abaAtiva === 'COFRE' ? '#b45309' : '#fffbeb',
                color: abaAtiva === 'COFRE' ? '#ffffff' : '#b45309',
                cursor: 'pointer',
              }}
            >
              🗄️ 2. Gaveta de Coringas ({coringasSalvos.length})
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

        {/* ABA 1: ORGANIZADOR MULTI-PORTE */}
        {abaAtiva === 'ORGANIZADOR' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* PAINEL DE CONFIGURAÇÃO DO PERFIL E ENVOLVIDOS */}
            <div
              style={{
                margin: '10px 20px 0 20px',
                padding: '12px 16px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderLeft: '5px solid #8B1530',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* LINHA 1: SELETOR DE PORTE, ESCOPO (DERIVADA / LIMITE / COMBO) E GARANTIA */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.6fr 1fr 1.1fr 0.9fr auto',
                  gap: '10px',
                  alignItems: 'end',
                  background: '#fdf2f4',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #f5c2c7',
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#8B1530',
                      display: 'block',
                      marginBottom: '3px',
                    }}
                  >
                    🎯 1. Porte do Cliente
                  </label>
                  <select
                    value={portePerfil}
                    onChange={(e) => {
                      const novoP = e.target.value as PorteOrganizador;
                      setPortePerfil(novoP);
                      if (novoP === 'PRONAF_A') {
                        setEscopoPasta('PRONAF_A_PADRAO');
                        setGarantiaDerivada('SEM_GARANTIA');
                      } else if (escopoPasta === 'PRONAF_A_PADRAO') {
                        setEscopoPasta('DERIVADA_PURA');
                      }
                    }}
                    style={{
                      ...inputPadraoStyle,
                      fontWeight: 800,
                      color: '#8B1530',
                    }}
                  >
                    <option value="PRONAF_A">PRONAF A (Reforma Agrária)</option>
                    <option value="PRONAF_V">PRONAF V (Comum)</option>
                    <option value="MINI_PEQUENO">MINI / PEQUENO / DEMAIS</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#8B1530',
                      display: 'block',
                      marginBottom: '3px',
                    }}
                  >
                    🗂️ 2. Estrutura de Pastas / Escopo da Proposta
                  </label>
                  <select
                    value={cfgPerfil.escopo}
                    onChange={(e) =>
                      setEscopoPasta(e.target.value as EscopoOperacaoPasta)
                    }
                    style={{ ...inputPadraoStyle, fontWeight: 700 }}
                  >
                    {portePerfil === 'PRONAF_A' && (
                      <option value="PRONAF_A_PADRAO">
                        Padrão PRONAF A (Itens 1 a 21 na Raiz + Subpastas)
                      </option>
                    )}
                    {portePerfil !== 'PRONAF_A' && (
                      <>
                        <option value="DERIVADA_PURA">
                          Operação Derivada Pura (Investimento ou Custeio na
                          Raiz)
                        </option>
                        <option value="COMBO_DERIVADA_E_LIMITE">
                          🔥 Combo: Derivada + Limite (Cria pastas LCGH/LCGA +
                          INV/CUSTEIO)
                        </option>
                      </>
                    )}
                    <option value="LIMITE_PURO">
                      Somente Abertura de Limite (LCGH / LCGA na Raiz)
                    </option>
                  </select>
                </div>

                {cfgPerfil.escopo !== 'LIMITE_PURO' && (
                  <div>
                    <label
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        color: '#334155',
                        display: 'block',
                        marginBottom: '3px',
                      }}
                    >
                      🚜 Finalidade Derivada
                    </label>
                    <select
                      value={modalidadeDerivada}
                      onChange={(e) =>
                        setModalidadeDerivada(
                          e.target.value as ModalidadeDerivada
                        )
                      }
                      style={{ ...inputPadraoStyle, fontWeight: 700 }}
                    >
                      <option value="INVESTIMENTO">Investimento</option>
                      <option value="CUSTEIO">
                        Custeio (+ Planilha Geodésica)
                      </option>
                    </select>
                  </div>
                )}

                {portePerfil !== 'PRONAF_A' &&
                  cfgPerfil.escopo === 'DERIVADA_PURA' && (
                    <div>
                      <label
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#334155',
                          display: 'block',
                          marginBottom: '3px',
                        }}
                      >
                        🛡️ Garantia da Derivada
                      </label>
                      <select
                        value={garantiaDerivada}
                        onChange={(e) =>
                          setGarantiaDerivada(
                            e.target.value as GarantiaDerivada
                          )
                        }
                        style={{ ...inputPadraoStyle, fontWeight: 700 }}
                      >
                        <option value="AVAL">Aval / Fiança (Sem Imóvel)</option>
                        <option value="LCGH_LCGA">
                          Imóvel em Garantia (LCGH / LCGA)
                        </option>
                        <option value="SEM_GARANTIA">Sem Garantia</option>
                      </select>
                    </div>
                  )}

                {(cfgPerfil.escopo === 'LIMITE_PURO' ||
                  cfgPerfil.escopo === 'COMBO_DERIVADA_E_LIMITE' ||
                  garantiaDerivada === 'LCGH_LCGA') && (
                  <div>
                    <label
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        color: '#334155',
                        display: 'block',
                        marginBottom: '3px',
                      }}
                    >
                      🏛️ Tipo Limite
                    </label>
                    <select
                      value={modalidadeLimite}
                      onChange={(e) =>
                        setModalidadeLimite(
                          e.target.value as ModalidadeLimite
                        )
                      }
                      style={{ ...inputPadraoStyle, fontWeight: 700 }}
                    >
                      <option value="LCGH">LCGH (Hipoteca)</option>
                      <option value="LCGA">LCGA (Alienação Fid.)</option>
                    </select>
                  </div>
                )}

                {portePerfil !== 'PRONAF_A' && (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#8B1530',
                      cursor: 'pointer',
                      height: '32px',
                      margin: 0,
                      whiteSpace: 'nowrap',
                    }}
                    title="Imóveis avaliados a partir de R$ 600.000,00 exigem Laudo de Avaliação Interno elaborado pelo técnico do Banco"
                  >
                    <input
                      type="checkbox"
                      checked={imovelAvaliadoAcima600k}
                      onChange={(e) =>
                        setImovelAvaliadoAcima600k(e.target.checked)
                      }
                      style={{
                        width: '14px',
                        height: '14px',
                        margin: 0,
                        accentColor: '#8B1530',
                      }}
                    />
                    Imóvel &ge; R$ 600 mil (Exige Laudo Interno)
                  </label>
                )}
              </div>

              {/* LINHA 2: DADOS DOS ENVOLVIDOS */}
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
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#8B1530',
                      display: 'block',
                      marginBottom: '3px',
                    }}
                  >
                    ⚡ Puxar Cliente do Painel / Conformidade
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
                        setPortePerfil(achado.porte);
                        setEscopoPasta(achado.escopoSugerido);
                        setModalidadeDerivada(achado.modDerivada);
                        setModalidadeLimite(achado.modLimite);
                        setGarantiaDerivada(achado.garDerivada);
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
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#0f172a',
                      display: 'block',
                      marginBottom: '3px',
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
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '3px',
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
                    placeholder="Vazio = Sem cônjuge"
                    style={inputPadraoStyle}
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
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '3px',
                    }}
                  >
                    👨‍💼 Projetista (CREA)
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
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#334155',
                      display: 'block',
                      marginBottom: '3px',
                    }}
                  >
                    🏕️ Imóvel / P.A.
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

              {/* LINHA 3: BOTÕES DE AÇÃO NA PASTA */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #e2e8f0',
                }}
              >
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
                    onClick={selecionarPastaNoComputador}
                    style={{
                      width: 'auto',
                      height: '34px',
                      padding: '0 16px',
                      fontSize: '12px',
                      fontWeight: 800,
                      background: '#8B1530',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    📂 1. Selecionar Pasta do Cliente no Windows
                  </button>

                  {nomePastaSelecionada && (
                    <>
                      <span
                        style={{
                          background: pastaJaEraOrganizada
                            ? '#dcfce7'
                            : '#fdf2f4',
                          color: pastaJaEraOrganizada ? '#166534' : '#8B1530',
                          border: `1px solid ${
                            pastaJaEraOrganizada ? '#86efac' : '#f5c2c7'
                          }`,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        📁 {nomePastaSelecionada} ({arquivosMapeados.length}{' '}
                        arq.)
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          dirHandleRoot && escanearHandleDaPasta(dirHandleRoot)
                        }
                        style={{
                          width: 'auto',
                          height: '30px',
                          padding: '0 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Re-escanear Pasta
                      </button>
                    </>
                  )}

                  {(nomePastaSelecionada ||
                    titularNome.trim() !== '' ||
                    arquivosMapeados.length > 0) && (
                    <button
                      type="button"
                      onClick={limparConsultaOrganizadorDoZero}
                      title="Limpar todos os dados da pasta atual e iniciar a organização de outra pasta do zero"
                      style={{
                        width: 'auto',
                        height: '30px',
                        padding: '0 12px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      🧹 Limpar Consulta / Nova Pasta do Zero
                    </button>
                  )}

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
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
                    Gerar .TXT Vazios do que Faltar
                  </label>
                </div>

                {arquivosMapeados.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={baixarPacoteZipOrganizado}
                      style={{
                        width: 'auto',
                        height: '34px',
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
                        height: '34px',
                        padding: '0 18px',
                        fontSize: '12px',
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
                        ? '⏳ Processando Pasta...'
                        : '⚡ 2. Organizar Pasta & Iniciar Proposta / Parecer!'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CORPO PRINCIPAL: TABELA DE ARQUIVOS ORDENADA + COLUNA DIREITA DE AUDITORIA E .TXT */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1.85fr 1fr',
                gap: '14px',
                padding: '10px 20px 16px 20px',
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
                }}
              >
                <div
                  style={{
                    padding: '9px 14px',
                    background: '#8B1530',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    📋 1. ARQUIVOS IDENTIFICADOS NA ORDEM DO PERFIL (
                    {arquivosMapeadosOrdenados.length})
                  </span>
                  <span style={{ fontSize: '10.5px', opacity: 0.9 }}>
                    Perfil Ativo: {cfgPerfil.porte.replace('_', ' ')} •{' '}
                    {cfgPerfil.escopo.replace(/_/g, ' ')}
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {arquivosMapeadosOrdenados.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '60px 24px',
                        color: '#64748b',
                        fontSize: '13px',
                      }}
                    >
                      Selecione a pasta do cliente acima para organizar e
                      validar os documentos automaticamente.
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
                              padding: '7px 10px',
                              borderBottom: '1px solid #cbd5e1',
                            }}
                          >
                            Arquivo Atual na Pasta
                          </th>
                          <th
                            style={{
                              padding: '7px 10px',
                              borderBottom: '1px solid #cbd5e1',
                              width: '260px',
                            }}
                          >
                            Classificação Detectada
                          </th>
                          <th
                            style={{
                              padding: '7px 6px',
                              borderBottom: '1px solid #cbd5e1',
                              width: '50px',
                              textAlign: 'center',
                            }}
                          >
                            VITI?
                          </th>
                          <th
                            style={{
                              padding: '7px 10px',
                              borderBottom: '1px solid #cbd5e1',
                            }}
                          >
                            Destinos & Numeração por Pasta
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {arquivosMapeadosOrdenados.map((arq, idx) => {
                          const destinos = calcularTodosDestinosDoArquivo(
                            arq,
                            cfgPerfil
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
                                  : arq.origemSubpasta
                                  ? '#faf5ff'
                                  : idx % 2 === 0
                                  ? '#ffffff'
                                  : '#f8fafc',
                              }}
                            >
                              <td
                                style={{
                                  padding: '7px 10px',
                                  wordBreak: 'break-all',
                                  fontWeight:
                                    arq.origemGaveta || arq.origemSubpasta
                                      ? 700
                                      : 500,
                                  color: arq.origemGaveta
                                    ? '#b45309'
                                    : arq.origemSubpasta
                                    ? '#6b21a8'
                                    : '#334155',
                                }}
                              >
                                {arq.origemSubpasta
                                  ? `[Em ${arq.origemSubpasta}] ${arq.nomeOriginal}`
                                  : arq.nomeOriginal}
                              </td>

                              <td style={{ padding: '5px 10px' }}>
                                <select
                                  value={arq.categoria}
                                  onChange={(e) => {
                                    const novaCat = e.target
                                      .value as CategoriaDocPasta;
                                    setArquivosMapeados((prev) =>
                                      prev.map((item) =>
                                        item.id === arq.id
                                          ? {
                                              ...item,
                                              categoria: novaCat,
                                              isViti:
                                                CATEGORIAS_QUE_ACEITAM_VITI.has(
                                                  novaCat
                                                )
                                                  ? item.isViti
                                                  : false,
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                  style={{
                                    width: '100%',
                                    height: '34px',
                                    minHeight: '34px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    lineHeight: '1.25',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                  }}
                                >
                                  {OPCOES_SELECT_CATEGORIA.map((grp) => (
                                    <optgroup key={grp.grupo} label={grp.grupo}>
                                      {grp.itens.map((opt) => (
                                        <option
                                          key={opt.valor}
                                          value={opt.valor}
                                        >
                                          {opt.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                  <option value="IGNORAR">
                                    🚫 Ignorar / Não Mexer
                                  </option>
                                </select>
                              </td>

                              <td
                                style={{ padding: '5px', textAlign: 'center' }}
                              >
                                {aceitaViti ? (
                                  <input
                                    type="checkbox"
                                    checked={arq.isViti}
                                    onChange={(e) => {
                                      const marcado = e.target.checked;
                                      setArquivosMapeados((prev) =>
                                        prev.map((item) =>
                                          item.id === arq.id
                                            ? { ...item, isViti: marcado }
                                            : item
                                        )
                                      );
                                    }}
                                    style={{
                                      width: '15px',
                                      height: '15px',
                                      margin: 0,
                                      cursor: 'pointer',
                                      accentColor: '#8B1530',
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: '#cbd5e1' }}>—</span>
                                )}
                              </td>

                              <td style={{ padding: '7px 10px' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                  }}
                                >
                                  {destinos.map((d, iD) => {
                                    const isCad =
                                      d.pastaRelativa === 'CADASTRO';
                                    const isSocio =
                                      d.pastaRelativa.includes(
                                        'SOCIOAMBIENTAL'
                                      );
                                    return (
                                      <span
                                        key={iD}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: isCad || isSocio ? 700 : 800,
                                          color: isCad
                                            ? '#6b21a8'
                                            : isSocio
                                            ? '#15803d'
                                            : '#8B1530',
                                        }}
                                      >
                                        {d.pastaRelativa
                                          ? `📁 [${d.pastaRelativa}]: `
                                          : '📁 [Raiz]: '}
                                        <span style={{ color: '#0f172a' }}>
                                          {d.nomeArquivoFinal}
                                        </span>
                                      </span>
                                    );
                                  })}
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

              {/* COLUNA DIREITA: BARRA DE CONSULTAS AUTO-COPY + AUDITORIA DOS PDFs + LEMBRETES .TXT */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowY: 'auto',
                }}
              >
                {/* ITEM 2: CENTRAL DE CONSULTAS DO DIA COM AGRUPAMENTO (9 GUIAS TITULAR / 6 GUIAS ENVOLVIDOS) */}
                <PainelConsultasRapidasAgrupadas
                  cpfTitular={cpfTitularDetectado}
                  dataNascTitular={
                    auditoriaPdf?.dadosProjetoParaParecer
                      ?.clienteDataNascimento || ''
                  }
                  cpfConjuge={cpfConjugeDetectado}
                  dataNascConjuge={
                    auditoriaPdf?.dadosProjetoParaParecer
                      ?.conjugeDataNascimento || ''
                  }
                  cpfProcuradorOuAvalista={
                    auditoriaPdf?.dadosProjetoParaParecer
                      ?.procuradorCpfExtraido ||
                    registroConformidadeVinculado?.procuradorCpf ||
                    ''
                  }
                  dataNascProcuradorOuAvalista={
                    auditoriaPdf?.dadosProjetoParaParecer
                      ?.procuradorDataNascimento || ''
                  }
                  carRecibo={carReciboDetectado}
                />

                {/* AUDITORIA AUTOMÁTICA DOS PDFs + BOTÃO WHATSAPP DE CRÍTICAS */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    borderTop: '4px solid #0369a1',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginBottom: '8px',
                    }}
                  >
                    <strong style={{ fontSize: '12px', color: '#0369a1' }}>
                      🧠 AUDITORIA AUTOMÁTICA DOS PDFs DA PASTA
                    </strong>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {auditandoPdfs && (
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: '#b45309',
                            fontWeight: 800,
                          }}
                        >
                          ⏳ Lendo PDFs...
                        </span>
                      )}

                      {arquivosMapeados.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              enviarRelatorioCriticasWhatsAppProjetista(true)
                            }
                            style={{
                              width: 'auto',
                              padding: '3px 8px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '5px',
                              cursor: 'pointer',
                            }}
                            title="Copiar Relatório de Críticas formatado para WhatsApp"
                          >
                            📋 Copiar Críticas
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              enviarRelatorioCriticasWhatsAppProjetista(false)
                            }
                            style={{
                              width: 'auto',
                              padding: '3px 10px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              background: '#15803d',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              boxShadow: '0 2px 5px rgba(21,128,61,0.25)',
                            }}
                            title="Enviar Relatório de Críticas e Documentos Faltantes direto para o WhatsApp do Projetista"
                          >
                            📲 Cobrar no WhatsApp ({projetistaNome || 'Proj.'})
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {auditoriaPdf?.kmlCorrigidoAutomaticamente && (
                    <div
                      style={{
                        marginBottom: '8px',
                        padding: '8px 10px',
                        background: '#fffbeb',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#b45309',
                        }}
                      >
                        ⚠️ Polígono(s) aberto(s) em &ldquo;
                        {auditoriaPdf.kmlCorrigidoAutomaticamente.nomeArquivo}
                        &rdquo;!
                      </span>
                      <button
                        type="button"
                        onClick={salvarKmlCorrigidoDiretoNaPasta}
                        style={{
                          width: 'auto',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: '#004C27',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🔧 Corrigir .KML na Pasta
                      </button>
                    </div>
                  )}

                  {!auditoriaPdf ? (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Selecione a pasta do cliente para extrair Valor, Prazo,
                      Carência, Elaborador, Inversões, C/C da Consolidada e
                      Assinaturas Digitais.
                    </span>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                      }}
                    >
                      {auditoriaPdf.itensDiagnostico.map((diag) => {
                        const paleta =
                          diag.status === 'OK'
                            ? {
                                bg: '#f0fdf4',
                                borda: '#86efac',
                                cor: '#166534',
                                icone: '✅',
                              }
                            : diag.status === 'ERRO'
                            ? {
                                bg: '#fef2f2',
                                borda: '#fca5a5',
                                cor: '#991b1b',
                                icone: '🚨',
                              }
                            : diag.status === 'ALERTA'
                            ? {
                                bg: '#fffbeb',
                                borda: '#fde68a',
                                cor: '#92400e',
                                icone: '⚠️',
                              }
                            : {
                                bg: '#f8fafc',
                                borda: '#e2e8f0',
                                cor: '#334155',
                                icone: 'ℹ️',
                              };

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
                            <div
                              style={{
                                color: '#1e293b',
                                marginTop: '2px',
                                fontWeight: 600,
                              }}
                            >
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

                {/* LEMBRETES .TXT PENDENTES POR PASTA */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    borderTop: '4px solid #8B1530',
                    padding: '12px 14px',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '12px',
                      color: '#8B1530',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    📝 ARQUIVOS .TXT DE PENDÊNCIAS DO PERFIL (
                    {planoLembretesTxt.length})
                  </strong>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                    }}
                  >
                    {planoLembretesTxt.map((lemb, iL) => {
                      const isZero = lemb.nomeArquivoTxt.startsWith('0.');
                      return (
                        <div
                          key={iL}
                          style={{
                            background: isZero ? '#fef2f2' : '#fffbeb',
                            color: isZero ? '#b91c1c' : '#92400e',
                            border: `1px solid ${
                              isZero ? '#fecaca' : '#fde68a'
                            }`,
                            padding: '5px 8px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {lemb.pastaRelativa
                            ? `📁 [${lemb.pastaRelativa}] `
                            : '📄 '}
                          {lemb.nomeArquivoTxt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: GAVETA DE CORINGAS NA NUVEM */}
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
                ☁️ Cadastrar Documento Coringa na Gaveta da Nuvem
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.4fr 1.5fr',
                  gap: '12px',
                  alignItems: 'end',
                  marginTop: '10px',
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
                      CREA / CFTA DO PROJETISTA (Por Nome do Projetista)
                    </option>
                    <option value="RB_PA">
                      17 - RB DO ASSENTAMENTO (Por Nome do P.A.)
                    </option>
                    <option value="CAR_PA">
                      CAR GERAL DO ASSENTAMENTO (Por Nome do P.A.)
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
                    Referência (Projetista / P.A.)
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
                    style={{ ...inputPadraoStyle, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '32px',
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
                📚 DOCUMENTOS CORINGAS SINCRONIZADOS ({coringasSalvos.length})
              </strong>
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
                    <th style={{ padding: '8px' }}>Referência</th>
                    <th style={{ padding: '8px' }}>Arquivo</th>
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
                        {cor.tipo}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 700 }}>
                        {cor.chaveReferencia}
                      </td>
                      <td style={{ padding: '8px' }}>
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
                          🗑️ Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL INICIAR PROPOSTA NO KANBAN */}
      {modalIniciarProposta && (
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
              borderTop: '5px solid #8B1530',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', color: '#8B1530' }}>
              🚀 CADASTRAR PROPOSTA NO KANBAN & ABRIR PARECER GERENCIAL
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '10px',
                marginBottom: '12px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Tipo
                </label>
                <select
                  value={cadTipo}
                  onChange={(e) => setCadTipo(e.target.value)}
                >
                  <option value="Investimento">Investimento</option>
                  <option value="Custeio">Custeio</option>
                  <option value="LCGH">LCGH</option>
                  <option value="LCGA">LCGA</option>
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
                  autoFocus
                  style={{ fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Projetista
                </label>
                <input
                  type="text"
                  value={cadProjetista}
                  onChange={(e) => setCadProjetista(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>CPF</label>
                <input
                  type="text"
                  value={cadCpf}
                  onChange={(e) =>
                    setCadCpf(aplicarMascaraCPF(e.target.value))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr',
                gap: '10px',
                marginBottom: '12px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Programa
                </label>
                <input
                  type="search"
                  list="dl_prog_org_multi"
                  value={cadPrograma}
                  onChange={(e) => setCadPrograma(e.target.value)}
                />
                <datalist id="dl_prog_org_multi">
                  {listaProgramas.map((pr) => (
                    <option key={pr} value={pr} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Responsável BNB
                </label>
                <input
                  type="text"
                  value={cadResponsavel}
                  onChange={(e) => setCadResponsavel(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  Data
                </label>
                <input
                  type="text"
                  value={cadData}
                  onChange={(e) =>
                    setCadData(aplicarMascaraDataBR(e.target.value))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '14px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setModalIniciarProposta(null);
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
                Pular Cadastro (Gerar FALTA PARECER GERENCIAL.txt)
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

      {/* OVERLAY DO CARD NA ABA PARECER GERENCIAL */}
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
              border: '1.5px solid #22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '11.5px',
            }}
          >
            <span>
              📂 Pasta ativa:{' '}
              <b style={{ color: '#4ade80' }}>{nomePastaSelecionada}</b> —
              Clique em <b>&ldquo;📥 Extrair .TXT&rdquo;</b> na aba abaixo para
              gravar direto na pasta do cliente!
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
            onAtualizarCards={(novosCards) => {
              setListaCards(novosCards);
              salvarKanbanSync(novosCards).catch(() => {});
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
            }}
            onAtualizarContratacoes={(novas) => {
              setListaContratacoes(novas);
              salvarContratacoesSync(novas).catch(() => {});
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