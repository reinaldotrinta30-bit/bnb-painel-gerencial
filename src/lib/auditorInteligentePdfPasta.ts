// src/lib/auditorInteligentePdfPasta.ts
import {
  formatarMoedaBD,
  parseMoeda,
  obterListaProjetistas,
} from '@/lib/utils';
import {
  processarArquivoKmlSocioambiental,
  extrairDadosPdfCertificacaoSocioambiental,
  avaliarConformidadeSocioambientalV98,
} from '@/lib/analisadorSocioambientalKml';

export type NivelStatusAuditoria = 'OK' | 'ALERTA' | 'ERRO' | 'INFO';

export interface ItemDiagnosticoPdf {
  numero: number;
  titulo: string;
  status: NivelStatusAuditoria;
  resumo: string;
  detalhes?: string[];
}

export interface ItemInversaoExtraidoPdf {
  discriminacao: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  valorFinanciado: string;
  empreendimento?: string;
}

export interface ImovelExtraidoProjetoPdf {
  nome: string;
  municipioUf: string;
  areaHa: string;
  realizaInversao: boolean;
  compoeGarantia: boolean;
  valorAvaliado?: string;
}

export interface DadosExtraidosProjetoParecer {
  clienteNome: string;
  clienteCpf: string;
  clienteDataNascimento: string;
  conjugeNome: string;
  conjugeCpf: string;
  conjugeDataNascimento: string;
  procuradorCpfExtraido: string;
  procuradorDataNascimento: string;
  estadoCivil: string;
  porteSugeridoPeloPdf: 'PRONAF_A' | 'PRONAF_V' | 'MINI_PEQUENO' | '';
  modalidadeSugeridaPeloPdf: 'INVESTIMENTO' | 'CUSTEIO' | '';
  denominacaoImovelPa: string;
  municipioImovel: string;
  areaImovelHa: string;
  imoveisVinculados: ImovelExtraidoProjetoPdf[];
  imovelAvaliadoAcima600kDetectado: boolean;
  atividadePrincipal: string;
  programaCredito: string;
  elaboradorNomeCompleto: string;
  elaboradorCpf: string;
  projetistaNomeCurtoDetectado: string;
  valorTotalFinanciado: string;
  valorRecursosProprios: string;
  valorAssessoriaExtraido: string;
  assessoriaRecursosProprios: boolean;
  contaCorrenteExtraida: string;
  procuradorNomeExtraido: string;
  prazoMeses: string;
  carenciaMeses: string;
  periodicidadeReembolso: string;
  taxaJurosAa: string;
  objetivoCurto: string;
  objetivoJustificativaCompleta: string;
  itensInversao: ItemInversaoExtraidoPdf[];
  textoItensInversaoFormatado: string;
}

export interface ResultadoAuditoriaPastaPdf {
  valorPropostaDetectado: string;
  prazoMesesDetectado: string;
  carenciaMesesDetectada: string;
  elaboradorDetectado: string;
  projetistaCurtoDetectado: string;
  objetivoCreditoDetectado: string;
  objetivoJustificativaCompleta: string;
  itensInversaoExtraidos: ItemInversaoExtraidoPdf[];
  textoItensInversaoFormatado: string;
  dadosProjetoParaParecer: DadosExtraidosProjetoParecer;
  contaCorrenteConsolidada: string;
  agenciaConsolidadaDetectada?: string;
  statusContaConsolidada?: 'OK' | 'FALTA' | 'NAO_LIDO';
  paDetectadoNoProjeto: string;
  carEspecificoDetectado: string;
  estadoCivilDetectado: string;
  conjugeDetectadoNosPdfs: string;
  arquivosComAssinaturaDigital: string[];
  arquivosSemAssinaturaDigital: string[];
  reclassificacoesSocioambiental?: Record<
    string,
    'ITEM_CERT_SOCIO_COM_KML' | 'ITEM_CERT_SOCIO_SEM_KML'
  >;
  reclassificacoesPorConteudo?: Record<string, string>;
  imoveisDetectadosNosDocumentos?: string[];
  categoriasComAssinaturaSemViti?: string[];
  kmlCorrigidoAutomaticamente?: {
    nomeArquivo: string;
    conteudoKml: string;
  } | null;
  exigenciasSocioambientaisDetectadas?: string[];
  itensDiagnostico: ItemDiagnosticoPdf[];
}

export const STORAGE_KEY_DADOS_PROJETO_PARECER =
  'bnb_v2_dados_projeto_extraidos_parecer';

export function limparCacheDadosProjetoParecer(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_DADOS_PROJETO_PARECER);
  } catch {
    // Ignora erro
  }
}

export function salvarDadosExtraidosParaParecer(
  dados: DadosExtraidosProjetoParecer
): void {
  if (typeof window === 'undefined') return;
  try {
    const atualRaw = window.localStorage.getItem(
      STORAGE_KEY_DADOS_PROJETO_PARECER
    );
    const mapaBruto: Record<string, DadosExtraidosProjetoParecer> = atualRaw
      ? JSON.parse(atualRaw)
      : {};

    // Mantém apenas os últimos 5 registros no cache local para NUNCA sobrecarregar o localStorage do Kanban!
    const chavesExistentes = Object.keys(mapaBruto).filter(
      (k) => k !== 'ULTIMO_PROJETO_LIDO'
    );
    const mapaEnxuto: Record<string, DadosExtraidosProjetoParecer> = {};
    chavesExistentes.slice(-6).forEach((k) => {
      mapaEnxuto[k] = mapaBruto[k];
    });

    const chaveNome = normalizarSemAcento(dados.clienteNome);
    const chaveCpf = (dados.clienteCpf || '').replace(/\D/g, '');
    if (chaveNome) mapaEnxuto[chaveNome] = dados;
    if (chaveCpf.length >= 9) mapaEnxuto[chaveCpf] = dados;
    mapaEnxuto['ULTIMO_PROJETO_LIDO'] = dados;

    try {
      window.localStorage.setItem(
        STORAGE_KEY_DADOS_PROJETO_PARECER,
        JSON.stringify(mapaEnxuto)
      );
    } catch {
      // Se o localStorage estiver cheio, grava apenas o último projeto lido
      window.localStorage.setItem(
        STORAGE_KEY_DADOS_PROJETO_PARECER,
        JSON.stringify({ ULTIMO_PROJETO_LIDO: dados })
      );
    }

    window.dispatchEvent(
      new CustomEvent('bnb_v2_dados_projeto_parecer_atualizados', {
        detail: dados,
      })
    );
  } catch {
    // Ignora erro
  }
}

export function obterDadosExtraidosParaParecer(
  clienteNomeOuCpf?: string
): DadosExtraidosProjetoParecer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DADOS_PROJETO_PARECER);
    if (!raw) return null;
    const mapa = JSON.parse(raw) as Record<
      string,
      DadosExtraidosProjetoParecer
    >;
    if (clienteNomeOuCpf) {
      const limpoCpf = clienteNomeOuCpf.replace(/\D/g, '');
      if (limpoCpf.length >= 9 && mapa[limpoCpf]) return mapa[limpoCpf];
      const limpoNome = normalizarSemAcento(clienteNomeOuCpf);
      if (limpoNome && mapa[limpoNome]) return mapa[limpoNome];
    }
    return mapa['ULTIMO_PROJETO_LIDO'] || null;
  } catch {
    return null;
  }
}

interface PdfExtraidoInfo {
  categoria: string;
  nomeOriginal: string;
  isViti: boolean;
  textoCompleto: string;
  textoStreamBruto?: string;
  numPaginas: number;
  possuiAssinaturaDigital: boolean;
  ehProvavelEscaneadoImagem: boolean;
}

