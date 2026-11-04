// src/lib/auditorInteligentePdfPasta.ts
import { formatarMoedaBD, parseMoeda } from '@/lib/utils';

export type NivelStatusAuditoria = 'OK' | 'ALERTA' | 'ERRO' | 'INFO';

export interface ItemDiagnosticoPdf {
  numero: number;
  titulo: string;
  status: NivelStatusAuditoria;
  resumo: string;
  detalhes?: string[];
}

export interface ResultadoAuditoriaPastaPdf {
  valorPropostaDetectado: string;
  objetivoCreditoDetectado: string;
  contaCorrenteConsolidada: string;
  paDetectadoNoProjeto: string;
  carEspecificoDetectado: string;
  estadoCivilDetectado: string;
  conjugeDetectadoNosPdfs: string;
  arquivosComAssinaturaDigital: string[];
  arquivosSemAssinaturaDigital: string[];
  itensDiagnostico: ItemDiagnosticoPdf[];
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

// Carrega o PDF.js sob demanda no navegador sem exigir npm install nem quebrar build estático
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

function removerAcentos(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Inspeciona o binário bruto do PDF para detectar Assinatura Digital ICP-Brasil / Gov.br (/ByteRange, /SubFilter)
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

    return (temByteRange && temSubFilterSig) || (temByteRange && temMarcadorIcpOuGovBr);
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

      // Lê até 35 páginas por arquivo para manter velocidade instantânea
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
    // Se o PDF for protegido ou corrompido, mantém textoCompleto vazio
  }

  // Verifica se o texto extraído também menciona assinatura eletrônica Gov.br / ICP-Brasil
  const normTexto = removerAcentos(textoCompleto).toUpperCase();
  const assinaturaPeloTexto =
    normTexto.includes('ASSINADO ELETRONICAMENTE') ||
    normTexto.includes('ASSINADO DIGITALMENTE') ||
    normTexto.includes('VALIDADOR.ITI.GOV.BR') ||
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

// Extrai o maior valor monetário compatível com financiamento rural em um texto de Projeto/Orçamento/Espelho
function extrairValorMonetarioPrincipal(texto: string): number {
  const norm = removerAcentos(texto).toUpperCase();

  // 1. Tenta localizar próximo a palavras-chave de total do financiamento/orçamento
  const padroesChave = [
    /(?:VALOR\s+DO\s+FINANCIAMENTO|VALOR\s+SOLICITADO|VALOR\s+TOTAL\s+DO\s+PROJETO|TOTAL\s+GERAL|TOTAL\s+DO\s+ORCAMENTO|VALOR\s+DO\s+CREDITO|TOTAL\s+DOS\s+INVESTIMENTOS)[^0-9]{0,45}(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
  ];

  for (const regex of padroesChave) {
    const candidatos: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(norm)) !== null) {
      const val = parseMoeda(m[1]);
      // Propostas rurais PRONAF / MINI normalmente ficam entre R$ 2.000,00 e R$ 1.500.000,00
      if (val >= 2000 && val <= 1500000) {
        candidatos.push(val);
      }
    }
    if (candidatos.length > 0) {
      return Math.max(...candidatos);
    }
  }

  return 0;
}

