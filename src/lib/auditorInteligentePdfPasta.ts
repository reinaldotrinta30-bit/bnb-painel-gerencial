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

export interface DadosExtraidosProjetoParecer {
  clienteNome: string;
  clienteCpf: string;
  conjugeNome: string;
  conjugeCpf: string;
  estadoCivil: string;
  denominacaoImovelPa: string;
  municipioImovel: string;
  areaImovelHa: string;
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

// Salva os dados extraídos do PDF 12 (Projeto) por CPF e por Nome para a aba Parecer Gerencial consumir automaticamente
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
    // Ignora erro de quota
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

// Compara se um termo (como "P.A SÃO JOÃO DO CARÚ" ou "LAGO DA CARNAÚBA") consta em um texto de PDF
// ignorando acentos, pontuação e tolerando pequenas variações de OCR/digitação (como LADO vs LAGO, CARANUBA vs CARNAUBA)
function textoContemTermoFlexivel(
  textoAlvoBruto: string,
  termoBuscaBruto: string
): boolean {
  const textoNorm = normalizarSemAcento(textoAlvoBruto);
  const termoNorm = normalizarSemAcento(termoBuscaBruto)
    .replace(/^(P\s*A|ASSENTAMENTO|PROJETO DE ASSENTAMENTO)\s+/i, '')
    .trim();

  if (!termoNorm || termoNorm.length < 3) return true;
  if (textoNorm.includes(termoNorm)) return true;

  // Divide em palavras relevantes (> 2 letras, ignorando preposições DO/DA/DE)
  const palavrasTermo = termoNorm
    .split(/\s+/)
    .filter((p) => p.length > 2 && !['DOS', 'DAS', 'COM', 'POR'].includes(p));

  if (palavrasTermo.length === 0) return true;

  // Se pelo menos metade das palavras-chave baterem (ou tiverem distância de edição <= 2, ex: CARNAUBA vs CARANUBA), valida!
  const palavrasTexto = textoNorm.split(/\s+/);
  let acertos = 0;

  for (const pal of palavrasTermo) {
    if (textoNorm.includes(pal)) {
      acertos++;
      continue;
    }
    // Verifica similaridade para tolerar 1 ou 2 letras trocadas (ex: LAGO->LADO, CARNAUBA->CARANUBA)
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

// Extrator especializado na "PLANILHA PRONAF A - Versão 2.0" e Projetos BNB (Páginas 1 a 20)
export function extrairDadosDetalhadosDoPdfProjeto(
  textoProjeto: string
): DadosExtraidosProjetoParecer {
  const resultado: DadosExtraidosProjetoParecer = {
    clienteNome: '',
    clienteCpf: '',
    conjugeNome: '',
    conjugeCpf: '',
    estadoCivil: '',
    denominacaoImovelPa: '',
    municipioImovel: '',
    areaImovelHa: '',
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

  // 1. Elaborador / Projetista (Páginas 4 e 5: "Elaborador: JOSE FRANCISCO LIMA SEIXAS C.P.F: 839104843-87")
  const matchElab =
    textoLimpo.match(
      /Elaborador:\s*([A-ZÀ-Ú\s]{5,65}?)(?:\s+Proposta|\s+C\.?P\.?F|\s+Data|\s+\[PÁG|$)/i
    ) ||
    textoLimpo.match(
      /30 de [a-zç]+ de 20\d{2}\s+([A-ZÀ-Ú\s]{5,60}?)\s+C\.?P\.?F\.?\s*N?º?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
    );

  if (matchElab && matchElab[1]) {
    resultado.elaboradorNomeCompleto = matchElab[1].trim().toUpperCase();
  }

  const matchCpfElab = textoLimpo.match(
    /Elaborador:[\s\S]{1,80}?C\.?P\.?F\.?\s*:?\s*N?º?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
  );
  if (matchCpfElab && matchCpfElab[1]) {
    resultado.elaboradorCpf = matchCpfElab[1].trim();
  }

  // Cruza com a lista de Projetistas cadastrados na aba Ferramentas (pelo CPF ou pelo Nome Completo)
  const projetistasCadastrados = obterListaProjetistas();
  const cpfElabDigits = resultado.elaboradorCpf.replace(/\D/g, '');
  const nomeElabNorm = normalizarSemAcento(resultado.elaboradorNomeCompleto);

  const projMatch = projetistasCadastrados.find((p) => {
    const pCpf = (p.cpf || '').replace(/\D/g, '');
    const pComp = normalizarSemAcento(p.nomeCompleto || '');
    const pCurto = normalizarSemAcento(p.nomeCurto || '');
    if (cpfElabDigits.length === 11 && pCpf === cpfElabDigits) return true;
    if (nomeElabNorm && pComp && (nomeElabNorm.includes(pComp) || pComp.includes(nomeElabNorm)))
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

  // 2. Estado Civil e Cônjuge (Páginas 1 e 2)
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

  // 3. Denominação do Imóvel / P.A., Município e Área (ha) (Página 1)
  const matchDenom = textoLimpo.match(
    /Denomina[çc][ãa]o\s+do\s+im[óo]vel:\s*([A-ZÀ-Ú0-9\s.\-]{3,50}?)\s+[ÁA]rea\s+do\s+im[óo]vel\s*\(ha\):\s*([0-9.,]+)/i
  );
  if (matchDenom) {
    resultado.denominacaoImovelPa = matchDenom[1].trim().toUpperCase();
    resultado.areaImovelHa = matchDenom[2].trim();
  }

  // 4. Prazo, Carência, Periodicidade e Taxa de Juros (Página 15 — "RELATÓRIO FINANCIAMENTO PROPOSTO")
  // No PDF do Projeto PRONAF A, os rótulos e números saem agrupados no quadro "CÁLCULO DO FINANCIAMENTO"
  const idxCalcFin = normSemAcento.indexOf('CALCULO DO FINANCIAMENTO');
  const trechoFin =
    idxCalcFin !== -1
      ? normSemAcento.substring(idxCalcFin, idxCalcFin + 900)
      : normSemAcento;

  // Padrão 1: "PER. REEMBOLSO: VALOR 120 ANUAL 50000 CARENCIA: JUROS (A.A.): 36 0,50%"
  const matchBlocoTabelaFin = trechoFin.match(
    /\b(60|72|84|96|108|120)\s+(ANUAL|MENSAL|SEMESTRAL)\s+(\d{4,7}(?:[.,]\d{2})?)\s+CARENCIA:\s+JUROS\s*\(A\.A\.\):\s*(\d{1,2})\s+([0-9.,]+%)/i
  );
  if (matchBlocoTabelaFin) {
    resultado.prazoMeses = matchBlocoTabelaFin[1];
    resultado.periodicidadeReembolso = matchBlocoTabelaFin[2];
    resultado.carenciaMeses = matchBlocoTabelaFin[4];
    resultado.taxaJurosAa = matchBlocoTabelaFin[5];
  } else {
    // Padrão 2: Busca individual flexível dentro do relatório de financiamento proposto
    const mPrazo =
      trechoFin.match(/PRAZO\s*:?\s*(\d{2,3})\b/i) ||
      trechoFin.match(/\b(120|96|84|72|60)\s+(?:ANUAL|MENSAL)\b/i);
    if (mPrazo && mPrazo[1]) resultado.prazoMeses = mPrazo[1];

    const mCarencia =
      trechoFin.match(/CARENCIA\s*:?\s*(?:JUROS[^0-9]{0,15})?\b(12|24|36|48|60)\b/i) ||
      trechoFin.match(/\b(36|24|12|48)\s+0[.,]50%/i);
    if (mCarencia && mCarencia[1]) resultado.carenciaMeses = mCarencia[1];
  }

  // 5. Objetivo Curto ("Ampliação" / "Implantação" / "Modernização") e Texto Completo de Justificativa (Página 4)
  const matchObjCurto = textoLimpo.match(
    /Objetivo\s+do\s+Cr[ée]dito:\s*(?:\d{2}\/\d{2}\/\d{4}\s+)?(Amplia[çc][ãa]o|Implanta[çc][ãa]o|Moderniza[çc][ãa]o|Reforma|Custeio)/i
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

  // 6. Extração dos Itens de Inversão Financiados (Página 4 "Programa de Investimentos" e Página 6 "INFORMAÇÕES COMPLEMENTARES DOS INVESTIMENTOS")
  // Padrão da Página 4: "<DISCRIMINAÇÃO> Não <QUANT> <UNID> <USO> 1 <VR_UNIT> <VR_FINANC> <INV_TOTAL>"
  const regexItensPag4 =
    /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.,\/\-º°]{5,85}?)\s+(?:N[ãa]o|Sim)\s+(\d+(?:[.,]\d+)?)\s+(Ha|Unidade|unid|m|m2|m³|km|vb|Verba|Conjunto|Cabe[çc]a)\s+(?:Cobertura\s+do\s+Solo|Semovente\s*s?|Edifica[çc][õo]es|M[áa]quinas|Instala[çc][õo]es| Outros|[A-Za-zÀ-ú\s]+?)\s+\d+\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s+)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;

  let mItem: RegExpExecArray | null;
  while ((mItem = regexItensPag4.exec(textoLimpo)) !== null) {
    let disc = mItem[1]
      .replace(/^(?:Investimento\s+Total|Valor\s+Financiam\.|Programa\s+de\s+Investimentos|Comp[õo]e\s+Garantia\??|Discrimina[çc][ãa]o)\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove eventual valor monetário residual do item anterior colado no início
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

  // Fallback Página 6 caso a Página 4 tenha variação de layout: "INFORMAÇÕES COMPLEMENTARES DOS INVESTIMENTOS"
  if (resultado.itensInversao.length === 0) {
    const regexItensPag6 =
      /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.,\/\-]{5,65}?)\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+01\s+(PASTAGEM|BOVINOS|CAPRINOS|OVINOS|SUINOS|AVES|CERCA|ACUDE|CURRAL|INSTALACOES|MAQUINAS|[A-ZÀ-Ú]+)/gi;
    let m6: RegExpExecArray | null;
    while ((m6 = regexItensPag6.exec(textoLimpo)) !== null) {
      const disc = m6[1].replace(/\s+/g, ' ').trim().toUpperCase();
      const vrFin = m6[2].replace(/\.(?=\d{2}$)/, ',');
      if (!disc.includes('EMPREENDIMENTO') && !disc.includes('INVERSAO')) {
        resultado.itensInversao.push({
          discriminacao: disc,
          quantidade: '1',
          unidade: 'Unid',
          valorUnitario: vrFin,
          valorFinanciado: vrFin,
          empreendimento: m6[3],
        });
      }
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

  // 7. Valor Total Financiado ("Total Financiado: R$ 50.000,00" ou "SUBTOTAL do Financiamento ... 50.000,00")
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
    /(?:VALOR\s+DO\s+FINANCIAMENTO|VALOR\s+SOLICITADO|VALOR\s+TOTAL\s+DO\s+PROJETO|TOTAL\s+GERAL|TOTAL\s+DO\s+ORCAMENTO)[^0-9]{0,45}(?:R\$\s*)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi,
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
  ];

  for (const regex of padroesPrioritarios) {
    const candidatos: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(norm)) !== null) {
      // Corrige eventual ponto no lugar da vírgula nos centavos (ex: "50.000.00" -> "50.000,00")
      const strVal = m[1].replace(/\.(?=\d{2}$)/, ',');
      const val = parseMoeda(strVal);
      if (val >= 2000 && val <= 1500000) {
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
}): Promise<ResultadoAuditoriaPastaPdf> {
  const {
    arquivos,
    titularNome,
    conjugeNome,
    paEsperado,
    contaConformidade,
  } = params;

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
  const pdfParecerTec = obterPorCat('ITEM_16_PARECER_TECNICO', false);
  const pdfRb = obterPorCat('ITEM_17_RB_PA', false);
  const pdfProcuracao = obterPorCat('CAD_6_PROCURACAO', false);
  const pdfCasamento = obterPorCat('CAD_2_CERTIDAO_CASAMENTO', false);
  const pdfIdTitular = obterPorCat('CAD_1_IDENTIDADE_TITULAR', false);
  const pdfIdConjuge = obterPorCat('CAD_1_IDENTIDADE_CONJUGE', false);

  // Extrai todos os dados ricos do PDF 12 (Projeto) e grava no Cache do Parecer Gerencial!
  const dadosProjetoParaParecer = extrairDadosDetalhadosDoPdfProjeto(
    pdfProjeto?.textoCompleto || ''
  );
  if (titularNome && !dadosProjetoParaParecer.clienteNome) {
    dadosProjetoParaParecer.clienteNome = titularNome;
  }
  if (pdfProjeto) {
    salvarDadosExtraidosParaParecer(dadosProjetoParaParecer);
  }

  const conjugeEfetivo =
    conjugeNome.trim() || dadosProjetoParaParecer.conjugeNome || '';

  const itensDiagnostico: ItemDiagnosticoPdf[] = [];

  // 1. CONTA CORRENTE NA CONSOLIDADA
  let contaCorrenteConsolidada = '';
  if (!pdfConsolidada) {
    itensDiagnostico.push({
      numero: 1,
      titulo: '1. Conta Corrente nas Declarações Consolidadas',
      status: 'ERRO',
      resumo: 'Arquivo 9. Declarações Consolidadas não localizado na pasta.',
    });
  } else if (pdfConsolidada.ehProvavelEscaneadoImagem) {
    itensDiagnostico.push({
      numero: 1,
      titulo: '1. Conta Corrente nas Declarações Consolidadas',
      status: 'ALERTA',
      resumo:
        'Não foi possível identificar automaticamente (PDF escaneado em imagem). Verifique visualmente o campo de débito em conta.',
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
          : `Conta na Consolidada (${contaCorrenteConsolidada}) diverge da planilha de Conformidade (${contaConformidade})!`,
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

  // 2 E 8. VALOR, PRAZO, CARÊNCIA, INVERSÕES E COMPATIBILIDADE ORÇAMENTO X PROJETO
  const valProjeto = pdfProjeto
    ? extrairValorMonetarioPrincipal(pdfProjeto.textoCompleto)
    : 0;
  const valOrcamento = pdfOrcamento
    ? extrairValorMonetarioPrincipal(pdfOrcamento.textoCompleto)
    : 0;
  const valEspelho = pdfEspelho
    ? extrairValorMonetarioPrincipal(pdfEspelho.textoCompleto)
    : 0;

  const valorPrincipalNum = valProjeto || valOrcamento || valEspelho;
  const valorPropostaDetectado =
    valorPrincipalNum > 0 ? formatarMoedaBD(valorPrincipalNum) : '';

  if (valorPrincipalNum > 0) {
    itensDiagnostico.push({
      numero: 2,
      titulo:
        '2. Valor, Prazo, Carência, Elaborador e Inversões Extraídos do Projeto (PDF 12)',
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
        ...dadosProjetoParaParecer.itensInversao.map(
          (it) =>
            `📦 Inversão: ${it.quantidade} ${it.unidade} — ${it.discriminacao} (R$ ${it.valorFinanciado})`
        ),
        valOrcamento > 0
          ? `💰 Soma no Orçamento (PDF 18): R$ ${formatarMoedaBD(valOrcamento)}`
          : '',
      ].filter(Boolean),
    });
  } else {
    itensDiagnostico.push({
      numero: 2,
      titulo: '2. Valor da Proposta Identificado nos PDFs',
      status: 'ALERTA',
      resumo:
        'Não foi possível extrair automaticamente o valor total nos PDFs (Projeto/Orçamento). Informe manualmente.',
    });
  }

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
  } else {
    itensDiagnostico.push({
      numero: 8,
      titulo: '8. Compatibilidade entre Orçamento e Projeto',
      status: 'INFO',
      resumo:
        'Para comparar Orçamento x Projeto automaticamente, ambos os PDFs precisam ter texto pesquisável.',
    });
  }

  // 3. SELOS PARA VALIDAR NAS PROCURAÇÕES / CERTIDÕES DE CASAMENTO
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
      '4 e 7. Auditoria de Assinaturas Digitais vs Manuais e Exigência de VITI',
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

  // 5. ESPELHO DA UND + P.A. E CAR (TOTALMENTE INSENSÍVEL A ACENTOS)
  const primTit = normalizarSemAcento(titularNome.split(/\s+/)[0] || '');
  const primConj = normalizarSemAcento(conjugeEfetivo.split(/\s+/)[0] || '');
  const txtEspelhoNorm = normalizarSemAcento(pdfEspelho?.textoCompleto || '');
  const txtProjNorm = normalizarSemAcento(pdfProjeto?.textoCompleto || '');
  const txtCarNorm = normalizarSemAcento(
    (pdfCar?.textoCompleto || '') + '\n' + (pdfConsultaCar?.textoCompleto || '')
  );

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

  if (!pdfEspelho) {
    itensDiagnostico.push({
      numero: 5,
      titulo: '5. Espelho da UND Familiar + P.A. e CAR (Geral vs Específico)',
      status: 'ALERTA',
      resumo: 'Arquivo 11. Espelho da UND não localizado na pasta.',
    });
  } else {
    const titNoEspelho = primTit ? txtEspelhoNorm.includes(primTit) : true;
    const conjNoEspelho = primConj ? txtEspelhoNorm.includes(primConj) : true;
    const carBateComProjeto =
      recibosCarNoProjeto.length === 0 ||
      recibosCarNoPdfCar.length === 0 ||
      recibosCarNoProjeto.some((rc) => recibosCarNoPdfCar.includes(rc)) ||
      textoContemTermoFlexivel(txtCarNorm, paDetectadoNoProjeto);

    itensDiagnostico.push({
      numero: 5,
      titulo: '5. Espelho da UND Familiar + P.A. e CAR (Geral vs Específico)',
      status:
        !titNoEspelho || (primConj && !conjNoEspelho) || !carBateComProjeto
          ? 'ERRO'
          : 'OK',
      resumo:
        titNoEspelho && (!primConj || conjNoEspelho) && carBateComProjeto
          ? `Titular${
              primConj ? '/Cônjuge' : ''
            } OK no Espelho da UND e CAR compatível com o Projeto.`
          : 'Foram encontradas divergências no Espelho da UND ou entre o CAR da pasta e o Projeto!',
    });
  }

  // 6. VALIDADE DA CAF E ASSENTAMENTO (P.A.) NA CAF (IGNORANDO ACENTOS E VARIAÇÕES DE DIGITAÇÃO!)
  if (!pdfCaf) {
    itensDiagnostico.push({
      numero: 6,
      titulo: '6. Validade da CAF e Assentamento (P.A.) na CAF',
      status: 'ERRO',
      resumo: 'Arquivo 14. CAF não encontrado na pasta.',
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

    // ITEM 2 CORRIGIDO: Usa textoContemTermoFlexivel que ignora acentos (CARNAÚBA = CARNAUBA, CARÚ = CARU) e tolera LADO vs LAGO!
    const paAlvo = paDetectadoNoProjeto || paEsperado;
    const paConstaNaCaf = textoContemTermoFlexivel(txtCafBruto, paAlvo);

    itensDiagnostico.push({
      numero: 6,
      titulo: '6. Validade da CAF e Assentamento (P.A.) na CAF',
      status: cafVencida ? 'ERRO' : !paConstaNaCaf ? 'ALERTA' : 'OK',
      resumo: cafVencida
        ? `🚨 CAF VENCIDA em ${dataValStr}! Solicitar renovação imediata.`
        : `${
            dataValStr ? `CAF Vigente (Validade: ${dataValStr})` : 'CAF localizada'
          } • ${
            paConstaNaCaf
              ? `P.A. (${paAlvo}) devidamente confirmado na CAF.`
              : `⚠️ O nome do P.A. (${paAlvo}) não foi localizado no texto da CAF!`
          }`,
    });
  }

  // 9. OBJETIVO DO CRÉDITO NO PROJETO
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
                120
              )}..."`
            : ''
        }`
      : 'Objetivo específico não isolado automaticamente no texto do Projeto.',
  });

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

  if (possuiConjugeReal && !temDocConjugeNaPasta) {
    itensDiagnostico.push({
      numero: 10,
      titulo:
        '10 e 11. Consistência de Estado Civil e Documentação do Cônjuge',
      status: 'ERRO',
      resumo:
        '🚨 ALERTA: O Projeto/CAF indica Cônjuge ou União Estável, mas NÃO HÁ documento de identificação do Cônjuge na pasta!',
    });
  } else {
    itensDiagnostico.push({
      numero: 10,
      titulo:
        '10 e 11. Consistência de Estado Civil e Documentação do Cônjuge',
      status: 'OK',
      resumo: possuiConjugeReal
        ? `Estado civil (${estadoCivilDetectado}) consistente e Cônjuge (${
            conjugeEfetivo || 'Identificado'
          }) validado.`
        : 'Titular Solteiro(a) / Sem Cônjuge (Não exige certidões nem documentos de cônjuge).',
    });
  }

  // 12. PRESENÇA DO CLIENTE NA RB DO P.A. (INSENSÍVEL A ACENTOS)
  if (!pdfRb) {
    itensDiagnostico.push({
      numero: 12,
      titulo: '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
      status: 'ALERTA',
      resumo:
        'Arquivo 17 - RB do P.A. não está na pasta (Cadastre na Gaveta de Coringas para conferência automática).',
    });
  } else if (pdfRb.ehProvavelEscaneadoImagem) {
    itensDiagnostico.push({
      numero: 12,
      titulo: '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
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
      titulo: '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
      status: achouNaRb ? 'OK' : 'ERRO',
      resumo: achouNaRb
        ? `✅ Nome do cliente "${titularNome}" localizado com sucesso na RB do P.A.!`
        : `🚨 O nome "${titularNome}" NÃO foi localizado no texto da RB do P.A.!`,
    });
  }

  return {
    valorPropostaDetectado,
    prazoMesesDetectado: dadosProjetoParaParecer.prazoMeses,
    carenciaMesesDetectada: dadosProjetoParaParecer.carenciaMeses,
    elaboradorDetectado: dadosProjetoParaParecer.elaboradorNomeCompleto,
    projetistaCurtoDetectado:
      dadosProjetoParaParecer.projetistaNomeCurtoDetectado,
    objetivoCreditoDetectado,
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