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

  // Visualizador de PDF + Busca Multi-PDF (sem travamento)
  const [mostrarPdfLadoALado, setMostrarPdfLadoALado] = useState(true);
  const [indicePdfAtivo, setIndicePdfAtivo] = useState(0);
  const [urlPdfAtivo, setUrlPdfAtivo] = useState<string | null>(null);
  const [paginaPdfAlvo, setPaginaPdfAlvo] = useState(1);
  const [termoBuscaPdf, setTermoBuscaPdf] = useState('');
  const [indiceOcorrenciaAtiva, setIndiceOcorrenciaAtiva] = useState(0);
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

  // Recalcula o pacote sempre que mudar documentos, modalidade ou Mês/Ano de Referência!
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

  useEffect(() => {
    if (!arquivoAtivo) {
      setUrlPdfAtivo(null);
      return;
    }
    const url = URL.createObjectURL(arquivoAtivo);
    setUrlPdfAtivo(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivoAtivo]);

  // Indexa texto por página para o localizador multi-PDF
  useEffect(() => {
    const novoMapa: Record<number, string[]> = {};
    documentosAuditados.forEach((doc, idx) => {
      const partes = (doc.textoExtraido || '').split(
        /\[P[ÁA]GINA\s+\d+\s+DE\s+\d+\]/i
      );
      const pags = partes
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
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

  // Posiciona na 1ª ocorrência apenas quando o termo muda (nunca trava a troca manual de PDF!)
  useEffect(() => {
    const q = termoBuscaPdf.trim();
    if (q.length < 2) {
      ultimaChaveBuscaRef.current = '';
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

  // Grifo visual direto no Canvas
  useEffect(() => {
    let cancelado = false;
    const q = termoBuscaPdf.trim();
    if (
      !arquivoAtivo ||
      q.length < 2 ||
      !modoDestaqueCanvas ||
      !temOcorrenciaNoPdfAtual ||
      !mostrarPdfLadoALado
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

  const processarPdfsDesembolso = async (files: File[]) => {
    if (files.length === 0) return;
    const ctrl = criarControleCancelamentoOcrDesembolso();
    controleOcrRef.current = ctrl;
    setArquivos(files);
    setTermoBuscaPdf('');
    setIndicePdfAtivo(0);
    setPaginaPdfAlvo(1);
    setAuditando(true);

    const listaRes: DocumentoDesembolsoAuditado[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (ctrl.cancelado && ctrl.modo === 'ABORTAR_TUDO') break;
        setProgressoMsg(
          `⏳ Auditando arquivo ${i + 1}/${files.length}: "${files[i].name}"...`
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
      {/* CABEÇALHO */}
      <header
        style={{
          background: 'linear-gradient(90deg, #064e3b 0%, #047857 100%)',
          color: '#ffffff',
          padding: '12px 22px',
          borderBottom: '3px solid #f59e0b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              width: 'auto',
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.16)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ⬅️ Voltar
          </button>

          <div>
            <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 900 }}>
              💸 ANALISADOR INTELIGENTE DE DESEMBOLSO (ORÇAMENTO × NFs × GTA × LAUDO × VITI)
            </h2>
            <span style={{ fontSize: '11.5px', color: '#d1fae5' }}>
              Identifica cada PDF pelo conteúdo interno, bloqueia parcelas futuras do Anexo-Orçamento e gera o despacho S567.
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
              width: 'auto',
              height: '34px',
              fontSize: '11.5px',
              fontWeight: 800,
              borderRadius: '7px',
              border: '1px solid #a7f3d0',
              background: '#065f46',
              color: '#ffffff',
              padding: '0 10px',
            }}
          >
            <option value="PRONAF_A">🌱 PRONAF A</option>
            <option value="DERIVADA_GERAL">🚜 Derivada (PRONAF V / MINI)</option>
            <option value="RENOVACAO_CUSTEIO">🌾 Renovação Custeio</option>
          </select>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(255,255,255,0.14)',
              padding: '3px 8px',
              borderRadius: '7px',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
            title="Mês/Ano limite do Anexo-Orçamento permitido para desembolso agora"
          >
            <span style={{ fontSize: '11px', fontWeight: 800 }}>
              📅 Ref. Orç.:
            </span>
            <input
              type="month"
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              style={{
                height: '26px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '5px',
                border: 'none',
                padding: '0 6px',
                color: '#0f172a',
                width: '130px',
              }}
            />
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

          <button
            type="button"
            onClick={() => inputArquivosRef.current?.click()}
            style={{
              width: 'auto',
              padding: '8px 14px',
              background: '#f59e0b',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            📄 Selecionar PDFs
          </button>

          <button
            type="button"
            onClick={selecionarPastaDesembolso}
            style={{
              width: 'auto',
              padding: '8px 13px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            📂 Buscar na Pasta
          </button>

          {relatorio && !auditando && (
            <>
              <button
                type="button"
                onClick={reexecutarOcrNoPdfAtivo}
                style={{
                  width: 'auto',
                  padding: '8px 11px',
                  background: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🧠 OCR neste PDF
              </button>

              <button
                type="button"
                onClick={() => setMostrarPdfLadoALado((p) => !p)}
                style={{
                  width: 'auto',
                  padding: '8px 11px',
                  background: mostrarPdfLadoALado ? '#0f172a' : '#475569',
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
                onClick={limparConsulta}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                🧹 Limpar
              </button>
            </>
          )}
        </div>
      </header>

      {/* BARRA DE ABAS DOS PDFs CARREGADOS */}
      {documentosAuditados.length > 0 && (
        <div
          style={{
            padding: '7px 20px',
            background: '#e2e8f0',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          <strong style={{ fontSize: '11px', color: '#475569' }}>
            📂 Documentos ({documentosAuditados.length}):
          </strong>
          {documentosAuditados.map((d, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selecionarPdfLivre(idx)}
              style={{
                width: 'auto',
                padding: '4px 10px',
                fontSize: '10.5px',
                fontWeight: 800,
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border:
                  indicePdfAtivo === idx
                    ? '2px solid #047857'
                    : '1px solid #cbd5e1',
                background: indicePdfAtivo === idx ? '#047857' : '#ffffff',
                color: indicePdfAtivo === idx ? '#ffffff' : '#1e293b',
              }}
            >
              {d.tipo.replace(/_/g, ' ')} — {d.nomeArquivo}
            </button>
          ))}
        </div>
      )}

      {/* CORPO */}
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
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>💸</div>
          <h3 style={{ margin: 0, color: '#0f172a' }}>
            Pronto para Analisar Documentos de Desembolso
          </h3>
          <p style={{ maxWidth: '620px', fontSize: '13px', lineHeight: 1.5 }}>
            Selecione juntos o <b>Anexo-Orçamento</b>, <b>Comprovação Financeira</b>,{' '}
            <b>Laudo de Acompanhamento</b>, <b>GTA</b>, <b>Notas Fiscais</b>,{' '}
            <b>Recibos</b>, <b>Declaração de Recebimento</b> e os <b>VITIs</b> (independente do nome dos arquivos).
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: mostrarPdfLadoALado
              ? '360px 1fr 1.08fr'
              : '390px 1fr',
            gap: '14px',
            padding: '14px 18px',
            overflow: 'hidden',
          }}
        >
          {/* COLUNA 1: SEMÁFORO + RAIO-X FINANCEIRO + CRONOGRAMA DO ORÇAMENTO */}
          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '14px',
                border: '1px solid #cbd5e1',
                borderTop: `6px solid ${
                  semaforo === 'APROVADO'
                    ? '#16a34a'
                    : semaforo === 'ALERTA'
                    ? '#f59e0b'
                    : '#dc2626'
                }`,
              }}
            >
              <div
                style={{
                  fontSize: '14px',
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

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(relatorio.textoResumoS567);
                  alert('📋 Resumo S567 do Desembolso copiado!');
                }}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '8px',
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                📋 Copiar Despacho / Resumo S567
              </button>
            </div>

            {/* RAIO-X DO DESEMBOLSO */}
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
              <strong style={{ color: '#064e3b', fontSize: '12px' }}>
                📊 RAIO-X DO DESEMBOLSO
              </strong>
              <div>
                <b>👤 Cliente:</b> {relatorio.clienteNome || '-'}
              </div>
              <div>
                <b>🪪 CPF:</b> {relatorio.clienteCpf || '-'}
              </div>
              <div>
                <b>🔢 CCB:</b> {relatorio.numeroCcb || '-'} ({relatorio.dataContratacao || '-'})
              </div>
              <div>
                <b>📍 Localidade:</b> {relatorio.imovelEstabelecimento || '-'}
              </div>
              {relatorio.operacaoPainelVinculada && (
                <div style={{ color: '#0369a1', fontWeight: 700 }}>
                  🔗 Painel: OP {relatorio.operacaoPainelVinculada.op || '-'} •{' '}
                  {relatorio.operacaoPainelVinculada.porte} • Proj.:{' '}
                  {relatorio.operacaoPainelVinculada.projetista}
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1' }} />
              <div>
                <b>📑 Total Anexo-Orçamento:</b> R${' '}
                {formatarMoedaBD(relatorio.valorTotalOrcamento)}
              </div>
              <div style={{ color: '#15803d', fontWeight: 800 }}>
                <b>✅ Liberável até {relatorio.mesReferencia}:</b> R${' '}
                {formatarMoedaBD(relatorio.valorLiberavelAteMesRef)}
              </div>
              <div
                style={{
                  color:
                    relatorio.valorBloqueadoFuturo > 0 ? '#b91c1c' : '#64748b',
                  fontWeight: 800,
                }}
              >
                <b>🔒 Bloqueado (Parcelas Futuras):</b> R${' '}
                {formatarMoedaBD(relatorio.valorBloqueadoFuturo)}
              </div>
              <div>
                <b>📋 Comprovação Financeira:</b> R${' '}
                {formatarMoedaBD(relatorio.valorTotalComprovacaoFinanceira)}
              </div>
              <div>
                <b>🧾 Total Notas Fiscais:</b> R${' '}
                {formatarMoedaBD(relatorio.valorTotalNotasFiscais)}
              </div>
              <div>
                <b>💵 Total Recibos:</b> R${' '}
                {formatarMoedaBD(relatorio.valorTotalRecibos)}
              </div>
            </div>

            {/* CHAVES NF-e PARA CONSULTA RÁPIDA NA RECEITA FEDERAL */}
            {relatorio.documentos.some((d) => d.dadosNf?.chaveAcesso) && (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '11px',
                }}
              >
                <strong style={{ color: '#0369a1', fontSize: '11.5px' }}>
                  🔑 CHAVES NF-e (CONFERIR NA RECEITA FEDERAL)
                </strong>
                {relatorio.documentos
                  .filter((d) => d.dadosNf?.chaveAcesso)
                  .map((d, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '6px 8px',
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        NF {d.dadosNf?.numero} — R${' '}
                        {formatarMoedaBD(d.dadosNf?.valorTotal || 0)}
                      </div>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          wordBreak: 'break-all',
                          color: '#334155',
                          margin: '3px 0',
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
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontWeight: 800,
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #7dd3fc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          📋 Copiar Chave
                        </button>
                        <a
                          href="https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#15803d',
                            textDecoration: 'none',
                            padding: '2px 6px',
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

          {/* COLUNA 2: CHECKLIST COMPLETO DE AUDITORIA CRUZADA */}
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
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 900,
                fontSize: '12.5px',
                color: '#064e3b',
              }}
            >
              🔍 AUDITORIA CRUZADA DO DESEMBOLSO ({relatorio.checklist.length} CRIVOS)
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {relatorio.checklist.map((item) => {
                const cor =
                  item.status === 'ERRO'
                    ? '#dc2626'
                    : item.status === 'ALERTA'
                    ? '#f59e0b'
                    : '#16a34a';
                const bg =
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
                      background: bg,
                      border: `1px solid ${cor}`,
                      borderLeft: `5px solid ${cor}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '4px',
                      }}
                    >
                      <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                        {item.titulo}
                      </strong>
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
                                fontWeight: 800,
                                borderRadius: '5px',
                                border: '1px solid #93c5fd',
                                background: '#eff6ff',
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
                      }}
                    >
                      {item.resumo}
                    </div>
                    {item.detalhes.length > 0 && (
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

          {/* COLUNA 3: VISUALIZADOR DE PDF COM BUSCA MULTI-DOCS E GRIFO */}
          {mostrarPdfLadoALado && urlPdfAtivo && arquivoAtivo && (
            <section
              style={{
                background: '#0f172a',
                borderRadius: '10px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #334155',
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  background: '#1e293b',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>
                  📄 {arquivoAtivo.name} (Pág. {paginaPdfAlvo})
                </span>
                <select
                  value={indicePdfAtivo}
                  onChange={(e) => selecionarPdfLivre(Number(e.target.value))}
                  style={{
                    width: 'auto',
                    height: '24px',
                    fontSize: '10.5px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                  }}
                >
                  {arquivos.map((a, idx) => (
                    <option key={idx} value={idx}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* BARRA DE BUSCA + CRUZAR NOS DOCS */}
              <div
                style={{
                  padding: '8px 10px',
                  background: '#064e3b',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
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
                      height: '28px',
                      fontSize: '11.5px',
                      padding: '0 8px',
                      borderRadius: '5px',
                      border: 'none',
                    }}
                  />
                  {termoBuscaPdf && (
                    <button
                      type="button"
                      onClick={() => setTermoBuscaPdf('')}
                      style={{
                        width: 'auto',
                        height: '28px',
                        padding: '0 8px',
                        background: '#334155',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      ✖
                    </button>
                  )}
                  {todasOcorrenciasNoKit.length > 0 && (
                    <>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 900,
                          color: '#fde047',
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
                          height: '26px',
                          padding: '0 7px',
                          background: '#0f172a',
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
                          height: '26px',
                          padding: '0 7px',
                          background: '#0f172a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        ▶
                      </button>
                    </>
                  )}
                </div>

                {resumoPorArquivo.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '9.5px', color: '#a7f3d0', fontWeight: 800 }}>
                      🔀 Cruzar:
                    </span>
                    {resumoPorArquivo.map((r) => (
                      <button
                        key={r.indiceArquivo}
                        type="button"
                        onClick={() => {
                          if (r.total > 0 && r.primeiroIdx !== -1) {
                            navegarOcorrencia(r.primeiroIdx);
                          } else {
                            selecionarPdfLivre(r.indiceArquivo);
                          }
                        }}
                        style={{
                          width: 'auto',
                          padding: '2px 7px',
                          fontSize: '9.5px',
                          fontWeight: 800,
                          borderRadius: '4px',
                          border:
                            r.indiceArquivo === indicePdfAtivo
                              ? '1.5px solid #fde047'
                              : '1px solid #34d399',
                          background:
                            r.total > 0 ? '#065f46' : '#1e293b',
                          color: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        {r.total > 0 ? '✅' : '○'} {r.nomeArquivo} ({r.total})
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
                    }}
                  >
                    {ocorrenciaAtual.trechoAntes}
                    <mark style={{ background: '#fde047', fontWeight: 900 }}>
                      {ocorrenciaAtual.termoEncontrado}
                    </mark>
                    {ocorrenciaAtual.trechoDepois}
                  </div>
                )}
              </div>

              {/* RENDERIZADOR CANVAS C/ GRIFO OU IFRAME NATIVO */}
              {termoBuscaPdf.trim().length >= 2 &&
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
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setZoomCanvas((z) => Math.max(0.8, z - 0.15))}
                      style={{ width: 'auto', padding: '2px 8px', fontSize: '10px' }}
                    >
                      ➖
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomCanvas((z) => Math.min(2.2, z + 0.15))}
                      style={{ width: 'auto', padding: '2px 8px', fontSize: '10px' }}
                    >
                      ➕
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoDestaqueCanvas(false)}
                      style={{ width: 'auto', padding: '2px 8px', fontSize: '10px' }}
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
          )}
        </div>
      )}
    </div>,
    document.body
  );
}