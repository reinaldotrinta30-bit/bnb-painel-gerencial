'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
} from '@/types/painel';
import { formatarMoedaBD } from '@/lib/utils';
import { removerAcentos } from '@/lib/auditorInteligentePdfPasta';
import {
  auditarDocumentoIndividualDesembolso,
  auditarPacoteDesembolsoCompleto,
  criarControleCancelamentoOcrDesembolso,
  ControleCancelamentoOcrDesembolso,
  DocumentoDesembolsoAuditado,
  ResultadoAuditoriaPacoteDesembolso,
  ItemChecklistAuditoriaDesembolso,
  TipoDocumentoDesembolso,
} from '@/lib/auditorDesembolso';

interface TelaAnaliseDesembolsoProps {
  aberto: boolean;
  onFechar: () => void;
  contratacoes: RegistroContratacao[];
  operacoesBase: OperacaoBaseDesembolso[];
}

interface OcorrenciaBuscaPdfDesemb {
  indiceArquivo: number;
  nomeArquivo: string;
  pagina: number;
  totalPaginas: number;
  trechoAntes: string;
  termoEncontrado: string;
  trechoDepois: string;
}

const MESES_SELECT = [
  { val: '01', label: 'Jan' },
  { val: '02', label: 'Fev' },
  { val: '03', label: 'Mar' },
  { val: '04', label: 'Abr' },
  { val: '05', label: 'Mai' },
  { val: '06', label: 'Jun' },
  { val: '07', label: 'Jul' },
  { val: '08', label: 'Ago' },
  { val: '09', label: 'Set' },
  { val: '10', label: 'Out' },
  { val: '11', label: 'Nov' },
  { val: '12', label: 'Dez' },
];

const BADGE_TIPO_CURTO: Record<
  TipoDocumentoDesembolso,
  { sigla: string; bg: string; cor: string }
> = {
  ANEXO_ORCAMENTO: { sigla: 'ORÇ', bg: '#fef3c7', cor: '#92400e' },
  COMPROVACAO_FINANCEIRA: { sigla: 'COMP', bg: '#dbeafe', cor: '#1e40af' },
  LAUDO_ACOMPANHAMENTO: { sigla: 'LAUDO', bg: '#e0e7ff', cor: '#3730a3' },
  GTA: { sigla: 'GTA', bg: '#dcfce7', cor: '#166534' },
  NOTA_FISCAL: { sigla: 'NF-e', bg: '#f3e8ff', cor: '#6b21a8' },
  NOTA_FISCAL_E_RECIBO: { sigla: 'NF+REC', bg: '#fae8ff', cor: '#86198f' },
  RECIBO_PAGAMENTO: { sigla: 'REC', bg: '#ccfbf1', cor: '#115e59' },
  DECLARACAO_RECEBIMENTO: { sigla: 'DECL', bg: '#ffedd5', cor: '#9a3412' },
  DECLARACAO_APLICACAO_CUSTEIO: { sigla: 'DECL', bg: '#ffedd5', cor: '#9a3412' },
  COMPROVANTE_PAGAMENTO: { sigla: 'PGTO', bg: '#ecfccb', cor: '#3f6212' },
  VITI: { sigla: 'VITI', bg: '#e2e8f0', cor: '#334155' },
  OUTRO_DESEMBOLSO: { sigla: 'DOC', bg: '#f1f5f9', cor: '#475569' },
};

