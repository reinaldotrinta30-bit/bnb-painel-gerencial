'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
import { removerAcentos } from '@/lib/auditorInteligentePdfPasta';
import {
  auditarContratoPdfCompleto,
  auditarSintoniaPacoteDerivada,
  criarControleCancelamentoOcr,
  ControleCancelamentoOcrContrato,
  gerarScriptCopilotParaContrato,
  aplicarRespostaCopilotNoResultadoContrato,
  ModoScriptCopilotContrato,
  ResultadoAuditoriaContratoPdf,
  ResultadoDossieDerivadaKit,
  ItemChecklistConformidadeContrato,
} from '@/lib/auditorConformidadeContratos';

interface TelaConformidadeContratosProps {
  aberto: boolean;
  onFechar: () => void;
  contratacoes: RegistroContratacao[];
}

interface OcorrenciaBuscaPdf {
  indiceArquivo: number;
  nomeArquivo: string;
  pagina: number;
  totalPaginas: number;
  trechoAntes: string;
  termoEncontrado: string;
  trechoDepois: string;
}

export default function TelaConformidadeContratos({
  aberto,
  onFechar,
  contratacoes,
}: TelaConformidadeContratosProps) {
  const [modoEscopo, setModoEscopo] = useState<'LIMITE_LCG' | 'DERIVADAS'>(
    'LIMITE_LCG'
  );
  const [arquivosContratos, setArquivosContratos] = useState<File[]>([]);
  const [resultados, setResultados] = useState<ResultadoAuditoriaContratoPdf[]>(
    []
  );
  const [dossieKitDerivada, setDossieKitDerivada] =
    useState<ResultadoDossieDerivadaKit | null>(null);
  // -1 = Visão Global Consolidada de Sintonia do Kit | >= 0 = Documento individual
  const [indiceAtivo, setIndiceAtivo] = useState<number>(0);
  const [indicePdfVisualizando, setIndicePdfVisualizando] = useState<number>(0);
  const [auditando, setAuditando] = useState(false);
  const [progressoMsg, setProgressoMsg] = useState('');
  const [mostrarPdfLadoALado, setMostrarPdfLadoALado] = useState(true);
  const [modalPdfExpandidoAberto, setModalPdfExpandidoAberto] = useState(false);
  const [urlPdfAtivo, setUrlPdfAtivo] = useState<string | null>(null);
  const [chaveCopiada, setChaveCopiada] = useState('');

  // =========================================================================
  // ESTADOS DO BUSCADOR INTELIGENTE DENTRO DO PDF (COM SALTO DE PÁGINA)
  // =========================================================================
  // Mapa: indiceArquivo -> Array de textos por página (índice 0 = Pág 1, etc.)
  const [paginasTextoPorArquivo, setPaginasTextoPorArquivo] = useState<
    Record<number, string[]>
  >({});
  const [termoBuscaPdf, setTermoBuscaPdf] = useState('');
  const [escopoBuscaPdf, setEscopoBuscaPdf] = useState<
    'TODOS_KIT' | 'ATUAL_APENAS'
  >('TODOS_KIT');
  const [indiceOcorrenciaAtiva, setIndiceOcorrenciaAtiva] = useState<number>(0);
  const [paginaPdfAlvo, setPaginaPdfAlvo] = useState<number>(1);
  const [modoDestaqueVisualDoc, setModoDestaqueVisualDoc] =
    useState<boolean>(true);
  const [zoomPdfDestaque, setZoomPdfDestaque] = useState<number>(1.25);
  const [retangulosGrifoPag, setRetangulosGrifoPag] = useState<
    Array<{ left: number; top: number; width: number; height: number }>
  >([]);
  const canvasPdfBuscaRef = useRef<HTMLCanvasElement | null>(null);
  const containerScrollPdfBuscaRef = useRef<HTMLDivElement | null>(null);
  const marcadorGrifoPrincipalRef = useRef<HTMLDivElement | null>(null);

  // Controle de Cancelamento Instantâneo do OCR
  const controleCancelamentoOcrRef =
    useRef<ControleCancelamentoOcrContrato | null>(null);

  // Estados do Modal Inteligente de Script do Copilot para Contratos
  const [modalCopilotAberto, setModalCopilotAberto] = useState(false);
  const [modoScriptCopilot, setModoScriptCopilot] =
    useState<ModoScriptCopilotContrato>('AUTO_ATUAL');
  const [indiceDocAlvoCopilot, setIndiceDocAlvoCopilot] = useState<number>(0);
  const [scriptCopilotEditavel, setScriptCopilotEditavel] = useState('');
  const [respostaColadaCopilot, setRespostaColadaCopilot] = useState('');
  const [copiadoScriptOk, setCopiadoScriptOk] = useState(false);

  const inputArquivosRef = useRef<HTMLInputElement>(null);
  const inputBuscaPdfRef = useRef<HTMLInputElement>(null);

  const resultadoAtivo: ResultadoAuditoriaContratoPdf | null = useMemo(() => {
    if (
      indiceAtivo === -1 &&
      dossieKitDerivada?.ehKitDerivada &&
      dossieKitDerivada.resumoConsolidado
    ) {
      return dossieKitDerivada.resumoConsolidado;
    }
    return resultados[indiceAtivo] || resultados[0] || null;
  }, [indiceAtivo, resultados, dossieKitDerivada]);

  const arquivoAtivo =
    arquivosContratos[indicePdfVisualizando] || arquivosContratos[0] || null;

  useEffect(() => {
    if (!arquivoAtivo) {
      setUrlPdfAtivo(null);
      return;
    }
    const url = URL.createObjectURL(arquivoAtivo);
    setUrlPdfAtivo(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivoAtivo]);

  // Indexa em segundo plano o texto página por página de cada PDF carregado para permitir busca exata com salto para #page=X
  useEffect(() => {
    let cancelado = false;
    if (arquivosContratos.length === 0) {
      setPaginasTextoPorArquivo({});
      return;
    }

    const indexarPaginasDosPdfs = async () => {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const pdfjsLib = win?.pdfjsLib;
      const novoMapa: Record<number, string[]> = {};

      for (let i = 0; i < arquivosContratos.length; i++) {
        if (cancelado) return;
        const file = arquivosContratos[i];
        try {
          if (pdfjsLib) {
            const buffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) })
              .promise;
            const numPags = pdf.numPages || 1;
            const listaPags: string[] = [];

            for (let p = 1; p <= numPags; p++) {
              const page = await pdf.getPage(p);
              const content = await page.getTextContent();
              const itens = (content.items || []) as Array<any>;
              const txtPag = itens
                .map((it) => (it.str || '').trim())
                .filter(Boolean)
                .join(' ');
              listaPags.push(txtPag);
            }
            novoMapa[i] = listaPags;
          } else if (resultados[i]?.textoCompletoExtraido) {
            novoMapa[i] = [resultados[i].textoCompletoExtraido];
          }
        } catch {
          if (resultados[i]?.textoCompletoExtraido) {
            novoMapa[i] = [resultados[i].textoCompletoExtraido];
          }
        }
      }

      if (!cancelado) {
        setPaginasTextoPorArquivo(novoMapa);
      }
    };

    indexarPaginasDosPdfs();
    return () => {
      cancelado = true;
    };
  }, [arquivosContratos, resultados]);

  // Calcula todas as ocorrências do termo buscado (com suporte a busca sem acento e salto de página/arquivo)
  const ocorrenciasBuscaPdf: OcorrenciaBuscaPdf[] = useMemo(() => {
    const queryLimpa = termoBuscaPdf.trim();
    if (queryLimpa.length < 2) return [];

    const queryNorm = removerAcentos(queryLimpa).toUpperCase();
    const listaOcorrencias: OcorrenciaBuscaPdf[] = [];

    const indicesParaVarrer =
      escopoBuscaPdf === 'ATUAL_APENAS' || arquivosContratos.length <= 1
        ? [indicePdfVisualizando]
        : arquivosContratos.map((_, idx) => idx);

    for (const idxArq of indicesParaVarrer) {
      const arq = arquivosContratos[idxArq];
      if (!arq) continue;
      const paginas = paginasTextoPorArquivo[idxArq] || [
        resultados[idxArq]?.textoCompletoExtraido || '',
      ];
      const totalPags = paginas.length || 1;

      paginas.forEach((txtPag, idxPag) => {
        if (!txtPag) return;
        const txtPagNorm = removerAcentos(txtPag).toUpperCase();
        let posInicial = 0;
        let seguranca = 0;

        while (posInicial < txtPagNorm.length && seguranca < 40) {
          const idxMatch = txtPagNorm.indexOf(queryNorm, posInicial);
          if (idxMatch === -1) break;

          const inicioContexto = Math.max(0, idxMatch - 55);
          const fimMatch = idxMatch + queryNorm.length;
          const fimContexto = Math.min(txtPag.length, fimMatch + 65);

          listaOcorrencias.push({
            indiceArquivo: idxArq,
            nomeArquivo: arq.name,
            pagina: idxPag + 1,
            totalPaginas: totalPags,
            trechoAntes:
              (inicioContexto > 0 ? '...' : '') +
              txtPag.substring(inicioContexto, idxMatch),
            termoEncontrado: txtPag.substring(idxMatch, fimMatch),
            trechoDepois:
              txtPag.substring(fimMatch, fimContexto) +
              (fimContexto < txtPag.length ? '...' : ''),
          });

          posInicial = fimMatch;
          seguranca++;
        }
      });
    }

    return listaOcorrencias;
  }, [
    termoBuscaPdf,
    escopoBuscaPdf,
    indicePdfVisualizando,
    arquivosContratos,
    paginasTextoPorArquivo,
    resultados,
  ]);

  const ocorrenciaAtualSelecionada =
    ocorrenciasBuscaPdf[indiceOcorrenciaAtiva] || null;

  // Sempre que a ocorrência ativa mudar, direciona automaticamente o leitor de PDF para o arquivo e a página exata!
  useEffect(() => {
    if (!ocorrenciaAtualSelecionada) return;
    if (ocorrenciaAtualSelecionada.indiceArquivo !== indicePdfVisualizando) {
      setIndicePdfVisualizando(ocorrenciaAtualSelecionada.indiceArquivo);
    }
    setPaginaPdfAlvo(ocorrenciaAtualSelecionada.pagina);
    setModoDestaqueVisualDoc(true);
  }, [ocorrenciaAtualSelecionada, indicePdfVisualizando]);

  // Renderiza a página do PDF no Canvas e desenha o destaque (tipo Ctrl+F) exatamente em cima da palavra no documento!
  useEffect(() => {
    let cancelado = false;
    const queryLimpa = termoBuscaPdf.trim();

    if (
      !arquivoAtivo ||
      queryLimpa.length < 2 ||
      !modoDestaqueVisualDoc ||
      (!mostrarPdfLadoALado && !modalPdfExpandidoAberto)
    ) {
      setRetangulosGrifoPag([]);
      return;
    }

    const renderizarPaginaComGrifo = async () => {
      try {
        const win = typeof window !== 'undefined' ? (window as any) : null;
        const pdfjsLib = win?.pdfjsLib;
        const canvas = canvasPdfBuscaRef.current;
        if (!pdfjsLib || !canvas) return;

        const buffer = await arquivoAtivo.arrayBuffer();
        if (cancelado) return;

        const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) })
          .promise;
        const numPag = Math.min(
          Math.max(1, paginaPdfAlvo),
          pdf.numPages || 1
        );
        const page = await pdf.getPage(numPag);
        if (cancelado) return;

        const viewport = page.getViewport({ scale: zoomPdfDestaque });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelado) return;

        // Localiza as coordenadas exatas (X, Y, Largura, Altura) do termo buscado dentro da página
        const content = await page.getTextContent();
        if (cancelado) return;

        const queryNorm = removerAcentos(queryLimpa).toUpperCase();
        const palavrasQuery = queryNorm
          .split(/\s+/)
          .filter((p) => p.length >= 2);
        const caixas: Array<{
          left: number;
          top: number;
          width: number;
          height: number;
        }> = [];

        for (const it of (content.items || []) as Array<any>) {
          const strOrig = String(it.str || '');
          if (!strOrig.trim()) continue;
          const strNorm = removerAcentos(strOrig).toUpperCase();

          // Verifica match da frase completa dentro do token ou de palavras da busca
          let idxMatch = strNorm.indexOf(queryNorm);
          let tamMatch = queryNorm.length;

          if (idxMatch === -1 && palavrasQuery.length > 1) {
            for (const pal of palavrasQuery) {
              const iPal = strNorm.indexOf(pal);
              if (iPal !== -1) {
                idxMatch = iPal;
                tamMatch = pal.length;
                break;
              }
            }
          }

          if (idxMatch !== -1) {
            const tr = Array.isArray(it.transform)
              ? it.transform
              : [1, 0, 0, 1, 0, 0];
            const fontH = Math.hypot(tr[2], tr[3]) || 10;
            const [vx, vy] = viewport.convertToViewportPoint(tr[4], tr[5]);
            const largTotalToken =
              (Number(it.width) || strOrig.length * (fontH * 0.52)) *
              zoomPdfDestaque;

            const inicioProp = idxMatch / Math.max(1, strOrig.length);
            const tamProp = tamMatch / Math.max(1, strOrig.length);

            const left = vx + largTotalToken * inicioProp - 2;
            const width = Math.max(18, largTotalToken * tamProp + 4);
            const height = Math.max(14, fontH * zoomPdfDestaque * 1.25);
            const top = vy - fontH * zoomPdfDestaque * 0.92;

            caixas.push({ left, top, width, height });
          }
        }

        setRetangulosGrifoPag(caixas);

        // Faz o scroll automático suave para centralizar exatamente o trecho grifado na tela!
        setTimeout(() => {
          marcadorGrifoPrincipalRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }, 90);
      } catch (e) {
        console.error('Erro ao grifar texto no PDF:', e);
      }
    };

    renderizarPaginaComGrifo();
    return () => {
      cancelado = true;
    };
  }, [
    arquivoAtivo,
    paginaPdfAlvo,
    termoBuscaPdf,
    modoDestaqueVisualDoc,
    zoomPdfDestaque,
    indiceOcorrenciaAtiva,
    mostrarPdfLadoALado,
    modalPdfExpandidoAberto,
  ]);

  const navegarParaOcorrencia = (novoIdx: number) => {
    if (ocorrenciasBuscaPdf.length === 0) return;
    const total = ocorrenciasBuscaPdf.length;
    const idxCircular = ((novoIdx % total) + total) % total;
    setIndiceOcorrenciaAtiva(idxCircular);
    const alvo = ocorrenciasBuscaPdf[idxCircular];
    if (alvo) {
      if (alvo.indiceArquivo !== indicePdfVisualizando) {
        setIndicePdfVisualizando(alvo.indiceArquivo);
      }
      setPaginaPdfAlvo(alvo.pagina);
    }
  };

  // Dispara uma busca inteligente no PDF (abrindo a coluna lateral do PDF se estiver oculta)
  const acionarBuscaDiretaNoPdf = (termo: string) => {
    if (!termo || !termo.trim()) return;
    if (!mostrarPdfLadoALado && !modalPdfExpandidoAberto) {
      setMostrarPdfLadoALado(true);
    }
    setEscopoBuscaPdf('TODOS_KIT');
    setTermoBuscaPdf(termo.trim());
    setIndiceOcorrenciaAtiva(0);
    setTimeout(() => {
      inputBuscaPdfRef.current?.focus();
    }, 80);
  };

  // Gera chips inteligentes de busca com 1 clique baseados nos alertas e dados extraídos
  const atalhosBuscaInteligentePdf = useMemo(() => {
    if (!resultadoAtivo && resultados.length === 0) return [];
    const r = resultadoAtivo || resultados[0];
    const chips: Array<{
      label: string;
      termo: string;
      cor: 'erro' | 'alerta' | 'info';
    }> = [];
    const vistos = new Set<string>();

    const addChip = (
      label: string,
      termo: string,
      cor: 'erro' | 'alerta' | 'info'
    ) => {
      const limpo = (termo || '').trim();
      if (!limpo || limpo.length < 2) return;
      const ch = limpo.toUpperCase();
      if (vistos.has(ch)) return;
      vistos.add(ch);
      chips.push({ label, termo: limpo, cor });
    };

    // 1. Se houver rodapé interno detectado em qualquer documento
    if (
      r.possuiRodapeDocumentoInterno ||
      resultados.some((x) => x.possuiRodapeDocumentoInterno)
    ) {
      addChip('🚨 Rodapé: "Interno"', 'Interno', 'erro');
    }

    // 2. Contas Correntes e Conta-Reserva (incluindo contas divergentes em todos os PDFs carregados)
    resultados.forEach((doc) => {
      if (doc.contaCorrenteDebito) {
        const diverge =
          r.contaCorrenteDebito &&
          doc.contaCorrenteDebito !== r.contaCorrenteDebito;
        addChip(
          `${diverge ? '🚨' : '🏦'} C/C: ${doc.contaCorrenteDebito}`,
          doc.contaCorrenteDebito,
          diverge ? 'erro' : 'info'
        );
      }
      (doc.contasCorrentesCitadasNaCcb || []).forEach((cc) => {
        const diverge = r.contaCorrenteDebito && cc !== r.contaCorrenteDebito;
        addChip(
          `${diverge ? '🚨' : '🏦'} C/C: ${cc}`,
          cc,
          diverge ? 'erro' : 'info'
        );
      });
      if (doc.contaReservaNumero) {
        addChip(
          `🔒 Conta-Reserva: ${doc.contaReservaNumero}`,
          doc.contaReservaNumero,
          'info'
        );
      }
    });

    // 3. Valor Contratado, Taxa de Juros, Nº do Contrato e Local
    if (r.valorClausulaPrimeira) {
      addChip(
        `💰 Valor: ${r.valorClausulaPrimeira}`,
        r.valorClausulaPrimeira,
        'info'
      );
    }
    if (r.taxaJurosAnual) {
      const numTx = r.taxaJurosAnual.replace(/\s*a\.a\.?/i, '').trim();
      addChip(`📈 Taxa: ${numTx}`, numTx, 'info');
    }
    if (r.numeroContratoCedula) {
      addChip(`🔢 Nº: ${r.numeroContratoCedula}`, r.numeroContratoCedula, 'info');
    }
    addChip('📍 Local: SANTA IN', 'SANTA IN', 'info');

    // 4. CPF do Titular, Avalista, Procurador, Limite Vinculado e Imóvel
    if (r.creditadoCpf) {
      addChip(`🪪 CPF: ${r.creditadoCpf}`, r.creditadoCpf, 'info');
    }
    if (r.avalistaNome) {
      addChip(`🛡️ Avalista: ${r.avalistaNome.split(' ')[0]}`, r.avalistaNome, 'info');
    }
    if (r.procuradorNome) {
      addChip(
        `⚖️ Procurador: ${r.procuradorNome.split(' ')[0]}`,
        r.procuradorNome,
        'alerta'
      );
    }
    if (r.numeroContratoLimiteVinculado) {
      addChip(
        `🏛️ LCG: ${r.numeroContratoLimiteVinculado}`,
        r.numeroContratoLimiteVinculado,
        'info'
      );
    }
    const nomeIm =
      r.imovelBeneficiadoNome || r.imoveisGarantia[0]?.denominacao || '';
    if (nomeIm && !nomeIm.includes('Conforme Instrumento')) {
      addChip(`🏡 ${nomeIm.slice(0, 22)}`, nomeIm, 'info');
    }

    return chips;
  }, [resultadoAtivo, resultados]);

  // Extrai termos pesquisáveis de um item do Checklist para o botão "🔎 Localizar no PDF"
  const extrairTermosDeBuscaDoItemChecklist = (
    item: ItemChecklistConformidadeContrato
  ): string[] => {
    const textoCombinado = `${item.resumo} ${(item.detalhes || []).join(' ')}`;
    const candidatos: string[] = [];

    if (/CLASSIFICADO\s+COMO\s*:?\s*INTERNO/i.test(textoCombinado)) {
      candidatos.push('Interno');
    }

    // Contas correntes citadas no alerta (ex: "nº 253787", "nº 60411-4")
    const matchesContas = [
      ...textoCombinado.matchAll(/n[°ºo]\s*([0-9]{4,9}(?:-[0-9X])?)/gi),
    ];
    matchesContas.forEach((m) => candidatos.push(m[1]));

    // Valores monetários citados no alerta (ex: "R$ 97.748,64")
    const matchesValores = [
      ...textoCombinado.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g),
    ];
    matchesValores.forEach((m) => {
      if (m[1] !== '0,00') candidatos.push(m[1]);
    });

    // Datas dd/mm/20xx citadas no alerta
    const matchesDatas = [
      ...textoCombinado.matchAll(/\b(\d{2}\/\d{2}\/20\d{2})\b/g),
    ];
    matchesDatas.forEach((m) => candidatos.push(m[1]));

    // Número de contrato 103.20xx...
    const matchNumContr = textoCombinado.match(
      /\b(\d{3}\.20\d{2}\.\d{1,5}\.\d{3,8})\b/
    );
    if (matchNumContr) candidatos.push(matchNumContr[1]);

    if (item.id.includes('LOCAL') || textoCombinado.includes('SANTA INES')) {
      candidatos.push('SANTA IN');
    }

    return Array.from(new Set(candidatos)).slice(0, 4);
  };

  useEffect(() => {
    if (!modalCopilotAberto) return;
    const docRef =
      resultados[indiceDocAlvoCopilot] || resultadoAtivo || resultados[0] || null;
    const novoScript = gerarScriptCopilotParaContrato({
      modo: modoScriptCopilot,
      resultadoAtual: docRef,
      todosResultados: resultados,
    });
    setScriptCopilotEditavel(novoScript);
  }, [
    modalCopilotAberto,
    modoScriptCopilot,
    indiceDocAlvoCopilot,
    resultadoAtivo,
    resultados,
  ]);

  const cancelarLeituraOcrImediatamente = async (
    modo: 'USAR_TEXTO_PARCIAL' | 'ABORTAR_TUDO'
  ) => {
    const ctrl = controleCancelamentoOcrRef.current;
    if (ctrl) {
      ctrl.modo = modo;
      ctrl.cancelado = true;
      await ctrl.terminarWorkerAtivo?.();
    }
    if (modo === 'ABORTAR_TUDO') {
      setAuditando(false);
      setProgressoMsg('');
    } else {
      setProgressoMsg(
        '⚡ OCR interrompido! Concluindo com leitura rápida para liberar a tela...'
      );
    }
  };

  const limparConsultaConformidade = async () => {
    if (controleCancelamentoOcrRef.current) {
      await cancelarLeituraOcrImediatamente('ABORTAR_TUDO');
    }
    setArquivosContratos([]);
    setResultados([]);
    setDossieKitDerivada(null);
    setPaginasTextoPorArquivo({});
    setTermoBuscaPdf('');
    setIndiceOcorrenciaAtiva(0);
    setPaginaPdfAlvo(1);
    setIndiceAtivo(0);
    setIndicePdfVisualizando(0);
    setAuditando(false);
    setProgressoMsg('');
    setUrlPdfAtivo(null);
    setChaveCopiada('');
    setRespostaColadaCopilot('');
    if (inputArquivosRef.current) {
      inputArquivosRef.current.value = '';
    }
  };

  const processarArquivosSelecionados = async (
    files: File[],
    forcarOcr = false
  ) => {
    if (files.length === 0) return;
    const ctrl = criarControleCancelamentoOcr();
    controleCancelamentoOcrRef.current = ctrl;

    setArquivosContratos(files);
    setTermoBuscaPdf('');
    setIndiceOcorrenciaAtiva(0);
    setPaginaPdfAlvo(1);
    setAuditando(true);
    const novosResultados: ResultadoAuditoriaContratoPdf[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        if (ctrl.cancelado && ctrl.modo === 'ABORTAR_TUDO') {
          break;
        }
        const f = files[i];
        setProgressoMsg(
          `⏳ Auditando documento ${i + 1} de ${files.length}: "${f.name}"...`
        );
        const res = await auditarContratoPdfCompleto({
          file: f,
          forcarOcr: forcarOcr && !ctrl.cancelado,
          onProgresso: (msg) => setProgressoMsg(msg),
          contratacoesPainel: contratacoes,
          controleCancelamento: ctrl,
        });
        novosResultados.push(res);
      }

      if (ctrl.cancelado && ctrl.modo === 'ABORTAR_TUDO') {
        return;
      }

      setResultados(novosResultados);
      const analiseKit = auditarSintoniaPacoteDerivada(novosResultados);
      setDossieKitDerivada(analiseKit);

      if (analiseKit.ehKitDerivada) {
        setModoEscopo('DERIVADAS');
        setIndiceAtivo(-1);
        const idxCcb = novosResultados.findIndex(
          (r) =>
            r.tipoInstrumento === 'CCB_DERIVADA' ||
            r.tipoInstrumento === 'ADITIVO_CCB_RENOVACAO'
        );
        setIndicePdfVisualizando(idxCcb !== -1 ? idxCcb : 0);
      } else {
        setModoEscopo('LIMITE_LCG');
        setIndiceAtivo(0);
        setIndicePdfVisualizando(0);
      }
    } catch (err) {
      console.error('Erro na auditoria do contrato:', err);
      alert('❌ Ocorreu um erro ao ler o(s) PDF(s) do contrato.');
    } finally {
      controleCancelamentoOcrRef.current = null;
      setAuditando(false);
      setProgressoMsg('');
    }
  };

  const selecionarPastaComContratos = async () => {
    const win = window as any;
    if (!win.showDirectoryPicker) {
      inputArquivosRef.current?.click();
      return;
    }
    try {
      const dirHandle = await win.showDirectoryPicker();
      const encontrados: File[] = [];

      const varrer = async (handleAtual: any, prof = 0) => {
        if (prof > 3) return;
        for await (const [nome, entry] of handleAtual.entries()) {
          if (entry.kind === 'file' && nome.toLowerCase().endsWith('.pdf')) {
            const up = nome.toUpperCase();
            if (
              up.includes('LCGA') ||
              up.includes('LCGH') ||
              up.includes('CONTRATO') ||
              up.includes('CEDULA') ||
              up.includes('CÉDULA') ||
              up.includes('CCB') ||
              up.includes('ADITIVO') ||
              up.includes('PROTOCOLO') ||
              up.includes('PEDIDO') ||
              up.includes('TERMO') ||
              up.includes('ANEXO') ||
              up.includes('ORCAMENTO') ||
              up.includes('ORÇAMENTO') ||
              up.includes('DISPOSIC') ||
              up.includes('CET')
            ) {
              encontrados.push(await entry.getFile());
            }
          } else if (entry.kind === 'directory') {
            await varrer(entry, prof + 1);
          }
        }
      };

      await varrer(dirHandle, 0);
      if (encontrados.length === 0) {
        alert(
          '⚠️ Nenhum arquivo de Contrato/CCB/Aditivo/Anexo/CET foi encontrado nessa pasta. Selecione os PDFs diretamente!'
        );
        inputArquivosRef.current?.click();
        return;
      }
      await processarArquivosSelecionados(encontrados, false);
    } catch {
      // Cancelado pelo usuário
    }
  };

  const reexecutarComOcrNoContratoAtivo = async () => {
    if (!arquivoAtivo || auditando) return;
    const ctrl = criarControleCancelamentoOcr();
    controleCancelamentoOcrRef.current = ctrl;

    setAuditando(true);
    try {
      const resOcr = await auditarContratoPdfCompleto({
        file: arquivoAtivo,
        forcarOcr: true,
        onProgresso: (msg) => setProgressoMsg(msg),
        contratacoesPainel: contratacoes,
        controleCancelamento: ctrl,
      });

      if (ctrl.cancelado && ctrl.modo === 'ABORTAR_TUDO') {
        return;
      }

      const novaLista = resultados.map((item, idx) =>
        idx === indicePdfVisualizando ? resOcr : item
      );
      setResultados(novaLista);
      setDossieKitDerivada(auditarSintoniaPacoteDerivada(novaLista));

      if (!ctrl.cancelado) {
        alert(
          `✅ OCR concluído em "${arquivoAtivo.name}"! Todas as cláusulas foram revalidadas.`
        );
      }
    } finally {
      controleCancelamentoOcrRef.current = null;
      setAuditando(false);
      setProgressoMsg('');
    }
  };

  const abrirModalCopilotInteligente = () => {
    setIndiceDocAlvoCopilot(indicePdfVisualizando);
    if (dossieKitDerivada?.ehKitDerivada && indiceAtivo === -1) {
      setModoScriptCopilot('KIT_COMPLETO_5_DOCS');
    } else {
      setModoScriptCopilot('AUTO_ATUAL');
    }
    setRespostaColadaCopilot('');
    setModalCopilotAberto(true);
  };

  const importarDadosDaRespostaDoCopilot = () => {
    if (!respostaColadaCopilot.trim()) {
      alert(
        '⚠️ Cole a resposta gerada pelo Copilot no campo abaixo antes de importar!'
      );
      return;
    }

    if (resultados.length === 0) {
      const baseVazia: ResultadoAuditoriaContratoPdf = {
        nomeArquivo: 'Contrato Auditado via Copilot',
        numPaginas: 1,
        foiLidoPorOcr: false,
        tipoInstrumento:
          modoEscopo === 'LIMITE_LCG' ? 'LCGA' : 'CCB_DERIVADA',
        tituloInstrumento:
          modoEscopo === 'LIMITE_LCG'
            ? 'CONTRATO DE LIMITE (AUDITADO VIA COPILOT)'
            : 'CCB / OPERAÇÃO DERIVADA (AUDITADA VIA COPILOT)',
        especieInstrumentoVinculado: 'CÉDULA DE CRÉDITO BANCÁRIO',
        porteIdentificado: '',
        programaCredito: '',
        codigoSubprodutoContrato: '',
        numeroContratoCedula: '',
        agenciaPrefixo: '103',
        agenciaNomeCnpj: 'Agência SANTA INÊS (103) — CNPJ: 07.237.373/0103-54',
        agenciaEndereco: 'RUA DO COMERCIO, 187, CENTRO, SANTA INES-MA',
        localAssinaturaFecho: 'SANTA INES - MA',
        localAssinaturaConformeSantaInes: true,
        possuiRodapeDocumentoInterno: false,
        trechoRodapeInternoDetectado: '',
        dataCelebracaoCabecalho: '',
        dataCelebracaoFechoAssinatura: '',
        dataVencimento: '',
        dataPrimeiraParcelaPrincipal: '',
        periodicidadeReembolsoCet: 'ANUAL',
        qtdPrestacoesCet: 7,
        prazoAnosCalculado: '20 anos',
        prazoMesesCalculado: '240',
        carenciaAnosCalculada: '',
        prazoUtilizacaoPrimeiraParcelaDias: '',
        creditadoNome: '',
        creditadoCpf: '',
        creditadoRg: '',
        creditadoRgDataEmissao: '',
        creditadoEstadoCivilRegime: '',
        creditadoEndereco: '',
        creditadoProfissao: '',
        telefoneSmsClausula: '',
        contaCorrenteDebito: '',
        contasCorrentesCitadasNaCcb: [],
        possuiVinculoLimiteLcg: false,
        tipoLimiteVinculado: '',
        numeroContratoLimiteVinculado: '',
        dataEmissaoLimiteVinculado: '',
        percentualUtilizacaoLimiteLcg: '',
        valorExigidoNoLimiteLcg: '',
        possuiFundoLiquidezContaReserva: false,
        contaReservaNumero: '',
        fundoLiquidezPercentual: '',
        fundoLiquidezValorReferencia: '',
        possuiTermoOpcaoTaxaPrefixada: false,
        assessoriaPagaComRecursosPropriosCcb: false,
        imovelBeneficiadoNome: '',
        imovelBeneficiadoMatriculaCartorio: '',
        imovelBeneficiadoProprietario: '',
        imovelBeneficiadoMunicipioUf: '',
        anuenciaIncraSipraCodigo: '',
        anuenciaIncraLote: '',
        anuenciaIncraAtivoDesde: '',
        conjugeNome: '',
        conjugeCpf: '',
        conjugeRg: '',
        conjugeRgDataEmissao: '',
        conjugeEstadoCivilRegime: '',
        conjugeEndereco: '',
        conjugeProfissao: '',
        outorgaConjugalTexto: '',
        possuiAvalista: false,
        avalistaNome: '',
        avalistaCpf: '',
        avalistaRg: '',
        avalistaRgDataEmissao: '',
        avalistaEstadoCivilRegime: '',
        avalistaEndereco: '',
        avalistaProfissao: '',
        conjugeAvalistaNome: '',
        conjugeAvalistaCpf: '',
        possuiRepresentacaoProcurador: false,
        procuradorNome: '',
        procuradorCpf: '',
        procuradorRg: '',
        procuradorEndereco: '',
        valorClausulaPrimeira: '',
        valorExtensoClausulaPrimeira: '',
        valorClausulaSegunda: '',
        valorCabecalhoContinuacao: '',
        valorAvaliacaoTotalImoveis: '',
        valorLiquidoContratadoCet: '',
        valorPrincipalTotalLinhaTotaisAnexoCet: '',
        valorRecursosPropriosOrcamento: '0,00',
        valorJurosTotaisCet: '',
        valorTotalAPagarCet: '',
        taxaJurosAnual: '',
        taxaJurosAnualNum: 0,
        taxaJurosMensal: '',
        taxaJurosMensalNum: 0,
        cetAnual: '',
        cetAnualNum: 0,
        cetMensal: '',
        cetMensalNum: 0,
        bonusAdimplenciaPerc: '',
        encargosInadimplementoResumo: '',
        diaCapitalizacaoMensal: '',
        indiceAtualizacaoGarantia: 'Caderneta de Poupança',
        encargosResumo: '',
        carenciaIntimacaoDias: '60 dias',
        prazoPurgacaoMoraDias: '15 dias',
        taxaOcupacaoMensalLeilao: '1% a.m.',
        foroComarca: 'Comarca de Santa Inês-MA',
        quantidadeViasContrato: '3 vias',
        imoveisGarantia: [],
        certidoesCitadas: [],
        parcelasReembolso: [],
        itensOrcamento: [],
        liberacoesPrevistas: [],
        signatariosPartes: [],
        gerentesBanco: [],
        testemunhas: [],
        itensChecklist: [],
        textoCompletoExtraido: respostaColadaCopilot,
      };

      const novoRes = aplicarRespostaCopilotNoResultadoContrato(
        baseVazia,
        respostaColadaCopilot
      );
      setResultados([novoRes]);
      setDossieKitDerivada(auditarSintoniaPacoteDerivada([novoRes]));
      setIndiceAtivo(0);
      setModalCopilotAberto(false);
      alert(
        '✅ Dados importados do Copilot com sucesso! O Raio-X e o Checklist foram atualizados.'
      );
      return;
    }

    const novaLista = resultados.map((item, idx) => {
      if (
        modoScriptCopilot === 'KIT_COMPLETO_5_DOCS' ||
        idx === indiceDocAlvoCopilot
      ) {
        return aplicarRespostaCopilotNoResultadoContrato(
          item,
          respostaColadaCopilot
        );
      }
      return item;
    });

    setResultados(novaLista);
    const novoKit = auditarSintoniaPacoteDerivada(novaLista);
    setDossieKitDerivada(novoKit);
    setModalCopilotAberto(false);
    alert(
      '✅ Resposta do Copilot importada! Todos os alertas, o Raio-X e o Checklist de Conformidade foram reajustados!'
    );
  };

  const copiarTexto = (chave: string, valor: string) => {
    if (!valor) return;
    navigator.clipboard?.writeText(valor).catch(() => {});
    setChaveCopiada(chave);
    setTimeout(() => setChaveCopiada(''), 1800);
  };

  const resumoSemaforo = useMemo(() => {
    if (!resultadoAtivo) {
      return { erros: 0, alertas: 0, oks: 0, status: 'AGUARDANDO' as const };
    }
    const erros = resultadoAtivo.itensChecklist.filter(
      (i) => i.status === 'ERRO'
    ).length;
    const alertas = resultadoAtivo.itensChecklist.filter(
      (i) => i.status === 'ALERTA'
    ).length;
    const oks = resultadoAtivo.itensChecklist.filter(
      (i) => i.status === 'OK'
    ).length;

    const status =
      erros > 0 ? 'ERRO' : alertas > 0 ? 'ALERTA' : ('APROVADO' as const);
    return { erros, alertas, oks, status };
  }, [resultadoAtivo]);

  const copiarResumoConformidadeContrato = () => {
    if (!resultadoAtivo) return;
    const r = resultadoAtivo;
    const im = r.imoveisGarantia[0];
    const linhas = [
      `*CHECKLIST DE CONFORMIDADE CONTRATUAL — BNB*`,
      `📄 *Instrumento:* ${r.tipoInstrumento} Nº ${r.numeroContratoCedula}`,
      `🏷️ *Porte / Programa:* ${r.porteIdentificado} (${r.programaCredito})`,
      `📍 *Local de Assinatura:* ${r.localAssinaturaFecho} (${
        r.localAssinaturaConformeSantaInes ? 'OK' : 'DIVERGENTE'
      })`,
      `👤 *Creditado:* ${r.creditadoNome} | CPF: ${r.creditadoCpf} | RG: ${r.creditadoRg} (${r.creditadoRgDataEmissao})`,
      `💍 *Estado Civil / Regime:* ${r.creditadoEstadoCivilRegime}`,
      r.contaCorrenteDebito
        ? `🏦 *Conta Corrente Débito:* ${r.contaCorrenteDebito} (Ag. Santa Inês)`
        : '',
      r.imovelBeneficiadoNome
        ? `🏡 *Imóvel Beneficiado:* ${r.imovelBeneficiadoNome} (${r.imovelBeneficiadoProprietario}) — ${r.imovelBeneficiadoMunicipioUf}`
        : '',
      r.anuenciaIncraSipraCodigo
        ? `📜 *Anuência INCRA / SIPRA:* ${r.anuenciaIncraSipraCodigo} (Lote ${r.anuenciaIncraLote} • Ativo desde ${r.anuenciaIncraAtivoDesde})`
        : '',
      r.conjugeNome
        ? `👥 *Cônjuge / Outorgante:* ${r.conjugeNome} | CPF: ${r.conjugeCpf}`
        : '',
      r.possuiRepresentacaoProcurador
        ? `⚖️ *Procurador que Assina:* ${r.procuradorNome} (CPF: ${r.procuradorCpf})`
        : '',
      `💰 *Valor Contratado:* R$ ${r.valorClausulaPrimeira} (${r.valorExtensoClausulaPrimeira})`,
      `📅 *Contratação:* ${
        r.dataCelebracaoCabecalho || r.dataCelebracaoFechoAssinatura
      }${
        r.dataPrimeiraParcelaPrincipal
          ? ` | *1ª Parcela:* ${r.dataPrimeiraParcelaPrincipal}`
          : ''
      } | *Vencimento:* ${r.dataVencimento} (${r.prazoAnosCalculado})`,
      im
        ? `🏡 *Imóvel Garantia:* ${im.denominacao} | Área: ${im.areaHa} | Matrícula/Reg.: ${im.registroMatricula} (${im.livro}) — ${im.cartorioMunicipioUf}`
        : '',
      ``,
      `*VEREDITO DA AUDITORIA:*`,
      ...r.itensChecklist.map(
        (it) =>
          `${
            it.status === 'OK' ? '✅' : it.status === 'ERRO' ? '🚨' : '⚠️'
          } *${it.titulo}:* ${it.resumo}`
      ),
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard?.writeText(linhas);
    alert(
      '📋 Espelho Completo de Conformidade copiado para a área de transferência!'
    );
  };

  // Componente reutilizável da Barra de Busca Inteligente do PDF + Leitor com salto de página (#page=X)
  const renderPainelVisualizadorPdfComBusca = (emModalExpandido = false) => {
    if (!urlPdfAtivo || !arquivoAtivo) return null;
    const srcPdfComPagina = `${urlPdfAtivo}#page=${paginaPdfAlvo}&zoom=page-width`;

    return (
      <section
        style={{
          background: '#0f172a',
          borderRadius: emModalExpandido ? '0' : '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: emModalExpandido ? 'none' : '1px solid #334155',
          height: '100%',
        }}
      >
        {/* BARRA DE TÍTULO DO ARQUIVO + SELETOR DE PÁGINA E EXPANSÃO */}
        <div
          style={{
            padding: '8px 12px',
            background: '#1e293b',
            color: '#ffffff',
            fontSize: '11.5px',
            fontWeight: 800,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              📄 {arquivoAtivo.name}{' '}
              <span style={{ color: '#38bdf8' }}>(Pág. {paginaPdfAlvo})</span>
            </span>

            {arquivosContratos.length > 1 && (
              <select
                value={indicePdfVisualizando}
                onChange={(e) => {
                  setIndicePdfVisualizando(Number(e.target.value));
                  setPaginaPdfAlvo(1);
                }}
                style={{
                  height: '24px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  padding: '0 6px',
                  width: 'auto',
                }}
              >
                {arquivosContratos.map((arq, idx) => (
                  <option key={idx} value={idx}>
                    Trocar PDF: {arq.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setModalPdfExpandidoAberto((p) => !p)}
              style={{
                width: 'auto',
                padding: '3px 9px',
                background: '#312e81',
                color: '#ffffff',
                border: '1px solid #6366f1',
                borderRadius: '5px',
                fontSize: '10.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {emModalExpandido
                ? '🗕 Fechar Tela Cheia'
                : '⛶ Expandir PDF c/ Busca'}
            </button>

            <a
              href={srcPdfComPagina}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#38bdf8',
                textDecoration: 'none',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              ↗️ Nova Guia
            </a>
          </div>
        </div>

        {/* BARRA DE BUSCA INTELIGENTE DENTRO DO PDF */}
        <div
          style={{
            padding: '8px 10px',
            background: '#1e1b4b',
            borderBottom: '1px solid #312e81',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: 1,
                minWidth: '180px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <input
                ref={emModalExpandido ? undefined : inputBuscaPdfRef}
                type="text"
                value={termoBuscaPdf}
                onChange={(e) => {
                  setTermoBuscaPdf(e.target.value);
                  setIndiceOcorrenciaAtiva(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    navegarParaOcorrencia(
                      e.shiftKey
                        ? indiceOcorrenciaAtiva - 1
                        : indiceOcorrenciaAtiva + 1
                    );
                  }
                }}
                placeholder="🔍 Buscar no PDF (ex: Interno, nº conta, valor, cláusula, CPF)..."
                style={{
                  width: '100%',
                  height: '30px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '0 28px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #6366f1',
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              />
              {termoBuscaPdf && (
                <button
                  type="button"
                  onClick={() => {
                    setTermoBuscaPdf('');
                    setIndiceOcorrenciaAtiva(0);
                  }}
                  style={{
                    position: 'absolute',
                    right: '4px',
                    width: 'auto',
                    padding: '2px 6px',
                    background: 'transparent',
                    color: '#64748b',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                  title="Limpar busca no PDF"
                >
                  ✖
                </button>
              )}
            </div>

            {arquivosContratos.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setEscopoBuscaPdf((prev) =>
                    prev === 'TODOS_KIT' ? 'ATUAL_APENAS' : 'TODOS_KIT'
                  );
                  setIndiceOcorrenciaAtiva(0);
                }}
                style={{
                  width: 'auto',
                  height: '30px',
                  padding: '0 9px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: '1px solid #4f46e5',
                  background:
                    escopoBuscaPdf === 'TODOS_KIT' ? '#4338ca' : '#1e293b',
                  color: '#ffffff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Alternar entre buscar em todos os PDFs carregados do Kit ou apenas no PDF aberto"
              >
                {escopoBuscaPdf === 'TODOS_KIT'
                  ? `📚 Em Todo o Kit (${arquivosContratos.length})`
                  : '📄 Só Neste PDF'}
              </button>
            )}

            {termoBuscaPdf.trim().length >= 2 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 900,
                    padding: '4px 8px',
                    borderRadius: '5px',
                    background:
                      ocorrenciasBuscaPdf.length > 0 ? '#16a34a' : '#dc2626',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ocorrenciasBuscaPdf.length > 0
                    ? `${indiceOcorrenciaAtiva + 1} de ${
                        ocorrenciasBuscaPdf.length
                      }`
                    : '0 achados'}
                </span>

                {ocorrenciasBuscaPdf.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        navegarParaOcorrencia(indiceOcorrenciaAtiva - 1)
                      }
                      style={{
                        width: 'auto',
                        height: '28px',
                        padding: '0 8px',
                        background: '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                      title="Ocorrência anterior"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navegarParaOcorrencia(indiceOcorrenciaAtiva + 1)
                      }
                      style={{
                        width: 'auto',
                        height: '28px',
                        padding: '0 8px',
                        background: '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                      title="Próxima ocorrência"
                    >
                      ▶
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* CHIPS INTELIGENTES DE ATALHO PARA ALERTAS E CAMPOS CHAVE */}
          {atalhosBuscaInteligentePdf.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                overflowX: 'auto',
                paddingBottom: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#a5b4fc',
                  whiteSpace: 'nowrap',
                }}
              >
                ⚡ Localizar Rápido:
              </span>
              {atalhosBuscaInteligentePdf.map((chip, idxC) => {
                const ativo =
                  termoBuscaPdf.trim().toUpperCase() ===
                  chip.termo.toUpperCase();
                const bgChip =
                  chip.cor === 'erro'
                    ? ativo
                      ? '#dc2626'
                      : '#7f1d1d'
                    : chip.cor === 'alerta'
                    ? ativo
                      ? '#d97706'
                      : '#78350f'
                    : ativo
                    ? '#2563eb'
                    : '#1e293b';

                return (
                  <button
                    key={idxC}
                    type="button"
                    onClick={() => acionarBuscaDiretaNoPdf(chip.termo)}
                    style={{
                      width: 'auto',
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      borderRadius: '12px',
                      border: ativo
                        ? '1.5px solid #fde047'
                        : '1px solid rgba(255,255,255,0.2)',
                      background: bgChip,
                      color: '#ffffff',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* CARTÃO DE CONTEXTO GRIFADO DA OCORRÊNCIA ATUAL (MOSTRA A PÁGINA EXATA E O TRECHO) */}
          {ocorrenciaAtualSelecionada && (
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '11px',
                lineHeight: 1.4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '3px',
                  fontSize: '10px',
                  color: '#fcd34d',
                  fontWeight: 800,
                }}
              >
                <span>
                  📍 Encontrado em: <b>{ocorrenciaAtualSelecionada.nomeArquivo}</b>{' '}
                  — <u>Página {ocorrenciaAtualSelecionada.pagina} de{' '}
                  {ocorrenciaAtualSelecionada.totalPaginas}</u>
                </span>
                <span>(PDF posicionado na Pág. {ocorrenciaAtualSelecionada.pagina})</span>
              </div>
              <div style={{ color: '#cbd5e1', wordBreak: 'break-word' }}>
                {ocorrenciaAtualSelecionada.trechoAntes}
                <mark
                  style={{
                    background: '#fde047',
                    color: '#0f172a',
                    fontWeight: 900,
                    padding: '0 3px',
                    borderRadius: '3px',
                  }}
                >
                  {ocorrenciaAtualSelecionada.termoEncontrado}
                </mark>
                {ocorrenciaAtualSelecionada.trechoDepois}
              </div>
            </div>
          )}
        </div>

        {/* VISUALIZADOR COM DESTAQUE DIRETO NO DOCUMENTO (ESTILO CTRL+F) OU IFRAME NATIVO */}
        {termoBuscaPdf.trim().length >= 2 && modoDestaqueVisualDoc ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#334155',
              overflow: 'hidden',
            }}
          >
            {/* Sub-barra de controle do Destaque Direto (Zoom e Paginação) */}
            <div
              style={{
                padding: '5px 12px',
                background: '#0f172a',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#fde047', fontWeight: 900 }}>
                  🎯 Grifo Direto no Documento ({retangulosGrifoPag.length}{' '}
                  marcação(ões) na Pág. {paginaPdfAlvo})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPaginaPdfAlvo((p) => Math.max(1, p - 1))
                  }
                  style={{
                    width: 'auto',
                    padding: '2px 7px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  ◀ Pág. Ant.
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaPdfAlvo((p) => p + 1)}
                  style={{
                    width: 'auto',
                    padding: '2px 7px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Próx. Pág. ▶
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() =>
                    setZoomPdfDestaque((z) => Math.max(0.75, +(z - 0.2).toFixed(2)))
                  }
                  style={{
                    width: 'auto',
                    padding: '2px 7px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  ➖
                </button>
                <span style={{ fontSize: '10.5px', fontWeight: 800 }}>
                  {Math.round(zoomPdfDestaque * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoomPdfDestaque((z) => Math.min(2.4, +(z + 0.2).toFixed(2)))
                  }
                  style={{
                    width: 'auto',
                    padding: '2px 7px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  ➕
                </button>

                <button
                  type="button"
                  onClick={() => setModoDestaqueVisualDoc(false)}
                  style={{
                    width: 'auto',
                    padding: '2px 8px',
                    background: '#475569',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                  title="Voltar para o leitor de PDF nativo do navegador"
                >
                  📄 Ver PDF Nativo
                </button>
              </div>
            </div>

            {/* Área de rolagem da folha do PDF com as caixas destacadas em cima do texto */}
            <div
              ref={
                emModalExpandido === modalPdfExpandidoAberto
                  ? containerScrollPdfBuscaRef
                  : undefined
              }
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '16px',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
                  background: '#ffffff',
                }}
              >
                <canvas
                  ref={
                    emModalExpandido === modalPdfExpandidoAberto
                      ? canvasPdfBuscaRef
                      : undefined
                  }
                  style={{ display: 'block' }}
                />

                {/* Caixas de destaque (estilo Ctrl+F) posicionadas cirurgicamente sobre o texto do PDF */}
                {retangulosGrifoPag.map((box, idxBox) => (
                  <div
                    key={idxBox}
                    ref={idxBox === 0 ? marcadorGrifoPrincipalRef : undefined}
                    style={{
                      position: 'absolute',
                      left: `${box.left}px`,
                      top: `${box.top}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                      background: 'rgba(250, 204, 21, 0.48)',
                      border: '2px solid #0284c7',
                      borderRadius: '3px',
                      boxShadow: '0 0 0 3px rgba(56, 189, 248, 0.35)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {termoBuscaPdf.trim().length >= 2 && !modoDestaqueVisualDoc && (
              <div
                style={{
                  padding: '4px 12px',
                  background: '#0f172a',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setModoDestaqueVisualDoc(true)}
                  style={{
                    width: 'auto',
                    padding: '3px 10px',
                    background: '#f59e0b',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  🎯 Ativar Grifo Direto no Documento
                </button>
              </div>
            )}
            <iframe
              key={`${urlPdfAtivo}_p${paginaPdfAlvo}`}
              src={`${srcPdfComPagina}&search=${encodeURIComponent(
                termoBuscaPdf.trim()
              )}`}
              title={arquivoAtivo.name}
              style={{
                flex: 1,
                width: '100%',
                border: 'none',
                background: '#334155',
              }}
            />
          </div>
        )}
      </section>
    );
  };

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f1f5f9',
        zIndex: 965000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* CABEÇALHO DE TELA CHEIA */}
      <header
        style={{
          background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          padding: '12px 24px',
          borderBottom: '3px solid #f59e0b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              width: 'auto',
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.14)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ⬅️ Voltar ao Painel
          </button>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '0.3px',
              }}
            >
              📝 VERIFICADOR DE CONFORMIDADE DE CONTRATOS E CÉDULAS (PRÉ-CONTRATAÇÃO)
            </h2>
            <span style={{ fontSize: '11.5px', color: '#e0e7ff' }}>
              Suporta <b>Contratos de Limite (LCGA/LCGH)</b>,{' '}
              <b>Operações Derivadas (Kit 5 Docs)</b> e{' '}
              <b>Renovações de Custeio — Planta Nordeste</b>.
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255,255,255,0.12)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <button
              type="button"
              onClick={() => setModoEscopo('LIMITE_LCG')}
              style={{
                width: 'auto',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background:
                  modoEscopo === 'LIMITE_LCG' ? '#f59e0b' : 'transparent',
                color: '#ffffff',
              }}
            >
              🏛️ 1. Limite (LCGA / LCGH)
            </button>
            <button
              type="button"
              onClick={() => setModoEscopo('DERIVADAS')}
              style={{
                width: 'auto',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background:
                  modoEscopo === 'DERIVADAS' ? '#f59e0b' : 'transparent',
                color: '#ffffff',
              }}
            >
              🚜 2. Derivadas / Renovação Custeio
            </button>
          </div>

          <input
            ref={inputArquivosRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const lista = Array.from(e.target.files || []);
              if (lista.length > 0) {
                processarArquivosSelecionados(lista, false);
              }
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => inputArquivosRef.current?.click()}
            style={{
              width: 'auto',
              padding: '9px 15px',
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            }}
          >
            📄 Selecionar PDF(s)
          </button>

          <button
            type="button"
            onClick={selecionarPastaComContratos}
            style={{
              width: 'auto',
              padding: '9px 14px',
              background: '#d97706',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Busca automaticamente todos os PDFs de CCB, Aditivo, Protocolo, Pedido, Orçamento, Disposições, CET ou LCGA/LCGH na pasta"
          >
            📂 Buscar na Pasta
          </button>

          <button
            type="button"
            onClick={abrirModalCopilotInteligente}
            style={{
              width: 'auto',
              padding: '9px 15px',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: '1px solid #7dd3fc',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)',
            }}
          >
            🤖 Script Copilot
          </button>

          {auditando && (
            <button
              type="button"
              onClick={() =>
                cancelarLeituraOcrImediatamente('USAR_TEXTO_PARCIAL')
              }
              style={{
                width: 'auto',
                padding: '9px 15px',
                background: '#dc2626',
                color: '#ffffff',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.45)',
              }}
            >
              🛑 Cancelar OCR
            </button>
          )}

          {resultadoAtivo && !auditando && (
            <>
              <button
                type="button"
                onClick={reexecutarComOcrNoContratoAtivo}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  background: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🧠 Ler via OCR
              </button>

              <button
                type="button"
                onClick={() => setMostrarPdfLadoALado((p) => !p)}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  background: mostrarPdfLadoALado ? '#0284c7' : '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {mostrarPdfLadoALado ? '🗕 Ocultar PDF' : '🔎 Mostrar PDF'}
              </button>

              <button
                type="button"
                onClick={limparConsultaConformidade}
                style={{
                  width: 'auto',
                  padding: '8px 13px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                }}
                title="Limpar todos os documentos e campos da auditoria atual para iniciar uma nova conferência"
              >
                🧹 Limpar Consulta
              </button>
            </>
          )}
        </div>
      </header>

      {/* BARRA DE NAVEGAÇÃO ENTRE A SINTONIA GLOBAL DO KIT E CADA UM DOS DOCUMENTOS */}
      {resultados.length > 0 && (
        <div
          style={{
            padding: '8px 24px',
            background: '#e2e8f0',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          {dossieKitDerivada?.ehKitDerivada && (
            <button
              type="button"
              onClick={() => setIndiceAtivo(-1)}
              style={{
                width: 'auto',
                padding: '6px 14px',
                fontSize: '11.5px',
                fontWeight: 900,
                borderRadius: '6px',
                cursor: 'pointer',
                border:
                  indiceAtivo === -1
                    ? '2px solid #15803d'
                    : '1px solid #86efac',
                background: indiceAtivo === -1 ? '#15803d' : '#f0fdf4',
                color: indiceAtivo === -1 ? '#ffffff' : '#15803d',
                whiteSpace: 'nowrap',
              }}
            >
              🌟 Visão Global de Sintonia do Kit ({resultados.length} Arq.)
            </button>
          )}

          <strong
            style={{
              fontSize: '11px',
              color: '#475569',
              whiteSpace: 'nowrap',
            }}
          >
            📄 Inspecionar PDF:
          </strong>

          {resultados.map((r, idx) => {
            const selecionado =
              indiceAtivo === idx ||
              (indiceAtivo === -1 && indicePdfVisualizando === idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIndicePdfVisualizando(idx);
                  setPaginaPdfAlvo(1);
                  if (!dossieKitDerivada?.ehKitDerivada) {
                    setIndiceAtivo(idx);
                  }
                }}
                onDoubleClick={() => setIndiceAtivo(idx)}
                title="Clique para exibir este PDF no leitor ao lado (Duplo clique para ver somente o checklist individual deste arquivo)"
                style={{
                  width: 'auto',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: selecionado
                    ? '2px solid #312e81'
                    : '1px solid #cbd5e1',
                  background: selecionado ? '#312e81' : '#ffffff',
                  color: selecionado ? '#ffffff' : '#1e293b',
                }}
              >
                🔎 {r.tipoInstrumento.replace(/_/g, ' ')} ({r.nomeArquivo})
              </button>
            );
          })}
        </div>
      )}

      {/* CORPO PRINCIPAL */}
      {auditando ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '44px' }}>🔍</div>
          <h3
            style={{
              margin: 0,
              color: '#1e1b4b',
              textAlign: 'center',
              maxWidth: '620px',
            }}
          >
            {progressoMsg || 'Auditando cláusulas e sintonia dos documentos...'}
          </h3>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: '6px',
            }}
          >
            <button
              type="button"
              onClick={() =>
                cancelarLeituraOcrImediatamente('USAR_TEXTO_PARCIAL')
              }
              style={{
                width: 'auto',
                padding: '10px 18px',
                background: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
              }}
            >
              ⚡ Pular OCR e Abrir Documento Agora (Usar Leitura Rápida / Copilot)
            </button>

            <button
              type="button"
              onClick={() => cancelarLeituraOcrImediatamente('ABORTAR_TUDO')}
              style={{
                width: 'auto',
                padding: '10px 18px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
              }}
            >
              🛑 Cancelar Leitura Totalmente
            </button>
          </div>
        </div>
      ) : !resultadoAtivo ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>
            Pronto para Auditar Contratos de Limite (LCGA/LCGH), Derivadas ou
            Renovação de Custeio
          </h3>
          <p
            style={{
              maxWidth: '640px',
              fontSize: '13px',
              lineHeight: 1.5,
              marginTop: '8px',
            }}
          >
            Selecione <b>1 PDF de Limite (LCGA/LCGH)</b>, selecione os{' '}
            <b>PDFs da Operação Derivada / Renovação de Custeio</b> ou clique em{' '}
            <b>&ldquo;🤖 Script Copilot&rdquo;</b> para gerar o prompt de
            auditoria!
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: mostrarPdfLadoALado
              ? '380px 1fr 1.12fr'
              : '410px 1fr',
            gap: '14px',
            padding: '14px 20px',
            overflow: 'hidden',
          }}
        >
          {/* COLUNA 1: SEMÁFORO + RAIO-X COMPLETO + MAPA DE ASSINATURAS */}
          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {/* CARD SEMÁFORO */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '14px 16px',
                border: '1px solid #cbd5e1',
                borderTop: `6px solid ${
                  resumoSemaforo.status === 'APROVADO'
                    ? '#16a34a'
                    : resumoSemaforo.status === 'ALERTA'
                    ? '#f59e0b'
                    : '#dc2626'
                }`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  {dossieKitDerivada?.ehKitDerivada
                    ? 'Sintonia Global do Kit'
                    : 'Veredito da Conformidade'}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 900,
                    background: '#eef2ff',
                    color: '#312e81',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}
                >
                  {resultados.length} arq.
                </span>
              </div>

              <div
                style={{
                  marginTop: '6px',
                  fontSize: '14.5px',
                  fontWeight: 900,
                  color:
                    resumoSemaforo.status === 'APROVADO'
                      ? '#15803d'
                      : resumoSemaforo.status === 'ALERTA'
                      ? '#b45309'
                      : '#b91c1c',
                }}
              >
                {resumoSemaforo.status === 'APROVADO'
                  ? '✅ DOCUMENTAÇÃO 100% CONFORME'
                  : resumoSemaforo.status === 'ALERTA'
                  ? '⚠️ CONFORME COM ATENÇÃO'
                  : '🚨 DIVERGÊNCIA / ERRO DETECTADO'}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={copiarResumoConformidadeContrato}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: '#312e81',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  📋 Copiar Espelho
                </button>

                <button
                  type="button"
                  onClick={abrirModalCopilotInteligente}
                  style={{
                    width: 'auto',
                    padding: '8px 10px',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                  title="Abrir Script do Copilot para este documento"
                >
                  🤖 Copilot
                </button>
              </div>
            </div>

            {/* RAIO-X COMPLETO EXTRAÍDO DA CÉDULA / CONTRATO */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '12px 14px',
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                fontSize: '11px',
              }}
            >
              <strong
                style={{
                  fontSize: '12px',
                  color: '#312e81',
                  borderBottom: '1px dashed #cbd5e1',
                  paddingBottom: '5px',
                  marginBottom: '2px',
                }}
              >
                📋 RAIO-X INTEGRAL DA CÉDULA / CONTRATO
              </strong>

              {[
                {
                  id: 'tipo',
                  label: '🏛️ Instrumento',
                  valor: dossieKitDerivada?.ehKitDerivada
                    ? 'KIT DE OPERAÇÃO DERIVADA / RENOVAÇÃO'
                    : resultadoAtivo.tipoInstrumento,
                },
                {
                  id: 'especie',
                  label: '📜 Espécie / Segmentação',
                  valor:
                    resultadoAtivo.especieInstrumentoVinculado ||
                    resultadoAtivo.tipoInstrumento,
                },
                {
                  id: 'porte',
                  label: '🏷️ Porte / Subproduto',
                  valor: resultadoAtivo.porteIdentificado,
                },
                {
                  id: 'prog',
                  label: '🚜 Programa / Fonte',
                  valor: resultadoAtivo.programaCredito,
                },
                {
                  id: 'num',
                  label: '🔢 Nº CCB / Contrato',
                  valor: resultadoAtivo.numeroContratoCedula,
                  busca: resultadoAtivo.numeroContratoCedula,
                },
                {
                  id: 'local_ass',
                  label: '📍 Local de Assinatura',
                  valor: resultadoAtivo.localAssinaturaConformeSantaInes
                    ? `✅ ${
                        resultadoAtivo.localAssinaturaFecho || 'SANTA INES - MA'
                      }`
                    : `🚨 ${
                        resultadoAtivo.localAssinaturaFecho ||
                        'DIVERGENTE DE SANTA INES - MA'
                      }`,
                  busca: 'SANTA IN',
                },
                {
                  id: 'rodape_int',
                  label: '🛡️ Rodapé "Doc. Interno"',
                  valor: resultadoAtivo.possuiRodapeDocumentoInterno
                    ? `🚨 DETECTADO (${resultadoAtivo.trechoRodapeInternoDetectado}) — REMOVER!`
                    : '✅ Limpo (Sem rodapé interno)',
                  busca: resultadoAtivo.possuiRodapeDocumentoInterno
                    ? 'Interno'
                    : '',
                },
                {
                  id: 'val',
                  label: '💰 Valor Contratado',
                  valor: resultadoAtivo.valorClausulaPrimeira
                    ? `R$ ${resultadoAtivo.valorClausulaPrimeira}`
                    : '',
                  copy: resultadoAtivo.valorClausulaPrimeira,
                  busca: resultadoAtivo.valorClausulaPrimeira,
                },
                ...(resultadoAtivo.valorJurosTotaisCet
                  ? [
                      {
                        id: 'juros_tot',
                        label: '📈 Juros Totais / A Pagar',
                        valor: `Juros R$ ${resultadoAtivo.valorJurosTotaisCet} (Total: R$ ${resultadoAtivo.valorTotalAPagarCet})`,
                        busca: resultadoAtivo.valorJurosTotaisCet,
                      },
                    ]
                  : []),
                {
                  id: 'taxas',
                  label: '📊 Juros / CET / Bônus',
                  valor: `${resultadoAtivo.taxaJurosAnual} (${resultadoAtivo.taxaJurosMensal}) • CET: ${resultadoAtivo.cetAnual}${
                    resultadoAtivo.bonusAdimplenciaPerc
                      ? ` • ${resultadoAtivo.bonusAdimplenciaPerc}`
                      : ''
                  }`,
                },
                {
                  id: 'dt_contr',
                  label: '📅 Data Contratação/Renov.',
                  valor:
                    resultadoAtivo.dataCelebracaoCabecalho ||
                    resultadoAtivo.dataCelebracaoFechoAssinatura,
                  busca:
                    resultadoAtivo.dataCelebracaoCabecalho ||
                    resultadoAtivo.dataCelebracaoFechoAssinatura,
                },
                ...(resultadoAtivo.dataPrimeiraParcelaPrincipal
                  ? [
                      {
                        id: 'dt_1parc',
                        label: '🗓️ 1ª Parcela Principal',
                        valor: `${resultadoAtivo.dataPrimeiraParcelaPrincipal}${
                          resultadoAtivo.carenciaAnosCalculada
                            ? ` (Carência: ${resultadoAtivo.carenciaAnosCalculada})`
                            : ''
                        }`,
                        copy: resultadoAtivo.dataPrimeiraParcelaPrincipal,
                        busca: resultadoAtivo.dataPrimeiraParcelaPrincipal,
                      },
                    ]
                  : []),
                {
                  id: 'dt_venc',
                  label: '⏳ Vencimento Final',
                  valor: `${resultadoAtivo.dataVencimento} (${resultadoAtivo.prazoAnosCalculado} / ${resultadoAtivo.prazoMesesCalculado}m)`,
                  copy: resultadoAtivo.dataVencimento,
                  busca: resultadoAtivo.dataVencimento,
                },
                {
                  id: 'cred',
                  label: '👤 Emitente / Creditado',
                  valor: resultadoAtivo.creditadoNome,
                  busca: resultadoAtivo.creditadoNome,
                },
                {
                  id: 'cpf_cred',
                  label: '🪪 CPF Emitente',
                  valor: resultadoAtivo.creditadoCpf,
                  busca: resultadoAtivo.creditadoCpf,
                },
                {
                  id: 'rg_cred',
                  label: '🪪 RG / Emissão',
                  valor: `${resultadoAtivo.creditadoRg} (${resultadoAtivo.creditadoRgDataEmissao})`,
                  busca: resultadoAtivo.creditadoRg,
                },
                {
                  id: 'est_civ',
                  label: '💍 Estado Civil / Regime',
                  valor: resultadoAtivo.creditadoEstadoCivilRegime,
                },
                {
                  id: 'end_cred',
                  label: '📍 Endereço Titular',
                  valor: resultadoAtivo.creditadoEndereco,
                },
                ...(resultadoAtivo.contaCorrenteDebito
                  ? [
                      {
                        id: 'cc_deb',
                        label: '🏦 C/C Livre Mov. / Débito',
                        valor: `${resultadoAtivo.contaCorrenteDebito} (Ag. Santa Inês)`,
                        copy: resultadoAtivo.contaCorrenteDebito,
                        busca: resultadoAtivo.contaCorrenteDebito,
                      },
                    ]
                  : []),
                ...(resultadoAtivo.possuiVinculoLimiteLcg
                  ? [
                      {
                        id: 'lcg_vinc',
                        label: `🏛️ Limite ${resultadoAtivo.tipoLimiteVinculado} Madre`,
                        valor: `Nº ${resultadoAtivo.numeroContratoLimiteVinculado} (${resultadoAtivo.dataEmissaoLimiteVinculado})`,
                        copy: resultadoAtivo.numeroContratoLimiteVinculado,
                        busca: resultadoAtivo.numeroContratoLimiteVinculado,
                      },
                      {
                        id: 'lcg_uso',
                        label: '📐 Uso / Suficiência LCG',
                        valor: `${resultadoAtivo.percentualUtilizacaoLimiteLcg} (Exige R$ ${resultadoAtivo.valorExigidoNoLimiteLcg} do limite)`,
                        busca: '125%',
                      },
                    ]
                  : []),
                ...(resultadoAtivo.possuiFundoLiquidezContaReserva
                  ? [
                      {
                        id: 'conta_res',
                        label: '🔒 Conta-Reserva (F. Liq.)',
                        valor: `Nº ${resultadoAtivo.contaReservaNumero} • ${resultadoAtivo.fundoLiquidezPercentual} = R$ ${resultadoAtivo.fundoLiquidezValorReferencia}`,
                        copy: resultadoAtivo.contaReservaNumero,
                        busca: resultadoAtivo.contaReservaNumero,
                      },
                    ]
                  : []),
                {
                  id: 'sms',
                  label: '📱 Celular SMS',
                  valor: resultadoAtivo.telefoneSmsClausula,
                },
                ...(resultadoAtivo.imovelBeneficiadoNome
                  ? [
                      {
                        id: 'im_benef',
                        label: '🏡 Imóvel Beneficiado',
                        valor: `${resultadoAtivo.imovelBeneficiadoNome}${
                          resultadoAtivo.imovelBeneficiadoMatriculaCartorio
                            ? ` • ${resultadoAtivo.imovelBeneficiadoMatriculaCartorio}`
                            : ''
                        } (${resultadoAtivo.imovelBeneficiadoProprietario}) — ${
                          resultadoAtivo.imovelBeneficiadoMunicipioUf
                        }`,
                        busca: resultadoAtivo.imovelBeneficiadoNome,
                      },
                    ]
                  : []),
                ...(resultadoAtivo.possuiAvalista
                  ? [
                      {
                        id: 'aval_nome',
                        label: '🛡️ Avalista (Garantia)',
                        valor: resultadoAtivo.avalistaNome,
                        busca: resultadoAtivo.avalistaNome,
                      },
                      {
                        id: 'aval_cpf',
                        label: '🪪 CPF / RG Avalista',
                        valor: `${resultadoAtivo.avalistaCpf} • RG: ${resultadoAtivo.avalistaRg} (${resultadoAtivo.avalistaRgDataEmissao})`,
                        copy: resultadoAtivo.avalistaCpf,
                        busca: resultadoAtivo.avalistaCpf,
                      },
                      {
                        id: 'aval_est_civ',
                        label: '💍 Est. Civil Avalista',
                        valor: resultadoAtivo.avalistaEstadoCivilRegime,
                      },
                    ]
                  : []),
                ...(resultadoAtivo.anuenciaIncraSipraCodigo
                  ? [
                      {
                        id: 'sipra',
                        label: '📜 Código SIPRA / INCRA',
                        valor: `${resultadoAtivo.anuenciaIncraSipraCodigo} (Lote ${resultadoAtivo.anuenciaIncraLote} • Ativo desde ${resultadoAtivo.anuenciaIncraAtivoDesde})`,
                        copy: resultadoAtivo.anuenciaIncraSipraCodigo,
                        busca: resultadoAtivo.anuenciaIncraSipraCodigo,
                      },
                    ]
                  : []),
                ...(resultadoAtivo.conjugeNome
                  ? [
                      {
                        id: 'conj',
                        label: '👥 Cônjuge / Companheiro(a)',
                        valor: resultadoAtivo.conjugeNome,
                        busca: resultadoAtivo.conjugeNome,
                      },
                      {
                        id: 'cpf_conj',
                        label: '🪪 CPF Cônjuge',
                        valor: resultadoAtivo.conjugeCpf,
                        busca: resultadoAtivo.conjugeCpf,
                      },
                    ]
                  : []),
                ...(resultadoAtivo.imoveisGarantia[0]
                  ? [
                      {
                        id: 'imovel',
                        label: '🏡 Imóvel da Garantia',
                        valor: `${resultadoAtivo.imoveisGarantia[0].denominacao} (${resultadoAtivo.imoveisGarantia[0].areaHa})`,
                        busca: resultadoAtivo.imoveisGarantia[0].denominacao,
                      },
                      {
                        id: 'mat',
                        label: '📜 Matrícula / Registro',
                        valor: `Nº ${resultadoAtivo.imoveisGarantia[0].registroMatricula} (${resultadoAtivo.imoveisGarantia[0].livro})`,
                        copy: resultadoAtivo.imoveisGarantia[0].registroMatricula,
                        busca: resultadoAtivo.imoveisGarantia[0].registroMatricula,
                      },
                      {
                        id: 'onus',
                        label: '🛡️ Ônus / Hipoteca',
                        valor:
                          resultadoAtivo.imoveisGarantia[0]
                            .situacaoOnusHipoteca,
                      },
                    ]
                  : []),
              ].map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    background: row.valor ? '#f8fafc' : '#fffbeb',
                    borderRadius: '5px',
                    border: row.valor
                      ? '1px solid #e2e8f0'
                      : '1px dashed #fcd34d',
                  }}
                >
                  <div style={{ wordBreak: 'break-word' }}>
                    <strong style={{ color: '#334155' }}>{row.label}:</strong>{' '}
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>
                      {row.valor || 'Não identificado'}
                    </span>
                  </div>
                  {row.valor && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '3px',
                        flexShrink: 0,
                      }}
                    >
                      {(row as any).busca && (
                        <button
                          type="button"
                          onClick={() =>
                            acionarBuscaDiretaNoPdf((row as any).busca)
                          }
                          style={{
                            width: 'auto',
                            padding: '1px 5px',
                            fontSize: '10px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Localizar este dado diretamente na página do PDF"
                        >
                          🔎
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          copiarTexto(row.id, (row as any).copy || row.valor)
                        }
                        style={{
                          width: 'auto',
                          padding: '1px 5px',
                          fontSize: '10px',
                          background:
                            chaveCopiada === row.id ? '#dcfce7' : '#ffffff',
                          color:
                            chaveCopiada === row.id ? '#15803d' : '#64748b',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                        title="Copiar valor"
                      >
                        {chaveCopiada === row.id ? '✔' : '📋'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* QUADRO DE ASSINATURAS EXIGIDAS */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '12px 14px',
                border: '1px solid #cbd5e1',
                borderLeft: '5px solid #312e81',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '11px',
              }}
            >
              <strong style={{ fontSize: '12px', color: '#312e81' }}>
                ✍️ MAPA DE ASSINATURAS EXIGIDAS NO FECHO
              </strong>

              {resultadoAtivo.signatariosPartes.map((sig, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f8fafc',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    • {sig.papelNoContrato}: {sig.nomeTitularDoPapel}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569' }}>
                    {sig.representadoPorProcurador ? (
                      <span style={{ color: '#b45309', fontWeight: 800 }}>
                        👉 Assina: {sig.nomeProcuradorQueAssina} (Procurador •
                        CPF: {sig.cpfProcuradorQueAssina})
                      </span>
                    ) : (
                      <span>
                        👉 Assina o próprio ({sig.nomeTitularDoPapel} • CPF:{' '}
                        {sig.cpfTitularDoPapel})
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {resultadoAtivo.gerentesBanco.length > 0 && (
                <div
                  style={{
                    background: '#eff6ff',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <strong style={{ color: '#1e40af', display: 'block' }}>
                    🏦 Representantes do BNB (
                    {resultadoAtivo.gerentesBanco.length}):
                  </strong>
                  {resultadoAtivo.gerentesBanco.map((g, idx) => (
                    <div key={idx} style={{ fontSize: '10.5px' }}>
                      • <b>{g.nome}</b> ({g.cargo})
                    </div>
                  ))}
                </div>
              )}

              {resultadoAtivo.testemunhas.length > 0 && (
                <div
                  style={{
                    background: '#f0fdf4',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <strong style={{ color: '#166534', display: 'block' }}>
                    👥 Testemunhas Qualificadas (
                    {resultadoAtivo.testemunhas.length}):
                  </strong>
                  {resultadoAtivo.testemunhas.map((t, idx) => (
                    <div key={idx} style={{ fontSize: '10.5px' }}>
                      • <b>{t.nome}</b> (CPF: {t.cpf})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* COLUNA 2: CHECKLIST DETALHADO DE AUDITORIA E SINTONIA (COM BOTÃO DE LOCALIZAR NO PDF!) */}
          <main
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 900,
                fontSize: '12.5px',
                color: '#1e1b4b',
              }}
            >
              🔍 {resultadoAtivo.tituloInstrumento}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {resultadoAtivo.itensChecklist.map((item) => {
                const corBorda =
                  item.status === 'ERRO'
                    ? '#dc2626'
                    : item.status === 'ALERTA'
                    ? '#f59e0b'
                    : '#16a34a';
                const corBg =
                  item.status === 'ERRO'
                    ? '#fef2f2'
                    : item.status === 'ALERTA'
                    ? '#fffbeb'
                    : '#f0fdf4';

                const termosDoCardParaBusca =
                  extrairTermosDeBuscaDoItemChecklist(item);

                return (
                  <div
                    key={item.id}
                    style={{
                      background: corBg,
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
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginBottom: '4px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 900,
                          color: '#0f172a',
                        }}
                      >
                        {item.titulo}
                      </div>

                      {/* BOTÕES DE LOCALIZAÇÃO DIRETA NO PDF PARA ESTE ALERTA/ITEM */}
                      {termosDoCardParaBusca.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {termosDoCardParaBusca.map((tBusca, idxB) => (
                            <button
                              key={idxB}
                              type="button"
                              onClick={() => acionarBuscaDiretaNoPdf(tBusca)}
                              style={{
                                width: 'auto',
                                padding: '2px 8px',
                                fontSize: '10px',
                                fontWeight: 800,
                                borderRadius: '6px',
                                border: '1px solid #93c5fd',
                                background: '#eff6ff',
                                color: '#1e40af',
                                cursor: 'pointer',
                              }}
                              title={`Procurar "${tBusca}" dentro dos PDFs carregados e ir direto para a página`}
                            >
                              🔎 Localizar &ldquo;{tBusca}&rdquo; no PDF
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1e293b',
                      }}
                    >
                      {item.resumo}
                    </div>
                    {item.detalhes && item.detalhes.length > 0 && (
                      <div
                        style={{
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px dashed rgba(0,0,0,0.12)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          fontSize: '11px',
                          color: '#334155',
                        }}
                      >
                        {item.detalhes.map((d, i) => (
                          <div key={i}>{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>

          {/* COLUNA 3: VISUALIZADOR DO PDF LADO A LADO COM BUSCA INTELIGENTE */}
          {mostrarPdfLadoALado &&
            urlPdfAtivo &&
            arquivoAtivo &&
            renderPainelVisualizadorPdfComBusca(false)}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL DE PDF EXPANDIDO EM TELA CHEIA COM BUSCA INTELIGENTE          */}
      {/* =================================================================== */}
      {modalPdfExpandidoAberto && urlPdfAtivo && arquivoAtivo && (
        <div
          onClick={() => setModalPdfExpandidoAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            zIndex: 999990,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '96vw',
              height: '94vh',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
              border: '2px solid #4f46e5',
            }}
          >
            {renderPainelVisualizadorPdfComBusca(true)}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL SÊNIOR: GERADOR E IMPORTADOR DE SCRIPT DO COPILOT P/ CONTRATO */}
      {/* =================================================================== */}
      {modalCopilotAberto && (
        <div
          onClick={() => setModalCopilotAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.76)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              width: '94vw',
              maxWidth: '860px',
              maxHeight: '92vh',
              borderRadius: '12px',
              borderTop: '5px solid #0284c7',
              boxShadow: '0 25px 55px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                background: 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 900 }}>
                  🤖 SCRIPT INTELIGENTE DO COPILOT — AUDITORIA DE CONTRATOS E ANEXOS
                </h3>
                <span style={{ fontSize: '11px', color: '#bae6fd' }}>
                  Marque abaixo o tipo de documento contratual para gerar o
                  script exato e cole a resposta do Copilot para atualizar a
                  conformidade!
                </span>
              </div>

              <button
                type="button"
                onClick={() => setModalCopilotAberto(false)}
                style={{
                  width: 'auto',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ✖ Fechar
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <strong
                  style={{
                    fontSize: '11.5px',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  1. Marque qual documento (ou pacote) você vai enviar ao
                  Copilot:
                </strong>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  {(
                    [
                      {
                        id: 'AUTO_ATUAL',
                        label: '🎯 Automático (Conforme PDF Aberto)',
                      },
                      {
                        id: 'LCGA_LCGH',
                        label: '🏛️ Contrato de Limite (LCGA / LCGH)',
                      },
                      {
                        id: 'KIT_COMPLETO_5_DOCS',
                        label:
                          '🌟 Kit Completo Derivada / Renovação Custeio',
                      },
                      {
                        id: 'CCB_DERIVADA',
                        label: '📄 Somente CCB / Aditivo',
                      },
                      {
                        id: 'ANEXO_ORCAMENTO',
                        label: '📦 Somente Anexo-Orçamento',
                      },
                      {
                        id: 'PLANILHA_CET',
                        label: '📊 Somente Planilha CET (CETCR)',
                      },
                      {
                        id: 'ANEXO_FLUXO_CET',
                        label: '📈 Somente Anexo CET (Fluxo Financeiro)',
                      },
                      {
                        id: 'DISPOSICOES_GERAIS',
                        label: '📜 Somente Disposições Gerais',
                      },
                    ] as Array<{ id: ModoScriptCopilotContrato; label: string }>
                  ).map((op) => {
                    const ativo = modoScriptCopilot === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setModoScriptCopilot(op.id)}
                        style={{
                          width: 'auto',
                          padding: '6px 11px',
                          fontSize: '11px',
                          fontWeight: 800,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          border: ativo
                            ? '2px solid #0284c7'
                            : '1px solid #cbd5e1',
                          background: ativo ? '#e0f2fe' : '#ffffff',
                          color: ativo ? '#0369a1' : '#334155',
                        }}
                      >
                        {op.label}
                      </button>
                    );
                  })}
                </div>

                {resultados.length > 1 && (
                  <div style={{ marginTop: '10px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#475569',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Arquivo carregado de referência:
                    </label>
                    <select
                      value={indiceDocAlvoCopilot}
                      onChange={(e) =>
                        setIndiceDocAlvoCopilot(Number(e.target.value))
                      }
                      style={{
                        height: '32px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                      }}
                    >
                      {resultados.map((r, i) => (
                        <option key={i} value={i}>
                          {r.nomeArquivo} ({r.tipoInstrumento})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <strong style={{ fontSize: '12px', color: '#0369a1' }}>
                    2. Script Pronto para Enviar ao Copilot (Anexe o PDF no
                    Copilot e cole este comando):
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(scriptCopilotEditavel);
                      setCopiadoScriptOk(true);
                      setTimeout(() => setCopiadoScriptOk(false), 2500);
                    }}
                    style={{
                      width: 'auto',
                      padding: '6px 14px',
                      background: copiadoScriptOk ? '#16a34a' : '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    {copiadoScriptOk
                      ? '✅ Script Copiado!'
                      : '📋 Copiar Script p/ Copilot'}
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={scriptCopilotEditavel}
                  onChange={(e) => setScriptCopilotEditavel(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '11.5px',
                    fontFamily: 'monospace',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <strong
                  style={{
                    fontSize: '12px',
                    color: '#166534',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  3. Cole aqui a Resposta do Copilot para Preencher o Raio-X e
                  Revalidar a Conformidade Automaticamente:
                </strong>
                <textarea
                  rows={6}
                  value={respostaColadaCopilot}
                  onChange={(e) => setRespostaColadaCopilot(e.target.value)}
                  placeholder="Cole aqui a resposta completa do Copilot (contendo o bloco [DADOS_CONTRATO_SISTEMA])..."
                  style={{
                    width: '100%',
                    fontSize: '11.5px',
                    fontFamily: 'monospace',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                    background: '#ffffff',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={importarDadosDaRespostaDoCopilot}
                    style={{
                      width: 'auto',
                      padding: '9px 20px',
                      background: '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(21, 128, 61, 0.28)',
                    }}
                  >
                    ⚡ Importar Resposta do Copilot & Atualizar Conformidade
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}