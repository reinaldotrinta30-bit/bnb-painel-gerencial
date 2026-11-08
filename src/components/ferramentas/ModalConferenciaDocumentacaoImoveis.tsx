'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { removerAcentos, normalizarSemAcento } from '@/lib/auditorInteligentePdfPasta';
import { parseFloatBR } from '@/lib/analisadorSocioambientalKml';

export interface ArquivoImovelPreCarregado {
  file: File;
  caminhoSubpasta?: string;
}

interface ModalConferenciaDocumentacaoImoveisProps {
  aberto: boolean;
  onFechar: () => void;
  titularEsperado?: string;
  cpfEsperado?: string;
  areaProjetoEsperadaHa?: string;
  imovelEsperadoNome?: string;
  arquivosImovelDaPasta?: ArquivoImovelPreCarregado[];
}

type TipoDocImovel =
  | 'INTEIRO_TEOR_MATRICULA'
  | 'CCIR'
  | 'CND_ITR'
  | 'CAR_RECIBO'
  | 'TITULO_DOMINIO'
  | 'OUTRO_DOC_IMOVEL';

interface ResultadoAuditoriaDocImovel {
  id: string;
  nomeArquivo: string;
  subpastaOrigem?: string;
  tipoDetectado: TipoDocImovel;
  rotuloTipo: string;
  status: 'OK' | 'ALERTA' | 'ERRO';
  ehEscaneadoImagem: boolean;
  identificadorExtraido: string; // Nº Matrícula, Código INCRA, CIB/NIRF ou Registro CAR
  areaExtraidaHa: string;
  dataEmissaoOuValidade: string;
  proprietarioLocalizado: boolean;
  apontamentos: string[];
  gravamesDetectados: string[];
  cadeiaAnosDetectada?: number;
  anoMaisAntigoMatricula?: number;
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

async function extrairTextoPdfImovel(file: File): Promise<{
  texto: string;
  numPaginas: number;
  ehImagemEscaneada: boolean;
}> {
  const buffer = await file.arrayBuffer();
  let texto = '';
  let numPaginas = 1;

  try {
    const pdfjsLib = await obterPdfJsLib();
    if (pdfjsLib) {
      const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
      numPaginas = pdf.numPages || 1;
      const limite = Math.min(numPaginas, 30);
      for (let i = 1; i <= limite; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strs = (content.items || []).map((it: any) => it.str || '');
        texto += strs.join(' ') + '\n';
      }
    }
  } catch {
    // Ignora falha de página
  }

  const limpo = texto.replace(/\s+/g, '');
  const mediaPorPag = numPaginas > 0 ? limpo.length / numPaginas : 0;

  return {
    texto,
    numPaginas,
    ehImagemEscaneada: mediaPorPag < 45,
  };
}

function classificarTipoDocumentoImovel(
  nomeArquivo: string,
  textoExtraido: string
): { tipo: TipoDocImovel; rotulo: string } {
  const nUp = removerAcentos(nomeArquivo).toUpperCase();
  const tUp = removerAcentos(textoExtraido).toUpperCase();

  if (
    nUp.includes('CCIR') ||
    tUp.includes('CERTIFICADO DE CADASTRO DE IMOVEL RURAL') ||
    tUp.includes('CODIGO DO IMOVEL RURAL')
  ) {
    return {
      tipo: 'CCIR',
      rotulo: '📜 CCIR (Certificado de Cadastro de Imóvel Rural)',
    };
  }

  if (
    nUp.includes('ITR') ||
    (nUp.includes('CND') && nUp.includes('IMOVEL')) ||
    tUp.includes('IMPOSTO SOBRE A PROPRIEDADE TERRITORIAL RURAL') ||
    tUp.includes('CERTIDAO NEGATIVA DE DEBITOS RELATIVOS AOS TRIBUTOS FEDERAIS E A DIVIDA ATIVA DA UNIAO DE IMOVEL RURAL')
  ) {
    return {
      tipo: 'CND_ITR',
      rotulo: '🏛️ CND de ITR (Regularidade Fiscal do Imóvel)',
    };
  }

  if (
    nUp.includes('CAR') ||
    tUp.includes('REGISTRO NO CAR') ||
    tUp.includes('RECIBO DE INSCRICAO DO IMOVEL RURAL NO CAR') ||
    tUp.includes('DEMONSTRATIVO DA SITUACAO DAS INFORMACOES DECLARADAS NO CAR')
  ) {
    return {
      tipo: 'CAR_RECIBO',
      rotulo: '🗺️ CAR (Recibo / Demonstrativo Ambiental)',
    };
  }

  if (
    nUp.includes('INTEIRO TEOR') ||
    nUp.includes('MATRICULA') ||
    nUp.includes('CERTIDAO DE ONUS') ||
    tUp.includes('CERTIDAO DE INTEIRO TEOR') ||
    tUp.includes('REGISTRO GERAL') ||
    tUp.includes('LIVRO 2')
  ) {
    return {
      tipo: 'INTEIRO_TEOR_MATRICULA',
      rotulo: '📖 Certidão de Inteiro Teor / Matrícula',
    };
  }

  if (
    nUp.includes('TITULO') ||
    nUp.includes('DOMINIO') ||
    nUp.includes('CONCESSAO DE USO') ||
    tUp.includes('TITULO DE DOMINIO') ||
    tUp.includes('CLAUSULAS RESOLUTIVAS')
  ) {
    return {
      tipo: 'TITULO_DOMINIO',
      rotulo: '📑 Título de Domínio / Concessão Fundiária',
    };
  }

  return {
    tipo: 'OUTRO_DOC_IMOVEL',
    rotulo: '📄 Documento Complementar de Imóvel',
  };
}

function extrairAreaHaDoTexto(texto: string): string {
  const regexes = [
    /(?:AREA\s+TOTAL|AREA\s+DO\s+IMOVEL|COM\s+A\s+AREA\s+DE|AREA\s+MEDIDA|AREA\s+REGISTRADA|AREA\s*:)\s*(\d{1,5}(?:[.,]\d{1,4})?)\s*(?:HA|HECTARES)/i,
    /(\d{1,4}[.,]\d{2,4})\s*(?:HA|HECTARES)\b/i,
  ];
  const norm = removerAcentos(texto).toUpperCase();
  for (const rx of regexes) {
    const m = norm.match(rx);
    if (m && m[1]) {
      const val = parseFloatBR(m[1]);
      if (val >= 0.5 && val <= 50000) {
        return m[1].trim();
      }
    }
  }
  return '';
}

async function auditarArquivoImovelIndividual(
  file: File,
  subpastaOrigem: string | undefined,
  titularNorm: string,
  cpfLimpo: string
): Promise<ResultadoAuditoriaDocImovel> {
  const { texto, ehImagemEscaneada } = await extrairTextoPdfImovel(file);
  const { tipo, rotulo } = classificarTipoDocumentoImovel(file.name, texto);
  const txtNorm = removerAcentos(texto).toUpperCase();
  const txtAlpha = normalizarSemAcento(texto);

  const apontamentos: string[] = [];
  const gravamesDetectados: string[] = [];
  let status: 'OK' | 'ALERTA' | 'ERRO' = 'OK';
  let identificadorExtraido = '';
  let dataEmissaoOuValidade = '';
  let cadeiaAnosDetectada: number | undefined;
  let anoMaisAntigoMatricula: number | undefined;

  const areaExtraidaHa = extrairAreaHaDoTexto(texto);

  // Verifica se o titular ou CPF aparece no documento
  const primNomeTit = titularNorm.split(/\s+/)[0] || '';
  const proprietarioLocalizado =
    !ehImagemEscaneada &&
    ((cpfLimpo.length >= 11 && texto.replace(/\D/g, '').includes(cpfLimpo)) ||
      (titularNorm.length >= 4 && txtAlpha.includes(titularNorm)) ||
      (primNomeTit.length >= 4 && txtAlpha.includes(primNomeTit)));

  if (ehImagemEscaneada) {
    status = 'ALERTA';
    apontamentos.push(
      '⚠️ PDF escaneado em formato de imagem (sem camada de texto pesquisável). Realize a conferência visual de datas, áreas e titularidade.'
    );
  }

  // 1. Regras Específicas: CERTIDÃO DE INTEIRO TEOR / MATRÍCULA
  if (tipo === 'INTEIRO_TEOR_MATRICULA') {
    const mMat =
      txtNorm.match(/MATRICULA\s*(?:N[º°o.]?)?\s*:?\s*([\d.]{1,12})/i) ||
      file.name.match(/MAT(?:RICULA)?[\s._-]*(\d{1,10})/i);
    if (mMat && mMat[1]) {
      identificadorExtraido = `Matrícula nº ${mMat[1].replace(/\./g, '')}`;
    }

    if (!ehImagemEscaneada) {
      // Cadeia dominial de 15 anos
      const anos = (texto.match(/\b(19[4-9]\d|20[0-2]\d)\b/g) || [])
        .map(Number)
        .filter((a) => a >= 1940 && a <= new Date().getFullYear());

      if (anos.length > 0) {
        anoMaisAntigoMatricula = Math.min(...anos);
        cadeiaAnosDetectada =
          new Date().getFullYear() - anoMaisAntigoMatricula;
        if (cadeiaAnosDetectada >= 15) {
          apontamentos.push(
            `✅ Cadeia dominial de 15 anos comprovada (${cadeiaAnosDetectada} anos — registros desde ${anoMaisAntigoMatricula}).`
          );
        } else {
          if (status === 'OK') status = 'ALERTA';
          apontamentos.push(
            `⚠️ Histórico temporal localizado na matrícula inicia em ${anoMaisAntigoMatricula} (${cadeiaAnosDetectada} anos < 15 anos). Verifique se é necessário anexar a matrícula de origem anterior!`
          );
        }
      }

      // Pesquisa de Gravames / Ônus Reais
      const padroesGravames: Array<{ termo: RegExp; nome: string }> = [
        { termo: /\bHIPOTECA\b/i, nome: 'Hipoteca registrada' },
        {
          termo: /\bALIENACAO\s+FIDUCIARIA\b/i,
          nome: 'Alienação Fiduciária registrada',
        },
        { termo: /\bPENHORA\b/i, nome: 'Penhora averbada' },
        {
          termo: /\bINDISPONIBILIDADE\b/i,
          nome: 'Indisponibilidade de Bens',
        },
        { termo: /\bUSUFRUTO\b/i, nome: 'Cláusula de Usufruto' },
        { termo: /\bARRESTO\b|\bSEQUESTRO\b/i, nome: 'Arresto / Sequestro' },
        {
          termo: /\bSERVIDAO\s+ADMINISTRATIVA\b/i,
          nome: 'Servidão Administrativa (Eletrobras/Ferrovia/Gasoduto)',
        },
      ];

      padroesGravames.forEach((pg) => {
        if (pg.termo.test(txtNorm)) {
          gravamesDetectados.push(pg.nome);
        }
      });

      if (gravamesDetectados.length > 0) {
        if (status === 'OK') status = 'ALERTA';
        apontamentos.push(
          `⚠️ Gravames/Menções localizados no texto da Matrícula: ${gravamesDetectados.join(
            ', '
          )} (Verificar se já possuem averbação de baixa/cancelamento ou se são em favor do próprio BNB).`
        );
      } else {
        apontamentos.push(
          '✅ Nenhum termo de penhora, indisponibilidade ou bloqueio detectado no texto.'
        );
      }

      // Data de Emissão (Validade de 30 dias para contratação de garantia)
      const datasEmissao = texto.match(/\b(\d{2}\/\d{2}\/202[4-9])\b/g) || [];
      if (datasEmissao.length > 0) {
        const ultimaDataStr = datasEmissao[datasEmissao.length - 1];
        dataEmissaoOuValidade = `Emissão ref.: ${ultimaDataStr}`;
        const [dd, mm, aaaa] = ultimaDataStr.split('/').map(Number);
        const dtEm = new Date(aaaa, mm - 1, dd);
        const diasDecorridos = Math.floor(
          (Date.now() - dtEm.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasDecorridos > 30 && diasDecorridos < 3650) {
          if (status === 'OK') status = 'ALERTA';
          apontamentos.push(
            `⚠️ Data localizada no final da certidão (${ultimaDataStr}) tem ${diasDecorridos} dias (> 30 dias exigidos para pré-contratual de garantia).`
          );
        } else if (diasDecorridos >= 0 && diasDecorridos <= 30) {
          apontamentos.push(
            `✅ Certidão emitida recentemente (${ultimaDataStr} — há ${diasDecorridos} dias ≤ 30 dias).`
          );
        }
      }
    }
  }

  // 2. Regras Específicas: CCIR
  if (tipo === 'CCIR') {
    const mCod = txtNorm.match(
      /(?:CODIGO\s+DO\s+IMOVEL\s+RURAL|INCRA)\s*:?\s*([\d.\-]{9,18})/i
    );
    if (mCod && mCod[1]) {
      identificadorExtraido = `SNCR: ${mCod[1].trim()}`;
    }

    if (!ehImagemEscaneada) {
      const anoAtual = new Date().getFullYear();
      const temExercicio =
        txtNorm.includes(String(anoAtual)) ||
        txtNorm.includes(String(anoAtual - 1));
      if (temExercicio) {
        dataEmissaoOuValidade = `Exercício ${anoAtual - 1}/${anoAtual}`;
        apontamentos.push(
          `✅ Exercício vigente (${anoAtual - 1}/${anoAtual}) confirmado no CCIR.`
        );
      } else {
        status = 'ERRO';
        apontamentos.push(
          `🚨 O exercício vigente (${anoAtual - 1}/${anoAtual}) NÃO foi encontrado no CCIR! Verifique se o CCIR está desatualizado.`
        );
      }

      if (txtNorm.includes('INVALIDO') || txtNorm.includes('PENDENTE DE')) {
        status = 'ERRO';
        apontamentos.push(
          '🚨 O texto do CCIR contém indicação de INVÁLIDO ou PENDÊNCIA.'
        );
      } else {
        apontamentos.push('✅ CCIR emitido regularmente pelo SNCR/INCRA.');
      }
    }
  }

  // 3. Regras Específicas: CND de ITR
  if (tipo === 'CND_ITR') {
    const mNirf = txtNorm.match(/(?:CIB|NIRF)\s*:?\s*([\d.\-]{6,14})/i);
    if (mNirf && mNirf[1]) {
      identificadorExtraido = `CIB/NIRF: ${mNirf[1].trim()}`;
    }

    if (!ehImagemEscaneada) {
      const mVal =
        txtNorm.match(
          /(?:VALIDA\s+ATE|VALIDADE\s*:?|VENCIMENTO\s*:?)[^0-9]{0,25}(\d{2}\/\d{2}\/20\d{2})/i
        ) || txtNorm.match(/ATE\s+(\d{2}\/\d{2}\/20\d{2})/i);

      if (mVal && mVal[1]) {
        dataEmissaoOuValidade = `Válida até ${mVal[1]}`;
        const [dd, mm, aaaa] = mVal[1].split('/').map(Number);
        const dtVenc = new Date(aaaa, mm - 1, dd, 23, 59, 59);
        const diasRest = Math.ceil(
          (dtVenc.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (diasRest < 0) {
          status = 'ERRO';
          apontamentos.push(
            `🚨 CND de ITR VENCIDA em ${mVal[1]}! Emitir nova certidão no portal da Receita Federal.`
          );
        } else if (diasRest <= 5) {
          if (status === 'OK') status = 'ALERTA';
          apontamentos.push(
            `⚠️ CND de ITR vence em apenas ${diasRest} dia(s) (${mVal[1]}).`
          );
        } else {
          apontamentos.push(
            `✅ CND de ITR vigente até ${mVal[1]} (${diasRest} dias restantes).`
          );
        }
      } else {
        status = 'ALERTA';
        apontamentos.push(
          '⚠️ Não foi possível isolar a data de validade da CND/ITR automaticamente. Confira visualmente.'
        );
      }
    }
  }

  // 4. Regras Específicas: CAR (Recibo / Demonstrativo)
  if (tipo === 'CAR_RECIBO') {
    const mCar = texto.match(
      /\b[A-Z]{2}-\d{7}-[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\.?[A-F0-9]{4}\b/i
    );
    if (mCar) {
      identificadorExtraido = mCar[0].replace(/\./g, '').toUpperCase();
    }

    if (!ehImagemEscaneada) {
      if (
        /SITUACAO\s*:?\s*CANCELAD/i.test(txtNorm) ||
        /SITUACAO\s*:?\s*SUSPENS/i.test(txtNorm)
      ) {
        status = 'ERRO';
        apontamentos.push(
          '🚨 CAR consta com situação CANCELADO ou SUSPENSO no demonstrativo!'
        );
      } else if (/SITUACAO\s*:?\s*PENDENTE/i.test(txtNorm)) {
        status = 'ALERTA';
        apontamentos.push(
          '⚠️ CAR consta com situação PENDENTE no demonstrativo. Verificar exigência de regularização.'
        );
      } else {
        apontamentos.push('✅ Registro do CAR válido e ativo.');
      }
    }
  }

  // 5. Regras Específicas: Título de Domínio
  if (tipo === 'TITULO_DOMINIO' && !ehImagemEscaneada) {
    if (
      txtNorm.includes('CLAUSULA RESOLUTIVA') ||
      txtNorm.includes('CLAUSULAS RESOLUTIVAS') ||
      txtNorm.includes('INALIENABILIDADE')
    ) {
      if (status === 'OK') status = 'ALERTA';
      apontamentos.push(
        '⚠️ Título de Domínio menciona Cláusulas Resolutivas / Inalienabilidade. Caso o imóvel seja oferecido em garantia (LCGH/LCGA), verificar quitação/liberação junto ao INCRA/ITERMA.'
      );
    } else {
      apontamentos.push('✅ Título de Domínio inspecionado.');
    }
  }

  return {
    id: `doc_im_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nomeArquivo: file.name,
    subpastaOrigem,
    tipoDetectado: tipo,
    rotuloTipo: rotulo,
    status,
    ehEscaneadoImagem: ehImagemEscaneada,
    identificadorExtraido,
    areaExtraidaHa,
    dataEmissaoOuValidade,
    proprietarioLocalizado,
    apontamentos,
    gravamesDetectados,
    cadeiaAnosDetectada,
    anoMaisAntigoMatricula,
  };
}

export default function ModalConferenciaDocumentacaoImoveis({
  aberto,
  onFechar,
  titularEsperado = '',
  cpfEsperado = '',
  areaProjetoEsperadaHa = '',
  imovelEsperadoNome = '',
  arquivosImovelDaPasta = [],
}: ModalConferenciaDocumentacaoImoveisProps) {
  const [titularFiltro, setTitularFiltro] = useState(titularEsperado);
  const [cpfFiltro, setCpfFiltro] = useState(cpfEsperado);
  const [areaEsperada, setAreaEsperada] = useState(areaProjetoEsperadaHa);
  const [nomeImovelAlvo, setNomeImovelAlvo] = useState(imovelEsperadoNome);

  const [resultados, setResultados] = useState<ResultadoAuditoriaDocImovel[]>(
    []
  );
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitularFiltro(titularEsperado);
    setCpfFiltro(cpfEsperado);
    setAreaEsperada(areaProjetoEsperadaHa);
    setNomeImovelAlvo(imovelEsperadoNome);
  }, [
    aberto,
    titularEsperado,
    cpfEsperado,
    areaProjetoEsperadaHa,
    imovelEsperadoNome,
  ]);

  const processarListaDeArquivos = async (
    lista: ArquivoImovelPreCarregado[]
  ) => {
    if (lista.length === 0) return;
    setProcessando(true);
    try {
      const titNorm = normalizarSemAcento(titularFiltro || titularEsperado);
      const cpfLimpo = (cpfFiltro || cpfEsperado).replace(/\D/g, '');
      const novosResultados: ResultadoAuditoriaDocImovel[] = [];

      for (const item of lista) {
        if (!item.file.name.toLowerCase().endsWith('.pdf')) continue;
        const res = await auditarArquivoImovelIndividual(
          item.file,
          item.caminhoSubpasta,
          titNorm,
          cpfLimpo
        );
        novosResultados.push(res);
      }

      setResultados((prev) => {
        const mapa = new Map<string, ResultadoAuditoriaDocImovel>();
        prev.forEach((r) => mapa.set(r.nomeArquivo, r));
        novosResultados.forEach((r) => mapa.set(r.nomeArquivo, r));
        return Array.from(mapa.values());
      });
    } finally {
      setProcessando(false);
    }
  };

  // Diagnóstico Cruzado entre todos os PDFs de Imóveis importados
  const diagnosticoCruzadoKitImovel = useMemo(() => {
    const temMatriculaOuTitulo = resultados.some(
      (r) =>
        r.tipoDetectado === 'INTEIRO_TEOR_MATRICULA' ||
        r.tipoDetectado === 'TITULO_DOMINIO'
    );
    const temCcir = resultados.some((r) => r.tipoDetectado === 'CCIR');
    const temItr = resultados.some((r) => r.tipoDetectado === 'CND_ITR');
    const temCar = resultados.some((r) => r.tipoDetectado === 'CAR_RECIBO');

    const areasLidas = resultados
      .map((r) => ({
        doc: r.rotuloTipo.split(' ')[1] || r.nomeArquivo,
        val: parseFloatBR(r.areaExtraidaHa),
        bruto: r.areaExtraidaHa,
      }))
      .filter((x) => x.val > 0);

    const areaProjNum = parseFloatBR(areaEsperada);
    let divergenciaAreaDetectada = false;
    let msgComparacaoAreas = '';

    if (areasLidas.length >= 2) {
      const minA = Math.min(...areasLidas.map((a) => a.val));
      const maxA = Math.max(...areasLidas.map((a) => a.val));
      if (maxA - minA > Math.max(2, minA * 0.05)) {
        divergenciaAreaDetectada = true;
        msgComparacaoAreas = `⚠️ Divergência de Área entre os documentos do imóvel: ${areasLidas
          .map((a) => `${a.doc}: ${a.bruto} ha`)
          .join(' × ')}!`;
      } else {
        msgComparacaoAreas = `✅ Áreas consistentes entre os documentos (${areasLidas
          .map((a) => `${a.doc}: ${a.bruto} ha`)
          .join(' | ')}).`;
      }
    } else if (areasLidas.length === 1 && areaProjNum > 0) {
      const dif = Math.abs(areasLidas[0].val - areaProjNum);
      if (dif > Math.max(2, areaProjNum * 0.05)) {
        divergenciaAreaDetectada = true;
        msgComparacaoAreas = `⚠️ Área no documento (${areasLidas[0].bruto} ha) diverge da área informada no Projeto (${areaEsperada} ha)!`;
      } else {
        msgComparacaoAreas = `✅ Área do documento (${areasLidas[0].bruto} ha) compatível com o Projeto (${areaEsperada} ha).`;
      }
    }

    return {
      temMatriculaOuTitulo,
      temCcir,
      temItr,
      temCar,
      divergenciaAreaDetectada,
      msgComparacaoAreas,
    };
  }, [resultados, areaEsperada]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        zIndex: 980000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#f8fafc',
          width: '95vw',
          maxWidth: '1320px',
          height: '92vh',
          borderRadius: '12px',
          boxShadow: '0 25px 55px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #1d4ed8',
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '14px 22px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                color: '#1e3a8a',
                fontWeight: 900,
              }}
            >
              🏡 AUDITORIA MULTI-PDF DE DOCUMENTAÇÃO DE IMÓVEIS (MATRÍCULA, CCIR,
              ITR, CAR E TÍTULOS)
            </h3>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              Selecione vários PDFs de uma vez para verificar Validade (30 dias),
              Cadeia Dominial (15 anos), Gravames/Hipotecas, Exercício do CCIR,
              CND do ITR e Cruzamento de Áreas (ha).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {resultados.length > 0 && (
              <button
                type="button"
                onClick={() => setResultados([])}
                style={{
                  width: 'auto',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                🗑️ Limpar Lista
              </button>
            )}

            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 800,
                background: '#e2e8f0',
                color: '#1e293b',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ✖ Fechar Auditoria de Imóveis
            </button>
          </div>
        </div>

        {/* BARRA DE IMPORTAÇÃO MULTI-PDF E PARÂMETROS DE CRUZAMENTO */}
        <div
          style={{
            margin: '12px 20px 0 20px',
            padding: '12px 16px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderLeft: '5px solid #1d4ed8',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '36px',
                  padding: '0 18px',
                  background: '#1d4ed8',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  margin: 0,
                  boxShadow: '0 2px 6px rgba(29, 78, 216, 0.3)',
                }}
              >
                {processando
                  ? '⏳ Varrer e Auditando PDFs...'
                  : '📂 Selecionar PDFs de Imóveis no Computador (Multi-Seleção)'}
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    processarListaDeArquivos(files.map((f) => ({ file: f })));
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              {arquivosImovelDaPasta.length > 0 && (
                <button
                  type="button"
                  onClick={() => processarListaDeArquivos(arquivosImovelDaPasta)}
                  style={{
                    width: 'auto',
                    height: '36px',
                    padding: '0 16px',
                    background: '#004C27',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 800,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Puxar Automaticamente os {arquivosImovelDaPasta.length}{' '}
                  PDF(s) de Imóvel da Pasta Aberta
                </button>
              )}
            </div>

            <span style={{ fontSize: '11px', color: '#64748b' }}>
              💡 Dica: Segure <b>Ctrl</b> ou <b>Shift</b> na janela para
              selecionar todos os PDFs da pasta{' '}
              <i>DOCUMENTAÇÃO DO(S) IMÓVEL(IS)</i> de uma só vez!
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1.2fr 0.8fr',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px dashed #e2e8f0',
            }}
          >
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                👤 Proprietário / Proponente Esperado
              </label>
              <input
                type="text"
                value={titularFiltro}
                onChange={(e) => setTitularFiltro(e.target.value.toUpperCase())}
                placeholder="Nome do proprietário para conferir titularidade..."
                style={{
                  width: '100%',
                  height: '30px',
                  fontSize: '11.5px',
                  padding: '4px 8px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                🪪 CPF do Proprietário
              </label>
              <input
                type="text"
                value={cpfFiltro}
                onChange={(e) => setCpfFiltro(e.target.value)}
                placeholder="000.000.000-00"
                style={{
                  width: '100%',
                  height: '30px',
                  fontSize: '11.5px',
                  padding: '4px 8px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                🏡 Denominação do Imóvel
              </label>
              <input
                type="text"
                value={nomeImovelAlvo}
                onChange={(e) =>
                  setNomeImovelAlvo(e.target.value.toUpperCase())
                }
                placeholder="Ex: FAZENDA SANTA MARIA"
                style={{
                  width: '100%',
                  height: '30px',
                  fontSize: '11.5px',
                  padding: '4px 8px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                📐 Área no Projeto (ha)
              </label>
              <input
                type="text"
                value={areaEsperada}
                onChange={(e) => setAreaEsperada(e.target.value)}
                placeholder="Ex: 85,50"
                style={{
                  width: '100%',
                  height: '30px',
                  fontSize: '11.5px',
                  padding: '4px 8px',
                  fontWeight: 800,
                }}
              />
            </div>
          </div>
        </div>

        {/* PAINEL DE CHECKLIST DO KIT FUNDIÁRIO E CRUZAMENTO DE ÁREAS */}
        {resultados.length > 0 && (
          <div
            style={{
              margin: '10px 20px 0 20px',
              padding: '10px 16px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                {
                  label: 'Matrícula / Título',
                  ok: diagnosticoCruzadoKitImovel.temMatriculaOuTitulo,
                },
                { label: 'CCIR Vigente', ok: diagnosticoCruzadoKitImovel.temCcir },
                { label: 'CND de ITR', ok: diagnosticoCruzadoKitImovel.temItr },
                { label: 'Recibo CAR', ok: diagnosticoCruzadoKitImovel.temCar },
              ].map((item) => (
                <span
                  key={item.label}
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: item.ok ? '#dcfce7' : '#fee2e2',
                    color: item.ok ? '#166534' : '#991b1b',
                    border: `1px solid ${item.ok ? '#86efac' : '#fca5a5'}`,
                  }}
                >
                  {item.ok ? '✅ ' : '❌ Falta: '}
                  {item.label}
                </span>
              ))}
            </div>

            {diagnosticoCruzadoKitImovel.msgComparacaoAreas && (
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: diagnosticoCruzadoKitImovel.divergenciaAreaDetectada
                    ? '#b45309'
                    : '#15803d',
                }}
              >
                {diagnosticoCruzadoKitImovel.msgComparacaoAreas}
              </span>
            )}
          </div>
        )}

        {/* LISTA DE CARTÕES DOS DOCUMENTOS DE IMÓVEIS AUDITADOS */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px 20px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {resultados.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '50px 20px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <div style={{ fontSize: '38px', marginBottom: '8px' }}>🏡</div>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                Nenhum PDF de imóvel importado ainda
              </strong>
              <p style={{ fontSize: '12px', margin: '6px 0 0 0' }}>
                Clique em{' '}
                <b>&ldquo;📂 Selecionar PDFs de Imóveis no Computador&rdquo;</b>{' '}
                (ou no botão verde para puxar direto da pasta aberta) para
                iniciar a varredura.
              </p>
            </div>
          ) : (
            resultados.map((res) => {
              const corBorda =
                res.status === 'ERRO'
                  ? '#dc2626'
                  : res.status === 'ALERTA'
                  ? '#f59e0b'
                  : '#16a34a';
              const corBg =
                res.status === 'ERRO'
                  ? '#fef2f2'
                  : res.status === 'ALERTA'
                  ? '#fffbeb'
                  : '#f0fdf4';

              return (
                <div
                  key={res.id}
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${corBorda}`,
                    borderLeft: `6px solid ${corBorda}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 900,
                          color: '#1e3a8a',
                          background: '#dbeafe',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          marginRight: '8px',
                        }}
                      >
                        {res.rotuloTipo}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {res.nomeArquivo}
                      </strong>
                      {res.subpastaOrigem && (
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: '#64748b',
                            marginLeft: '8px',
                          }}
                        >
                          [{res.subpastaOrigem}]
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {res.identificadorExtraido && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#f1f5f9',
                            color: '#0f172a',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          🆔 {res.identificadorExtraido}
                        </span>
                      )}

                      {res.areaExtraidaHa && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#ecfdf5',
                            color: '#047857',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          📐 Área: {res.areaExtraidaHa} ha
                        </span>
                      )}

                      {res.dataEmissaoOuValidade && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          📅 {res.dataEmissaoOuValidade}
                        </span>
                      )}

                      {!res.ehEscaneadoImagem && titularFiltro && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            background: res.proprietarioLocalizado
                              ? '#dcfce7'
                              : '#fef3c7',
                            color: res.proprietarioLocalizado
                              ? '#166534'
                              : '#92400e',
                            padding: '3px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {res.proprietarioLocalizado
                            ? '👤 Proprietário Confirmado'
                            : '⚠️ Verificar Titular/Interveniente'}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 900,
                          background: corBg,
                          color: corBorda,
                          border: `1px solid ${corBorda}`,
                          padding: '3px 10px',
                          borderRadius: '12px',
                        }}
                      >
                        {res.status === 'OK'
                          ? '✅ CONFORME'
                          : res.status === 'ALERTA'
                          ? '⚠️ ATENÇÃO'
                          : '🚨 IMPEDIMENTO'}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      background: corBg,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      color: '#1e293b',
                      fontWeight: 600,
                    }}
                  >
                    {res.apontamentos.map((ap, i) => (
                      <div key={i}>{ap}</div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}