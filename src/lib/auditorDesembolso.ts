// src/lib/auditorDesembolso.ts
import { parseMoeda, formatarMoedaBD } from '@/lib/utils';
import {
  removerAcentos,
  normalizarSemAcento,
} from '@/lib/auditorInteligentePdfPasta';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
} from '@/types/painel';

export type TipoDocumentoDesembolso =
  | 'ANEXO_ORCAMENTO'
  | 'COMPROVACAO_FINANCEIRA'
  | 'LAUDO_ACOMPANHAMENTO'
  | 'GTA'
  | 'NOTA_FISCAL'
  | 'NOTA_FISCAL_E_RECIBO'
  | 'RECIBO_PAGAMENTO'
  | 'DECLARACAO_RECEBIMENTO'
  | 'COMPROVANTE_PAGAMENTO'
  | 'VITI'
  | 'OUTRO_DESEMBOLSO';

export type StatusItemAuditoriaDesembolso = 'OK' | 'ALERTA' | 'ERRO' | 'INFO';

export interface ControleCancelamentoOcrDesembolso {
  cancelado: boolean;
  modo: 'USAR_TEXTO_PARCIAL' | 'ABORTAR_TUDO';
  terminarWorkerAtivo?: () => Promise<void> | void;
}

export function criarControleCancelamentoOcrDesembolso(): ControleCancelamentoOcrDesembolso {
  return {
    cancelado: false,
    modo: 'USAR_TEXTO_PARCIAL',
  };
}

export interface LancamentoOrcamentoDesembolso {
  codigo: string;
  descricao: string;
  categoriaItem:
    | 'MATRIZ'
    | 'REPRODUTOR'
    | 'PASTAGEM'
    | 'CERCA_REFORMA'
    | 'ASSESSORIA'
    | 'OUTRO';
  quantidadeUnidade: string;
  mesAno: string; // ex: "out/2026"
  chaveAnoMes: string; // ex: "2026-10"
  valorRecursosProprios: number;
  valorFinanciadoFne: number;
}

export interface ItemComprovacaoFinanceira {
  descricao: string;
  categoriaItem:
    | 'MATRIZ'
    | 'REPRODUTOR'
    | 'PASTAGEM'
    | 'CERCA_REFORMA'
    | 'ASSESSORIA'
    | 'OUTRO';
  quantidade: string;
  valorProjetado: number;
  valorAplicado: number;
  valorComprovado: number;
}

export interface ItemNotaFiscalDesembolso {
  descricao: string;
  categoriaItem:
    | 'MATRIZ'
    | 'REPRODUTOR'
    | 'PASTAGEM'
    | 'CERCA_REFORMA'
    | 'ASSESSORIA'
    | 'OUTRO';
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  faixaEtariaDetectada?: string;
}

export interface DadosNotaFiscalExtraidos {
  numero: string;
  serie: string;
  chaveAcesso: string;
  tipoOperacaoSaida: 'SAIDA' | 'ENTRADA' | 'NAO_IDENTIFICADO';
  naturezaOperacao: string;
  ehEntregaFutura: boolean;
  dataEmissao: string;
  emitenteNome: string;
  emitenteCpfCnpj: string;
  destinatarioNome: string;
  destinatarioCpf: string;
  valorTotal: number;
  numeroGtaCitada: string;
  possuiCarimboPago: boolean;
  itens: ItemNotaFiscalDesembolso[];
}

export interface DadosGtaExtraidos {
  numero: string;
  serie: string;
  dataEmissao: string;
  dataValidade: string;
  origemEstabelecimento: string;
  origemNome: string;
  origemCpfCnpj: string;
  destinoEstabelecimento: string;
  destinoNome: string;
  destinoCpf: string;
  destinoMunicipio: string;
  finalidade: string;
  qtd0a12M: number;
  qtd0a12F: number;
  qtd13a24M: number;
  qtd13a24F: number;
  qtd25a36M: number;
  qtd25a36F: number;
  qtdAcima36M: number;
  qtdAcima36F: number;
  totalAnimais: number;
  possuiExamesNegativosCitados: boolean;
}

export interface DadosReciboExtraidos {
  valorTotal: number;
  dataRecibo: string;
  clienteNome: string;
  clienteCpf: string;
  fornecedorNome: string;
  fornecedorCpfCnpj: string;
  numeroNfCitada: string;
  serieNfCitada: string;
  qtdMatrizes: number;
  qtdReprodutores: number;
  ehReciboAssessoria?: boolean;
  resumoObjeto: string;
}

export interface DadosDeclaracaoRecebimentoExtraidos {
  valorTotal: number;
  dataDeclaracao: string;
  clienteNome: string;
  clienteCpf: string;
  fornecedorNome: string;
  fornecedorCpfCnpj: string;
  numeroNfCitada: string;
  serieNfCitada: string;
  numeroCcbCitada: string;
  dataCcbCitada: string;
  qtdMatrizes: number;
  qtdReprodutores: number;
}

export interface DadosLaudoAcompanhamentoExtraidos {
  dataVisita: string;
  dataRelatorio: string;
  localidade: string;
  municipio: string;
  clienteNome: string;
  clienteCpf: string;
  dataOperacaoEmSer: string;
  tecnicoNome: string;
  tecnicoCrea: string;
  tecnicoCpf: string;
  aplicacaoNormal: boolean;
  garantiasNormal: boolean;
  fatoresAdversosNao: boolean;
  situacaoAdmNormal: boolean;
  mencionaUnidadeFamiliarMaoDeObra: boolean;
}

export interface DadosVitiExtraidos {
  arquivoValidadoNome: string;
  signatariosValidados: string[];
  aprovado: boolean;
}

export interface DocumentoDesembolsoAuditado {
  nomeArquivo: string;
  numPaginas: number;
  foiLidoPorOcr: boolean;
  tipo: TipoDocumentoDesembolso;
  tituloTipo: string;
  possuiAssinaturaDigital: boolean;
  signatariosDigitais: string[];
  vitiCorrespondente?: string;
  numeroCcb?: string;
  dataContratacaoCcb?: string;
  clienteNome?: string;
  clienteCpf?: string;
  lancamentosOrcamento?: LancamentoOrcamentoDesembolso[];
  totalOrcamentoFne?: number;
  itensComprovacao?: ItemComprovacaoFinanceira[];
  totalComprovacaoFinanceira?: number;
  tecnicoComprovacaoNome?: string;
  tecnicoComprovacaoCrea?: string;
  dataComprovacao?: string;
  dadosLaudo?: DadosLaudoAcompanhamentoExtraidos;
  dadosGta?: DadosGtaExtraidos;
  dadosNf?: DadosNotaFiscalExtraidos;
  dadosRecibo?: DadosReciboExtraidos;
  dadosDeclaracao?: DadosDeclaracaoRecebimentoExtraidos;
  dadosViti?: DadosVitiExtraidos;
  textoExtraido: string;
}

export interface ItemChecklistAuditoriaDesembolso {
  id: string;
  titulo: string;
  status: StatusItemAuditoriaDesembolso;
  resumo: string;
  detalhes: string[];
}

export interface ResumoCronogramaParcelaOrcamento {
  mesAno: string;
  chaveAnoMes: string;
  liberavelAgora: boolean;
  valorTotalMes: number;
  itens: LancamentoOrcamentoDesembolso[];
}

export interface ResultadoAuditoriaPacoteDesembolso {
  mesReferencia: string; // "YYYY-MM"
  modalidade: 'PRONAF_A' | 'DERIVADA_GERAL' | 'RENOVACAO_CUSTEIO';
  clienteNome: string;
  clienteCpf: string;
  numeroCcb: string;
  dataContratacao: string;
  imovelEstabelecimento: string;
  valorTotalOrcamento: number;
  valorLiberavelAteMesRef: number;
  valorBloqueadoFuturo: number;
  valorTotalComprovacaoFinanceira: number;
  valorTotalNotasFiscais: number;
  valorTotalRecibos: number;
  cronogramaPorMes: ResumoCronogramaParcelaOrcamento[];
  documentos: DocumentoDesembolsoAuditado[];
  checklist: ItemChecklistAuditoriaDesembolso[];
  textoResumoS567: string;
  operacaoPainelVinculada?: {
    op: string;
    valor: string;
    porte: string;
    projetista: string;
  };
}

const MAPA_MES_NUM: Record<string, string> = {
  JAN: '01',
  FEV: '02',
  MAR: '03',
  ABR: '04',
  MAI: '05',
  JUN: '06',
  JUL: '07',
  AGO: '08',
  SET: '09',
  OUT: '10',
  NOV: '11',
  DEZ: '12',
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

function converterDataExtensoOuCurtaBR(texto: string): string {
  const limpo = (texto || '').trim();
  const mCurta = limpo.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/);
  if (mCurta) return mCurta[1];
  const norm = removerAcentos(limpo).toUpperCase();
  const mExt = norm.match(
    /\b(\d{1,2})\s+DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+(20\d{2})\b/i
  );
  if (!mExt) return '';
  const dd = String(Number(mExt[1])).padStart(2, '0');
  const mm = MAPA_MES_NUM[mExt[2].toUpperCase()] || '01';
  return `${dd}/${mm}/${mExt[3]}`;
}

function parseDataBR(dataBr: string): Date | null {
  const m = (dataBr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
}

function mesAnoParaChaveIso(mesAno: string): string {
  const m = removerAcentos(mesAno)
    .toUpperCase()
    .match(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(20\d{2})/);
  if (!m) return '9999-99';
  return `${m[2]}-${MAPA_MES_NUM[m[1]] || '01'}`;
}

function normalizarMoedaStr(s: string): string {
  const limpo = (s || '').trim().replace(/^[−–—-]\s*/, '');
  const m = limpo.match(/^(\d[\d.,]*)[.,](\d{2})$/);
  if (!m) return limpo;
  const intDig = m[1].replace(/[.,]/g, '');
  const intFmt = intDig.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFmt},${m[2]}`;
}

function normalizarNumeroCcbDigitos(num: string): string {
  return (num || '').replace(/\D/g, '');
}

function normalizarCpfCnpj(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

function formatarCpf(digitos: string): string {
  const d = digitos.replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
      8,
      12
    )}-${d.slice(12)}`;
  }
  return digitos;
}

function classificarCategoriaItem(
  desc: string
):
  | 'MATRIZ'
  | 'REPRODUTOR'
  | 'PASTAGEM'
  | 'CERCA_REFORMA'
  | 'ASSESSORIA'
  | 'OUTRO' {
  const u = removerAcentos(desc).toUpperCase();
  if (
    u.includes('ASSESSORIA') ||
    u.includes('ASSISTENCIA TECNICA') ||
    u.includes('ELABORACAO DE PROJETO') ||
    u.includes('TAXA DE ELABORACAO')
  ) {
    return 'ASSESSORIA';
  }
  if (
    u.includes('MATRIZ') ||
    (u.includes('BOVINO') && u.includes('FEMEA')) ||
    u.includes('VACA') ||
    u.includes('NOVILHA')
  ) {
    return 'MATRIZ';
  }
  if (
    u.includes('REPRODUTOR') ||
    (u.includes('BOVINO') && u.includes('MACHO')) ||
    u.includes('TOURO')
  ) {
    return 'REPRODUTOR';
  }
  if (
    u.includes('PASTAGEM') ||
    u.includes('CAPIM') ||
    u.includes('BRACHIARIA') ||
    u.includes('SEMENTE') ||
    u.includes('CAPINEIRA')
  ) {
    return 'PASTAGEM';
  }
  if (
    u.includes('CERCA') ||
    u.includes('ARAME') ||
    u.includes('ESTACA') ||
    u.includes('CURRAL') ||
    u.includes('REFORMA') ||
    u.includes('CONSTRUCAO') ||
    u.includes('INSTALACAO') ||
    u.includes('COCHO') ||
    u.includes('BEBEDOURO')
  ) {
    return 'CERCA_REFORMA';
  }
  return 'OUTRO';
}

function normalizarNumeroNf(num: string): string {
  const dig = (num || '').replace(/\D/g, '');
  if (!dig) return '';
  return String(parseInt(dig, 10));
}

