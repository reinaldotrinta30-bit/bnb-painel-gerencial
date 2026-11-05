// src/lib/auditorInteligentePdfPasta.ts
import {
  formatarMoedaBD,
  parseMoeda,
  obterListaProjetistas,
} from '@/lib/utils';

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
  conjugeNome: string;
  conjugeCpf: string;
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
  paDetectadoNoProjeto: string;
  carEspecificoDetectado: string;
  estadoCivilDetectado: string;
  conjugeDetectadoNosPdfs: string;
  arquivosComAssinaturaDigital: string[];
  arquivosSemAssinaturaDigital: string[];
  itensDiagnostico: ItemDiagnosticoPdf[];
}

export const STORAGE_KEY_DADOS_PROJETO_PARECER =
  'bnb_v2_dados_projeto_extraidos_parecer';

export function salvarDadosExtraidosParaParecer(
  dados: DadosExtraidosProjetoParecer
): void {
  if (typeof window === 'undefined') return;
  try {
    const atualRaw = window.localStorage.getItem(
      STORAGE_KEY_DADOS_PROJETO_PARECER
    );
    const mapa: Record<string, DadosExtraidosProjetoParecer> = atualRaw
      ? JSON.parse(atualRaw)
      : {};

    const chaveNome = normalizarSemAcento(dados.clienteNome);
    const chaveCpf = (dados.clienteCpf || '').replace(/\D/g, '');
    if (chaveNome) mapa[chaveNome] = dados;
    if (chaveCpf.length >= 9) mapa[chaveCpf] = dados;
    mapa['ULTIMO_PROJETO_LIDO'] = dados;

    window.localStorage.setItem(
      STORAGE_KEY_DADOS_PROJETO_PARECER,
      JSON.stringify(mapa)
    );
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
    .replace(/^(P\s*A|ASSENTAMENTO|PROJETO DE ASSENTAMENTO|FAZENDA|SITIO)\s+/i, '')
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

async function extrairTextoEAssinaturaDoPdf(
  file: File,
  categoria: string,
  isViti: boolean
): Promise<PdfExtraidoInfo> {
  const buffer = await file.arrayBuffer();
  const possuiAssinaturaDigital = detectarAssinaturaDigitalNoBinarioPdf(buffer);

  let textoCompleto = '';
  let numPaginas = 1;

  try {
    const pdfjsLib = await obterPdfJsLib();
    if (pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const pdf = await loadingTask.promise;
      numPaginas = pdf.numPages || 1;

      const limitePags = Math.min(numPaginas, 35);
      const textosPaginas: string[] = [];

      for (let p = 1; p <= limitePags; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const strings = (content.items || []).map((it: any) => it.str || '');
        textosPaginas.push(`[PÁG ${p}] ` + strings.join(' '));
      }
      textoCompleto = textosPaginas.join('\n');
    }
  } catch {
    // Ignora erro
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
    numPaginas,
    possuiAssinaturaDigital: possuiAssinaturaDigital || assinaturaPeloTexto,
    ehProvavelEscaneadoImagem: mediaCharsPorPagina < 45,
  };
}

export function extrairDadosDetalhadosDoPdfProjeto(
  textoProjeto: string
): DadosExtraidosProjetoParecer {
  const resultado: DadosExtraidosProjetoParecer = {
    clienteNome: '',
    clienteCpf: '',
    conjugeNome: '',
    conjugeCpf: '',
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

  // 1. Detecção Automática de Porte pelo Programa (368 / 699 / 673 = PRONAF A | 433 / 406 / 407 = PRONAF V | 226 = MINI/PEQUENO)
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

  // 2. Detecção Automática de Modalidade (Investimento vs Custeio)
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

  // 3. Elaborador / Projetista
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

  // 4. Estado Civil e Cônjuge
  const matchEstCivil = textoLimpo.match(
    /Estado\s+Civil:\s*(Solteiro\(a\)|Casado\(a\)|Uni[ãa]o\s+Est[áa]vel|Vi[úu]vo\(a\)|Divorciado\(a\))/i
  );
  if (matchEstCivil && matchEstCivil[1]) {
    resultado.estadoCivil = matchEstCivil[1].trim().toUpperCase();
  }

  const matchConjuge = textoLimpo.match(
    /Companheira\(o\)\s+do\(a\)\s+Cliente\s+(?:Dados\s+)?Nome:\s*([A-ZÀ-Ú\s]{4,60}?)\s+C\.?P\.?F\.?\s*C[ôo]njuge\/Comp\.?:\s*([0-9.\-]{8,14})/i
  );
  if (matchConjuge) {
    const candConj = matchConjuge[1].trim().toUpperCase();
    if (!candConj.includes('DATA DE') && !candConj.includes('SEXO')) {
      resultado.conjugeNome = candConj;
      resultado.conjugeCpf = matchConjuge[2].trim();
    }
  }

  // 5. Denominação do Imóvel Principal e Tabela "Imóveis Vinculados ao Plano" (Itens 2.3 e 2.3.1)
  const matchDenom = textoLimpo.match(
    /Denomina[çc][ãa]o\s+do\s+im[óo]vel:\s*([A-ZÀ-Ú0-9\s.\-]{3,50}?)\s+[ÁA]rea\s+do\s+im[óo]vel\s*\(ha\):\s*([0-9.,]+)/i
  );
  if (matchDenom) {
    resultado.denominacaoImovelPa = matchDenom[1].trim().toUpperCase();
    resultado.areaImovelHa = matchDenom[2].trim();
  }

  // Extrai todas as linhas da tabela "Imóveis Vinculados ao Plano" (ex: "PA LAGO DA CARNAUBA PIO XII-MA P.Fisica ISMAEL... 932526763-20 22,78 Sim Não")
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

  // Verifica se a Avaliação do Imóvel no Projeto é >= R$ 600.000,00 (para exigir Laudo Interno)
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

  // 6. Prazo, Carência, Periodicidade e Juros
  const idxCalcFin = normSemAcento.indexOf('CALCULO DO FINANCIAMENTO');
  const trechoFin =
    idxCalcFin !== -1
      ? normSemAcento.substring(idxCalcFin, idxCalcFin + 900)
      : normSemAcento;

  const matchBlocoTabelaFin = trechoFin.match(
    /\b(12|24|36|48|60|72|84|96|108|120|144)\s+(ANUAL|MENSAL|SEMESTRAL)\s+(\d{4,7}(?:[.,]\d{2})?)\s+CARENCIA:\s+JUROS\s*\(A\.A\.\):\s*(\d{1,2})\s+([0-9.,]+%)/i
  );
  if (matchBlocoTabelaFin) {
    resultado.prazoMeses = matchBlocoTabelaFin[1];
    resultado.periodicidadeReembolso = matchBlocoTabelaFin[2];
    resultado.carenciaMeses = matchBlocoTabelaFin[4];
    resultado.taxaJurosAa = matchBlocoTabelaFin[5];
  } else {
    const mPrazo =
      trechoFin.match(/PRAZO\s*:?\s*(\d{2,3})\b/i) ||
      trechoFin.match(/\b(120|96|84|72|60|36|24)\s+(?:ANUAL|MENSAL)\b/i);
    if (mPrazo && mPrazo[1]) resultado.prazoMeses = mPrazo[1];

    const mCarencia =
      trechoFin.match(
        /CARENCIA\s*:?\s*(?:JUROS[^0-9]{0,15})?\b(0|6|12|24|36|48|60)\b/i
      ) || trechoFin.match(/\b(36|24|12|48)\s+[0-9.,]+%/i);
    if (mCarencia && mCarencia[1]) resultado.carenciaMeses = mCarencia[1];
  }

  // 7. Objetivo e Justificativa
  const matchObjCurto = textoLimpo.match(
    /Objetivo\s+do\s+Cr[ée]dito:\s*(?:\d{2}\/\d{2}\/\d{4}\s+)?(Amplia[çc][ãa]o|Implanta[çc][ãa]o|Moderniza[çc][ãa]o|Reforma|Custeio|Manuten[çc][ãa]o|Expans[ãa]o)/i
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

  // 8. Itens de Inversão Financiados
  const regexItensPag4 =
    /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.,\/\-º°]{5,85}?)\s+(?:N[ãa]o|Sim)\s+(\d+(?:[.,]\d+)?)\s+(Ha|Unidade|unid|m|m2|m³|km|vb|Verba|Conjunto|Cabe[çc]a)\s+(?:Cobertura\s+do\s+Solo|Semovente\s*s?|Edifica[çc][õo]es|M[áa]quinas|Instala[çc][õo]es| Outros|[A-Za-zÀ-ú\s]+?)\s+\d+\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s+)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;

  let mItem: RegExpExecArray | null;
  while ((mItem = regexItensPag4.exec(textoLimpo)) !== null) {
    let disc = mItem[1]
      .replace(
        /^(?:Investimento\s+Total|Valor\s+Financiam\.|Programa\s+de\s+Investimentos|Comp[õo]e\s+Garantia\??|Discrimina[çc][ãa]o)\s+/gi,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();
    disc = disc.replace(/^\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s+/, '').trim();

    const qtd = mItem[2].replace('.', ',');
    const unid = mItem[3].trim();
    const vrUnit = mItem[4].replace(/\.(?=\d{2}$)/, ',');
    const vrFin = mItem[5].replace(/\.(?=\d{2}$)/, ',');

    if (disc.length >= 4 && !disc.toUpperCase().includes('SUBTOTAL')) {
      resultado.itensInversao.push({
        discriminacao: disc.toUpperCase(),
        quantidade: qtd,
        unidade: unid,
        valorUnitario: vrUnit,
        valorFinanciado: vrFin,
      });
    }
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

// ============================================================================
// AUDITORIA ADAPTATIVA AO PORTE, ESCOPO E MODALIDADE SELECIONADOS (ITEM 1)
// ============================================================================
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
  escopoSelecionado?:
    | 'PRONAF_A_PADRAO'
    | 'DERIVADA_PURA'
    | 'LIMITE_PURO'
    | 'COMBO_DERIVADA_E_LIMITE';
  modalidadeDerivada?: 'INVESTIMENTO' | 'CUSTEIO';
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

  const pdfsParaLer = arquivos.filter(
    (a) =>
      a.categoria !== 'IGNORAR' &&
      a.fileObj.name.toLowerCase().endsWith('.pdf')
  );

  const extraidos: PdfExtraidoInfo[] = [];
  for (const item of pdfsParaLer) {
    const info = await extrairTextoEAssinaturaDoPdf(
      item.fileObj,
      item.categoria,
      item.isViti
    );
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
  const pdfIdTitular = obterPorCat('CAD_1_IDENTIDADE_TITULAR', false);
  const pdfIdConjuge = obterPorCat('CAD_1_IDENTIDADE_CONJUGE', false);

  const dadosProjetoParaParecer = extrairDadosDetalhadosDoPdfProjeto(
    (pdfProjeto?.textoCompleto || '') +
      '\n' +
      (pdfSolicitacaoLim?.textoCompleto || '')
  );
  if (titularNome && !dadosProjetoParaParecer.clienteNome) {
    dadosProjetoParaParecer.clienteNome = titularNome;
  }
  if (pdfProjeto || pdfSolicitacaoLim) {
    salvarDadosExtraidosParaParecer(dadosProjetoParaParecer);
  }

  const conjugeEfetivo =
    conjugeNome.trim() || dadosProjetoParaParecer.conjugeNome || '';

  const itensDiagnostico: ItemDiagnosticoPdf[] = [];

  // 1. CONTA CORRENTE NA CONSOLIDADA (Comum a todos os perfis)
  let contaCorrenteConsolidada = '';
  if (!pdfConsolidada) {
    itensDiagnostico.push({
      numero: 1,
      titulo: '1. Conta Corrente nas Declarações Consolidadas',
      status: 'ERRO',
      resumo: 'Arquivo de Declarações Consolidadas não localizado na pasta.',
    });
  } else if (pdfConsolidada.ehProvavelEscaneadoImagem) {
    itensDiagnostico.push({
      numero: 1,
      titulo: '1. Conta Corrente nas Declarações Consolidadas',
      status: 'ALERTA',
      resumo:
        'PDF da Consolidada está escaneado em imagem. Verifique visualmente o campo de débito em conta.',
    });
  } else {
    const txtCons = removerAcentos(pdfConsolidada.textoCompleto).toUpperCase();
    const matchCc =
      txtCons.match(
        /(?:MOVIMENTACAO\s+DE\s+N(?:º|°|UMERO)?|CONTA\s+CORRENTE\s*:?|DEBITAR\s+EM\s+SUA\s+CONTA[^0-9]{1,35})\s*([0-9]{3,10}\s*[-–]\s*[0-9X]|[0-9]{4,10})/i
      ) ||
      txtCons.match(
        /AGENCIA\s+[0-9]{2,5}[^0-9]{1,25}C\/?C\s*:?\s*([0-9.\-X]{4,12})/i
      );

    if (matchCc && matchCc[1]) {
      contaCorrenteConsolidada = matchCc[1].replace(/\s+/g, '');
      const confereComPlanilha =
        !contaConformidade ||
        contaConformidade.replace(/\D/g, '') ===
          contaCorrenteConsolidada.replace(/\D/g, '');

      itensDiagnostico.push({
        numero: 1,
        titulo: '1. Conta Corrente nas Declarações Consolidadas',
        status: confereComPlanilha ? 'OK' : 'ALERTA',
        resumo: confereComPlanilha
          ? `Conta identificada na Consolidada: ${contaCorrenteConsolidada}.`
          : `Conta na Consolidada (${contaCorrenteConsolidada}) diverge da planilha (${contaConformidade})!`,
      });
    } else {
      itensDiagnostico.push({
        numero: 1,
        titulo: '1. Conta Corrente nas Declarações Consolidadas',
        status: 'ALERTA',
        resumo:
          'Não foi possível confirmar o nº da conta no texto da Consolidada. Confira manualmente.',
      });
    }
  }

  // 2 E 8. VALOR, PRAZO, CARÊNCIA, ELABORADOR E ORÇAMENTO (Adaptado ao Escopo)
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

  // 5. ITEM ADAPTATIVO POR PORTE:
  // - Se PRONAF A: Audita Espelho da UND + P.A. e CAR
  // - Se PRONAF V ou MINI/PEQUENO ou LIMITE: Audita Imóveis de Benfeitoria (Inversão) vs Imóveis de Garantia (Itens 2.3 e 2.3.1)!
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
    // Portes PRONAF V e MINI/PEQUENO: Mostra o mapeamento dos Imóveis de Inversão (Benfeitoria) e Imóveis de Garantia (Itens 2.3 e 2.3.1)
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

  // 6. VALIDADE DA CAF (Apenas para PRONAF A e PRONAF V — Não exibido para MINI/PEQUENO!)
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

  const temDocConjugeNaPasta =
    Boolean(pdfIdConjuge) || Boolean(conjugeEfetivo);

  const estadoCivilDetectado =
    estadoCivilNoProj ||
    (possuiConjugeReal ? 'CASADO(A) / UNIÃO ESTÁVEL' : 'SOLTEIRO(A)');

  itensDiagnostico.push({
    numero: 10,
    titulo: '10. Consistência de Estado Civil e Documentação do Cônjuge',
    status: possuiConjugeReal && !temDocConjugeNaPasta ? 'ERRO' : 'OK',
    resumo:
      possuiConjugeReal && !temDocConjugeNaPasta
        ? '🚨 ALERTA: O Projeto/Documentos indicam Cônjuge ou União Estável, mas NÃO HÁ documento de identificação do Cônjuge na pasta!'
        : possuiConjugeReal
        ? `Estado civil (${estadoCivilDetectado}) consistente e Cônjuge (${
            conjugeEfetivo || 'Identificado'
          }) validado.`
        : 'Titular Solteiro(a) / Sem Cônjuge (Não exige certidões nem documentos de cônjuge).',
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
    paDetectadoNoProjeto,
    carEspecificoDetectado,
    estadoCivilDetectado,
    conjugeDetectadoNosPdfs: conjugeEfetivo,
    arquivosComAssinaturaDigital,
    arquivosSemAssinaturaDigital,
    itensDiagnostico: itensDiagnostico.sort((a, b) => a.numero - b.numero),
  };
}