async function obterPdfJsLib(): Promise<any> {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  if (win.pdfjsLib) return win.pdfjsLib;

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

export function removerAcentos(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarSemAcento(str: string): string {
  return removerAcentos(str)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textoContemTermoFlexivel(
  textoAlvoBruto: string,
  termoBuscaBruto: string
): boolean {
  const textoNorm = normalizarSemAcento(textoAlvoBruto);
  const termoNorm = normalizarSemAcento(termoBuscaBruto)
    .replace(
      /^(P\s*A|ASSENTAMENTO|PROJETO DE ASSENTAMENTO|FAZENDA|SITIO)\s+/i,
      ''
    )
    .trim();

  if (!termoNorm || termoNorm.length < 3) return true;
  if (textoNorm.includes(termoNorm)) return true;

  const palavrasTermo = termoNorm
    .split(/\s+/)
    .filter((p) => p.length > 2 && !['DOS', 'DAS', 'COM', 'POR'].includes(p));

  if (palavrasTermo.length === 0) return true;

  const palavrasTexto = textoNorm.split(/\s+/);
  let acertos = 0;

  for (const pal of palavrasTermo) {
    if (textoNorm.includes(pal)) {
      acertos++;
      continue;
    }
    const similar = palavrasTexto.some((pt) => {
      if (Math.abs(pt.length - pal.length) > 2 || pt.length < 4) return false;
      let difs = 0;
      const minLen = Math.min(pt.length, pal.length);
      for (let i = 0; i < minLen; i++) {
        if (pt[i] !== pal[i]) difs++;
      }
      return difs <= 2;
    });
    if (similar) acertos++;
  }

  return acertos >= Math.ceil(palavrasTermo.length * 0.6);
}

function detectarAssinaturaDigitalNoBinarioPdf(buffer: ArrayBuffer): boolean {
  try {
    const decoder = new TextDecoder('latin1');
    const rawStr = decoder.decode(buffer);
    const temByteRange = /\/ByteRange\s*\[/i.test(rawStr);
    const temSubFilterSig =
      /\/SubFilter\s*\/(adbe\.pkcs7|ETSI\.CAdES|ETSI\.RFC3161)/i.test(rawStr);
    const temMarcadorIcpOuGovBr =
      rawStr.includes('ICP-Brasil') ||
      rawStr.includes('gov.br') ||
      rawStr.includes('Assinado digitalmente') ||
      rawStr.includes('/Type /Sig') ||
      rawStr.includes('/Type/Sig');

    return (
      (temByteRange && temSubFilterSig) ||
      (temByteRange && temMarcadorIcpOuGovBr)
    );
  } catch {
    return false;
  }
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

// ITEM 4: Motor de OCR Óptico Real para PDFs escaneados como imagem!
// Renderiza as páginas do PDF em alta resolução num <canvas> e extrai o texto em Português via Tesseract.js
export async function executarOcrEmPdfEscaneado(
  file: File,
  onProgresso?: (msg: string) => void,
  maxPaginas = 12
): Promise<string> {
  try {
    const [pdfjsLib, Tesseract] = await Promise.all([
      obterPdfJsLib(),
      obterTesseractJs(),
    ]);
    if (!pdfjsLib || !Tesseract) {
      throw new Error('Bibliotecas de OCR não disponíveis.');
    }

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const totalPags = Math.min(pdf.numPages || 1, maxPaginas);
    const textosPaginas: string[] = [];

    for (let p = 1; p <= totalPags; p++) {
      onProgresso?.(
        `🔍 Executando ${p} de ${totalPags} de "${file.name}"...`
      );
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        const result = await Tesseract.recognize(dataUrl, 'por');
        const txtPag = result?.data?.text || '';
        textosPaginas.push(`[PÁG ${p}]\n${txtPag}`);
      }
    }

    return textosPaginas.join('\n\n');
  } catch (err) {
    console.error('Erro durante OCR do PDF:', err);
    return '';
  }
}

async function extrairTextoEAssinaturaDoPdf(
  file: File,
  categoria: string,
  isViti: boolean
): Promise<PdfExtraidoInfo> {
  const buffer = await file.arrayBuffer();
  const possuiAssinaturaDigital = detectarAssinaturaDigitalNoBinarioPdf(buffer);

  let textoCompleto = '';
  let textoStreamBruto = '';
  let numPaginas = 1;

  try {
    const pdfjsLib = await obterPdfJsLib();
    if (pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const pdf = await loadingTask.promise;
      numPaginas = pdf.numPages || 1;

      const limitePags = Math.min(numPaginas, 35);
      const textosPaginasOrdenados: string[] = [];
      const textosPaginasStream: string[] = [];

      for (let p = 1; p <= limitePags; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const rawItems = (content.items || []) as Array<any>;

        // 1. Mantém o stream original da página para buscas de proximidade intra-quadrinho
        const streamPag = rawItems.map((it) => it.str || '').join(' ');
        textosPaginasStream.push(`[PÁG ${p}] ` + streamPag);

        // 2. Reconstrução Espacial por Coordenadas (X, Y) para corrigir PDFs "de baixo para cima" ou em quadrinhos
        const tokensEspaciais: Array<{ str: string; x: number; y: number }> = [];
        for (const it of rawItems) {
          const s = (it.str || '').trim();
          if (!s) continue;
          const tr = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0];
          tokensEspaciais.push({
            str: s,
            x: Number(tr[4]) || 0,
            y: Number(tr[5]) || 0,
          });
        }

        // Agrupa tokens que estão na mesma linha horizontal visual (tolerância de ±3.5 pt no eixo Y)
        // No PDF, Y cresce de baixo para cima, portanto ordenamos Y decrescente (topo -> rodapé)
        tokensEspaciais.sort((a, b) => b.y - a.y || a.x - b.x);

        const linhasVisuais: Array<{ yMedio: number; itens: typeof tokensEspaciais }> = [];
        const TOLERANCIA_Y = 3.5;

        for (const tok of tokensEspaciais) {
          const linhaExistente = linhasVisuais.find(
            (l) => Math.abs(l.yMedio - tok.y) <= TOLERANCIA_Y
          );
          if (linhaExistente) {
            linhaExistente.itens.push(tok);
          } else {
            linhasVisuais.push({ yMedio: tok.y, itens: [tok] });
          }
        }

        // Ordena as linhas de cima para baixo e cada palavra da esquerda para a direita (X crescente)
        linhasVisuais.sort((a, b) => b.yMedio - a.yMedio);
        const textoPagVisual = linhasVisuais
          .map((linha) => {
            linha.itens.sort((a, b) => a.x - b.x);
            return linha.itens.map((i) => i.str).join(' ');
          })
          .join('\n');

        textosPaginasOrdenados.push(`[PÁG ${p}]\n` + textoPagVisual);
      }

      textoCompleto = textosPaginasOrdenados.join('\n');
      textoStreamBruto = textosPaginasStream.join('\n');
    }
  } catch {
    // Ignora erro de parse PDF
  }

  const normTexto = removerAcentos(textoCompleto).toUpperCase();
  const assinaturaPeloTexto =
    normTexto.includes('ASSINADO ELETRONICAMENTE') ||
    normTexto.includes('ASSINADO DIGITALMENTE') ||
    normTexto.includes('VALIDADOR.ITI.GOV.BR') ||
    normTexto.includes('VALIDAR.ITI.GOV.BR') ||
    normTexto.includes('ASSINATURA ELETRONICA AVANCADA') ||
    normTexto.includes('ICP-BRASIL');

  const textoSemMarcadorPag = textoCompleto
    .replace(/\[PÁG \d+\]/g, '')
    .replace(/\s+/g, '')
    .trim();

  const mediaCharsPorPagina =
    numPaginas > 0 ? textoSemMarcadorPag.length / numPaginas : 0;

  return {
    categoria,
    nomeOriginal: file.name,
    isViti,
    textoCompleto,
    textoStreamBruto,
    numPaginas,
    possuiAssinaturaDigital: possuiAssinaturaDigital || assinaturaPeloTexto,
    ehProvavelEscaneadoImagem: mediaCharsPorPagina < 45,
  };
}

// PARTE 7.1: Identificador Semântico de Documentos pelo Conteúdo Interno do PDF (Fingerprinting)
export function identificarCategoriaRealPeloConteudoPdf(params: {
  nomeOriginal: string;
  categoriaAtual: string;
  isVitiAtual: boolean;
  textoExtraido: string;
  titularNome: string;
  conjugeNome: string;
}): {
  categoriaUniversal?: string;
  codigoAuditor?: string;
  isVitiDetectado?: boolean;
} {
  const {
    categoriaAtual,
    isVitiAtual,
    textoExtraido,
    titularNome,
    conjugeNome,
  } = params;

  if (!textoExtraido || textoExtraido.trim().length < 50) {
    return {};
  }

  const tUp = removerAcentos(textoExtraido).toUpperCase();
  const tCabecalho = tUp.substring(0, 4500);
  const nUpNome = removerAcentos(params.nomeOriginal).toUpperCase();

  // 1. Verifica se é EXCLUSIVAMENTE um Relatório de Conformidade do Validador ITI (VITI)
  // (Cuidado: documentos assinados no Gov.br possuem tarja do ITI, mas NÃO são o relatório de conformidade VITI!)
  const ehRelatorioPuroIti =
    tCabecalho.includes('VALIDADOR DE DOCUMENTOS DIGITAIS') &&
    (tCabecalho.includes('RELATORIO DE CONFORMIDADE') ||
      tCabecalho.includes('ARQUIVO(S) COM ASSINATURA(S)')) &&
    !tCabecalho.includes('DECLARACAO CONSOLIDADA') &&
    !tCabecalho.includes('DECLARACOES CONSOLIDADAS') &&
    !tCabecalho.includes('CALCULO DO FINANCIAMENTO') &&
    !tCabecalho.includes('CONTRATO DE PRESTACAO DE SERVICOS');

  if (isVitiAtual || (ehRelatorioPuroIti && /\b(VITI|ITI|VALIDACAO)\b/.test(nUpNome))) {
    return { isVitiDetectado: true };
  }

  // Se o nome do arquivo já identificou com certeza uma categoria específica (ex: Consolidada, Projeto, Orçamento, CAF, etc.),
  // preserva a categoria original e usa o conteúdo apenas para refinar Certificação Socioambiental (COM vs SEM KML),
  // Declarações Ambientais genéricas, Identidades (Titular vs Cônjuge) ou arquivos não identificados (OUTROS)!
  const CATEGORIAS_REFINAVEIS_POR_CONTEUDO = new Set([
    '',
    'OUTROS_NAO_IDENTIFICADO',
    'CAD_9_OUTROS_CADASTRO',
    'ITEM_5_CERT_SOCIOAMBIENTAL',
    'ITEM_CERT_SOCIO_COM_KML',
    'ITEM_CERT_SOCIO_SEM_KML',
    'ITEM_10_DEC_AMBIENTAIS',
    'ITEM_DEC_AMBIENTAIS',
    'ITEM_10_4_OUTRA_DEC_AMBIENTAL',
    'ITEM_DEC_OUTRA_AMBIENTAL',
    'CAD_1_IDENTIDADE_TITULAR',
    'CAD_1_IDENTIDADE_OUTRO',
  ]);

  if (
    categoriaAtual &&
    !CATEGORIAS_REFINAVEIS_POR_CONTEUDO.has(categoriaAtual)
  ) {
    return {};
  }

  const primTit = normalizarSemAcento(titularNome.split(/\s+/)[0] || '');
  const primConj = normalizarSemAcento(conjugeNome.split(/\s+/)[0] || '');
  const pertenceAoConjuge =
    primConj.length >= 3 &&
    tCabecalho.includes(primConj) &&
    (!primTit || !tCabecalho.includes(primTit));

  // 2. Projeto Técnico do BNB (PRONAF / FNE Rural / Custeio / Investimento)
  if (
    (tCabecalho.includes('DADOS CADASTRAIS DO(A) CLIENTE') &&
      (tUp.includes('CALCULO DO FINANCIAMENTO') ||
        tUp.includes('PROGRAMA DE INVESTIMENTOS') ||
        tUp.includes('CRONOGRAMA DE REEMBOLSO'))) ||
    (tCabecalho.includes('BANCO DO NORDESTE') &&
      tUp.includes('SUBTOTAL DO FINANCIAMENTO') &&
      tUp.includes('ELABORADOR:'))
  ) {
    return {
      categoriaUniversal: 'ITEM_PROJETO_PDF',
      codigoAuditor: 'ITEM_12_PROJETO_PDF',
    };
  }

  // 3. Solicitação de Abertura de Limite (LCGH / LCGA)
  if (
    tCabecalho.includes('SOLICITACAO DE ABERTURA DE LIMITE') ||
    tCabecalho.includes('PROPOSTA DE LIMITE DE CREDITO GARANTIDO')
  ) {
    return {
      categoriaUniversal: 'ITEM_SOLICITACAO_LIMITE',
      codigoAuditor: 'ITEM_SOLICITACAO_LIMITE',
    };
  }

  // 4. Certificação Socioambiental (Reconhece "Relatório de Conformidade Socioambiental" e distingue COM KML vs SEM KML)
  if (
    tCabecalho.includes('RELATORIO DE CERTIFICACAO SOCIOAMBIENTAL') ||
    tCabecalho.includes('RELATORIO DE CONFORMIDADE SOCIOAMBIENTAL') ||
    tCabecalho.includes('CONFORMIDADE SOCIOAMBIENTAL') ||
    (tUp.includes('DESMATAMENTO PRODES:') &&
      tUp.includes('SOBREPOSICOES DO CAR:'))
  ) {
    const temGlebas = /NOME(?:\s*DA\s*GLEBA)?:\s*AREA\s*\d+/i.test(tUp);
    return {
      categoriaUniversal: temGlebas
        ? 'ITEM_CERT_SOCIO_COM_KML'
        : 'ITEM_CERT_SOCIO_SEM_KML',
      codigoAuditor: 'ITEM_5_CERT_SOCIOAMBIENTAL',
    };
  }

  // 5. Declarações Consolidadas (PF ou PRONAF)
  if (
    tCabecalho.includes('DECLARACAO CONSOLIDADA') ||
    tCabecalho.includes('DECLARACOES CONSOLIDADAS') ||
    (tUp.includes('AUTORIZACAO PARA DEBITO EM CONTA') &&
      tUp.includes('FINALIDADE DO CREDITO'))
  ) {
    return {
      categoriaUniversal: 'ITEM_CONSOLIDADAS',
      codigoAuditor: 'ITEM_9_CONSOLIDADAS',
    };
  }

  // 6. Contrato de Assessoria Técnica
  if (
    tCabecalho.includes('CONTRATO DE PRESTACAO DE SERVICOS DE ASSESSORIA') ||
    tCabecalho.includes('CONTRATO DE ASSESSORIA TECNICA') ||
    (tCabecalho.includes('CONTRATO PARTICULAR DE PRESTACAO DE SERVICOS') &&
      tUp.includes('PROJETO TECNICO'))
  ) {
    return {
      categoriaUniversal: 'ITEM_CONTRATO_ASSESSORIA',
      codigoAuditor: 'ITEM_8_CONTRATO_ASSESSORIA',
    };
  }

  // 7. Autorização para Alteração de Proposta / Projeto
  if (
    tCabecalho.includes('AUTORIZACAO PARA ALTERACAO DE PROPOSTA') ||
    tCabecalho.includes('AUTORIZACAO DE MODIFICACAO DO PROJETO') ||
    tCabecalho.includes('DECLARACAO DE ALTERACAO DA PROPOSTA')
  ) {
    return {
      categoriaUniversal: 'ITEM_AUT_ALTERACAO',
      codigoAuditor: 'ITEM_2_AUT_ALTERACAO',
    };
  }

  // 8. Declarações Ambientais Específicas (Obrigatórias e Opcionais/Complementares)
  if (tCabecalho.includes('DECLARACAO DE NAO DESMATAMENTO')) {
    return {
      categoriaUniversal: 'ITEM_DEC_NAO_DESMATAMENTO',
      codigoAuditor: 'ITEM_10_2_NAO_DESMATAMENTO',
    };
  }
  if (
    tCabecalho.includes('DECLARACAO DE RECOMPOSICAO') ||
    tCabecalho.includes('TERMO DE COMPROMISSO DE RECOMPOSICAO')
  ) {
    return {
      categoriaUniversal: 'ITEM_DEC_RECOMPOSICAO',
      codigoAuditor: 'ITEM_10_3_RECOMPOSICAO',
    };
  }
  if (
    tCabecalho.includes('REGULARIDADE AMBIENTAL') &&
    tCabecalho.includes('IMOVEL GARANTIDOR')
  ) {
    return {
      categoriaUniversal: 'ITEM_DEC_REG_AMB_GARANTIDOR',
      codigoAuditor: 'ITEM_10_4_OUTRA_DEC_AMBIENTAL',
    };
  }
  if (tCabecalho.includes('DECLARACAO DE REGULARIDADE AMBIENTAL')) {
    return {
      categoriaUniversal: 'ITEM_DEC_REG_AMBIENTAL',
      codigoAuditor: 'ITEM_10_1_REG_AMBIENTAL',
    };
  }
  if (
    tCabecalho.includes('RETIFICACAO DO CAR') ||
    tCabecalho.includes('SOBREPOSICAO DO CAR') ||
    tCabecalho.includes('SOBREPOSICAO DE CAR') ||
    tCabecalho.includes('DECLARACAO DE NAO EXPLORACAO') ||
    tCabecalho.includes('NAO TRABALHO INFANTIL') ||
    tCabecalho.includes('EXPLORACAO DE MAO DE OBRA INFANTIL')
  ) {
    return {
      categoriaUniversal: 'ITEM_DEC_OUTRA_AMBIENTAL',
      codigoAuditor: 'ITEM_10_4_OUTRA_DEC_AMBIENTAL',
    };
  }

  // 9. CAF / DAP vs Extrato Consulta Pública CAF
  if (
    tCabecalho.includes('EXTRATO DA CONSULTA PUBLICA DO CAF') ||
    (tCabecalho.includes('CONSULTA PUBLICA') &&
      tCabecalho.includes('UNIDADE FAMILIAR DE PRODUCAO AGRARIA'))
  ) {
    return {
      categoriaUniversal: 'ITEM_EXTRATO_CAF',
      codigoAuditor: 'ITEM_14_EXTRATO_CAF',
    };
  }
  if (
    tCabecalho.includes('CADASTRO NACIONAL DA AGRICULTURA FAMILIAR') ||
    tCabecalho.includes('EXTRATO DO CAF') ||
    tCabecalho.includes('DECLARACAO DE APTIDAO AO PRONAF')
  ) {
    return {
      categoriaUniversal: 'ITEM_CAF',
      codigoAuditor: 'ITEM_14_CAF',
    };
  }

  // 10. CAR (Recibo vs Demonstrativo)
  if (tCabecalho.includes('DEMONSTRATIVO DA SITUACAO DAS INFORMACOES DECLARADAS NO CAR')) {
    return {
      categoriaUniversal: 'ITEM_CONSULTA_CAR',
      codigoAuditor: 'ITEM_13_CONSULTA_CAR',
    };
  }
  if (tCabecalho.includes('RECIBO DE INSCRICAO DO IMOVEL RURAL NO CAR')) {
    return {
      categoriaUniversal: 'ITEM_CAR',
      codigoAuditor: 'ITEM_13_CAR',
    };
  }

  // 11. DCAA e Parecer SEMA
  if (
    tCabecalho.includes(
      'DECLARACAO DE CONFORMIDADE DE ATIVIDADE AGROPECUARIA'
    ) ||
    tCabecalho.includes('DISPENSA DE LICENCIAMENTO AMBIENTAL')
  ) {
    return {
      categoriaUniversal: 'ITEM_DCAA',
      codigoAuditor: 'ITEM_15_DCAA',
    };
  }
  if (
    tCabecalho.includes('PARECER') &&
    tUp.includes('SECRETARIA DE ESTADO DO MEIO AMBIENTE') &&
    tUp.includes('120/2023')
  ) {
    return {
      categoriaUniversal: 'ITEM_PARECER_SEMA',
      codigoAuditor: 'ITEM_21_PARECER_SEMA',
    };
  }

  // 12. Embargos IBAMA e Improbidade CNJ (Titular vs Cônjuge)
  if (
    tCabecalho.includes('CERTIDAO NEGATIVA DE EMBARGOS') ||
    (tCabecalho.includes('INSTITUTO BRASILEIRO DO MEIO AMBIENTE') &&
      tUp.includes('EMBARGO'))
  ) {
    return pertenceAoConjuge
      ? {
          categoriaUniversal: 'ITEM_EMBARGOS_CONJUGE',
          codigoAuditor: 'ITEM_3_EMBARGOS_CONJUGE',
        }
      : {
          categoriaUniversal: 'ITEM_EMBARGOS_TITULAR',
          codigoAuditor: 'ITEM_3_EMBARGOS_TITULAR',
        };
  }
  if (
    tCabecalho.includes('CONDENACOES CIVEIS POR ATO DE IMPROBIDADE') ||
    (tCabecalho.includes('CONSELHO NACIONAL DE JUSTICA') &&
      tUp.includes('IMPROBIDADE'))
  ) {
    return pertenceAoConjuge
      ? {
          categoriaUniversal: 'ITEM_IMPROBIDADE_CONJUGE',
          codigoAuditor: 'ITEM_4_IMPROBIDADE_CONJUGE',
        }
      : {
          categoriaUniversal: 'ITEM_IMPROBIDADE_TITULAR',
          codigoAuditor: 'ITEM_4_IMPROBIDADE_TITULAR',
        };
  }

  // 13. Certidões Fiscais (CND PF, CND/ITR Imóvel, CNDT, CCIR)
  if (
    tCabecalho.includes('CERTIDAO NEGATIVA DE DEBITOS RELATIVOS A TRIBUTOS FEDERAIS') ||
    tCabecalho.includes('CERTIDAO POSITIVA COM EFEITOS DE NEGATIVA DE DEBITOS RELATIVOS AOS TRIBUTOS FEDERAIS') ||
    tCabecalho.includes('CERTIDAO NEGATIVA DE DEBITOS RELATIVOS AOS TRIBUTOS FEDERAIS')
  ) {
    if (
      tCabecalho.includes('IMOVEL RURAL') ||
      tCabecalho.includes('PROPRIEDADE TERRITORIAL RURAL') ||
      /\bCIB\s*:|\bNIRF\s*:/i.test(tCabecalho)
    ) {
      return {
        categoriaUniversal: 'ITEM_CND_ITR_IMOVEL',
        codigoAuditor: 'ITEM_CND_ITR_IMOVEL',
      };
    }
    return {
      categoriaUniversal: 'ITEM_CND_PF',
      codigoAuditor: 'ITEM_CND_PF',
    };
  }

  if (tCabecalho.includes('CERTIDAO NEGATIVA DE DEBITOS TRABALHISTAS')) {
    return {
      categoriaUniversal: 'ITEM_CNDT_PF',
      codigoAuditor: 'ITEM_CNDT_PF',
    };
  }

  if (tCabecalho.includes('CERTIFICADO DE CADASTRO DE IMOVEL RURAL')) {
    return {
      categoriaUniversal: 'ITEM_CCIR',
      codigoAuditor: 'ITEM_CCIR',
    };
  }

  // 14. Inteiro Teor / Matrícula, Título de Domínio, ECPV, Selo TJMA, Procuração e Casamento
  if (
    tCabecalho.includes('CERTIDAO DE INTEIRO TEOR') ||
    (tCabecalho.includes('REGISTRO DE IMOVEIS') &&
      tUp.includes('LIVRO N 2'))
  ) {
    return {
      categoriaUniversal: 'ITEM_INTEIRO_TEOR',
      codigoAuditor: 'ITEM_INTEIRO_TEOR',
    };
  }

  if (
    tCabecalho.includes('TITULO DE DOMINIO') ||
    tCabecalho.includes('TITULO DEFINITIVO') ||
    (tCabecalho.includes('INSTITUTO NACIONAL DE COLONIZACAO E REFORMA AGRARIA') &&
      tUp.includes('CLAUSULAS RESOLUTIVAS'))
  ) {
    return {
      categoriaUniversal: 'ITEM_TITULO_DOMINIO',
      codigoAuditor: 'ITEM_TITULO_DOMINIO',
    };
  }

  if (
    tCabecalho.includes('ESCRITURA PUBLICA DE COMPRA E VENDA') ||
    tCabecalho.includes('ESCRITURA DE COMPRA E VENDA')
  ) {
    return {
      categoriaUniversal: 'ITEM_ECPV_ESCRITURA',
      codigoAuditor: 'ITEM_ECPV_ESCRITURA',
    };
  }

  if (
    tCabecalho.includes('CONSULTA DE SELO') ||
    (tCabecalho.includes('TRIBUNAL DE JUSTICA') &&
      tCabecalho.includes('SELO DE FISCALIZACAO'))
  ) {
    return {
      categoriaUniversal: 'CAD_8_SELO_CARTORIO',
      codigoAuditor: 'CAD_8_SELO_CARTORIO',
    };
  }

  if (
    tCabecalho.includes('INSTRUMENTO PUBLICO DE PROCURACAO') ||
    (tCabecalho.includes('PROCURACAO PUBLICA') && tUp.includes('OUTORGANTE'))
  ) {
    return {
      categoriaUniversal: 'CAD_6_PROCURACAO',
      codigoAuditor: 'CAD_6_PROCURACAO',
    };
  }

  if (tCabecalho.includes('CERTIDAO DE CASAMENTO')) {
    return {
      categoriaUniversal: 'CAD_2_CERTIDAO_CASAMENTO',
      codigoAuditor: 'CAD_2_CERTIDAO_CASAMENTO',
    };
  }

  // 15. RB do P.A., Espelho da UND, SICOR, CREA e Ficha S400
  if (
    tCabecalho.includes('RELACAO DE BENEFICIARIOS') &&
    tUp.includes('INCRA')
  ) {
    return {
      categoriaUniversal: 'ITEM_RB_PA',
      codigoAuditor: 'ITEM_17_RB_PA',
    };
  }

  if (
    tCabecalho.includes('ESPELHO DO PROJETO') ||
    tCabecalho.includes('RELATORIO DA UND') ||
    (tCabecalho.includes('UNIDADE FAMILIAR') && tUp.includes('MEMBROS'))
  ) {
    return {
      categoriaUniversal: 'ITEM_ESPELHO_UND',
      codigoAuditor: 'ITEM_11_ESPELHO_UND',
    };
  }

  if (
    tCabecalho.includes('SISTEMA DE OPERACOES DO CREDITO RURAL') ||
    (tCabecalho.includes('SICOR') && tCabecalho.includes('BANCO CENTRAL'))
  ) {
    return {
      categoriaUniversal: 'ITEM_EXTRATO_SICOR',
      codigoAuditor: 'ITEM_7_EXTRATO_SICOR',
    };
  }

  if (
    tCabecalho.includes('CONSELHO REGIONAL DE ENGENHARIA') ||
    tCabecalho.includes('CONSELHO FEDERAL DOS TECNICOS AGRICOLAS')
  ) {
    return {
      categoriaUniversal: 'ITEM_CREA',
      codigoAuditor: 'ITEM_6_CREA',
    };
  }

  if (
    tCabecalho.includes('PROPOSTA DE CADASTRO') &&
    !tCabecalho.includes('S400 - CENTRAL DE CADASTRO') &&
    !tCabecalho.includes('DADOS CADASTRAIS DO CLIENTE PESSOA FISICA')
  ) {
    return {
      categoriaUniversal: 'CAD_5_PROPOSTA_CADASTRO',
      codigoAuditor: 'CAD_5_PROPOSTA_CADASTRO',
    };
  }

  // 16. CLASSIFICAÇÃO HÍBRIDA (CONTEÚDO + PISTA DO NOME DO ARQUIVO) PARA IDENTIDADES (RG / CNH / CIN)
  const nUp = removerAcentos(params.nomeOriginal).toUpperCase();
  const pareceIdentidadePeloNome =
    /\b(IDENTIDADE|RG|CNH|CIN|DOC\s+DE\s+IDENTIFICACAO|DOCUMENTO\s+DE\s+IDENTIFICACAO)\b/.test(
      nUp
    );
  const pareceIdentidadePeloConteudo =
    tCabecalho.includes('CARTEIRA NACIONAL DE HABILITACAO') ||
    tCabecalho.includes('REPUBLICA FEDERATIVA DO BRASIL') ||
    tCabecalho.includes('CARTEIRA DE IDENTIDADE') ||
    tCabecalho.includes('SECRETARIA DE ESTADO DA SEGURANCA PUBLICA');

  if (pareceIdentidadePeloNome || pareceIdentidadePeloConteudo) {
    const nomeIndicaConjuge =
      nUp.includes('CONJUGE') ||
      nUp.includes('ESPOSA') ||
      nUp.includes('MARIDO') ||
      nUp.includes('COMPANHEIR') ||
      (primConj.length >= 3 && nUp.includes(primConj));

    const nomeIndicaOutroPessoaDiferenteDoTitular =
      pareceIdentidadePeloNome &&
      primTit.length >= 3 &&
      !nUp.includes(primTit) &&
      /[A-Z]{3,}/.test(
        nUp
          .replace(
            /\b(IDENTIDADE|RG|CNH|CIN|PDF|CADASTRO|ASSINADO|DOC|DOCUMENTO)\b/g,
            ''
          )
          .trim()
      );

    if (
      nomeIndicaConjuge ||
      pertenceAoConjuge ||
      nomeIndicaOutroPessoaDiferenteDoTitular
    ) {
      return {
        categoriaUniversal: 'CAD_1_IDENTIDADE_CONJUGE',
        codigoAuditor: 'CAD_1_IDENTIDADE_CONJUGE',
      };
    }

    return {
      categoriaUniversal: 'CAD_1_IDENTIDADE_TITULAR',
      codigoAuditor: 'CAD_1_IDENTIDADE_TITULAR',
    };
  }

  // Se o arquivo já tinha uma categoria válida atribuída pelo nome do arquivo, preserva-a!
  if (categoriaAtual && categoriaAtual !== 'OUTROS_NAO_IDENTIFICADO') {
    return {};
  }

  return {};
}

export function extrairDadosDetalhadosDoPdfProjeto(
  textoProjeto: string,
  textoStreamBrutoOpcional?: string
): DadosExtraidosProjetoParecer {
  const resultado: DadosExtraidosProjetoParecer = {
    clienteNome: '',
    clienteCpf: '',
    clienteDataNascimento: '',
    conjugeNome: '',
    conjugeCpf: '',
    conjugeDataNascimento: '',
    procuradorCpfExtraido: '',
    procuradorDataNascimento: '',
    estadoCivil: '',
    porteSugeridoPeloPdf: '',
    modalidadeSugeridaPeloPdf: '',
    denominacaoImovelPa: '',
    municipioImovel: '',
    areaImovelHa: '',
    imoveisVinculados: [],
    imovelAvaliadoAcima600kDetectado: false,
    atividadePrincipal: '',
    programaCredito: '',
    elaboradorNomeCompleto: '',
    elaboradorCpf: '',
    projetistaNomeCurtoDetectado: '',
    valorTotalFinanciado: '',
    valorRecursosProprios: '',
    valorAssessoriaExtraido: '',
    assessoriaRecursosProprios: false,
    contaCorrenteExtraida: '',
    procuradorNomeExtraido: '',
    prazoMeses: '',
    carenciaMeses: '',
    periodicidadeReembolso: 'Anual',
    taxaJurosAa: '0,50%',
    objetivoCurto: '',
    objetivoJustificativaCompleta: '',
    itensInversao: [],
    textoItensInversaoFormatado: '',
  };

  if (!textoProjeto || !textoProjeto.trim()) return resultado;

  const textoLimpo = textoProjeto.replace(/\s+/g, ' ');
  const normSemAcento = removerAcentos(textoLimpo).toUpperCase();

  const matchProg = textoLimpo.match(
    /(?:Programa|Fonte de Recursos)\s*:?\s*(FNE\s*\/?\s*[A-ZÀ-Ú0-9\s."'\-()]{4,55}?\(\d{3}\))/i
  );
  if (matchProg && matchProg[1]) {
    resultado.programaCredito = matchProg[1].trim().toUpperCase();
  }

  if (
    normSemAcento.includes('(368)') ||
    normSemAcento.includes('(699)') ||
    normSemAcento.includes('(673)') ||
    normSemAcento.includes('PRONAF GRUPO "A"') ||
    normSemAcento.includes('PRONAFIANO GRUPO A') ||
    normSemAcento.includes('PLANILHA PRONAF A')
  ) {
    resultado.porteSugeridoPeloPdf = 'PRONAF_A';
  } else if (
    normSemAcento.includes('(433)') ||
    normSemAcento.includes('(406)') ||
    normSemAcento.includes('(407)') ||
    normSemAcento.includes('PRONAF - COMUM') ||
    normSemAcento.includes('PRONAF MULHER') ||
    normSemAcento.includes('PRONAF JOVEM')
  ) {
    resultado.porteSugeridoPeloPdf = 'PRONAF_V';
  } else if (
    normSemAcento.includes('(226)') ||
    normSemAcento.includes('FNE /RURAL') ||
    normSemAcento.includes('FNE/RURAL') ||
    normSemAcento.includes('MINI PRODUTOR') ||
    normSemAcento.includes('PEQUENO PRODUTOR')
  ) {
    resultado.porteSugeridoPeloPdf = 'MINI_PEQUENO';
  }

  if (
    normSemAcento.includes('CUSTEIO PECUARIO') ||
    normSemAcento.includes('CUSTEIO AGRICOLA') ||
    normSemAcento.includes('PROPOSTA DE CUSTEIO') ||
    /FINALIDADE(?:\s+DE\s+CREDITO)?\s*:\s*CUSTEIO/i.test(normSemAcento)
  ) {
    resultado.modalidadeSugeridaPeloPdf = 'CUSTEIO';
  } else if (
    normSemAcento.includes('PROGRAMA DE INVESTIMENTOS') ||
    normSemAcento.includes('INVESTIMENTOS FIXOS') ||
    normSemAcento.includes('SUBTOTAL DO INVESTIMENTO')
  ) {
    resultado.modalidadeSugeridaPeloPdf = 'INVESTIMENTO';
  }

  const matchElab =
    textoLimpo.match(
      /(?:Elaborador|Avaliador):\s*([A-ZÀ-Ú\s]{5,65}?)(?:\s+Proposta|\s+C\.?P\.?F|\s+Registro|\s+Data|\s+\[PÁG|$)/i
    ) ||
    textoLimpo.match(
      /30 de [a-zç]+ de 20\d{2}\s+([A-ZÀ-Ú\s]{5,60}?)\s+C\.?P\.?F\.?\s*N?º?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
    );

  if (matchElab && matchElab[1]) {
    resultado.elaboradorNomeCompleto = matchElab[1].trim().toUpperCase();
  }

  const matchCpfElab = textoLimpo.match(
    /(?:Elaborador|Avaliador):[\s\S]{1,80}?C\.?P\.?F\.?\s*:?\s*N?º?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
  );
  if (matchCpfElab && matchCpfElab[1]) {
    resultado.elaboradorCpf = matchCpfElab[1].trim();
  }

  const projetistasCadastrados = obterListaProjetistas();
  const cpfElabDigits = resultado.elaboradorCpf.replace(/\D/g, '');
  const nomeElabNorm = normalizarSemAcento(resultado.elaboradorNomeCompleto);

  const projMatch = projetistasCadastrados.find((p) => {
    const pCpf = (p.cpf || '').replace(/\D/g, '');
    const pComp = normalizarSemAcento(p.nomeCompleto || '');
    const pCurto = normalizarSemAcento(p.nomeCurto || '');
    if (cpfElabDigits.length === 11 && pCpf === cpfElabDigits) return true;
    if (
      nomeElabNorm &&
      pComp &&
      (nomeElabNorm.includes(pComp) || pComp.includes(nomeElabNorm))
    )
      return true;
    if (nomeElabNorm && pCurto && nomeElabNorm.includes(pCurto)) return true;
    return false;
  });

  if (projMatch) {
    resultado.projetistaNomeCurtoDetectado = projMatch.nomeCurto;
  } else if (resultado.elaboradorNomeCompleto) {
    resultado.projetistaNomeCurtoDetectado =
      resultado.elaboradorNomeCompleto.split(/\s+/)[0];
  }

  const textoCombinado =
    textoLimpo + ' \n ' + (textoStreamBrutoOpcional || '').replace(/\s+/g, ' ');

  // Isola o Bloco do Titular ("Dados Cadastrais do(a) Cliente") vs Bloco do Cônjuge ("Cônjuge / Companheira(o) do(a) Cliente")
  const idxBlocoConjuge = textoCombinado.search(
    /(?:Dados\s+Cadastrais\s+)?C[ôo]njuge\s*\/?\s*Companheira\(o\)\s+do\(a\)\s+Cliente/i
  );
  const trechoTitular =
    idxBlocoConjuge !== -1
      ? textoCombinado.substring(0, idxBlocoConjuge)
      : textoCombinado.substring(0, 3500);

  const trechoConjuge =
    idxBlocoConjuge !== -1
      ? textoCombinado.substring(idxBlocoConjuge, idxBlocoConjuge + 1600)
      : '';

  // 1. Estado Civil do Titular
  const matchEstCivil =
    textoCombinado.match(
      /Estado\s+Civil\s*:?\s*(Solteiro\(a\)|Casado\(a\)|Uni[ãa]o\s+Est[áa]vel|Vi[úu]vo\(a\)|Divorciado\(a\)|Separado\(a\))/i
    ) ||
    textoCombinado.match(
      /\b(Casado\(a\)|Uni[ãa]o\s+Est[áa]vel|Solteiro\(a\)|Vi[úu]vo\(a\)|Divorciado\(a\))\b/i
    );
  if (matchEstCivil && matchEstCivil[1]) {
    resultado.estadoCivil = matchEstCivil[1].trim().toUpperCase();
  }

  // 2. Nome, CPF e Data de Nascimento do Titular
  const matchNomeCli =
    trechoTitular.match(
      /Dados\s+Cadastrais\s+do\(a\)\s+Cliente[\s\S]{1,120}?Nome\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,65}?)\s+(?:Apelido|C\.?P\.?F|Data\s+de\s+Nasc|Sexo)/i
    ) ||
    trechoTitular.match(
      /Proponente\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,65}?)\s+(?:CPF|C\.?P\.?F)/i
    );
  if (matchNomeCli && matchNomeCli[1]) {
    resultado.clienteNome = matchNomeCli[1].trim().toUpperCase();
  }

  const matchCpfCli = trechoTitular.match(
    /C\.?P\.?F\.?\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
  );
  if (matchCpfCli && matchCpfCli[1]) {
    resultado.clienteCpf = matchCpfCli[1].trim();
  }

  const matchNascCli =
    trechoTitular.match(
      /Data\s+de\s+Nascimento\s*:?\s*(?:Sexo\s*:?\s*[A-Za-z]+\s*)?(\d{2}\/\d{2}\/(?:19\d{2}|20[01]\d))/i
    ) ||
    trechoTitular.match(/\b(\d{2}\/\d{2}\/(?:19[3-9]\d|200\d))\b/);
  if (matchNascCli && matchNascCli[1]) {
    resultado.clienteDataNascimento = matchNascCli[1].trim();
  }

  // 3. Quadro "Dados Cadastrais Cônjuge / Companheira(o) do(a) Cliente": Nome, CPF e Data de Nascimento
  if (trechoConjuge) {
    // Limpa até o próximo quadro ("Dados da Propriedade" / "Imóveis" / "Referências" / "Fonte de Recursos")
    const fimQuadroConj = trechoConjuge.search(
      /(?:Denomina[çc][ãa]o\s+do\s+im[óo]vel|Dados\s+do\s+Im[óo]vel|Im[óo]veis\s+Vinculados|Programa\s*:|Fonte\s+de\s+Recursos| Experi[êe]ncia\s+na\s+Atividade)/i
    );
    const blocoConjIsolado =
      fimQuadroConj !== -1
        ? trechoConjuge.substring(0, fimQuadroConj)
        : trechoConjuge.substring(0, 750);

    // Extrai CPF do Cônjuge (suporta quadrinhos onde o CPF vem separado do rótulo)
    const matchCpfConj =
      blocoConjIsolado.match(
        /C\.?P\.?F\.?\s*(?:C[ôo]njuge\/Comp\.?)?\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
      ) ||
      blocoConjIsolado.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);

    if (matchCpfConj && matchCpfConj[1]) {
      const cpfCand = matchCpfConj[1].trim();
      if (
        cpfCand.replace(/\D/g, '') !== resultado.clienteCpf.replace(/\D/g, '')
      ) {
        resultado.conjugeCpf = cpfCand;
      }
    }

    // Extrai Nome do Cônjuge (linear ou em quadrinhos)
    const matchNomeConj =
      blocoConjIsolado.match(
        /Nome\s*:?\s*(?:C\.?P\.?F\.?\s*C[ôo]njuge\/Comp\.?\s*:?\s*)?([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,60}?)(?:\s+C\.?P\.?F|\s+\d{3}\.?\d{3}|\s+Data\s+de\s+Nasc|\s+Sexo|\s+RG|\s+Nacionalidade|\s+Naturalidade|$)/i
      ) ||
      blocoConjIsolado.match(
        /Companheira\(o\)\s+do\(a\)\s+Cliente[\s\S]{1,90}?([A-ZÀ-Ú]{3,}(?:\s+[A-ZÀ-Ú]{2,}){1,6})/
      );

    if (matchNomeConj && matchNomeConj[1]) {
      const candConj = matchNomeConj[1]
        .replace(
          /\b(?:DADOS|NOME|CPF|CONJUGE|COMPANHEIRA|CLIENTE|DATA|NASCIMENTO|SEXO|FEMININO|MASCULINO|RG|ORGAO|EXPEDIDOR)\b/gi,
          ''
        )
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

      if (
        candConj.length >= 5 &&
        candConj !== resultado.clienteNome &&
        !candConj.includes('SOLTEIR')
      ) {
        resultado.conjugeNome = candConj;
      }
    }

    // Extrai Data de Nascimento do Cônjuge
    const matchNascConj =
      blocoConjIsolado.match(
        /Data\s+de\s+Nascimento\s*:?\s*(?:Sexo\s*:?\s*[A-Za-z]+\s*)?(\d{2}\/\d{2}\/(?:19\d{2}|20[01]\d))/i
      ) ||
      blocoConjIsolado.match(/\b(\d{2}\/\d{2}\/(?:19[3-9]\d|200\d))\b/);

    if (matchNascConj && matchNascConj[1]) {
      resultado.conjugeDataNascimento = matchNascConj[1].trim();
    }
  }

  const matchDenom = textoLimpo.match(
    /Denomina[çc][ãa]o\s+do\s+im[óo]vel:\s*([A-ZÀ-Ú0-9\s.\-]{3,50}?)\s+[ÁA]rea\s+do\s+im[óo]vel\s*\(ha\):\s*([0-9.,]+)/i
  );
  if (matchDenom) {
    resultado.denominacaoImovelPa = matchDenom[1].trim().toUpperCase();
    resultado.areaImovelHa = matchDenom[2].trim();
  }

  // Extrai Município do Imóvel e Atividade Principal do Projeto para cruzar com o S400 (Item 2 V98)
  const matchMunImovel =
    textoLimpo.match(
      /Munic[íi]pio(?:\s+do\s+im[óo]vel|-UF)?\s*:\s*([A-ZÀ-Ú\s]+-[A-Z]{2})/i
    ) || textoLimpo.match(/\b([A-ZÀ-Ú\s]{3,30}-MA)\b/);
  if (matchMunImovel && matchMunImovel[1]) {
    resultado.municipioImovel = matchMunImovel[1].trim().toUpperCase();
  }

  const matchAtivPrinc = textoLimpo.match(
    /Atividade(?:\s+Principal)?\s*:\s*([A-Za-zÀ-ú\s\-()/]{5,80}?)(?:\s+Renda\s+Mensal|\s+Munic[íi]pio|\s+\d{11}|$)/i
  );
  if (matchAtivPrinc && matchAtivPrinc[1]) {
    resultado.atividadePrincipal = matchAtivPrinc[1]
      .split('(')[0]
      .replace(/\d+/g, '')
      .trim()
      .toUpperCase();
  }

  const regexImoveisVinculados =
    /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.\-]{3,45}?)\s+([A-ZÀ-Ú\s]+-[A-Z]{2})\s+P\.?\s*F[ií]sica\s+[A-ZÀ-Ú\s]{4,50}?\s+\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s+(\d+(?:[.,]\d+)?)\s+(Sim|N[ãa]o)\s+(Sim|N[ãa]o)/gi;

  let mImo: RegExpExecArray | null;
  while ((mImo = regexImoveisVinculados.exec(textoLimpo)) !== null) {
    const nomeImo = mImo[1]
      .replace(/^(?:Comp[õo]e\s+Garantia\??|Realiza\s+Invers[ãa]o\??)\s+/i, '')
      .trim()
      .toUpperCase();
    const munUf = mImo[2].trim().toUpperCase();
    const area = mImo[3].trim();
    const realizaInv = mImo[4].toUpperCase().startsWith('S');
    const compoeGar = mImo[5].toUpperCase().startsWith('S');

    if (
      nomeImo &&
      !resultado.imoveisVinculados.some((x) => x.nome === nomeImo)
    ) {
      resultado.imoveisVinculados.push({
        nome: nomeImo,
        municipioUf: munUf,
        areaHa: area,
        realizaInversao: realizaInv,
        compoeGarantia: compoeGar,
      });
    }
  }

  if (
    resultado.imoveisVinculados.length === 0 &&
    resultado.denominacaoImovelPa
  ) {
    resultado.imoveisVinculados.push({
      nome: resultado.denominacaoImovelPa,
      municipioUf: resultado.municipioImovel || '',
      areaHa: resultado.areaImovelHa || '',
      realizaInversao: true,
      compoeGarantia: false,
    });
  }

  const matchSubtotalAval = textoLimpo.match(
    /Subtotal\s+Avalia[çc][ãa]o\s+do\s+Im[óo]vel[^0-9]{1,40}(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi
  );
  if (matchSubtotalAval) {
    for (const mAv of matchSubtotalAval) {
      const numAv = parseMoeda(
        (mAv.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})$/) || [])[1] || '0'
      );
      if (numAv >= 600000) {
        resultado.imovelAvaliadoAcima600kDetectado = true;
      }
    }
  }

  // =========================================================================
  // MOTOR MULTI-ESTÁGIO PARA PRAZO, CARÊNCIA E JUROS (QUADRINHOS E TABELAS)
  // =========================================================================
  const idxCalcFin = normSemAcento.indexOf('CALCULO DO FINANCIAMENTO');
  const trechoFin =
    idxCalcFin !== -1
      ? normSemAcento.substring(idxCalcFin, idxCalcFin + 1400)
      : normSemAcento;

  // Estágio 1: Padrão clássico de linha única ou colunar
  const matchBlocoTabelaFin =
    trechoFin.match(
      /\b(12|18|24|36|48|60|72|84|96|108|120|144)\s+(ANUAL|MENSAL|SEMESTRAL)\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d{4,7}(?:[.,]\d{2})?)\s+(?:CARENCIA:\s+)?(?:JUROS\s*\(A\.A\.\):\s*)?(\d{1,2})\s+([0-9.,]+%)/i
    ) ||
    trechoFin.match(
      /PRAZO\s*(?:\(MESES\))?\s*:?\s*(\d{2,3})[\s\S]{1,120}?CARENCIA\s*(?:\(MESES\))?\s*:?\s*(\d{1,2})/i
    );

  if (matchBlocoTabelaFin) {
    if (matchBlocoTabelaFin.length >= 6 && matchBlocoTabelaFin[4]) {
      resultado.prazoMeses = matchBlocoTabelaFin[1];
      resultado.periodicidadeReembolso = matchBlocoTabelaFin[2];
      resultado.carenciaMeses = matchBlocoTabelaFin[4];
      resultado.taxaJurosAa = matchBlocoTabelaFin[5];
    } else {
      resultado.prazoMeses = matchBlocoTabelaFin[1];
      resultado.carenciaMeses = matchBlocoTabelaFin[2];
    }
  }

  // Estágio 2: Quando "Prazo:" e "Carência:" estão em quadrinhos invertidos (valor acima ou abaixo do rótulo)
  if (!resultado.prazoMeses) {
    const mPrazo =
      trechoFin.match(
        /(?:PRAZO\s*(?:TOTAL|DE\s+REEMBOLSO|\(MESES\))?\s*:?\s*)(\d{2,3})\s*(?:MESES)?\b/i
      ) ||
      trechoFin.match(
        /\b(144|120|108|96|84|72|60|48|36|24|12)\s+(?:ANUAL|MENSAL|SEMESTRAL)\b/i
      ) ||
      normSemAcento.match(
        /PRAZO\s+TOTAL\s*:?\s*(\d{2,3})\s*MESES/i
      ) ||
      normSemAcento.match(
        /\b(120|96|84|72|60)\s*MESES\b/i
      );
    if (mPrazo && mPrazo[1]) {
      resultado.prazoMeses = mPrazo[1];
    } else {
      // Verifica se o prazo foi expresso em ANOS (ex: "10 anos")
      const mPrazoAnos = trechoFin.match(/PRAZO\s*:?\s*(\d{1,2})\s*ANOS\b/i);
      if (mPrazoAnos && mPrazoAnos[1]) {
        resultado.prazoMeses = String(Number(mPrazoAnos[1]) * 12);
      }
    }
  }

  if (!resultado.carenciaMeses) {
    const mCarencia =
      trechoFin.match(
        /CARENCIA\s*(?:\(MESES\))?\s*:?\s*(?:JUROS\s*\(A\.A\.\)\s*:?\s*)?\b(0|6|12|18|24|36|48|60)\b/i
      ) ||
      trechoFin.match(
        /\b(48|36|24|12|6|0)\s+[0-9]{1,2}[.,][0-9]{2}\s*%/i
      ) ||
      normSemAcento.match(
        /CARENCIA\s*:?\s*(\d{1,2})\s*MESES/i
      );
    if (mCarencia && mCarencia[1]) {
      resultado.carenciaMeses = mCarencia[1];
    } else {
      const mCarAnos = trechoFin.match(/CARENCIA\s*:?\s*(\d{1})\s*ANOS?\b/i);
      if (mCarAnos && mCarAnos[1]) {
        resultado.carenciaMeses = String(Number(mCarAnos[1]) * 12);
      }
    }
  }

  // Fallback padrão PRONAF A se identificou porte PRONAF A e não achou prazo/carência explícitos
  if (resultado.porteSugeridoPeloPdf === 'PRONAF_A') {
    if (!resultado.prazoMeses) resultado.prazoMeses = '120';
    if (!resultado.carenciaMeses) resultado.carenciaMeses = '36';
  }

  const matchObjCurto =
    textoLimpo.match(
      /Objetivo\s+do\s+Cr[ée]dito\s*:?\s*(?:\d{2}\/\d{2}\/\d{4}\s+)?(Amplia[çc][ãa]o|Implanta[çc][ãa]o|Moderniza[çc][ãa]o|Reforma|Custeio|Manuten[çc][ãa]o|Expans[ãa]o)/i
    ) ||
    textoLimpo.match(
      /(?:\d{2}\/\d{2}\/\d{4})\s+(Amplia[çc][ãa]o|Implanta[çc][ãa]o|Moderniza[çc][ãa]o|Reforma|Custeio)\s+Objetivo\s+do\s+Cr[ée]dito/i
    );
  if (matchObjCurto && matchObjCurto[1]) {
    resultado.objetivoCurto = matchObjCurto[1].trim().toUpperCase();
  }

  const matchJustificativa = textoLimpo.match(
    /Coment[áa]rios\s*\/\s*Objetivos\s*\/\s*Justificativas\s+([\s\S]{15,900}?)(?:DECLARA[ÇC][ÕO]ES|Declaro,\s+para\s+todos\s+os\s+fins)/i
  );
  if (matchJustificativa && matchJustificativa[1]) {
    resultado.objetivoJustificativaCompleta = matchJustificativa[1]
      .replace(/\[PÁG \d+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // =========================================================================
  // MOTOR DE EXTRAÇÃO DE ITENS DE INVERSÃO (POR LINHAS ESPACIAIS X,Y + REGEX)
  // =========================================================================
  const adicionarItemUnico = (itemCand: ItemInversaoExtraidoPdf) => {
    const discLimpa = itemCand.discriminacao
      .replace(
        /^(?:Investimento\s+Total|Valor\s+Financiam\.|Programa\s+de\s+Investimentos|Comp[õo]e\s+Garantia\??|Discrimina[çc][ãa]o|Or[çc]amento|Unid\.|Quant\.|Valor\s+Unit\.?)\s+/gi,
        ''
      )
      .replace(/^\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s+/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    if (
      discLimpa.length < 4 ||
      discLimpa.includes('SUBTOTAL') ||
      discLimpa.includes('TOTAL FINANCIADO') ||
      discLimpa.includes('CUSTO DE ASSESSORIA') ||
      discLimpa.includes('DISCRIMINACAO') ||
      discLimpa.startsWith('PAG ')
    ) {
      return;
    }

    const chave = `${discLimpa}_${itemCand.valorFinanciado}`;
    const jaExiste = resultado.itensInversao.some(
      (x) => `${x.discriminacao}_${x.valorFinanciado}` === chave
    );
    if (!jaExiste) {
      resultado.itensInversao.push({
        ...itemCand,
        discriminacao: discLimpa,
      });
    }
  };

  // Estágio A: Varredura linha a linha nas linhas reconstruídas por coordenadas (X, Y)
  const linhasReconstruidas = textoProjeto.split(/\r?\n/);
  const regexLinhaEspacialItem =
    /^([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.,\/\-º°()]{4,95}?)\s+(?:(?:Sim|N[ãa]o)\s+)?(\d+(?:[.,]\d+)?)\s+(Ha|Hectares?|Unidade|Unid\.?|Und\.?|UA|Cab\.?|Cabe[çc]as?|m|m2|m²|m3|m³|km|vb|Verba|Conjunto|Conj\.?|Serv\.?|Servi[çc]o|Ton\.?|kg|lt|sc|Sacos?|M[êe]s|Meses)\b.*?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s+)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})(?:\s+\d{1,3}(?:[.,]\d{3})*[.,]\d{2})?$/i;

  for (const linhaBruta of linhasReconstruidas) {
    const l = linhaBruta.replace(/\[PÁG \d+\]/g, '').trim();
    if (l.length < 15) continue;
    const mEsp = l.match(regexLinhaEspacialItem);
    if (mEsp) {
      adicionarItemUnico({
        discriminacao: mEsp[1],
        quantidade: mEsp[2].replace('.', ','),
        unidade: mEsp[3].trim(),
        valorUnitario: mEsp[4].replace(/\.(?=\d{2}$)/, ','),
        valorFinanciado: mEsp[5].replace(/\.(?=\d{2}$)/, ','),
      });
    }
  }

  // Estágio B: Fallback com Regex Global no stream contínuo (caso itens estejam colados na mesma linha)
  const regexItensPag4 =
    /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.,\/\-º°]{5,85}?)\s+(?:N[ãa]o|Sim)\s+(\d+(?:[.,]\d+)?)\s+(Ha|Unidade|unid|und|UA|Cab|Cabe[çc]a|m|m2|m³|km|vb|Verba|Conjunto)\s+(?:Cobertura\s+do\s+Solo|Semovente\s*s?|Edifica[çc][õo]es|M[áa]quinas|Instala[çc][õo]es|Outros|[A-Za-zÀ-ú\s]+?)\s+\d+\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s+)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;

  let mItem: RegExpExecArray | null;
  while ((mItem = regexItensPag4.exec(textoLimpo)) !== null) {
    adicionarItemUnico({
      discriminacao: mItem[1],
      quantidade: mItem[2].replace('.', ','),
      unidade: mItem[3].trim(),
      valorUnitario: mItem[4].replace(/\.(?=\d{2}$)/, ','),
      valorFinanciado: mItem[5].replace(/\.(?=\d{2}$)/, ','),
    });
  }

  if (resultado.itensInversao.length > 0) {
    resultado.textoItensInversaoFormatado = resultado.itensInversao
      .map(
        (it) =>
          `- ${it.quantidade} ${it.unidade} de ${it.discriminacao}: R$ ${it.valorFinanciado}`
      )
      .join('\n');
  }

  const valExtraido = extrairValorMonetarioPrincipal(textoLimpo);
  if (valExtraido > 0) {
    resultado.valorTotalFinanciado = formatarMoedaBD(valExtraido);
  }

  // Extração automática de Recursos Próprios e Custo de Assessoria Empresarial e Técnica (Página 4 do Projeto)
  const matchLinhaAssessoria = textoLimpo.match(
    /Custo\s+de\s+Assessoria\s+Empresarial\s+e\s+T[ée]cnica[\s\S]{1,60}?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(?:(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i
  );
  if (matchLinhaAssessoria) {
    const vAssBase = parseMoeda(
      matchLinhaAssessoria[1].replace(/\.(?=\d{2}$)/, ',')
    );
    const vRecPropAss = matchLinhaAssessoria[2]
      ? parseMoeda(matchLinhaAssessoria[2].replace(/\.(?=\d{2}$)/, ','))
      : 0;
    const vFinancAss = parseMoeda(
      matchLinhaAssessoria[3].replace(/\.(?=\d{2}$)/, ',')
    );

    if (vAssBase > 0) {
      resultado.valorAssessoriaExtraido = formatarMoedaBD(vAssBase);
      if (vRecPropAss > 0 || vFinancAss === 0) {
        resultado.assessoriaRecursosProprios = true;
        resultado.valorRecursosProprios = formatarMoedaBD(
          vRecPropAss > 0 ? vRecPropAss : vAssBase
        );
      }
    }
  }

  // Fallback: Verifica a linha TOTAL ou SUBTOTAL do Investimento (Colunas: Recursos Próprios | Valor Financiam. | Investimento Total)
  if (!resultado.valorRecursosProprios) {
    const matchTotalRecProp = textoLimpo.match(
      /(?:SUBTOTAL\s+do\s+Financiamento|TOTAL)[\s.:\-]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i
    );
    if (matchTotalRecProp) {
      const recPropNum = parseMoeda(
        matchTotalRecProp[1].replace(/\.(?=\d{2}$)/, ',')
      );
      const valFinNum = parseMoeda(
        matchTotalRecProp[2].replace(/\.(?=\d{2}$)/, ',')
      );
      const invTotNum = parseMoeda(
        matchTotalRecProp[3].replace(/\.(?=\d{2}$)/, ',')
      );
      if (
        recPropNum > 0 &&
        recPropNum < valFinNum &&
        Math.abs(recPropNum + valFinNum - invTotNum) <= 5
      ) {
        resultado.valorRecursosProprios = formatarMoedaBD(recPropNum);
        resultado.valorAssessoriaExtraido =
          resultado.valorAssessoriaExtraido || formatarMoedaBD(recPropNum);
        resultado.assessoriaRecursosProprios = true;
      }
    }
  }

  return resultado;
}

function extrairValorMonetarioPrincipal(texto: string): number {
  const norm = removerAcentos(texto).toUpperCase();

  const padroesPrioritarios = [
    /TOTAL\s+FINANCIADO\s*:\s*R\$\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi,
    /SUBTOTAL\s+DO\s+FINANCIAMENTO[\s.:\-]*0[.,]00\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi,
    /INVESTIMENTO\s+TOTAL\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi,
    /(?:VALOR\s+DO\s+FINANCIAMENTO|VALOR\s+SOLICITADO|VALOR\s+TOTAL\s+DO\s+PROJETO|VALOR\s+DO\s+LIMITE|TOTAL\s+GERAL|TOTAL\s+DO\s+ORCAMENTO)[^0-9]{0,45}(?:R\$\s*)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi,
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
  ];

  for (const regex of padroesPrioritarios) {
    const candidatos: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(norm)) !== null) {
      const strVal = m[1].replace(/\.(?=\d{2}$)/, ',');
      const val = parseMoeda(strVal);
      if (val >= 2000 && val <= 5000000) {
        candidatos.push(val);
      }
    }
    if (candidatos.length > 0) {
      return candidatos[0];
    }
  }

  return 0;
}