function nomesSaoSemelhantes(a: string, b: string): boolean {
  const na = normalizarSemAcento(a);
  const nb = normalizarSemAcento(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const pa = na.split(/\s+/).filter((p) => p.length > 2);
  const pb = nb.split(/\s+/).filter((p) => p.length > 2);
  if (pa.length === 0 || pb.length === 0) return false;
  let acertos = 0;
  for (const w of pa) {
    if (pb.some((x) => x === w || x.startsWith(w.slice(0, 4)))) acertos++;
  }
  return acertos >= Math.ceil(Math.min(pa.length, pb.length) * 0.65);
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

function detectarAssinaturaNoBinario(buffer: ArrayBuffer): boolean {
  try {
    const raw = new TextDecoder('latin1').decode(buffer);
    const temByteRange = /\/ByteRange\s*\[/i.test(raw);
    const temSig =
      /\/SubFilter\s*\/(adbe\.pkcs7|ETSI\.CAdES|ETSI\.RFC3161)/i.test(raw) ||
      raw.includes('ICP-Brasil') ||
      raw.includes('gov.br') ||
      raw.includes('/Type /Sig') ||
      raw.includes('/Type/Sig');
    return temByteRange && temSig;
  } catch {
    return false;
  }
}

function montarTextoOrdenadoTokens(
  tokens: Array<{ str: string; vx: number; vy: number }>
): string {
  if (tokens.length === 0) return '';
  const copia = [...tokens].sort((a, b) => a.vy - b.vy || a.vx - b.vx);
  const linhas: Array<{ vyMedio: number; itens: typeof tokens }> = [];
  for (const tok of copia) {
    const l = linhas.find((x) => Math.abs(x.vyMedio - tok.vy) <= 3.8);
    if (l) l.itens.push(tok);
    else linhas.push({ vyMedio: tok.vy, itens: [tok] });
  }
  linhas.sort((a, b) => a.vyMedio - b.vyMedio);
  return linhas
    .map((l) => {
      l.itens.sort((a, b) => a.vx - b.vx);
      return l.itens.map((i) => i.str).join(' ');
    })
    .join('\n');
}

async function executarOcrDesembolsoPdf(
  file: File,
  onProgresso?: (msg: string) => void,
  controle?: ControleCancelamentoOcrDesembolso,
  paginasEspecificas?: number[]
): Promise<{
  textoOcr: string;
  textosPorPagina: Record<number, string>;
  foiCancelado: boolean;
}> {
  const textosPorPagina: Record<number, string> = {};
  try {
    const [pdfjsLib, Tesseract] = await Promise.all([
      obterPdfJsLib(),
      obterTesseractJs(),
    ]);
    if (!pdfjsLib || !Tesseract) {
      return { textoOcr: '', textosPorPagina, foiCancelado: false };
    }
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const total = Math.min(pdf.numPages || 1, 15);
    const lista =
      paginasEspecificas && paginasEspecificas.length > 0
        ? paginasEspecificas.filter((p) => p >= 1 && p <= total)
        : Array.from({ length: total }, (_, i) => i + 1);

    const worker = await Tesseract.createWorker('por');
    if (controle) {
      controle.terminarWorkerAtivo = async () => {
        try {
          await worker.terminate();
        } catch {
          // ignora
        }
      };
    }

    const blocos: string[] = [];
    try {
      for (const p of lista) {
        if (controle?.cancelado) {
          return {
            textoOcr: blocos.join('\n\n'),
            textosPorPagina,
            foiCancelado: true,
          };
        }
        onProgresso?.(
          `📸 OCR página ${p}/${total} de "${file.name}"...`
        );
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 2.2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        if (controle?.cancelado) {
          canvas.width = 0;
          canvas.height = 0;
          return {
            textoOcr: blocos.join('\n\n'),
            textosPorPagina,
            foiCancelado: true,
          };
        }

        const {
          data: { text },
        } = await worker.recognize(canvas);
        if (text && text.trim()) {
          const bloco = `[PÁGINA ${p} DE ${total}]\n${text.trim()}`;
          blocos.push(bloco);
          textosPorPagina[p] = bloco;
        }
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      try {
        await worker.terminate();
      } catch {
        // ignora
      }
    }
    return {
      textoOcr: blocos.join('\n\n'),
      textosPorPagina,
      foiCancelado: Boolean(controle?.cancelado),
    };
  } catch {
    return {
      textoOcr: '',
      textosPorPagina,
      foiCancelado: Boolean(controle?.cancelado),
    };
  }
}

async function extrairTextoHibridoDesembolsoPdf(
  file: File,
  forcarOcr = false,
  onProgresso?: (msg: string) => void,
  controle?: ControleCancelamentoOcrDesembolso
): Promise<{
  texto: string;
  numPaginas: number;
  usouOcr: boolean;
  assinaturaBinaria: boolean;
}> {
  const buffer = await file.arrayBuffer();
  const assinaturaBinaria = detectarAssinaturaNoBinario(buffer);

  if (forcarOcr) {
    const rOcr = await executarOcrDesembolsoPdf(file, onProgresso, controle);
    return {
      texto: rOcr.textoOcr,
      numPaginas: Math.max(1, Object.keys(rOcr.textosPorPagina).length),
      usouOcr: true,
      assinaturaBinaria,
    };
  }

  let texto = '';
  let numPaginas = 1;
  let usouOcr = false;

  try {
    const pdfjsLib = await obterPdfJsLib();
    if (pdfjsLib) {
      const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
      numPaginas = pdf.numPages || 1;
      const pagsTxt: string[] = [];

      for (let p = 1; p <= numPaginas; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1.0 });
        const largVis = vp.width || 595;
        const altVis = vp.height || 842;
        const content = await page.getTextContent();
        const rawItems = (content.items || []) as Array<any>;
        const tokens: Array<{ str: string; vx: number; vy: number }> = [];

        for (const it of rawItems) {
          const s = (it.str || '').trim();
          if (!s) continue;
          const tr = Array.isArray(it.transform)
            ? it.transform
            : [1, 0, 0, 1, 0, 0];
          const [vx, vy] = vp.convertToViewportPoint(
            Number(tr[4]) || 0,
            Number(tr[5]) || 0
          );
          if (
            vx < -20 ||
            vx > largVis + 20 ||
            vy < -20 ||
            vy > altVis + 20
          ) {
            continue;
          }
          tokens.push({ str: s, vx, vy });
        }

        const txtPag = montarTextoOrdenadoTokens(tokens);
        const normUp = removerAcentos(txtPag).toUpperCase();

        // Se for GTA (layout 2 colunas: I-ORIGEM à esquerda e II-DESTINO à direita), separa os dois blocos por X!
        let blocoColunasGta = '';
        if (
          normUp.includes('GUIA DE TRANSITO ANIMAL') &&
          normUp.includes('ORIGEM') &&
          normUp.includes('DESTINO')
        ) {
          const tokOrigem = tokens.find((t) =>
            /I\s*[-–]\s*ORIGEM/i.test(removerAcentos(t.str))
          );
          const tokDestino = tokens.find((t) =>
            /II\s*[-–]\s*DESTINO/i.test(removerAcentos(t.str))
          );
          const tokLimiteInfGta =
            tokens.find((t) =>
              /0-12\s*M|VACINACOES/i.test(removerAcentos(t.str))
            ) ||
            tokens.find((t) =>
              /III\s*[-–]\s*ANIMAIS/i.test(removerAcentos(t.str))
            );

          if (tokOrigem && tokDestino) {
            const xCorte = Math.max(largVis * 0.42, tokDestino.vx - 12);
            const yTopo = Math.min(tokOrigem.vy, tokDestino.vy) - 5;
            const yBase = tokLimiteInfGta
              ? tokLimiteInfGta.vy - 4
              : altVis * 0.62;

            const toksOrigem = tokens.filter(
              (t) => t.vy >= yTopo && t.vy <= yBase && t.vx < xCorte
            );
            const toksDestino = tokens.filter(
              (t) => t.vy >= yTopo && t.vy <= yBase && t.vx >= xCorte
            );

            blocoColunasGta =
              `\n[GTA_BLOCO_ORIGEM]\n${montarTextoOrdenadoTokens(toksOrigem)}\n` +
              `[GTA_BLOCO_DESTINO]\n${montarTextoOrdenadoTokens(toksDestino)}\n` +
              `[GTA_BLOCO_FIM]`;
          }
        }

        // Extração Geométrica 2D quando for página de Anexo-Orçamento (em coordenadas visuais vx/vy)
        let blocoGeoOrc = '';
        if (
          normUp.includes('ANEXO-ORCAMENTO') ||
          normUp.includes('RECURSOS FINANCIADOS') ||
          normUp.includes('DESCRICAO DOS ITENS DO EMPREENDIMENTO')
        ) {
          const regexMes =
            /^(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/20\d{2}$/i;
          const regexVal = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
          const expandidos: Array<{ str: string; vx: number; vy: number }> = [];

          for (const tk of tokens) {
            const mCol = tk.str.match(
              /^((?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/20\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/i
            );
            if (mCol) {
              expandidos.push({ str: mCol[1], vx: tk.vx, vy: tk.vy });
              expandidos.push({ str: mCol[2], vx: tk.vx + 55, vy: tk.vy });
            } else {
              expandidos.push(tk);
            }
          }

          const tokTotal = expandidos.find(
            (t) => t.str.toUpperCase() === 'TOTAL'
          );
          const vyTot = tokTotal ? tokTotal.vy : 99999;

          const mesesToks = expandidos
            .filter(
              (t) =>
                t.vx >= largVis * 0.35 &&
                t.vy < vyTot - 4 &&
                regexMes.test(t.str)
            )
            .sort((a, b) => a.vy - b.vy || a.vx - b.vx);

          const valsToks = expandidos.filter(
            (t) =>
              t.vx >= largVis * 0.42 &&
              t.vy < vyTot - 4 &&
              regexVal.test(t.str) &&
              Math.abs(t.vy - vyTot) > 6
          );

          const usados = new Set<any>();
          const rows: string[] = [];
          for (const tm of mesesToks) {
            const mesmaLinha = valsToks
              .filter((tv) => !usados.has(tv) && Math.abs(tv.vy - tm.vy) <= 9.5)
              .sort((a, b) => a.vx - b.vx);
            if (mesmaLinha.length >= 2) {
              const prop = mesmaLinha[0];
              const fne = mesmaLinha[mesmaLinha.length - 1];
              usados.add(prop);
              usados.add(fne);
              rows.push(
                `[ORC_DESEMB_GEO: y=${Math.round(
                  tm.vy
                )} | mes=${tm.str.toLowerCase()} | prop=${prop.str} | fne=${
                  fne.str
                }]`
              );
            } else if (mesmaLinha.length === 1) {
              usados.add(mesmaLinha[0]);
              rows.push(
                `[ORC_DESEMB_GEO: y=${Math.round(
                  tm.vy
                )} | mes=${tm.str.toLowerCase()} | prop=0,00 | fne=${
                  mesmaLinha[0].str
                }]`
              );
            }
          }
          if (rows.length > 0) blocoGeoOrc = `\n${rows.join('\n')}`;
        }

        pagsTxt.push(
          `[PÁGINA ${p} DE ${numPaginas}]\n${txtPag}${blocoColunasGta}${blocoGeoOrc}`
        );
      }

      // Plano B automático por página: se alguma página for imagem sem texto, roda OCR só nela!
      const pagsSemTexto: number[] = [];
      pagsTxt.forEach((t, idx) => {
        const limpo = t
          .replace(/\[PÁGINA \d+ DE \d+\]/g, '')
          .replace(/\s+/g, '');
        if (limpo.length < 40) pagsSemTexto.push(idx + 1);
      });

      if (pagsSemTexto.length > 0 && !controle?.cancelado) {
        onProgresso?.(
          `📸 PDF escaneado/híbrido ("${file.name}"). Ativando OCR nas págs. ${pagsSemTexto.join(
            ', '
          )}...`
        );
        const rOcr = await executarOcrDesembolsoPdf(
          file,
          onProgresso,
          controle,
          pagsSemTexto
        );
        for (const pImg of pagsSemTexto) {
          if (rOcr.textosPorPagina[pImg]) {
            pagsTxt[pImg - 1] = rOcr.textosPorPagina[pImg];
            usouOcr = true;
          }
        }
      }

      texto = pagsTxt.join('\n\n');
    }
  } catch (e) {
    console.error('Erro ao extrair PDF de desembolso:', e);
  }

  return { texto, numPaginas, usouOcr, assinaturaBinaria };
}

export function classificarDocumentoDesembolso(
  textoBruto: string,
  nomeArquivo: string
): { tipo: TipoDocumentoDesembolso; titulo: string } {
  const tUp = removerAcentos(textoBruto).toUpperCase().replace(/\s+/g, ' ');
  const nUp = removerAcentos(nomeArquivo).toUpperCase();

  // 1. Relatório VITI (Validador ITI)
  const ehRelatorioIti =
    (tUp.includes('VALIDADOR DE DOCUMENTOS DIGITAIS') &&
      (tUp.includes('RELATORIO DE CONFORMIDADE') ||
        tUp.includes('ARQUIVO(S) COM ASSINATURA(S)'))) ||
    /\bVITI\b/.test(nUp);
  if (ehRelatorioIti) {
    return {
      tipo: 'VITI',
      titulo: 'RELATÓRIO DE VALIDAÇÃO ITI (VITI)',
    };
  }

  // 2. Anexo-Orçamento do Contrato
  if (
    tUp.includes('ANEXO-ORCAMENTO INTEGRANTE DA') ||
    tUp.includes('DESCRICAO DOS ITENS DO EMPREENDIMENTO') ||
    (tUp.includes('RECURSOS FINANCIADOS') && tUp.includes('FNE'))
  ) {
    return {
      tipo: 'ANEXO_ORCAMENTO',
      titulo: 'ANEXO-ORÇAMENTO DA CCB (CRONOGRAMA OFICIAL)',
    };
  }

  // 3. Comprovação Físico-Financeira
  if (
    tUp.includes('COMPROVACAO FISICO-FINANCEIRA') ||
    tUp.includes('DEMONSTRATIVO DE COMPROVACAO DE PLANO') ||
    (tUp.includes('PROJETADO') &&
      tUp.includes('APLICADO') &&
      tUp.includes('COMPROVADO/FINANCEIRO'))
  ) {
    return {
      tipo: 'COMPROVACAO_FINANCEIRA',
      titulo: 'COMPROVAÇÃO FÍSICO-FINANCEIRA',
    };
  }

  // 4. Laudo de Acompanhamento de Crédito
  if (
    tUp.includes('LAUDO DE ACOMPANHAMENTO DE CREDITO') ||
    tUp.includes('SITUACAO DO CREDITO/EMPREENDIMENTO') ||
    tUp.includes('CONCLUSAO DO TECNICO')
  ) {
    return {
      tipo: 'LAUDO_ACOMPANHAMENTO',
      titulo: 'LAUDO DE ACOMPANHAMENTO DE CRÉDITO',
    };
  }

  // 5. Guia de Trânsito Animal (GTA)
  if (
    tUp.includes('GUIA DE TRANSITO ANIMAL') &&
    (tUp.includes('ANIMAIS TRANSPORTADOS') ||
      tUp.includes('SIGAMA') ||
      tUp.includes('I-ORIGEM'))
  ) {
    return {
      tipo: 'GTA',
      titulo: 'GUIA DE TRÂNSITO ANIMAL (GTA)',
    };
  }

  // 6. Declaração de Recebimento dos Animais
  if (
    tUp.includes('DECLARACAO DE RECEBIMENTO DOS ANIMAIS') ||
    (tUp.includes('RECEBI NA PROPRIEDADE') && tUp.includes('CEDULA DE CREDITO'))
  ) {
    return {
      tipo: 'DECLARACAO_RECEBIMENTO',
      titulo: 'DECLARAÇÃO DE RECEBIMENTO DOS ANIMAIS',
    };
  }

  // 7. DANFE / Nota Fiscal Eletrônica (pode vir junto com Recibo na Pág. 2!)
  const temNf =
    tUp.includes('DANFE') ||
    tUp.includes('DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA') ||
    tUp.includes('CHAVE DE ACESSO');
  const temRecibo =
    tUp.includes('RECIBO DE PAGAMENTO') ||
    /\bRECIBO\b[\s\S]{0,160}?\bRECEBI\s+D[EAO]\b/.test(tUp);

  if (temNf && temRecibo) {
    return {
      tipo: 'NOTA_FISCAL_E_RECIBO',
      titulo: 'NOTA FISCAL ELETRÔNICA (DANFE) + RECIBO DE PAGAMENTO',
    };
  }
  if (temNf) {
    return {
      tipo: 'NOTA_FISCAL',
      titulo: 'NOTA FISCAL ELETRÔNICA (DANFE)',
    };
  }
  if (temRecibo) {
    return {
      tipo: 'RECIBO_PAGAMENTO',
      titulo: 'RECIBO DE PAGAMENTO',
    };
  }

  // 8. Comprovante bancário / PIX / TED
  if (
    tUp.includes('COMPROVANTE DE TRANSFERENCIA') ||
    tUp.includes('COMPROVANTE PIX') ||
    tUp.includes('COMPROVANTE DE PAGAMENTO')
  ) {
    return {
      tipo: 'COMPROVANTE_PAGAMENTO',
      titulo: 'COMPROVANTE BANCÁRIO DE PAGAMENTO',
    };
  }

  return {
    tipo: 'OUTRO_DESEMBOLSO',
    titulo: 'DOCUMENTO COMPLEMENTAR DE DESEMBOLSO',
  };
}

function extrairAssinaturasDigitaisNoTexto(texto: string): string[] {
  const achados: string[] = [];
  const regex =
    /Documento\s+assinado\s+digitalmente[\s\S]{0,40}?([A-ZÀ-Ú]{3,}(?:\s+[A-ZÀ-Ú]{2,}){1,5})\s+Data:\s*(\d{2}\/\d{2}\/20\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const nome = m[1].replace(/\s+/g, ' ').trim().toUpperCase();
    const dt = m[2].trim();
    const label = `${nome} (${dt})`;
    if (!achados.includes(label)) achados.push(label);
  }
  return achados;
}

function extrairOrcamentoDoPdf(textoBruto: string): {
  lancamentos: LancamentoOrcamentoDesembolso[];
  totalFne: number;
  numeroCcb: string;
  dataContratacao: string;
  clienteNome: string;
  clienteCpf: string;
} {
  const linear = textoBruto.replace(/\s+/g, ' ').trim();
  const mCab = linear.match(
    /N[°ºo]?\s*(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\s*,?\s*emitida\s+por\s+([A-ZÀ-Ú\s]{4,65}?)\s*,\s*em\s+(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/i
  );
  const mNumFallback = linear.match(/\b(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\b/);
  const numeroCcb = mCab?.[1] || mNumFallback?.[1] || '';
  const clienteNome = (mCab?.[2] || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const dataContratacao = converterDataExtensoOuCurtaBR(mCab?.[3] || '');
  const mCpf = linear.match(/CPF\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
  const clienteCpf = mCpf?.[1] || '';

  // Extrai cabeçalhos dos itens (01, 02, 03...) com Qtd/Unid
  const textoSemGeo = linear.replace(/\[ORC_DESEMB_GEO:[^\]]+\]/gi, ' ');
  const itensCab: Array<{
    codigo: string;
    descricao: string;
    qtdUnid: string;
    cat: LancamentoOrcamentoDesembolso['categoriaItem'];
    idx: number;
  }> = [];

  const regexItem =
    /\b(0[1-9])\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9\s.,/\-]{4,95}?)(?=\s+\d+,\d{2}\s+(?:HA|UA|UNID|UND)|\s+VERBA|\s+0[1-9]\s+|\s+TOTAL)/gi;
  let mI: RegExpExecArray | null;
  while ((mI = regexItem.exec(textoSemGeo)) !== null) {
    const cod = mI[1];
    const desc = mI[2].replace(/\s+/g, ' ').trim().toUpperCase();
    const depois = textoSemGeo.substring(mI.index, mI.index + 160);
    const mQtd = depois.match(/\b(\d+(?:,\d{2})?)\s*(HA|UA|UNID\.?|UND\.?)\b/i);
    itensCab.push({
      codigo: cod,
      descricao: desc,
      qtdUnid: mQtd ? `${mQtd[1]} ${mQtd[2].toUpperCase()}` : 'VERBA',
      cat: classificarCategoriaItem(desc),
      idx: mI.index,
    });
  }

  // Busca também menções diretas conhecidas se o layout de colunas embaralhou o código
  const buscarItemPorTextoProx = (trechoProx: string, idxFallback: number) => {
    const up = removerAcentos(trechoProx).toUpperCase();
    if (up.includes('MATRIZ')) {
      return (
        itensCab.find((x) => x.cat === 'MATRIZ') || {
          codigo: '03',
          descricao: 'AQ. DE MATRIZ BOVINA APTIDÃO CORTE',
          qtdUnid: 'UA',
          cat: 'MATRIZ' as const,
        }
      );
    }
    if (up.includes('REPRODUTOR')) {
      return (
        itensCab.find((x) => x.cat === 'REPRODUTOR') || {
          codigo: '02',
          descricao: 'AQ. DE REPRODUTOR BOVINO MESTIÇO ZEBUINO APTIDÃO CORTE',
          qtdUnid: '1,00 UA',
          cat: 'REPRODUTOR' as const,
        }
      );
    }
    if (
      up.includes('ASSESSORIA') ||
      up.includes('ASSISTENCIA TECNICA')
    ) {
      return (
        itensCab.find((x) => x.cat === 'ASSESSORIA') || {
          codigo: '04',
          descricao: 'CUSTO DE ASSESSORIA EMPRESARIAL E TÉCNICA',
          qtdUnid: 'VERBA',
          cat: 'ASSESSORIA' as const,
        }
      );
    }
    if (
      up.includes('CERCA') ||
      up.includes('CURRAL') ||
      (up.includes('REFORMA') && !up.includes('PASTAGEM'))
    ) {
      return (
        itensCab.find((x) => x.cat === 'CERCA_REFORMA') || {
          codigo: '01',
          descricao: 'CONSTRUÇÃO / REFORMA DE CERCA OU INSTALAÇÃO',
          qtdUnid: 'VERBA',
          cat: 'CERCA_REFORMA' as const,
        }
      );
    }
    if (up.includes('PASTAGEM') || up.includes('BRACHIARIA')) {
      return (
        itensCab.find((x) => x.cat === 'PASTAGEM') || {
          codigo: '01',
          descricao: 'FORMAÇÃO DE PASTAGEM CAPIM BRACHIARIA',
          qtdUnid: 'HA',
          cat: 'PASTAGEM' as const,
        }
      );
    }
    return (
      itensCab[Math.min(idxFallback, Math.max(0, itensCab.length - 1))] || {
        codigo: String(idxFallback + 1).padStart(2, '0'),
        descricao: `ITEM ORÇAMENTO #${idxFallback + 1}`,
        qtdUnid: 'VERBA',
        cat: 'OUTRO' as const,
      }
    );
  };

  const lancamentos: LancamentoOrcamentoDesembolso[] = [];
  const geoMatches = [
    ...linear.matchAll(
      /\[ORC_DESEMB_GEO:\s*y=(-?\d+)\s*\|\s*mes=([a-z]{3}\/20\d{2})\s*\|\s*prop=(\d{1,3}(?:\.\d{3})*,\d{2})\s*\|\s*fne=(\d{1,3}(?:\.\d{3})*,\d{2})\]/gi
    ),
  ];

  // Emparelha cada linha geométrica com a linha de texto visual mais próxima (ou ordem das ocorrências)
  const paresMesValNoTexto = [
    ...textoSemGeo.matchAll(
      /((?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/20\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/gi
    ),
  ];

  if (geoMatches.length > 0) {
    geoMatches.forEach((mG, idx) => {
      const mes = mG[2].toLowerCase();
      const prop = parseMoeda(mG[3]);
      const fne = parseMoeda(mG[4]);
      const matchTextoCorr = paresMesValNoTexto[idx];
      const contextoAntes =
        matchTextoCorr && matchTextoCorr.index !== undefined
          ? textoSemGeo.substring(
              Math.max(0, matchTextoCorr.index - 110),
              matchTextoCorr.index
            )
          : '';
      const infoItem = buscarItemPorTextoProx(contextoAntes, idx);
      lancamentos.push({
        codigo: infoItem.codigo,
        descricao: infoItem.descricao,
        categoriaItem: infoItem.cat,
        quantidadeUnidade: infoItem.qtdUnid,
        mesAno: mes,
        chaveAnoMes: mesAnoParaChaveIso(mes),
        valorRecursosProprios: prop,
        valorFinanciadoFne: fne,
      });
    });
  } else {
    paresMesValNoTexto.forEach((mP, idx) => {
      const mes = mP[1].toLowerCase();
      const fne = parseMoeda(mP[2]);
      const ctxAntes =
        mP.index !== undefined
          ? textoSemGeo.substring(Math.max(0, mP.index - 110), mP.index)
          : '';
      const infoItem = buscarItemPorTextoProx(ctxAntes, idx);
      lancamentos.push({
        codigo: infoItem.codigo,
        descricao: infoItem.descricao,
        categoriaItem: infoItem.cat,
        quantidadeUnidade: infoItem.qtdUnid,
        mesAno: mes,
        chaveAnoMes: mesAnoParaChaveIso(mes),
        valorRecursosProprios: 0,
        valorFinanciadoFne: fne,
      });
    });
  }

  const mTotal = textoSemGeo.match(
    /TOTAL\s*(?:\|\s*)*\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:\|\s*)*(\d{1,3}(?:\.\d{3})*,\d{2})/i
  );
  const somaLanc = lancamentos.reduce((acc, l) => acc + l.valorFinanciadoFne, 0);
  const totalFne = mTotal ? parseMoeda(mTotal[1]) : somaLanc;

  return {
    lancamentos,
    totalFne,
    numeroCcb,
    dataContratacao,
    clienteNome,
    clienteCpf,
  };
}

function extrairComprovacaoFinanceira(textoBruto: string): {
  clienteNome: string;
  clienteCpf: string;
  dataRelatorio: string;
  tecnicoNome: string;
  tecnicoCrea: string;
  itens: ItemComprovacaoFinanceira[];
  total: number;
} {
  const linear = textoBruto.replace(/\s+/g, ' ').trim();
  const mCli = linear.match(
    /([A-ZÀ-Ú]{3,}(?:\s+[A-ZÀ-Ú]{2,}){1,5})\s+CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}\s*[-–]?\s*\d{2})/i
  );
  const clienteNome = (mCli?.[1] || '').trim().toUpperCase();
  const clienteCpf = mCli?.[2] ? formatarCpf(mCli[2]) : '';

  const mData = linear.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/);
  const dataRelatorio = mData?.[1] || '';

  const mTec = linear.match(
    /COMPROVA[ÇC][ÃA]O\s+F[ÍI]SICO-FINANCEIRA\s+([A-ZÀ-Ú\s]{5,55}?)\s*[-–]\s*CONSULTOR/i
  );
  const mCrea = linear.match(/CREA\s*:?\s*([0-9A-Z\-/]{4,20})/i);

  // Limpa CPFs, CNPJs, datas, horas e "(VALORES EM R$ 1,00)" para nunca contaminar a soma
  const textoLimpoGeral = linear
    .replace(/\b\d{3}\.\d{3}\.\d{3}\s*[-–]\s*\d{2}\b/g, ' ')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}\s*[-–]\s*\d{2}\b/g, ' ')
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, ' ')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\(\s*VALORES\s+EM\s+R\$\s*1[.,]00\s*\)/gi, ' ')
    .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3');

  const extrairValoresReais = (trecho: string): number[] => {
    const achados: number[] = [];
    const regexMoeda =
      /(?:^|[^\d])(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d{3,7}[.,]\d{2})(?!\d)/g;
    let m: RegExpExecArray | null;
    while ((m = regexMoeda.exec(trecho)) !== null) {
      const n = parseMoeda(normalizarMoedaStr(m[1]));
      if (n >= 50) achados.push(n);
    }
    return achados;
  };

  // Corta apenas antes do rodapé textual ("Conforme discriminado")
  const idxFimTabela = textoLimpoGeral.search(
    /Conforme\s+discriminado|Documento\s+assinado\s+digitalmente/i
  );
  const corpoTabela =
    idxFimTabela > 60
      ? textoLimpoGeral.substring(0, idxFimTabela)
      : textoLimpoGeral;

  const idxCorteItens = corpoTabela.search(
    /Taxa\s+de\s+Elabora[çc][ãa]o|\bTOTAL\b/i
  );
  const fatiaItens =
    idxCorteItens > 40 ? corpoTabela.substring(0, idxCorteItens) : corpoTabela;

  const regexInicioRubrica =
    /\b(AQUISI[ÇC][ÃA]O\s+DE|AQ\.?\s+DE|FORMA[ÇC][ÃA]O\s+|REFORMA\s+|CONSTRU[ÇC][ÃA]O\s+|IMPLANTA[ÇC][ÃA]O\s+|COMPRA\s+DE|CUSTEIO\s+)/gi;
  const posicoesRubricas: number[] = [];
  let mRub: RegExpExecArray | null;
  while ((mRub = regexInicioRubrica.exec(fatiaItens)) !== null) {
    posicoesRubricas.push(mRub.index);
  }

  const itens: ItemComprovacaoFinanceira[] = [];
  for (let i = 0; i < posicoesRubricas.length; i++) {
    const ini = posicoesRubricas[i];
    const fim =
      i + 1 < posicoesRubricas.length
        ? posicoesRubricas[i + 1]
        : fatiaItens.length;
    const segmento = fatiaItens.substring(ini, fim);
    const valores = extrairValoresReais(segmento);
    if (valores.length === 0) continue;

    const desc = segmento
      .replace(/R?\s*\$\s*[\d.,]*/gi, ' ')
      .replace(/\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/g, ' ')
      .replace(/\b(?:UNID\.?|VERBA|HA|UA)\b/gi, ' ')
      .replace(/\|/g, ' ')
      .replace(/\b\d{1,3}\b(?=\s*$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    const mQtd =
      segmento.match(
        /(?:\||\s)(\d{1,3})\s*(?:\|\s*)?(?:R?\$?\s*)?(?:UNID\.?|UA|HA)\b/i
      ) || segmento.match(/\|\s*(\d{1,3})\s*\|/);

    if (desc.length >= 5) {
      const valProj = valores[0];
      const valApl = valores[1] ?? valProj;
      const valComp = valores[valores.length - 1] ?? valProj;
      itens.push({
        descricao: desc,
        categoriaItem: classificarCategoriaItem(desc),
        quantidade: mQtd?.[1] || '1',
        valorProjetado: valProj,
        valorAplicado: valApl,
        valorComprovado: valComp,
      });
    }
  }

  const idxTotal = corpoTabela.search(/\bTOTAL\b/i);
  const valsAposTotal =
    idxTotal !== -1
      ? extrairValoresReais(corpoTabela.substring(idxTotal, idxTotal + 220))
      : [];
  const somaIt = itens.reduce((a, b) => a + b.valorComprovado, 0);
  const todosValsTabela = extrairValoresReais(corpoTabela);
  const maiorValTabela =
    todosValsTabela.length > 0 ? Math.max(...todosValsTabela) : 0;

  const total =
    valsAposTotal.length > 0
      ? valsAposTotal[valsAposTotal.length - 1]
      : somaIt > 0
      ? somaIt
      : maiorValTabela;

  return {
    clienteNome,
    clienteCpf,
    dataRelatorio,
    tecnicoNome: (mTec?.[1] || '').trim().toUpperCase(),
    tecnicoCrea: (mCrea?.[1] || '').trim().toUpperCase(),
    itens,
    total,
  };
}

function extrairLaudoAcompanhamento(
  textoBruto: string
): DadosLaudoAcompanhamentoExtraidos {
  const linear = textoBruto.replace(/\s+/g, ' ').trim();
  const up = removerAcentos(linear).toUpperCase();

  const datas = linear.match(/\b\d{2}\/\d{2}\/20\d{2}\b/g) || [];
  const dataVisita = datas[0] || '';
  const dataRelatorio = datas[1] || dataVisita;

  const mLoc = linear.match(
    /LOCALIDADE\s*:?\s*\|?\s*([A-ZÀ-Ú0-9\s.\-]{3,50}?)\s*(?:\|\s*)?MUNIC[ÍI]PIO\s*:?\s*\|?\s*([A-ZÀ-Ú0-9\s\-]{3,35}?)(?=\s*\|?\s*[☑☐X]|\s+VISITADO|\s+I-)/i
  );
  const mCli = linear.match(
    /SANTA\s+IN[ÊE]S\s*[-–]\s*MA\s+([A-ZÀ-Ú\s]{5,60}?)\s+CNPJ:[\s\S]{0,20}?CPF:\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
  );
  const mCpfAny = linear.match(/CPF\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
  const mDtOp = linear.match(
    /OPERA[ÇC][ÕO]ES\s+["“]?EM\s+SER["”]?\s+NO\s+BANCO\s+DO\s+NORDESTE[\s\-–]*DATA\s*:?\s*(\d{2}\/\d{2}\/20\d{2})/i
  );
  const mTec = linear.match(
    /LAUDO\s+DE\s+ACOMPANHAMENTO\s+DE\s+CR[ÉE]DITO\s+([A-ZÀ-Ú\s]{5,55}?)\s+CONSULTOR/i
  );
  const mCrea = linear.match(/CREA(?:-MA)?[\/:\s]+([0-9A-Z\-/]{4,20})/i);
  const mCpfTec = linear.match(
    /CONSULTOR\s+AGROPECU[ÁA]RIO\s+CPF\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i
  );

  return {
    dataVisita,
    dataRelatorio,
    localidade: (mLoc?.[1] || '').trim().toUpperCase(),
    municipio: (mLoc?.[2] || '').trim().toUpperCase(),
    clienteNome: (mCli?.[1] || '').trim().toUpperCase(),
    clienteCpf: mCli?.[2]
      ? formatarCpf(mCli[2])
      : mCpfAny?.[1] && mCpfAny[1] !== mCpfTec?.[1]
      ? mCpfAny[1]
      : '',
    dataOperacaoEmSer: mDtOp?.[1] || '',
    tecnicoNome: (mTec?.[1] || '').trim().toUpperCase(),
    tecnicoCrea: (mCrea?.[1] || '').trim().toUpperCase(),
    tecnicoCpf: mCpfTec?.[1] || '',
    aplicacaoNormal:
      up.includes('APLICACAO DOS CREDITOS') &&
      up.includes('NORMAL') &&
      !up.includes('X ANORMAL'),
    garantiasNormal:
      up.includes('SITUACAO DAS GARANTIAS') && up.includes('NORMAL'),
    fatoresAdversosNao:
      up.includes('FATORES ADVERSOS') && up.includes('NAO'),
    situacaoAdmNormal:
      up.includes('SITUACAO ADMINISTRATIVA') && up.includes('NORMAL'),
    mencionaUnidadeFamiliarMaoDeObra:
      up.includes('PROPRIA UNIDADE FAMILIAR') ||
      up.includes('MAO DE OBRA PROPRIA') ||
      up.includes('EXECUTADOS PELA PROPRIA'),
  };
}

function extrairDadosGta(textoBruto: string): DadosGtaExtraidos {
  const mColOrig = textoBruto.match(
    /\[GTA_BLOCO_ORIGEM\]([\s\S]*?)\[GTA_BLOCO_DESTINO\]/i
  );
  const mColDest = textoBruto.match(
    /\[GTA_BLOCO_DESTINO\]([\s\S]*?)\[GTA_BLOCO_FIM\]/i
  );

  const textoSemTags = textoBruto.replace(
    /\[GTA_BLOCO_ORIGEM\][\s\S]*?\[GTA_BLOCO_FIM\]/gi,
    ' '
  );
  const linear = textoSemTags.replace(/\s+/g, ' ').trim();
  const up = removerAcentos(linear).toUpperCase();

  const mNum = linear.match(
    /GUIA\s+DE\s+TR[ÂA]NSITO\s+ANIMAL[\s\S]{0,60}?N[úu]mero\s*:?\s*(\d{4,12})\s+S[ée]rie\s*:?\s*([A-Z0-9]+)/i
  ) || linear.match(/N[úu]mero\s*:?\s*(\d{5,12})\s+([A-Z])\b/);

  const mEmissao =
    linear.match(
      /Data\/Hora\s+Emiss[ãa]o[\s\S]{0,80}?(\d{2}\/\d{2}\/20\d{2})/i
    ) ||
    linear.match(/Impresso\s+por[\s\S]{0,90}?(\d{2}\/\d{2}\/20\d{2})/i);
  const mVal = linear.match(/Validade\s*:?\s*(\d{2}\/\d{2}\/20\d{2})/i);

  const blocoOrigem = (
    mColOrig?.[1] ||
    (up.includes('II-DESTINO')
      ? linear.substring(0, up.indexOf('II-DESTINO'))
      : linear)
  )
    .replace(/\s+/g, ' ')
    .trim();

  const blocoDestino = (
    mColDest?.[1] ||
    (up.includes('II-DESTINO')
      ? linear.substring(up.indexOf('II-DESTINO'))
      : linear)
  )
    .replace(/\s+/g, ' ')
    .trim();

  const mEstOrig = blocoOrigem.match(
    /Estabelecimento\s*:?\s*([A-ZÀ-Ú0-9\s.\-/]{3,65}?)(?=\s+C[óo]digo\s+Estabelecimento|\s+Inscri[çc][ãa]o|$)/i
  );
  const mNomeOrig = blocoOrigem.match(
    /Nome\s*:?\s*([A-ZÀ-Ú\s]{4,60}?)(?=\s+CPF\/CNPJ|\s+Munic[íi]pio|$)/i
  );
  const mCpfOrig = blocoOrigem.match(
    /CPF\/CNPJ\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}\s*[-–]?\s*\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i
  );

  const mEstDest = blocoDestino.match(
    /Estabelecimento\s*:?\s*([A-ZÀ-Ú0-9\s.\-/]{3,65}?)(?=\s+C[óo]digo\s+Estabelecimento|\s+Inscri[çc][ãa]o|$)/i
  );
  const mNomeDest = blocoDestino.match(
    /Nome\s*:?\s*([A-ZÀ-Ú\s]{4,60}?)(?=\s+CPF\/CNPJ|\s+Munic[íi]pio|$)/i
  );
  const mCpfDest = blocoDestino.match(
    /CPF\/CNPJ\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}\s*[-–]?\s*\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i
  );
  const mMunDest = blocoDestino.match(
    /Munic[íi]pio\s*:?\s*([A-ZÀ-Ú0-9\s\-/]{3,40}?)(?=\s+Finalidade|\s+Transporte|\s+0-12|$)/i
  );
  const mFin = blocoDestino.match(
    /Finalidade\s*:?\s*([A-ZÀ-Úa-zà-ú\s]{3,30}?)(?=\s+0-12|\s+\d|$)/i
  );

  // Fallback para OCR sem tags de coluna: usa 1ª e 2ª ocorrências de Nome/CPF/Município
  const todosCpfs = [
    ...linear.matchAll(/CPF\/CNPJ\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}\s*[-–]?\s*\d{2})/gi),
  ].map((m) => formatarCpf(m[1]));
  const mRequisitante = linear.match(
    /Requisitante\s*:?\s*([A-ZÀ-Ú\s]{4,60}?)(?=\s+Data\/Hora|\s+Funcion[áa]rio|\s+CPF|$)/i
  );

  const mTab = linear.match(
    /Total\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)\s*(?:\|\s*)*(\d+)/i
  );
  const nums = mTab ? mTab.slice(1, 10).map((n) => parseInt(n, 10) || 0) : [];

  return {
    numero: mNum?.[1] || '',
    serie: mNum?.[2] || '',
    dataEmissao: mEmissao?.[1] || '',
    dataValidade: mVal?.[1] || '',
    origemEstabelecimento: (mEstOrig?.[1] || '').trim().toUpperCase(),
    origemNome: (
      mNomeOrig?.[1] ||
      mRequisitante?.[1] ||
      ''
    )
      .trim()
      .toUpperCase(),
    origemCpfCnpj: mCpfOrig?.[1]
      ? formatarCpf(mCpfOrig[1])
      : todosCpfs[0] || '',
    destinoEstabelecimento: (mEstDest?.[1] || '').trim().toUpperCase(),
    destinoNome: (mNomeDest?.[1] || '').trim().toUpperCase(),
    destinoCpf: mCpfDest?.[1]
      ? formatarCpf(mCpfDest[1])
      : todosCpfs[1] || '',
    destinoMunicipio: (mMunDest?.[1] || '').trim().toUpperCase(),
    finalidade: (mFin?.[1] || '').trim().toUpperCase(),
    qtd0a12M: nums[0] || 0,
    qtd0a12F: nums[1] || 0,
    qtd13a24M: nums[2] || 0,
    qtd13a24F: nums[3] || 0,
    qtd25a36M: nums[4] || 0,
    qtd25a36F: nums[5] || 0,
    qtdAcima36M: nums[6] || 0,
    qtdAcima36F: nums[7] || 0,
    totalAnimais: nums[8] || 0,
    possuiExamesNegativosCitados:
      up.includes('BRUCELOSE') &&
      (up.includes('NEGATIVO') || up.includes('TUBERCULOSE')),
  };
}