// Extrai números de recibo do CAR no formato UF-1234567-XXXX...
function extrairCodigosReciboCar(texto: string): string[] {
  const matches =
    texto.match(
      /\b[A-Z]{2}-\d{7}-[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\b/gi
    ) || [];
  return Array.from(
    new Set(matches.map((m) => m.replace(/\./g, '').toUpperCase()))
  );
}

// Executa todas as 12 verificações estratégicas nos PDFs da pasta do cliente
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

  const itensDiagnostico: ItemDiagnosticoPdf[] = [];

  // =========================================================================
  // 1. VERIFICAÇÃO DE CONTA CORRENTE NA CONSOLIDADA ENVIADA
  // =========================================================================
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
      txtCons.match(/AGENCIA\s+[0-9]{2,5}[^0-9]{1,25}C\/?C\s*:?\s*([0-9.\-X]{4,12})/i);

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
    } else if (
      txtCons.includes('MOVIMENTACAO DE N') &&
      (txtCons.includes('____') || txtCons.includes('{') || /DE N(?:º|°)?\s*\./.test(txtCons))
    ) {
      itensDiagnostico.push({
        numero: 1,
        titulo: '1. Conta Corrente nas Declarações Consolidadas',
        status: 'ERRO',
        resumo:
          'A Declaração Consolidada foi enviada SEM número de Conta Corrente preenchido!',
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

  // =========================================================================
  // 2 E 8. VALOR DA PROPOSTA E COMPATIBILIDADE ENTRE ORÇAMENTO E PROJETO
  // =========================================================================
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
      titulo: '2. Valor da Proposta Identificado nos PDFs',
      status: 'OK',
      resumo: `Valor detectado: R$ ${valorPropostaDetectado} (Já pré-carregado para o cadastro da operação).`,
      detalhes: [
        valProjeto > 0 ? `Projeto PDF: R$ ${formatarMoedaBD(valProjeto)}` : '',
        valOrcamento > 0 ? `Orçamento PDF: R$ ${formatarMoedaBD(valOrcamento)}` : '',
        valEspelho > 0 ? `Espelho UND: R$ ${formatarMoedaBD(valEspelho)}` : '',
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

  // Item 8: Cruzamento Orçamento vs Projeto
  if (valProjeto > 0 && valOrcamento > 0) {
    const diferenca = Math.abs(valProjeto - valOrcamento);
    if (diferenca <= 5) {
      itensDiagnostico.push({
        numero: 8,
        titulo: '8. Compatibilidade entre Orçamento e Projeto',
        status: 'OK',
        resumo: `Orçamento (R$ ${formatarMoedaBD(
          valOrcamento
        )}) está 100% de acordo com o Projeto (R$ ${formatarMoedaBD(valProjeto)}).`,
      });
    } else {
      itensDiagnostico.push({
        numero: 8,
        titulo: '8. Compatibilidade entre Orçamento e Projeto',
        status: 'ERRO',
        resumo: `Divergência detectada! Projeto indica R$ ${formatarMoedaBD(
          valProjeto
        )}, mas o Orçamento soma R$ ${formatarMoedaBD(valOrcamento)}.`,
      });
    }
  } else {
    itensDiagnostico.push({
      numero: 8,
      titulo: '8. Compatibilidade entre Orçamento e Projeto',
      status: 'INFO',
      resumo:
        'Para comparar Orçamento x Projeto automaticamente, ambos os PDFs precisam ter texto pesquisável.',
    });
  }

  // =========================================================================
  // 3. SELOS PARA VALIDAR NAS PROCURAÇÕES / CERTIDÕES DE CASAMENTO
  // =========================================================================
  const temSeloNaPasta = arquivos.some((a) => a.categoria === 'CAD_8_SELO_CARTORIO');
  if (!pdfProcuracao && !pdfCasamento) {
    itensDiagnostico.push({
      numero: 3,
      titulo: '3. Validação de Selos (Procuração / Certidão de Casamento)',
      status: 'OK',
      resumo:
        'Não há Procuração nem Certidão de Casamento na pasta (Sem necessidade de consulta de selos).',
    });
  } else {
    const txtCartorio =
      (pdfProcuracao?.textoCompleto || '') +
      '\n' +
      (pdfCasamento?.textoCompleto || '');
    const codigosSeloEncontrados =
      txtCartorio.match(
        /(?:SELO\s*(?:DIGITAL|DE\s*FISCALIZACAO|DE\s*AUTENTICIDADE)?\s*[:Nº°]*\s*)([A-Z0-9.\-]{8,25})/gi
      ) || [];

    if (temSeloNaPasta) {
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
        detalhes:
          codigosSeloEncontrados.length > 0
            ? [`Selos lidos no PDF: ${codigosSeloEncontrados.slice(0, 3).join(' | ')}`]
            : ['Gerado alerta "FALTA CONSULTAR SELOS.txt" na subpasta CADASTRO.'],
      });
    }
  }

  // =========================================================================
  // 4 E 7. DETECÇÃO AUTOMÁTICA DE ASSINATURA DIGITAL (VITI) VS FÍSICA/EM BRANCO
  // =========================================================================
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
  const possiveisNaoAssinadosEmBranco: string[] = [];

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
              ? 'Escaneado/Manual — Não precisa de VITI'
              : 'Texto Nativo s/ Certificado Digital'
          })`
        );
        // Se não tem assinatura digital, não foi escaneado e o nome não diz "assinado", pode estar sem assinatura nenhuma!
        if (
          !doc.ehProvavelEscaneadoImagem &&
          !doc.nomeOriginal.toLowerCase().includes('assinado')
        ) {
          possiveisNaoAssinadosEmBranco.push(doc.nomeOriginal);
        }
      }
    });

  itensDiagnostico.push({
    numero: 4,
    titulo: '4 e 7. Auditoria de Assinaturas Digitais vs Manuais e Exigência de VITI',
    status:
      faltamVitiDeAssinaturaDigitalConfirmada.length > 0 ||
      possiveisNaoAssinadosEmBranco.length > 0
        ? 'ERRO'
        : 'OK',
    resumo:
      faltamVitiDeAssinaturaDigitalConfirmada.length > 0
        ? `Detectados ${faltamVitiDeAssinaturaDigitalConfirmada.length} PDF(s) com Assinatura Digital embutida que estão SEM o relatório VITI na pasta!`
        : possiveisNaoAssinadosEmBranco.length > 0
        ? `Atenção: ${possiveisNaoAssinadosEmBranco.length} PDF(s) parecem ter sido gerados eletronicamente sem assinatura digital nem escaneamento!`
        : `Todos os ${arquivosComAssinaturaDigital.length} documento(s) assinados digitalmente já possuem VITI na pasta (${arquivosSemAssinaturaDigital.length} isentos de VITI).`,
    detalhes: [
      ...faltamVitiDeAssinaturaDigitalConfirmada.map(
        (n) => `🚨 Falta validar no ITI (Possui Ass. Digital): ${n}`
      ),
      ...possiveisNaoAssinadosEmBranco.map(
        (n) => `⚠️ Verificar se o campo de assinatura está em branco: ${n}`
      ),
      ...arquivosSemAssinaturaDigital.map(
        (n) => `✍️ Sem assinatura digital (Isento de VITI): ${n}`
      ),
    ],
  });

  // =========================================================================
  // 5. TITULAR E CÔNJUGE NO ESPELHO DA UND + P.A. E CAR ESPECÍFICO VS GERAL
  // =========================================================================
  const primTit = removerAcentos(titularNome.split(/\s+/)[0] || '').toUpperCase();
  const primConj = removerAcentos(conjugeNome.split(/\s+/)[0] || '').toUpperCase();
  const txtEspelhoNorm = removerAcentos(
    pdfEspelho?.textoCompleto || ''
  ).toUpperCase();
  const txtProjNorm = removerAcentos(
    pdfProjeto?.textoCompleto || ''
  ).toUpperCase();
  const txtCarNorm = removerAcentos(
    (pdfCar?.textoCompleto || '') + '\n' + (pdfConsultaCar?.textoCompleto || '')
  ).toUpperCase();

  let paDetectadoNoProjeto = paEsperado;
  const matchPaProj = txtProjNorm.match(
    /(P\.?\s*A\.?\s+[A-Z0-9 ]{3,35}?)(?:\n|,|\.|-|MUNICIPIO|AREA|LOTE)/i
  );
  if (matchPaProj && matchPaProj[1]) {
    paDetectadoNoProjeto = matchPaProj[1].replace(/\s+/g, ' ').trim();
  }

  const recibosCarNoProjeto = extrairCodigosReciboCar(txtProjNorm);
  const recibosCarNoPdfCar = extrairCodigosReciboCar(txtCarNorm);
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
      recibosCarNoProjeto.some((rc) => recibosCarNoPdfCar.includes(rc));

    const detalhesItem5: string[] = [];
    detalhesItem5.push(
      titNoEspelho
        ? `✅ Titular (${primTit}) localizado no Espelho da UND.`
        : `🚨 Titular (${primTit}) NÃO localizado no texto do Espelho da UND!`
    );
    if (primConj) {
      detalhesItem5.push(
        conjNoEspelho
          ? `✅ Cônjuge (${primConj}) devidamente cadastrado(a) no Espelho da UND.`
          : `🚨 Cônjuge (${primConj}) NÃO consta no Espelho da UND Familiar!`
      );
    }
    if (recibosCarNoPdfCar.length > 0 || recibosCarNoProjeto.length > 0) {
      detalhesItem5.push(
        carBateComProjeto
          ? `✅ Recibo do CAR na pasta (${
              recibosCarNoPdfCar[0] || 'CAR Geral/Específico'
            }) está citado e compatível com o Projeto.`
          : `🚨 DIVERGÊNCIA DE CAR: O Projeto cita o CAR [${recibosCarNoProjeto.join(
              ', '
            )}], mas o PDF do CAR na pasta é [${recibosCarNoPdfCar.join(', ')}]!`
      );
    }

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
      detalhes: detalhesItem5,
    });
  }

  // =========================================================================
  // 6. VALIDADE DA CAF E ESPECIFICAÇÃO DO P.A. NA CAF
  // =========================================================================
  if (!pdfCaf) {
    itensDiagnostico.push({
      numero: 6,
      titulo: '6. Validade da CAF e Assentamento (P.A.) na CAF',
      status: 'ERRO',
      resumo: 'Arquivo 14. CAF não encontrado na pasta.',
    });
  } else {
    const txtCafNorm = removerAcentos(pdfCaf.textoCompleto).toUpperCase();
    const matchValidade =
      txtCafNorm.match(
        /(?:VALIDADE|VALIDO\s+ATE|DATA\s+DE\s+VALIDADE|VENCIMENTO)[^0-9]{0,25}(\d{2}\/\d{2}\/\d{4})/i
      ) || txtCafNorm.match(/(\d{2}\/\d{2}\/202[5-9])/);

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

    const nucleoPa = removerAcentos(paDetectadoNoProjeto || paEsperado)
      .toUpperCase()
      .replace(/^P\.?\s*A\.?\s*/, '')
      .trim();
    const paConstaNaCaf =
      !nucleoPa || nucleoPa.length < 3 || txtCafNorm.includes(nucleoPa);

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
              ? `P.A. (${nucleoPa}) devidamente especificado na CAF.`
              : `⚠️ O nome do P.A. (${nucleoPa}) não foi localizado no texto da CAF!`
          }`,
    });
  }

  // =========================================================================
  // 9. OBJETIVO DO CRÉDITO NO PROJETO (IMPLANTAÇÃO, MODERNIZAÇÃO, AMPLIAÇÃO...)
  // =========================================================================
  let objetivoCreditoDetectado = '';
  const txtBuscaObj =
    (pdfProjeto?.textoCompleto || '') +
    '\n' +
    (pdfParecerTec?.textoCompleto || '');
  const normObj = removerAcentos(txtBuscaObj).toUpperCase();

  const objetivosEncontrados: string[] = [];
  if (normObj.includes('IMPLANTACAO')) objetivosEncontrados.push('IMPLANTAÇÃO');
  if (normObj.includes('MODERNIZACAO'))
    objetivosEncontrados.push('MODERNIZAÇÃO');
  if (normObj.includes('AMPLIACAO')) objetivosEncontrados.push('AMPLIAÇÃO');
  if (normObj.includes('REFORMA')) objetivosEncontrados.push('REFORMA');
  if (normObj.includes('BOVINOCULTURA') || normObj.includes('MATRIZES'))
    objetivosEncontrados.push('BOVINOCULTURA / AQUISIÇÃO DE ANIMAIS');

  const matchFraseObj = txtBuscaObj.match(
    /(?:OBJETIVO(?:\s+DO\s+PROJETO|\s+DO\s+CREDITO)?\s*[:\-]\s*)([^\n.]{10,140})/i
  );

  if (matchFraseObj && matchFraseObj[1]) {
    objetivoCreditoDetectado = matchFraseObj[1].trim();
  } else if (objetivosEncontrados.length > 0) {
    objetivoCreditoDetectado = objetivosEncontrados.join(' / ');
  }

  itensDiagnostico.push({
    numero: 9,
    titulo: '9. Objetivo do Crédito Identificado no Projeto',
    status: objetivoCreditoDetectado ? 'OK' : 'INFO',
    resumo: objetivoCreditoDetectado
      ? `Objetivo detectado: "${objetivoCreditoDetectado}"`
      : 'Objetivo específico não isolado automaticamente no texto do Projeto.',
  });

  // =========================================================================
  // 10 E 11. CRUZAMENTO DE ESTADO CIVIL E CÔNJUGE (IDENTIDADE, CAF, ESPELHO E PROJETO)
  // =========================================================================
  const txtTodosCadastro = removerAcentos(
    [
      pdfIdTitular?.textoCompleto,
      pdfCasamento?.textoCompleto,
      pdfCaf?.textoCompleto,
      pdfEspelho?.textoCompleto,
      pdfProjeto?.textoCompleto,
    ]
      .filter(Boolean)
      .join('\n')
  ).toUpperCase();

  const mencionaCasadoOuUniao =
    /\b(CASADO|CASADA|UNIAO ESTAVEL|COMPANHEIRO|COMPANHEIRA|CONJUGE)\b/.test(
      txtTodosCadastro
    ) || Boolean(pdfCasamento);

  const projetoDizSolteiro = /\bESTADO\s+CIVIL\s*[:\-]?\s*SOLTEIR[OA]\b/.test(
    txtProjNorm
  );
  const temDocConjugeNaPasta =
    Boolean(pdfIdConjuge) || Boolean(conjugeNome.trim());

  const estadoCivilDetectado = mencionaCasadoOuUniao
    ? 'CASADO(A) / UNIÃO ESTÁVEL'
    : projetoDizSolteiro
    ? 'SOLTEIRO(A)'
    : 'NÃO ESPECIFICADO';

  if (mencionaCasadoOuUniao && !temDocConjugeNaPasta) {
    itensDiagnostico.push({
      numero: 10,
      titulo:
        '10 e 11. Consistência de Estado Civil e Documentação do Cônjuge (CAF / RG / Projeto)',
      status: 'ERRO',
      resumo:
        '🚨 ALERTA CRÍTICO: Os documentos (CAF/Espelho/Certidão) indicam CASADO(A) ou UNIÃO ESTÁVEL, mas NÃO HÁ documento de identificação do Cônjuge na pasta!',
    });
  } else if (mencionaCasadoOuUniao && projetoDizSolteiro) {
    itensDiagnostico.push({
      numero: 10,
      titulo:
        '10 e 11. Consistência de Estado Civil e Documentação do Cônjuge (CAF / RG / Projeto)',
      status: 'ERRO',
      resumo:
        '🚨 DIVERGÊNCIA: Consta Cônjuge/União Estável na CAF/Pasta, mas no PDF do Projeto o estado civil está preenchido como SOLTEIRO(A)!',
    });
  } else {
    itensDiagnostico.push({
      numero: 10,
      titulo:
        '10 e 11. Consistência de Estado Civil e Documentação do Cônjuge (CAF / RG / Projeto)',
      status: 'OK',
      resumo: temDocConjugeNaPasta
        ? `Estado civil (${estadoCivilDetectado}) consistente e documentação do cônjuge presente na pasta.`
        : 'Titular sem cônjuge/companheiro(a) apontado na CAF/Projeto.',
    });
  }

  // =========================================================================
  // 12. VERIFICAÇÃO SE O NOME DO CLIENTE CONSTA NA RB DO P.A.
  // =========================================================================
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
    const txtRbNorm = removerAcentos(pdfRb.textoCompleto).toUpperCase();
    const nomeCompletoNorm = removerAcentos(titularNome).toUpperCase().trim();
    const partesNome = nomeCompletoNorm.split(/\s+/).filter((p) => p.length > 2);
    const primEUltimo =
      partesNome.length >= 2
        ? `${partesNome[0]}.*${partesNome[partesNome.length - 1]}`
        : partesNome[0] || '';

    const achouExato =
      nomeCompletoNorm.length > 3 && txtRbNorm.includes(nomeCompletoNorm);
    const achouAproximado =
      !achouExato &&
      primEUltimo &&
      new RegExp(primEUltimo, 'i').test(txtRbNorm);

    itensDiagnostico.push({
      numero: 12,
      titulo: '12. Presença do Cliente na Relação de Beneficiários (RB do P.A.)',
      status: achouExato || achouAproximado ? 'OK' : 'ERRO',
      resumo: achouExato
        ? `✅ Nome completo "${titularNome}" localizado com sucesso na RB do P.A.!`
        : achouAproximado
        ? `✅ Nome do cliente localizado na RB do P.A. (Verifique grafia completa).`
        : `🚨 O nome "${titularNome}" NÃO foi localizado no texto da RB do P.A.!`,
    });
  }

  return {
    valorPropostaDetectado,
    objetivoCreditoDetectado,
    contaCorrenteConsolidada,
    paDetectadoNoProjeto,
    carEspecificoDetectado,
    estadoCivilDetectado,
    conjugeDetectadoNosPdfs: conjugeNome,
    arquivosComAssinaturaDigital,
    arquivosSemAssinaturaDigital,
    itensDiagnostico: itensDiagnostico.sort((a, b) => a.numero - b.numero),
  };
}