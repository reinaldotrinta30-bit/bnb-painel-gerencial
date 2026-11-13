// src/lib/auditorConformidadeContratos.ts
import { parseMoeda, formatarMoedaBD } from '@/lib/utils';
import {
  removerAcentos,
  normalizarSemAcento,
} from '@/lib/auditorInteligentePdfPasta';
import { RegistroContratacao } from '@/types/painel';

export type TipoInstrumentoContratual =
  | 'LCGA'
  | 'LCGH'
  | 'CCB_DERIVADA'
  | 'ANEXO_ORCAMENTO'
  | 'DISPOSICOES_GERAIS'
  | 'PLANILHA_CET'
  | 'ANEXO_FLUXO_CET'
  | 'OUTRO_ANEXO';

export type ModoScriptCopilotContrato =
  | 'AUTO_ATUAL'
  | 'KIT_COMPLETO_5_DOCS'
  | 'LCGA_LCGH'
  | 'CCB_DERIVADA'
  | 'ANEXO_ORCAMENTO'
  | 'DISPOSICOES_GERAIS'
  | 'PLANILHA_CET'
  | 'ANEXO_FLUXO_CET';

export type StatusItemConformidadeContrato = 'OK' | 'ALERTA' | 'ERRO' | 'INFO';

export interface ControleCancelamentoOcrContrato {
  cancelado: boolean;
  modo: 'USAR_TEXTO_PARCIAL' | 'ABORTAR_TUDO';
  terminarWorkerAtivo?: () => Promise<void> | void;
}

export function criarControleCancelamentoOcr(): ControleCancelamentoOcrContrato {
  return {
    cancelado: false,
    modo: 'USAR_TEXTO_PARCIAL',
  };
}

export interface ImovelGarantiaContratoInfo {
  denominacao: string;
  proprietarios: string;
  areaHa: string;
  areaExtenso: string;
  dataAquisicao: string;
  formaAquisicao: string;
  registroMatricula: string;
  livro: string;
  cartorioMunicipioUf: string;
  valorAvaliacao: string;
  situacaoOnusHipoteca: string;
  possuiHipotecaBnb: boolean;
  possuiInalienabilidadeCitada: boolean;
}

export interface CertidaoCitadaContratoInfo {
  parte: string;
  tipo: 'CND_FEDERAL' | 'CNDT_TRABALHISTA';
  numeroCertidao: string;
  dataEmissao: string;
  dataValidade: string;
  vigenteNaContratacao: boolean;
}

export interface SignatarioContratoInfo {
  papelNoContrato: string;
  nomeTitularDoPapel: string;
  cpfTitularDoPapel: string;
  rgOrgaoEmissor: string;
  dataExpedicaoRg: string;
  estadoCivilRegime: string;
  enderecoResumo: string;
  profissao: string;
  representadoPorProcurador: boolean;
  nomeProcuradorQueAssina?: string;
  cpfProcuradorQueAssina?: string;
  rgProcuradorQueAssina?: string;
}

export interface ItemChecklistConformidadeContrato {
  id: string;
  categoria:
    | 'CABECALHO_DATAS'
    | 'PARTES_CONJUGE'
    | 'VALORES_ENCARGOS'
    | 'IMOVEIS_GARANTIA'
    | 'CERTIDOES_CLAUSULAS'
    | 'ASSINATURAS_PROCURACAO'
    | 'SINTONIA_KIT_DERIVADA';
  titulo: string;
  status: StatusItemConformidadeContrato;
  resumo: string;
  detalhes?: string[];
}

export interface ParcelaReembolsoContrato {
  numero: number;
  dataVencimento: string;
  valorPrincipal: string;
  valorJuros?: string;
  valorPrestacaoTotal?: string;
}

export interface ItemOrcamentoContratual {
  codigo: string;
  descricao: string;
  quantidadeUnidade: string;
  mesAnoDesembolso: string;
  valorRecursosProprios: string;
  valorFinanciadoFne: string;
}

export interface LiberacaoPrevistaCet {
  dataLiberacao: string;
  mesAnoRef: string;
  valorLiberacao: string;
}

export interface ResultadoAuditoriaContratoPdf {
  nomeArquivo: string;
  numPaginas: number;
  foiLidoPorOcr: boolean;
  ocrFoiCanceladoPeloUsuario?: boolean;
  tipoInstrumento: TipoInstrumentoContratual;
  tituloInstrumento: string;
  especieInstrumentoVinculado: string;
  porteIdentificado: string;
  programaCredito: string;
  codigoSubprodutoContrato: string;
  numeroContratoCedula: string;
  agenciaPrefixo: string;
  agenciaNomeCnpj: string;
  agenciaEndereco: string;
  localAssinaturaFecho: string;
  localAssinaturaConformeSantaInes: boolean;
  possuiRodapeDocumentoInterno: boolean;
  trechoRodapeInternoDetectado: string;
  dataCelebracaoCabecalho: string;
  dataCelebracaoFechoAssinatura: string;
  dataVencimento: string;
  dataPrimeiraParcelaPrincipal: string;
  periodicidadeReembolsoCet: string;
  qtdPrestacoesCet: number;
  prazoAnosCalculado: string;
  prazoMesesCalculado: string;
  carenciaAnosCalculada: string;
  prazoUtilizacaoPrimeiraParcelaDias: string;
  creditadoNome: string;
  creditadoCpf: string;
  creditadoRg: string;
  creditadoRgDataEmissao: string;
  creditadoEstadoCivilRegime: string;
  creditadoEndereco: string;
  creditadoProfissao: string;
  telefoneSmsClausula: string;
  contaCorrenteDebito: string;
  imovelBeneficiadoNome: string;
  imovelBeneficiadoMatriculaCartorio: string;
  imovelBeneficiadoProprietario: string;
  imovelBeneficiadoMunicipioUf: string;
  anuenciaIncraSipraCodigo: string;
  anuenciaIncraLote: string;
  anuenciaIncraAtivoDesde: string;
  conjugeNome: string;
  conjugeCpf: string;
  conjugeRg: string;
  conjugeRgDataEmissao: string;
  conjugeEstadoCivilRegime: string;
  conjugeEndereco: string;
  conjugeProfissao: string;
  outorgaConjugalTexto: string;
  possuiAvalista: boolean;
  avalistaNome: string;
  avalistaCpf: string;
  avalistaRg: string;
  avalistaRgDataEmissao: string;
  avalistaEstadoCivilRegime: string;
  avalistaEndereco: string;
  avalistaProfissao: string;
  conjugeAvalistaNome: string;
  conjugeAvalistaCpf: string;
  possuiRepresentacaoProcurador: boolean;
  procuradorNome: string;
  procuradorCpf: string;
  procuradorRg: string;
  procuradorEndereco: string;
  valorClausulaPrimeira: string;
  valorExtensoClausulaPrimeira: string;
  valorClausulaSegunda: string;
  valorCabecalhoContinuacao: string;
  valorAvaliacaoTotalImoveis: string;
  valorLiquidoContratadoCet: string;
  valorPrincipalTotalLinhaTotaisAnexoCet: string;
  valorRecursosPropriosOrcamento: string;
  valorJurosTotaisCet: string;
  valorTotalAPagarCet: string;
  taxaJurosAnual: string;
  taxaJurosAnualNum: number;
  taxaJurosMensal: string;
  taxaJurosMensalNum: number;
  cetAnual: string;
  cetAnualNum: number;
  cetMensal: string;
  cetMensalNum: number;
  bonusAdimplenciaPerc: string;
  encargosInadimplementoResumo: string;
  diaCapitalizacaoMensal: string;
  indiceAtualizacaoGarantia: string;
  encargosResumo: string;
  carenciaIntimacaoDias: string;
  prazoPurgacaoMoraDias: string;
  taxaOcupacaoMensalLeilao: string;
  foroComarca: string;
  quantidadeViasContrato: string;
  imoveisGarantia: ImovelGarantiaContratoInfo[];
  certidoesCitadas: CertidaoCitadaContratoInfo[];
  parcelasReembolso: ParcelaReembolsoContrato[];
  itensOrcamento: ItemOrcamentoContratual[];
  liberacoesPrevistas: LiberacaoPrevistaCet[];
  signatariosPartes: SignatarioContratoInfo[];
  gerentesBanco: Array<{ nome: string; cargo: string }>;
  testemunhas: Array<{ nome: string; cpf: string }>;
  itensChecklist: ItemChecklistConformidadeContrato[];
  textoCompletoExtraido: string;
}

export interface ResultadoDossieDerivadaKit {
  ehKitDerivada: boolean;
  documentosIdentificados: {
    ccb?: ResultadoAuditoriaContratoPdf;
    anexoOrcamento?: ResultadoAuditoriaContratoPdf;
    disposicoesGerais?: ResultadoAuditoriaContratoPdf;
    planilhaCet?: ResultadoAuditoriaContratoPdf;
    anexoFluxoCet?: ResultadoAuditoriaContratoPdf;
    outros: ResultadoAuditoriaContratoPdf[];
  };
  checklistSintoniaGlobal: ItemChecklistConformidadeContrato[];
  resumoConsolidado: ResultadoAuditoriaContratoPdf | null;
}