function extrairDadosNotaFiscal(textoBruto: string): DadosNotaFiscalExtraidos {
  const idxReciboPag2 = textoBruto.search(/RECIBO\s+DE\s+PAGAMENTO/i);
  const textoNf =
    idxReciboPag2 > 300 ? textoBruto.substring(0, idxReciboPag2) : textoBruto;
  const linear = textoNf
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3')
    .trim();
  const up = removerAcentos(linear).toUpperCase();

  // Chave de acesso (44 dígitos com quaisquer quebras ou grupos de 4/8 dígitos)
  const mChaveBloco =
    linear.match(/CHAVE\s+DE\s+ACESSO[\s\S]{0,120}?(\d[\d\s]{42,70}\d)/i) ||
    linear.match(/\b((?:\d{4}\s*){11})\b/);
  let chaveAcesso = '';
  if (mChaveBloco) {
    const digitos = mChaveBloco[1].replace(/\D/g, '');
    const m44 = digitos.match(/(\d{44})/);
    if (m44) chaveAcesso = m44[1];
  }

  const mNumSerie =
    linear.match(
      /N[°º№]?\s*([0-9.]{1,12})\s+(?:fl\.\s*\d+\/\d+\s+)?S[ée]rie\s*:?\s*(\d{1,4})/i
    ) ||
    linear.match(
      /NF-e[\s\S]{0,60}?N[°º№]?\s*([0-9.]{1,12})\s+S[ée]rie\s*:?\s*(\d{1,4})/i
    );

  const numero = mNumSerie ? normalizarNumeroNf(mNumSerie[1]) : '';
  const serie = mNumSerie ? normalizarNumeroNf(mNumSerie[2]) : '';

  // 1 - SAÍDA (suporta "1" antes ou depois de "0-ENTRADA 1-SAÍDA" e CFOP de saída 5xxx/6xxx)
  const temCfopSaida = /\b(?:CFOP\s*)?[56]\d{3}\b/.test(up);
  const ehSaida =
    /\b1\s+0\s*[-–]?\s*ENTRADA\s+1\s*[-–]?\s*SA[ÍI]DA/i.test(linear) ||
    /0\s*[-–]?\s*ENTRADA\s+1\s*[-–]?\s*SA[ÍI]DA[\s\S]{0,35}?\b1\b/i.test(
      linear
    ) ||
    /1\s*[-–]?\s*SA[ÍI]DA[\s\S]{0,35}?\b1\b/i.test(linear) ||
    temCfopSaida;
  const ehEntradaExplicita =
    !ehSaida &&
    /\b0\s+0\s*[-–]?\s*ENTRADA\s+1\s*[-–]?\s*SA[ÍI]DA/i.test(linear);
  const tipoOperacaoSaida: 'SAIDA' | 'ENTRADA' | 'NAO_IDENTIFICADO' = ehSaida
    ? 'SAIDA'
    : ehEntradaExplicita
    ? 'ENTRADA'
    : 'NAO_IDENTIFICADO';

  const mNat = linear.match(
    /NATUREZA\s+D[AE]\s+OPERA[ÇC][ÃA]O[\s\S]{0,50}?(VENDA[^0-9\n]{3,60}|REMESSA[^0-9\n]{3,60}|ENTREGA[^0-9\n]{3,60})/i
  );
  const naturezaOperacao = (mNat?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const ehEntregaFutura =
    up.includes('ENTREGA FUTURA') ||
    up.includes('SIMPLES FATURAMENTO') ||
    /\b(5922|6922)\b/.test(up);

  const mEmitNome = linear.match(
    /RECEBEMOS\s+DE\s+([A-ZÀ-Ú0-9\s.&\-]{3,65}?)\s+OS\s+PRODUTOS/i
  );
  const emitenteNome = (mEmitNome?.[1] || '').trim().toUpperCase();

  const mDest =
    linear.match(
      /DESTINAT[ÁA]RIO\s*\/?\s*REMETENTE[\s\S]{0,40}?NOME\/RAZ[ÃA]O\s+SOCIAL\s+([A-ZÀ-Ú\s]{4,65}?)(?=\s+ENDERE[ÇC]O|\s+CNPJ)/i
    ) ||
    linear.match(
      /DEST\.?\/REM\.?\s*:?\s*([A-ZÀ-Ú\s]{4,60}?)\s*(?:[-–]\s*)?VALOR\s+TOTAL/i
    );
  const destinatarioNome = (mDest?.[1] || '').trim().toUpperCase();

  const docsEncontrados = [
    ...linear.matchAll(
      /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\b/g
    ),
  ].map((m) => m[1]);
  const docsUnicos = Array.from(new Set(docsEncontrados));
  const emitenteCpfCnpj = docsUnicos[0] || '';
  const destinatarioCpf = docsUnicos[1] || '';

  const mDataEm =
    linear.match(
      /DATA\s+D[AE]\s+EMISS[ÃA]O[\s\S]{0,30}?(\d{2}\/\d{2}\/20\d{2})/i
    ) ||
    linear.match(/EMISS[ÃA]O\s*:?\s*(\d{2}\/\d{2}\/20\d{2})/i) ||
    linear.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/);
  const dataEmissao = mDataEm?.[1] || '';

  const mValTot =
    linear.match(
      /V(?:ALOR|\.)\s+TOTAL\s+DA\s+NOTA[\s\S]{0,30}?(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,7}[.,]\d{2})(?!\d)/i
    ) ||
    linear.match(
      /VALOR\s+TOTAL\s*:?\s*R\$\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,7}[.,]\d{2})(?!\d)/i
    ) ||
    linear.match(
      /V(?:ALOR|\.)\s+TOTAL\s+D[EO]S?\s+PRODUTOS[\s\S]{0,30}?(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,7}[.,]\d{2})(?!\d)/i
    );
  const valorTotal = mValTot ? parseMoeda(normalizarMoedaStr(mValTot[1])) : 0;

  const mGtaCit = linear.match(
    /GUIA\s+DE\s+TR[ÂA]NSITO\s+ANIMAL[\s\S]{0,30}?N[úu]mero\s*:?\s*(\d{4,12})/i
  );

  // =========================================================================
  // EXTRAÇÃO DOS PRODUTOS DA NF-e (Clássico + Novo Layout 2026 IBS/CBS + Fallback Seguro)
  // =========================================================================
  const itens: ItemNotaFiscalDesembolso[] = [];
  const mIdxProd = up.match(/DADOS\s+D[EO]S?\s+PRODUTOS?/i);
  const idxProd = mIdxProd?.index ?? -1;
  const fatiaProd = idxProd !== -1 ? textoNf.substring(idxProd) : textoNf;
  const fatiaProdLin = fatiaProd
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3');

  // Camada 1: Linha completa (clássico e 2026 IBS/CBS quando reconstruída por viewport)
  const regexProdLinha =
    /([A-ZÀ-Ú][A-ZÀ-Ú0-9\s.\-/]{5,75}?)\s+(?:\[NCM[^\]]*\]\s*(?:\[cClassTrib[^\]]*\]\s*)?)?(?:\|\s*)*(?:(?:CST\s*)?\d{3,8}\s+(?:\|\s*)*(?:CFOP\s*)?\d{3,4}\s+(?:\|\s*)*(?:\d{4}\s+(?:\|\s*)*)?)?(?:(UN|SC|KG|HA|UA|LT|PC|CX)\s+(?:\|\s*)*(\d+(?:[.,]\d{1,3})?)|(\d+(?:[.,]\d{1,3})?)\s*\[?(UN|CAB|SC|KG|HA|UA)\]?)\s+(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2}|\d{3,7}[.,]\d{2})(?!\d)\s+(?:\|\s*)*(\d{1,3}(?:\.\d{3})*[.,]\d{2}|\d{3,7}[.,]\d{2})(?!\d)/gi;

  let mP: RegExpExecArray | null;
  while ((mP = regexProdLinha.exec(fatiaProdLin)) !== null) {
    const desc = mP[1]
      .replace(/^\d{5,}\s*[-–]?\s*/, '')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    if (desc.includes('BASE DE CALC') || desc.includes('ALIQUOTA')) continue;
    const unid = (mP[2] || mP[5] || 'UN').toUpperCase();
    const qtd = parseFloat((mP[3] || mP[4] || '0').replace(',', '.')) || 0;
    const unit = parseMoeda(normalizarMoedaStr(mP[6]));
    const tot = parseMoeda(normalizarMoedaStr(mP[7]));
    if (tot > 0 && qtd > 0) {
      itens.push({
        descricao: desc,
        categoriaItem: classificarCategoriaItem(desc),
        unidade: unid,
        quantidade: qtd,
        valorUnitario: unit,
        valorTotal: tot,
        faixaEtariaDetectada: /ACIMA\s+DE\s+36\s+MESES/i.test(desc)
          ? '> 36 MESES'
          : /13\s*(?:A|-)\s*24/i.test(desc)
          ? '13-24 MESES'
          : /0\s*(?:A|-)\s*12/i.test(desc)
          ? '0-12 MESES'
          : undefined,
      });
    }
  }

  // Camada 2: Layout em quadrinhos / IBS-CBS onde descrições e colunas QTD/UNIT/TOTAL vêm em blocos separados
  if (itens.length === 0 && up.includes('BOVINO')) {
    const descsBov = [
      ...fatiaProdLin.matchAll(
        /\b(BOVINO\s+(?:MACHO|F[ÊE]MEA)[A-ZÀ-Ú0-9\s]{3,42}?)(?=\s+\[NCM|\s+0102|\s+2000|\s+CST|$)/gi
      ),
    ].map((m) => m[1].replace(/\s+/g, ' ').trim().toUpperCase());

    const regexQtdUn =
      /(\d{1,4}[.,]\d{1,3})\s*\[?(UN|CAB)\]?|\[?(UN|CAB)\]?\s*(\d{1,4}[.,]\d{1,3})/gi;
    const trincasBov: Array<{
      qtd: number;
      un: string;
      unit: number;
      tot: number;
    }> = [];

    let mQ: RegExpExecArray | null;
    while ((mQ = regexQtdUn.exec(fatiaProdLin)) !== null) {
      const qtdStr = mQ[1] || mQ[4] || '0';
      const unStr = (mQ[2] || mQ[3] || 'UN').toUpperCase();
      const qtd = parseFloat(qtdStr.replace(',', '.')) || 0;
      if (qtd <= 0 || qtd > 500) continue;

      const janela = fatiaProdLin.substring(
        mQ.index + mQ[0].length,
        mQ.index + mQ[0].length + 180
      );
      const vals = (
        janela.match(
          /(?:^|[^\d])(\d{1,3}(?:\.\d{3})+[.,]\d{2}|\d{3,7}[.,]\d{2})(?!\d)/g
        ) || []
      ).map((v) =>
        parseMoeda(normalizarMoedaStr(v.replace(/^[^\d]+/, '')))
      );

      for (let i = 0; i < vals.length - 1; i++) {
        const u = vals[i];
        const t = vals[i + 1];
        if (u >= 200 && t >= 200 && Math.abs(qtd * u - t) <= 2) {
          trincasBov.push({ qtd, un: unStr, unit: u, tot: t });
          break;
        }
      }
    }

    trincasBov.forEach((tr, idx) => {
      const desc = descsBov[idx] || `BOVINO ITEM #${idx + 1}`;
      itens.push({
        descricao: desc,
        categoriaItem: classificarCategoriaItem(desc),
        unidade: tr.un,
        quantidade: tr.qtd,
        valorUnitario: tr.unit,
        valorTotal: tr.tot,
        faixaEtariaDetectada: /ACIMA\s+DE\s+36\s+MESES/i.test(desc)
          ? '> 36 MESES'
          : undefined,
      });
    });
  }

  // Camada 3: Fallback apenas para NF de item único (nunca cria item único falso se houver MACHO + FEMEA juntos!)
  const nfMencionaDoisTiposBovino =
    up.includes('MACHO') && up.includes('FEMEA');
  if (itens.length === 0 && valorTotal > 0 && !nfMencionaDoisTiposBovino) {
    const upProd = removerAcentos(fatiaProdLin || linear).toUpperCase();
    const catInferida = classificarCategoriaItem(upProd);
    if (catInferida !== 'OUTRO') {
      const rotuloMap: Record<string, string> = {
        PASTAGEM: 'INSUMOS / SEMENTE DE CAPIM PARA PASTAGEM (NF)',
        CERCA_REFORMA: 'MATERIAIS PARA CERCA / REFORMA (NF)',
        MATRIZ: 'BOVINO FÊMEA / MATRIZ (NF)',
        REPRODUTOR: 'BOVINO MACHO / REPRODUTOR (NF)',
        ASSESSORIA: 'SERVIÇO DE ASSESSORIA TÉCNICA (NF)',
      };
      itens.push({
        descricao: rotuloMap[catInferida] || 'ITEM DA NOTA FISCAL',
        categoriaItem: catInferida,
        unidade: 'UN',
        quantidade: 1,
        valorUnitario: valorTotal,
        valorTotal,
      });
    }
  }

  return {
    numero,
    serie,
    chaveAcesso,
    tipoOperacaoSaida,
    naturezaOperacao,
    ehEntregaFutura,
    dataEmissao,
    emitenteNome,
    emitenteCpfCnpj,
    destinatarioNome,
    destinatarioCpf,
    valorTotal,
    numeroGtaCitada: mGtaCit?.[1] || '',
    possuiCarimboPago: /\bPAGO\b/.test(up),
    itens,
  };
}