function obterMesAtualIso(): string {
  const hoje = new Date();
  const aaaa = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${aaaa}-${mm}`;
}

export default function TelaAnaliseDesembolso({
  aberto,
  onFechar,
  contratacoes,
  operacoesBase,
}: TelaAnaliseDesembolsoProps) {
  const [modalidade, setModalidade] = useState<
    'PRONAF_A' | 'DERIVADA_GERAL' | 'RENOVACAO_CUSTEIO'
  >('PRONAF_A');
  const [mesReferencia, setMesReferencia] = useState<string>(obterMesAtualIso);

  const [arquivos, setArquivos] = useState<File[]>([]);
  const [documentosAuditados, setDocumentosAuditados] = useState<
    DocumentoDesembolsoAuditado[]
  >([]);
  const [auditando, setAuditando] = useState(false);
  const [progressoMsg, setProgressoMsg] = useState('');

  // Filtros rápidos do checklist
  const [filtroStatusChecklist, setFiltroStatusChecklist] = useState<
    'TODOS' | 'ERRO' | 'ALERTA' | 'OK'
  >('TODOS');

  // Visualizador de PDF (1 PDF, Comparador de 2 PDFs lado a lado e Tela Cheia)
  const [mostrarPdfLadoALado, setMostrarPdfLadoALado] = useState(true);
  const [modoComparacaoDupla, setModoComparacaoDupla] = useState(false);
  const [pdfTelaCheia, setPdfTelaCheia] = useState(false);
  const [indicePdfAtivo, setIndicePdfAtivo] = useState(0);
  const [indicePdfSecundario, setIndicePdfSecundario] = useState(1);
  const [urlPdfAtivo, setUrlPdfAtivo] = useState<string | null>(null);
  const [urlPdfSecundario, setUrlPdfSecundario] = useState<string | null>(null);
  const [paginaPdfAlvo, setPaginaPdfAlvo] = useState(1);

  // Busca multi-PDF
  const [termoBuscaPdf, setTermoBuscaPdf] = useState('');
  const [indiceOcorrenciaAtiva, setIndiceOcorrenciaAtiva] = useState(0);
  const [mostrarDocsSemOcorrencia, setMostrarDocsSemOcorrencia] =
    useState(false);
  const [modoDestaqueCanvas, setModoDestaqueCanvas] = useState(true);
  const [zoomCanvas, setZoomCanvas] = useState(1.2);
  const [paginasTextoPorArquivo, setPaginasTextoPorArquivo] = useState<
    Record<number, string[]>
  >({});
  const [retangulosGrifo, setRetangulosGrifo] = useState<
    Array<{ left: number; top: number; width: number; height: number }>
  >([]);

  const inputArquivosRef = useRef<HTMLInputElement>(null);
  const inputBuscaRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grifoPrincipalRef = useRef<HTMLDivElement | null>(null);
  const controleOcrRef = useRef<ControleCancelamentoOcrDesembolso | null>(null);
  const ultimaChaveBuscaRef = useRef('');

  const [anoRefAtual, mesRefAtual] = useMemo(() => {
    const [a, m] = (mesReferencia || obterMesAtualIso()).split('-');
    return [a || String(new Date().getFullYear()), m || '01'];
  }, [mesReferencia]);

  const anosDisponiveis = useMemo(() => {
    const base = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(base - 1 + i));
  }, []);

  // Atalho ESC para sair da tela cheia do PDF
  useEffect(() => {
    if (!pdfTelaCheia) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPdfTelaCheia(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfTelaCheia]);

  // Recalcula o pacote sempre que mudar documentos, modalidade ou Mês/Ano de Referência
  const relatorio: ResultadoAuditoriaPacoteDesembolso | null = useMemo(() => {
    if (documentosAuditados.length === 0) return null;
    return auditarPacoteDesembolsoCompleto({
      documentos: documentosAuditados,
      mesReferencia,
      modalidade,
      operacoesBase,
      contratacoes,
    });
  }, [
    documentosAuditados,
    mesReferencia,
    modalidade,
    operacoesBase,
    contratacoes,
  ]);

  const arquivoAtivo = arquivos[indicePdfAtivo] || arquivos[0] || null;
  const arquivoSecundario =
    arquivos[indicePdfSecundario] ||
    arquivos[indicePdfAtivo === 0 ? 1 : 0] ||
    arquivos[0] ||
    null;

  useEffect(() => {
    if (!arquivoAtivo) {
      setUrlPdfAtivo(null);
      return;
    }
    const url = URL.createObjectURL(arquivoAtivo);
    setUrlPdfAtivo(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivoAtivo]);

  useEffect(() => {
    if (!arquivoSecundario || !modoComparacaoDupla) {
      setUrlPdfSecundario(null);
      return;
    }
    const url = URL.createObjectURL(arquivoSecundario);
    setUrlPdfSecundario(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivoSecundario, modoComparacaoDupla]);

  // Indexa texto por página para o localizador multi-PDF
  useEffect(() => {
    const novoMapa: Record<number, string[]> = {};
    documentosAuditados.forEach((doc, idx) => {
      const partes = (doc.textoExtraido || '').split(
        /\[P[ÁA]GINA\s+\d+\s+DE\s+\d+\]/i
      );
      const pags = partes.map((p) => p.trim()).filter((p) => p.length > 0);
      novoMapa[idx] = pags.length > 0 ? pags : [doc.textoExtraido || ''];
    });
    setPaginasTextoPorArquivo(novoMapa);
  }, [documentosAuditados]);

  const todasOcorrenciasNoKit: OcorrenciaBuscaPdfDesemb[] = useMemo(() => {
    const q = termoBuscaPdf.trim();
    if (q.length < 2) return [];
    const qNorm = removerAcentos(q).toUpperCase();
    const variacoes = new Set<string>([qNorm]);
    if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(qNorm)) {
      variacoes.add(qNorm.replace(/,(\d{2})$/, '.$1'));
    }
    const listaVars = Array.from(variacoes);
    const out: OcorrenciaBuscaPdfDesemb[] = [];

    arquivos.forEach((arq, idxArq) => {
      const pags = paginasTextoPorArquivo[idxArq] || [];
      pags.forEach((txtPag, idxPag) => {
        const txtNorm = removerAcentos(txtPag).toUpperCase();
        let pos = 0;
        let guard = 0;
        while (pos < txtNorm.length && guard < 30) {
          let melhor = -1;
          let tam = 0;
          for (const v of listaVars) {
            const idxM = txtNorm.indexOf(v, pos);
            if (idxM !== -1 && (melhor === -1 || idxM < melhor)) {
              melhor = idxM;
              tam = v.length;
            }
          }
          if (melhor === -1) break;
          const ini = Math.max(0, melhor - 45);
          const fim = Math.min(txtPag.length, melhor + tam + 55);
          out.push({
            indiceArquivo: idxArq,
            nomeArquivo: arq.name,
            pagina: idxPag + 1,
            totalPaginas: pags.length,
            trechoAntes: (ini > 0 ? '...' : '') + txtPag.substring(ini, melhor),
            termoEncontrado: txtPag.substring(melhor, melhor + tam),
            trechoDepois:
              txtPag.substring(melhor + tam, fim) +
              (fim < txtPag.length ? '...' : ''),
          });
          pos = melhor + tam;
          guard++;
        }
      });
    });
    return out;
  }, [termoBuscaPdf, arquivos, paginasTextoPorArquivo]);

  const resumoPorArquivo = useMemo(() => {
    if (termoBuscaPdf.trim().length < 2) return [];
    return arquivos.map((arq, idxArq) => ({
      indiceArquivo: idxArq,
      nomeArquivo: arq.name,
      total: todasOcorrenciasNoKit.filter((o) => o.indiceArquivo === idxArq)
        .length,
      primeiroIdx: todasOcorrenciasNoKit.findIndex(
        (o) => o.indiceArquivo === idxArq
      ),
    }));
  }, [termoBuscaPdf, arquivos, todasOcorrenciasNoKit]);

  const temOcorrenciaNoPdfAtual = useMemo(
    () =>
      todasOcorrenciasNoKit.some((o) => o.indiceArquivo === indicePdfAtivo),
    [todasOcorrenciasNoKit, indicePdfAtivo]
  );

  // Posiciona na 1ª ocorrência apenas quando o termo muda
  useEffect(() => {
    const q = termoBuscaPdf.trim();
    if (q.length < 2) {
      ultimaChaveBuscaRef.current = '';
      setMostrarDocsSemOcorrencia(false);
      return;
    }
    const chave = `${q.toUpperCase()}|${todasOcorrenciasNoKit.length}`;
    if (
      todasOcorrenciasNoKit.length > 0 &&
      ultimaChaveBuscaRef.current !== chave
    ) {
      ultimaChaveBuscaRef.current = chave;
      setIndiceOcorrenciaAtiva(0);
      setIndicePdfAtivo(todasOcorrenciasNoKit[0].indiceArquivo);
      setPaginaPdfAlvo(todasOcorrenciasNoKit[0].pagina);
      setModoDestaqueCanvas(true);
    }
  }, [termoBuscaPdf, todasOcorrenciasNoKit]);

  // Grifo visual direto no Canvas (modo 1 PDF)
  useEffect(() => {
    let cancelado = false;
    const q = termoBuscaPdf.trim();
    if (
      !arquivoAtivo ||
      q.length < 2 ||
      !modoDestaqueCanvas ||
      !temOcorrenciaNoPdfAtual ||
      !mostrarPdfLadoALado ||
      modoComparacaoDupla
    ) {
      setRetangulosGrifo([]);
      return;
    }

    const renderGrifo = async () => {
      try {
        const win = typeof window !== 'undefined' ? (window as any) : null;
        const pdfjsLib = win?.pdfjsLib;
        const canvas = canvasRef.current;
        if (!pdfjsLib || !canvas) return;

        const buffer = await arquivoAtivo.arrayBuffer();
        if (cancelado) return;
        const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) })
          .promise;
        const numPag = Math.min(Math.max(1, paginaPdfAlvo), pdf.numPages || 1);
        const page = await pdf.getPage(numPag);
        if (cancelado) return;

        const vp = page.getViewport({ scale: zoomCanvas });
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelado) return;

        const content = await page.getTextContent();
        if (cancelado) return;

        const qNorm = removerAcentos(q).toUpperCase();
        const caixas: Array<{
          left: number;
          top: number;
          width: number;
          height: number;
        }> = [];

        for (const it of (content.items || []) as Array<any>) {
          const s = String(it.str || '');
          if (!s.trim()) continue;
          const sNorm = removerAcentos(s).toUpperCase();
          const idxM = sNorm.indexOf(qNorm);
          if (idxM !== -1) {
            const tr = Array.isArray(it.transform)
              ? it.transform
              : [1, 0, 0, 1, 0, 0];
            const fontH = Math.hypot(tr[2], tr[3]) || 10;
            const [vx, vy] = vp.convertToViewportPoint(tr[4], tr[5]);
            const largTok =
              (Number(it.width) || s.length * (fontH * 0.52)) * zoomCanvas;
            caixas.push({
              left: vx + (largTok * idxM) / Math.max(1, s.length) - 2,
              top: vy - fontH * zoomCanvas * 0.92,
              width: Math.max(
                18,
                (largTok * qNorm.length) / Math.max(1, s.length) + 4
              ),
              height: Math.max(14, fontH * zoomCanvas * 1.25),
            });
          }
        }
        setRetangulosGrifo(caixas);
        setTimeout(() => {
          grifoPrincipalRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 80);
      } catch {
        // Ignora erro de renderização
      }
    };
    renderGrifo();
    return () => {
      cancelado = true;
    };
  }, [
    arquivoAtivo,
    paginaPdfAlvo,
    termoBuscaPdf,
    modoDestaqueCanvas,
    temOcorrenciaNoPdfAtual,
    zoomCanvas,
    mostrarPdfLadoALado,
    modoComparacaoDupla,
    pdfTelaCheia,
  ]);

  const navegarOcorrencia = (novoIdx: number) => {
    if (todasOcorrenciasNoKit.length === 0) return;
    const total = todasOcorrenciasNoKit.length;
    const idxCirc = ((novoIdx % total) + total) % total;
    setIndiceOcorrenciaAtiva(idxCirc);
    const alvo = todasOcorrenciasNoKit[idxCirc];
    if (alvo) {
      setIndicePdfAtivo(alvo.indiceArquivo);
      setPaginaPdfAlvo(alvo.pagina);
      setModoDestaqueCanvas(true);
    }
  };

  const buscarNoPdf = (termo: string) => {
    const limpo = termo.trim();
    if (!limpo) return;
    setMostrarPdfLadoALado(true);
    if (limpo.toUpperCase() === termoBuscaPdf.trim().toUpperCase()) {
      navegarOcorrencia(indiceOcorrenciaAtiva + 1);
    } else {
      ultimaChaveBuscaRef.current = '';
      setTermoBuscaPdf(limpo);
      setIndiceOcorrenciaAtiva(0);
    }
    setTimeout(() => inputBuscaRef.current?.focus(), 60);
  };

  const selecionarPdfLivre = (idxArq: number) => {
    setIndicePdfAtivo(idxArq);
    if (termoBuscaPdf.trim().length >= 2) {
      const idxMatch = todasOcorrenciasNoKit.findIndex(
        (o) => o.indiceArquivo === idxArq
      );
      if (idxMatch !== -1) {
        setIndiceOcorrenciaAtiva(idxMatch);
        setPaginaPdfAlvo(todasOcorrenciasNoKit[idxMatch].pagina);
        setModoDestaqueCanvas(true);
        return;
      }
    }
    setPaginaPdfAlvo(1);
  };

  const alternarComparacaoDupla = () => {
    if (arquivos.length < 2) {
      alert('Carregue pelo menos 2 PDFs para comparar documentos lado a lado.');
      return;
    }
    const proximo = !modoComparacaoDupla;
    setModoComparacaoDupla(proximo);
    if (proximo) {
      setMostrarPdfLadoALado(true);
      if (indicePdfSecundario === indicePdfAtivo || indicePdfSecundario >= arquivos.length) {
        setIndicePdfSecundario(indicePdfAtivo === 0 ? 1 : 0);
      }
    }
  };

  const processarPdfsDesembolso = async (files: File[]) => {
    if (files.length === 0) return;
    const ctrl = criarControleCancelamentoOcrDesembolso();
    controleOcrRef.current = ctrl;
    setArquivos(files);
    setTermoBuscaPdf('');
    setIndicePdfAtivo(0);
    setIndicePdfSecundario(files.length > 1 ? 1 : 0);
    setModoComparacaoDupla(false);
    setPdfTelaCheia(false);
    setFiltroStatusChecklist('TODOS');
    setPaginaPdfAlvo(1);
    setAuditando(true);

    const listaRes: DocumentoDesembolsoAuditado[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (ctrl.cancelado && ctrl.modo === 'ABORTAR_TUDO') break;
        setProgressoMsg(
          `Auditando arquivo ${i + 1} de ${files.length}: "${files[i].name}"...`
        );
        const r = await auditarDocumentoIndividualDesembolso({
          file: files[i],
          onProgresso: (m) => setProgressoMsg(m),
          controle: ctrl,
        });
        listaRes.push(r);
      }
      if (!(ctrl.cancelado && ctrl.modo === 'ABORTAR_TUDO')) {
        setDocumentosAuditados(listaRes);
      }
    } finally {
      controleOcrRef.current = null;
      setAuditando(false);
      setProgressoMsg('');
    }
  };

  const selecionarPastaDesembolso = async () => {
    const win = window as any;
    if (!win.showDirectoryPicker) {
      inputArquivosRef.current?.click();
      return;
    }
    try {
      const dir = await win.showDirectoryPicker();
      const encontrados: File[] = [];
      const varrer = async (handle: any, prof = 0) => {
        if (prof > 2) return;
        for await (const [nome, entry] of handle.entries()) {
          if (entry.kind === 'file' && nome.toLowerCase().endsWith('.pdf')) {
            encontrados.push(await entry.getFile());
          } else if (entry.kind === 'directory') {
            await varrer(entry, prof + 1);
          }
        }
      };
      await varrer(dir, 0);
      if (encontrados.length === 0) {
        alert('⚠️ Nenhum PDF encontrado nessa pasta.');
        return;
      }
      await processarPdfsDesembolso(encontrados);
    } catch {
      // Cancelado
    }
  };

  const reexecutarOcrNoPdfAtivo = async () => {
    if (!arquivoAtivo || auditando) return;
    const ctrl = criarControleCancelamentoOcrDesembolso();
    controleOcrRef.current = ctrl;
    setAuditando(true);
    try {
      const rOcr = await auditarDocumentoIndividualDesembolso({
        file: arquivoAtivo,
        forcarOcr: true,
        onProgresso: (m) => setProgressoMsg(m),
        controle: ctrl,
      });
      setDocumentosAuditados((prev) =>
        prev.map((d, idx) => (idx === indicePdfAtivo ? rOcr : d))
      );
    } finally {
      controleOcrRef.current = null;
      setAuditando(false);
      setProgressoMsg('');
    }
  };

  const limparConsulta = async () => {
    if (controleOcrRef.current) {
      controleOcrRef.current.modo = 'ABORTAR_TUDO';
      controleOcrRef.current.cancelado = true;
      await controleOcrRef.current.terminarWorkerAtivo?.();
    }
    setArquivos([]);
    setDocumentosAuditados([]);
    setPaginasTextoPorArquivo({});
    setTermoBuscaPdf('');
    setIndicePdfAtivo(0);
    setIndicePdfSecundario(1);
    setModoComparacaoDupla(false);
    setPdfTelaCheia(false);
    setFiltroStatusChecklist('TODOS');
    setPaginaPdfAlvo(1);
    setAuditando(false);
    setProgressoMsg('');
  };

  const extrairTermosDoCard = (
    item: ItemChecklistAuditoriaDesembolso
  ): string[] => {
    const txt = `${item.resumo} ${item.detalhes.join(' ')}`;
    const termos: string[] = [];
    for (const m of txt.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g)) {
      if (m[1] !== '0,00') termos.push(m[1]);
    }
    for (const m of txt.matchAll(/\b(\d{2}\/\d{2}\/20\d{2})\b/g)) {
      termos.push(m[1]);
    }
    for (const m of txt.matchAll(/GTA\s+n[°º]?\s*(\d{4,12})/gi)) {
      termos.push(m[1]);
    }
    for (const m of txt.matchAll(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g)) {
      termos.push(m[1]);
    }
    return Array.from(new Set(termos)).slice(0, 4);
  };

  const contagensChecklist = useMemo(() => {
    const lista = relatorio?.checklist || [];
    return {
      todos: lista.length,
      erros: lista.filter((c) => c.status === 'ERRO').length,
      alertas: lista.filter((c) => c.status === 'ALERTA').length,
      ok: lista.filter((c) => c.status === 'OK').length,
    };
  }, [relatorio]);

  const checklistFiltrado = useMemo(() => {
    const lista = relatorio?.checklist || [];
    if (filtroStatusChecklist === 'TODOS') return lista;
    return lista.filter((c) => c.status === filtroStatusChecklist);
  }, [relatorio, filtroStatusChecklist]);

  const semaforo = useMemo(() => {
    if (!relatorio) return 'AGUARDANDO';
    if (relatorio.checklist.some((c) => c.status === 'ERRO')) return 'ERRO';
    if (
      relatorio.checklist.some(
        (c) =>
          c.status === 'ALERTA' && c.id !== 'DESEMB_3_CRONOGRAMA_ORCAMENTO'
      )
    ) {
      return 'ALERTA';
    }
    return 'APROVADO';
  }, [relatorio]);

  if (!aberto || typeof document === 'undefined') return null;

  const ocorrenciaAtual = todasOcorrenciasNoKit[indiceOcorrenciaAtiva] || null;
  const arquivosComOcorrencia = resumoPorArquivo.filter((r) => r.total > 0);
  const arquivosSemOcorrencia = resumoPorArquivo.filter((r) => r.total === 0);

  // Estilos reutilizáveis (reseta padding global de select para nunca cortar texto!)
  const selectCleanHeader: React.CSSProperties = {
    width: 'auto',
    height: '32px',
    padding: '0 8px',
    lineHeight: '30px',
    fontSize: '12px',
    fontWeight: 700,
    borderRadius: '7px',
    border: '1px solid rgba(255,255,255,0.22)',
    background: 'rgba(15, 23, 42, 0.35)',
    color: '#ffffff',
    cursor: 'pointer',
    boxSizing: 'border-box',
  };

  const selectCleanPdfBar: React.CSSProperties = {
    height: '30px',
    padding: '0 8px',
    lineHeight: '28px',
    fontSize: '11.5px',
    fontWeight: 700,
    background: '#0f172a',
    color: '#f8fafc',
    border: '1px solid #475569',
    borderRadius: '6px',
    cursor: 'pointer',
    boxSizing: 'border-box',
    maxWidth: '250px',
    width: 'auto',
  };

  const btnToolbarGhost: React.CSSProperties = {
    width: 'auto',
    height: '32px',
    padding: '0 11px',
    background: 'rgba(255,255,255,0.1)',
    color: '#f8fafc',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '7px',
    fontSize: '11.5px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    whiteSpace: 'nowrap',
  };

  const renderPainelVisualizadorPdf = (emTelaCheia: boolean) => {
    if (!urlPdfAtivo || !arquivoAtivo) return null;

    return (
      <section
        style={{
          background: '#0f172a',
          borderRadius: emTelaCheia ? 0 : '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: emTelaCheia ? 'none' : '1px solid #334155',
          height: '100%',
          boxShadow: emTelaCheia ? 'none' : '0 4px 14px rgba(15,23,42,0.12)',
        }}
      >
        {/* BARRA SUPERIOR DO VISUALIZADOR */}
        <div
          style={{
            padding: '8px 12px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            color: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#94a3b8',
                whiteSpace: 'nowrap',
              }}
            >
              {modoComparacaoDupla ? '📄 DOC A:' : '📄 PDF:'}
            </span>
            <select
              value={indicePdfAtivo}
              onChange={(e) => selecionarPdfLivre(Number(e.target.value))}
              style={{ ...selectCleanPdfBar, flex: 1, minWidth: '150px' }}
              title={arquivoAtivo.name}
            >
              {arquivos.map((a, idx) => (
                <option key={idx} value={idx} style={{ background: '#0f172a', color: '#fff' }}>
                  {a.name}
                </option>
              ))}
            </select>

            {modoComparacaoDupla && arquivos.length > 1 && (
              <>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#fbbf24',
                    whiteSpace: 'nowrap',
                  }}
                >
                  × DOC B:
                </span>
                <select
                  value={indicePdfSecundario}
                  onChange={(e) =>
                    setIndicePdfSecundario(Number(e.target.value))
                  }
                  style={{
                    ...selectCleanPdfBar,
                    borderColor: '#f59e0b',
                    flex: 1,
                    minWidth: '150px',
                  }}
                  title={arquivoSecundario?.name}
                >
                  {arquivos.map((a, idx) => (
                    <option key={idx} value={idx} style={{ background: '#0f172a', color: '#fff' }}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {arquivos.length > 1 && (
              <button
                type="button"
                onClick={alternarComparacaoDupla}
                style={{
                  width: 'auto',
                  height: '30px',
                  padding: '0 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: modoComparacaoDupla
                    ? '1px solid #fbbf24'
                    : '1px solid #475569',
                  background: modoComparacaoDupla ? '#b45309' : '#0f172a',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                }}
                title="Visualizar dois documentos lado a lado para comparação direta"
              >
                {modoComparacaoDupla ? '◫ 2 PDFs Ativo' : '◫ Comparar 2 PDFs'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPdfTelaCheia((p) => !p)}
              style={{
                width: 'auto',
                height: '30px',
                padding: '0 10px',
                fontSize: '11px',
                fontWeight: 800,
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid #475569',
                background: emTelaCheia ? '#dc2626' : '#0f172a',
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
              title={
                emTelaCheia
                  ? 'Sair da Tela Cheia (ESC)'
                  : 'Expandir visualizador em Tela Cheia'
              }
            >
              {emTelaCheia ? '✕ Fechar Tela Cheia' : '⛶ Tela Cheia'}
            </button>
          </div>
        </div>

        {/* BARRA DE BUSCA GLOBAL (COMPACTA E SEM POLUIÇÃO) */}
        {!modoComparacaoDupla && (
          <div
            style={{
              padding: '8px 12px',
              background: '#0f2922',
              borderBottom: '1px solid #1e3a33',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                ref={inputBuscaRef}
                type="text"
                value={termoBuscaPdf}
                onChange={(e) => {
                  ultimaChaveBuscaRef.current = '';
                  setTermoBuscaPdf(e.target.value);
                  setIndiceOcorrenciaAtiva(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navegarOcorrencia(
                      e.shiftKey
                        ? indiceOcorrenciaAtiva - 1
                        : indiceOcorrenciaAtiva + 1
                    );
                  }
                }}
                placeholder="🔍 Buscar em todos os PDFs (valor, NF, GTA, CPF)..."
                style={{
                  flex: 1,
                  height: '30px',
                  fontSize: '11.5px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
              {termoBuscaPdf && (
                <button
                  type="button"
                  onClick={() => setTermoBuscaPdf('')}
                  style={{
                    width: 'auto',
                    height: '30px',
                    padding: '0 9px',
                    background: '#334155',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  ✖
                </button>
              )}
              {todasOcorrenciasNoKit.length > 0 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#0f172a',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#fde047',
                      padding: '0 4px',
                    }}
                  >
                    {indiceOcorrenciaAtiva + 1}/{todasOcorrenciasNoKit.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      navegarOcorrencia(indiceOcorrenciaAtiva - 1)
                    }
                    style={{
                      width: 'auto',
                      height: '24px',
                      padding: '0 7px',
                      background: '#1e293b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navegarOcorrencia(indiceOcorrenciaAtiva + 1)
                    }
                    style={{
                      width: 'auto',
                      height: '24px',
                      padding: '0 7px',
                      background: '#1e293b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>

            {/* Chips de cruzamento: exibe APENAS arquivos com ocorrências (1 linha limpa!) */}
            {termoBuscaPdf.trim().length >= 2 && (
              <div
                style={{
                  display: 'flex',
                  gap: '5px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#a7f3d0',
                    fontWeight: 800,
                  }}
                >
                  Encontrado em:
                </span>
                {arquivosComOcorrencia.length === 0 ? (
                  <span style={{ fontSize: '10px', color: '#fca5a5' }}>
                    Nenhuma ocorrência no texto extraído
                  </span>
                ) : (
                  arquivosComOcorrencia.map((r) => (
                    <button
                      key={r.indiceArquivo}
                      type="button"
                      onClick={() => navegarOcorrencia(r.primeiroIdx)}
                      style={{
                        width: 'auto',
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        borderRadius: '12px',
                        border:
                          r.indiceArquivo === indicePdfAtivo
                            ? '1.5px solid #fde047'
                            : '1px solid #34d399',
                        background:
                          r.indiceArquivo === indicePdfAtivo
                            ? '#047857'
                            : '#064e3b',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      {r.nomeArquivo} ({r.total})
                    </button>
                  ))
                )}

                {arquivosSemOcorrencia.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarDocsSemOcorrencia((p) => !p)}
                    style={{
                      width: 'auto',
                      padding: '2px 7px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      borderRadius: '12px',
                      border: '1px dashed #475569',
                      background: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {mostrarDocsSemOcorrencia
                      ? 'Ocultar zerados'
                      : `+ ${arquivosSemOcorrencia.length} sem ocorrência`}
                  </button>
                )}

                {mostrarDocsSemOcorrencia &&
                  arquivosSemOcorrencia.map((r) => (
                    <button
                      key={r.indiceArquivo}
                      type="button"
                      onClick={() => selecionarPdfLivre(r.indiceArquivo)}
                      style={{
                        width: 'auto',
                        padding: '2px 7px',
                        fontSize: '9.5px',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {r.nomeArquivo} (0)
                    </button>
                  ))}
              </div>
            )}

            {ocorrenciaAtual && (
              <div
                style={{
                  background: '#0f172a',
                  color: '#cbd5e1',
                  fontSize: '10.5px',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  borderLeft: '3px solid #fde047',
                }}
              >
                {ocorrenciaAtual.trechoAntes}
                <mark
                  style={{
                    background: '#fde047',
                    color: '#0f172a',
                    fontWeight: 900,
                    padding: '0 2px',
                    borderRadius: '2px',
                  }}
                >
                  {ocorrenciaAtual.termoEncontrado}
                </mark>
                {ocorrenciaAtual.trechoDepois}
              </div>
            )}
          </div>
        )}

        {/* ÁREA DE EXIBIÇÃO: MODO COMPARAÇÃO 2 PDFs OU MODO 1 PDF (CANVAS GRIFO / IFRAME) */}
        {modoComparacaoDupla && urlPdfSecundario ? (
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
              background: '#334155',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
              <div
                style={{
                  padding: '4px 10px',
                  background: '#064e3b',
                  color: '#d1fae5',
                  fontSize: '10.5px',
                  fontWeight: 800,
                }}
              >
                DOC A — {arquivoAtivo.name}
              </div>
              <iframe
                key={`cmpA_${urlPdfAtivo}_p${paginaPdfAlvo}`}
                src={`${urlPdfAtivo}#page=${paginaPdfAlvo}&zoom=page-width`}
                title={arquivoAtivo.name}
                style={{ flex: 1, width: '100%', border: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
              <div
                style={{
                  padding: '4px 10px',
                  background: '#78350f',
                  color: '#fef3c7',
                  fontSize: '10.5px',
                  fontWeight: 800,
                }}
              >
                DOC B — {arquivoSecundario?.name}
              </div>
              <iframe
                key={`cmpB_${urlPdfSecundario}`}
                src={`${urlPdfSecundario}#page=1&zoom=page-width`}
                title={arquivoSecundario?.name || 'Documento B'}
                style={{ flex: 1, width: '100%', border: 'none' }}
              />
            </div>
          </div>
        ) : termoBuscaPdf.trim().length >= 2 &&
          modoDestaqueCanvas &&
          temOcorrenciaNoPdfAtual ? (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: '#334155',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '6px',
                background: '#1e293b',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => setZoomCanvas((z) => Math.max(0.8, z - 0.15))}
                style={{
                  width: 'auto',
                  padding: '3px 8px',
                  fontSize: '11px',
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ➖
              </button>
              <span
                style={{
                  fontSize: '11px',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  alignSelf: 'center',
                }}
              >
                {Math.round(zoomCanvas * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomCanvas((z) => Math.min(2.2, z + 0.15))}
                style={{
                  width: 'auto',
                  padding: '3px 8px',
                  fontSize: '11px',
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ➕
              </button>
              <button
                type="button"
                onClick={() => setModoDestaqueCanvas(false)}
                style={{
                  width: 'auto',
                  padding: '3px 9px',
                  fontSize: '11px',
                  background: '#047857',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                📄 Ver PDF Nativo
              </button>
            </div>
            <div style={{ position: 'relative', background: '#fff' }}>
              <canvas ref={canvasRef} style={{ display: 'block' }} />
              {retangulosGrifo.map((b, iB) => (
                <div
                  key={iB}
                  ref={iB === 0 ? grifoPrincipalRef : undefined}
                  style={{
                    position: 'absolute',
                    left: `${b.left}px`,
                    top: `${b.top}px`,
                    width: `${b.width}px`,
                    height: `${b.height}px`,
                    background: 'rgba(250, 204, 21, 0.48)',
                    border: '2px solid #0284c7',
                    pointerEvents: 'none',
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <iframe
            key={`${urlPdfAtivo}_p${paginaPdfAlvo}`}
            src={`${urlPdfAtivo}#page=${paginaPdfAlvo}&zoom=page-width`}
            title={arquivoAtivo.name}
            style={{ flex: 1, width: '100%', border: 'none' }}
          />
        )}
      </section>
    );
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f1f5f9',
        zIndex: 966000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* CABEÇALHO EXECUTIVO LIMPO */}
      <header
        style={{
          background: 'linear-gradient(90deg, #0b2e26 0%, #065f46 100%)',
          color: '#ffffff',
          padding: '10px 20px',
          borderBottom: '2px solid #d97706',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Esquerda: Voltar + Título Enxuto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              ...btnToolbarGhost,
              padding: '0 12px',
              fontWeight: 800,
            }}
          >
            ⬅️ Voltar
          </button>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '15.5px',
                fontWeight: 900,
                letterSpacing: '0.3px',
              }}
            >
              💸 ANALISADOR DE DESEMBOLSO
            </h2>
            
          </div>
        </div>

        {/* Direita: Controles Agrupados com Hierarquia Visual */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {/* Grupo 1: Parâmetros da Análise (Modalidade + Mês/Ano limpos) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.28)',
              padding: '4px 8px',
              borderRadius: '9px',
              border: '1px solid rgba(255,255,255,0.16)',
            }}
          >
            <select
              value={modalidade}
              onChange={(e) =>
                setModalidade(
                  e.target.value as
                    | 'PRONAF_A'
                    | 'DERIVADA_GERAL'
                    | 'RENOVACAO_CUSTEIO'
                )
              }
              style={{
                ...selectCleanHeader,
                height: '28px',
                lineHeight: '26px',
                border: 'none',
                background: 'transparent',
              }}
              title="Modalidade do Desembolso"
            >
              <option value="PRONAF_A" style={{ color: '#0f172a' }}>
                🌱 PRONAF A
              </option>
              <option value="DERIVADA_GERAL" style={{ color: '#0f172a' }}>
                🚜 Derivada (PRONAF V / MINI)
              </option>
              <option value="RENOVACAO_CUSTEIO" style={{ color: '#0f172a' }}>
                🌾 Renovação Custeio
              </option>
            </select>

            <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#a7f3d0',
                whiteSpace: 'nowrap',
              }}
            >
              📅 Ref.:
            </span>
            <select
              value={mesRefAtual}
              onChange={(e) =>
                setMesReferencia(`${anoRefAtual}-${e.target.value}`)
              }
              style={{
                ...selectCleanHeader,
                height: '28px',
                lineHeight: '26px',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
              }}
              title="Mês de referência do Anexo-Orçamento"
            >
              {MESES_SELECT.map((m) => (
                <option key={m.val} value={m.val}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={anoRefAtual}
              onChange={(e) =>
                setMesReferencia(`${e.target.value}-${mesRefAtual}`)
              }
              style={{
                ...selectCleanHeader,
                height: '28px',
                lineHeight: '26px',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
              }}
              title="Ano de referência do Anexo-Orçamento"
            >
              {anosDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={inputArquivosRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const lista = Array.from(e.target.files || []);
              if (lista.length > 0) processarPdfsDesembolso(lista);
              e.target.value = '';
            }}
          />

          {/* Grupo 2: Ações Primárias de Entrada */}
          <div style={{ display: 'inline-flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => inputArquivosRef.current?.click()}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 14px',
                background: '#f59e0b',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 900,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📄 Carregar PDFs
            </button>

            <button
              type="button"
              onClick={selecionarPastaDesembolso}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 13px',
                background: '#ffffff',
                color: '#065f46',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📂 Abrir Pasta
            </button>
          </div>

          {/* Grupo 3: Ações Secundárias (Glassmorphism sutil e harmônico) */}
          {relatorio && !auditando && (
            <div style={{ display: 'inline-flex', gap: '6px' }}>
              <button
                type="button"
                onClick={reexecutarOcrNoPdfAtivo}
                style={btnToolbarGhost}
                title="Forçar leitura OCR no PDF selecionado atualmente"
              >
                🧠 OCR no PDF
              </button>

              {arquivos.length > 1 && (
                <button
                  type="button"
                  onClick={alternarComparacaoDupla}
                  style={{
                    ...btnToolbarGhost,
                    background: modoComparacaoDupla
                      ? 'rgba(245, 158, 11, 0.28)'
                      : 'rgba(255,255,255,0.1)',
                    borderColor: modoComparacaoDupla
                      ? '#fbbf24'
                      : 'rgba(255,255,255,0.2)',
                  }}
                  title="Comparar dois PDFs lado a lado"
                >
                  ◫ 2 PDFs
                </button>
              )}

              <button
                type="button"
                onClick={() => setMostrarPdfLadoALado((p) => !p)}
                style={btnToolbarGhost}
              >
                {mostrarPdfLadoALado ? '👁️ Ocultar PDF' : '👁️ Ver PDF'}
              </button>

              <button
                type="button"
                onClick={limparConsulta}
                style={{
                  ...btnToolbarGhost,
                  background: 'rgba(220, 38, 38, 0.22)',
                  borderColor: 'rgba(248, 113, 113, 0.5)',
                  color: '#fecaca',
                }}
              >
                🧹 Limpar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* BARRA COMPACTA DOS DOCUMENTOS CARREGADOS */}
      {documentosAuditados.length > 0 && (
        <div
          style={{
            padding: '7px 18px',
            background: '#ffffff',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#475569',
              whiteSpace: 'nowrap',
              marginRight: '4px',
            }}
          >
            📂 Dossiê ({documentosAuditados.length}):
          </span>

          {documentosAuditados.map((d, idx) => {
            const ativoA = indicePdfAtivo === idx;
            const ativoB = modoComparacaoDupla && indicePdfSecundario === idx;
            const badge =
              BADGE_TIPO_CURTO[d.tipo] || BADGE_TIPO_CURTO.OUTRO_DESEMBOLSO;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => selecionarPdfLivre(idx)}
                title={`${d.tituloTipo} — ${d.nomeArquivo}`}
                style={{
                  width: 'auto',
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: ativoA || ativoB ? 800 : 600,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: ativoA
                    ? '1.5px solid #047857'
                    : ativoB
                    ? '1.5px solid #d97706'
                    : '1px solid #e2e8f0',
                  background: ativoA
                    ? '#ecfdf5'
                    : ativoB
                    ? '#fffbeb'
                    : '#f8fafc',
                  color: '#0f172a',
                }}
              >
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 900,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: badge.bg,
                    color: badge.cor,
                  }}
                >
                  {badge.sigla}
                </span>
                <span
                  style={{
                    maxWidth: '170px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.nomeArquivo}
                </span>
                {ativoA && modoComparacaoDupla && (
                  <span style={{ fontSize: '9px', color: '#047857' }}>[A]</span>
                )}
                {ativoB && (
                  <span style={{ fontSize: '9px', color: '#b45309' }}>[B]</span>
                )}
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
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '42px' }}>🔍</div>
          <h3 style={{ margin: 0, color: '#064e3b' }}>
            {progressoMsg || 'Auditando pacote de desembolso...'}
          </h3>
          <button
            type="button"
            onClick={limparConsulta}
            style={{
              width: 'auto',
              padding: '8px 16px',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🛑 Cancelar Leitura
          </button>
        </div>
      ) : !relatorio ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            textAlign: 'center',
            padding: '40px',
          }}
        >
          <div style={{ fontSize: '50px', marginBottom: '12px' }}>💸</div>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>
            Pronto para Analisar Documentos de Desembolso
          </h3>
          <p style={{ maxWidth: '580px', fontSize: '13px', lineHeight: 1.6 }}>
            Carregue o <b>Anexo-Orçamento</b>, <b>Comprovação Financeira</b>,{' '}
            <b>Laudo de Acompanhamento</b>, <b>GTA</b>, <b>Notas Fiscais</b>,{' '}
            <b>Recibos</b>, <b>Declaração de Recebimento</b> e os <b>VITIs</b>{' '}
            — o sistema identifica cada peça pelo conteúdo interno.
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: !mostrarPdfLadoALado
              ? '340px 1fr'
              : modoComparacaoDupla
              ? '430px 1fr'
              : '330px 1.05fr 1.12fr',
            gap: '14px',
            padding: '14px 18px',
            overflow: 'hidden',
          }}
        >
          {/* COLUNA 1: SEMÁFORO + RAIO-X EM KPI CARDS + CHAVES NF-e (oculta no modo 2 PDFs para maximizar área de comparação) */}
          {!modoComparacaoDupla && (
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
                  padding: '14px',
                  border: '1px solid #cbd5e1',
                  borderTop: `5px solid ${
                    semaforo === 'APROVADO'
                      ? '#16a34a'
                      : semaforo === 'ALERTA'
                      ? '#f59e0b'
                      : '#dc2626'
                  }`,
                  boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 900,
                    color:
                      semaforo === 'APROVADO'
                        ? '#15803d'
                        : semaforo === 'ALERTA'
                        ? '#b45309'
                        : '#b91c1c',
                  }}
                >
                  {semaforo === 'APROVADO'
                    ? '✅ DESEMBOLSO 100% CONFORME'
                    : semaforo === 'ALERTA'
                    ? '⚠️ CONFORME COM PONTOS DE ATENÇÃO'
                    : '🚨 IMPEDIMENTO / DIVERGÊNCIA DETECTADA'}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '8px',
                    fontSize: '10.5px',
                    fontWeight: 800,
                  }}
                >
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: '#fef2f2',
                      color: '#b91c1c',
                    }}
                  >
                    🚨 {contagensChecklist.erros} Erro(s)
                  </span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: '#fffbeb',
                      color: '#b45309',
                    }}
                  >
                    ⚠️ {contagensChecklist.alertas} Alerta(s)
                  </span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: '#f0fdf4',
                      color: '#15803d',
                    }}
                  >
                    ✅ {contagensChecklist.ok} OK
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(relatorio.textoResumoS567);
                    alert('📋 Resumo S567 do Desembolso copiado!');
                  }}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '9px',
                    background: '#065f46',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  📋 Copiar Despacho / Resumo S567
                </button>
              </div>

              {/* RAIO-X DO CLIENTE + MINI-GRID FINANCEIRO 2×3 */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <strong style={{ color: '#064e3b', fontSize: '11.5px' }}>
                  📊 RAIO-X DO DESEMBOLSO
                </strong>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>
                    <b>👤 Cliente:</b> {relatorio.clienteNome || '-'}
                  </div>
                  <div>
                    <b>🪪 CPF:</b> {relatorio.clienteCpf || '-'}
                  </div>
                  <div>
                    <b>🔢 CCB:</b> {relatorio.numeroCcb || '-'} (
                    {relatorio.dataContratacao || '-'})
                  </div>
                  <div>
                    <b>📍 Localidade:</b> {relatorio.imovelEstabelecimento || '-'}
                  </div>
                  {relatorio.operacaoPainelVinculada && (
                    <div style={{ color: '#0369a1', fontWeight: 700 }}>
                      🔗 {relatorio.operacaoPainelVinculada.op || 'Painel'} •{' '}
                      {relatorio.operacaoPainelVinculada.porte} • Proj.:{' '}
                      {relatorio.operacaoPainelVinculada.projetista}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #cbd5e1',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>
                      ORÇAMENTO
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>
                      R$ {formatarMoedaBD(relatorio.valorTotalOrcamento)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ fontSize: '9.5px', color: '#15803d', fontWeight: 700 }}>
                      LIBERÁVEL ({mesRefAtual}/{anoRefAtual})
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#15803d' }}>
                      R$ {formatarMoedaBD(relatorio.valorLiberavelAteMesRef)}
                    </div>
                  </div>

                  <div
                    style={{
                      background:
                        relatorio.valorBloqueadoFuturo > 0 ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${
                        relatorio.valorBloqueadoFuturo > 0 ? '#fde68a' : '#e2e8f0'
                      }`,
                      borderRadius: '6px',
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ fontSize: '9.5px', color: '#92400e', fontWeight: 700 }}>
                      FUTURO
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#92400e' }}>
                      R$ {formatarMoedaBD(relatorio.valorBloqueadoFuturo)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ fontSize: '9.5px', color: '#1e40af', fontWeight: 700 }}>
                      COMPROVAÇÃO
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#1e40af' }}>
                      R$ {formatarMoedaBD(relatorio.valorTotalComprovacaoFinanceira)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>
                      NOTAS FISCAIS
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>
                      R$ {formatarMoedaBD(relatorio.valorTotalNotasFiscais)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>
                      RECIBOS
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>
                      R$ {formatarMoedaBD(relatorio.valorTotalRecibos)}
                    </div>
                  </div>
                </div>
              </div>

              {/* CHAVES NF-e */}
              {relatorio.documentos.some((d) => d.dadosNf?.chaveAcesso) && (
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    fontSize: '11px',
                  }}
                >
                  <strong style={{ color: '#0369a1', fontSize: '11.5px' }}>
                    🔑 CHAVES NF-e (RECEITA FEDERAL)
                  </strong>
                  {relatorio.documentos
                    .filter((d) => d.dadosNf?.chaveAcesso)
                    .map((d, i) => (
                      <div
                        key={i}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '7px',
                          padding: '7px 9px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            color: '#0f172a',
                          }}
                        >
                          <span>NF {d.dadosNf?.numero || '?'}</span>
                          <span style={{ color: '#047857' }}>
                            R$ {formatarMoedaBD(d.dadosNf?.valorTotal || 0)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '9.8px',
                            wordBreak: 'break-all',
                            color: '#475569',
                            margin: '4px 0 6px 0',
                          }}
                        >
                          {d.dadosNf?.chaveAcesso}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(
                                d.dadosNf?.chaveAcesso || ''
                              );
                              alert('🔑 Chave NF-e copiada!');
                            }}
                            style={{
                              width: 'auto',
                              padding: '3px 8px',
                              fontSize: '10px',
                              fontWeight: 800,
                              background: '#e0f2fe',
                              color: '#0369a1',
                              border: '1px solid #7dd3fc',
                              borderRadius: '5px',
                              cursor: 'pointer',
                            }}
                          >
                            📋 Copiar
                          </button>
                          <a
                            href="https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#047857',
                              textDecoration: 'none',
                              padding: '3px 7px',
                              background: '#ecfdf5',
                              borderRadius: '5px',
                              border: '1px solid #a7f3d0',
                            }}
                          >
                            🌐 Portal NF-e ↗
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </aside>
          )}

          {/* COLUNA 2: CHECKLIST EXECUTIVO COM FILTROS RÁPIDOS */}
          <main
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <strong style={{ fontSize: '12.5px', color: '#064e3b' }}>
                🔍 AUDITORIA CRUZADA ({checklistFiltrado.length}/{contagensChecklist.todos})
              </strong>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(
                  [
                    { id: 'TODOS', label: `Todos (${contagensChecklist.todos})` },
                    { id: 'ERRO', label: `🚨 Erros (${contagensChecklist.erros})` },
                    {
                      id: 'ALERTA',
                      label: `⚠️ Alertas (${contagensChecklist.alertas})`,
                    },
                    { id: 'OK', label: `✅ OK (${contagensChecklist.ok})` },
                  ] as const
                ).map((f) => {
                  const sel = filtroStatusChecklist === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltroStatusChecklist(f.id)}
                      style={{
                        width: 'auto',
                        padding: '3px 8px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        borderRadius: '12px',
                        border: sel
                          ? '1px solid #047857'
                          : '1px solid #cbd5e1',
                        background: sel ? '#047857' : '#ffffff',
                        color: sel ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: '#f8fafc',
              }}
            >
              {checklistFiltrado.map((item) => {
                const cor =
                  item.status === 'ERRO'
                    ? '#dc2626'
                    : item.status === 'ALERTA'
                    ? '#d97706'
                    : '#16a34a';
                const badgeBg =
                  item.status === 'ERRO'
                    ? '#fef2f2'
                    : item.status === 'ALERTA'
                    ? '#fffbeb'
                    : '#f0fdf4';
                const termos = extrairTermosDoCard(item);

                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderLeft: `5px solid ${cor}`,
                      borderRadius: '8px',
                      padding: '11px 13px',
                      boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '5px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: badgeBg,
                            color: cor,
                            border: `1px solid ${cor}33`,
                          }}
                        >
                          {item.status}
                        </span>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                          {item.titulo}
                        </strong>
                      </div>

                      {termos.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {termos.map((t, iT) => (
                            <button
                              key={iT}
                              type="button"
                              onClick={() => buscarNoPdf(t)}
                              style={{
                                width: 'auto',
                                padding: '2px 7px',
                                fontSize: '10px',
                                fontWeight: 700,
                                borderRadius: '5px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#1e40af',
                                cursor: 'pointer',
                              }}
                            >
                              🔎 {t}
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
                        lineHeight: 1.45,
                      }}
                    >
                      {item.resumo}
                    </div>

                    {item.detalhes.length > 0 && (
                      <div
                        style={{
                          marginTop: '7px',
                          paddingTop: '7px',
                          borderTop: '1px dashed #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          fontSize: '11px',
                          color: '#334155',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.detalhes.map((d, iD) => (
                          <div key={iD}>{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>

          {/* COLUNA 3: VISUALIZADOR DE PDF (1 PDF OU COMPARAÇÃO 2 PDFs) */}
          {mostrarPdfLadoALado && !pdfTelaCheia && renderPainelVisualizadorPdf(false)}
        </div>
      )}

      {/* OVERLAY DE TELA CHEIA (1 PDF OU COMPARAÇÃO DE 2 PDFs LADO A LADO) */}
      {pdfTelaCheia && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderPainelVisualizadorPdf(true)}
        </div>
      )}
    </div>,
    document.body
  );
}