function extrairCodigosReciboCar(texto: string): string[] {
  const matches =
    texto.match(
      /\b[A-Z]{2}-\d{7}-[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\b/gi
    ) || [];
  return Array.from(
    new Set(matches.map((m) => m.replace(/\./g, '').toUpperCase()))
  );
}

export async function executarAuditoriaCompletaDosPdfsDaPasta(params: {
  arquivos: Array<{
    fileObj: File;
    categoria: string;
    isViti: boolean;
    nomeOriginal: string;
  }>;
  titularNome: string;
  conjugeNome: string;
  paEsperado: string;
  contaConformidade?: string;
  porteSelecionado?: 'PRONAF_A' | 'PRONAF_V' | 'MINI_PEQUENO';
  escopoSelecionado?: string;
  modalidadeDerivada?: 'INVESTIMENTO' | 'CUSTEIO';
  modalidadeLimite?: 'LCGH' | 'LCGA';
  textosOcrOverride?: Record<string, string>;
}): Promise<ResultadoAuditoriaPastaPdf> {
  const {
    arquivos,
    titularNome,
    conjugeNome,
    paEsperado,
    contaConformidade,
    porteSelecionado = 'PRONAF_A',
    escopoSelecionado = 'PRONAF_A_PADRAO',
    modalidadeDerivada = 'INVESTIMENTO',
  } = params;

  const isPronafA = porteSelecionado === 'PRONAF_A';
  const isPronafV = porteSelecionado === 'PRONAF_V';
  const isMiniPequeno = porteSelecionado === 'MINI_PEQUENO';
  const isSomenteLimite = escopoSelecionado === 'LIMITE_PURO';

  // Ordena todos os PDFs do mais recente para o mais antigo (lastModified decrescente)
  // Assim, quando houver mais de uma CND, CNDT, Embargos, Improbidade, Consulta CAR, S400, etc.,
  // o sistema sempre audita a versão mais recente!
  const pdfsParaLer = [...arquivos]
    .filter(
      (a) =>
        a.categoria !== 'IGNORAR' &&
        a.fileObj.name.toLowerCase().endsWith('.pdf')
    )
    .sort((a, b) => (b.fileObj.lastModified || 0) - (a.fileObj.lastModified || 0));

  const extraidos: PdfExtraidoInfo[] = [];
  const reclassificacoesPorConteudo: Record<string, string> = {};

  const mapaOcr = params.textosOcrOverride || {};

  for (const item of pdfsParaLer) {
    const info = await extrairTextoEAssinaturaDoPdf(
      item.fileObj,
      item.categoria,
      item.isViti
    );

    // ITEM 4: Se este arquivo escaneado já passou pelo OCR na Lupinha, injeta o texto extraído pelo OCR!
    const textoOcrSalvo = mapaOcr[item.nomeOriginal];
    if (textoOcrSalvo && textoOcrSalvo.trim().length > 40) {
      info.textoCompleto = textoOcrSalvo;
      info.textoStreamBruto = textoOcrSalvo;
      info.ehProvavelEscaneadoImagem = false;
    }

    // PARTE 7.1: Identifica o documento pelo conteúdo interno do PDF mesmo que o nome esteja bagunçado!
    const idConteudo = identificarCategoriaRealPeloConteudoPdf({
      nomeOriginal: item.nomeOriginal,
      categoriaAtual: item.categoria,
      isVitiAtual: item.isViti,
      textoExtraido: info.textoCompleto + '\n' + (info.textoStreamBruto || ''),
      titularNome,
      conjugeNome,
    });

    if (idConteudo.isVitiDetectado) {
      info.isViti = true;
    }
    if (idConteudo.codigoAuditor && !info.isViti) {
      info.categoria = idConteudo.codigoAuditor;
    }
    if (idConteudo.categoriaUniversal && !info.isViti) {
      reclassificacoesPorConteudo[item.nomeOriginal] =
        idConteudo.categoriaUniversal;
    }

    extraidos.push(info);
  }

  const obterPorCat = (cat: string, isViti = false) =>
    extraidos.find((e) => e.categoria === cat && e.isViti === isViti);

  const pdfConsolidada = obterPorCat('ITEM_9_CONSOLIDADAS', false);
  const pdfProjeto = obterPorCat('ITEM_12_PROJETO_PDF', false);
  const pdfOrcamento = obterPorCat('ITEM_18_ORCAMENTO', false);
  const pdfEspelho = obterPorCat('ITEM_11_ESPELHO_UND', false);
  const pdfCaf = obterPorCat('ITEM_14_CAF', false);
  const pdfCar = obterPorCat('ITEM_13_CAR', false);
  const pdfConsultaCar = obterPorCat('ITEM_13_CONSULTA_CAR', false);
  const pdfRb = obterPorCat('ITEM_17_RB_PA', false);
  const pdfSolicitacaoLim = obterPorCat('ITEM_SOLICITACAO_LIMITE', false);
  const pdfProcuracao = obterPorCat('CAD_6_PROCURACAO', false);
  const pdfCasamento = obterPorCat('CAD_2_CERTIDAO_CASAMENTO', false);
  const dadosProjetoParaParecer = extrairDadosDetalhadosDoPdfProjeto(
    (pdfProjeto?.textoCompleto || '') +
      '\n' +
      (pdfSolicitacaoLim?.textoCompleto || ''),
    (pdfProjeto?.textoStreamBruto || '') +
      '\n' +
      (pdfSolicitacaoLim?.textoStreamBruto || '')
  );
  if (titularNome && !dadosProjetoParaParecer.clienteNome) {
    dadosProjetoParaParecer.clienteNome = titularNome;
  }

  const conjugeEfetivo =
    conjugeNome.trim() || dadosProjetoParaParecer.conjugeNome || '';

  // Se houver um 2º arquivo de Identidade na pasta (ou uma Identidade cujo nome não é o do Titular)
  // e ainda não havia sido marcado como CAD_1_IDENTIDADE_CONJUGE, promove-o automaticamente!
  const todosPdfsIdentidade = extraidos.filter(
    (e) =>
      !e.isViti &&
      (e.categoria === 'CAD_1_IDENTIDADE_TITULAR' ||
        e.categoria === 'CAD_1_IDENTIDADE_CONJUGE' ||
        e.categoria === 'CAD_1_IDENTIDADE_OUTRO' ||
        /\b(IDENTIDADE|RG|CNH|CIN)\b/i.test(e.nomeOriginal))
  );

  const primTitNorm = normalizarSemAcento(
    (dadosProjetoParaParecer.clienteNome || titularNome).split(/\s+/)[0] || ''
  );
  const primConjNorm = normalizarSemAcento(
    conjugeEfetivo.split(/\s+/)[0] || ''
  );

  for (const docId of todosPdfsIdentidade) {
    const nUp = normalizarSemAcento(docId.nomeOriginal);
    const tUp = normalizarSemAcento(docId.textoCompleto);
    if (
      (primConjNorm.length >= 3 &&
        (nUp.includes(primConjNorm) || tUp.includes(primConjNorm))) ||
      (primTitNorm.length >= 3 &&
        !nUp.includes(primTitNorm) &&
        todosPdfsIdentidade.length >= 2)
    ) {
      docId.categoria = 'CAD_1_IDENTIDADE_CONJUGE';
      reclassificacoesPorConteudo[docId.nomeOriginal] =
        'CAD_1_IDENTIDADE_CONJUGE';
    }
  }

  const pdfIdTitular = obterPorCat('CAD_1_IDENTIDADE_TITULAR', false);
  const pdfIdConjuge = obterPorCat('CAD_1_IDENTIDADE_CONJUGE', false);
  const pdfIdOutro = obterPorCat('CAD_1_IDENTIDADE_OUTRO', false);

  // Fallback de Datas de Nascimento (para consulta de CND na Receita Federal) a partir dos PDFs de Identidade, CAF e Procuração
  const extrairDataNascDeDoc = (txt: string): string => {
    if (!txt) return '';
    const m =
      txt.match(
        /(?:NASCIMENTO|DATA\s+DE\s+NASC\.?|NASC\.?)\s*:?\s*(\d{2}\/\d{2}\/(?:19[2-9]\d|200\d))/i
      ) || txt.match(/\b(\d{2}\/\d{2}\/(?:19[3-9]\d|200\d))\b/);
    return m && m[1] ? m[1] : '';
  };

  if (!dadosProjetoParaParecer.clienteDataNascimento) {
    dadosProjetoParaParecer.clienteDataNascimento =
      extrairDataNascDeDoc(pdfIdTitular?.textoCompleto || '') ||
      extrairDataNascDeDoc(pdfCaf?.textoCompleto || '') ||
      extrairDataNascDeDoc(pdfEspelho?.textoCompleto || '');
  }

  if (!dadosProjetoParaParecer.conjugeDataNascimento) {
    dadosProjetoParaParecer.conjugeDataNascimento =
      extrairDataNascDeDoc(pdfIdConjuge?.textoCompleto || '') ||
      extrairDataNascDeDoc(pdfCasamento?.textoCompleto || '');
  }

  if (pdfIdOutro || pdfProcuracao) {
    const txtProc =
      (pdfIdOutro?.textoCompleto || '') +
      '\n' +
      (pdfProcuracao?.textoCompleto || '');
    if (!dadosProjetoParaParecer.procuradorDataNascimento) {
      dadosProjetoParaParecer.procuradorDataNascimento =
        extrairDataNascDeDoc(txtProc);
    }
    const mCpfProc = txtProc.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);
    if (mCpfProc && !dadosProjetoParaParecer.procuradorCpfExtraido) {
      dadosProjetoParaParecer.procuradorCpfExtraido = mCpfProc[1];
    }
  }

  if (pdfProjeto || pdfSolicitacaoLim || pdfIdTitular || pdfIdConjuge) {
    salvarDadosExtraidosParaParecer(dadosProjetoParaParecer);
  }
  if (titularNome && !dadosProjetoParaParecer.clienteNome) {
    dadosProjetoParaParecer.clienteNome = titularNome;
  }
  if (pdfProjeto || pdfSolicitacaoLim) {
    salvarDadosExtraidosParaParecer(dadosProjetoParaParecer);
  }

  const itensDiagnostico: ItemDiagnosticoPdf[] = [];

  // 1. CONTA CORRENTE NA CONSOLIDADA (TRECHO DE AUTORIZAÇÃO DE DÉBITO EM CONTA DE LIVRE MOVIMENTAÇÃO)
  let contaCorrenteConsolidada = '';
  let agenciaConsolidadaDetectada = '';
  let statusContaConsolidada: 'OK' | 'FALTA' | 'NAO_LIDO' = 'NAO_LIDO';

  if (!pdfConsolidada) {
    statusContaConsolidada = 'FALTA';
    itensDiagnostico.push({
      numero: 1,
      titulo: '1. Conta Corrente nas Declarações Consolidadas',
      status: 'ERRO',
      resumo: 'Arquivo de Declarações Consolidadas não localizado na pasta.',
    });
  } else if (pdfConsolidada.ehProvavelEscaneadoImagem) {
    statusContaConsolidada = 'NAO_LIDO';
    itensDiagnostico.push({
      numero: 1,
      titulo: '1. Conta Corrente nas Declarações Consolidadas',
      status: 'ALERTA',
      resumo:
        '⚠️ Não foi possível ler o documento (PDF da Consolidada está em formato de imagem). Abra na Lupinha (🔎) e clique em "🧠 Ler Imagem via OCR" ou confira visualmente.',
    });
  } else {
    // Combina o texto ordenado com o stream bruto para garantir leitura mesmo se o número estiver em caixa/quadrinho separado
    const txtCons = removerAcentos(
      `${pdfConsolidada.textoCompleto}\n${pdfConsolidada.textoStreamBruto || ''}`
    )
      .toUpperCase()
      .replace(/\s+/g, ' ');

    // Padrão 1 (Exato): "...debitar em sua conta de depósito de livre movimentação de número 66720-5, mantida na agência 103..."
    const matchPadraoExato = txtCons.match(
      /LIVRE\s+MOVIMENTACAO\s+DE\s+N(?:UMERO|º|°|\.)?\s*:?\s*([0-9][0-9.\-\s]{1,12}[0-9X])\s*,?\s*MANTIDA\s+NA\s+AGENCIA\s*:?\s*([0-9]{2,5})/i
    );

    // Padrão 2 (Flexível): Entre "DEBITAR EM SUA CONTA / LIVRE MOVIMENTACAO" e "MANTIDA NA AGENCIA / A SEU CRITERIO"
    const matchPadraoFlexivel =
      !matchPadraoExato &&
      (txtCons.match(
        /(?:LIVRE\s+MOVIMENTACAO\s+DE\s+N(?:UMERO|º|°|\.)?|DEBITAR\s+EM\s+SUA\s+CONTA[\s\S]{1,65}?N(?:UMERO|º|°|\.)?)\s*:?\s*([0-9]{2,10}\s*[-–]\s*[0-9X]|[0-9]{4,10})\b/i
      ) ||
        txtCons.match(
          /CONTA\s+DE\s+DEPOSITO[\s\S]{1,90}?\b([0-9]{3,10}\s*[-–]\s*[0-9X])\b[\s\S]{1,60}?MANTIDA\s+NA\s+AGENCIA/i
        ) ||
        txtCons.match(
          /AGENCIA\s+([0-9]{2,5})[^0-9]{1,25}C\/?C\s*:?\s*([0-9.\-X]{4,12})/i
        ));

    if (matchPadraoExato) {
      contaCorrenteConsolidada = matchPadraoExato[1].replace(/\s+/g, '');
      agenciaConsolidadaDetectada = matchPadraoExato[2].trim();
    } else if (matchPadraoFlexivel) {
      if (matchPadraoFlexivel.length >= 3 && matchPadraoFlexivel[2]) {
        agenciaConsolidadaDetectada = matchPadraoFlexivel[1].trim();
        contaCorrenteConsolidada = matchPadraoFlexivel[2].replace(/\s+/g, '');
      } else if (matchPadraoFlexivel[1]) {
        contaCorrenteConsolidada = matchPadraoFlexivel[1].replace(/\s+/g, '');
      }
      const mAg = txtCons.match(/MANTIDA\s+NA\s+AGENCIA\s*:?\s*([0-9]{2,5})/i);
      if (mAg && mAg[1] && !agenciaConsolidadaDetectada) {
        agenciaConsolidadaDetectada = mAg[1].trim();
      }
    }

    // Valida se não capturou apenas zeros ("0", "0000-0")
    const digitosConta = contaCorrenteConsolidada.replace(/[^0-9]/g, '');
    const contaValida =
      digitosConta.length >= 3 && !/^0+$/.test(digitosConta);

    if (contaValida) {
      statusContaConsolidada = 'OK';
      const confereComPlanilha =
        !contaConformidade ||
        contaConformidade.replace(/\D/g, '') ===
          contaCorrenteConsolidada.replace(/\D/g, '');

      const sufixoAg = agenciaConsolidadaDetectada
        ? ` (Agência ${agenciaConsolidadaDetectada})`
        : '';

      itensDiagnostico.push({
        numero: 1,
        titulo: '1. Conta Corrente nas Declarações Consolidadas',
        status: confereComPlanilha ? 'OK' : 'ALERTA',
        resumo: confereComPlanilha
          ? `✅ Conta Corrente identificada na Consolidada: ${contaCorrenteConsolidada}${sufixoAg}.`
          : `⚠️ Conta na Consolidada (${contaCorrenteConsolidada}${sufixoAg}) diverge da planilha (${contaConformidade})!`,
      });
    } else {
      // Se o texto da Consolidada foi lido normalmente, mas não há conta no trecho de autorização de débito -> FALTA!
      contaCorrenteConsolidada = '';
      statusContaConsolidada = 'FALTA';
      itensDiagnostico.push({
        numero: 1,
        titulo: '1. Conta Corrente nas Declarações Consolidadas',
        status: 'ERRO',
        resumo:
          '🚨 FALTA CONTA CORRENTE NA CONSOLIDADA: O documento foi lido, mas não consta número de conta no trecho "debitar em sua conta de depósito de livre movimentação"!',
      });
    }
  }

  // 2 E 8. VALOR, PRAZO, CARÊNCIA, ELABORADOR E ORÇAMENTO
  const valProjeto = pdfProjeto
    ? extrairValorMonetarioPrincipal(pdfProjeto.textoCompleto)
    : pdfSolicitacaoLim
    ? extrairValorMonetarioPrincipal(pdfSolicitacaoLim.textoCompleto)
    : 0;
  const valOrcamento = pdfOrcamento
    ? extrairValorMonetarioPrincipal(pdfOrcamento.textoCompleto)
    : 0;
  const valEspelho =
    isPronafA && pdfEspelho
      ? extrairValorMonetarioPrincipal(pdfEspelho.textoCompleto)
      : 0;

  const valorPrincipalNum = valProjeto || valOrcamento || valEspelho;
  const valorPropostaDetectado =
    valorPrincipalNum > 0 ? formatarMoedaBD(valorPrincipalNum) : '';

  if (valorPrincipalNum > 0) {
    itensDiagnostico.push({
      numero: 2,
      titulo: isSomenteLimite
        ? '2. Valor do Limite Identificado no PDF'
        : '2. Valor, Prazo, Carência, Elaborador e Inversões Extraídos do Projeto',
      status: 'OK',
      resumo: `Valor: R$ ${valorPropostaDetectado}${
        dadosProjetoParaParecer.prazoMeses
          ? ` • Prazo: ${dadosProjetoParaParecer.prazoMeses} meses`
          : ''
      }${
        dadosProjetoParaParecer.carenciaMeses
          ? ` • Carência: ${dadosProjetoParaParecer.carenciaMeses} meses`
          : ''
      }${
        dadosProjetoParaParecer.elaboradorNomeCompleto
          ? ` • Elaborador: ${dadosProjetoParaParecer.elaboradorNomeCompleto}`
          : ''
      }`,
      detalhes: [
        dadosProjetoParaParecer.programaCredito
          ? `📑 Programa lido no PDF: ${dadosProjetoParaParecer.programaCredito}`
          : '',
        ...dadosProjetoParaParecer.itensInversao.map(
          (it) =>
            `📦 Inversão: ${it.quantidade} ${it.unidade} — ${it.discriminacao} (R$ ${it.valorFinanciado})`
        ),
      ].filter(Boolean),
    });
  } else {
    itensDiagnostico.push({
      numero: 2,
      titulo: '2. Valor da Proposta / Limite Identificado nos PDFs',
      status: 'ALERTA',
      resumo:
        'Não foi possível extrair automaticamente o valor total nos PDFs. Informe manualmente.',
    });
  }

  if (!isSomenteLimite) {
    if (valProjeto > 0 && valOrcamento > 0) {
      const diferenca = Math.abs(valProjeto - valOrcamento);
      itensDiagnostico.push({
        numero: 8,
        titulo: '8. Compatibilidade entre Orçamento e Projeto',
        status: diferenca <= 5 ? 'OK' : 'ERRO',
        resumo:
          diferenca <= 5
            ? `Orçamento (R$ ${formatarMoedaBD(
                valOrcamento
              )}) está 100% de acordo com o Projeto (R$ ${formatarMoedaBD(
                valProjeto
              )}).`
            : `Divergência detectada! Projeto indica R$ ${formatarMoedaBD(
                valProjeto
              )}, mas o Orçamento soma R$ ${formatarMoedaBD(valOrcamento)}.`,
      });
    } else if (modalidadeDerivada === 'CUSTEIO' && pdfProjeto) {
      itensDiagnostico.push({
        numero: 8,
        titulo: '8. Orçamento do Custeio (Suprido pelo Projeto em PDF)',
        status: 'OK',
        resumo:
          'Operação de Custeio: o orçamento já consta incorporado dentro do próprio Projeto em PDF.',
      });
    }
  }

  // 3. SELOS CARTORÁRIOS
  const temSeloNaPasta = arquivos.some(
    (a) => a.categoria === 'CAD_8_SELO_CARTORIO'
  );
  if (!pdfProcuracao && !pdfCasamento) {
    itensDiagnostico.push({
      numero: 3,
      titulo: '3. Validação de Selos (Procuração / Certidão de Casamento)',
      status: 'OK',
      resumo:
        'Não há Procuração nem Certidão de Casamento na pasta (Sem necessidade de consulta de selos).',
    });
  } else if (temSeloNaPasta) {
    itensDiagnostico.push({
      numero: 3,
      titulo: '3. Validação de Selos (Procuração / Certidão de Casamento)',
      status: 'OK',
      resumo: 'Arquivo de consulta de Selo já consta na pasta de Cadastro.',
    });
  } else {
    itensDiagnostico.push({
      numero: 3,
      titulo: '3. Validação de Selos (Procuração / Certidão de Casamento)',
      status: 'ALERTA',
      resumo: `Há ${[
        pdfProcuracao ? 'Procuração' : '',
        pdfCasamento ? 'Certidão de Casamento' : '',
      ]
        .filter(Boolean)
        .join(' e ')} na pasta e FALTA consultar o(s) selo(s)!`,
    });
  }

  // 4 E 7. ASSINATURAS DIGITAIS VS MANUAIS E EXIGÊNCIA DE VITI
  const CATEGORIAS_ASSINAVEIS = new Set([
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

  const vitisPresentesSet = new Set(
    extraidos.filter((e) => e.isViti).map((e) => e.categoria)
  );

  const arquivosComAssinaturaDigital: string[] = [];
  const arquivosSemAssinaturaDigital: string[] = [];
  const faltamVitiDeAssinaturaDigitalConfirmada: string[] = [];

  extraidos
    .filter((e) => !e.isViti && CATEGORIAS_ASSINAVEIS.has(e.categoria))
    .forEach((doc) => {
      if (doc.possuiAssinaturaDigital) {
        const jaTemViti = vitisPresentesSet.has(doc.categoria);
        arquivosComAssinaturaDigital.push(
          `${doc.nomeOriginal} ${jaTemViti ? '(VITI OK ✅)' : '(FALTA VITI 🚨)'}`
        );
        if (!jaTemViti) {
          faltamVitiDeAssinaturaDigitalConfirmada.push(doc.nomeOriginal);
        }
      } else {
        arquivosSemAssinaturaDigital.push(
          `${doc.nomeOriginal} (${
            doc.ehProvavelEscaneadoImagem
              ? 'Escaneado/Manual — Isento de VITI'
              : 'Sem Certificado Digital'
          })`
        );
      }
    });

  itensDiagnostico.push({
    numero: 4,
    titulo:
      '4. Auditoria de Assinaturas Digitais vs Manuais e Exigência de VITI',
    status:
      faltamVitiDeAssinaturaDigitalConfirmada.length > 0 ? 'ERRO' : 'OK',
    resumo:
      faltamVitiDeAssinaturaDigitalConfirmada.length > 0
        ? `Detectados ${faltamVitiDeAssinaturaDigitalConfirmada.length} PDF(s) com Assinatura Digital que estão SEM o VITI na pasta!`
        : `Todos os ${arquivosComAssinaturaDigital.length} documento(s) assinados digitalmente já possuem VITI na pasta.`,
    detalhes: [
      ...faltamVitiDeAssinaturaDigitalConfirmada.map(
        (n) => `🚨 Falta validar no ITI (Possui Ass. Digital): ${n}`
      ),
      ...arquivosSemAssinaturaDigital.map(
        (n) => `✍️ Sem assinatura digital (Isento de VITI): ${n}`
      ),
    ],
  });

  // 5. ESPELHO DA UND (PRONAF A) OU MAPEAMENTO DE IMÓVEIS DE INVERSÃO VS GARANTIA (DEMAIS PORTES)
  const paDetectadoNoProjeto =
    dadosProjetoParaParecer.denominacaoImovelPa || paEsperado;
  const recibosCarNoProjeto = extrairCodigosReciboCar(
    pdfProjeto?.textoCompleto || ''
  );
  const recibosCarNoPdfCar = extrairCodigosReciboCar(
    (pdfCar?.textoCompleto || '') + '\n' + (pdfConsultaCar?.textoCompleto || '')
  );
  const carEspecificoDetectado =
    recibosCarNoPdfCar[0] || recibosCarNoProjeto[0] || '';

  if (isPronafA && !isSomenteLimite) {
    const primTit = normalizarSemAcento(titularNome.split(/\s+/)[0] || '');
    const primConj = normalizarSemAcento(conjugeEfetivo.split(/\s+/)[0] || '');
    const txtEspelhoNorm = normalizarSemAcento(pdfEspelho?.textoCompleto || '');

    if (!pdfEspelho) {
      itensDiagnostico.push({
        numero: 5,
        titulo: '5. Espelho da UND Familiar + P.A. e CAR (PRONAF A)',
        status: 'ALERTA',
        resumo: 'Arquivo 11. Espelho da UND não localizado na pasta.',
      });
    } else {
      const titNoEspelho = primTit ? txtEspelhoNorm.includes(primTit) : true;
      const conjNoEspelho = primConj ? txtEspelhoNorm.includes(primConj) : true;
      itensDiagnostico.push({
        numero: 5,
        titulo: '5. Espelho da UND Familiar + P.A. e CAR (PRONAF A)',
        status: !titNoEspelho || (primConj && !conjNoEspelho) ? 'ERRO' : 'OK',
        resumo:
          titNoEspelho && (!primConj || conjNoEspelho)
            ? `Titular${
                primConj ? '/Cônjuge' : ''
              } OK no Espelho da UND e CAR compatível com o Projeto.`
            : 'Divergência identificada no Espelho da UND Familiar!',
      });
    }
  } else {
    const ims = dadosProjetoParaParecer.imoveisVinculados;
    const imsInversao = ims.filter((i) => i.realizaInversao);
    const imsGarantia = ims.filter((i) => i.compoeGarantia);

    itensDiagnostico.push({
      numero: 5,
      titulo:
        '5. Mapeamento de Imóveis do Projeto (Benfeitoria/Inversão vs Garantia) & CAR',
      status: pdfCar ? 'OK' : 'ALERTA',
      resumo:
        ims.length > 0
          ? `Identificados ${ims.length} imóvel(is) no PDF (${imsInversao.length} de Benfeitoria/Inversão e ${imsGarantia.length} dado(s) em Garantia).`
          : `Imóvel base: ${paDetectadoNoProjeto} • ${
              pdfCar ? 'CAR presente na pasta' : 'Falta anexar o CAR na pasta'
            }.`,
      detalhes: ims.map(
        (im) =>
          `📍 ${im.nome} (${im.municipioUf || 'MA'} • ${
            im.areaHa || '?'
          } ha) ➔ Inversão: ${im.realizaInversao ? 'SIM' : 'NÃO'} | Garantia: ${
            im.compoeGarantia ? 'SIM' : 'NÃO'
          }`
      ),
    });
  }

  // 6. VALIDADE DA CAF (PRONAF A / PRONAF V) OU REGULARIDADE FISCAL/FUNDIÁRIA (MINI / PEQUENO)
  if ((isPronafA || isPronafV) && !isSomenteLimite) {
    if (!pdfCaf) {
      itensDiagnostico.push({
        numero: 6,
        titulo: '6. Validade da DAP / CAF',
        status: 'ERRO',
        resumo: 'Arquivo DAP/CAF não encontrado na pasta.',
      });
    } else {
      const txtCafBruto = pdfCaf.textoCompleto || '';
      const txtCafSemAcento = removerAcentos(txtCafBruto).toUpperCase();
      const matchValidade =
        txtCafSemAcento.match(
          /(?:VALIDADE|VALIDO\s+ATE|DATA\s+DE\s+VALIDADE|VENCIMENTO)[^0-9]{0,25}(\d{2}\/\d{2}\/\d{4})/i
        ) || txtCafSemAcento.match(/(\d{2}\/\d{2}\/202[5-9])/);

      let cafVencida = false;
      let dataValStr = '';
      if (matchValidade && matchValidade[1]) {
        dataValStr = matchValidade[1];
        const [dd, mm, aaaa] = dataValStr.split('/').map(Number);
        const dtVal = new Date(aaaa, mm - 1, dd, 23, 59, 59);
        if (dtVal.getTime() < Date.now()) {
          cafVencida = true;
        }
      }

      const paAlvo = paDetectadoNoProjeto || paEsperado;
      const paConstaNaCaf =
        !isPronafA || textoContemTermoFlexivel(txtCafBruto, paAlvo);

      itensDiagnostico.push({
        numero: 6,
        titulo: isPronafA
          ? '6. Validade da CAF e Assentamento (P.A.) na CAF'
          : '6. Validade da DAP / CAF (PRONAF V)',
        status: cafVencida ? 'ERRO' : !paConstaNaCaf ? 'ALERTA' : 'OK',
        resumo: cafVencida
          ? `🚨 CAF VENCIDA em ${dataValStr}! Solicitar renovação imediata.`
          : `${
              dataValStr
                ? `CAF Vigente (Validade: ${dataValStr})`
                : 'CAF localizada na pasta'
            }${
              isPronafA
                ? paConstaNaCaf
                  ? ` • P.A. (${paAlvo}) confirmado na CAF.`
                  : ` • ⚠️ Verifique o nome do P.A. (${paAlvo}) na CAF.`
                : ' • Lembre-se de emitir o Extrato da CAF no dia.'
            }`,
      });
    }
  } else if (isMiniPequeno) {
    const temCndPf = arquivos.some((a) => a.categoria === 'ITEM_CND_PF');
    const temCcir = arquivos.some((a) => a.categoria === 'ITEM_CCIR');
    const temItr = arquivos.some((a) => a.categoria === 'ITEM_CND_ITR_IMOVEL');
    itensDiagnostico.push({
      numero: 6,
      titulo: '6. Regularidade Fiscal e Fundiária (MINI / PEQUENO)',
      status: temCndPf && temCcir && temItr ? 'OK' : 'ALERTA',
      resumo: `CND PF: ${temCndPf ? 'OK ✅' : 'Falta ⚠️'} • CCIR Vigente: ${
        temCcir ? 'OK ✅' : 'Falta ⚠️'
      } • CND/ITR Imóvel: ${temItr ? 'OK ✅' : 'Falta ⚠️'}`,
    });
  }

  // 9. OBJETIVO DO CRÉDITO
  if (!isSomenteLimite) {
    const objetivoCreditoDetectado =
      dadosProjetoParaParecer.objetivoCurto ||
      dadosProjetoParaParecer.objetivoJustificativaCompleta;

    itensDiagnostico.push({
      numero: 9,
      titulo: '9. Objetivo do Crédito Identificado no Projeto',
      status: objetivoCreditoDetectado ? 'OK' : 'INFO',
      resumo: dadosProjetoParaParecer.objetivoCurto
        ? `Modalidade: ${dadosProjetoParaParecer.objetivoCurto}${
            dadosProjetoParaParecer.objetivoJustificativaCompleta
              ? ` — "${dadosProjetoParaParecer.objetivoJustificativaCompleta.substring(
                  0,
                  110
                )}..."`
              : ''
          }`
        : 'Objetivo específico não isolado automaticamente no texto do Projeto.',
    });
  }

  // 10 E 11. CONSISTÊNCIA DE ESTADO CIVIL E DOCUMENTAÇÃO DO CÔNJUGE
  const txtTodosCadastro = normalizarSemAcento(
    [
      pdfIdTitular?.textoCompleto,
      pdfCasamento?.textoCompleto,
      pdfCaf?.textoCompleto,
      pdfEspelho?.textoCompleto,
    ]
      .filter(Boolean)
      .join('\n')
  );

  const estadoCivilNoProj = dadosProjetoParaParecer.estadoCivil;
  const possuiConjugeReal =
    Boolean(conjugeEfetivo) ||
    Boolean(pdfCasamento) ||
    estadoCivilNoProj.includes('CASAD') ||
    estadoCivilNoProj.includes('UNIAO') ||
    /\b(CONJUGE|COMPANHEIRO|COMPANHEIRA)\b/.test(txtTodosCadastro);

  const ehCasadoFormal =
    estadoCivilNoProj.includes('CASAD') || Boolean(pdfCasamento);
  const ehUniaoEstavel =
    !ehCasadoFormal &&
    (estadoCivilNoProj.includes('UNIAO') || Boolean(conjugeEfetivo));

  const temDocIdConjugeFisico = Boolean(pdfIdConjuge);
  const faltaCertidaoCasamento = ehCasadoFormal && !pdfCasamento;

  const estadoCivilDetectado = ehCasadoFormal
    ? 'CASADO(A)'
    : ehUniaoEstavel
    ? 'UNIÃO ESTÁVEL'
    : estadoCivilNoProj || 'SOLTEIRO(A)';

  const erroItem10 =
    (possuiConjugeReal && !temDocIdConjugeFisico) || faltaCertidaoCasamento;

  itensDiagnostico.push({
    numero: 10,
    titulo:
      '10. Consistência de Estado Civil, Identidade do Cônjuge e Certidão de Casamento',
    status: erroItem10 ? 'ERRO' : 'OK',
    resumo: !possuiConjugeReal
      ? 'Titular Solteiro(a) / Sem Cônjuge (Não exige certidões nem documentos de cônjuge).'
      : !temDocIdConjugeFisico
      ? `🚨 ALERTA: Consta Cônjuge/Companheiro(a) (${
          conjugeEfetivo || estadoCivilDetectado
        }), mas FALTA o Documento de Identificação do Cônjuge na pasta!`
      : faltaCertidaoCasamento
      ? `🚨 ALERTA: Estado civil é CASADO(A), mas FALTA a Certidão de Casamento na pasta!`
      : ehUniaoEstavel
      ? `✅ União Estável (${
          conjugeEfetivo || 'Companheiro(a)'
        }): Identidade do(a) companheiro(a) validada (Isento de Certidão de Casamento).`
      : `✅ Casado(a) (${
          conjugeEfetivo || 'Cônjuge'
        }): Identidade do Cônjuge e Certidão de Casamento validadas na pasta.`,
  });

  // 12. EXCLUSIVO PRONAF A: PRESENÇA DO CLIENTE NA RB DO P.A.
  if (isPronafA && !isSomenteLimite) {
    if (!pdfRb) {
      itensDiagnostico.push({
        numero: 12,
        titulo:
          '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
        status: 'ALERTA',
        resumo:
          'Arquivo 17 - RB do P.A. não está na pasta (Cadastre na Gaveta de Coringas para conferência automática).',
      });
    } else if (pdfRb.ehProvavelEscaneadoImagem) {
      itensDiagnostico.push({
        numero: 12,
        titulo:
          '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
        status: 'ALERTA',
        resumo:
          'O PDF da RB do P.A. é uma imagem escaneada sem texto pesquisável. Confira visualmente o nome na RB.',
      });
    } else {
      const achouNaRb = textoContemTermoFlexivel(
        pdfRb.textoCompleto,
        titularNome
      );
      itensDiagnostico.push({
        numero: 12,
        titulo:
          '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
        status: achouNaRb ? 'OK' : 'ERRO',
        resumo: achouNaRb
          ? `✅ Nome do cliente "${titularNome}" localizado com sucesso na RB do P.A.!`
          : `🚨 O nome "${titularNome}" NÃO foi localizado no texto da RB do P.A.!`,
      });
    }
  }

  // =========================================================================
  // 13. PASSO 3: AUDITORIA GEODÉSICA DO .KML & CRUZAMENTO AUTOMÁTICO COM
  //     A CERTIFICAÇÃO SOCIOAMBIENTAL (COM KML vs SEM KML)
  // =========================================================================
  const reclassificacoesSocioambiental: Record<
    string,
    'ITEM_CERT_SOCIO_COM_KML' | 'ITEM_CERT_SOCIO_SEM_KML'
  > = {};
  let kmlCorrigidoAutomaticamente: {
    nomeArquivo: string;
    conteudoKml: string;
  } | null = null;
  const exigenciasSocioambientaisDetectadas: string[] = [];

  // 13.1. Procura todos os arquivos .KML na pasta e seleciona SEMPRE O MAIS RECENTE
  const todosKmlsDaPasta = [...arquivos]
    .filter(
      (a) =>
        a.categoria === 'ITEM_KML' ||
        /\.(kml|kmz)$/i.test(a.fileObj.name.toLowerCase())
    )
    .sort((a, b) => (b.fileObj.lastModified || 0) - (a.fileObj.lastModified || 0));

  const arqKmlItem = todosKmlsDaPasta[0];

  let itensKmlExtraidos: string[] = [];
  let logsKmlExtraidos: string[] = [];

  if (arqKmlItem) {
    try {
      const resKml = await processarArquivoKmlSocioambiental(
        arqKmlItem.fileObj
      );
      itensKmlExtraidos = resKml.itensEncontrados;
      logsKmlExtraidos = resKml.logs;
      if (todosKmlsDaPasta.length > 1) {
        logsKmlExtraidos.unshift(
          `ℹ️ Múltiplos KMLs na pasta (${todosKmlsDaPasta.length}): utilizando o mais recente "${arqKmlItem.nomeOriginal}".`
        );
      }
      if (resKml.kmlCorrigidoTexto) {
        kmlCorrigidoAutomaticamente = {
          nomeArquivo: arqKmlItem.nomeOriginal,
          conteudoKml: resKml.kmlCorrigidoTexto,
        };
      }
    } catch {
      // Ignora erro de parse KML
    }
  }

  // 13.2. Analisa todos os PDFs de Certificação Socioambiental presentes na pasta
  // (ordenados do mais recente para o mais antigo) e distingue COM KML vs SEM KML!
  const arquivosSocioPdf = [...arquivos]
    .filter(
      (a) =>
        !a.isViti &&
        a.fileObj.name.toLowerCase().endsWith('.pdf') &&
        (a.categoria === 'ITEM_5_CERT_SOCIOAMBIENTAL' ||
          a.categoria === 'ITEM_CERT_SOCIO_COM_KML' ||
          a.categoria === 'ITEM_CERT_SOCIO_SEM_KML' ||
          removerAcentos(a.nomeOriginal)
            .toUpperCase()
            .includes('SOCIOAMBIENTAL'))
    )
    .sort((a, b) => (b.fileObj.lastModified || 0) - (a.fileObj.lastModified || 0));

  const analisesSocioPorArquivo: Array<{
    nomeOriginal: string;
    lastModified: number;
    possuiGlebas: boolean;
    dadosSocio: Awaited<
      ReturnType<typeof extrairDadosPdfCertificacaoSocioambiental>
    >;
  }> = [];

  for (const arqS of arquivosSocioPdf) {
    try {
      const dadosS = await extrairDadosPdfCertificacaoSocioambiental(
        arqS.fileObj,
        itensKmlExtraidos
      );
      analisesSocioPorArquivo.push({
        nomeOriginal: arqS.nomeOriginal,
        lastModified: arqS.fileObj.lastModified || 0,
        possuiGlebas: dadosS.possuiBlocoGlebasNoPdf,
        dadosSocio: dadosS,
      });

      reclassificacoesSocioambiental[arqS.nomeOriginal] =
        dadosS.possuiBlocoGlebasNoPdf
          ? 'ITEM_CERT_SOCIO_COM_KML'
          : 'ITEM_CERT_SOCIO_SEM_KML';
    } catch {
      // Ignora falha de leitura individual
    }
  }

  const exigeKmlNaDerivada = !isPronafA && !isSomenteLimite;
  const exigeCertSemKmlNoLimite =
    isSomenteLimite || escopoSelecionado === 'COMBO_DERIVADA_E_LIMITE';

  // Como a lista já está ordenada por lastModified decrescente, .find() pega sempre a MAIS RECENTE de cada tipo!
  const certComKml = analisesSocioPorArquivo.find((x) => x.possuiGlebas);
  const certSemKml = analisesSocioPorArquivo.find((x) => !x.possuiGlebas);
  const qtdCertComKml = analisesSocioPorArquivo.filter((x) => x.possuiGlebas).length;
  const qtdCertSemKml = analisesSocioPorArquivo.filter((x) => !x.possuiGlebas).length;

  // VERIFICAÇÃO A: CERTIFICAÇÃO SOCIOAMBIENTAL COM KML (PARA OPERAÇÃO DERIVADA)
  if (exigeKmlNaDerivada) {
    const detalhesSocioKml: string[] = [];
    let statusItem13: NivelStatusAuditoria = 'OK';
    let resumoItem13 = '';

    if (!arqKmlItem) {
      statusItem13 = 'ERRO';
      detalhesSocioKml.push(
        '🚨 Arquivo .KML do projeto NÃO foi encontrado na pasta!'
      );
    } else {
      const temPoligonoAberto = Boolean(kmlCorrigidoAutomaticamente);
      if (temPoligonoAberto) {
        statusItem13 = 'ALERTA';
        detalhesSocioKml.push(
          `⚠️ O arquivo "${arqKmlItem.nomeOriginal}" possuía polígono(s) aberto(s)! Clique no botão "🔧 Fechar Polígonos do .KML Direto na Pasta" para corrigir.`
        );
      }
      logsKmlExtraidos.forEach((lg) => detalhesSocioKml.push(lg));
    }

    if (analisesSocioPorArquivo.length === 0) {
      statusItem13 = 'ERRO';
      resumoItem13 =
        'Falta anexar a Certificação Socioambiental COM KML na pasta da Derivada.';
    } else if (!certComKml && certSemKml) {
      statusItem13 = 'ERRO';
      resumoItem13 =
        '🚨 ATENÇÃO: Só foi localizada Certificação SEM KML (padrão Limite)! Para a Operação Derivada é obrigatória a Certificação COM KML (quadro de Glebas).';
    } else if (certComKml) {
      if (qtdCertComKml > 1) {
        detalhesSocioKml.unshift(
          `ℹ️ Foram encontradas ${qtdCertComKml} Certificações COM KML na pasta. Auditando a mais recente: "${certComKml.nomeOriginal}".`
        );
      }
      const diagV98 = avaliarConformidadeSocioambientalV98({
        dados: certComKml.dadosSocio,
        areaImovelHa:
          dadosProjetoParaParecer.areaImovelHa ||
          certComKml.dadosSocio.areaCarHa,
        forcarAte4ModulosAntes2008: isPronafA || isPronafV,
      });

      diagV98.exigenciasDocumentais.forEach((ex) => {
        if (!exigenciasSocioambientaisDetectadas.includes(ex)) {
          exigenciasSocioambientaisDetectadas.push(ex);
        }
      });

      if (diagV98.errosCriticos.length > 0) {
        statusItem13 = 'ERRO';
        resumoItem13 = `🚨 IMPEDIMENTO NA CERT. COM KML ("${certComKml.nomeOriginal}"): ${diagV98.errosCriticos[0]}`;
      } else if (statusItem13 !== 'ERRO') {
        resumoItem13 = `✅ Certificação COM KML mais recente ("${certComKml.nomeOriginal}") × KML ("${arqKmlItem?.nomeOriginal || 'KML'}") APROVADOS! (${certComKml.dadosSocio.glebas.length} glebas • RL: ${certComKml.dadosSocio.reservaLegalPerc || 'OK'}).`;
      }

      diagV98.errosCriticos.forEach((er) =>
        detalhesSocioKml.push(`🚨 [IMPEDIMENTO] ${er}`)
      );
      diagV98.justificativasERessalvas.forEach((ju) =>
        detalhesSocioKml.push(`✅ [CONFORMIDADE] ${ju}`)
      );
    }

    itensDiagnostico.push({
      numero: 13,
      titulo:
        '13. Auditoria de Derivada: KML Mais Recente × Certificação Socioambiental COM KML',
      status: statusItem13,
      resumo:
        resumoItem13 ||
        'Verificação do KML e da Certificação Socioambiental COM KML concluída.',
      detalhes: detalhesSocioKml,
    });
  }

  // VERIFICAÇÃO B (SEPARADA): CERTIFICAÇÃO SOCIOAMBIENTAL SEM KML (PARA LIMITE LCGH/LCGA OU PRONAF A)
  if (exigeCertSemKmlNoLimite || (isPronafA && analisesSocioPorArquivo.length > 0)) {
    const alvoSemKml = certSemKml || (isPronafA ? analisesSocioPorArquivo[0] : undefined);

    if (!alvoSemKml) {
      itensDiagnostico.push({
        numero: 13.5,
        titulo:
          '13.1. Auditoria de Limite (LCGH/LCGA): Certificação Socioambiental SEM KML',
        status: 'ERRO',
        resumo:
          '🚨 Falta a Certificação Socioambiental SEM KML (exclusiva do imóvel da garantia LCGH/LCGA) na pasta!',
      });
    } else {
      const diagLim = avaliarConformidadeSocioambientalV98({
        dados: alvoSemKml.dadosSocio,
        areaImovelHa:
          dadosProjetoParaParecer.areaImovelHa || alvoSemKml.dadosSocio.areaCarHa,
        forcarAte4ModulosAntes2008: isPronafA,
      });

      const detalhesSemKml: string[] = [];
      if (qtdCertSemKml > 1) {
        detalhesSemKml.push(
          `ℹ️ Foram encontradas ${qtdCertSemKml} Certificações SEM KML na pasta. Auditando a mais recente: "${alvoSemKml.nomeOriginal}".`
        );
      }
      diagLim.errosCriticos.forEach((er) => detalhesSemKml.push(`🚨 ${er}`));
      diagLim.justificativasERessalvas.forEach((ju) =>
        detalhesSemKml.push(`✅ ${ju}`)
      );

      itensDiagnostico.push({
        numero: isPronafA ? 13 : 13.5,
        titulo: isPronafA
          ? '13. Auditoria da Certificação Socioambiental (PRONAF A)'
          : `13.1. Auditoria de Limite (LCGH/LCGA): Certificação Socioambiental SEM KML ("${alvoSemKml.nomeOriginal}")`,
        status: diagLim.errosCriticos.length > 0 ? 'ERRO' : 'OK',
        resumo:
          diagLim.errosCriticos.length > 0
            ? `🚨 Impedimento na Certificação SEM KML ("${alvoSemKml.nomeOriginal}"): ${diagLim.errosCriticos[0]}`
            : `✅ Certificação SEM KML mais recente ("${alvoSemKml.nomeOriginal}") aprovada (Área CAR: ${
                alvoSemKml.dadosSocio.areaCarHa || '?'
              } ha • RL: ${alvoSemKml.dadosSocio.reservaLegalPerc || 'OK'}).`,
        detalhes: detalhesSemKml,
      });
    }
  }

  // =========================================================================
  // 14. ITEM 5 (V98): AUDITORIA DE TETO DE ASSESSORIA TÉCNICA (5% vs 2%)
  //     E VERIFICAÇÃO DE SEGURO NO KML / PROJETO
  // =========================================================================
  if (!isSomenteLimite) {
    const valAssNum = parseMoeda(
      dadosProjetoParaParecer.valorAssessoriaExtraido ||
        dadosProjetoParaParecer.valorRecursosProprios ||
        '0'
    );
    const tetoMaxPerc = isPronafA ? 5 : 2;
    const percAssAtual =
      valorPrincipalNum > 0 && valAssNum > 0
        ? (valAssNum / valorPrincipalNum) * 100
        : 0;
    const excedeuAssessoria = percAssAtual > tetoMaxPerc + 0.01;

    const temSeguroNoKml = itensKmlExtraidos.some((nome) =>
      normalizarSemAcento(nome).includes('SEGURO')
    );
    const txtProjNormSeg = normalizarSemAcento(pdfProjeto?.textoCompleto || '');
    const projetoMencionaSeguroFinanciado =
      txtProjNormSeg.includes('SEGURO RURAL') ||
      txtProjNormSeg.includes('SEGURO PRESTAMISTA');

    const detalhesItem14: string[] = [];
    if (valAssNum > 0 && valorPrincipalNum > 0) {
      detalhesItem14.push(
        excedeuAssessoria
          ? `🚨 Assessoria Técnica (R$ ${formatarMoedaBD(
              valAssNum
            )} = ${percAssAtual.toFixed(
              2
            )}%) EXCEDE o limite de ${tetoMaxPerc}% permitido para o porte!`
          : `✅ Assessoria Técnica (R$ ${formatarMoedaBD(
              valAssNum
            )} = ${percAssAtual.toFixed(
              2
            )}%) dentro do limite normativo de ${tetoMaxPerc}%.`
      );
    } else {
      detalhesItem14.push(
        `ℹ️ Custo de assessoria técnica: R$ 0,00 (ou isento no plano). Limite do porte: ${tetoMaxPerc}%.`
      );
    }

    if (!isPronafA && arqKmlItem) {
      if (temSeguroNoKml) {
        detalhesItem14.push(
          '✅ Gleba de SEGURO identificada dentro do arquivo .KML.'
        );
      } else if (projetoMencionaSeguroFinanciado) {
        detalhesItem14.push(
          '⚠️ ATENÇÃO: Caso haja Seguro financiado junto ao projeto, o projetista deve inserir a respectiva área de SEGURO no .KML!'
        );
      }
    }

    itensDiagnostico.push({
      numero: 14,
      titulo: `14. Limite de Assessoria Técnica (Máx. ${tetoMaxPerc}%) & Seguro no KML (V98)`,
      status: excedeuAssessoria ? 'ERRO' : 'OK',
      resumo: excedeuAssessoria
        ? `🚨 Valor de assessoria técnica (${percAssAtual.toFixed(
            2
          )}%) ultrapassa o teto de ${tetoMaxPerc}%!`
        : valAssNum > 0
        ? `Assessoria Técnica em conformidade (${percAssAtual.toFixed(
            2
          )}% ≤ ${tetoMaxPerc}%).`
        : `Sem cobrança de assessoria acima do teto (${tetoMaxPerc}%).`,
      detalhes: detalhesItem14,
    });
  }

  // =========================================================================
  // 15. VALIDADE DE CERTIDÕES, INTEIRO TEOR (15 ANOS + MODO DE AQUISIÇÃO),
  //     TÍTULO DE DOMÍNIO (CLÁUSULA DE INALIENABILIDADE × LCGA vs LCGH) E
  //     CAPTURA DE TODOS OS IMÓVEIS NOS DOCUMENTOS
  // =========================================================================
  const detalhesCertidoesEImovel: string[] = [];
  let statusItem15: NivelStatusAuditoria = 'OK';

  // ITEM 2: Captura nomes de imóveis presentes dentro dos PDFs (CAR, CCIR, ITR, Inteiro Teor, Título) e nomes de arquivos
  const imoveisDetectadosSet = new Set<string>();
  (dadosProjetoParaParecer.imoveisVinculados || []).forEach((im) => {
    if (im.nome && im.nome.trim().length >= 3) {
      imoveisDetectadosSet.add(im.nome.toUpperCase().trim());
    }
  });

  extraidos.forEach((doc) => {
    const tNorm = removerAcentos(doc.textoCompleto).toUpperCase();
    // Procura "Nome do Imóvel Rural:", "Denominação do Imóvel:", "Imóvel:" no CAR, CCIR, ITR e Matrícula
    const matchesIm = [
      ...tNorm.matchAll(
        /(?:NOME\s+DO\s+IMOVEL(?:\s+RURAL)?|DENOMINACAO\s+DO\s+IMOVEL(?:\s+RURAL)?)\s*:?\s*([A-Z0-9][A-Z0-9\s\-/]{3,42}?)(?:\s+MUNICIPIO|\s+UF:|\s+AREA|\s+CODIGO|\s+CPF|\s+CAR|\n|$)/gi
      ),
    ];
    matchesIm.forEach((m) => {
      const cand = (m[1] || '')
        .replace(
          /\b(RURAL|MUNICIPIO|SITUACAO|ATIVO|PENDENTE|CPF|CNPJ|PROPRIETARIO|DECLARANTE)\b/g,
          ''
        )
        .replace(/\s+/g, ' ')
        .trim();
      if (cand.length >= 4 && cand.length <= 40 && !/^\d+$/.test(cand)) {
        imoveisDetectadosSet.add(cand);
      }
    });

    // Procura também no nome do arquivo padrões como FAZ. DOIS IRMAOS, FAZENDA X, SÍTIO Y, GLEBA Z, LOTE W, P.A.
    const mArq = removerAcentos(doc.nomeOriginal)
      .toUpperCase()
      .replace(/_/g, ' ')
      .match(
        /\b((?:FAZENDA|FAZ\.?|SITIO|SIT\.?|CHACARA|CHAC\.?|LOTEAMENTO|LOTE|GLEBA|P\.?\s*A\.?)\s+[A-Z0-9.\s]{2,35}?)(?:\s+ASSINADO|\s+COMPRESSED|\s+MATRICULA|\.PDF|\s*-|$)/i
      );
    if (mArq && mArq[1]) {
      const candIm = mArq[1].replace(/\s+/g, ' ').trim();
      const primTitCheck = normalizarSemAcento(
        (dadosProjetoParaParecer.clienteNome || titularNome).split(/\s+/)[0] ||
          ''
      );
      const primConjCheck = normalizarSemAcento(
        conjugeEfetivo.split(/\s+/)[0] || ''
      );
      const candNormCheck = normalizarSemAcento(candIm);

      if (
        candNormCheck !== primTitCheck &&
        candNormCheck !== primConjCheck
      ) {
        imoveisDetectadosSet.add(candIm);
      }
    }
  });

  const imoveisDetectadosNosDocumentos = Array.from(imoveisDetectadosSet);
  // Se o projeto não tinha preenchido imoveisVinculados mas encontramos imóveis nos documentos da pasta, sincroniza!
  if (
    dadosProjetoParaParecer.imoveisVinculados.length === 0 &&
    imoveisDetectadosNosDocumentos.length > 0
  ) {
    dadosProjetoParaParecer.imoveisVinculados =
      imoveisDetectadosNosDocumentos.map((nomeIm) => ({
        nome: nomeIm,
        municipioUf: dadosProjetoParaParecer.municipioImovel || '',
        areaHa: dadosProjetoParaParecer.areaImovelHa || '',
        realizaInversao: true,
        compoeGarantia:
          isSomenteLimite || escopoSelecionado === 'COMBO_DERIVADA_E_LIMITE',
      }));
    salvarDadosExtraidosParaParecer(dadosProjetoParaParecer);
  }

  const checarValidadeCertidaoPdf = (
    pdfDoc: PdfExtraidoInfo | undefined,
    nomeCurtoCert: string
  ) => {
    if (!pdfDoc) return;
    if (pdfDoc.ehProvavelEscaneadoImagem) {
      if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
      detalhesCertidoesEImovel.push(
        `⚠️ ${nomeCurtoCert} ("${pdfDoc.nomeOriginal}") está como imagem escaneada. Abra na Lupinha (🔎) e clique em "🧠 Ler Imagem via OCR" para auditar automaticamente!`
      );
      return;
    }

    const txt = removerAcentos(pdfDoc.textoCompleto).toUpperCase();
    const matchValidade =
      txt.match(
        /(?:VALIDA\s+ATE|VALIDADE\s*:?|VENCIMENTO\s*:?)[^0-9]{0,25}(\d{2}\/\d{2}\/20\d{2})/i
      ) || txt.match(/ATE\s+(\d{2}\/\d{2}\/20\d{2})/i);

    if (matchValidade && matchValidade[1]) {
      const [dd, mm, aaaa] = matchValidade[1].split('/').map(Number);
      const dtVenc = new Date(aaaa, mm - 1, dd, 23, 59, 59);
      const diasRestantes = Math.ceil(
        (dtVenc.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (diasRestantes < 0) {
        statusItem15 = 'ERRO';
        detalhesCertidoesEImovel.push(
          `🚨 ${nomeCurtoCert} VENCIDA em ${matchValidade[1]} (Venceu há ${Math.abs(
            diasRestantes
          )} dias)!`
        );
      } else if (diasRestantes <= 5) {
        if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
        detalhesCertidoesEImovel.push(
          `⚠️ ATENÇÃO: ${nomeCurtoCert} vence em apenas ${diasRestantes} dia(s) (${matchValidade[1]})!`
        );
      } else {
        detalhesCertidoesEImovel.push(
          `✅ ${nomeCurtoCert}: Vigente até ${matchValidade[1]} (${diasRestantes} dias restantes).`
        );
      }
    }
  };

  const pdfCndPf = obterPorCat('ITEM_CND_PF', false);
  const pdfCndtPf = obterPorCat('ITEM_CNDT_PF', false);
  const pdfCndItr = obterPorCat('ITEM_CND_ITR_IMOVEL', false);
  const pdfCcir = obterPorCat('ITEM_CCIR', false);

  checarValidadeCertidaoPdf(pdfCndPf, 'CND Receita Federal (PF)');
  checarValidadeCertidaoPdf(pdfCndtPf, 'CNDT Trabalhista');
  checarValidadeCertidaoPdf(pdfCndItr, 'CND de ITR do Imóvel');

  if (pdfCcir && !pdfCcir.ehProvavelEscaneadoImagem) {
    const anoAtual = new Date().getFullYear();
    const txtCcir = pdfCcir.textoCompleto;
    if (
      txtCcir.includes(String(anoAtual)) ||
      txtCcir.includes(String(anoAtual - 1))
    ) {
      detalhesCertidoesEImovel.push(
        `✅ CCIR do Imóvel: Exercício vigente (${anoAtual - 1}/${anoAtual}) confirmado.`
      );
    } else {
      if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
      detalhesCertidoesEImovel.push(
        `⚠️ CCIR do Imóvel: Não foi localizado o ano vigente (${anoAtual}) no texto do CCIR.`
      );
    }
  }

  // Auditoria de TODAS as Certidões de Inteiro Teor da pasta (Cadeia de 15 anos + Modo de Aquisição + Emissão 30 dias)
  const todosPdfsInteiroTeor = extraidos.filter(
    (e) => !e.isViti && e.categoria === 'ITEM_INTEIRO_TEOR'
  );

  for (const docMat of todosPdfsInteiroTeor) {
    if (docMat.ehProvavelEscaneadoImagem) {
      if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
      detalhesCertidoesEImovel.push(
        `⚠️ Inteiro Teor ("${docMat.nomeOriginal}") está como imagem escaneada. Clique na Lupinha (🔎) e use o botão "🧠 Ler Imagem via OCR" para verificar a cadeia de 15 anos e a forma de aquisição!`
      );
      continue;
    }

    const txtMat = docMat.textoCompleto;
    const txtMatNorm = removerAcentos(txtMat).toUpperCase();

    // Identifica COMO FOI A AQUISIÇÃO DO IMÓVEL na matrícula
    const formasAquisicaoDetectadas: string[] = [];
    if (/\bCOMPRA\s+E\s+VENDA\b/.test(txtMatNorm))
      formasAquisicaoDetectadas.push('Compra e Venda');
    if (/\bDOACAO\b/.test(txtMatNorm))
      formasAquisicaoDetectadas.push('Doação');
    if (
      /\bFORMAL\s+DE\s+PARTILHA\b|\bINVENTARIO\b|\bHERANCA\b|\bADJUDICACAO\b/.test(
        txtMatNorm
      )
    )
      formasAquisicaoDetectadas.push('Herança / Partilha / Adjudicação');
    if (/\bTITULO\s+DE\s+DOMINIO\b|\bTITULO\s+DEFINITIVO\b/.test(txtMatNorm))
      formasAquisicaoDetectadas.push('Título de Domínio / Outorga Pública');
    if (/\bUSUCAPIAO\b/.test(txtMatNorm))
      formasAquisicaoDetectadas.push('Usucapião');
    if (/\bPERMUTA\b/.test(txtMatNorm))
      formasAquisicaoDetectadas.push('Permuta');
    if (/\bDESMEMBRAMENTO\b|\bUNIFICACAO\b|\bAVERBACAO\b/.test(txtMatNorm))
      formasAquisicaoDetectadas.push('Desmembramento / Averbação');

    const resumoAquisicao =
      formasAquisicaoDetectadas.length > 0
        ? `Forma(s) de aquisição/registro na matrícula: ${formasAquisicaoDetectadas.join(', ')}.`
        : 'Forma de aquisição não isolada textualmente (conferir R-1 / AV-1).';

    // Verifica cadeia dominial de 15 anos
    const anosEncontrados = (
      txtMat.match(/\b(19[5-9]\d|20[0-2]\d)\b/g) || []
    )
      .map(Number)
      .filter((a) => a >= 1950 && a <= new Date().getFullYear());

    if (anosEncontrados.length > 0) {
      const menorAno = Math.min(...anosEncontrados);
      const idadeCadeia = new Date().getFullYear() - menorAno;
      if (idadeCadeia < 15) {
        if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
        detalhesCertidoesEImovel.push(
          `⚠️ Inteiro Teor ("${docMat.nomeOriginal}"): Registro mais antigo localizado data de ${menorAno} (${idadeCadeia} anos < 15 anos exigidos). Solicitar matrícula anterior de origem! • ${resumoAquisicao}`
        );
      } else {
        detalhesCertidoesEImovel.push(
          `✅ Inteiro Teor ("${docMat.nomeOriginal}"): Cadeia dominial de 15 anos comprovada (desde ${menorAno} — ${idadeCadeia} anos). • ${resumoAquisicao}`
        );
      }
    } else {
      detalhesCertidoesEImovel.push(
        `ℹ️ Inteiro Teor ("${docMat.nomeOriginal}"): ${resumoAquisicao}`
      );
    }

    // Verifica validade de 30 dias da emissão da certidão
    const datasEmissao =
      txtMat.match(/\b(\d{2}\/\d{2}\/202[4-9])\b/g) || [];
    if (datasEmissao.length > 0) {
      const ultimaData = datasEmissao[datasEmissao.length - 1];
      const [dd, mm, aaaa] = ultimaData.split('/').map(Number);
      const dtEm = new Date(aaaa, mm - 1, dd);
      const diasDecorridos = Math.floor(
        (Date.now() - dtEm.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDecorridos > 30) {
        statusItem15 = 'ERRO';
        detalhesCertidoesEImovel.push(
          `🚨 Inteiro Teor ("${docMat.nomeOriginal}"): Data final localizada (${ultimaData}) tem ${diasDecorridos} dias (> 30 dias de validade)!`
        );
      }
    }
  }

  // =========================================================================
  // ITEM 3: AUDITORIA DE TÍTULO DE DOMÍNIO × CLÁUSULA DE INALIENABILIDADE
  //         (PREVALÊNCIA DA DATA DA TITULAÇÃO SOBRE AVERBAÇÃO NA INTEIRO TEOR)
  // =========================================================================
  // Isola APENAS os arquivos que são realmente Título de Domínio
  // (Nunca inclui Certidão de Inteiro Teor / Matrícula, mesmo que ela cite "Título de Domínio" numa averbação!)
  const todosPdfsTituloDominio = extraidos.filter((e) => {
    if (e.isViti) return false;
    const nUp = removerAcentos(e.nomeOriginal).toUpperCase();
    const tCab = removerAcentos(e.textoCompleto).toUpperCase().substring(0, 1800);

    const ehInteiroTeorOuMatricula =
      e.categoria === 'ITEM_INTEIRO_TEOR' ||
      nUp.includes('INTEIRO TEOR') ||
      nUp.includes('MATRICULA') ||
      tCab.includes('CERTIDAO DE INTEIRO TEOR') ||
      tCab.includes('REGISTRO GERAL');

    if (ehInteiroTeorOuMatricula) return false;

    return (
      e.categoria === 'ITEM_TITULO_DOMINIO' ||
      nUp.includes('TITULO DE DOMINIO') ||
      nUp.includes('TITULO DEFINITIVO') ||
      tCab.includes('TITULO DE DOMINIO') ||
      tCab.includes('TITULO DEFINITIVO')
    );
  });

  // Detecta se a proposta / limite envolve LCGA (pelo parâmetro ou pelo texto/nome da Solicitação de Limite)
  const txtSolLimNorm = removerAcentos(
    (pdfSolicitacaoLim?.nomeOriginal || '') +
      ' ' +
      (pdfSolicitacaoLim?.textoCompleto || '')
  ).toUpperCase();
  const ehOperacaoLcga =
    params.modalidadeLimite === 'LCGA' ||
    txtSolLimNorm.includes('LCGA') ||
    txtSolLimNorm.includes('ALIENACAO FIDUCIARIA');
  const ehOperacaoLcgh =
    params.modalidadeLimite === 'LCGH' ||
    txtSolLimNorm.includes('LCGH') ||
    txtSolLimNorm.includes('HIPOTECA');
  const temGarantiaRealImovel =
    isSomenteLimite ||
    escopoSelecionado === 'COMBO_DERIVADA_E_LIMITE' ||
    ehOperacaoLcga ||
    ehOperacaoLcgh ||
    dadosProjetoParaParecer.imoveisVinculados.some((im) => im.compoeGarantia);

  const MESES_EXTENSO: Record<string, number> = {
    JANEIRO: 1,
    FEVEREIRO: 2,
    MARCO: 3,
    ABRIL: 4,
    MAIO: 5,
    JUNHO: 6,
    JULHO: 7,
    AGOSTO: 8,
    SETEMBRO: 9,
    OUTUBRO: 10,
    NOVEMBRO: 11,
    DEZEMBRO: 12,
  };

  let tituloDominioJaCumpriuPrazo = false;
  let dataTitulacaoCumpridaRef = '';

  for (const docTit of todosPdfsTituloDominio) {
    if (docTit.ehProvavelEscaneadoImagem) {
      if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
      detalhesCertidoesEImovel.push(
        `⚠️ Título de Domínio ("${docTit.nomeOriginal}") está como imagem escaneada. Abra na Lupinha (🔎) e clique em "🧠 Ler Imagem via OCR" para auditar a Cláusula e o Prazo de Inalienabilidade (LCGH vs LCGA)!`
      );
      continue;
    }

    const tNorm = removerAcentos(docTit.textoCompleto).toUpperCase();
    const possuiClausulaInalienabilidade =
      tNorm.includes('INALIENABILIDADE') ||
      tNorm.includes('INALIENAVEL') ||
      tNorm.includes('INAJENAVEL') ||
      tNorm.includes('CLAUSULA RESOLUTIVA') ||
      tNorm.includes('CLAUSULAS RESOLUTIVAS') ||
      tNorm.includes('CONDICOES RESOLUTIVAS') ||
      tNorm.includes('NAO PODERA SER ALIENADO') ||
      tNorm.includes('VEDADA A ALIENACAO');

    if (possuiClausulaInalienabilidade) {
      // 1. Extrai o prazo em anos especificado no Título (padrão = 10 anos se não especificar outro)
      const mPrazoAnos =
        tNorm.match(
          /(?:INALIENAVEL|INALIENABILIDADE|NAO\s+PODERA\s+SER\s+ALIENADO|NEGOCIADO)[\s\S]{1,120}?(?:PRAZO|PERIODO)\s+(?:MINIMO\s+)?DE\s+(\d{1,2})\s*(?:\([A-Z\s]+\)\s*)?ANOS/i
        ) ||
        tNorm.match(
          /(?:PRAZO|PERIODO)\s+DE\s+(\d{1,2})\s*(?:\([A-Z\s]+\)\s*)?ANOS[\s\S]{1,90}?(?:INALIENABILIDADE|INALIENAVEL|CLAUSULA\s+RESOLUTIVA)/i
        ) ||
        tNorm.match(/\b(10|15|5)\s*\((?:DEZ|QUINZE|CINCO)\)\s*ANOS\b/i);

      const prazoInalienabilidadeAnos =
        mPrazoAnos && mPrazoAnos[1] ? Number(mPrazoAnos[1]) : 10;

      // 2. Extrai a DATA DA TITULAÇÃO (emissão / expedição / outorga do Título de Domínio)
      let dataEmissaoTitulo: Date | null = null;
      let dataEmissaoFormatada = '';

      // Prioriza primeiro datas explícitas de expedição/emissão (numéricas ou por extenso) antes de qualquer fallback genérico
      const mDataExplicitaNum = tNorm.match(
        /(?:EMITIDO\s+EM|EXPEDIDO\s+EM|DATA\s+DE\s+EMISSAO|DATA\s+DO\s+TITULO|DATA\s+DA\s+TITULACAO|OUTORGADO\s+EM)[^0-9]{0,25}(\d{2}\/\d{2}\/(?:19[7-9]\d|20[0-2]\d))/i
      );
      const mDataExplicitaExtenso = tNorm.match(
        /(?:EMITIDO\s+EM|EXPEDIDO\s+EM|OUTORGADO\s+EM|DATA\s+DE\s+EMISSAO)?[^0-9]{0,20}\b(\d{1,2})\s+DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+(19[7-9]\d|20[0-2]\d)\b/i
      );
      const mDataFallbackNum = docTit.textoCompleto.match(
        /\b(\d{2}\/\d{2}\/(?:19[7-9]\d|20[0-2]\d))\b/
      );

      if (mDataExplicitaNum && mDataExplicitaNum[1]) {
        const [dd, mm, aaaa] = mDataExplicitaNum[1].split('/').map(Number);
        dataEmissaoTitulo = new Date(aaaa, mm - 1, dd);
        dataEmissaoFormatada = mDataExplicitaNum[1];
      } else if (mDataExplicitaExtenso) {
        const dd = Number(mDataExplicitaExtenso[1]);
        const mm = MESES_EXTENSO[mDataExplicitaExtenso[2].toUpperCase()] || 1;
        const aaaa = Number(mDataExplicitaExtenso[3]);
        dataEmissaoTitulo = new Date(aaaa, mm - 1, dd);
        dataEmissaoFormatada = `${String(dd).padStart(2, '0')}/${String(
          mm
        ).padStart(2, '0')}/${aaaa}`;
      } else if (mDataFallbackNum && mDataFallbackNum[1]) {
        const [dd, mm, aaaa] = mDataFallbackNum[1].split('/').map(Number);
        dataEmissaoTitulo = new Date(aaaa, mm - 1, dd);
        dataEmissaoFormatada = mDataFallbackNum[1];
      }

      if (dataEmissaoTitulo) {
        const anosDecorridos =
          (Date.now() - dataEmissaoTitulo.getTime()) /
          (1000 * 60 * 60 * 24 * 365.25);
        const anoLiberacao =
          dataEmissaoTitulo.getFullYear() + prazoInalienabilidadeAnos;
        const jaCumpriuPrazo = anosDecorridos >= prazoInalienabilidadeAnos;

        if (jaCumpriuPrazo) {
          tituloDominioJaCumpriuPrazo = true;
          dataTitulacaoCumpridaRef = dataEmissaoFormatada;
          detalhesCertidoesEImovel.push(
            `✅ Título de Domínio ("${docTit.nomeOriginal}"): Possui Cláusula de Inalienabilidade de ${prazoInalienabilidadeAnos} anos, porém o prazo JÁ FOI CUMPRIDO (Data da Titulação: ${dataEmissaoFormatada} — há ${anosDecorridos.toFixed(
              1
            )} anos). Imóvel apto tanto para LCGH quanto para LCGA!`
          );
        } else {
          const anosRestantes = Math.max(
            0.1,
            prazoInalienabilidadeAnos - anosDecorridos
          ).toFixed(1);

          if (ehOperacaoLcga) {
            statusItem15 = 'ERRO';
            detalhesCertidoesEImovel.push(
              `🚨 IMPEDIMENTO CRÍTICO (TÍTULO DE DOMÍNIO × LCGA): O Título ("${docTit.nomeOriginal}") possui Cláusula de Inalienabilidade VIGENTE de ${prazoInalienabilidadeAnos} anos (Data da Titulação: ${dataEmissaoFormatada} — faltam ${anosRestantes} anos, libera apenas em ${anoLiberacao}). Este imóvel NÃO PODE SER DADO EM GARANTIA POR LCGA (Alienação Fiduciária), admitindo-se SOMENTE LCGH (Hipoteca)!`
            );
          } else if (temGarantiaRealImovel) {
            if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
            detalhesCertidoesEImovel.push(
              `⚠️ RESTRIÇÃO DO TÍTULO DE DOMÍNIO ("${docTit.nomeOriginal}"): Cláusula de Inalienabilidade VIGENTE de ${prazoInalienabilidadeAnos} anos (Data da Titulação: ${dataEmissaoFormatada} — libera apenas em ${anoLiberacao}). Em garantia real, este imóvel SÓ PODE SER DADO POR LCGH (Hipoteca), sendo VEDADA a modalidade LCGA!`
            );
          } else {
            detalhesCertidoesEImovel.push(
              `ℹ️ Título de Domínio ("${docTit.nomeOriginal}"): Cláusula de Inalienabilidade vigente até ${anoLiberacao} (${prazoInalienabilidadeAnos} anos contados da Titulação em ${dataEmissaoFormatada}). Se houver garantia real, usar exclusivamente LCGH.`
            );
          }
        }
      } else {
        if (ehOperacaoLcga) {
          statusItem15 = 'ERRO';
          detalhesCertidoesEImovel.push(
            `🚨 IMPEDIMENTO (TÍTULO DE DOMÍNIO × LCGA): Foi identificada Cláusula de Inalienabilidade no Título ("${docTit.nomeOriginal}") (prazo padrão de ${prazoInalienabilidadeAnos} anos). Imóvel com inalienabilidade vigente NÃO pode ser dado em LCGA, somente em LCGH (verifique a data da titulação)!`
          );
        } else {
          if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
          detalhesCertidoesEImovel.push(
            `⚠️ Título de Domínio ("${docTit.nomeOriginal}"): Identificada Cláusula de Inalienabilidade (prazo de ${prazoInalienabilidadeAnos} anos). Caso ainda não tenha completado ${prazoInalienabilidadeAnos} anos da Data da Titulação, o imóvel SÓ pode ser dado em garantia via LCGH (vedada LCGA).`
          );
        }
      }
    } else {
      detalhesCertidoesEImovel.push(
        `✅ Título de Domínio ("${docTit.nomeOriginal}"): Inspecionado (sem cláusula de inalienabilidade impeditiva detectada).`
      );
    }
  }

  // Se a Certidão de Inteiro Teor possuir "AVERBAÇÃO DE INALIENABILIDADE":
  // 1) Se o Título de Domínio na pasta já comprovou o cumprimento do prazo (contado da Data da Titulação),
  //    NÃO gera alerta de impedimento pela data da averbação/certidão da Inteiro Teor e confirma que a LCGA é permitida!
  // 2) Se NÃO houver arquivo de Título de Domínio separado na pasta, busca na averbação da Inteiro Teor
  //    exclusivamente a data de expedição do Título ("Título de Domínio ... expedido em ..."), nunca a data final da certidão!
  for (const docMat of todosPdfsInteiroTeor) {
    if (docMat.ehProvavelEscaneadoImagem) continue;
    const tMatNorm = removerAcentos(docMat.textoCompleto).toUpperCase();
    const temAverbacaoInalienabilidade =
      tMatNorm.includes('AVERBACAO DE INALIENABILIDADE') ||
      tMatNorm.includes('GRAVADO COM CLAUSULA DE INALIENABILIDADE');

    if (!temAverbacaoInalienabilidade) continue;

    if (tituloDominioJaCumpriuPrazo) {
      detalhesCertidoesEImovel.push(
        `✅ Averbação de Inalienabilidade na Matrícula ("${docMat.nomeOriginal}"): Embora conste averbação na Inteiro Teor, o prazo é contado da Data da Titulação (${dataTitulacaoCumpridaRef}) comprovada no Título de Domínio. Prazo de 10 anos JÁ CUMPRIDO — permitido LCGA e LCGH!`
      );
    } else if (todosPdfsTituloDominio.length === 0) {
      // Só analisa pela Inteiro Teor caso o PDF do Título de Domínio não esteja na pasta,
      // extraindo estritamente a data de expedição do Título citada dentro do texto da averbação!
      const mExpedicaoTitNaMat =
        tMatNorm.match(
          /TITULO\s+DE\s+DOMINIO[\s\S]{1,80}?(?:EXPEDIDO|EMITIDO|OUTORGADO)\s+EM\s+(\d{1,2})\s+DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+(19[7-9]\d|20[0-2]\d)/i
        ) ||
        tMatNorm.match(
          /TITULO\s+DE\s+DOMINIO[\s\S]{1,80}?(?:EXPEDIDO|EMITIDO|OUTORGADO)\s+EM\s+(\d{2}\/\d{2}\/(?:19[7-9]\d|20[0-2]\d))/i
        );

      if (mExpedicaoTitNaMat) {
        let dtTitMat: Date;
        let dtTitMatFmt = '';
        if (mExpedicaoTitNaMat[2]) {
          const dd = Number(mExpedicaoTitNaMat[1]);
          const mm =
            MESES_EXTENSO[mExpedicaoTitNaMat[2].toUpperCase()] || 1;
          const aaaa = Number(mExpedicaoTitNaMat[3]);
          dtTitMat = new Date(aaaa, mm - 1, dd);
          dtTitMatFmt = `${String(dd).padStart(2, '0')}/${String(mm).padStart(
            2,
            '0'
          )}/${aaaa}`;
        } else {
          const [dd, mm, aaaa] = mExpedicaoTitNaMat[1].split('/').map(Number);
          dtTitMat = new Date(aaaa, mm - 1, dd);
          dtTitMatFmt = mExpedicaoTitNaMat[1];
        }

        const anosTitMat =
          (Date.now() - dtTitMat.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (anosTitMat >= 10) {
          detalhesCertidoesEImovel.push(
            `✅ Averbação de Inalienabilidade na Matrícula ("${docMat.nomeOriginal}"): Prazo de 10 anos contado da Data da Titulação (${dtTitMatFmt} — há ${anosTitMat.toFixed(
              1
            )} anos) JÁ CUMPRIDO. Imóvel apto para LCGA e LCGH!`
          );
        } else {
          const anoLibMat = dtTitMat.getFullYear() + 10;
          if (ehOperacaoLcga) {
            statusItem15 = 'ERRO';
            detalhesCertidoesEImovel.push(
              `🚨 IMPEDIMENTO (AVERBAÇÃO DE INALIENABILIDADE × LCGA): A matrícula ("${docMat.nomeOriginal}") registra Título de Domínio expedido em ${dtTitMatFmt} com Cláusula de Inalienabilidade vigente até ${anoLibMat}. Só pode ser dado em garantia por LCGH (vedada LCGA)!`
            );
          } else {
            if (statusItem15 === 'OK') statusItem15 = 'ALERTA';
            detalhesCertidoesEImovel.push(
              `⚠️ Averbação de Inalienabilidade na Matrícula ("${docMat.nomeOriginal}"): Título expedido em ${dtTitMatFmt} (cláusula vigente até ${anoLibMat} — somente LCGH).`
            );
          }
        }
      }
    }
  }

  if (detalhesCertidoesEImovel.length > 0) {
    itensDiagnostico.push({
      numero: 15,
      titulo:
        '15. Prazos de Validade (CND, CNDT, ITR, CCIR), Inteiro Teor (15 Anos) e Título de Domínio (LCGH × LCGA)',
      status: statusItem15,
      resumo:
        statusItem15 === 'ERRO'
          ? '🚨 Há certidão vencida ou impedimento de Cláusula de Inalienabilidade (Título de Domínio × LCGA)!'
          : statusItem15 === 'ALERTA'
          ? '⚠️ Atenção para certidões próximas do vencimento, PDFs escaneados ou restrição de Título de Domínio (somente LCGH).'
          : 'Todas as certidões, matrículas e títulos verificados estão dentro das regras.',
      detalhes: detalhesCertidoesEImovel,
    });
  }

  const pdfS400 = extraidos.find((e) => {
    if (e.isViti) return false;
    const nUp = removerAcentos(e.nomeOriginal).toUpperCase();
    const tUp = removerAcentos(e.textoCompleto).toUpperCase();

    // Nunca confundir "Proposta de Cadastro" nem o PDF do "Projeto" com a Ficha S400!
    if (
      nUp.includes('PROPOSTA DE CADASTRO') ||
      nUp.includes('PROPOSTA CADASTRO') ||
      e.categoria === 'CAD_5_PROPOSTA_CADASTRO' ||
      e.categoria === 'ITEM_12_PROJETO_PDF' ||
      e.categoria === 'ITEM_9_CONSOLIDADAS'
    ) {
      return false;
    }

    const nomeIndicaS400 =
      /\bS400\b/.test(nUp) ||
      nUp.includes('FICHA CADASTRAL') ||
      nUp.includes('FICHA CADASTRO') ||
      nUp.includes('FICHA DO CLIENTE');

    const tituloInternoIndicaS400 =
      tUp.includes('S400 - CENTRAL DE CADASTRO - CLIENTES') ||
      tUp.includes('CENTRAL DE CADASTRO - CLIENTES') ||
      tUp.includes('DADOS CADASTRAIS DO CLIENTE PESSOA FISICA');

    return nomeIndicaS400 || tituloInternoIndicaS400;
  });

  if (pdfS400) {
    const txtS400Norm = normalizarSemAcento(pdfS400.textoCompleto);
    const ativProjNorm = normalizarSemAcento(
      dadosProjetoParaParecer.atividadePrincipal
    );
    const munProjNorm = normalizarSemAcento(
      (dadosProjetoParaParecer.municipioImovel || paEsperado).split('-')[0] ||
        ''
    );

    const palavrasAtiv = ativProjNorm
      .split(/\s+/)
      .filter((p) => p.length > 3 && !['PARA', 'CRIACAO', 'CULTIVO'].includes(p));

    const ativConstaNoS400 =
      palavrasAtiv.length === 0 ||
      palavrasAtiv.some((pal) => txtS400Norm.includes(pal));
    const munConstaNoS400 =
      !munProjNorm ||
      munProjNorm.length < 3 ||
      txtS400Norm.includes(munProjNorm);

    const matchDataRenov = pdfS400.textoCompleto.match(
      /(?:Atualiza[çc][ãa]o|Renova[çc][ãa]o|Data\s+Cadastro)[^0-9]{0,25}(\d{2}\/\d{2}\/20\d{2})/i
    );
    let cadastroVencido12Meses = false;
    let mesesCadastro = 0;
    if (matchDataRenov && matchDataRenov[1]) {
      const [dd, mm, aaaa] = matchDataRenov[1].split('/').map(Number);
      const dtRen = new Date(aaaa, mm - 1, dd);
      mesesCadastro = Math.floor(
        (Date.now() - dtRen.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      if (mesesCadastro >= 12) cadastroVencido12Meses = true;
    }

    const okS400 =
      ativConstaNoS400 && munConstaNoS400 && !cadastroVencido12Meses;

    // Só exibe o alerta do Item 16 se a Ficha S400 existir na pasta E apresentar alguma divergência ou vencimento!
    if (!okS400) {
      itensDiagnostico.push({
        numero: 16,
        titulo: `16. Divergência na Ficha S400 Encontrada na Pasta (${pdfS400.nomeOriginal})`,
        status: 'ERRO',
        resumo:
          '🚨 A Ficha S400 presente na pasta apresenta divergência com o Projeto ou Cadastro vencido há ≥ 12 meses!',
        detalhes: [
          !ativConstaNoS400 || !munConstaNoS400
            ? `🚨 ATENÇÃO: A atividade (${
                dadosProjetoParaParecer.atividadePrincipal || '?'
              }) ou o município (${
                dadosProjetoParaParecer.municipioImovel || '?'
              }) do projeto NÃO foram encontrados em conjunto na Ficha S400!`
            : `✅ Atividade e Município compatíveis na Ficha S400.`,
          cadastroVencido12Meses
            ? `🚨 Cadastro no S400 vencido há ${mesesCadastro} meses (Data: ${matchDataRenov?.[1]}) — Necessário RENOVAR CADASTRO!`
            : '',
        ].filter(Boolean),
      });
    }
  }

  // Atualiza o cache do Parecer Gerencial com a Conta Corrente extraída da Consolidada (ou da Conformidade)
  if (contaCorrenteConsolidada || contaConformidade) {
    dadosProjetoParaParecer.contaCorrenteExtraida =
      contaCorrenteConsolidada || contaConformidade || '';
  }
  if (pdfProjeto || pdfSolicitacaoLim || contaCorrenteConsolidada) {
    salvarDadosExtraidosParaParecer(dadosProjetoParaParecer);
  }
  
  
  return {
    valorPropostaDetectado,
    prazoMesesDetectado: dadosProjetoParaParecer.prazoMeses,
    carenciaMesesDetectada: dadosProjetoParaParecer.carenciaMeses,
    elaboradorDetectado: dadosProjetoParaParecer.elaboradorNomeCompleto,
    projetistaCurtoDetectado:
      dadosProjetoParaParecer.projetistaNomeCurtoDetectado,
    objetivoCreditoDetectado:
      dadosProjetoParaParecer.objetivoCurto ||
      dadosProjetoParaParecer.objetivoJustificativaCompleta,
    objetivoJustificativaCompleta:
      dadosProjetoParaParecer.objetivoJustificativaCompleta,
    itensInversaoExtraidos: dadosProjetoParaParecer.itensInversao,
    textoItensInversaoFormatado:
      dadosProjetoParaParecer.textoItensInversaoFormatado,
    dadosProjetoParaParecer,
    contaCorrenteConsolidada,
    agenciaConsolidadaDetectada,
    statusContaConsolidada,
    paDetectadoNoProjeto,
    carEspecificoDetectado,
    estadoCivilDetectado,
    conjugeDetectadoNosPdfs: conjugeEfetivo,
    arquivosComAssinaturaDigital,
    arquivosSemAssinaturaDigital,
    reclassificacoesSocioambiental,
    reclassificacoesPorConteudo,
    imoveisDetectadosNosDocumentos,
    kmlCorrigidoAutomaticamente,
    exigenciasSocioambientaisDetectadas,
    itensDiagnostico: itensDiagnostico.sort((a, b) => a.numero - b.numero),
  };
}