function extrairDadosRecibo(textoBruto: string): DadosReciboExtraidos {
  const idxRec = textoBruto.search(/RECIBO\s+DE\s+PAGAMENTO|\bRECIBO\b/i);
  const fatia = idxRec !== -1 ? textoBruto.substring(idxRec) : textoBruto;
  const linear = fatia
    .replace(/\s+/g, ' ')
    .replace(/(\d)[Oo](?=\d|[.,])/g, '$10')
    .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3')
    .trim();

  const regexMoedaEstrita =
    /(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:\.\d{3})+\.\d{2}|\d{1,7},\d{2}|\d{1,7}\.\d{2})(?!\d)/;

  const mValQuantia = linear.match(
    new RegExp(`quantia\\s+de\\s+R\\$\\s*${regexMoedaEstrita.source}`, 'i')
  );
  const todosValoresRecibo = [
    ...linear.matchAll(
      new RegExp(`R\\$\\s*${regexMoedaEstrita.source}`, 'gi')
    ),
  ].map((m) => parseMoeda(normalizarMoedaStr(m[1])));

  const maiorValorRecibo =
    todosValoresRecibo.length > 0 ? Math.max(...todosValoresRecibo) : 0;
  const valQuantiaNum = mValQuantia
    ? parseMoeda(normalizarMoedaStr(mValQuantia[1]))
    : 0;
  const valorTotal =
    valQuantiaNum > 0 && valQuantiaNum >= maiorValorRecibo * 0.5
      ? valQuantiaNum
      : maiorValorRecibo;

  const mCli = linear.match(
    /Recebi\s+d[eo]\s+(?:Sr[°ºa]?\s*\(?a?\)?\.?\s*)?([A-ZÀ-Úa-zà-ú\s]{4,60}?)\s*,?\s*CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i
  );
  const clienteNome = (mCli?.[1] || '').trim().toUpperCase();
  const clienteCpf = mCli?.[2] ? formatarCpf(mCli[2]) : '';

  const mNf =
    linear.match(
      /Nota\s+Fiscal(?:\s+Eletr[ôo]nica)?\s*n?[°º]?\s*:?\s*([0-9.]{1,12})\s*,?\s*S[ée]rie\s*:?\s*(\d{1,4})/i
    );

  const mFornNome =
    linear.match(/NOME\s*:?\s*([A-ZÀ-Ú\s]{4,60}?)\s+CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i) ||
    linear.match(
      /Documento\s+assinado\s+digitalmente\s+([A-ZÀ-Ú\s]{4,60}?)\s+Data:/i
    );
  const mCnpjForn = linear.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);

  const mDataRec =
    linear.match(
      /(?:MA|PI|CE|PA)\s*,\s*(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2})/i
    ) ||
    linear.match(/Data:\s*(\d{2}\/\d{2}\/20\d{2})/i) ||
    linear.match(/emitida\s+em\s+(\d{2}\/\d{2}\/20\d{2})/i);

  const mMat = linear.match(/(\d{1,3})\s*(?:\([^)]+\)\s*)?MATRIZES?\s+BOVIN/i);
  const mRep = linear.match(/(\d{1,2})\s*(?:\([^)]+\)\s*)?REPRODUTOR/i);

  return {
    valorTotal,
    dataRecibo: converterDataExtensoOuCurtaBR(mDataRec?.[1] || ''),
    clienteNome,
    clienteCpf,
    fornecedorNome: (mFornNome?.[1] || '').trim().toUpperCase(),
    fornecedorCpfCnpj:
      mFornNome?.[2]
        ? formatarCpf(mFornNome[2])
        : mCnpjForn?.[1] || '',
    numeroNfCitada: mNf ? normalizarNumeroNf(mNf[1]) : '',
    serieNfCitada: mNf ? normalizarNumeroNf(mNf[2]) : '',
    qtdMatrizes: mMat ? parseInt(mMat[1], 10) : 0,
    qtdReprodutores: mRep ? parseInt(mRep[1], 10) : 0,
    ehReciboAssessoria:
      /ASSESSORIA\s+(?:EMPRESARIAL|T[ÉE]CNICA)|ASSIST[ÊE]NCIA\s+T[ÉE]CNICA|ELABORA[ÇC][ÃA]O\s+DE\s+PROJETO|HONOR[ÁA]RIOS\s+T[ÉE]CNICOS/i.test(
        linear
      ),
    resumoObjeto: linear.substring(0, 220),
  };
}