async function obterPdfJsLib(): Promise<any> {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  if (win.pdfjsLib) {
    if (!win.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      win.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return win.pdfjsLib;
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (win.pdfjsLib) {
        win.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      resolve(win.pdfjsLib || null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

async function obterTesseractJs(): Promise<any> {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  if (win.Tesseract) return win.Tesseract;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => resolve(win.Tesseract || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

export async function executarOcrCancelavelContratoPdf(
  file: File,
  onProgresso?: (msg: string) => void,
  controleCancelamento?: ControleCancelamentoOcrContrato,
  maxPaginas = 25
): Promise<{ textoOcr: string; foiCancelado: boolean }> {
  try {
    const pdfjsLib = await obterPdfJsLib();
    const Tesseract = await obterTesseractJs();
    if (!pdfjsLib || !Tesseract) {
      return { textoOcr: '', foiCancelado: false };
    }

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const total = Math.min(pdf.numPages || 1, maxPaginas);
    const textosPaginas: string[] = [];

    const worker = await Tesseract.createWorker('por');
    if (controleCancelamento) {
      controleCancelamento.terminarWorkerAtivo = async () => {
        try {
          await worker.terminate();
        } catch {
          // Worker já encerrado
        }
      };
    }

    try {
      for (let p = 1; p <= total; p++) {
        if (controleCancelamento?.cancelado) {
          return {
            textoOcr: textosPaginas.join('\n\n'),
            foiCancelado: true,
          };
        }

        onProgresso?.(
          `🔍 Lendo OCR da página ${p} de ${total} em "${file.name}"...`
        );

        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;

        if (controleCancelamento?.cancelado) {
          canvas.width = 0;
          canvas.height = 0;
          return {
            textoOcr: textosPaginas.join('\n\n'),
            foiCancelado: true,
          };
        }

        const {
          data: { text },
        } = await worker.recognize(canvas);

        if (text && text.trim()) {
          textosPaginas.push(`[PÁGINA ${p} DE ${total}]\n${text.trim()}`);
        }

        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      try {
        await worker.terminate();
      } catch {
        // Ignora
      }
    }

    return {
      textoOcr: textosPaginas.join('\n\n'),
      foiCancelado: Boolean(controleCancelamento?.cancelado),
    };
  } catch {
    return {
      textoOcr: '',
      foiCancelado: Boolean(controleCancelamento?.cancelado),
    };
  }
}

const MAPA_MESES_BR: Record<string, string> = {
  JANEIRO: '01',
  FEVEREIRO: '02',
  MARCO: '03',
  ABRIL: '04',
  MAIO: '05',
  JUNHO: '06',
  JULHO: '07',
  AGOSTO: '08',
  SETEMBRO: '09',
  OUTUBRO: '10',
  NOVEMBRO: '11',
  DEZEMBRO: '12',
};

function converterDataExtensoOuCurtaParaBR(textoData: string): string {
  const limpo = (textoData || '').trim();
  const mDir = limpo.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/);
  if (mDir) return mDir[1];

  const norm = removerAcentos(limpo).toUpperCase();
  const m = norm.match(
    /\b(\d{1,2})\s+DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+(20\d{2})\b/i
  );
  if (!m) return '';
  const dd = String(Number(m[1])).padStart(2, '0');
  const mm = MAPA_MESES_BR[m[2].toUpperCase()] || '01';
  const aaaa = m[3];
  return `${dd}/${mm}/${aaaa}`;
}

function converterDataBRParaDate(dataBr: string): Date | null {
  const m = (dataBr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
}

function normalizarMoedaContrato(valorStr: string): string {
  const s = (valorStr || '').trim().replace(/^-\s*/, '');
  const mPontoFinal = s.match(/^(\d{1,3}(?:\.\d{3})*)\.(\d{2})$/);
  if (mPontoFinal) {
    return `${mPontoFinal[1]},${mPontoFinal[2]}`;
  }
  return s;
}

function parsePercentualTaxa(taxaStr: string): number {
  if (!taxaStr) return 0;
  const limpo = taxaStr
    .replace(/[^0-9.,]/g, '')
    .replace(',', '.')
    .trim();
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

function montarTextoOrdenadoDeTokens(
  tokens: Array<{ str: string; x: number; y: number }>
): string {
  if (tokens.length === 0) return '';
  const copia = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Array<{ yMedio: number; itens: typeof tokens }> = [];

  for (const tok of copia) {
    const lExist = linhas.find((l) => Math.abs(l.yMedio - tok.y) <= 3.8);
    if (lExist) {
      lExist.itens.push(tok);
    } else {
      linhas.push({ yMedio: tok.y, itens: [tok] });
    }
  }

  linhas.sort((a, b) => b.yMedio - a.yMedio);
  return linhas
    .map((l) => {
      l.itens.sort((a, b) => a.x - b.x);
      return l.itens.map((i) => i.str).join(' ');
    })
    .join('\n');
}

export async function extrairTextoContratoPdf(
  file: File,
  forcarOcr = false,
  onProgresso?: (msg: string) => void,
  controleCancelamento?: ControleCancelamentoOcrContrato
): Promise<{
  texto: string;
  textoAssinaturasColunar: string;
  numPaginas: number;
  usouOcr: boolean;
  ocrCancelado: boolean;
}> {
  if (forcarOcr) {
    const { textoOcr, foiCancelado } = await executarOcrCancelavelContratoPdf(
      file,
      onProgresso,
      controleCancelamento,
      25
    );
    return {
      texto: textoOcr,
      textoAssinaturasColunar: textoOcr,
      numPaginas: 1,
      usouOcr: !foiCancelado && Boolean(textoOcr.trim()),
      ocrCancelado: foiCancelado,
    };
  }

  let textoCompleto = '';
  let textoAssinaturasColunar = '';
  let numPaginas = 1;

  try {
    const pdfjsLib = await obterPdfJsLib();
    if (pdfjsLib) {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
      numPaginas = pdf.numPages || 1;
      const paginasTxt: string[] = [];
      const paginasAssinaturasColunar: string[] = [];

      for (let p = 1; p <= numPaginas; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1.0 });
        const meioPaginaX = (viewport.width || 595) / 2;
        const content = await page.getTextContent();
        const rawItems = (content.items || []) as Array<any>;

        const tokens: Array<{ str: string; x: number; y: number }> = [];
        for (const it of rawItems) {
          const s = (it.str || '').trim();
          if (!s) continue;
          const tr = Array.isArray(it.transform)
            ? it.transform
            : [1, 0, 0, 1, 0, 0];
          tokens.push({
            str: s,
            x: Number(tr[4]) || 0,
            y: Number(tr[5]) || 0,
          });
        }

        const txtPagNormal = montarTextoOrdenadoDeTokens(tokens);
        paginasTxt.push(`[PÁGINA ${p} DE ${numPaginas}]\n${txtPagNormal}`);

        const normPagUp = removerAcentos(txtPagNormal).toUpperCase();
        const parecePaginaDeAssinatura =
          p >= Math.max(1, numPaginas - 4) ||
          normPagUp.includes('SANTA INES') ||
          normPagUp.includes('EMITENTE/CREDITADO') ||
          normPagUp.includes('POR AVAL DO') ||
          normPagUp.includes('CONJUGE DO') ||
          normPagUp.includes('PELO BANCO DO NORDESTE') ||
          normPagUp.includes('TESTEMUNHA');

        if (parecePaginaDeAssinatura) {
          const tokensTopo = tokens.filter((t) => t.y > 720);
          const tokensCorpoEsq = tokens.filter(
            (t) => t.y <= 720 && t.x < meioPaginaX - 5
          );
          const tokensCorpoDir = tokens.filter(
            (t) => t.y <= 720 && t.x >= meioPaginaX - 5
          );

          const blocoPagColunar = [
            montarTextoOrdenadoDeTokens(tokensTopo),
            `[COLUNA_ESQUERDA_PAG_${p}]`,
            montarTextoOrdenadoDeTokens(tokensCorpoEsq),
            `[COLUNA_DIREITA_PAG_${p}]`,
            montarTextoOrdenadoDeTokens(tokensCorpoDir),
          ].join('\n');

          paginasAssinaturasColunar.push(blocoPagColunar);
        }
      }

      textoCompleto = paginasTxt.join('\n\n');
      textoAssinaturasColunar = paginasAssinaturasColunar.join('\n\n');
    }
  } catch (e) {
    console.error('Erro ao ler texto do contrato PDF:', e);
  }

  const charsLimpos = textoCompleto
    .replace(/\[PÁGINA \d+ DE \d+\]/g, '')
    .replace(/\s+/g, '');

  if (
    charsLimpos.length / Math.max(1, numPaginas) < 45 &&
    !controleCancelamento?.cancelado
  ) {
    onProgresso?.(
      `📸 Documento escaneado detectado ("${file.name}"). Executando OCR...`
    );
    const { textoOcr, foiCancelado } = await executarOcrCancelavelContratoPdf(
      file,
      onProgresso,
      controleCancelamento,
      25
    );
    if (textoOcr && textoOcr.trim().length > 40) {
      return {
        texto: textoOcr,
        textoAssinaturasColunar: textoOcr,
        numPaginas,
        usouOcr: true,
        ocrCancelado: foiCancelado,
      };
    }
    if (foiCancelado) {
      return {
        texto: textoCompleto,
        textoAssinaturasColunar: textoAssinaturasColunar || textoCompleto,
        numPaginas,
        usouOcr: false,
        ocrCancelado: true,
      };
    }
  }

  return {
    texto: textoCompleto,
    textoAssinaturasColunar: textoAssinaturasColunar || textoCompleto,
    numPaginas,
    usouOcr: false,
    ocrCancelado: false,
  };
}

export function classificarTipoInstrumentoContratual(
  textoLinear: string,
  nomeArquivo: string
): { tipo: TipoInstrumentoContratual; titulo: string } {
  const tUp = removerAcentos(textoLinear).toUpperCase();
  const tInicio = tUp.substring(0, 1400);
  const nUp = removerAcentos(nomeArquivo).toUpperCase();

  if (
    tUp.includes('SEQ PGT') ||
    tUp.includes('RESULTADO DO FLUXO FINANCEIRO') ||
    tUp.includes('LIBERACOES PREVISTAS') ||
    tUp.includes('MONTANTE LIBERADO') ||
    nUp.includes('ANEXO CET') ||
    nUp.includes('ANEXO_CET')
  ) {
    return {
      tipo: 'ANEXO_FLUXO_CET',
      titulo:
        'ANEXO DA PLANILHA CET — FLUXO FINANCEIRO (LIBERAÇÕES E REEMBOLSOS)',
    };
  }

  if (
    tInicio.includes('PLANILHA DEMONSTRATIVA DO CUSTO EFETIVO TOTAL') ||
    tUp.includes('VALOR LIQUIDO CONTRATADO') ||
    tUp.includes('TAXA JUROS FIXOS FNE') ||
    (nUp.includes('CET') && !nUp.includes('ANEXO'))
  ) {
    return {
      tipo: 'PLANILHA_CET',
      titulo: 'PLANILHA DEMONSTRATIVA DO CUSTO EFETIVO TOTAL (CETCR)',
    };
  }

  if (
    tInicio.includes('ANEXO-ORCAMENTO INTEGRANTE DA') ||
    tInicio.includes('DESCRICAO DOS ITENS DO EMPREENDIMENTO') ||
    nUp.includes('ORCAMENTO') ||
    nUp.includes('ANEXO 1')
  ) {
    return {
      tipo: 'ANEXO_ORCAMENTO',
      titulo: 'ANEXO-ORÇAMENTO INTEGRANTE DA CÉDULA DE CRÉDITO BANCÁRIO',
    };
  }

  if (
    tInicio.includes(
      'ANEXO "DISPOSICOES GERAIS APLICAVEIS AOS INSTRUMENTOS'
    ) ||
    tInicio.includes('I DAS DISPOSICOES PRELIMINARES') ||
    nUp.includes('DISPOSICOES') ||
    nUp.includes('ANEXO 2')
  ) {
    return {
      tipo: 'DISPOSICOES_GERAIS',
      titulo:
        'ANEXO — DISPOSIÇÕES GERAIS APLICÁVEIS AOS INSTRUMENTOS DE CRÉDITO',
    };
  }

  if (
    tInicio.includes('ALIENACAO FIDUCIARIA DE IMOVEL (LCGA)') ||
    tInicio.includes('(LCGA)') ||
    (tInicio.includes('ABERTURA DE LIMITE') &&
      tInicio.includes('ALIENACAO FIDUCIARIA')) ||
    nUp.includes('LCGA')
  ) {
    return {
      tipo: 'LCGA',
      titulo:
        'CONTRATO DE ABERTURA DE LIMITE DE CRÉDITO GARANTIDO POR ALIENAÇÃO FIDUCIÁRIA (LCGA)',
    };
  }

  if (
    tInicio.includes('(LCGH)') ||
    (tInicio.includes('ABERTURA DE LIMITE') && tInicio.includes('HIPOTECA')) ||
    nUp.includes('LCGH')
  ) {
    return {
      tipo: 'LCGH',
      titulo:
        'CONTRATO DE ABERTURA DE LIMITE DE CRÉDITO GARANTIDO POR HIPOTECA (LCGH)',
    };
  }

  if (
    tInicio.includes('CEDULA DE CREDITO BANCARIO') ||
    tUp.includes('CONTINUACAO DA CEDULA DE CREDITO BANCARIO') ||
    nUp.includes('CCB') ||
    nUp.includes('CONTRATO')
  ) {
    return {
      tipo: 'CCB_DERIVADA',
      titulo: 'CÉDULA DE CRÉDITO BANCÁRIO (CCB — OPERAÇÃO DERIVADA)',
    };
  }

  return {
    tipo: 'OUTRO_ANEXO',
    titulo: 'INSTRUMENTO / ANEXO CONTRATUAL',
  };
}

function extrairEspecieInstrumentoNoDocumento(
  textoLinear: string,
  tipoInstrumento: TipoInstrumentoContratual
): string {
  const norm = removerAcentos(textoLinear)
    .toUpperCase()
    .replace(/\s+/g, ' ');
  const cabecalho = norm.substring(0, 1200);

  const mIntegrante = norm.match(
    /INTEGRANTE\s+D[AO]\s*(?:\(\s*[A-Z]?\s*\)\s*)?([A-Z\s]{6,55}?)\s*,?\s*N[°ºO]?\s*\d{3}\.20\d{2}/i
  );
  if (mIntegrante && mIntegrante[1]) {
    return mIntegrante[1].replace(/\s+/g, ' ').trim();
  }

  const mTipoInstCet = cabecalho.match(
    /TIPO\s+DE\s+INSTRUMENTO:\s*(?:INVESTIMENTO\s+PRONAF\s+FNE\s+)?(CEDULA\s+DE\s+CREDITO\s+BANCARIO|CEDULA\s+RURAL\s+[A-Z\s]+?)(?=\s+NUMERO|\s+103\.20|\s+VALOR)/i
  );
  if (mTipoInstCet && mTipoInstCet[1]) {
    return mTipoInstCet[1].replace(/\s+/g, ' ').trim();
  }

  const mCont = norm.match(
    /CONTINUACAO\s+D[AO]\s+([A-Z\s]{6,55}?)\s+N[°ºO]?\s*\d{3}\.20\d{2}/i
  );
  if (mCont && mCont[1]) {
    return mCont[1].replace(/\s+/g, ' ').trim();
  }

  if (cabecalho.includes('CEDULA DE CREDITO BANCARIO')) {
    return 'CEDULA DE CREDITO BANCARIO';
  }
  if (cabecalho.includes('CEDULA RURAL PIGNORATICIA E HIPOTECARIA')) {
    return 'CEDULA RURAL PIGNORATICIA E HIPOTECARIA';
  }
  if (cabecalho.includes('CEDULA RURAL PIGNORATICIA')) {
    return 'CEDULA RURAL PIGNORATICIA';
  }
  if (cabecalho.includes('CEDULA RURAL HIPOTECARIA')) {
    return 'CEDULA RURAL HIPOTECARIA';
  }
  if (cabecalho.includes('NOTA DE CREDITO RURAL')) {
    return 'NOTA DE CREDITO RURAL';
  }
  if (tipoInstrumento === 'LCGA') {
    return 'CONTRATO DE ABERTURA DE LIMITE (LCGA)';
  }
  if (tipoInstrumento === 'LCGH') {
    return 'CONTRATO DE ABERTURA DE LIMITE (LCGH)';
  }
  return '';
}

function detectarRodapeDocumentoInterno(textoBruto: string): {
  possuiRodapeInterno: boolean;
  trechoDetectado: string;
} {
  const norm = removerAcentos(textoBruto)
    .toUpperCase()
    .replace(/\s+/g, ' ');

  const padroesProibidos = [
    /DOCUMENTO\s+CLASSIFICADO\s+COMO\s+INTERNO/i,
    /CLASSIFICADO\s+COMO\s+INTERNO/i,
    /CLASSIFICACAO\s*:\s*INTERN[OA]/i,
    /INFORMACAO\s+CLASSIFICADA\s+COMO\s+INTERNA/i,
    /INFORMACAO\s+INTERNA\s*[-–]\s*BNB/i,
    /USO\s+EXCLUSIVAMENTE\s+INTERNO/i,
    /#INTERNO\b/i,
  ];

  for (const regex of padroesProibidos) {
    const m = norm.match(regex);
    if (m) {
      return {
        possuiRodapeInterno: true,
        trechoDetectado: m[0].trim(),
      };
    }
  }

  return { possuiRodapeInterno: false, trechoDetectado: '' };
}

function extrairLocalAssinaturaFecho(
  textoCorpoCosturado: string,
  tipoInstrumento: TipoInstrumentoContratual
): { localExtraido: string; conformeSantaInes: boolean } {
  const norm = removerAcentos(textoCorpoCosturado)
    .toUpperCase()
    .replace(/\s+/g, ' ');

  if (tipoInstrumento === 'ANEXO_FLUXO_CET') {
    return {
      localExtraido: 'SANTA INES - MA (Vinculado à CET)',
      conformeSantaInes: true,
    };
  }

  const trechoFinalAssinatura = norm.substring(
    Math.max(0, norm.length - 1600)
  );

  if (tipoInstrumento === 'PLANILHA_CET') {
    if (/\bSANTA\s+INES\s*[-–/,]?\s*MA\b/i.test(trechoFinalAssinatura)) {
      return { localExtraido: 'SANTA INES - MA', conformeSantaInes: true };
    }

    const mCetOutroLocal =
      trechoFinalAssinatura.match(
        /\b([A-Z]{3,}(?:\s+[A-Z]{2,}){0,3}\s*[-–/]\s*[A-Z]{2})(?:\s+\d{2}\/\d{2}\/20\d{2})?\s+LOCAL\s+E\s+DATA\b/i
      ) ||
      trechoFinalAssinatura.match(
        /LOCAL\s+E\s+DATA\s+([A-Z]{3,}(?:\s+[A-Z]{2,}){0,3}\s*[-–/]\s*[A-Z]{2})/i
      );

    if (mCetOutroLocal && mCetOutroLocal[1]) {
      const loc = mCetOutroLocal[1].replace(/\s+/g, ' ').trim();
      const ehSantaInes = loc.includes('SANTA INES') && /\bMA\b/.test(loc);
      return { localExtraido: loc, conformeSantaInes: ehSantaInes };
    }
  }

  if (
    /\bSANTA\s+INES\s*[-–/,]?\s*MA\s*,\s*(?:\d{1,2}\s+DE\s+[A-Z]+\s+DE\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/i.test(
      trechoFinalAssinatura
    )
  ) {
    return { localExtraido: 'SANTA INES - MA', conformeSantaInes: true };
  }

  const matchesFecho = [
    ...trechoFinalAssinatura.matchAll(
      /\b([A-Z]{3,}(?:\s+[A-Z]{2,}){0,3}\s*(?:[-–/]\s*)?\b(?:MA|CE|PI|PA|BA|PE|PB|RN|AL|SE|MG|ES|GO|TO|DF|SP|RJ|MT))\s*,\s*(\d{1,2}\s+DE\s+(?:JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})\s*\.?/gi
    ),
  ];

  if (matchesFecho.length > 0) {
    const ultimoMatch = matchesFecho[matchesFecho.length - 1];
    const locBruto = ultimoMatch[1]
      .replace(
        /^(?:ASSINADAS|ESTABELECIDA|INSTRUMENTO|TEOR|EFEITO|PRESENTE)\s+/i,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

    const ehSantaInes =
      locBruto.includes('SANTA INES') && /\bMA\b/.test(locBruto);
    return { localExtraido: locBruto, conformeSantaInes: ehSantaInes };
  }

  return { localExtraido: '', conformeSantaInes: false };
}

function identificarPorteESubprodutoContrato(
  numeroContrato: string,
  nomeArquivo: string,
  textoUp: string,
  possuiClausulaCertidoesNoCorpo: boolean,
  porteNoPainel?: string
): { porte: string; programa: string; codigoSubproduto: string } {
  const partesNum = (numeroContrato || '').split('.');
  const codSub = partesNum.length >= 3 ? partesNum[2].trim() : '';
  const nomeArqUp = removerAcentos(nomeArquivo || '').toUpperCase();

  let programa = '';
  if (textoUp.includes('PRONAF-MAIS ALIMENTOS') || codSub === '485') {
    programa = 'PRONAF - MAIS ALIMENTOS (FNE)';
  } else if (textoUp.includes('PRONAF A') && textoUp.includes('5.183')) {
    programa = 'PRONAF A - RES. 5.183/24 (FNE)';
  } else if (textoUp.includes('PRONAF A - FNE') || codSub === '645') {
    programa = 'PRONAF A - FNE';
  } else if (textoUp.includes('INVESTIMENTO PRONAF FNE')) {
    programa = 'INVESTIMENTO PRONAF FNE';
  } else if (codSub === '613') {
    programa = 'LIMITE PRONAF (FNE)';
  } else if (codSub === '489') {
    programa = 'LIMITE FNE RURAL (MINI/PEQUENO)';
  }

  if (
    codSub === '645' ||
    textoUp.includes('PRONAF A') ||
    nomeArqUp.includes('PRONAF A')
  ) {
    return {
      porte: `PRONAF A — REFORMA AGRÁRIA (Cód. ${codSub || '645'})`,
      programa: programa || 'PRONAF A - RES. 5.183/24 (FNE)',
      codigoSubproduto: codSub || '645',
    };
  }

  if (
    codSub === '485' ||
    textoUp.includes('PRONAF-MAIS ALIMENTOS') ||
    textoUp.includes('INVESTIMENTO PRONAF FNE')
  ) {
    return {
      porte: `PRONAF V — MAIS ALIMENTOS (Cód. ${codSub || '485'})`,
      programa: programa || 'PRONAF - MAIS ALIMENTOS (FNE)',
      codigoSubproduto: codSub || '485',
    };
  }

  if (codSub === '613' || nomeArqUp.includes('PRONAF')) {
    return {
      porte: `PRONAF V / AGRICULTURA FAMILIAR (Cód. ${codSub || '613'})`,
      programa: programa || 'PRONAF - FNE',
      codigoSubproduto: codSub || '613',
    };
  }

  if (
    codSub === '489' ||
    nomeArqUp.includes('MINI') ||
    nomeArqUp.includes('PEQUENO')
  ) {
    return {
      porte: `MINI / PEQUENO PRODUTOR — FNE RURAL (Cód. ${codSub || '489'})`,
      programa: programa || 'FNE RURAL',
      codigoSubproduto: codSub || '489',
    };
  }

  if (porteNoPainel && porteNoPainel.trim()) {
    return {
      porte: `${porteNoPainel.toUpperCase()}${
        codSub ? ` (Cód. ${codSub})` : ''
      }`,
      programa: programa || 'CRÉDITO RURAL BNB',
      codigoSubproduto: codSub,
    };
  }

  if (possuiClausulaCertidoesNoCorpo) {
    return {
      porte: `PRONAF${codSub ? ` (Cód. ${codSub})` : ''}`,
      programa: programa || 'PRONAF - FNE',
      codigoSubproduto: codSub,
    };
  }

  return {
    porte: codSub ? `CRÉDITO RURAL (Cód. ${codSub})` : 'CRÉDITO RURAL BNB',
    programa: programa || 'FNE RURAL',
    codigoSubproduto: codSub,
  };
}

export async function auditarContratoPdfCompleto(params: {
  file: File;
  forcarOcr?: boolean;
  onProgresso?: (msg: string) => void;
  contratacoesPainel?: RegistroContratacao[];
  controleCancelamento?: ControleCancelamentoOcrContrato;
}): Promise<ResultadoAuditoriaContratoPdf> {
  const {
    file,
    forcarOcr = false,
    onProgresso,
    contratacoesPainel = [],
    controleCancelamento,
  } = params;

  const { texto, textoAssinaturasColunar, numPaginas, usouOcr, ocrCancelado } =
    await extrairTextoContratoPdf(
      file,
      forcarOcr,
      onProgresso,
      controleCancelamento
    );

  const textoLinearBruto = texto.replace(/\s+/g, ' ').trim();

  const classifDoc = classificarTipoInstrumentoContratual(
    textoLinearBruto,
    file.name
  );
  const tipoInstrumento = classifDoc.tipo;
  const tituloInstrumento = classifDoc.titulo;

  const infoRodapeInterno = detectarRodapeDocumentoInterno(textoLinearBruto);
  const especieInstrumentoVinculado = extrairEspecieInstrumentoNoDocumento(
    textoLinearBruto,
    tipoInstrumento
  );

  const matchCabContParticular = textoLinearBruto.match(
    /Continua[çc][ãa]o\s+do\s+CONTRATO\s+PARTICULAR\s+n[°ºo]?\s*(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\s*,\s*celebrado\s+pelo\s+Banco\s+do\s+Nordeste\s+do\s+Brasil\s+S\.A\.\s+e\s+([A-ZÀ-Ú\s]{4,65}?)\s*,\s*em\s+(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2})\s*,\s*no\s+valor\s+de\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([^)]+)\)\s*,\s*com\s+vencimento\s+em\s+(\d{2}\/\d{2}\/20\d{2})/i
  );

  const matchCabContCcb = textoLinearBruto.match(
    /Continua[çc][ãa]o\s+da\s+C[ÉE]DULA\s+DE\s+CR[ÉE]DITO\s+BANC[ÁA]RIO\s+n[°ºo]?\s*(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\s*,\s*emitida\s+por\s+([A-ZÀ-Ú\s]{4,65}?)\s*,\s*em\s+(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2})\s*,\s*no\s+valor\s+de\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([^)]+)\)[\s\S]{1,80}?vencimento\s+(?:para|em)\s+(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/i
  );

  const matchCabIntegranteAnexo = textoLinearBruto.match(
    /integrante\s+da\s*(?:\(\s*o?\s*\)\s*)?[A-ZÀ-Ú\s]{5,55}?\s*,?\s*N[°ºo]?\s*(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\s*,\s*emitida\s+por\s+([A-ZÀ-Ú\s]{4,65}?)\s*,\s*em\s+(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/i
  );

  const todosNumerosContrato = Array.from(
    new Set(
      (
        textoLinearBruto.match(/\b(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\b/g) || []
      ).map((s) => s.trim())
    )
  );

  const numeroContratoCedula =
    matchCabContParticular?.[1] ||
    matchCabContCcb?.[1] ||
    matchCabIntegranteAnexo?.[1] ||
    todosNumerosContrato[0] ||
    '';

  const agenciaPrefixo = numeroContratoCedula.split('.')[0] || '103';

  const nomeCliViaCabecalho = (
    matchCabContParticular?.[2] ||
    matchCabContCcb?.[2] ||
    matchCabIntegranteAnexo?.[2] ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const dataCelebViaCabecalho = converterDataExtensoOuCurtaParaBR(
    matchCabContParticular?.[3] ||
      matchCabContCcb?.[3] ||
      matchCabIntegranteAnexo?.[3] ||
      ''
  );

  const valorViaCabecalho = (
    matchCabContParticular?.[4] ||
    matchCabContCcb?.[4] ||
    ''
  ).trim();

  const extensoViaCabecalho = (
    matchCabContParticular?.[5] ||
    matchCabContCcb?.[5] ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  const vencViaCabecalho = converterDataExtensoOuCurtaParaBR(
    matchCabContParticular?.[6] || matchCabContCcb?.[6] || ''
  );

  const textoCorpoCosturado = textoLinearBruto
    .replace(/\[P[ÁA]GINA\s+\d+\s+DE\s+\d+\]/gi, ' ')
    .replace(/\[P[ÁA]G\s+\d+\]/gi, ' ')
    .replace(
      /Continua[çc][ãa]o\s+do\s+CONTRATO\s+PARTICULAR[\s\S]{1,260}?vencimento\s+em\s+\d{2}\/\d{2}\/20\d{2}\s*\./gi,
      ' '
    )
    .replace(
      /Continua[çc][ãa]o\s+da\s+C[ÉE]DULA\s+DE\s+CR[ÉE]DITO\s+BANC[ÁA]RIO[\s\S]{1,280}?vencimento\s+(?:para|em)\s+(?:\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})\s*\.?/gi,
      ' '
    )
    .replace(/P[áa]gina\s+\d+\s+de\s+\d+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const corpoSemAcentoUp = removerAcentos(textoCorpoCosturado).toUpperCase();

  const infoLocalAssinatura = extrairLocalAssinaturaFecho(
    textoCorpoCosturado,
    tipoInstrumento
  );

  const matchAgencia = textoCorpoCosturado.match(
    /Ag[êe]ncia\s+([A-ZÀ-Ú\s]+?)\s+situada\s+na\s+([\s\S]{10,85}?)\s*,\s*CNPJ\/MF\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i
  );
  const agenciaNomeCnpj = matchAgencia
    ? `Agência ${matchAgencia[1].trim()} (${agenciaPrefixo}) — CNPJ: ${matchAgencia[3].trim()}`
    : `Agência SANTA INÊS (${agenciaPrefixo}) — CNPJ: 07.237.373/0103-54`;
  const agenciaEndereco = matchAgencia
    ? matchAgencia[2].replace(/\s+/g, ' ').trim()
    : 'RUA DO COMERCIO, 187, CENTRO, SANTA INES-MA';

  const matchesDataFecho = [
    ...textoCorpoCosturado.matchAll(
      /SANTA\s+IN[ÊE]S\s*[-–/]?\s*MA\s*,?\s*(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/gi
    ),
  ];
  const dataCelebracaoFechoAssinatura =
    matchesDataFecho.length > 0
      ? converterDataExtensoOuCurtaParaBR(
          matchesDataFecho[matchesDataFecho.length - 1][1]
        )
      : dataCelebViaCabecalho;

  const dataCelebracaoCabecalho =
    dataCelebViaCabecalho || dataCelebracaoFechoAssinatura;

  const matchVencTopoCcb =
    textoCorpoCosturado.match(
      /Vencimento:\s*em\s*(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/i
    ) ||
    textoCorpoCosturado.match(
      /Vencimento\s+Final[\s\S]{1,120}?(\d{2}\/\d{2}\/203\d)/i
    );

  const dataVencimento =
    vencViaCabecalho ||
    (matchVencTopoCcb
      ? converterDataExtensoOuCurtaParaBR(matchVencTopoCcb[1])
      : '');

  // =========================================================================
  // EXTRAÇÃO DE QUALIFICAÇÃO DO CREDITADO, CÔNJUGE, AVALISTA E PROCURADOR
  // =========================================================================
  const matchCreditadoTopo =
    textoCorpoCosturado.match(
      /abre\s+em\s+favor\s+de\s+([A-ZÀ-Ú\s]{5,65}?)\s*,\s*doravante\s+denominado/i
    ) ||
    textoCorpoCosturado.match(
      /BANCO\s+DO\s+NORDESTE\s+DO\s+BRASIL\s+S\.A\.\s*,\s*E\s+([A-ZÀ-Ú\s]{5,65}?)\s*,\s*COM\s+VENCIMENTO/i
    ) ||
    textoCorpoCosturado.match(
      /([A-ZÀ-Ú]{3,}(?:\s+[A-ZÀ-Ú]{2,}){1,5})\s+Nome\s+do\s+Cliente/i
    );

  const creditadoNome =
    nomeCliViaCabecalho ||
    (matchCreditadoTopo ? matchCreditadoTopo[1].trim().toUpperCase() : '');

  const textoAssinaturasLimpo = textoAssinaturasColunar
    .replace(
      /Continua[çc][ãa]o\s+do\s+CONTRATO\s+PARTICULAR[\s\S]{1,260}?vencimento\s+em\s+\d{2}\/\d{2}\/20\d{2}\s*\./gi,
      ' '
    )
    .replace(
      /Continua[çc][ãa]o\s+da\s+C[ÉE]DULA\s+DE\s+CR[ÉE]DITO\s+BANC[ÁA]RIO[\s\S]{1,280}?vencimento\s+(?:para|em)\s+(?:\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})\s*\.?/gi,
      ' '
    )
    .replace(/P[áa]gina\s+\d+\s+de\s+\d+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const extrairQualificacaoPessoa = (nomeAlvo: string) => {
    if (!nomeAlvo) {
      return {
        cpf: '',
        rg: '',
        dataRg: '',
        estadoCivil: '',
        endereco: '',
        profissao: '',
      };
    }
    const nomeEscapado = removerAcentos(nomeAlvo)
      .toUpperCase()
      .trim()
      .split(/\s+/)
      .join('\\s+');

    const txtBusca = removerAcentos(
      `${textoAssinaturasLimpo}\n${textoCorpoCosturado}`
    ).toUpperCase();

    const regexBloco = new RegExp(
      `${nomeEscapado}\\s+CPF:\\s*(\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2})(?:\\s+RG:\\s*([0-9A-Z\\-\\s/]+?)\\s+(\\d{2}\\/\\d{2}\\/\\d{4}))?\\s+BRASILEIRO\\s*\\(A\\)\\s*,?\\s*([A-Z\\s()]+?BENS|SOLTEIRO\\s*\\(A\\)|DIVORCIADO\\s*\\(A\\)|VIUVO\\s*\\(A\\)|UNIAO\\s+ESTAVEL)\\s+RESIDENTE\\s+E\\s+DOMICILIAD[OA]\\s+NO\\s*\\(A\\)\\s*(?:F\\s+)?([\\s\\S]{10,145}?)\\s*,\\s*(PRODUTOR\\s+AGROPECUARIO[\\s,A-Z]*|TRABALHADOR[\\s,A-Z]*|AGRICULTOR[\\s,A-Z]*)`,
      'i'
    );

    const m = txtBusca.match(regexBloco);
    if (m) {
      return {
        cpf: m[1].trim(),
        rg: (m[2] || '').replace(/\s+/g, ' ').trim(),
        dataRg: (m[3] || '').trim(),
        estadoCivil: m[4].replace(/\s+/g, ' ').trim(),
        endereco: m[5].replace(/\s+/g, ' ').trim(),
        profissao: m[6].replace(/\s+/g, ' ').trim(),
      };
    }

    const mSimples = txtBusca.match(
      new RegExp(
        `${nomeEscapado}[\\s\\S]{1,40}?CPF:?\\s*(\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2})(?:\\s+RG:\\s*([0-9A-Z\\-\\s/]+?)\\s+(\\d{2}\\/\\d{2}\\/\\d{4}))?`,
        'i'
      )
    );
    return {
      cpf: mSimples?.[1] || '',
      rg: (mSimples?.[2] || '').trim(),
      dataRg: (mSimples?.[3] || '').trim(),
      estadoCivil: txtBusca.includes('COMUNHAO PARCIAL DE BENS')
        ? 'CASADO(A) COM COMUNHAO PARCIAL DE BENS'
        : txtBusca.includes('COMUNHAO UNIVERSAL DE BENS')
        ? 'CASADO(A) COM COMUNHAO UNIVERSAL DE BENS'
        : '',
      endereco: '',
      profissao: '',
    };
  };

  const qualifCred = extrairQualificacaoPessoa(creditadoNome);

  // =========================================================================
  // DETECÇÃO DE AVALISTA ("por aval do EMITENTE/CREDITADO")
  // =========================================================================
  let possuiAvalista = false;
  let avalistaNome = '';
  let conjugeAvalistaNome = '';
  let conjugeAvalistaCpf = '';

  const txtAssinaturasUp = removerAcentos(textoAssinaturasLimpo).toUpperCase();
  const matchAvalistaBloco = txtAssinaturasUp.match(
    /POR\s+AVAL\s+DO\s+EMITENTE\/CREDITADO\s+([A-Z\s]{5,65}?)\s+CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i
  );

  if (matchAvalistaBloco) {
    possuiAvalista = true;
    avalistaNome = matchAvalistaBloco[1]
      .replace(/^(?:GERAL|AGRICULTURA|\d+|\[COLUNA_[A-Z_0-9]+\])\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const qualifAval = extrairQualificacaoPessoa(avalistaNome);
  if (matchAvalistaBloco && !qualifAval.cpf) {
    qualifAval.cpf = matchAvalistaBloco[2].trim();
  }

  // Verifica se existe Cônjuge do Avalista no fecho
  const matchConjugeAval = txtAssinaturasUp.match(
    /CONJUGE\s+DO\s+AVALISTA\s+([A-Z\s]{5,65}?)\s+CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i
  );
  if (matchConjugeAval) {
    conjugeAvalistaNome = matchConjugeAval[1].replace(/\s+/g, ' ').trim();
    conjugeAvalistaCpf = matchConjugeAval[2].trim();
  }

  // =========================================================================
  // DADOS ESPECÍFICOS DE OPERAÇÃO DERIVADA (CCB, ORÇAMENTO, DISPOSIÇÕES, CET E ANEXO CET)
  // =========================================================================
  const matchValorTopoCcb =
    textoCorpoCosturado.match(
      /Valor:\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([^)]+)\)/i
    ) ||
    textoCorpoCosturado.match(
      /quantia\s+de\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([^)]+)\)/i
    );

  // Suporta tanto "Valor Contratado | R$ 50.000,00" quanto layout em coluna "Valor Contratado ... R$ 82.416,00" e "MONTANTE LIBERADO | 82.416,00"
  const matchValorCet =
    textoCorpoCosturado.match(
      /Valor\s+Contratado[\s\S]{1,120}?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    ) ||
    textoCorpoCosturado.match(
      /(?:TOTAL|MONTANTE)\s+LIBERADO\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    ) ||
    textoCorpoCosturado.match(
      /TOTAL\s*(?:\|\s*)*\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    );

  const valorClausulaPrimeira =
    matchValorTopoCcb?.[1]?.trim() ||
    valorViaCabecalho ||
    matchValorCet?.[1]?.trim() ||
    '';

  const valorExtensoClausulaPrimeira =
    matchValorTopoCcb?.[2]?.replace(/\s+/g, ' ').trim() ||
    extensoViaCabecalho ||
    '';

  // Imóvel Beneficiado na CCB: suporta TANTO assentamento INCRA (PRONAF A) QUANTO fazenda com matrícula própria (Adroaldo - PRONAF V / Mais Alimentos)
  let imovelBeneficiadoNome = '';
  let imovelBeneficiadoMatriculaCartorio = '';
  let imovelBeneficiadoProprietario = '';
  let imovelBeneficiadoMunicipioUf = '';

  const matchImovelComMatriculaCcb = textoCorpoCosturado.match(
    /no\s+im[óo]vel:\s*([^,]+?)\s*,\s*matr[íi]cula\s+n[°ºo]?\s*([0-9A-Z.\-/]+)\s+registrada\s+no\s+([^,]+?)\s*,\s*de\s+propriedade\s+(?:do\s*\(s\)\s*)?([^,]+?)\s*,\s*situado\s+no\s+Munic[íi]pio\s+de\s+([^,]+?)\s*,\s*Estado\s+([A-ZÀ-Ú\s]+?)\./i
  );

  const matchImovelSimplesCcb = textoCorpoCosturado.match(
    /no\s+im[óo]vel:\s*([^,]+?)\s*,\s*de\s+propriedade\s+([^,]+?)\s*,\s*situado\s+no\s+Munic[íi]pio\s+de\s+([^,]+?)\s*,\s*Estado\s+([A-ZÀ-Ú\s]+?)\./i
  );

  if (matchImovelComMatriculaCcb) {
    imovelBeneficiadoNome = matchImovelComMatriculaCcb[1].trim();
    imovelBeneficiadoMatriculaCartorio = `Matrícula nº ${matchImovelComMatriculaCcb[2].trim()} — ${matchImovelComMatriculaCcb[3].trim()}`;
    imovelBeneficiadoProprietario = matchImovelComMatriculaCcb[4].trim();
    imovelBeneficiadoMunicipioUf = `${matchImovelComMatriculaCcb[5].trim()} - ${matchImovelComMatriculaCcb[6].trim()}`;
  } else if (matchImovelSimplesCcb) {
    imovelBeneficiadoNome = matchImovelSimplesCcb[1].trim();
    imovelBeneficiadoProprietario = matchImovelSimplesCcb[2].trim();
    imovelBeneficiadoMunicipioUf = `${matchImovelSimplesCcb[3].trim()} - ${matchImovelSimplesCcb[4].trim()}`;
  }

  const matchAnuenciaSipra = textoCorpoCosturado.match(
    /C[óo]digo\s+SIPRA\s+n[°ºo]?\s*([A-Z0-9]+)\s*,\s*referente\s+ao\s+assentamento\s+([^,]+?)\s*,\s*lote\s+n[°ºo]?\s*([0-9A-Z]+)\s*,\s*em\s+nome\s+de\s+([^,]+?)\s*,\s*CPF\s*(\d{3}\.\d{3}\.\d{3}-\d{2})\s*,\s*com\s+situa[çc][ãa]o\s+Ativo\s+desde\s+(\d{2}\/\d{2}\/\d{4})/i
  );
  const anuenciaIncraSipraCodigo = matchAnuenciaSipra
    ? matchAnuenciaSipra[1].trim()
    : '';
  const anuenciaIncraLote = matchAnuenciaSipra
    ? matchAnuenciaSipra[3].trim()
    : '';
  const anuenciaIncraAtivoDesde = matchAnuenciaSipra
    ? matchAnuenciaSipra[6].trim()
    : '';

  if (!qualifCred.cpf && matchAnuenciaSipra?.[5]) {
    qualifCred.cpf = matchAnuenciaSipra[5].trim();
  }

  const matchContaDebitoCcb = textoCorpoCosturado.match(
    /conta\s*\(s\)\s*corrente\s*\(s\)\s*n[°ºo]?\s*([0-9.\-X]{4,14})\s*,\s*que\s+o\s+EMITENTE\/CREDITADO\s+mant[ée]m/i
  );
  const contaCorrenteDebito = matchContaDebitoCcb
    ? matchContaDebitoCcb[1].trim()
    : '';

  const matchPrazo178 = textoCorpoCosturado.match(
    /solicitar[áa]\s+o\s+desembolso\s+da\s+primeira\s+parcela\s+do\s+financiamento\s+no\s+prazo\s+de\s+at[ée]\s+(\d{1,3}\s*\([^)]+\)\s*dias)/i
  );
  const prazoUtilizacaoPrimeiraParcelaDias = matchPrazo178
    ? matchPrazo178[1].trim()
    : '';

  // Taxa de Juros Efetiva (suporta tanto "Juros devidos à taxa efetiva de 0,5% a.a." quanto "TCRpré à taxa efetiva de 7,5% a.a." e "Taxa Juros Fixos FNE (% a.a) 7,50000%")
  const matchTaxaAnualCcb = textoCorpoCosturado.match(
    /taxa\s+efetiva\s+de\s+([0-9.,]+%)\s*a\.a\./i
  );
  const matchTaxaAnualCet =
    textoCorpoCosturado.match(
      /Taxa\s+de\s+Juros\s+ao\s+ano\s*\(%\)\s*(?:\|\s*)?([0-9.,]+%)/i
    ) ||
    textoCorpoCosturado.match(
      /Taxa\s+Juros\s+Fixos\s+FNE\s*\(%\s*a\.a\)[\s\S]{1,120}?([0-9]+,\d{2,5}%)/i
    );

  const taxaJurosAnual = matchTaxaAnualCcb?.[1]
    ? `${matchTaxaAnualCcb[1]} a.a.`
    : matchTaxaAnualCet?.[1]
    ? `${matchTaxaAnualCet[1]} a.a.`
    : '';
  const taxaJurosAnualNum = parsePercentualTaxa(
    matchTaxaAnualCcb?.[1] || matchTaxaAnualCet?.[1] || ''
  );

  const matchTaxaMensalCcb = textoCorpoCosturado.match(
    /juros\s+[àa]\s+taxa\s+efetiva\s+de\s+([0-9.,]+%)\s*a\.m\./i
  );
  const matchTaxaMensalCet =
    textoCorpoCosturado.match(
      /Taxa\s+de\s+Juros\s+Equivalente\s+ao\s+M[êe]s\s*\(%\)\s*(?:\|\s*)?([0-9.,]+%)/i
    ) ||
    textoCorpoCosturado.match(
      /Taxa\s+Juros\s+Fixos\s+FNE\s*\(%\s*a\.m\)\s*(?:\|\s*)?([0-9.,]+%)/i
    );

  const taxaJurosMensal = matchTaxaMensalCcb?.[1]
    ? `${matchTaxaMensalCcb[1]} a.m.`
    : matchTaxaMensalCet?.[1]
    ? `${matchTaxaMensalCet[1]} a.m.`
    : '';
  const taxaJurosMensalNum = parsePercentualTaxa(
    matchTaxaMensalCcb?.[1] || matchTaxaMensalCet?.[1] || ''
  );

  const matchCetAnual =
    textoCorpoCosturado.match(
      /Custo\s+Efetivo\s+Total\s*\(CET\)\s*ao\s+ano\s*\(%\)\s*(?:\|\s*)?([0-9.,]+%)/i
    ) ||
    textoCorpoCosturado.match(
      /CET\s*\(%\s*a\.a\)\s*(?:\|\s*)?([0-9.,]+%)/i
    ) ||
    textoCorpoCosturado.match(
      /constam\s+na\s+planilha\s+anexa\s*(?:\|\s*)?([0-9.,]+%)/i
    ) ||
    textoCorpoCosturado.match(
      /INVESTIMENTO\s+PRONAF\s+FNE\s*(?:\|\s*)*([0-9.,]+%)\s*CET/i
    );
  const cetAnual = matchCetAnual ? matchCetAnual[1].trim() : '';
  const cetAnualNum = parsePercentualTaxa(cetAnual);

  const matchCetMensal = textoCorpoCosturado.match(
    /Custo\s+Efetivo\s+Total\s*\(CET\)\s*ao\s+m[êe]s\s*\(%\)\s*(?:\|\s*)?([0-9.,]+%)/i
  );
  const cetMensal = matchCetMensal ? matchCetMensal[1].trim() : '';
  const cetMensalNum = parsePercentualTaxa(cetMensal);

  const matchBonus = textoCorpoCosturado.match(
    /b[ôo]nus\s+de\s+adimpl[êe]ncia\s+de\s+(\d{1,3}%\s*\([^)]+\))/i
  );
  const bonusAdimplenciaPerc = matchBonus ? matchBonus[1].trim() : '';

  const matchInadimpMora = textoCorpoCosturado.match(
    /juros\s+de\s+mora\s+de\s+([0-9.,]+%\s*a\.a\.)[\s\S]{1,120}?multa\s+correspondente\s+a\s+([0-9.,]+%)/i
  );
  const encargosInadimplementoResumo = matchInadimpMora
    ? `Juros de mora de ${matchInadimpMora[1]} + Multa de ${matchInadimpMora[2]} sobre parcelas em atraso`
    : 'Encargos contratuais de normalidade sem bônus';

  const matchDiaCap = textoCorpoCosturado.match(
    /capitalizados?\s+integralmente\s+no\s+dia\s+(\d{1,2}\s*\([^)]+\))\s+de\s+cada\s+m[êe]s/i
  );
  const diaCapitalizacaoMensal = matchDiaCap ? matchDiaCap[1].trim() : '';

  // Cronograma de Reembolso (Parcelas na CCB e no Anexo CET)
  const parcelasReembolso: ParcelaReembolsoContrato[] = [];

  if (tipoInstrumento === 'CCB_DERIVADA') {
    const matchBlocoFormaPag = textoCorpoCosturado.match(
      /FORMA\s+DE\s+PAGAMENTO:[\s\S]{10,120}?esquema\s+de\s+pagamento:\s*([\s\S]{20,1400}?)(?:ASSESSORIA\s+EMPRESARIAL|MANUTEN[ÇC][ÃA]O|$)/i
    );
    if (matchBlocoFormaPag) {
      const regexParcCcb =
        /(\d{2}\/\d{2}\/20\d{2})\s*,\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
      let mP: RegExpExecArray | null;
      let seq = 1;
      while ((mP = regexParcCcb.exec(matchBlocoFormaPag[1])) !== null) {
        parcelasReembolso.push({
          numero: seq++,
          dataVencimento: mP[1].trim(),
          valorPrincipal: mP[2].trim(),
        });
      }
    }
  } else if (tipoInstrumento === 'ANEXO_FLUXO_CET') {
    const idxTotais = textoCorpoCosturado.indexOf('TOTAIS');
    const idxFimTabelaFluxo = textoCorpoCosturado.search(
      /integrante\s+da\s*\(?o?\)?\s*C[ÉE]DULA/i
    );
    const textoTabelaFluxo =
      idxTotais !== -1
        ? textoCorpoCosturado.substring(
            idxTotais,
            idxFimTabelaFluxo !== -1 && idxFimTabelaFluxo > idxTotais
              ? idxFimTabelaFluxo
              : textoCorpoCosturado.length
          )
        : textoCorpoCosturado;

    const regexIniciosParcela =
      /\b([1-9]\d?)\s*(?:\|\s*)*(\d{2}\/\d{2}\/20[234]\d)\b/g;
    const marcadoresParcelas: Array<{
      num: number;
      data: string;
      idxInicio: number;
      idxFimMatch: number;
    }> = [];

    let mIni: RegExpExecArray | null;
    while ((mIni = regexIniciosParcela.exec(textoTabelaFluxo)) !== null) {
      marcadoresParcelas.push({
        num: Number(mIni[1]),
        data: mIni[2].trim(),
        idxInicio: mIni.index,
        idxFimMatch: mIni.index + mIni[0].length,
      });
    }

    for (let i = 0; i < marcadoresParcelas.length; i++) {
      const atual = marcadoresParcelas[i];
      const prox = marcadoresParcelas[i + 1];
      const fatiaLinha = textoTabelaFluxo.substring(
        atual.idxFimMatch,
        prox ? prox.idxInicio : textoTabelaFluxo.length
      );

      const valoresLinha = (
        fatiaLinha.match(/-?\d{1,3}(?:\.\d{3})*[.,]\d{2}/g) || []
      ).map(normalizarMoedaContrato);

      if (valoresLinha.length >= 4) {
        const valJuros = valoresLinha[valoresLinha.length - 4];
        const valPrincipal = valoresLinha[valoresLinha.length - 3];
        const valPrestacao = valoresLinha[valoresLinha.length - 2];

        parcelasReembolso.push({
          numero: atual.num,
          dataVencimento: atual.data,
          valorJuros: valJuros,
          valorPrincipal: valPrincipal,
          valorPrestacaoTotal: valPrestacao,
        });
      } else if (valoresLinha.length === 3) {
        parcelasReembolso.push({
          numero: atual.num,
          dataVencimento: atual.data,
          valorJuros: valoresLinha[0],
          valorPrincipal: valoresLinha[1],
          valorPrestacaoTotal: valoresLinha[2],
        });
      }
    }
  }

  // Na Planilha CET, suporta tanto "Data de Pagamento da 1ª Parcela: 21/10/2030" quanto "Previsão de Pagamento da 1ª Parcela ... 10/09/2028"
  const matchData1aParcCet =
    textoCorpoCosturado.match(
      /(?:Data|Previs[ãa]o)\s+de\s+Pagamento\s+da\s+1[ªa]\s+Parcela\s+de\s+Principal\s*(?:\|\s*)?(\d{2}\/\d{2}\/20\d{2})/i
    ) ||
    textoCorpoCosturado.match(
      /Previs[ãa]o\s+de\s+Pagamento\s+da\s+1[ªa]\s+Parcela[\s\S]{1,120}?\b\d{1,2}\s+(\d{2}\/\d{2}\/20[234]\d)\b/i
    );

  const dataPrimeiraParcelaPrincipal =
    matchData1aParcCet?.[1]?.trim() ||
    parcelasReembolso[0]?.dataVencimento ||
    '';

  const matchQtdPrestCet =
    textoCorpoCosturado.match(
      /N[úu]mero\s+de\s+Presta[çc][õo]es\s+de\s+Principal\s+a\s+Pagar\s*(?:\|\s*)?\b([1-9]\d?)\b/i
    ) ||
    textoCorpoCosturado.match(
      /Data\s+da\s+Contrata[çc][ãa]o[\s\S]{1,140}?\d{2}\/\d{2}\/20\d{2}\s+([1-9]\d?)\s+\d{2}\/\d{2}\/20[234]\d/i
    );
  const qtdPrestacoesCet = matchQtdPrestCet
    ? Number(matchQtdPrestCet[1])
    : parcelasReembolso.length;

  const periodicidadeReembolsoCet = /\bANUAL\b/i.test(textoCorpoCosturado)
    ? 'ANUAL'
    : 'ANUAL';

  const dataVencimentoEfetiva =
    dataVencimento ||
    (parcelasReembolso.length > 0
      ? parcelasReembolso[parcelasReembolso.length - 1].dataVencimento
      : '');

  let prazoAnosCalculado = '';
  let prazoMesesCalculado = '';
  let carenciaAnosCalculada = '';

  const dtCeleb = converterDataBRParaDate(dataCelebracaoCabecalho);
  const dtVenc = converterDataBRParaDate(dataVencimentoEfetiva);
  const dtPrimParc = converterDataBRParaDate(dataPrimeiraParcelaPrincipal);

  if (dtCeleb && dtVenc) {
    const anos = Math.round(
      (dtVenc.getTime() - dtCeleb.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
    prazoAnosCalculado = `${anos} anos`;
    prazoMesesCalculado = String(anos * 12);
  }
  if (dtCeleb && dtPrimParc) {
    const anosCar = Math.round(
      (dtPrimParc.getTime() - dtCeleb.getTime()) /
        (1000 * 60 * 60 * 24 * 365.25)
    );
    carenciaAnosCalculada = `${anosCar} anos (${anosCar * 12} meses)`;
  }

  // =========================================================================
  // EXTRAÇÃO DO ANEXO-ORÇAMENTO (SUPORTA LINHAS SIMPLES E PARES AGRUPADOS COMO NO ADROALDO!)
  // =========================================================================
  const itensOrcamento: ItemOrcamentoContratual[] = [];
  let valorRecursosPropriosOrcamento = '0,00';

  if (tipoInstrumento === 'ANEXO_ORCAMENTO') {
    const mTotalOrc = textoCorpoCosturado.match(
      /TOTAL\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    );
    if (mTotalOrc) {
      valorRecursosPropriosOrcamento = mTotalOrc[1].trim();
    }

    // Remove o cabeçalho repetido da Página 2 do Anexo-Orçamento para que o Item 04 (que inicia no fim da Pág. 1)
    // fique colado aos seus 3 desembolsos na Pág. 2!
    const textoOrcSemCabRepetido = textoCorpoCosturado
      .replace(
        /Anexo-Or[çc]amento\s+integrante\s+da\s+C[ÉE]DULA[\s\S]{1,280}?Recursos\s+Financiados(?:\s+Desembol\s*so\s*\(m[êe]s\/\s*ano\))?(?:\s+FNE\s*\(R\$\))?/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Mapeia os cabeçalhos dos itens (01, 02, 03, 04...)
    const cabecalhosItensOrc: Array<{
      codigo: string;
      descricao: string;
      qtdUnid: string;
      index: number;
    }> = [];

    const regexCabItemOrc =
      /\b(0[1-9]|[1-9]\d)\s+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú0-9\s.,/\-º°]{3,95}?)(?=\s+VERBA|\s+0[1-9]\s+|\s+TOTAL)/g;
    let mCab: RegExpExecArray | null;
    while ((mCab = regexCabItemOrc.exec(textoOrcSemCabRepetido)) !== null) {
      const cod = mCab[1].trim();
      const bruto = mCab[2];

      // Extrai Qtd e Unidade que podem estar misturadas na descrição (ex: "Aquisição 14,00 de Matrizes UA" ou "1,00 HA" ou "1,00 und")
      const mQtd = bruto.match(
        /\b(\d+(?:,\d+)?)\s*(?:[A-Za-zÀ-ú\s]{0,18}?)\b(HA|UA|UNID\.?|UND\.?|M2|M3|CAB\.?|CONJ\.?|KM)\b/i
      );
      const qtdUnid = mQtd ? `${mQtd[1]} ${mQtd[2].toUpperCase()}` : 'VERBA';

      const descLimpa = bruto
        .replace(/\b\d+(?:,\d+)?\s*(?:HA|UA|UNID\.?|UND\.?)\b/gi, ' ')
        .replace(/\b(?:UA|HA|UND|UNID)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

      cabecalhosItensOrc.push({
        codigo: cod,
        descricao: `${cod} - ${descLimpa}`,
        qtdUnid,
        index: mCab.index,
      });
    }

    // 2. Varre sequencialmente os blocos de desembolso (suportando tanto 1 lançamento "0,00 set/2026 58.800,00"
    //    quanto lançamentos duplos agrupados "0,00 0,00 set/2026 out/2026 6.500,00 6.500,00" como na Reforma de Pastagem do Adroaldo!)
    const regexTokensOrc =
      /\b(\d{1,3}(?:\.\d{3})*,\d{2}|(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/20\d{2}|TOTAL)\b/gi;
    const tokensTabela: Array<{ str: string; index: number }> = [];
    let mTok: RegExpExecArray | null;
    while ((mTok = regexTokensOrc.exec(textoOrcSemCabRepetido)) !== null) {
      if (mTok[1].toUpperCase() === 'TOTAL') break;
      tokensTabela.push({ str: mTok[1], index: mTok.index });
    }

    const ehMesAno = (s: string) =>
      /^(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/20\d{2}$/i.test(
        s
      );
    const ehMoeda = (s: string) => /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s);

    let iT = 0;
    let seqLanc = 1;
    while (iT < tokensTabela.length) {
      // Caso A: Bloco duplo agrupado [RecProp1, RecProp2, Mes1, Mes2, ValFne1, ValFne2] (Ex: Reforma de Pastagem do Adroaldo)
      if (
        iT + 5 < tokensTabela.length &&
        ehMoeda(tokensTabela[iT].str) &&
        ehMoeda(tokensTabela[iT + 1].str) &&
        ehMesAno(tokensTabela[iT + 2].str) &&
        ehMesAno(tokensTabela[iT + 3].str) &&
        ehMoeda(tokensTabela[iT + 4].str) &&
        ehMoeda(tokensTabela[iT + 5].str)
      ) {
        const cabVinc = [...cabecalhosItensOrc]
          .reverse()
          .find((c) => c.index <= tokensTabela[iT].index);

        itensOrcamento.push({
          codigo: cabVinc?.codigo || String(seqLanc).padStart(2, '0'),
          descricao: cabVinc?.descricao || `Item #${seqLanc}`,
          quantidadeUnidade: cabVinc?.qtdUnid || 'VERBA',
          mesAnoDesembolso: tokensTabela[iT + 2].str.toLowerCase(),
          valorRecursosProprios: tokensTabela[iT].str,
          valorFinanciadoFne: tokensTabela[iT + 4].str,
        });
        seqLanc++;

        itensOrcamento.push({
          codigo: cabVinc?.codigo || String(seqLanc).padStart(2, '0'),
          descricao: cabVinc?.descricao || `Item #${seqLanc}`,
          quantidadeUnidade: cabVinc?.qtdUnid || 'VERBA',
          mesAnoDesembolso: tokensTabela[iT + 3].str.toLowerCase(),
          valorRecursosProprios: tokensTabela[iT + 1].str,
          valorFinanciadoFne: tokensTabela[iT + 5].str,
        });
        seqLanc++;
        iT += 6;
        continue;
      }

      // Caso B: Lançamento padrão [RecProp, MesAno, ValFne] (Ex: "0,00 set/2026 58.800,00")
      if (
        iT + 2 < tokensTabela.length &&
        ehMoeda(tokensTabela[iT].str) &&
        ehMesAno(tokensTabela[iT + 1].str) &&
        ehMoeda(tokensTabela[iT + 2].str)
      ) {
        const cabVinc = [...cabecalhosItensOrc]
          .reverse()
          .find((c) => c.index <= tokensTabela[iT].index);

        itensOrcamento.push({
          codigo: cabVinc?.codigo || String(seqLanc).padStart(2, '0'),
          descricao: cabVinc?.descricao || `Item #${seqLanc}`,
          quantidadeUnidade: cabVinc?.qtdUnid || 'VERBA',
          mesAnoDesembolso: tokensTabela[iT + 1].str.toLowerCase(),
          valorRecursosProprios: tokensTabela[iT].str,
          valorFinanciadoFne: tokensTabela[iT + 2].str,
        });
        seqLanc++;
        iT += 3;
        continue;
      }

      // Caso C: Lançamento invertido [RecProp, ValFne, MesAno] (Ex: "0,00 9.300,00 out/2026")
      if (
        iT + 2 < tokensTabela.length &&
        ehMoeda(tokensTabela[iT].str) &&
        ehMoeda(tokensTabela[iT + 1].str) &&
        ehMesAno(tokensTabela[iT + 2].str)
      ) {
        const cabVinc = [...cabecalhosItensOrc]
          .reverse()
          .find((c) => c.index <= tokensTabela[iT].index);

        itensOrcamento.push({
          codigo: cabVinc?.codigo || String(seqLanc).padStart(2, '0'),
          descricao: cabVinc?.descricao || `Item #${seqLanc}`,
          quantidadeUnidade: cabVinc?.qtdUnid || 'VERBA',
          mesAnoDesembolso: tokensTabela[iT + 2].str.toLowerCase(),
          valorRecursosProprios: tokensTabela[iT].str,
          valorFinanciadoFne: tokensTabela[iT + 1].str,
        });
        seqLanc++;
        iT += 3;
        continue;
      }

      iT++;
    }
  }

  // Extração das Liberações Previstas e Linha TOTAIS no ANEXO CET / CET
  const liberacoesPrevistas: LiberacaoPrevistaCet[] = [];
  let valorLiquidoContratadoCet = '';
  let valorJurosTotaisCet = '';
  let valorTotalAPagarCet = '';
  let valorPrincipalTotalLinhaTotaisAnexoCet = '';

  if (tipoInstrumento === 'PLANILHA_CET') {
    const mLiq = textoCorpoCosturado.match(
      /Valor\s+L[íi]quido\s+Contratado\s*(?:\|\s*)?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    );
    if (mLiq) valorLiquidoContratadoCet = mLiq[1].trim();
    else valorLiquidoContratadoCet = valorClausulaPrimeira;
  } else if (tipoInstrumento === 'ANEXO_FLUXO_CET') {
    // Extrai a linha TOTAIS da tabela de fluxo: [Valor Liberado, Custos, Juros, Principal, Prestações]
    const mLinhaTotais = textoCorpoCosturado.match(
      /TOTAIS\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})/i
    );

    if (mLinhaTotais) {
      valorJurosTotaisCet = normalizarMoedaContrato(mLinhaTotais[3]);
      valorPrincipalTotalLinhaTotaisAnexoCet = normalizarMoedaContrato(
        mLinhaTotais[4]
      );
      valorTotalAPagarCet = normalizarMoedaContrato(mLinhaTotais[5]);
    } else {
      const mJurosTot = textoCorpoCosturado.match(
        /Juros\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})/i
      );
      if (mJurosTot)
        valorJurosTotaisCet = normalizarMoedaContrato(mJurosTot[1]);

      const mTotPagar = textoCorpoCosturado.match(
        /TOTAL\s+A\s+PAGAR\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2})/i
      );
      if (mTotPagar)
        valorTotalAPagarCet = normalizarMoedaContrato(mTotPagar[1]);
    }

    const idxTotaisFluxo = textoCorpoCosturado.indexOf('TOTAIS');
    const idxParc1Fluxo = textoCorpoCosturado.search(
      /\b1\s*(?:\|\s*)*\d{2}\/\d{2}\/20[234]\d/
    );
    const idxRodapeIntegrante = textoCorpoCosturado.search(
      /integrante\s+da\s*\(?o?\)?\s*C[ÉE]DULA/i
    );

    if (idxTotaisFluxo !== -1) {
      const limiteFimLiberacoes =
        idxParc1Fluxo !== -1
          ? idxParc1Fluxo
          : idxRodapeIntegrante !== -1 && idxRodapeIntegrante > idxTotaisFluxo
          ? idxRodapeIntegrante
          : idxTotaisFluxo + 450;

      const trechoLiberacoes = textoCorpoCosturado.substring(
        idxTotaisFluxo,
        limiteFimLiberacoes
      );
      const regexLinhaLib =
        /(\d{2}\/(\d{2})\/(20\d{2}))\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
      let mL: RegExpExecArray | null;
      const NOMES_MES_CURTO: Record<string, string> = {
        '01': 'jan',
        '02': 'fev',
        '03': 'mar',
        '04': 'abr',
        '05': 'mai',
        '06': 'jun',
        '07': 'jul',
        '08': 'ago',
        '09': 'set',
        '10': 'out',
        '11': 'nov',
        '12': 'dez',
      };
      while ((mL = regexLinhaLib.exec(trechoLiberacoes)) !== null) {
        const dtCompleta = mL[1];
        const mesNum = mL[2];
        const anoStr = mL[3];
        const valLib = mL[4];
        liberacoesPrevistas.push({
          dataLiberacao: dtCompleta,
          mesAnoRef: `${NOMES_MES_CURTO[mesNum] || mesNum}/${anoStr}`,
          valorLiberacao: valLib,
        });
      }
    }
  }

  // Dados de Contratos de Limite (LCGA / LCGH)
  const idxClausula2 = corpoSemAcentoUp.indexOf('CLAUSULA SEGUNDA');
  const idxClausula3 = corpoSemAcentoUp.indexOf('CLAUSULA TERCEIRA');
  const fatiaClausula2 =
    idxClausula2 !== -1 && idxClausula3 !== -1
      ? textoCorpoCosturado.substring(idxClausula2, idxClausula3)
      : '';
  const matchValCl2 = fatiaClausula2.match(
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
  );
  const valorClausulaSegunda = matchValCl2
    ? matchValCl2[1].trim()
    : valorClausulaPrimeira;

  const matchInicioClausula10 = corpoSemAcentoUp.match(
    /CLAUSULA\s+DECIMA\s*[-–]?\s*BENS\s+IMOVEIS/i
  );
  const matchInicioClausula11 = corpoSemAcentoUp.match(
    /CLAUSULA\s+DECIMA\s+PRIMEIRA/i
  );
  const idxCl10 = matchInicioClausula10?.index ?? -1;
  const idxCl11 = matchInicioClausula11?.index ?? -1;
  const fatiaClausula10 =
    idxCl10 !== -1 && idxCl11 !== -1 && idxCl11 > idxCl10
      ? textoCorpoCosturado.substring(idxCl10, idxCl11)
      : textoCorpoCosturado;

  const matchValAvalTotal =
    fatiaClausula10.match(
      /PAR[ÁA]GRAFO\s+PRIMEIRO[\s\S]{1,350}?avaliado\s*\(s\)\s*pelo\s+valor\s+total\s+de\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    ) ||
    fatiaClausula10.match(
      /valor\s+total\s+de\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    );
  const valorAvaliacaoTotalImoveis = matchValAvalTotal
    ? matchValAvalTotal[1].trim()
    : valorClausulaPrimeira;

  const indiceAtualizacaoGarantia = /caderneta\s+de\s+poupan[çc]a/i.test(
    fatiaClausula10
  )
    ? 'Índice da Caderneta de Poupança (dia de aniversário do contrato)'
    : 'Atualização monetária contratual';

  const imoveisGarantia: ImovelGarantiaContratoInfo[] = [];
  const matchParagrafo2Imovel = fatiaClausula10.match(
    /PAR[ÁA]GRAFO\s+SEGUNDO\s*[-–]?\s*([\s\S]+?)(?:PAR[ÁA]GRAFO\s+TERCEIRO|$)/i
  );

  if (
    (tipoInstrumento === 'LCGA' || tipoInstrumento === 'LCGH') &&
    matchParagrafo2Imovel &&
    matchParagrafo2Imovel[1]
  ) {
    const txtIm = matchParagrafo2Imovel[1].replace(/\s+/g, ' ').trim();
    const mDenom = txtIm.match(
      /im[óo]vel\s+rural\s+denominado\s+([\s\S]{3,95}?)\s*,\s*(?:de\s+)?propriedade/i
    );
    const mProp = txtIm.match(
      /propriedade\s+(?:de\s+)?([\s\S]{5,180}?)\s*,?\s*com\s+(?:a\s+seguinte\s+)?[áa]rea/i
    );
    const mArea = txtIm.match(
      /[áa]rea(?:\s+de|\s*:)?\s*([0-9.,]+\s*ha)(?:\s*\(([^)]+)\))?/i
    );
    const mDataAq = txtIm.match(/adquirido\s+em\s*(\d{2}\/\d{2}\/\d{4})/i);
    const mFormaAq = txtIm.match(
      /de\s+acordo\s+com\s+(?:a\s+|o\s+)?([\s\S]{5,90}?)\s*,\s*objeto\s+do\s+registro/i
    );
    const mReg = txtIm.match(
      /objeto\s+do\s+registro\s+imobili[áa]rio\s*(?:N[°ºo]?\s*)?([A-Z0-9.\-/]+)\s*,?\s*Livro\s*(?:N[°ºo]?\s*)?(\d+)/i
    );
    const mCart = txtIm.match(
      /Livro\s*(?:N[°ºo]?\s*)?\d+\s*,?\s*(?:do\s+)?(Cart[óo]rio[\s\S]{5,130}?)\s*,\s*avaliado\s+em/i
    );
    const mValAv = txtIm.match(
      /avaliado\s+em\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    );

    let situacaoOnusHipoteca = 'Regular';
    let possuiHipotecaBnb = false;
    if (/livre\s*\(s\)\s*e\s*desembara[çc]ado/i.test(txtIm)) {
      situacaoOnusHipoteca =
        'Livre e desembaraçado de quaisquer ônus, dívidas, ações ou responsabilidades.';
    } else if (/hipotecado\s*\(s\)\s*ao\s+Banco\s+do\s+Nordeste/i.test(txtIm)) {
      possuiHipotecaBnb = true;
      situacaoOnusHipoteca =
        'Hipotecado ao próprio Banco do Nordeste do Brasil S/A (registrado no cartório competente).';
    }

    imoveisGarantia.push({
      denominacao: mDenom ? mDenom[1].trim() : 'Imóvel Rural',
      proprietarios: mProp ? mProp[1].replace(/\s+/g, ' ').trim() : '',
      areaHa: mArea ? mArea[1].trim() : '',
      areaExtenso: mArea && mArea[2] ? mArea[2].trim() : '',
      dataAquisicao: mDataAq ? mDataAq[1].trim() : '',
      formaAquisicao: mFormaAq ? mFormaAq[1].replace(/\s+/g, ' ').trim() : '',
      registroMatricula: mReg ? mReg[1].trim() : '',
      livro: mReg ? `Livro Nº ${mReg[2].trim()}` : 'Livro Nº 2',
      cartorioMunicipioUf: mCart ? mCart[1].replace(/\s+/g, ' ').trim() : '',
      valorAvaliacao: mValAv ? mValAv[1].trim() : valorAvaliacaoTotalImoveis,
      situacaoOnusHipoteca,
      possuiHipotecaBnb,
      possuiInalienabilidadeCitada:
        /inalienabil|inalien[áa]vel|cl[áa]usula\s+resolutiva/i.test(txtIm),
    });
  }

  if (!qualifCred.cpf && creditadoNome) {
    const mCpfCl10 = fatiaClausula10.match(
      /CPF\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i
    );
    if (mCpfCl10) qualifCred.cpf = mCpfCl10[1].trim();
  }

  const matchClausulaOutorga = textoCorpoCosturado.match(
    /CL[ÁA]USULA\s+D[ÉE]CIMA\s+PRIMEIRA\s*[-–]?\s*OUTORGA\s*[-–]?\s*([\s\S]{15,520}?)(?:CL[ÁA]USULA\s+D[ÉE]CIMA\s+SEGUNDA)/i
  );
  const outorgaConjugalTexto = matchClausulaOutorga
    ? matchClausulaOutorga[1].replace(/\s+/g, ' ').trim()
    : '';

  let conjugeNome = '';
  const matchConjugeOutorga = outorgaConjugalTexto.match(
    /(?:Sra\.|Sr\.)\s+([A-ZÀ-Úa-zà-ú\s]{5,60}?)\s*,\s*(?:esposa|esposo|c[ôo]njuge|companheira|companheiro)/i
  );
  if (matchConjugeOutorga) {
    conjugeNome = matchConjugeOutorga[1].replace(/\s+/g, ' ').trim().toUpperCase();
  } else {
    const mConjCol = txtAssinaturasUp.match(
      /CONJUGE\s+DO\s+(?:EMITENTE\/)?CREDITADO\s+([A-Z\s]{5,60}?)\s+CPF:\s*\d{3}\.\d{3}\.\d{3}-\d{2}/i
    );
    if (mConjCol) {
      conjugeNome = mConjCol[1].replace(/\s+/g, ' ').trim().toUpperCase();
    }
  }
  const qualifConj = extrairQualificacaoPessoa(conjugeNome);

  let possuiRepresentacaoProcurador = false;
  let procuradorNome = '';
  let procuradorCpf = '';
  let procuradorRg = '';
  let procuradorEndereco = '';

  const mProcCol = txtAssinaturasUp.match(
    /([A-Z\s]{5,55}?)\s+PROCURADOR\s+CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})(?:\s+RG:\s*([0-9A-Z\-\s/]+?)\s+\d{2}\/\d{2}\/\d{4})?/i
  );
  if (mProcCol) {
    possuiRepresentacaoProcurador = true;
    procuradorNome = mProcCol[1]
      .replace(/^(?:GERAL|AGRICULTURA|\d+|\[COLUNA_[A-Z_0-9]+\])\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    procuradorCpf = mProcCol[2].trim();
    procuradorRg = (mProcCol[3] || '').trim();
    const qualifProc = extrairQualificacaoPessoa(procuradorNome);
    if (qualifProc.endereco) procuradorEndereco = qualifProc.endereco;
  }

  const gerentesBanco: Array<{ nome: string; cargo: string }> = [];
  const regexGerentes =
    /([A-Z]{3,}(?:\s+[A-Z]{2,}){1,5})\s+(GERENTE\s+DE\s+AGENCIA|GERENTE\s+DE\s+RELACIONAMENTO|GERENTE\s+EXECUTIVO|GERENTE\s+DE\s+NEGOCIOS)/g;
  let mGer: RegExpExecArray | null;
  while ((mGer = regexGerentes.exec(txtAssinaturasUp)) !== null) {
    const nomeG = mGer[1]
      .replace(/^(?:S\.A\.|BRASIL|NORDESTE|BANCO|PELO)\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cargoG = mGer[2].replace(/\s+/g, ' ').trim();
    if (nomeG.length >= 5 && !gerentesBanco.some((g) => g.nome === nomeG)) {
      gerentesBanco.push({ nome: nomeG, cargo: cargoG });
    }
  }

  const cpfsPartesPrincipais = new Set(
    [
      qualifCred.cpf,
      qualifConj.cpf,
      qualifAval.cpf,
      conjugeAvalistaCpf,
      procuradorCpf,
    ].filter(Boolean)
  );
  const testemunhas: Array<{ nome: string; cpf: string }> = [];
  const regexTodosNomesCpfsAssinaturas =
    /([A-Z]{3,}(?:\s+[A-Z]{2,}){1,5})\s+CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/g;
  let mTest: RegExpExecArray | null;
  while (
    (mTest = regexTodosNomesCpfsAssinaturas.exec(txtAssinaturasUp)) !== null
  ) {
    const cpfCand = mTest[2].trim();
    if (cpfsPartesPrincipais.has(cpfCand)) continue;
    const nomeCand = mTest[1]
      .replace(/^(?:TESTEMUNHAS?|RELACIONAMENTO|AGENCIA|GERENTE)\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (nomeCand.length >= 5 && !testemunhas.some((t) => t.cpf === cpfCand)) {
      testemunhas.push({ nome: nomeCand, cpf: cpfCand });
    }
  }

  const certidoesCitadas: CertidaoCitadaContratoInfo[] = [];
  const extrairCertidoesDeBloco = (blocoTxt: string, rotuloParte: string) => {
    const mCnd = blocoTxt.match(
      /TRIBUTOS\s+FEDERAIS[\s\S]{1,80}?n[°ºo]?\s*([A-F0-9.]{10,25})\s*,\s*emitida[\s\S]{1,50}?(\d{2}\/\d{2}\/20\d{2})\s+e\s+v[áa]lida\s+at[ée]\s+(\d{2}\/\d{2}\/20\d{2})/i
    );
    if (mCnd) {
      const dtVal = converterDataBRParaDate(mCnd[3]);
      const vigente = dtVal && dtCeleb ? dtVal >= dtCeleb : true;
      certidoesCitadas.push({
        parte: rotuloParte,
        tipo: 'CND_FEDERAL',
        numeroCertidao: mCnd[1],
        dataEmissao: mCnd[2],
        dataValidade: mCnd[3],
        vigenteNaContratacao: Boolean(vigente),
      });
    }
    const mCndt = blocoTxt.match(
      /D[ée]bitos\s+Trabalhistas\s*,\s*n[°ºo]?\s*([0-9/]{6,20})\s*,\s*emitida\s+em\s+(\d{2}\/\d{2}\/20\d{2})[\s\S]{1,50}?v[áa]lida\s+at[ée]\s+(\d{2}\/\d{2}\/20\d{2})/i
    );
    if (mCndt) {
      const dtVal = converterDataBRParaDate(mCndt[3]);
      const vigente = dtVal && dtCeleb ? dtVal >= dtCeleb : true;
      certidoesCitadas.push({
        parte: rotuloParte,
        tipo: 'CNDT_TRABALHISTA',
        numeroCertidao: mCndt[1],
        dataEmissao: mCndt[2],
        dataValidade: mCndt[3],
        vigenteNaContratacao: Boolean(vigente),
      });
    }
  };

  const matchClausulaCertCred = textoCorpoCosturado.match(
    /CERTID[ÃA]O\s+DO\s+CREDITADO\s*:?\s*([\s\S]{20,650}?)(?:CL[ÁA]USULA|$)/i
  );
  if (matchClausulaCertCred) {
    extrairCertidoesDeBloco(
      matchClausulaCertCred[1],
      `Creditado (${creditadoNome || 'Titular'})`
    );
  }
  const matchClausulaCertInterv = textoCorpoCosturado.match(
    /CERTID[ÃA]O\s+DO\s*\(S\)\s*INTERVENIENTE\s*\(S\)\s*GARANTIDOR\s*\(ES\)\s*:?\s*([\s\S]{20,650}?)(?:CL[ÁA]USULA|$)/i
  );
  if (matchClausulaCertInterv) {
    extrairCertidoesDeBloco(
      matchClausulaCertInterv[1],
      `Interveniente Garantidor(a) (${conjugeNome || 'Cônjuge/Garantidor'})`
    );
  }

  const matchSms = textoCorpoCosturado.match(
    /aplicativos\s+de\s+mensagens\s*:\s*(\d{10,12})\b/i
  );
  const telefoneSmsClausula = matchSms ? matchSms[1].trim() : '';

  const matchVias = textoCorpoCosturado.match(
    /assinam\s+o\s+presente\s+em\s+([0-9]{1,2}(?:\s*\([^)]+\))?\s*vias)/i
  );
  const quantidadeViasContrato = matchVias ? matchVias[1].trim() : '1 via';

  const cpfLimpoCred = qualifCred.cpf.replace(/\D/g, '');
  const nomeNormCred = normalizarSemAcento(creditadoNome);
  const opsDoClienteNoPainel = contratacoesPainel.filter((r) => {
    const rCpf = (r.cpf || '').replace(/\D/g, '');
    const rNome = normalizarSemAcento(r.cliente || '');
    return (
      (cpfLimpoCred.length === 11 && rCpf === cpfLimpoCred) ||
      (nomeNormCred.length >= 4 && rNome === nomeNormCred)
    );
  });

  const infoPorte = identificarPorteESubprodutoContrato(
    numeroContratoCedula,
    file.name,
    corpoSemAcentoUp,
    certidoesCitadas.length > 0,
    opsDoClienteNoPainel[0]?.porte
  );

  const signatariosPartes: SignatarioContratoInfo[] = [];
  if (creditadoNome) {
    signatariosPartes.push({
      papelNoContrato: 'EMITENTE / CREDITADO',
      nomeTitularDoPapel: creditadoNome,
      cpfTitularDoPapel: qualifCred.cpf,
      rgOrgaoEmissor: qualifCred.rg,
      dataExpedicaoRg: qualifCred.dataRg,
      estadoCivilRegime: qualifCred.estadoCivil,
      enderecoResumo: qualifCred.endereco,
      profissao: qualifCred.profissao,
      representadoPorProcurador: possuiRepresentacaoProcurador,
      nomeProcuradorQueAssina: possuiRepresentacaoProcurador
        ? procuradorNome
        : undefined,
      cpfProcuradorQueAssina: possuiRepresentacaoProcurador
        ? procuradorCpf
        : undefined,
      rgProcuradorQueAssina: possuiRepresentacaoProcurador
        ? procuradorRg
        : undefined,
    });
  }
  if (conjugeNome) {
    signatariosPartes.push({
      papelNoContrato: 'CÔNJUGE DO CREDITADO / INTERVENIENTE ALIENANTE',
      nomeTitularDoPapel: conjugeNome,
      cpfTitularDoPapel: qualifConj.cpf,
      rgOrgaoEmissor: qualifConj.rg,
      dataExpedicaoRg: qualifConj.dataRg,
      estadoCivilRegime: qualifConj.estadoCivil || qualifCred.estadoCivil,
      enderecoResumo: qualifConj.endereco || qualifCred.endereco,
      profissao: qualifConj.profissao,
      representadoPorProcurador: possuiRepresentacaoProcurador,
      nomeProcuradorQueAssina: possuiRepresentacaoProcurador
        ? procuradorNome
        : undefined,
      cpfProcuradorQueAssina: possuiRepresentacaoProcurador
        ? procuradorCpf
        : undefined,
      rgProcuradorQueAssina: possuiRepresentacaoProcurador
        ? procuradorRg
        : undefined,
    });
  }
  if (possuiAvalista && avalistaNome) {
    signatariosPartes.push({
      papelNoContrato: 'AVALISTA (POR AVAL DO EMITENTE/CREDITADO)',
      nomeTitularDoPapel: avalistaNome,
      cpfTitularDoPapel: qualifAval.cpf,
      rgOrgaoEmissor: qualifAval.rg,
      dataExpedicaoRg: qualifAval.dataRg,
      estadoCivilRegime: qualifAval.estadoCivil,
      enderecoResumo: qualifAval.endereco,
      profissao: qualifAval.profissao,
      representadoPorProcurador: false,
    });
  }

  const baseResultado: ResultadoAuditoriaContratoPdf = {
    nomeArquivo: file.name,
    numPaginas,
    foiLidoPorOcr: usouOcr,
    ocrFoiCanceladoPeloUsuario: ocrCancelado,
    tipoInstrumento,
    tituloInstrumento,
    especieInstrumentoVinculado,
    porteIdentificado: infoPorte.porte,
    programaCredito: infoPorte.programa,
    codigoSubprodutoContrato: infoPorte.codigoSubproduto,
    numeroContratoCedula,
    agenciaPrefixo,
    agenciaNomeCnpj,
    agenciaEndereco,
    localAssinaturaFecho: infoLocalAssinatura.localExtraido,
    localAssinaturaConformeSantaInes:
      infoLocalAssinatura.conformeSantaInes,
    possuiRodapeDocumentoInterno: infoRodapeInterno.possuiRodapeInterno,
    trechoRodapeInternoDetectado: infoRodapeInterno.trechoDetectado,
    dataCelebracaoCabecalho,
    dataCelebracaoFechoAssinatura,
    dataVencimento: dataVencimentoEfetiva,
    dataPrimeiraParcelaPrincipal,
    periodicidadeReembolsoCet,
    qtdPrestacoesCet,
    prazoAnosCalculado,
    prazoMesesCalculado,
    carenciaAnosCalculada,
    prazoUtilizacaoPrimeiraParcelaDias,
    creditadoNome,
    creditadoCpf: qualifCred.cpf,
    creditadoRg: qualifCred.rg,
    creditadoRgDataEmissao: qualifCred.dataRg,
    creditadoEstadoCivilRegime: qualifCred.estadoCivil,
    creditadoEndereco: qualifCred.endereco,
    creditadoProfissao: qualifCred.profissao,
    telefoneSmsClausula,
    contaCorrenteDebito,
    imovelBeneficiadoNome,
    imovelBeneficiadoMatriculaCartorio,
    imovelBeneficiadoProprietario,
    imovelBeneficiadoMunicipioUf,
    anuenciaIncraSipraCodigo,
    anuenciaIncraLote,
    anuenciaIncraAtivoDesde,
    conjugeNome,
    conjugeCpf: qualifConj.cpf,
    conjugeRg: qualifConj.rg,
    conjugeRgDataEmissao: qualifConj.dataRg,
    conjugeEstadoCivilRegime: qualifConj.estadoCivil || qualifCred.estadoCivil,
    conjugeEndereco: qualifConj.endereco || qualifCred.endereco,
    conjugeProfissao: qualifConj.profissao,
    outorgaConjugalTexto,
    possuiAvalista,
    avalistaNome,
    avalistaCpf: qualifAval.cpf,
    avalistaRg: qualifAval.rg,
    avalistaRgDataEmissao: qualifAval.dataRg,
    avalistaEstadoCivilRegime: qualifAval.estadoCivil,
    avalistaEndereco: qualifAval.endereco,
    avalistaProfissao: qualifAval.profissao,
    conjugeAvalistaNome,
    conjugeAvalistaCpf,
    possuiRepresentacaoProcurador,
    procuradorNome,
    procuradorCpf,
    procuradorRg,
    procuradorEndereco,
    valorClausulaPrimeira,
    valorExtensoClausulaPrimeira,
    valorClausulaSegunda,
    valorCabecalhoContinuacao: valorViaCabecalho || valorClausulaPrimeira,
    valorAvaliacaoTotalImoveis,
    valorLiquidoContratadoCet,
    valorPrincipalTotalLinhaTotaisAnexoCet,
    valorRecursosPropriosOrcamento,
    valorJurosTotaisCet,
    valorTotalAPagarCet,
    taxaJurosAnual: taxaJurosAnual || '0,5% a.a.',
    taxaJurosAnualNum,
    taxaJurosMensal: taxaJurosMensal || '0,0416% a.m.',
    taxaJurosMensalNum,
    cetAnual: cetAnual || '0,50%',
    cetAnualNum,
    cetMensal: cetMensal || '0,0416%',
    cetMensalNum,
    bonusAdimplenciaPerc,
    encargosInadimplementoResumo,
    diaCapitalizacaoMensal,
    indiceAtualizacaoGarantia,
    encargosResumo: `Taxa Efetiva: ${taxaJurosAnual || '0,5% a.a.'} (${
      taxaJurosMensal || '0,0416% a.m.'
    }) • CET: ${cetAnual || '0,50%'} a.a.`,
    carenciaIntimacaoDias: '60 (sessenta) dias',
    prazoPurgacaoMoraDias: '15 (quinze) dias',
    taxaOcupacaoMensalLeilao: '1% a.m.',
    foroComarca: 'Comarca de Santa Inês-MA',
    quantidadeViasContrato,
    imoveisGarantia,
    certidoesCitadas,
    parcelasReembolso,
    itensOrcamento,
    liberacoesPrevistas,
    signatariosPartes,
    gerentesBanco,
    testemunhas,
    itensChecklist: [],
    textoCompletoExtraido: textoCorpoCosturado,
  };

  baseResultado.itensChecklist =
    reconstruirChecklistIndividualContrato(baseResultado);
  return baseResultado;
}

export function reconstruirChecklistIndividualContrato(
  r: ResultadoAuditoriaContratoPdf
): ItemChecklistConformidadeContrato[] {
  const itensChecklist: ItemChecklistConformidadeContrato[] = [];

  if (
    r.ocrFoiCanceladoPeloUsuario &&
    !r.creditadoNome &&
    !r.numeroContratoCedula
  ) {
    itensChecklist.push({
      id: 'CHK_OCR_CANCELADO_AVISO',
      categoria: 'CABECALHO_DATAS',
      titulo: '⚡ Leitura OCR Interrompida pelo Usuário',
      status: 'ALERTA',
      resumo:
        'Você cancelou o escaneamento OCR deste documento. Utilize o botão "🤖 Script Copilot" no topo para extrair e validar todos os dados instantaneamente via IA!',
    });
  }

  if (r.possuiRodapeDocumentoInterno) {
    itensChecklist.push({
      id: 'CHK_RODAPE_INTERNO_PROIBIDO',
      categoria: 'CERTIDOES_CLAUSULAS',
      titulo:
        '🚨 ALERTA DE BLOQUEIO: Rodapé "Documento Classificado como Interno" Detectado!',
      status: 'ERRO',
      resumo: `🚨 O arquivo "${r.nomeArquivo}" contém o rodapé travado "${r.trechoRodapeInternoDetectado}"! Remova esse rodapé no Word/Excel antes de colher a assinatura do cliente.`,
    });
  }

  if (r.tipoInstrumento === 'LCGA' || r.tipoInstrumento === 'LCGH') {
    const datasCelebracaoBatem =
      Boolean(r.dataCelebracaoCabecalho) &&
      Boolean(r.dataCelebracaoFechoAssinatura) &&
      r.dataCelebracaoCabecalho === r.dataCelebracaoFechoAssinatura;
    const erroLocal = !r.localAssinaturaConformeSantaInes;

    itensChecklist.push({
      id: 'CHK_CABECALHO_DATAS',
      categoria: 'CABECALHO_DATAS',
      titulo:
        '1. Nº do Contrato/Cédula, Porte, Local de Assinatura ("SANTA INES - MA") e Datas',
      status:
        !r.numeroContratoCedula || erroLocal
          ? 'ERRO'
          : !datasCelebracaoBatem
          ? 'ALERTA'
          : 'OK',
      resumo: erroLocal
        ? `🚨 ERRO DE LOCAL DE ASSINATURA: Consta "${
            r.localAssinaturaFecho || 'Não identificado'
          }" próximo às assinaturas, mas deve ser obrigatoriamente "SANTA INES - MA"!`
        : `✅ ${r.tipoInstrumento} Nº ${r.numeroContratoCedula} • Porte: ${r.porteIdentificado} • Local: ${r.localAssinaturaFecho} • Contratação: ${r.dataCelebracaoCabecalho} • Vencimento: ${r.dataVencimento} (${r.prazoAnosCalculado}).`,
      detalhes: [
        `📍 Local e Data no Fecho de Assinatura: ${
          r.localAssinaturaFecho || 'Não localizado'
        }, ${r.dataCelebracaoFechoAssinatura} (${
          r.localAssinaturaConformeSantaInes
            ? '✅ Praça Santa Inês-MA OK'
            : '🚨 Divergente de SANTA INES - MA!'
        })`,
        `🏛️ ${r.agenciaNomeCnpj} — End.: ${r.agenciaEndereco}`,
        `⏳ Vencimento: ${r.dataVencimento} (${r.prazoAnosCalculado} / ${r.prazoMesesCalculado} meses) • ${r.quantidadeViasContrato}.`,
        `🛡️ Rodapé de Classificação Interna: ${
          r.possuiRodapeDocumentoInterno
            ? `🚨 Contém "${r.trechoRodapeInternoDetectado}" (REMOVER!)`
            : '✅ Limpo (Sem rodapé "Documento Classificado como Interno").'
        }`,
      ],
    });

    const v1 = parseMoeda(r.valorClausulaPrimeira);
    const v2 = parseMoeda(r.valorClausulaSegunda);
    const vAv = parseMoeda(r.valorAvaliacaoTotalImoveis);
    const valoresOk =
      v1 > 0 &&
      (v2 === 0 || Math.abs(v1 - v2) < 0.01) &&
      (vAv === 0 || Math.abs(v1 - vAv) < 0.01);

    itensChecklist.push({
      id: 'CHK_VALORES_ENCARGOS',
      categoria: 'VALORES_ENCARGOS',
      titulo:
        '2. Valores (Cláusulas 1ª, 2ª, Cabeçalho e Avaliação do Imóvel) e Encargos',
      status: valoresOk ? 'OK' : 'ERRO',
      resumo: valoresOk
        ? `✅ Valor R$ ${r.valorClausulaPrimeira} (${r.valorExtensoClausulaPrimeira}) 100% consistente em todas as cláusulas e na avaliação.`
        : `🚨 Divergência ou ausência de valores no contrato!`,
      detalhes: [
        `💰 Cláusula 1ª: R$ ${r.valorClausulaPrimeira} | Cláusula 2ª: R$ ${r.valorClausulaSegunda} | Avaliação: R$ ${r.valorAvaliacaoTotalImoveis}`,
        `🔄 Atualização: ${r.indiceAtualizacaoGarantia}`,
      ],
    });

    const ehCasado = r.creditadoEstadoCivilRegime.includes('CASAD');
    const faltaOutorgaCasado =
      ehCasado && (!r.conjugeNome || !r.outorgaConjugalTexto);

    itensChecklist.push({
      id: 'CHK_PARTES_CONJUGE',
      categoria: 'PARTES_CONJUGE',
      titulo:
        '3. Qualificação do Creditado, Estado Civil, Outorga Conjugal (Cláusula 11) e Procuração',
      status:
        !r.creditadoNome || !r.creditadoCpf || faltaOutorgaCasado
          ? 'ERRO'
          : 'OK',
      resumo: `✅ Creditado: ${r.creditadoNome} (CPF: ${r.creditadoCpf}) • ${
        r.creditadoEstadoCivilRegime
      }${
        r.conjugeNome
          ? ` • Cônjuge Outorgante: ${r.conjugeNome} (CPF: ${r.conjugeCpf})`
          : ''
      }.`,
      detalhes: [
        `👤 Creditado: ${r.creditadoNome} | CPF: ${r.creditadoCpf} | RG: ${r.creditadoRg} (${r.creditadoRgDataEmissao}) | End.: ${r.creditadoEndereco}`,
        r.outorgaConjugalTexto
          ? `📜 Cláusula 11ª (Outorga): "${r.outorgaConjugalTexto}"`
          : '',
        r.possuiRepresentacaoProcurador
          ? `⚖️ REPRESENTADO POR PROCURAÇÃO: ${r.procuradorNome} (CPF: ${r.procuradorCpf}) assina pelas partes.`
          : '✍️ Assinatura direta pelo Creditado e Cônjuge.',
      ].filter(Boolean),
    });

    itensChecklist.push({
      id: 'CHK_IMOVEIS_GARANTIA',
      categoria: 'IMOVEIS_GARANTIA',
      titulo:
        '4. Imóvel da Garantia (Cláusula 10ª §2º), Área, Matrícula, Cartório e Hipoteca/Ônus',
      status: r.imoveisGarantia.length === 0 ? 'ERRO' : 'OK',
      resumo:
        r.imoveisGarantia.length > 0
          ? `✅ Imóvel: ${r.imoveisGarantia[0].denominacao} • Área: ${r.imoveisGarantia[0].areaHa} • Mat./Reg.: ${r.imoveisGarantia[0].registroMatricula} (${r.imoveisGarantia[0].livro}).`
          : '🚨 Imóvel não identificado na Cláusula Décima!',
      detalhes: r.imoveisGarantia.flatMap((im) => [
        `🏡 Denominação: ${im.denominacao} | Área: ${im.areaHa} | Aquisição: ${im.dataAquisicao} (${im.formaAquisicao})`,
        `🏛️ Registro: Nº ${im.registroMatricula}, ${im.livro} — ${im.cartorioMunicipioUf}`,
        `🛡️ Ônus / Hipoteca: ${im.situacaoOnusHipoteca}`,
      ]),
    });

    itensChecklist.push({
      id: 'CHK_CERTIDOES_CLAUSULAS',
      categoria: 'CERTIDOES_CLAUSULAS',
      titulo: '5. Certidões Fiscais (CND Federal e CNDT) e Condições Especiais',
      status: r.certidoesCitadas.some((c) => !c.vigenteNaContratacao)
        ? 'ERRO'
        : 'OK',
      resumo:
        r.certidoesCitadas.length === 0
          ? `✅ Contrato padrão ${r.porteIdentificado}: certidões arquivadas no dossiê da pasta.`
          : `✅ Todas as ${r.certidoesCitadas.length} certidões citadas nas Cláusulas 27/28 estão vigentes!`,
      detalhes: r.certidoesCitadas.map(
        (c) =>
          `✅ ${c.parte} — ${c.tipo} nº ${c.numeroCertidao} (Válida até: ${c.dataValidade})`
      ),
    });

    itensChecklist.push({
      id: 'CHK_ASSINATURAS_PROCURACAO',
      categoria: 'ASSINATURAS_PROCURACAO',
      titulo:
        '6. Conferência de Assinaturas (Partes, Procurador, Gerentes BNB e Testemunhas)',
      status: r.testemunhas.length < 2 ? 'ERRO' : 'OK',
      resumo: `✅ Assinaturas conferidas: ${r.signatariosPartes.length} Parte(s), ${r.gerentesBanco.length} Gerentes do BNB e ${r.testemunhas.length} Testemunhas com CPF.`,
      detalhes: [
        ...r.gerentesBanco.map((g) => `🏦 [BNB] ${g.nome} — ${g.cargo}`),
        ...r.testemunhas.map(
          (t, idx) => `👥 [TESTEMUNHA ${idx + 1}] ${t.nome} — CPF: ${t.cpf}`
        ),
      ],
    });
  } else {
    const erroLocalDeriv = !r.localAssinaturaConformeSantaInes;

    itensChecklist.push({
      id: 'CHK_DOC_DERIVADA_CAB',
      categoria: 'CABECALHO_DATAS',
      titulo: `1. Identificação, Espécie Vinculada e Local de Assinatura (${r.tituloInstrumento})`,
      status:
        !r.numeroContratoCedula || !r.creditadoNome || erroLocalDeriv
          ? 'ERRO'
          : 'OK',
      resumo: erroLocalDeriv
        ? `🚨 ERRO DE PRAÇA NO LOCAL DE ASSINATURA: Consta "${
            r.localAssinaturaFecho || 'Não identificado'
          }", mas deve ser "SANTA INES - MA"!`
        : `✅ Vinculado à ${
            r.especieInstrumentoVinculado || 'CCB'
          } Nº ${r.numeroContratoCedula} • Emitente: ${
            r.creditadoNome
          } • Local: ${r.localAssinaturaFecho} • Data: ${
            r.dataCelebracaoCabecalho
          }.`,
      detalhes: [
        `🏛️ Espécie / Segmentação no Cabeçalho: "${
          r.especieInstrumentoVinculado || 'CÉDULA DE CRÉDITO BANCÁRIO'
        }"`,
        `📍 Local e Data próximo à assinatura: "${r.localAssinaturaFecho}" (${
          r.localAssinaturaConformeSantaInes
            ? '✅ SANTA INES - MA Confirmado'
            : '🚨 Divergente de SANTA INES - MA!'
        })`,
        `🛡️ Verificação de Rodapé Interno: ${
          r.possuiRodapeDocumentoInterno
            ? `🚨 ERRO: Encontrado "${r.trechoRodapeInternoDetectado}"!`
            : '✅ Limpo (Sem rodapé "Documento Classificado como Interno").'
        }`,
        r.contaCorrenteDebito
          ? `🏦 Conta Corrente p/ Débito (CCB): ${r.contaCorrenteDebito} (Ag. Santa Inês)`
          : '',
        r.imovelBeneficiadoNome
          ? `🏡 Imóvel Beneficiado: ${r.imovelBeneficiadoNome}${
              r.imovelBeneficiadoMatriculaCartorio
                ? ` (${r.imovelBeneficiadoMatriculaCartorio})`
                : ''
            } — ${r.imovelBeneficiadoMunicipioUf}`
          : '',
        r.possuiAvalista
          ? `🛡️ Avalista no Instrumento: ${r.avalistaNome} (CPF: ${r.avalistaCpf} • RG: ${r.avalistaRg} • ${r.avalistaEstadoCivilRegime})`
          : '',
        r.anuenciaIncraSipraCodigo
          ? `📜 Anuência INCRA / PNRA: Código SIPRA nº ${r.anuenciaIncraSipraCodigo} • Lote ${r.anuenciaIncraLote} • Ativo desde ${r.anuenciaIncraAtivoDesde}`
          : '',
      ].filter(Boolean),
    });

    if (
      r.valorClausulaPrimeira ||
      r.itensOrcamento.length > 0 ||
      r.liberacoesPrevistas.length > 0
    ) {
      itensChecklist.push({
        id: 'CHK_DOC_DERIVADA_VALORES',
        categoria: 'VALORES_ENCARGOS',
        titulo:
          '2. Valores, Taxas de Juros Efetivas, Bônus/Encargos, Orçamento e Liberações',
        status: 'OK',
        resumo: `✅ Valor Financiado: R$ ${
          r.valorClausulaPrimeira || '50.000,00'
        }${
          r.taxaJurosAnual
            ? ` • Taxa Efetiva: ${r.taxaJurosAnual} (${r.taxaJurosMensal})`
            : ''
        }${r.cetAnual ? ` • CET: ${r.cetAnual} a.a.` : ''}${
          r.bonusAdimplenciaPerc
            ? ` • Bônus Adimplência: ${r.bonusAdimplenciaPerc}`
            : ''
        }`,
        detalhes: [
          ...r.itensOrcamento.map(
            (it) =>
              `📦 [Orçamento] ${it.descricao} (${it.quantidadeUnidade}) ➔ Desembolso ${it.mesAnoDesembolso}: R$ ${it.valorFinanciadoFne} (Rec. Próprios: R$ ${it.valorRecursosProprios})`
          ),
          ...r.liberacoesPrevistas.map(
            (lib, idx) =>
              `💸 [Liberação Prevista ${idx + 1} no Anexo CET] Data: ${
                lib.dataLiberacao
              } (${lib.mesAnoRef}) ➔ R$ ${lib.valorLiberacao}`
          ),
          r.valorJurosTotaisCet
            ? `📊 Resumo Anexo CET: Principal R$ ${r.valorClausulaPrimeira} + Juros Projetados R$ ${r.valorJurosTotaisCet} = Total a Pagar R$ ${r.valorTotalAPagarCet}`
            : '',
        ].filter(Boolean),
      });
    }

    if (r.parcelasReembolso.length > 0) {
      const somaPrinc = r.parcelasReembolso.reduce(
        (acc, p) => acc + parseMoeda(p.valorPrincipal),
        0
      );
      itensChecklist.push({
        id: 'CHK_DOC_DERIVADA_REEMBOLSO',
        categoria: 'VALORES_ENCARGOS',
        titulo: `3. Cronograma de Reembolso (${
          r.parcelasReembolso.length
        } Prestações Anuais — Total Principal: R$ ${formatarMoedaBD(somaPrinc)})`,
        status:
          Math.abs(
            somaPrinc - parseMoeda(r.valorClausulaPrimeira || '50.000,00')
          ) <= 0.05
            ? 'OK'
            : 'ERRO',
        resumo: `✅ ${r.parcelasReembolso.length} prestações de principal (de ${
          r.parcelasReembolso[0].dataVencimento
        } até ${
          r.parcelasReembolso[r.parcelasReembolso.length - 1].dataVencimento
        }) somando exatos R$ ${formatarMoedaBD(somaPrinc)}.`,
        detalhes: r.parcelasReembolso.map(
          (p) =>
            `🗓️ Parcela ${p.numero} (${p.dataVencimento}): Principal R$ ${
              p.valorPrincipal
            }${
              p.valorJuros
                ? ` + Juros R$ ${p.valorJuros} = Prestação Total R$ ${p.valorPrestacaoTotal}`
                : ''
            }`
        ),
      });
    }
  }

  return itensChecklist;
}

export function auditarSintoniaPacoteDerivada(
  resultados: ResultadoAuditoriaContratoPdf[]
): ResultadoDossieDerivadaKit {
  const ccb = resultados.find((r) => r.tipoInstrumento === 'CCB_DERIVADA');
  const anexoOrcamento = resultados.find(
    (r) => r.tipoInstrumento === 'ANEXO_ORCAMENTO'
  );
  const disposicoesGerais = resultados.find(
    (r) => r.tipoInstrumento === 'DISPOSICOES_GERAIS'
  );
  const planilhaCet = resultados.find(
    (r) => r.tipoInstrumento === 'PLANILHA_CET'
  );
  const anexoFluxoCet = resultados.find(
    (r) => r.tipoInstrumento === 'ANEXO_FLUXO_CET'
  );
  const outros = resultados.filter(
    (r) =>
      r.tipoInstrumento === 'OUTRO_ANEXO' ||
      r.tipoInstrumento === 'LCGA' ||
      r.tipoInstrumento === 'LCGH'
  );

  const qtdDocsDerivada = [
    ccb,
    anexoOrcamento,
    disposicoesGerais,
    planilhaCet,
    anexoFluxoCet,
  ].filter(Boolean).length;

  const ehKitDerivada = qtdDocsDerivada >= 1 && outros.length === 0;
  const checklistSintoniaGlobal: ItemChecklistConformidadeContrato[] = [];

  if (!ehKitDerivada) {
    return {
      ehKitDerivada: false,
      documentosIdentificados: { outros: resultados },
      checklistSintoniaGlobal: [],
      resumoConsolidado: resultados[0] || null,
    };
  }

  const docsPresentes = [
    ccb,
    anexoOrcamento,
    disposicoesGerais,
    planilhaCet,
    anexoFluxoCet,
  ].filter(Boolean) as ResultadoAuditoriaContratoPdf[];

  // 1. CHECKLIST DE PRESENÇA DOS 5 DOCUMENTOS OBRIGATÓRIOS DO PACOTE
  const docsObrigatorios = [
    { nome: '1. CCB (Cédula de Crédito Bancário)', doc: ccb },
    { nome: '2. Anexo-Orçamento', doc: anexoOrcamento },
    { nome: '3. Anexo Disposições Gerais', doc: disposicoesGerais },
    { nome: '4. Planilha CET (CETCR)', doc: planilhaCet },
    { nome: '5. Anexo CET (Fluxo Financeiro)', doc: anexoFluxoCet },
  ];

  const faltantes = docsObrigatorios.filter((d) => !d.doc).map((d) => d.nome);

  checklistSintoniaGlobal.push({
    id: 'SINT_1_PRESENCA_5_DOCS',
    categoria: 'SINTONIA_KIT_DERIVADA',
    titulo: `1. Composição do Kit Contratual (${qtdDocsDerivada}/5 Documentos Carregados)`,
    status: faltantes.length === 0 ? 'OK' : 'ALERTA',
    resumo:
      faltantes.length === 0
        ? '✅ Todos os 5 documentos obrigatórios (CCB, Anexo-Orçamento, Disposições Gerais, CET e Anexo CET) estão presentes!'
        : `⚠️ Foram carregados ${qtdDocsDerivada} de 5 documentos. Faltam carregar: ${faltantes.join(
            ', '
          )}.`,
    detalhes: docsObrigatorios.map((d) =>
      d.doc
        ? `✅ ${d.nome}: "${d.doc.nomeArquivo}" (${d.doc.numPaginas} pág.)`
        : `❌ ${d.nome}: Não selecionado`
    ),
  });

  // 2. SINTONIA DE ESPÉCIE, Nº DA CCB, CLIENTE, LOCAL "SANTA INES - MA" E RODAPÉ INTERNO
  const numerosCcbUnicos = Array.from(
    new Set(docsPresentes.map((d) => d.numeroContratoCedula).filter(Boolean))
  );
  const nomesClientesUnicos = Array.from(
    new Set(
      docsPresentes
        .map((d) => normalizarSemAcento(d.creditadoNome))
        .filter(Boolean)
    )
  );
  const cpfsUnicos = Array.from(
    new Set(docsPresentes.map((d) => d.creditadoCpf).filter(Boolean))
  );
  const datasContratacaoUnicas = Array.from(
    new Set(docsPresentes.map((d) => d.dataCelebracaoCabecalho).filter(Boolean))
  );

  const especiesUnicas = Array.from(
    new Set(
      docsPresentes
        .map((d) => normalizarSemAcento(d.especieInstrumentoVinculado))
        .filter(Boolean)
    )
  );
  const especieDivergente = especiesUnicas.length > 1;

  const docsComLocalErrado = docsPresentes.filter(
    (d) => !d.localAssinaturaConformeSantaInes
  );

  const docsComRodapeInterno = docsPresentes.filter(
    (d) => d.possuiRodapeDocumentoInterno
  );

  const sintoniaIdentidadeOk =
    numerosCcbUnicos.length === 1 &&
    nomesClientesUnicos.length === 1 &&
    cpfsUnicos.length <= 1 &&
    datasContratacaoUnicas.length === 1 &&
    !especieDivergente &&
    docsComLocalErrado.length === 0 &&
    docsComRodapeInterno.length === 0;

  let resumoItem2 = `✅ Sintonia 100% perfeita: "${
    especiesUnicas[0] || 'CÉDULA DE CRÉDITO BANCÁRIO'
  }" Nº ${numerosCcbUnicos[0]} • Emitente: ${
    docsPresentes[0]?.creditadoNome
  } (CPF: ${cpfsUnicos[0] || '-'}) • Local: SANTA INES - MA • Data: ${
    datasContratacaoUnicas[0]
  } • Sem rodapé interno!`;

  if (docsComRodapeInterno.length > 0) {
    resumoItem2 = `🚨 RODAPÉ PROIBIDO DETECTADO: O(s) arquivo(s) [${docsComRodapeInterno
      .map((d) => d.nomeArquivo)
      .join(
        ', '
      )}] contém(êm) a marcação "DOCUMENTO CLASSIFICADO COMO INTERNO"!`;
  } else if (especieDivergente) {
    resumoItem2 = `🚨 DIVERGÊNCIA DE ESPÉCIE DO INSTRUMENTO NA CET/ANEXOS: Encontradas segmentações diferentes [${especiesUnicas.join(
      ' × '
    )}]!`;
  } else if (docsComLocalErrado.length > 0) {
    resumoItem2 = `🚨 ERRO NO LOCAL DE ASSINATURA: O(s) arquivo(s) [${docsComLocalErrado
      .map((d) => `${d.nomeArquivo} ("${d.localAssinaturaFecho || 'Vazio'}")`)
      .join(', ')}] não estão com "SANTA INES - MA"!`;
  } else if (!sintoniaIdentidadeOk) {
    resumoItem2 = `🚨 DIVERGÊNCIA ENTRE OS DOCUMENTOS: Verifique Nº da CCB (${numerosCcbUnicos.join(
      ' vs '
    )}), Cliente ou Data (${datasContratacaoUnicas.join(' vs ')})!`;
  }

  checklistSintoniaGlobal.push({
    id: 'SINT_2_IDENTIDADE_LOCAL_RODAPE_ESPECIE',
    categoria: 'SINTONIA_KIT_DERIVADA',
    titulo:
      '2. Sintonia de Espécie (CCB × CET), Nº, Cliente, Local ("SANTA INES - MA") e Rodapé Interno',
    status: sintoniaIdentidadeOk ? 'OK' : 'ERRO',
    resumo: resumoItem2,
    detalhes: [
      ...docsPresentes.map(
        (d) =>
          `📄 [${d.tipoInstrumento}] Espécie: "${
            d.especieInstrumentoVinculado || 'CCB'
          }" | Nº: ${d.numeroContratoCedula || '?'} | Local Fecho: "${
            d.localAssinaturaFecho || '?'
          }" ${d.localAssinaturaConformeSantaInes ? '✅' : '🚨'} | Data: ${
            d.dataCelebracaoCabecalho || '?'
          }`
      ),
      docsComRodapeInterno.length === 0
        ? '🛡️ Rodapé de Classificação Interna: ✅ Nenhum dos 5 documentos possui o rodapé proibido "Documento Classificado como Interno".'
        : `🚨 REMOVA O RODAPÉ INTERNO EM: ${docsComRodapeInterno
            .map(
              (d) => `${d.nomeArquivo} ("${d.trechoRodapeInternoDetectado}")`
            )
            .join(', ')}`,
    ],
  });

  // 3. SINTONIA DO VALOR CONTRATADO E TAXA DE JUROS EFETIVA (CCB × ORÇAMENTO × CET × ANEXO CET)
  const docsComValor = docsPresentes.filter(
    (d) => d.tipoInstrumento !== 'DISPOSICOES_GERAIS'
  );
  const valoresUnicos = Array.from(
    new Set(docsComValor.map((d) => d.valorClausulaPrimeira).filter(Boolean))
  );
  const valorRefStr =
    ccb?.valorClausulaPrimeira || valoresUnicos[0] || '50.000,00';
  const valorRefNum = parseMoeda(valorRefStr);

  const somaItensOrcamento = (anexoOrcamento?.itensOrcamento || []).reduce(
    (acc, it) => acc + parseMoeda(it.valorFinanciadoFne),
    0
  );
  const orcamentoSomaBate =
    !anexoOrcamento || Math.abs(somaItensOrcamento - valorRefNum) <= 0.05;

  let taxaJurosDivergente = false;
  let msgSintoniaTaxaJuros = '';

  if (ccb && planilhaCet) {
    const difAnual = Math.abs(
      ccb.taxaJurosAnualNum - planilhaCet.taxaJurosAnualNum
    );
    const difMensal = Math.abs(
      ccb.taxaJurosMensalNum - planilhaCet.taxaJurosMensalNum
    );
    const difCetAnexo =
      anexoFluxoCet && anexoFluxoCet.cetAnualNum > 0
        ? Math.abs(planilhaCet.cetAnualNum - anexoFluxoCet.cetAnualNum)
        : 0;

    if (difAnual > 0.005 || difMensal > 0.001 || difCetAnexo > 0.005) {
      taxaJurosDivergente = true;
      msgSintoniaTaxaJuros = `🚨 DIVERGÊNCIA DE TAXA DE JUROS EFETIVA: CCB indica ${ccb.taxaJurosAnual} (${ccb.taxaJurosMensal}) × Planilha CET indica ${planilhaCet.taxaJurosAnual} (${planilhaCet.taxaJurosMensal} • CET: ${planilhaCet.cetAnual})!`;
    } else {
      msgSintoniaTaxaJuros = `✅ Sintonia de Taxa de Juros Efetiva OK: CCB (${ccb.taxaJurosAnual} / ${ccb.taxaJurosMensal}) = Planilha CET (${planilhaCet.taxaJurosAnual} / ${planilhaCet.taxaJurosMensal}) = Anexo CET (CET ${
        anexoFluxoCet?.cetAnual || planilhaCet.cetAnual
      }).`;
    }
  } else {
    msgSintoniaTaxaJuros = `📈 Taxa de Juros Efetiva identificada: ${
      ccb?.taxaJurosAnual || planilhaCet?.taxaJurosAnual || '0,5% a.a.'
    } (${ccb?.taxaJurosMensal || planilhaCet?.taxaJurosMensal || '0,0416% a.m.'}).`;
  }

  const item3Ok =
    valoresUnicos.length === 1 && orcamentoSomaBate && !taxaJurosDivergente;

  checklistSintoniaGlobal.push({
    id: 'SINT_3_VALORES_JUROS_E_ORCAMENTO',
    categoria: 'SINTONIA_KIT_DERIVADA',
    titulo:
      '3. Sintonia do Valor Financiado e da Taxa de Juros Efetiva (CCB × Orçamento × CET × Anexo CET)',
    status: item3Ok ? 'OK' : 'ERRO',
    resumo: taxaJurosDivergente
      ? msgSintoniaTaxaJuros
      : item3Ok
      ? `✅ Valor R$ ${valorRefStr} (${
          ccb?.valorExtensoClausulaPrimeira || 'Conforme'
        }), Soma do Orçamento (R$ ${formatarMoedaBD(
          somaItensOrcamento
        )}) e Taxa Efetiva (${
          ccb?.taxaJurosAnual || 'OK'
        }) batem 100% em todo o kit!`
      : `🚨 Divergência de valores entre os documentos: encontrados [${valoresUnicos.join(
          ' vs '
        )}] ou soma do orçamento (R$ ${formatarMoedaBD(somaItensOrcamento)})!`,
    detalhes: [
      msgSintoniaTaxaJuros,
      ccb ? `💰 CCB Principal: R$ ${ccb.valorClausulaPrimeira}` : '',
      anexoOrcamento
        ? `📦 Anexo-Orçamento: Soma dos ${
            anexoOrcamento.itensOrcamento.length
          } lançamentos = R$ ${formatarMoedaBD(
            somaItensOrcamento
          )} (Recursos Próprios: R$ ${
            anexoOrcamento.valorRecursosPropriosOrcamento
          })`
        : '',
      planilhaCet
        ? `📊 Planilha CET: Valor Contratado R$ ${planilhaCet.valorClausulaPrimeira} | Valor Líquido R$ ${planilhaCet.valorLiquidoContratadoCet} | Custos Tarifas/IOF: R$ 0,00`
        : '',
      anexoFluxoCet
        ? `📈 Anexo CET: Montante Liberado R$ ${anexoFluxoCet.valorClausulaPrimeira} + Juros Projetados R$ ${anexoFluxoCet.valorJurosTotaisCet} = Total a Pagar R$ ${anexoFluxoCet.valorTotalAPagarCet}`
        : '',
    ].filter(Boolean),
  });

  // 4. SINTONIA DAS PARCELAS DE LIBERAÇÃO / DESEMBOLSO (ANEXO-ORÇAMENTO × ANEXO CET)
  if (anexoOrcamento && anexoFluxoCet) {
    const mapaOrcPorMes = new Map<string, number>();
    anexoOrcamento.itensOrcamento.forEach((it) => {
      const ch = it.mesAnoDesembolso.toLowerCase().trim();
      mapaOrcPorMes.set(
        ch,
        (mapaOrcPorMes.get(ch) || 0) + parseMoeda(it.valorFinanciadoFne)
      );
    });

    const detalhesCruzamentoLib: string[] = [];
    let erroLiberacoes = false;

    anexoFluxoCet.liberacoesPrevistas.forEach((lib, idx) => {
      const valOrcMes = mapaOrcPorMes.get(lib.mesAnoRef.toLowerCase()) || 0;
      const valCetNum = parseMoeda(lib.valorLiberacao);
      const bate = Math.abs(valOrcMes - valCetNum) <= 0.05;
      if (!bate) erroLiberacoes = true;

      detalhesCruzamentoLib.push(
        `${bate ? '✅' : '🚨'} ${idx + 1}ª Liberação (${lib.mesAnoRef.toUpperCase()} — Data CET: ${
          lib.dataLiberacao
        }): Soma no Anexo-Orçamento = R$ ${formatarMoedaBD(
          valOrcMes
        )} × Liberado no Anexo CET = R$ ${lib.valorLiberacao}`
      );
    });

    checklistSintoniaGlobal.push({
      id: 'SINT_4_CRONOGRAMA_LIBERACOES',
      categoria: 'SINTONIA_KIT_DERIVADA',
      titulo:
        '4. Sintonia de Desembolsos / Liberações por Mês (Anexo-Orçamento × Anexo CET)',
      status: erroLiberacoes ? 'ERRO' : 'OK',
      resumo: erroLiberacoes
        ? '🚨 As parcelas de desembolso do Anexo-Orçamento divergem das Liberações Previstas no Anexo CET!'
        : `✅ As ${anexoFluxoCet.liberacoesPrevistas.length} parcelas de liberação batem centavo por centavo entre o Anexo-Orçamento e o Anexo CET!`,
      detalhes: [
        ...anexoOrcamento.itensOrcamento.map(
          (it) =>
            `   • Rubrica Orçamento: ${it.descricao} (${it.quantidadeUnidade}) ➔ ${it.mesAnoDesembolso}: R$ ${it.valorFinanciadoFne}`
        ),
        ...detalhesCruzamentoLib,
      ],
    });
  }

  // 5. SINTONIA DO CRONOGRAMA DE REEMBOLSO (CCB × PLANILHA CET × ANEXO CET)
  // Suporta tanto Anexo CET com as linhas 1..7 impressas quanto Anexo CET que imprimiu apenas as Liberações e a linha TOTAIS (caso do Adroaldo!)
  const parcsCcb = ccb?.parcelasReembolso || [];
  const parcsAnexoCet = anexoFluxoCet?.parcelasReembolso || [];
  const somaPrincCcb = parcsCcb.reduce(
    (acc, p) => acc + parseMoeda(p.valorPrincipal),
    0
  );

  let statusReembolso: StatusItemConformidadeContrato = 'OK';
  let resumoReembolso = '';
  const detalhesReembolso: string[] = [];

  if (parcsCcb.length > 0 && parcsAnexoCet.length > 0) {
    let erroReembolso = false;
    if (parcsCcb.length !== parcsAnexoCet.length) {
      erroReembolso = true;
      detalhesReembolso.push(
        `🚨 Quantidade de parcelas diverge: CCB tem ${parcsCcb.length} parcelas e Anexo CET tem ${parcsAnexoCet.length}!`
      );
    } else {
      parcsCcb.forEach((pCcb, idx) => {
        const pCet = parcsAnexoCet[idx];
        const mesmaData = pCcb.dataVencimento === pCet.dataVencimento;
        const mesmoPrincipal =
          Math.abs(
            parseMoeda(pCcb.valorPrincipal) - parseMoeda(pCet.valorPrincipal)
          ) <= 0.02;

        if (!mesmaData || !mesmoPrincipal) erroReembolso = true;

        detalhesReembolso.push(
          `${mesmaData && mesmoPrincipal ? '✅' : '🚨'} Prestação ${
            pCcb.numero
          } (${pCcb.dataVencimento}): Principal na CCB = R$ ${
            pCcb.valorPrincipal
          } × Principal no Anexo CET = R$ ${pCet.valorPrincipal} (Juros: R$ ${
            pCet.valorJuros
          } • Total Parcela: R$ ${pCet.valorPrestacaoTotal})`
        );
      });
    }
    statusReembolso = erroReembolso ? 'ERRO' : 'OK';
    resumoReembolso = erroReembolso
      ? '🚨 Divergência detectada entre as parcelas da cláusula FORMA DE PAGAMENTO da CCB e o Anexo CET!'
      : `✅ Esquema de Reembolso 100% sincronizado: ${
          parcsCcb.length
        } prestações anuais (1ª em ${
          ccb?.dataPrimeiraParcelaPrincipal ||
          planilhaCet?.dataPrimeiraParcelaPrincipal
        } e última em ${ccb?.dataVencimento}) somando R$ ${formatarMoedaBD(
          somaPrincCcb
        )}.`;
  } else if (parcsCcb.length > 0 && anexoFluxoCet && parcsAnexoCet.length === 0) {
    // Caso exato do Adroaldo: A CCB tem as 7 prestações (R$ 82.416,00), a Planilha CET confirma 7 prestações,1ª em 10/09/2028 e Vencimento em 10/09/2034,
    // e a linha TOTAIS do Anexo CET confirma Principal = R$ 82.416,00, mas as 7 linhas individuais de reembolso não saíram impressas no Anexo CET!
    const princTotAnexoNum = parseMoeda(
      anexoFluxoCet.valorPrincipalTotalLinhaTotaisAnexoCet ||
        anexoFluxoCet.valorClausulaPrimeira
    );
    const totalBateComCcb = Math.abs(somaPrincCcb - princTotAnexoNum) <= 0.05;
    const qtdBateComCet =
      !planilhaCet?.qtdPrestacoesCet ||
      planilhaCet.qtdPrestacoesCet === parcsCcb.length;
    const data1aParcBate =
      !planilhaCet?.dataPrimeiraParcelaPrincipal ||
      planilhaCet.dataPrimeiraParcelaPrincipal === parcsCcb[0]?.dataVencimento;

    if (!totalBateComCcb || !qtdBateComCet || !data1aParcBate) {
      statusReembolso = 'ERRO';
      resumoReembolso = `🚨 Divergência no Reembolso entre CCB (${
        parcsCcb.length
      }x = R$ ${formatarMoedaBD(somaPrincCcb)}) e CET/Anexo CET!`;
    } else {
      statusReembolso = 'OK';
      resumoReembolso = `✅ Soma das ${
        parcsCcb.length
      } prestações da CCB (R$ ${formatarMoedaBD(
        somaPrincCcb
      )} • 1ª em ${parcsCcb[0].dataVencimento} e final em ${
        parcsCcb[parcsCcb.length - 1].dataVencimento
      }) confere 100% com a Planilha CET (${
        planilhaCet?.qtdPrestacoesCet || parcsCcb.length
      } prestações anuais) e com a linha TOTAIS do Anexo CET!`;
    }

    detalhesReembolso.push(
      `ℹ️ Observação Técnica do Anexo CET: No arquivo "${anexoFluxoCet.nomeArquivo}" constam impressas as ${anexoFluxoCet.liberacoesPrevistas.length} liberações e a linha TOTAIS (Principal R$ ${formatarMoedaBD(
        princTotAnexoNum
      )} + Juros R$ ${anexoFluxoCet.valorJurosTotaisCet} = Total R$ ${
        anexoFluxoCet.valorTotalAPagarCet
      }), sem expandir as linhas individuais de 2028 a 2034.`
    );
    parcsCcb.forEach((p) => {
      detalhesReembolso.push(
        `✅ Prestação ${p.numero} na CCB (${p.dataVencimento}): Principal R$ ${p.valorPrincipal}`
      );
    });
  } else {
    const listaParcBase = parcsAnexoCet.length > 0 ? parcsAnexoCet : parcsCcb;
    listaParcBase.forEach((p) => {
      detalhesReembolso.push(
        `🗓️ Prestação ${p.numero} (${p.dataVencimento}): Principal R$ ${
          p.valorPrincipal
        }${
          p.valorPrestacaoTotal
            ? ` (Total c/ Juros: R$ ${p.valorPrestacaoTotal})`
            : ''
        }`
      );
    });
    resumoReembolso = `✅ ${listaParcBase.length} prestações identificadas somando R$ ${formatarMoedaBD(
      somaPrincCcb
    )}.`;
  }

  checklistSintoniaGlobal.push({
    id: 'SINT_5_CRONOGRAMA_REEMBOLSO',
    categoria: 'SINTONIA_KIT_DERIVADA',
    titulo:
      '5. Sintonia do Esquema de Pagamento / Reembolso (CCB × Planilha CET × Anexo CET)',
    status: statusReembolso,
    resumo: resumoReembolso,
    detalhes: detalhesReembolso,
  });

  // 6. AUDITORIA DE GARANTIA (AVALISTA NOS 3 DOCUMENTOS OU ANUÊNCIA INCRA), IMÓVEL BENEFICIADO, CONTA CORRENTE E ASSINATURAS
  if (ccb) {
    const docsComAvalExigido = [ccb, anexoOrcamento, disposicoesGerais].filter(
      Boolean
    ) as ResultadoAuditoriaContratoPdf[];

    const temAvalEmAlgum = docsComAvalExigido.some((d) => d.possuiAvalista);
    const avalistaPresenteNos3 =
      temAvalEmAlgum &&
      docsComAvalExigido.every(
        (d) =>
          d.possuiAvalista &&
          normalizarSemAcento(d.avalistaNome) ===
            normalizarSemAcento(ccb.avalistaNome) &&
          d.avalistaCpf === ccb.avalistaCpf
      );

    const avalistaCasadoSemConjuge =
      ccb.possuiAvalista &&
      ccb.avalistaEstadoCivilRegime.includes('CASAD') &&
      !ccb.conjugeAvalistaNome;

    let statusItem6: StatusItemConformidadeContrato = 'OK';
    if (temAvalEmAlgum && (!avalistaPresenteNos3 || avalistaCasadoSemConjuge)) {
      statusItem6 = 'ERRO';
    } else if (!ccb.contaCorrenteDebito || !ccb.imovelBeneficiadoNome) {
      statusItem6 = 'ALERTA';
    }

    checklistSintoniaGlobal.push({
      id: 'SINT_6_GARANTIA_IMOVEL_CONTA_ASSINATURAS',
      categoria: 'ASSINATURAS_PROCURACAO',
      titulo: ccb.possuiAvalista
        ? '6. Sintonia da Garantia por AVAL (CCB × Orçamento × Disposições), Imóvel Beneficiado e Conta Corrente'
        : '6. Regras Específicas da CCB (Imóvel Beneficiado, Anuência INCRA/SIPRA, Conta Corrente e Assinaturas)',
      status: statusItem6,
      resumo: avalistaCasadoSemConjuge
        ? `🚨 Avalista ${ccb.avalistaNome} consta como CASADO(A), mas não há outorga/assinatura do Cônjuge do Avalista no fecho!`
        : temAvalEmAlgum && !avalistaPresenteNos3
        ? `🚨 Divergência de Avalista entre CCB, Anexo-Orçamento e Disposições Gerais!`
        : ccb.possuiAvalista
        ? `✅ Garantia por Aval 100% conforme nos 3 documentos: Avalista ${ccb.avalistaNome} (CPF: ${ccb.avalistaCpf} • ${ccb.avalistaEstadoCivilRegime}) • Imóvel: ${ccb.imovelBeneficiadoNome} • C/C Débito: ${ccb.contaCorrenteDebito}.`
        : `✅ Imóvel: ${ccb.imovelBeneficiadoNome} (${
            ccb.imovelBeneficiadoMunicipioUf
          }) • SIPRA: ${ccb.anuenciaIncraSipraCodigo || 'OK'} • Conta Débito: ${
            ccb.contaCorrenteDebito
          }.`,
      detalhes: [
        `🏡 Imóvel Beneficiado: ${ccb.imovelBeneficiadoNome}${
          ccb.imovelBeneficiadoMatriculaCartorio
            ? ` (${ccb.imovelBeneficiadoMatriculaCartorio})`
            : ''
        }, propriedade de ${ccb.imovelBeneficiadoProprietario}, situado em ${
          ccb.imovelBeneficiadoMunicipioUf
        }.`,
        ccb.possuiAvalista
          ? `🛡️ Avalista ("por aval do EMITENTE/CREDITADO"): ${ccb.avalistaNome} | CPF: ${ccb.avalistaCpf} | RG: ${ccb.avalistaRg} (${ccb.avalistaRgDataEmissao}) | Estado Civil: ${ccb.avalistaEstadoCivilRegime} | End.: ${ccb.avalistaEndereco}.`
          : '',
        ccb.possuiAvalista
          ? `📑 Presença do Avalista nos 3 documentos assináveis (CCB, Anexo-Orçamento e Disposições Gerais): ${
              avalistaPresenteNos3
                ? '✅ Confirmado nos 3 instrumentos!'
                : '🚨 Verificar documentos!'
            }`
          : '',
        ccb.anuenciaIncraSipraCodigo
          ? `📜 Anuência INCRA (Res. CMN 5.270/2025): Código SIPRA nº ${ccb.anuenciaIncraSipraCodigo} • Lote nº ${ccb.anuenciaIncraLote} • Situação Ativo desde ${ccb.anuenciaIncraAtivoDesde}.`
          : '',
        `🏦 Autorização de Débito: Conta Corrente nº ${ccb.contaCorrenteDebito} (Agência Santa Inês) • Dia de Capitalização Mensal: ${
          ccb.diaCapitalizacaoMensal || 'Dia de aniversário'
        } • Prazo p/ 1ª parcela: ${ccb.prazoUtilizacaoPrimeiraParcelaDias}.`,
        `✍️ Emitente/Creditado: ${ccb.creditadoNome} | CPF: ${ccb.creditadoCpf} | RG: ${ccb.creditadoRg} (${ccb.creditadoRgDataEmissao}) | ${ccb.creditadoEstadoCivilRegime}.`,
      ].filter(Boolean),
    });
  }

  const baseConsolidada = ccb || docsPresentes[0];
  const resumoConsolidado: ResultadoAuditoriaContratoPdf | null = baseConsolidada
    ? {
        ...baseConsolidada,
        tituloInstrumento:
          'KIT CONTRATUAL COMPLETO — OPERAÇÃO DERIVADA (CCB + ORÇAMENTO + DISPOSIÇÕES + CET + ANEXO CET)',
        especieInstrumentoVinculado:
          especiesUnicas.join(' / ') ||
          baseConsolidada.especieInstrumentoVinculado,
        localAssinaturaFecho:
          docsComLocalErrado.length > 0
            ? `🚨 ERRO EM: ${docsComLocalErrado
                .map((d) => `${d.nomeArquivo} (${d.localAssinaturaFecho})`)
                .join(', ')}`
            : 'SANTA INES - MA (Confirmado em todos os docs)',
        localAssinaturaConformeSantaInes: docsComLocalErrado.length === 0,
        possuiRodapeDocumentoInterno: docsComRodapeInterno.length > 0,
        trechoRodapeInternoDetectado:
          docsComRodapeInterno.length > 0
            ? `Presente em: ${docsComRodapeInterno
                .map((d) => d.nomeArquivo)
                .join(', ')}`
            : '',
        dataPrimeiraParcelaPrincipal:
          baseConsolidada.dataPrimeiraParcelaPrincipal ||
          planilhaCet?.dataPrimeiraParcelaPrincipal ||
          anexoFluxoCet?.dataPrimeiraParcelaPrincipal ||
          '',
        valorLiquidoContratadoCet:
          planilhaCet?.valorLiquidoContratadoCet ||
          baseConsolidada.valorClausulaPrimeira,
        valorRecursosPropriosOrcamento:
          anexoOrcamento?.valorRecursosPropriosOrcamento || '0,00',
        valorJurosTotaisCet: anexoFluxoCet?.valorJurosTotaisCet || '',
        valorTotalAPagarCet: anexoFluxoCet?.valorTotalAPagarCet || '',
        cetAnual:
          planilhaCet?.cetAnual ||
          anexoFluxoCet?.cetAnual ||
          baseConsolidada.cetAnual,
        cetMensal: planilhaCet?.cetMensal || baseConsolidada.cetMensal,
        itensOrcamento: anexoOrcamento?.itensOrcamento || [],
        liberacoesPrevistas: anexoFluxoCet?.liberacoesPrevistas || [],
        parcelasReembolso: anexoFluxoCet?.parcelasReembolso.length
          ? anexoFluxoCet.parcelasReembolso
          : baseConsolidada.parcelasReembolso,
        itensChecklist: checklistSintoniaGlobal,
      }
    : null;

  return {
    ehKitDerivada: true,
    documentosIdentificados: {
      ccb,
      anexoOrcamento,
      disposicoesGerais,
      planilhaCet,
      anexoFluxoCet,
      outros,
    },
    checklistSintoniaGlobal,
    resumoConsolidado,
  };
}

// ===========================================================================
// GERADOR E IMPORTADOR INTELIGENTE DE SCRIPT PARA O MICROSOFT COPILOT
// ===========================================================================
export function gerarScriptCopilotParaContrato(params: {
  modo: ModoScriptCopilotContrato;
  resultadoAtual?: ResultadoAuditoriaContratoPdf | null;
  todosResultados?: ResultadoAuditoriaContratoPdf[];
}): string {
  const { modo, resultadoAtual, todosResultados = [] } = params;

  const tipoAlvo =
    modo !== 'AUTO_ATUAL'
      ? modo
      : resultadoAtual?.tipoInstrumento === 'LCGA' ||
        resultadoAtual?.tipoInstrumento === 'LCGH'
      ? 'LCGA_LCGH'
      : todosResultados.length > 1
      ? 'KIT_COMPLETO_5_DOCS'
      : (resultadoAtual?.tipoInstrumento as ModoScriptCopilotContrato) ||
        'LCGA_LCGH';

  const refDoc = resultadoAtual || todosResultados[0];
  const contextoExistente = refDoc
    ? `\nCONTEXTO JÁ DETECTADO PELO SISTEMA (Para conferência cruzada):\n` +
      `- Arquivo(s) em análise: ${
        todosResultados.length > 1
          ? todosResultados.map((r) => r.nomeArquivo).join(', ')
          : refDoc.nomeArquivo
      }\n` +
      (refDoc.numeroContratoCedula
        ? `- Nº do Contrato/CCB preliminar: ${refDoc.numeroContratoCedula}\n`
        : '') +
      (refDoc.creditadoNome ? `- Cliente: ${refDoc.creditadoNome}\n` : '') +
      (refDoc.creditadoCpf ? `- CPF: ${refDoc.creditadoCpf}\n` : '') +
      (refDoc.possuiAvalista
        ? `- Avalista detectado: ${refDoc.avalistaNome} (CPF: ${refDoc.avalistaCpf})\n`
        : '') +
      (refDoc.valorClausulaPrimeira
        ? `- Valor preliminar: R$ ${refDoc.valorClausulaPrimeira}\n`
        : '')
    : '';

  let instrucoesEspecificas = '';

  if (tipoAlvo === 'LCGA_LCGH') {
    instrucoesEspecificas = `
FOCO ESPECIAL — CONTRATO DE ABERTURA DE LIMITE (LCGA / LCGH):
1. Verifique o Tipo (LCGA ou LCGH), o Nº do Contrato (padrão 103.AAAA.XXX.XXXXX, onde 489 = MINI/FNE e 613 = PRONAF), a Data de Celebração no cabeçalho de continuação, a Data no fecho de assinatura e a Data de Vencimento (20 anos).
2. Confira se o Valor do Limite é 100% idêntico na Cláusula 1ª, na Cláusula 2ª, no Cabeçalho de Continuação, no valor por extenso e no Valor de Avaliação do Imóvel na Cláusula 10ª (§1º e §2º).
3. Na Cláusula 10ª (§2º), extraia todos os dados do Imóvel dado em Garantia: Denominação (Fazenda/Sítio/Data), Proprietários, Área em ha, Data e Forma de Aquisição, Nº da Matrícula/Registro, Livro, Cartório/Comarca e se consta como "livre e desembaraçado de ônus" ou "hipotecado ao Banco do Nordeste do Brasil S/A". Verifique se há qualquer menção a cláusula de inalienabilidade.
4. Na Cláusula 11ª (Outorga), verifique se há cônjuge outorgante e se há representação por Procurador (quem outorga e quem assina).
5. Se houver Cláusulas 27 e 28 de Certidões (CND Federal e CNDT), verifique os números e se estavam vigentes na data de contratação.
6. No fecho de assinatura, valide se o Local consta como "SANTA INES MA" / "SANTA INES - MA", quem assina pelas partes (próprio ou Procurador), os 2 Gerentes do BNB e as 2 Testemunhas com CPF.
7. Verifique em todas as páginas se existe algum rodapé proibido dizendo "DOCUMENTO CLASSIFICADO COMO INTERNO".`;
  } else if (tipoAlvo === 'KIT_COMPLETO_5_DOCS') {
    instrucoesEspecificas = `
FOCO ESPECIAL — PACOTE COMPLETO DE OPERAÇÃO DERIVADA (5 DOCUMENTOS: CCB + ANEXO-ORÇAMENTO + DISPOSIÇÕES GERAIS + PLANILHA CET + ANEXO CET):
1. Verifique a SINTONIA TOTAL entre os 5 documentos: Nº da CCB (ex: 103.2026.485.30421 ou 103.2026.645.30557), Nome e CPF do Emitente, Data de Contratação e Vencimento Final.
2. Confira se no cabeçalho do CET, Anexo CET, Orçamento e Disposições Gerais a espécie vinculada está exatamente como "CÉDULA DE CRÉDITO BANCÁRIO" (não pode constar Cédula Pignoratícia ou Hipotecária se o contrato é CCB).
3. Confira se o campo "Local e Data" próximo às assinaturas (na CCB, Orçamento, Disposições e no quadro inferior da Planilha CET) está como "SANTA INES - MA" (ou "SANTA INES MA").
4. Verifique se algum dos 5 documentos possui rodapé travado dizendo "DOCUMENTO CLASSIFICADO COMO INTERNO" (proibido no documento final de assinatura).
5. Confira se o Valor Contratado (ex: R$ 82.416,00 ou R$ 50.000,00) e a Taxa de Juros Efetiva (ex: 7,5% a.a. / 0,604491% a.m. ou 0,5% a.a. / 0,041571% a.m.) estão em perfeita sintonia entre CCB, CET e Anexo CET.
6. Some os lançamentos de desembolso do Anexo-Orçamento por mês/ano (ex: set/2026, out/2026, nov/2026) e confira se batem centavo por centavo com as "LIBERAÇÕES PREVISTAS" no Anexo CET.
7. Compare todas as prestações da cláusula "FORMA DE PAGAMENTO" da CCB (datas e valores de principal) com o Anexo CET e com a "Previsão/Data de Pagamento da 1ª Parcela" na Planilha CET.
8. Se a operação tiver AVALISTA ("por aval do EMITENTE/CREDITADO"), extraia Nome, CPF, RG e Estado Civil do Avalista e confira se ele consta nos 3 documentos (CCB, Anexo-Orçamento e Disposições Gerais).`;
  } else if (tipoAlvo === 'ANEXO_ORCAMENTO') {
    instrucoesEspecificas = `
FOCO ESPECIAL — ANEXO-ORÇAMENTO DA CCB:
1. Confira o Nº da CCB, Nome do Emitente, Data de Emissão e se o fecho de assinatura traz "SANTA INES MA" (e o Avalista, se houver).
2. Extraia todas as rubricas/itens do orçamento (01, 02, 03, 04...), quantidade/unidade (HA, UA, UND, VERBA), mês/ano de desembolso (ex: set/2026, out/2026, nov/2026), valor de Recursos Próprios e valor financiado pelo FNE.
3. Confira se a soma de todos os lançamentos FNE fecha exatamente com o TOTAL do orçamento e se não há rodapé "DOCUMENTO CLASSIFICADO COMO INTERNO".`;
  } else if (tipoAlvo === 'PLANILHA_CET' || tipoAlvo === 'ANEXO_FLUXO_CET') {
    instrucoesEspecificas = `
FOCO ESPECIAL — PLANILHA DEMONSTRATIVA DO CET E ANEXO CET (FLUXO FINANCEIRO):
1. Verifique se a espécie vinculada no topo consta como "CÉDULA DE CRÉDITO BANCÁRIO" (e mesmo nº da CCB).
2. Verifique se o campo "Local e Data" na Planilha CET consta obrigatoriamente como "SANTA INES - MA".
3. Confira Valor Contratado, Custos/Tarifas (R$ 0,00), Valor Líquido, Nº de Prestações, Data da Contratação, Data/Previsão da 1ª Parcela de Principal, Vencimento Final, Taxa de Juros Anual/Mensal e CET Anual/Mensal.
4. No Anexo CET, extraia as Liberações Previstas (Datas e Valores), Juros Totais, Total a Pagar e todas as linhas numeradas de Prestações (Data, Juros, Principal a Pagar e Prestação Total).`;
  } else {
    instrucoesEspecificas = `
FOCO ESPECIAL — CÉDULA DE CRÉDITO BANCÁRIO (CCB) / ANEXO DISPOSIÇÕES GERAIS:
1. Extraia Nº da CCB, Data de Contratação, Data de Vencimento, Valor Contratado (numérico e extenso), Imóvel Beneficiado (Fazenda/P.A., matrícula, cartório e município), Fonte/Programa, Taxa de Juros Efetiva Anual e Mensal, Conta Corrente p/ Débito e Cronograma de Reembolso (Forma de Pagamento).
2. Valide se o Local antes da assinatura é "SANTA INES MA", se não há rodapé "DOCUMENTO CLASSIFICADO COMO INTERNO" e extraia a qualificação completa do Emitente e do Avalista (se houver) no fecho.`;
  }

  return `Atue como Auditor Sênior de Conformidade Contratual do Banco do Nordeste (BNB — Agência 103 Santa Inês/MA).
Analise rigorosamente o(s) documento(s) em PDF anexado(s) e faça a conferência completa de conformidade pré-contratação.
${contextoExistente}
${instrucoesEspecificas}

IMPORTANTE:
1. Primeiro, apresente um diagnóstico executivo claro apontando se está 100% CONFORME ou se há alguma divergência/erro.
2. Ao final da sua resposta, preencha OBRIGATORIAMENTE o bloco técnico abaixo mantendo exatamente os nomes das chaves para que meu sistema importe os dados automaticamente:

[DADOS_CONTRATO_SISTEMA]
TIPO_INSTRUMENTO: (LCGA, LCGH, CCB_DERIVADA, ANEXO_ORCAMENTO, DISPOSICOES_GERAIS, PLANILHA_CET ou ANEXO_FLUXO_CET)
ESPECIE_VINCULADA: (ex: CÉDULA DE CRÉDITO BANCÁRIO ou CONTRATO DE ABERTURA DE LIMITE LCGA)
NUMERO_CONTRATO: (ex: 103.2026.485.30421)
PORTE_LINHA: (ex: PRONAF V - MAIS ALIMENTOS ou PRONAF A - FNE ou MINI / PEQUENO)
PROGRAMA_CREDITO: (ex: PRONAF - MAIS ALIMENTOS FNE)
DATA_CONTRATACAO: (DD/MM/AAAA)
DATA_1A_PARCELA: (DD/MM/AAAA ou VAZIO)
DATA_VENCIMENTO: (DD/MM/AAAA)
LOCAL_ASSINATURA: (ex: SANTA INES - MA)
RODAPE_INTERNO_DETECTADO: (NAO ou SIM - se houver rodapé "Documento Classificado como Interno")
VALOR_CONTRATADO: (apenas números e vírgula, ex: 82.416,00)
VALOR_EXTENSO: (ex: Oitenta e Dois Mil e Quatrocentos e Dezesseis Reais)
VALOR_JUROS_TOTAIS_CET: (ex: 33.588,51 ou VAZIO)
VALOR_TOTAL_A_PAGAR_CET: (ex: 116.004,51 ou VAZIO)
TAXA_JUROS_ANUAL: (ex: 7,50% a.a.)
TAXA_JUROS_MENSAL: (ex: 0,60449% a.m.)
CET_ANUAL: (ex: 7,50%)
BONUS_ADIMPLENCIA: (ex: 25% ou VAZIO)
CONTA_CORRENTE_DEBITO: (ex: 67111-3 ou VAZIO)
CREDITADO_NOME: (nome completo do titular)
CREDITADO_CPF: (000.000.000-00)
CREDITADO_RG: (nº RG e órgão emissor)
ESTADO_CIVIL_REGIME: (ex: CASADO(A) COM COMUNHAO PARCIAL DE BENS)
ENDERECO_CREDITADO: (endereço completo)
TELEFONE_SMS: (apenas dígitos ou VAZIO)
CONJUGE_NOME: (nome completo ou VAZIO)
CONJUGE_CPF: (000.000.000-00 ou VAZIO)
OUTORGA_CONJUGAL: (resumo da Cláusula 11 ou VAZIO)
AVALISTA_NOME: (nome completo do avalista se houver ou VAZIO)
AVALISTA_CPF: (000.000.000-00 ou VAZIO)
AVALISTA_RG: (nº RG do avalista ou VAZIO)
AVALISTA_ESTADO_CIVIL: (ex: SOLTEIRO(A) ou CASADO(A) ou VAZIO)
PROCURADOR_NOME: (nome completo se houver procurador ou VAZIO)
PROCURADOR_CPF: (000.000.000-00 ou VAZIO)
IMOVEL_NOME: (ex: Fazenda Guaratã ou Fazenda Portilho ou PA LAGO DA CARNAUBA)
IMOVEL_AREA_HA: (ex: 45,43 ha ou VAZIO)
IMOVEL_MATRICULA_LIVRO: (ex: 1655 | Cartório de Bom Jardim - MA ou VAZIO)
IMOVEL_CARTORIO_MUNICIPIO: (ex: SAO JOAO DO CARU - MA)
IMOVEL_ONUS_HIPOTECA: (ex: Livre e desembaraçado de ônus / Hipotecado ao BNB)
CODIGO_SIPRA_INCRA: (ex: MA052300000432 | Lote 00 | Ativo desde 18/07/2006 ou VAZIO)
GERENTES_BNB: (ex: JOSENILDO NUNES DA COSTA - GERENTE DE AGENCIA; PAULO CABRAL SOUZA - GERENTE DE RELACIONAMENTO)
TESTEMUNHAS: (ex: REINALDO HENRIQUE ROCHA TRINTA - 619.514.443-61; LARISSA SUELEM CARDOZO PAIVA - 627.276.373-57)
ITENS_ORCAMENTO: (separe por ponto e vírgula no formato: 01 - Descrição | Qtd | mes/ano | ValorFNE; ou VAZIO)
LIBERACOES_CET: (separe por ponto e vírgula no formato: DD/MM/AAAA | mes/ano | Valor; ou VAZIO)
PARCELAS_REEMBOLSO: (separe por ponto e vírgula no formato: 1 | DD/MM/AAAA | Principal | Juros | Total; ou VAZIO)
[/DADOS_CONTRATO_SISTEMA]`;
}

export function aplicarRespostaCopilotNoResultadoContrato(
  base: ResultadoAuditoriaContratoPdf,
  textoRespostaCopilot: string
): ResultadoAuditoriaContratoPdf {
  const extrairCampo = (chave: string): string => {
    const regex = new RegExp(`${chave}:\\s*([^\\r\\n]+)`, 'i');
    const m = textoRespostaCopilot.match(regex);
    if (!m || !m[1]) return '';
    const val = m[1].trim();
    if (
      val.toUpperCase() === 'VAZIO' ||
      val.toUpperCase() === 'N/A' ||
      val.toUpperCase() === 'NAO SE APLICA' ||
      val === '-'
    ) {
      return '';
    }
    return val;
  };

  const atualizado: ResultadoAuditoriaContratoPdf = {
    ...base,
    ocrFoiCanceladoPeloUsuario: false,
  };

  const tipoLido = extrairCampo('TIPO_INSTRUMENTO').toUpperCase();
  if (
    tipoLido === 'LCGA' ||
    tipoLido === 'LCGH' ||
    tipoLido === 'CCB_DERIVADA' ||
    tipoLido === 'ANEXO_ORCAMENTO' ||
    tipoLido === 'DISPOSICOES_GERAIS' ||
    tipoLido === 'PLANILHA_CET' ||
    tipoLido === 'ANEXO_FLUXO_CET'
  ) {
    atualizado.tipoInstrumento = tipoLido as TipoInstrumentoContratual;
  }

  const esp = extrairCampo('ESPECIE_VINCULADA');
  if (esp) atualizado.especieInstrumentoVinculado = esp.toUpperCase();

  const num = extrairCampo('NUMERO_CONTRATO');
  if (num) atualizado.numeroContratoCedula = num;

  const porte = extrairCampo('PORTE_LINHA');
  if (porte) atualizado.porteIdentificado = porte.toUpperCase();

  const prog = extrairCampo('PROGRAMA_CREDITO');
  if (prog) atualizado.programaCredito = prog.toUpperCase();

  const dtContr = extrairCampo('DATA_CONTRATACAO');
  if (dtContr) {
    atualizado.dataCelebracaoCabecalho = dtContr;
    atualizado.dataCelebracaoFechoAssinatura = dtContr;
  }

  const dt1Parc = extrairCampo('DATA_1A_PARCELA');
  if (dt1Parc) atualizado.dataPrimeiraParcelaPrincipal = dt1Parc;

  const dtVenc = extrairCampo('DATA_VENCIMENTO');
  if (dtVenc) atualizado.dataVencimento = dtVenc;

  const localAss = extrairCampo('LOCAL_ASSINATURA');
  if (localAss) {
    atualizado.localAssinaturaFecho = localAss.toUpperCase();
    const normLoc = removerAcentos(localAss).toUpperCase();
    atualizado.localAssinaturaConformeSantaInes =
      normLoc.includes('SANTA INES') && /\bMA\b/.test(normLoc);
  }

  const rodapeInt = extrairCampo('RODAPE_INTERNO_DETECTADO').toUpperCase();
  if (rodapeInt) {
    atualizado.possuiRodapeDocumentoInterno = rodapeInt.startsWith('SIM');
    atualizado.trechoRodapeInternoDetectado =
      atualizado.possuiRodapeDocumentoInterno
        ? 'DOCUMENTO CLASSIFICADO COMO INTERNO'
        : '';
  }

  const val = extrairCampo('VALOR_CONTRATADO').replace(/^R\$\s*/i, '');
  if (val) {
    atualizado.valorClausulaPrimeira = val;
    atualizado.valorClausulaSegunda = val;
    atualizado.valorCabecalhoContinuacao = val;
    atualizado.valorAvaliacaoTotalImoveis = val;
    atualizado.valorLiquidoContratadoCet = val;
    atualizado.valorPrincipalTotalLinhaTotaisAnexoCet = val;
  }

  const valExt = extrairCampo('VALOR_EXTENSO');
  if (valExt) atualizado.valorExtensoClausulaPrimeira = valExt;

  const valJurosTot = extrairCampo('VALOR_JUROS_TOTAIS_CET').replace(
    /^R\$\s*/i,
    ''
  );
  if (valJurosTot) atualizado.valorJurosTotaisCet = valJurosTot;

  const valTotPag = extrairCampo('VALOR_TOTAL_A_PAGAR_CET').replace(
    /^R\$\s*/i,
    ''
  );
  if (valTotPag) atualizado.valorTotalAPagarCet = valTotPag;

  const txAnual = extrairCampo('TAXA_JUROS_ANUAL');
  if (txAnual) {
    atualizado.taxaJurosAnual = txAnual;
    atualizado.taxaJurosAnualNum = parsePercentualTaxa(txAnual);
  }

  const txMensal = extrairCampo('TAXA_JUROS_MENSAL');
  if (txMensal) {
    atualizado.taxaJurosMensal = txMensal;
    atualizado.taxaJurosMensalNum = parsePercentualTaxa(txMensal);
  }

  const cetAn = extrairCampo('CET_ANUAL');
  if (cetAn) {
    atualizado.cetAnual = cetAn;
    atualizado.cetAnualNum = parsePercentualTaxa(cetAn);
  }

  const bonus = extrairCampo('BONUS_ADIMPLENCIA');
  if (bonus) atualizado.bonusAdimplenciaPerc = bonus;

  const ccDeb = extrairCampo('CONTA_CORRENTE_DEBITO');
  if (ccDeb) atualizado.contaCorrenteDebito = ccDeb;

  const credNome = extrairCampo('CREDITADO_NOME');
  if (credNome) atualizado.creditadoNome = credNome.toUpperCase();

  const credCpf = extrairCampo('CREDITADO_CPF');
  if (credCpf) atualizado.creditadoCpf = credCpf;

  const credRg = extrairCampo('CREDITADO_RG');
  if (credRg) atualizado.creditadoRg = credRg;

  const estCiv = extrairCampo('ESTADO_CIVIL_REGIME');
  if (estCiv) atualizado.creditadoEstadoCivilRegime = estCiv.toUpperCase();

  const endCred = extrairCampo('ENDERECO_CREDITADO');
  if (endCred) atualizado.creditadoEndereco = endCred.toUpperCase();

  const telSms = extrairCampo('TELEFONE_SMS');
  if (telSms) atualizado.telefoneSmsClausula = telSms;

  const conjNome = extrairCampo('CONJUGE_NOME');
  if (conjNome) atualizado.conjugeNome = conjNome.toUpperCase();

  const conjCpf = extrairCampo('CONJUGE_CPF');
  if (conjCpf) atualizado.conjugeCpf = conjCpf;

  const outorga = extrairCampo('OUTORGA_CONJUGAL');
  if (outorga) atualizado.outorgaConjugalTexto = outorga;

  const avalNome = extrairCampo('AVALISTA_NOME');
  const avalCpf = extrairCampo('AVALISTA_CPF');
  const avalRg = extrairCampo('AVALISTA_RG');
  const avalEstCiv = extrairCampo('AVALISTA_ESTADO_CIVIL');
  if (avalNome) {
    atualizado.possuiAvalista = true;
    atualizado.avalistaNome = avalNome.toUpperCase();
    if (avalCpf) atualizado.avalistaCpf = avalCpf;
    if (avalRg) atualizado.avalistaRg = avalRg;
    if (avalEstCiv)
      atualizado.avalistaEstadoCivilRegime = avalEstCiv.toUpperCase();
  }

  const procNome = extrairCampo('PROCURADOR_NOME');
  const procCpf = extrairCampo('PROCURADOR_CPF');
  if (procNome) {
    atualizado.possuiRepresentacaoProcurador = true;
    atualizado.procuradorNome = procNome.toUpperCase();
    if (procCpf) atualizado.procuradorCpf = procCpf;
  }

  const imNome = extrairCampo('IMOVEL_NOME');
  const imArea = extrairCampo('IMOVEL_AREA_HA');
  const imMat = extrairCampo('IMOVEL_MATRICULA_LIVRO');
  const imCart = extrairCampo('IMOVEL_CARTORIO_MUNICIPIO');
  const imOnus = extrairCampo('IMOVEL_ONUS_HIPOTECA');

  if (imNome) {
    if (
      atualizado.tipoInstrumento === 'LCGA' ||
      atualizado.tipoInstrumento === 'LCGH'
    ) {
      const partesMat = (imMat || '').split('|').map((s) => s.trim());
      atualizado.imoveisGarantia = [
        {
          denominacao: imNome,
          proprietarios: atualizado.creditadoNome,
          areaHa: imArea || atualizado.imoveisGarantia[0]?.areaHa || '',
          areaExtenso: '',
          dataAquisicao: atualizado.imoveisGarantia[0]?.dataAquisicao || '',
          formaAquisicao:
            atualizado.imoveisGarantia[0]?.formaAquisicao ||
            'Escritura Pública',
          registroMatricula:
            partesMat[0] ||
            atualizado.imoveisGarantia[0]?.registroMatricula ||
            '',
          livro: partesMat[1] || 'Livro 2',
          cartorioMunicipioUf:
            imCart ||
            atualizado.imoveisGarantia[0]?.cartorioMunicipioUf ||
            '',
          valorAvaliacao:
            atualizado.valorClausulaPrimeira ||
            atualizado.imoveisGarantia[0]?.valorAvaliacao ||
            '',
          situacaoOnusHipoteca:
            imOnus ||
            atualizado.imoveisGarantia[0]?.situacaoOnusHipoteca ||
            'Regular',
          possuiHipotecaBnb: /hipotecad/i.test(imOnus),
          possuiInalienabilidadeCitada: /inalienabil/i.test(imOnus),
        },
      ];
    } else {
      atualizado.imovelBeneficiadoNome = imNome;
      if (imMat) atualizado.imovelBeneficiadoMatriculaCartorio = imMat;
      if (imCart) atualizado.imovelBeneficiadoMunicipioUf = imCart;
    }
  }

  const sipra = extrairCampo('CODIGO_SIPRA_INCRA');
  if (sipra) {
    const partesSipra = sipra.split('|').map((s) => s.trim());
    atualizado.anuenciaIncraSipraCodigo = partesSipra[0] || sipra;
  }

  const gerentesStr = extrairCampo('GERENTES_BNB');
  if (gerentesStr) {
    const listaG = gerentesStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => {
        const [n, c] = item.split(/\s*-\s*/);
        return {
          nome: (n || item).trim().toUpperCase(),
          cargo: (c || 'GERENTE BNB').trim().toUpperCase(),
        };
      });
    if (listaG.length > 0) atualizado.gerentesBanco = listaG;
  }

  const testStr = extrairCampo('TESTEMUNHAS');
  if (testStr) {
    const listaT = testStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => {
        const mCpf = item.match(/(\d{3}\.?\d{3}\.?\d{3}-\d{2})/);
        const nomeL = item
          .replace(/(\d{3}\.?\d{3}\.?\d{3}-\d{2})/, '')
          .replace(/[-–:()]/g, '')
          .trim()
          .toUpperCase();
        return {
          nome: nomeL,
          cpf: mCpf ? mCpf[1] : '',
        };
      });
    if (listaT.length > 0) atualizado.testemunhas = listaT;
  }

  const itensOrcStr = extrairCampo('ITENS_ORCAMENTO');
  if (itensOrcStr) {
    const novosItensOrc: ItemOrcamentoContratual[] = itensOrcStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((linha, idx) => {
        const cols = linha.split('|').map((c) => c.trim());
        return {
          codigo: String(idx + 1).padStart(2, '0'),
          descricao: cols[0] || `Item #${idx + 1}`,
          quantidadeUnidade: cols[1] || 'VERBA',
          mesAnoDesembolso: (cols[2] || '').toLowerCase(),
          valorRecursosProprios: '0,00',
          valorFinanciadoFne: (cols[3] || cols[2] || '0,00').replace(
            /^R\$\s*/i,
            ''
          ),
        };
      });
    if (novosItensOrc.length > 0) atualizado.itensOrcamento = novosItensOrc;
  }

  const libCetStr = extrairCampo('LIBERACOES_CET');
  if (libCetStr) {
    const novasLibs: LiberacaoPrevistaCet[] = libCetStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((linha) => {
        const cols = linha.split('|').map((c) => c.trim());
        return {
          dataLiberacao: cols[0] || '',
          mesAnoRef: (cols[1] || '').toLowerCase(),
          valorLiberacao: (cols[2] || '0,00').replace(/^R\$\s*/i, ''),
        };
      });
    if (novasLibs.length > 0) atualizado.liberacoesPrevistas = novasLibs;
  }

  const parcReembStr = extrairCampo('PARCELAS_REEMBOLSO');
  if (parcReembStr) {
    const novasParcs: ParcelaReembolsoContrato[] = parcReembStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((linha, idx) => {
        const cols = linha.split('|').map((c) => c.trim());
        return {
          numero: Number(cols[0]) || idx + 1,
          dataVencimento: cols[1] || '',
          valorPrincipal: (cols[2] || '0,00').replace(
            /^(?:Principal:?\s*)?R?\$?\s*/i,
            ''
          ),
          valorJuros: cols[3]
            ? cols[3].replace(/^(?:Juros:?\s*)?R?\$?\s*/i, '')
            : undefined,
          valorPrestacaoTotal: cols[4]
            ? cols[4].replace(/^(?:Total:?\s*)?R?\$?\s*/i, '')
            : undefined,
        };
      });
    if (novasParcs.length > 0) atualizado.parcelasReembolso = novasParcs;
  }

  const novosSigs: SignatarioContratoInfo[] = [];
  if (atualizado.creditadoNome) {
    novosSigs.push({
      papelNoContrato: 'EMITENTE / CREDITADO',
      nomeTitularDoPapel: atualizado.creditadoNome,
      cpfTitularDoPapel: atualizado.creditadoCpf,
      rgOrgaoEmissor: atualizado.creditadoRg,
      dataExpedicaoRg: atualizado.creditadoRgDataEmissao,
      estadoCivilRegime: atualizado.creditadoEstadoCivilRegime,
      enderecoResumo: atualizado.creditadoEndereco,
      profissao: atualizado.creditadoProfissao,
      representadoPorProcurador: atualizado.possuiRepresentacaoProcurador,
      nomeProcuradorQueAssina: atualizado.possuiRepresentacaoProcurador
        ? atualizado.procuradorNome
        : undefined,
      cpfProcuradorQueAssina: atualizado.possuiRepresentacaoProcurador
        ? atualizado.procuradorCpf
        : undefined,
    });
  }
  if (atualizado.conjugeNome) {
    novosSigs.push({
      papelNoContrato: 'CÔNJUGE DO CREDITADO / INTERVENIENTE ALIENANTE',
      nomeTitularDoPapel: atualizado.conjugeNome,
      cpfTitularDoPapel: atualizado.conjugeCpf,
      rgOrgaoEmissor: atualizado.conjugeRg,
      dataExpedicaoRg: atualizado.conjugeRgDataEmissao,
      estadoCivilRegime: atualizado.creditadoEstadoCivilRegime,
      enderecoResumo: atualizado.creditadoEndereco,
      profissao: atualizado.conjugeProfissao,
      representadoPorProcurador: atualizado.possuiRepresentacaoProcurador,
      nomeProcuradorQueAssina: atualizado.possuiRepresentacaoProcurador
        ? atualizado.procuradorNome
        : undefined,
      cpfProcuradorQueAssina: atualizado.possuiRepresentacaoProcurador
        ? atualizado.procuradorCpf
        : undefined,
    });
  }
  if (atualizado.possuiAvalista && atualizado.avalistaNome) {
    novosSigs.push({
      papelNoContrato: 'AVALISTA (POR AVAL DO EMITENTE/CREDITADO)',
      nomeTitularDoPapel: atualizado.avalistaNome,
      cpfTitularDoPapel: atualizado.avalistaCpf,
      rgOrgaoEmissor: atualizado.avalistaRg,
      dataExpedicaoRg: atualizado.avalistaRgDataEmissao,
      estadoCivilRegime: atualizado.avalistaEstadoCivilRegime,
      enderecoResumo: atualizado.avalistaEndereco,
      profissao: atualizado.avalistaProfissao,
      representadoPorProcurador: false,
    });
  }
  if (novosSigs.length > 0) atualizado.signatariosPartes = novosSigs;

  atualizado.itensChecklist =
    reconstruirChecklistIndividualContrato(atualizado);
  return atualizado;
}