function extrairDadosDeclaracaoRecebimento(
  textoBruto: string
): DadosDeclaracaoRecebimentoExtraidos {
  const linear = textoBruto
    .replace(/\s+/g, ' ')
    .replace(/(\d)[Oo](?=\d|[.,])/g, '$10')
    .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3')
    .trim();

  const todosValoresDecl = [
    ...linear.matchAll(
      /R\$\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:\.\d{3})+\.\d{2}|\d{1,7},\d{2})(?!\d)/gi
    ),
  ].map((m) => parseMoeda(normalizarMoedaStr(m[1])));
  const valorTotalDeclMaior =
    todosValoresDecl.length > 0 ? Math.max(...todosValoresDecl) : 0;

  const mVal = linear.match(/R\$\s*(\d{1,3}(?:\.\d{3})*[.,]\d{2})/i);
  const mNf = linear.match(
    /nota\(s\)\s+fiscal\s*\(?is\)?\s+de\s+N[°º]?\s*([0-9.]{1,12})\s+S[ée]rie\s*(\d{1,4})/i
  );
  const mForn = linear.match(
    /emitida\s*\(?s?\)?\s+por\s+([A-ZÀ-Ú\s]{4,60}?)\s*,?\s*de\s+CPF\s*:+\s*(\d{3}\.?\d{3}\.?\d{3}\s*[-–]?\s*\d{2})/i
  );
  const mCcb = linear.match(
    /C[ée]dula\s+de\s+Cr[ée]dito\s+Banc[áa]rio\s+N[°º]?\s*([0-9.]{12,22})\s*,?\s*emitida\s+em\s+(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2}|\d{2}\/\d{2}\/20\d{2})/i
  );
  const mCli = linear.match(
    /NOME\s*:?\s*([A-ZÀ-Ú\s]{4,60}?)\s+CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}\s*[-–]?\s*\d{2})/i
  );
  const mDataDecl = linear.match(
    /MA\s*,\s*(\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+20\d{2})/i
  );
  const mMat = linear.match(/(\d{1,3})\s*(?:\([^)]+\)\s*)?MATRIZES?\s+BOVIN/i);
  const mRep = linear.match(/(\d{1,2})\s*(?:\([^)]+\)\s*)?REPRODUTOR/i);

  return {
    valorTotal: valorTotalDeclMaior,
    dataDeclaracao: converterDataExtensoOuCurtaBR(mDataDecl?.[1] || ''),
    clienteNome: (mCli?.[1] || '').trim().toUpperCase(),
    clienteCpf: mCli?.[2] ? formatarCpf(mCli[2]) : '',
    fornecedorNome: (mForn?.[1] || '').trim().toUpperCase(),
    fornecedorCpfCnpj: mForn?.[2] ? formatarCpf(mForn[2]) : '',
    numeroNfCitada: mNf ? normalizarNumeroNf(mNf[1]) : '',
    serieNfCitada: mNf ? normalizarNumeroNf(mNf[2]) : '',
    numeroCcbCitada: mCcb?.[1]?.trim() || '',
    dataCcbCitada: converterDataExtensoOuCurtaBR(mCcb?.[2] || ''),
    qtdMatrizes: mMat ? parseInt(mMat[1], 10) : 0,
    qtdReprodutores: mRep ? parseInt(mRep[1], 10) : 0,
  };
}

function extrairDadosViti(
  textoBruto: string,
  nomeArquivo: string
): DadosVitiExtraidos {
  const linear = textoBruto.replace(/\s+/g, ' ').trim();
  const up = removerAcentos(linear).toUpperCase();
  const mArq = linear.match(/Nome\s+do\s+arquivo\s*:?\s*([^\s]+\.pdf)/i) ||
    linear.match(/Arquivo\s*:?\s*([^\s]+\.pdf)/i);

  const signatarios: string[] = [];
  const regexCn = /(?:Assinante:\s*)?CN=([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,60}?)(?=\s+CPF|\s+Buscado|\s+Informa|\s+Emissor|,|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regexCn.exec(linear)) !== null) {
    const cand = m[1].replace(/\s+/g, ' ').trim().toUpperCase();
    if (
      !cand.startsWith('AC ') &&
      !cand.includes('GOVERNO FEDERAL') &&
      !cand.includes('AUTORIDADE CERTIFICADORA')
    ) {
      signatarios.push(cand);
    }
  }

  return {
    arquivoValidadoNome: mArq?.[1] || nomeArquivo,
    signatariosValidados: Array.from(new Set(signatarios)),
    aprovado: !up.includes('INVALIDA') && !up.includes('NAO CONFORME'),
  };
}

export async function auditarDocumentoIndividualDesembolso(params: {
  file: File;
  forcarOcr?: boolean;
  onProgresso?: (msg: string) => void;
  controle?: ControleCancelamentoOcrDesembolso;
}): Promise<DocumentoDesembolsoAuditado> {
  const { file, forcarOcr = false, onProgresso, controle } = params;
  const { texto, numPaginas, usouOcr, assinaturaBinaria } =
    await extrairTextoHibridoDesembolsoPdf(file, forcarOcr, onProgresso, controle);

  const classif = classificarDocumentoDesembolso(texto, file.name);
  const up = removerAcentos(texto).toUpperCase();
  const signatariosDigitais = extrairAssinaturasDigitaisNoTexto(texto);
  // Só exige VITI quando há assinatura criptográfica real no binário do PDF OU em PDF digital nativo (!usouOcr).
  // PDFs escaneados/impressos (usouOcr && !assinaturaBinaria) com assinatura/carimbo manual são isentos de VITI!
  const possuiAssinaturaDigital =
    classif.tipo !== 'VITI' &&
    (assinaturaBinaria ||
      (!usouOcr &&
        (signatariosDigitais.length > 0 ||
          up.includes('DOCUMENTO ASSINADO DIGITALMENTE') ||
          up.includes('VALIDAR.ITI.GOV.BR'))));

  const base: DocumentoDesembolsoAuditado = {
    nomeArquivo: file.name,
    numPaginas,
    foiLidoPorOcr: usouOcr,
    tipo: classif.tipo,
    tituloTipo: classif.titulo,
    possuiAssinaturaDigital,
    signatariosDigitais,
    textoExtraido: texto,
  };

  if (classif.tipo === 'ANEXO_ORCAMENTO') {
    const orc = extrairOrcamentoDoPdf(texto);
    base.lancamentosOrcamento = orc.lancamentos;
    base.totalOrcamentoFne = orc.totalFne;
    base.numeroCcb = orc.numeroCcb;
    base.dataContratacaoCcb = orc.dataContratacao;
    base.clienteNome = orc.clienteNome;
    base.clienteCpf = orc.clienteCpf;
  } else if (classif.tipo === 'COMPROVACAO_FINANCEIRA') {
    const comp = extrairComprovacaoFinanceira(texto);
    base.clienteNome = comp.clienteNome;
    base.clienteCpf = comp.clienteCpf;
    base.itensComprovacao = comp.itens;
    base.totalComprovacaoFinanceira = comp.total;
    base.tecnicoComprovacaoNome = comp.tecnicoNome;
    base.tecnicoComprovacaoCrea = comp.tecnicoCrea;
    base.dataComprovacao = comp.dataRelatorio;
  } else if (classif.tipo === 'LAUDO_ACOMPANHAMENTO') {
    const laudo = extrairLaudoAcompanhamento(texto);
    base.dadosLaudo = laudo;
    base.clienteNome = laudo.clienteNome;
    base.clienteCpf = laudo.clienteCpf;
    base.dataContratacaoCcb = laudo.dataOperacaoEmSer;
  } else if (classif.tipo === 'GTA') {
    const gta = extrairDadosGta(texto);
    base.dadosGta = gta;
    base.clienteNome = gta.destinoNome;
    base.clienteCpf = gta.destinoCpf;
  } else if (classif.tipo === 'NOTA_FISCAL') {
    const nf = extrairDadosNotaFiscal(texto);
    base.dadosNf = nf;
    base.clienteNome = nf.destinatarioNome;
    base.clienteCpf = nf.destinatarioCpf;
  } else if (classif.tipo === 'NOTA_FISCAL_E_RECIBO') {
    const nf = extrairDadosNotaFiscal(texto);
    const rec = extrairDadosRecibo(texto);
    base.dadosNf = nf;
    base.dadosRecibo = rec;
    base.clienteNome = nf.destinatarioNome || rec.clienteNome;
    base.clienteCpf = nf.destinatarioCpf || rec.clienteCpf;
  } else if (classif.tipo === 'RECIBO_PAGAMENTO') {
    const rec = extrairDadosRecibo(texto);
    base.dadosRecibo = rec;
    base.clienteNome = rec.clienteNome;
    base.clienteCpf = rec.clienteCpf;
  } else if (classif.tipo === 'DECLARACAO_RECEBIMENTO') {
    const decl = extrairDadosDeclaracaoRecebimento(texto);
    base.dadosDeclaracao = decl;
    base.clienteNome = decl.clienteNome;
    base.clienteCpf = decl.clienteCpf;
    base.numeroCcb = decl.numeroCcbCitada;
    base.dataContratacaoCcb = decl.dataCcbCitada;
  } else if (classif.tipo === 'VITI') {
    base.dadosViti = extrairDadosViti(texto, file.name);
  }

  return base;
}

export function auditarPacoteDesembolsoCompleto(params: {
  documentos: DocumentoDesembolsoAuditado[];
  mesReferencia: string; // "YYYY-MM"
  modalidade: 'PRONAF_A' | 'DERIVADA_GERAL' | 'RENOVACAO_CUSTEIO';
  operacoesBase?: OperacaoBaseDesembolso[];
  contratacoes?: RegistroContratacao[];
}): ResultadoAuditoriaPacoteDesembolso {
  const {
    documentos,
    mesReferencia,
    modalidade,
    operacoesBase = [],
    contratacoes = [],
  } = params;

  const docOrcamento = documentos.find((d) => d.tipo === 'ANEXO_ORCAMENTO');
  const docComprovacao = documentos.find(
    (d) => d.tipo === 'COMPROVACAO_FINANCEIRA'
  );
  const docLaudo = documentos.find((d) => d.tipo === 'LAUDO_ACOMPANHAMENTO');
  const docsGta = documentos.filter((d) => d.tipo === 'GTA');
  const docsNf = documentos.filter(
    (d) => d.tipo === 'NOTA_FISCAL' || d.tipo === 'NOTA_FISCAL_E_RECIBO'
  );
  const docsRecibo = documentos.filter(
    (d) => d.tipo === 'RECIBO_PAGAMENTO' || d.tipo === 'NOTA_FISCAL_E_RECIBO'
  );
  const docsDeclaracao = documentos.filter(
    (d) => d.tipo === 'DECLARACAO_RECEBIMENTO'
  );
  const docsViti = documentos.filter((d) => d.tipo === 'VITI');

  // Vincula VITIs aos documentos assinados digitalmente (por nome de arquivo ou signatário)
  const limparBaseNomeParaViti = (nome: string) =>
    normalizarSemAcento(nome)
      .replace(/\.?PDF$/, '')
      .replace(/^\d+(?:\.\d+)?\s*/, '')
      .replace(/\b(?:VITI|RELATORIO|ASSINADO|PROJETISTA)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Vincula VITIs aos documentos assinados digitalmente (por nome limpo sem prefixo numérico, arquivo interno, signatário CN= ou miolo do CPF!)
  const docsComVitiVinculado = documentos.map((doc) => {
    if (!doc.possuiAssinaturaDigital || doc.tipo === 'VITI') return doc;

    const baseDocLimpa = limparBaseNomeParaViti(doc.nomeArquivo);
    const signatariosDoDoc = [
      ...doc.signatariosDigitais.map((s) => s.split('(')[0].trim()),
      doc.dadosRecibo?.fornecedorNome || '',
      doc.tecnicoComprovacaoNome || '',
      doc.dadosLaudo?.tecnicoNome || '',
    ].filter(Boolean);

    const cpfsSignatariosDoc = [
      doc.dadosRecibo?.fornecedorCpfCnpj || '',
      doc.dadosLaudo?.tecnicoCpf || '',
    ]
      .map((c) => c.replace(/\D/g, ''))
      .filter((d) => d.length === 11);

    const vitiAchado = docsViti.find((v) => {
      const baseVitiLimpa = limparBaseNomeParaViti(v.nomeArquivo);
      const arqInternoViti = normalizarSemAcento(
        v.dadosViti?.arquivoValidadoNome || ''
      );
      const tVitiNorm = normalizarSemAcento(v.textoExtraido);

      // 1. Casamento pelo nome sem numeração e sem a palavra VITI ("RECIBO DO GADO" === "RECIBO DO GADO")
      if (
        baseDocLimpa.length >= 4 &&
        baseVitiLimpa.length >= 4 &&
        (baseVitiLimpa.includes(baseDocLimpa) ||
          baseDocLimpa.includes(baseVitiLimpa))
      ) {
        return true;
      }

      // 2. Casamento por tipo de documento no nome do VITI ou no nome interno validado
      if (
        doc.tipo === 'COMPROVACAO_FINANCEIRA' &&
        (baseVitiLimpa.includes('COMPROVACAO') ||
          arqInternoViti.includes('COMPROVACAO'))
      ) {
        return true;
      }
      if (
        doc.tipo === 'LAUDO_ACOMPANHAMENTO' &&
        (baseVitiLimpa.includes('LAUDO') || arqInternoViti.includes('LAUDO'))
      ) {
        return true;
      }
      if (
        (doc.tipo === 'RECIBO_PAGAMENTO' ||
          doc.tipo === 'NOTA_FISCAL_E_RECIBO') &&
        (baseVitiLimpa.includes('RECIBO') || arqInternoViti.includes('RECIBO'))
      ) {
        // Se houver signatário/CPF no VITI, confirma se é o mesmo fornecedor (ex: EDILEUDO / ***.709.943-**)
        const bateSignatario =
          signatariosDoDoc.some((s) =>
            (v.dadosViti?.signatariosValidados || []).some((vs) =>
              nomesSaoSemelhantes(s, vs)
            )
          ) ||
          cpfsSignatariosDoc.some((d11) =>
            v.textoExtraido.includes(`${d11.slice(3, 6)}.${d11.slice(6, 9)}`)
          );
        if (
          bateSignatario ||
          (baseDocLimpa.includes('GADO') &&
            (baseVitiLimpa.includes('GADO') || arqInternoViti.includes('GADO')))
        ) {
          return true;
        }
      }

      // 3. Casamento direto por signatário CN= + tipo no texto do VITI
      if (
        signatariosDoDoc.some((s) =>
          (v.dadosViti?.signatariosValidados || []).some((vs) =>
            nomesSaoSemelhantes(s, vs)
          )
        ) &&
        doc.tipo === 'RECIBO_PAGAMENTO' &&
        tVitiNorm.includes('RECIBO')
      ) {
        return true;
      }

      return false;
    });

    return {
      ...doc,
      signatariosDigitais:
        doc.signatariosDigitais.length > 0
          ? doc.signatariosDigitais
          : signatariosDoDoc.slice(0, 1),
      vitiCorrespondente: vitiAchado?.nomeArquivo,
    };
  });

  // Identidade consolidada
  const clienteNome =
    docOrcamento?.clienteNome ||
    docComprovacao?.clienteNome ||
    docLaudo?.clienteNome ||
    docsGta[0]?.clienteNome ||
    docsNf[0]?.clienteNome ||
    '';
  const clienteCpf =
    docOrcamento?.clienteCpf ||
    docComprovacao?.clienteCpf ||
    docLaudo?.clienteCpf ||
    docsGta[0]?.clienteCpf ||
    docsNf[0]?.clienteCpf ||
    '';
  const numeroCcb =
    docOrcamento?.numeroCcb || docsDeclaracao[0]?.numeroCcb || '';
  const dataContratacao =
    docOrcamento?.dataContratacaoCcb ||
    docLaudo?.dataContratacaoCcb ||
    docsDeclaracao[0]?.dataContratacaoCcb ||
    '';
  const imovelEstabelecimento =
    docLaudo?.dadosLaudo?.localidade ||
    docsGta[0]?.dadosGta?.destinoEstabelecimento ||
    '';

  const dtContratoObj = parseDataBR(dataContratacao);

  // Busca vínculo no Painel (Operações Base / Contratações)
  const cpfDig = normalizarCpfCnpj(clienteCpf);
  const opBaseMatch = operacoesBase.find(
    (o) =>
      (cpfDig.length === 11 && normalizarCpfCnpj(o.cpf) === cpfDig) ||
      (clienteNome && nomesSaoSemelhantes(o.cliente, clienteNome))
  );
  const contrMatch = contratacoes.find(
    (c) =>
      (cpfDig.length === 11 && normalizarCpfCnpj(c.cpf) === cpfDig) ||
      (clienteNome && nomesSaoSemelhantes(c.cliente, clienteNome))
  );

  // =========================================================================
  // CRONOGRAMA DO ANEXO-ORÇAMENTO POR MÊS/ANO (REGRA DE TRAVA FUTURA!)
  // =========================================================================
  const mapaMeses = new Map<string, ResumoCronogramaParcelaOrcamento>();
  for (const lanc of docOrcamento?.lancamentosOrcamento || []) {
    const ch = lanc.chaveAnoMes;
    const exist = mapaMeses.get(ch);
    const liberavelAgora = ch <= mesReferencia;
    if (exist) {
      exist.valorTotalMes += lanc.valorFinanciadoFne;
      exist.itens.push(lanc);
    } else {
      mapaMeses.set(ch, {
        mesAno: lanc.mesAno.toUpperCase(),
        chaveAnoMes: ch,
        liberavelAgora,
        valorTotalMes: lanc.valorFinanciadoFne,
        itens: [lanc],
      });
    }
  }
  const cronogramaPorMes = Array.from(mapaMeses.values()).sort((a, b) =>
    a.chaveAnoMes.localeCompare(b.chaveAnoMes)
  );

  const valorTotalOrcamento = docOrcamento?.totalOrcamentoFne || 0;
  const valorLiberavelAteMesRef = cronogramaPorMes
    .filter((m) => m.liberavelAgora)
    .reduce((acc, m) => acc + m.valorTotalMes, 0);
  const valorBloqueadoFuturo = cronogramaPorMes
    .filter((m) => !m.liberavelAgora)
    .reduce((acc, m) => acc + m.valorTotalMes, 0);

  const valorTotalComprovacaoFinanceira =
    docComprovacao?.totalComprovacaoFinanceira || 0;
  const valorTotalNotasFiscais = docsNf.reduce(
    (acc, d) => acc + (d.dadosNf?.valorTotal || 0),
    0
  );
  const valorTotalRecibos = docsRecibo.reduce(
    (acc, d) => acc + (d.dadosRecibo?.valorTotal || 0),
    0
  );

  const checklist: ItemChecklistAuditoriaDesembolso[] = [];

  // -------------------------------------------------------------------------
  // 1. COMPOSIÇÃO DO PACOTE DE DESEMBOLSO
  // -------------------------------------------------------------------------
  const temGadoNoPacote =
    docsGta.length > 0 ||
    docsNf.some((d) =>
      (d.dadosNf?.itens || []).some(
        (i) => i.categoriaItem === 'MATRIZ' || i.categoriaItem === 'REPRODUTOR'
      )
    );
  const faltantesPacote: string[] = [];
  if (!docOrcamento) faltantesPacote.push('Anexo-Orçamento do Contrato');
  if (!docComprovacao) faltantesPacote.push('Comprovação Físico-Financeira');
  if (!docLaudo) faltantesPacote.push('Laudo de Acompanhamento');
  if (docsNf.length === 0) faltantesPacote.push('Nota(s) Fiscal(is) / DANFE');
  if (temGadoNoPacote && docsGta.length === 0) faltantesPacote.push('GTA');
  if (temGadoNoPacote && docsDeclaracao.length === 0)
    faltantesPacote.push('Declaração de Recebimento dos Animais');

  checklist.push({
    id: 'DESEMB_1_COMPOSICAO',
    titulo: `1. Composição do Dossiê de Desembolso (${documentos.length} arquivo(s) analisado(s))`,
    status: faltantesPacote.length === 0 ? 'OK' : 'ALERTA',
    resumo:
      faltantesPacote.length === 0
        ? '✅ Todas as peças essenciais do desembolso foram identificadas pelo conteúdo interno!'
        : `⚠️ Faltam carregar para conferência integral: ${faltantesPacote.join(', ')}.`,
    detalhes: [
      `📄 Anexo-Orçamento: ${docOrcamento ? `✅ ${docOrcamento.nomeArquivo}` : '❌ Não anexado'}`,
      `📄 Comprovação Financeira: ${docComprovacao ? `✅ ${docComprovacao.nomeArquivo}` : '❌ Não anexada'}`,
      `📄 Laudo de Acompanhamento: ${docLaudo ? `✅ ${docLaudo.nomeArquivo}` : '❌ Não anexado'}`,
      `🐄 GTA(s): ${docsGta.length > 0 ? `✅ ${docsGta.map((d) => d.nomeArquivo).join(', ')}` : '—'}`,
      `🧾 Nota(s) Fiscal(is): ${docsNf.length > 0 ? `✅ ${docsNf.map((d) => `${d.nomeArquivo} (NF ${d.dadosNf?.numero || '?'})`).join(', ')}` : '❌ Nenhuma'}`,
      `💵 Recibo(s): ${docsRecibo.length > 0 ? `✅ ${docsRecibo.map((d) => d.nomeArquivo).join(', ')}` : '⚠️ Nenhum (se > R$ 5 mil, crédito direto ao fornecedor)'}`,
      `✍️ Declaração Recebimento Animais: ${docsDeclaracao.length > 0 ? `✅ ${docsDeclaracao.map((d) => d.nomeArquivo).join(', ')}` : '—'}`,
      `🔐 Relatórios VITI carregados: ${docsViti.length}`,
    ],
  });

  // -------------------------------------------------------------------------
  // 2. SINTONIA DE IDENTIDADE (CLIENTE, CPF, Nº CCB E DATA DO CONTRATO)
  // -------------------------------------------------------------------------
  const cpfOficialContratoDig = normalizarCpfCnpj(
    docOrcamento?.clienteCpf ||
      docLaudo?.clienteCpf ||
      docsGta[0]?.clienteCpf ||
      clienteCpf
  );

  const docsComCpfDivergente = documentos.filter(
    (d) =>
      d.tipo !== 'VITI' &&
      d.clienteCpf &&
      cpfOficialContratoDig.length === 11 &&
      normalizarCpfCnpj(d.clienteCpf) !== cpfOficialContratoDig
  );

  const cpfsDistintos = Array.from(
    new Set(
      documentos
        .filter((d) => d.tipo !== 'VITI' && d.clienteCpf)
        .map((d) => normalizarCpfCnpj(d.clienteCpf || ''))
    )
  );
  const ccbOrcDig = normalizarNumeroCcbDigitos(docOrcamento?.numeroCcb || '');
  const ccbDeclDig = normalizarNumeroCcbDigitos(
    docsDeclaracao[0]?.numeroCcb || ''
  );
  const ccbDiverge =
    Boolean(ccbOrcDig && ccbDeclDig) && ccbOrcDig !== ccbDeclDig;
  const ccbComErroFormatacao =
    Boolean(docsDeclaracao[0]?.numeroCcb && docOrcamento?.numeroCcb) &&
    ccbOrcDig === ccbDeclDig &&
    docsDeclaracao[0]?.numeroCcb !== docOrcamento?.numeroCcb;

  checklist.push({
    id: 'DESEMB_2_IDENTIDADE',
    titulo: '2. Sintonia de Cliente, CPF, Nº da CCB e Data de Contratação',
    status:
      docsComCpfDivergente.length > 0 || cpfsDistintos.length > 1 || ccbDiverge
        ? 'ERRO'
        : ccbComErroFormatacao
        ? 'ALERTA'
        : 'OK',
    resumo:
      docsComCpfDivergente.length > 0
        ? `🚨 CPF DO TITULAR DIVERGENTE em [${docsComCpfDivergente
            .map((d) => `${d.nomeArquivo}: ${d.clienteCpf}`)
            .join(', ')}] — o CPF oficial do contrato é ${formatarCpf(
            cpfOficialContratoDig
          )}!`
        : ccbDiverge
        ? `🚨 DIVERGÊNCIA NO Nº DA CCB: Orçamento (${docOrcamento?.numeroCcb}) × Declaração (${docsDeclaracao[0]?.numeroCcb})!`
        : `✅ Cliente ${clienteNome} (CPF: ${clienteCpf}) • CCB nº ${numeroCcb || '-'} • Contratação: ${dataContratacao || '-'} em sintonia em todos os documentos.`,
    detalhes: [
      ...documentos
        .filter((d) => d.tipo !== 'VITI')
        .map((d) => {
          const cpfErrado =
            d.clienteCpf &&
            cpfOficialContratoDig.length === 11 &&
            normalizarCpfCnpj(d.clienteCpf) !== cpfOficialContratoDig;
          return `${cpfErrado ? '🚨 CPF DIVERGENTE' : '✅'} [${d.tipo}] (${
            d.nomeArquivo
          }) — Cliente: ${d.clienteNome || '-'} | CPF: ${d.clienteCpf || '-'}`;
        }),
      ccbComErroFormatacao
        ? `⚠️ Detalhe de digitação na Declaração de Recebimento: consta "${docsDeclaracao[0]?.numeroCcb}" (faltou um ponto, porém os 15 dígitos batem com "${docOrcamento?.numeroCcb}").`
        : '',
    ].filter(Boolean),
  });

  // -------------------------------------------------------------------------
  // 3. CRONOGRAMA DO ANEXO-ORÇAMENTO (SEMPRE EM QUADRO AMARELO INFORMATIVO POR MÊS E ITEM)
  // -------------------------------------------------------------------------
  if (docOrcamento) {
    const resumoMesesTexto = cronogramaPorMes
      .map(
        (m) =>
          `${m.mesAno}: R$ ${formatarMoedaBD(m.valorTotalMes)}${
            m.liberavelAgora ? ' (liberável)' : ' (futuro)'
          }`
      )
      .join(' | ');

    checklist.push({
      id: 'DESEMB_3_CRONOGRAMA_ORCAMENTO',
      titulo: `3. Cronograma de Liberação do Anexo-Orçamento (Ref.: ${mesReferencia})`,
      status: 'ALERTA',
      resumo: `📅 Limite por mês conforme Anexo-Orçamento — Liberável até ${mesReferencia}: R$ ${formatarMoedaBD(
        valorLiberavelAteMesRef
      )} | Parcelas futuras: R$ ${formatarMoedaBD(
        valorBloqueadoFuturo
      )} (${resumoMesesTexto}).`,
      detalhes: cronogramaPorMes.flatMap((m) => [
        `${
          m.liberavelAgora
            ? '✅ DISPONÍVEL ATÉ O MÊS DE REF.'
            : '🗓️ PREVISTO PARA MÊS FUTURO'
        } — ${m.mesAno} | Total liberável neste mês: R$ ${formatarMoedaBD(
          m.valorTotalMes
        )}`,
        ...m.itens.map(
          (it) =>
            `   • ${it.codigo} ${it.descricao} (${
              it.quantidadeUnidade
            }) ➔ Máx. no mês: R$ ${formatarMoedaBD(it.valorFinanciadoFne)}`
        ),
      ]),
    });
  }

  // -------------------------------------------------------------------------
  // 4. CRUZAMENTO POR RUBRICA: ANEXO-ORÇAMENTO × COMPROVAÇÃO × NFs/RECIBOS
  //    + Regra Comprovação a Maior (OK limitado ao orçamento)
  //    + Regra Mão de Obra Familiar (Pastagem / Reforma / Cercas)
  //    + Regra Obrigatória de Recibo da Assessoria (FNE ou Recursos Próprios)
  // -------------------------------------------------------------------------
  const detalhesRubricas: string[] = [];
  let erroRubricaFaltandoComprovacao = false;
  let alertaRemanejamentoOrcVsComp = false;
  let temExcedenteComprovado = false;
  let temMaoDeObraFamiliarValidada = false;
  let alertaMaoDeObraAcima37 = false;
  let msgAlertaMaoDeObra37 = '';
  let faltaReciboAssessoriaObrigatorio = false;
  let msgErroAssessoria = '';

  const categoriasParaComparar: Array<
    'MATRIZ' | 'REPRODUTOR' | 'PASTAGEM' | 'CERCA_REFORMA' | 'ASSESSORIA' | 'OUTRO'
  > = ['MATRIZ', 'REPRODUTOR', 'PASTAGEM', 'CERCA_REFORMA', 'ASSESSORIA', 'OUTRO'];

  for (const cat of categoriasParaComparar) {
    const lancsCat = (docOrcamento?.lancamentosOrcamento || []).filter(
      (l) => l.categoriaItem === cat
    );
    const somaOrcFne = lancsCat.reduce((a, b) => a + b.valorFinanciadoFne, 0);
    const somaOrcProp = lancsCat.reduce(
      (a, b) => a + b.valorRecursosProprios,
      0
    );
    const somaOrcTotal = somaOrcFne + somaOrcProp;

    const somaComp = (docComprovacao?.itensComprovacao || [])
      .filter((i) => i.categoriaItem === cat)
      .reduce((a, b) => a + b.valorComprovado, 0);

    const somaNf = docsNf
      .flatMap((d) => d.dadosNf?.itens || [])
      .filter((i) => i.categoriaItem === cat)
      .reduce((a, b) => a + b.valorTotal, 0);

    if (somaOrcTotal === 0 && somaComp === 0 && somaNf === 0) continue;

    // REGRA 3: ASSESSORIA EMPRESARIAL E TÉCNICA (Financiada OU Recursos Próprios)
    if (cat === 'ASSESSORIA') {
      const reciboAss = docsRecibo.find(
        (r) =>
          r.dadosRecibo &&
          (r.dadosRecibo.ehReciboAssessoria ||
            (somaOrcTotal > 0 &&
              Math.abs(r.dadosRecibo.valorTotal - somaOrcTotal) <= 1))
      );
      const valReciboAss = reciboAss?.dadosRecibo?.valorTotal || 0;
      const tipoFonteAss =
        somaOrcProp > 0 && somaOrcFne === 0
          ? 'Recursos Próprios'
          : somaOrcProp > 0 && somaOrcFne > 0
          ? 'FNE + Recursos Próprios'
          : 'Financiada (FNE)';

      if (somaOrcTotal > 0.01) {
        if (reciboAss && valReciboAss >= somaOrcTotal - 0.05) {
          detalhesRubricas.push(
            `✅ [ASSESSORIA — ${tipoFonteAss}] Orçado: R$ ${formatarMoedaBD(
              somaOrcTotal
            )} | Recibo ao Projetista comprovado: R$ ${formatarMoedaBD(
              valReciboAss
            )} (${reciboAss.nomeArquivo}).`
          );
        } else {
          faltaReciboAssessoriaObrigatorio = true;
          erroRubricaFaltandoComprovacao = true;
          msgErroAssessoria = `🚨 FALTA RECIBO DA ASSESSORIA (${tipoFonteAss}): O Anexo-Orçamento prevê R$ ${formatarMoedaBD(
            somaOrcTotal
          )} de assessoria técnica${
            reciboAss
              ? ` (recibo localizado de apenas R$ ${formatarMoedaBD(valReciboAss)})`
              : ' e não há recibo comprovando o pagamento ao projetista'
          }!`;
          detalhesRubricas.push(msgErroAssessoria);
        }
      }
      continue;
    }

    const baseAlvo = somaOrcFne > 0 ? somaOrcFne : somaComp;
    const difOrcVsComp = somaComp - somaOrcFne;
    const difNfVsBase = somaNf - baseAlvo;

    // Detecta se houve remanejamento entre o Orçamento e a Comprovação Financeira
    if (docOrcamento && docComprovacao && Math.abs(difOrcVsComp) > 0.05) {
      if (difOrcVsComp > 0.05) {
        // Comprovou MAIS que o orçado para o item -> permitido, mas recebe o teto orçado!
        alertaRemanejamentoOrcVsComp = true;
      } else {
        alertaRemanejamentoOrcVsComp = true;
      }
    }

    // REGRA 1: Comprovação em NF acima do Orçado -> 100% OK, limitado ao teto do Orçamento!
    if (baseAlvo > 0 && difNfVsBase > 0.05) {
      temExcedenteComprovado = true;
      detalhesRubricas.push(
        `✅ [${cat}] Orçado: R$ ${formatarMoedaBD(
          somaOrcFne
        )} | Comprovado em NF: R$ ${formatarMoedaBD(
          somaNf
        )} (+ R$ ${formatarMoedaBD(
          difNfVsBase
        )} a maior — OK! Valor a liberar limitado ao teto orçado: R$ ${formatarMoedaBD(
          somaOrcFne || baseAlvo
        )})`
      );
      continue;
    }

    // REGRA 2: Pastagem / Reforma / Construção de Cercas com NF abaixo do Orçado (Trava de 37% para Mão de Obra Familiar)
    if (
      (cat === 'PASTAGEM' || cat === 'CERCA_REFORMA') &&
      baseAlvo > 0 &&
      difNfVsBase < -0.05
    ) {
      const diferencaMaoDeObra = baseAlvo - somaNf;
      const percMaoDeObra = (diferencaMaoDeObra / baseAlvo) * 100;

      if (docLaudo?.dadosLaudo?.mencionaUnidadeFamiliarMaoDeObra) {
        if (somaNf <= 0.01 || percMaoDeObra > 37) {
          alertaMaoDeObraAcima37 = true;
          msgAlertaMaoDeObra37 = `⚠️ [${cat} — MÃO DE OBRA ACIMA DE 37% (${percMaoDeObra.toFixed(
            1
          )}%)] Comprovação de insumos pode estar insuficiente! Conferir manualmente (Insumos NF: R$ ${formatarMoedaBD(
            somaNf
          )} | Mão de Obra: R$ ${formatarMoedaBD(diferencaMaoDeObra)}).`;
          detalhesRubricas.push(
            `⚠️ [${cat} — ALERTA MÃO DE OBRA ACIMA DE 37% (${percMaoDeObra.toFixed(
              1
            )}%)] Orçado: R$ ${formatarMoedaBD(
              somaOrcFne
            )} | Insumos em NF/Recibo: R$ ${formatarMoedaBD(
              somaNf
            )} | Diferença atribuída à Mão de Obra Familiar: R$ ${formatarMoedaBD(
              diferencaMaoDeObra
            )} (${percMaoDeObra.toFixed(
              1
            )}% > teto de 37%) — Conferir manualmente se a comprovação de insumos é suficiente!`
          );
        } else {
          temMaoDeObraFamiliarValidada = true;
          detalhesRubricas.push(
            `✅ [${cat} — MÃO DE OBRA FAMILIAR VALIDADA (${percMaoDeObra.toFixed(
              1
            )}% ≤ 37%)] Orçado: R$ ${formatarMoedaBD(
              somaOrcFne
            )} | Insumos em NF/Recibo: R$ ${formatarMoedaBD(
              somaNf
            )} | Mão de Obra da Unidade Familiar (Laudo): R$ ${formatarMoedaBD(
              diferencaMaoDeObra
            )} ➔ Total Validado p/ Liberação: R$ ${formatarMoedaBD(baseAlvo)}`
          );
        }
      } else {
        erroRubricaFaltandoComprovacao = true;
        detalhesRubricas.push(
          `🚨 [${cat}] Orçado: R$ ${formatarMoedaBD(
            somaOrcFne
          )} | Comprovado em NF: R$ ${formatarMoedaBD(
            somaNf
          )} — Faltam R$ ${formatarMoedaBD(
            diferencaMaoDeObra
          )} em NF/Recibo OU declaração no Laudo de Acompanhamento informando que a mão de obra foi executada pela própria unidade familiar!`
        );
      }
      continue;
    }

    // Demais itens (Matrizes, Reprodutores, Outros) com NF abaixo do orçado
    if (baseAlvo > 0 && somaNf > 0 && difNfVsBase < -0.05) {
      erroRubricaFaltandoComprovacao = true;
      detalhesRubricas.push(
        `🚨 [${cat}] Orçado: R$ ${formatarMoedaBD(
          somaOrcFne
        )} | Comprovação Fin.: R$ ${formatarMoedaBD(
          somaComp
        )} | NFs: R$ ${formatarMoedaBD(
          somaNf
        )} — Faltam comprovar R$ ${formatarMoedaBD(Math.abs(difNfVsBase))}!`
      );
      continue;
    }

    detalhesRubricas.push(
      `${
        docOrcamento && docComprovacao && Math.abs(difOrcVsComp) > 0.05
          ? '⚠️'
          : '✅'
      } [${cat}] Orçado: R$ ${formatarMoedaBD(
        somaOrcFne
      )} | Comprovação Fin.: R$ ${formatarMoedaBD(
        somaComp
      )} | NFs: R$ ${formatarMoedaBD(somaNf)}`
    );
  }

  // Verifica também se o total da Comprovação Financeira é MENOR que o Orçamento (passar para + é OK!)
  const comprovacaoAbaixoDoOrcamento =
    Boolean(docOrcamento && docComprovacao) &&
    valorTotalComprovacaoFinanceira < valorTotalOrcamento - 0.05;

  const statusItem4: StatusItemAuditoriaDesembolso =
    faltaReciboAssessoriaObrigatorio ||
    erroRubricaFaltandoComprovacao ||
    comprovacaoAbaixoDoOrcamento
      ? 'ERRO'
      : alertaMaoDeObraAcima37 || alertaRemanejamentoOrcVsComp
      ? 'ALERTA'
      : 'OK';

  let resumoItem4 = `✅ Rubricas e valores 100% conformes entre Orçamento, Comprovação Financeira e NFs${
    temMaoDeObraFamiliarValidada
      ? ' (diferença de insumos × mão de obra familiar validada pelo Laudo)'
      : ''
  }${
    temExcedenteComprovado
      ? ' • Comprovação a maior permitida (liberação limitada ao teto do orçamento)'
      : ''
  }.`;

  if (faltaReciboAssessoriaObrigatorio) {
    resumoItem4 = msgErroAssessoria;
  } else if (erroRubricaFaltandoComprovacao) {
    resumoItem4 =
      '🚨 Há rubrica(s) com comprovação em NF/Recibo abaixo do previsto no Orçamento (sem justificativa de mão de obra familiar no Laudo)!';
  } else if (comprovacaoAbaixoDoOrcamento) {
    resumoItem4 = `🚨 Total da Comprovação (R$ ${formatarMoedaBD(
      valorTotalComprovacaoFinanceira
    )}) está abaixo do Total do Orçamento (R$ ${formatarMoedaBD(
      valorTotalOrcamento
    )})!`;
  } else if (alertaRemanejamentoOrcVsComp) {
    resumoItem4 = `⚠️ Teto global bate (R$ ${formatarMoedaBD(
      valorTotalOrcamento
    )}), mas há diferença por rubrica entre o Anexo-Orçamento e a Comprovação Financeira (confira se houve remanejamento autorizado).`;
    } else if (alertaMaoDeObraAcima37) {
    resumoItem4 = msgAlertaMaoDeObra37;
  }

  checklist.push({
    id: 'DESEMB_4_CRUZAMENTO_ORCAMENTO_COMP_NF',
    titulo:
      '4. Cruzamento de Itens, Mão de Obra Familiar, Assessoria e Teto do Orçamento',
    status: statusItem4,
    resumo: resumoItem4,
    detalhes: detalhesRubricas,
  });

  // -------------------------------------------------------------------------
  // 5. AUDITORIA DE DATAS (NF, RECIBO, GTA E LAUDO SEMPRE APÓS A CONTRATAÇÃO)
  // -------------------------------------------------------------------------
  const errosDatas: string[] = [];
  const detalhesDatas: string[] = [];

  const checarDataAposContrato = (rotulo: string, dataStr: string) => {
    if (!dataStr) return;
    const dt = parseDataBR(dataStr);
    if (dt && dtContratoObj && dt < dtContratoObj) {
      errosDatas.push(
        `🚨 ${rotulo} (${dataStr}) é ANTERIOR à data do contrato (${dataContratacao})!`
      );
    } else {
      detalhesDatas.push(
        `✅ ${rotulo}: ${dataStr}${
          dataContratacao ? ` (posterior ao contrato ${dataContratacao})` : ''
        }`
      );
    }
  };

  docsNf.forEach((d) =>
    checarDataAposContrato(
      `NF nº ${d.dadosNf?.numero || '?'} (${d.nomeArquivo})`,
      d.dadosNf?.dataEmissao || ''
    )
  );
  docsGta.forEach((d) =>
    checarDataAposContrato(
      `GTA nº ${d.dadosGta?.numero || '?'}`,
      d.dadosGta?.dataEmissao || ''
    )
  );
  docsRecibo.forEach((d) =>
    checarDataAposContrato(
      `Recibo (${d.nomeArquivo})`,
      d.dadosRecibo?.dataRecibo || ''
    )
  );
  if (docLaudo?.dadosLaudo?.dataVisita) {
    checarDataAposContrato(
      'Laudo de Acompanhamento (Visita)',
      docLaudo.dadosLaudo.dataVisita
    );
  }

  checklist.push({
    id: 'DESEMB_5_DATAS',
    titulo: '5. Cronologia de Datas (NF, GTA, Recibos e Laudo × Data do Contrato)',
    status: errosDatas.length > 0 ? 'ERRO' : 'OK',
    resumo:
      errosDatas.length > 0
        ? errosDatas[0]
        : `✅ Todos os documentos possuem datas válidas posteriores à contratação (${
            dataContratacao || 'confirmar data'
          }).`,
    detalhes: [...errosDatas, ...detalhesDatas],
  });

  // -------------------------------------------------------------------------
  // 6. AUDITORIA DAS NOTAS FISCAIS (1-SAÍDA, ENTREGA FUTURA, FAIXA DE VALOR × RECIBO)
  // -------------------------------------------------------------------------
  const errosNf: string[] = [];
  const alertasNf: string[] = [];
  const detalhesNf: string[] = [];

  for (const docNf of docsNf) {
    const nf = docNf.dadosNf;
    if (!nf) continue;

    if (nf.ehEntregaFutura) {
      errosNf.push(
        `🚨 NF nº ${nf.numero} ("${docNf.nomeArquivo}") consta como ENTREGA FUTURA / SIMPLES FATURAMENTO (vedado pelo normativo)!`
      );
    }
    if (nf.tipoOperacaoSaida === 'ENTRADA') {
      errosNf.push(
        `🚨 NF nº ${nf.numero} marcada como 0 - ENTRADA (deve ser 1 - SAÍDA)!`
      );
    }

    // Procura recibo correspondente a esta NF
    const reciboMatch = docsRecibo.find(
      (r) =>
        r.dadosRecibo &&
        ((nf.numero && r.dadosRecibo.numeroNfCitada === nf.numero) ||
          Math.abs(r.dadosRecibo.valorTotal - nf.valorTotal) <= 0.05)
    );

    let msgRegraPagamento = '';
    if (nf.valorTotal <= 5000) {
      msgRegraPagamento = reciboMatch
        ? `✅ Até R$ 5 mil + Recibo vinculado OK (R$ ${formatarMoedaBD(
            reciboMatch.dadosRecibo?.valorTotal || 0
          )})`
        : '✅ Até R$ 5 mil (dispensa comprovante extra além da NF)';
    } else {
      if (reciboMatch) {
        const valBate =
          Math.abs((reciboMatch.dadosRecibo?.valorTotal || 0) - nf.valorTotal) <=
          0.05;
        if (!valBate) {
          errosNf.push(
            `🚨 Valor do Recibo (R$ ${formatarMoedaBD(
              reciboMatch.dadosRecibo?.valorTotal || 0
            )}) diverge da NF nº ${nf.numero} (R$ ${formatarMoedaBD(
              nf.valorTotal
            )})!`
          );
        }
        msgRegraPagamento = `✅ Acima de R$ 5 mil com Recibo vinculado (${reciboMatch.nomeArquivo})`;
      } else {
        alertasNf.push(
          `⚠️ NF nº ${nf.numero} (R$ ${formatarMoedaBD(
            nf.valorTotal
          )} > R$ 5.000,00) sem Recibo/Comprovante anexado: se não houver quitação, liberar diretamente na conta do fornecedor (${nf.emitenteNome}).`
        );
        msgRegraPagamento = '⚠️ Sem Recibo (crédito direto ao fornecedor)';
      }
    }

    detalhesNf.push(
      `🧾 NF nº ${nf.numero || '?'} Série ${nf.serie || '?'} (${
        nf.dataEmissao
      }) — ${nf.emitenteNome} (${nf.emitenteCpfCnpj}) ➔ R$ ${formatarMoedaBD(
        nf.valorTotal
      )} • ${nf.tipoOperacaoSaida === 'SAIDA' ? '1-SAÍDA ✅' : 'Verificar Saída'} • ${msgRegraPagamento}`,
      nf.chaveAcesso
        ? `   🔑 Chave NF-e: ${nf.chaveAcesso} (conferir autenticidade na Receita Federal)`
        : ''
    );
  }

  checklist.push({
    id: 'DESEMB_6_NOTAS_FISCAIS_E_RECIBOS',
    titulo:
      '6. Auditoria de Notas Fiscais (1-Saída, Vedação Entrega Futura) × Recibos de Pagamento',
    status:
      errosNf.length > 0 ? 'ERRO' : alertasNf.length > 0 ? 'ALERTA' : 'OK',
    resumo:
      errosNf.length > 0
        ? errosNf[0]
        : alertasNf.length > 0
        ? alertasNf[0]
        : `✅ ${docsNf.length} Nota(s) Fiscal(is) (Total R$ ${formatarMoedaBD(
            valorTotalNotasFiscais
          )}) conferidas como 1-SAÍDA, sem entrega futura e com recibos compatíveis.`,
    detalhes: [
      ...errosNf.filter((e) => e !== errosNf[0] || errosNf.length > 1),
      ...alertasNf.filter((a) => errosNf.length > 0 || a !== alertasNf[0] || alertasNf.length > 1),
      ...detalhesNf.filter(Boolean),
    ],
  });

  // -------------------------------------------------------------------------
  // 7. CRUZAMENTO SEMOVENTES (GTA × NF GADO × RECIBO GADO × DECLARAÇÃO RECEBIMENTO)
  // -------------------------------------------------------------------------
  if (temGadoNoPacote) {
    const errosGado: string[] = [];
    const detalhesGado: string[] = [];
    const gta = docsGta[0]?.dadosGta;
    const nfGado = docsNf.find((d) =>
      (d.dadosNf?.itens || []).some(
        (i) => i.categoriaItem === 'MATRIZ' || i.categoriaItem === 'REPRODUTOR'
      )
    )?.dadosNf;
    const decl = docsDeclaracao[0]?.dadosDeclaracao;

    if (gta && nfGado) {
      // 1. Número da GTA citado na NF
      if (nfGado.numeroGtaCitada && gta.numero && nfGado.numeroGtaCitada !== gta.numero) {
        errosGado.push(
          `🚨 Nº da GTA na NF (${nfGado.numeroGtaCitada}) diverge da GTA anexada (${gta.numero})!`
        );
      } else if (nfGado.numeroGtaCitada) {
        detalhesGado.push(
          `✅ Vínculo NF × GTA confirmado: NF nº ${nfGado.numero} cita expressamente a GTA nº ${gta.numero} (Série ${gta.serie}).`
        );
      }

      // 2. Fornecedor (CPF) igual na Origem da GTA e Emitente da NF
      if (
        normalizarCpfCnpj(gta.origemCpfCnpj) &&
        normalizarCpfCnpj(nfGado.emitenteCpfCnpj) &&
        normalizarCpfCnpj(gta.origemCpfCnpj) !==
          normalizarCpfCnpj(nfGado.emitenteCpfCnpj)
      ) {
        errosGado.push(
          `🚨 Fornecedor da GTA (${gta.origemNome} — ${gta.origemCpfCnpj}) diverge do Emitente da NF (${nfGado.emitenteNome} — ${nfGado.emitenteCpfCnpj})!`
        );
      } else {
        detalhesGado.push(
          `✅ Fornecedor idêntico na GTA e NF: ${gta.origemNome} (CPF: ${gta.origemCpfCnpj}).`
        );
      }

      // 3. Quantidades e Faixas Etárias (S567: Reprodutores >36M, Matrizes >36F)
      const qtdMachoNf = nfGado.itens
        .filter((i) => i.categoriaItem === 'REPRODUTOR')
        .reduce((a, b) => a + b.quantidade, 0);
      const qtdFemeaNf = nfGado.itens
        .filter((i) => i.categoriaItem === 'MATRIZ')
        .reduce((a, b) => a + b.quantidade, 0);
      const totalNfAnimais = qtdMachoNf + qtdFemeaNf;

      if (totalNfAnimais !== gta.totalAnimais) {
        errosGado.push(
          `🚨 Quantidade de animais diverge: GTA transporta ${gta.totalAnimais} animais e NF fatura ${totalNfAnimais}!`
        );
      } else {
        detalhesGado.push(
          `✅ Quantidades e Faixas Etárias compatíveis: GTA (${gta.qtdAcima36M} macho >36m + ${gta.qtdAcima36F} fêmeas >36m = ${gta.totalAnimais}) × NF (${qtdMachoNf} reprodutor + ${qtdFemeaNf} matrizes = ${totalNfAnimais}).`
        );
      }

      // 4. Estabelecimento Destino e Exames
      detalhesGado.push(
        `📍 Estabelecimento Destino na GTA: ${gta.destinoEstabelecimento || '?'} (${
          gta.destinoMunicipio || '-'
        }) • Validade GTA: ${gta.dataEmissao} a ${gta.dataValidade}`,
        gta.possuiExamesNegativosCitados
          ? '🩺 Sanidade Animal: Exames de Brucelose e Tuberculose NEGATIVOS registrados na GTA.'
          : '⚠️ Atenção: Conferir atestados/exames de Brucelose e Tuberculose na GTA.'
      );
    }

    if (decl && nfGado) {
      const valDeclOk = Math.abs(decl.valorTotal - nfGado.valorTotal) <= 0.05;
      const nfDeclOk = !decl.numeroNfCitada || decl.numeroNfCitada === nfGado.numero;
      const fornDeclOk =
        !decl.fornecedorCpfCnpj ||
        normalizarCpfCnpj(decl.fornecedorCpfCnpj) ===
          normalizarCpfCnpj(nfGado.emitenteCpfCnpj);

      if (!valDeclOk || !nfDeclOk || !fornDeclOk) {
        errosGado.push(
          `🚨 Divergência na Declaração de Recebimento dos Animais (Valor R$ ${formatarMoedaBD(
            decl.valorTotal
          )} | NF ${decl.numeroNfCitada} | Fornecedor ${decl.fornecedorCpfCnpj})!`
        );
      } else {
        detalhesGado.push(
          `✅ Declaração de Recebimento OK: R$ ${formatarMoedaBD(
            decl.valorTotal
          )} • ${decl.qtdMatrizes} matrizes + ${
            decl.qtdReprodutores
          } reprodutor • NF nº ${decl.numeroNfCitada} Série ${
            decl.serieNfCitada
          } • Fornecedor CPF ${decl.fornecedorCpfCnpj}.`
        );
      }
    }

    checklist.push({
      id: 'DESEMB_7_SEMOVENTES_GTA_NF_DECL',
      titulo:
        '7. Cruzamento de Semoventes (GTA × NF Gado × Idades/Fases × Declaração de Recebimento)',
      status: errosGado.length > 0 ? 'ERRO' : 'OK',
      resumo:
        errosGado.length > 0
          ? errosGado[0]
          : `✅ GTA nº ${gta?.numero || '?'} × NF nº ${
              nfGado?.numero || '?'
            } × Declaração de Recebimento 100% sincronizados (quantidades, idades >36m, fornecedor e destino).`,
      detalhes: [
        ...errosGado.filter((e) => e !== errosGado[0] || errosGado.length > 1),
        ...detalhesGado,
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 8. LAUDO DE ACOMPANHAMENTO & SINTONIA DO TÉCNICO RESPONSÁVEL
  // -------------------------------------------------------------------------
  if (docLaudo?.dadosLaudo) {
    const l = docLaudo.dadosLaudo;
    const tecnicoBate =
      !docComprovacao?.tecnicoComprovacaoCrea ||
      !l.tecnicoCrea ||
      normalizarSemAcento(docComprovacao.tecnicoComprovacaoCrea)
        .replace(/[^0-9]/g, '') ===
        normalizarSemAcento(l.tecnicoCrea).replace(/[^0-9]/g, '');

    const tudoNormalLaudo =
      l.aplicacaoNormal &&
      l.garantiasNormal &&
      l.fatoresAdversosNao &&
      l.situacaoAdmNormal;

    checklist.push({
      id: 'DESEMB_8_LAUDO_ACOMPANHAMENTO',
      titulo: '8. Laudo de Acompanhamento de Crédito (Situação Normal & Técnico)',
      status: !tudoNormalLaudo || !tecnicoBate ? 'ALERTA' : 'OK',
      resumo: tudoNormalLaudo
        ? `✅ Laudo de ${l.dataVisita} (${l.localidade} / ${l.municipio}): Aplicação, Garantias e Situação Administrativa NORMAIS • Sem fatores adversos • Técnico ${l.tecnicoNome} (${l.tecnicoCrea}).`
        : '⚠️ Verifique os quadros de normalidade ou o técnico responsável no Laudo de Acompanhamento.',
      detalhes: [
        `👨‍🌾 Localidade visitada: ${l.localidade} — ${l.municipio} (Data: ${l.dataVisita})`,
        `🔧 Técnico: ${l.tecnicoNome} | CREA: ${l.tecnicoCrea} | CPF: ${l.tecnicoCpf} ${
          tecnicoBate ? '✅ (bate com Comprovação)' : '⚠️ (diferente da Comprovação)'
        }`,
        l.mencionaUnidadeFamiliarMaoDeObra
          ? '✅ Observação relevante no Laudo: registra execução de serviço pela própria unidade familiar.'
          : '',
      ].filter(Boolean),
    });
  }

  // -------------------------------------------------------------------------
  // 9. ASSINATURAS DIGITAIS (GOV.BR / ICP-BRASIL) × EXIGÊNCIA DE VITI
  // -------------------------------------------------------------------------
  const docsAssinadosDigitalmente = docsComVitiVinculado.filter(
    (d) => d.possuiAssinaturaDigital && d.tipo !== 'VITI'
  );
  const faltandoViti = docsAssinadosDigitalmente.filter(
    (d) => !d.vitiCorrespondente
  );

  checklist.push({
    id: 'DESEMB_9_ASSINATURAS_VITI',
    titulo: `9. Auditoria de Assinaturas Digitais (Gov.br) e Relatórios VITI (${
      docsAssinadosDigitalmente.length - faltandoViti.length
    }/${docsAssinadosDigitalmente.length})`,
    status: faltandoViti.length > 0 ? 'ALERTA' : 'OK',
    resumo:
      docsAssinadosDigitalmente.length === 0
        ? '✅ Nenhum documento com assinatura digital detectada (assinaturas manuais — conferir documento de identificação dos signatários).'
        : faltandoViti.length > 0
        ? `⚠️ ${faltandoViti.length} documento(s) assinado(s) digitalmente sem relatório VITI anexado nesta análise: ${faltandoViti
            .map((d) => d.nomeArquivo)
            .join(', ')}.`
        : `✅ Todos os ${docsAssinadosDigitalmente.length} documento(s) assinados digitalmente possuem VITI validado!`,
    detalhes: docsAssinadosDigitalmente.map(
      (d) =>
        `${d.vitiCorrespondente ? '✅' : '⚠️ FALTA VITI'} ${
          d.nomeArquivo
        } — Signatário(s): ${
          d.signatariosDigitais.join(', ') || 'Assinatura digital detectada'
        }${d.vitiCorrespondente ? ` (VITI: ${d.vitiCorrespondente})` : ''}`
    ),
  });

  // -------------------------------------------------------------------------
  // TEXTO PRONTO PARA DESPACHO S567
  // -------------------------------------------------------------------------
  const linhasItensS567 = (docComprovacao?.itensComprovacao || []).map(
    (it) =>
      `- ${it.descricao} (${it.quantidade} UN): R$ ${formatarMoedaBD(
        it.valorComprovado
      )}`
  );
  const linhasNfsS567 = docsNf.map(
    (d) =>
      `- NF nº ${d.dadosNf?.numero || '?'} Série ${
        d.dadosNf?.serie || '?'
      } (${d.dadosNf?.dataEmissao || '-'}) | ${
        d.dadosNf?.emitenteNome || '-'
      } (${d.dadosNf?.emitenteCpfCnpj || '-'}) | R$ ${formatarMoedaBD(
        d.dadosNf?.valorTotal || 0
      )}`
  );

  const textoResumoS567 = [
    `ANÁLISE DE CONFORMIDADE DE DESEMBOLSO — ${modalidade.replace(/_/g, ' ')}`,
    `--------------------------------------------------`,
    `CLIENTE: ${clienteNome || '-'} | CPF: ${clienteCpf || '-'}`,
    `CCB: ${numeroCcb || '-'} (Emitida em ${dataContratacao || '-'})${
      opBaseMatch?.op ? ` | OP: ${opBaseMatch.op}` : ''
    }`,
    `IMÓVEL / LOCALIDADE: ${imovelEstabelecimento || '-'}`,
    `MÊS DE REFERÊNCIA DO CRONOGRAMA: ${mesReferencia}`,
    ``,
    `RESUMO FINANCEIRO:`,
    `- Total do Anexo-Orçamento: R$ ${formatarMoedaBD(valorTotalOrcamento)}`,
    `- Teto Liberável até ${mesReferencia}: R$ ${formatarMoedaBD(
      valorLiberavelAteMesRef
    )}`,
    `- Bloqueado em Parcelas Futuras: R$ ${formatarMoedaBD(
      valorBloqueadoFuturo
    )}`,
    `- Comprovação Financeira: R$ ${formatarMoedaBD(
      valorTotalComprovacaoFinanceira
    )}`,
    `- Total em Notas Fiscais: R$ ${formatarMoedaBD(valorTotalNotasFiscais)}`,
    `- Total em Recibos: R$ ${formatarMoedaBD(valorTotalRecibos)}`,
    ``,
    `ITENS COMPROVADOS:`,
    ...(linhasItensS567.length > 0 ? linhasItensS567 : ['- Conforme NFs anexas']),
    ``,
    `DOCUMENTOS FISCAIS CONFERIDOS:`,
    ...linhasNfsS567,
    ...(docsGta[0]?.dadosGta
      ? [
          `- GTA nº ${docsGta[0].dadosGta.numero} Série ${docsGta[0].dadosGta.serie} (${docsGta[0].dadosGta.dataEmissao} a ${docsGta[0].dadosGta.dataValidade}) — ${docsGta[0].dadosGta.totalAnimais} animais`,
        ]
      : []),
    ``,
    `VEREDITO DA AUDITORIA:`,
    ...checklist.map(
      (c) =>
        `${c.status === 'OK' ? '✅' : c.status === 'ERRO' ? '🚨' : '⚠️'} ${
          c.titulo
        }: ${c.resumo}`
    ),
  ].join('\n');

  return {
    mesReferencia,
    modalidade,
    clienteNome,
    clienteCpf,
    numeroCcb,
    dataContratacao,
    imovelEstabelecimento,
    valorTotalOrcamento,
    valorLiberavelAteMesRef,
    valorBloqueadoFuturo,
    valorTotalComprovacaoFinanceira,
    valorTotalNotasFiscais,
    valorTotalRecibos,
    cronogramaPorMes,
    documentos: docsComVitiVinculado,
    checklist,
    textoResumoS567,
    operacaoPainelVinculada: opBaseMatch
      ? {
          op: opBaseMatch.op,
          valor: opBaseMatch.valor,
          porte: opBaseMatch.porte,
          projetista: opBaseMatch.projetista,
        }
      : contrMatch
      ? {
          op: '',
          valor: contrMatch.valor,
          porte: contrMatch.porte,
          projetista: contrMatch.projetista,
        }
      : undefined,
  };
}