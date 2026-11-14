'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RegistroContratacao } from '@/types/painel';
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
} from '@/lib/auditorConformidadeContratos';

interface TelaConformidadeContratosProps {
  aberto: boolean;
  onFechar: () => void;
  contratacoes: RegistroContratacao[];
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
  // -1 = Visão Global Consolidada de Sintonia do Kit (5 Docs) | >= 0 = Documento individual
  const [indiceAtivo, setIndiceAtivo] = useState<number>(0);
  const [indicePdfVisualizando, setIndicePdfVisualizando] = useState<number>(0);
  const [auditando, setAuditando] = useState(false);
  const [progressoMsg, setProgressoMsg] = useState('');
  const [mostrarPdfLadoALado, setMostrarPdfLadoALado] = useState(true);
  const [urlPdfAtivo, setUrlPdfAtivo] = useState<string | null>(null);
  const [chaveCopiada, setChaveCopiada] = useState('');

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

  // Atualiza automaticamente o texto do Script do Copilot quando o usuário muda o tipo de documento marcado no modal
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

  // Cancela imediatamente o OCR em andamento (terminando o Web Worker do Tesseract em 0ms!)
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

  // Limpa toda a consulta atual (arquivos PDF, Raio-X, Checklist, Leitor Lateral e Copilot) sem precisar dar F5
  const limparConsultaConformidade = async () => {
    if (controleCancelamentoOcrRef.current) {
      await cancelarLeituraOcrImediatamente('ABORTAR_TUDO');
    }
    setArquivosContratos([]);
    setResultados([]);
    setDossieKitDerivada(null);
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
          (r) => r.tipoInstrumento === 'CCB_DERIVADA'
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
          '⚠️ Nenhum arquivo de Contrato/CCB/Anexo/CET foi encontrado nessa pasta. Selecione os PDFs diretamente!'
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
      alert('⚠️ Cole a resposta gerada pelo Copilot no campo abaixo antes de importar!');
      return;
    }

    // Se ainda não havia nenhum PDF carregado na tela, cria um registro base a partir da resposta do Copilot!
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
        taxaJurosAnual: '0,5% a.a.',
        taxaJurosAnualNum: 0.5,
        taxaJurosMensal: '0,0416% a.m.',
        taxaJurosMensalNum: 0.0416,
        cetAnual: '0,50%',
        cetAnualNum: 0.5,
        cetMensal: '0,0416%',
        cetMensalNum: 0.0416,
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

    // Se for o Kit Completo de 5 Docs, propaga os dados comuns (Nº CCB, Cliente, CPF, Local, Valor, Taxas) e específicos (Orçamento, CET, Reembolso)
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
              Suporta <b>Contratos de Limite (LCGA/LCGH)</b> e{' '}
              <b>Kit Completo de Operações Derivadas (CCB + Orçamento + Disposições + CET + Anexo CET)</b>.
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
              🚜 2. Operações Derivadas (Kit 5 Docs)
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
            title="Busca automaticamente todos os PDFs de CCB, Orçamento, Disposições, CET, Anexo CET ou LCGA/LCGH na pasta"
          >
            📂 Buscar na Pasta
          </button>

          {/* BOTÃO SÊNIOR DE SCRIPT DO COPILOT SEMPRE DISPONÍVEL NO TOPO */}
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
            title="Gera o Script cirúrgico para o Copilot analisar o documento marcado e importar a resposta de volta"
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
              title="Interrompe o OCR imediatamente sem travar a tela"
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
              🌟 Visão Global de Sintonia do Kit ({resultados.length}/5 Docs)
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
                🔎 {r.tipoInstrumento.replace('_', ' ')} ({r.nomeArquivo})
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

          {/* BOTÕES DE CANCELAMENTO IMEDIATO DO OCR NA TELA DE CARREGAMENTO */}
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
            Pronto para Auditar Contratos de Limite (LCGA/LCGH) ou Kit de
            Operações Derivadas (5 Docs)
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
            <b>
              5 PDFs da Operação Derivada (CCB, Anexo-Orçamento, Disposições
              Gerais, CET e Anexo CET)
            </b>{' '}
            ou clique em <b>&ldquo;🤖 Script Copilot&rdquo;</b> para gerar o
            prompt de auditoria para qualquer documento!
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: mostrarPdfLadoALado
              ? '390px 1fr 1.05fr'
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
                    ? 'Sintonia Global do Kit (5 Docs)'
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
                    ? 'KIT CCB + ORÇAMENTO + DISPOSIÇÕES + CET'
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
                },
                {
                  id: 'rodape_int',
                  label: '🛡️ Rodapé "Doc. Interno"',
                  valor: resultadoAtivo.possuiRodapeDocumentoInterno
                    ? `🚨 DETECTADO (${resultadoAtivo.trechoRodapeInternoDetectado}) — REMOVER!`
                    : '✅ Limpo (Sem rodapé interno)',
                },
                {
                  id: 'val',
                  label: '💰 Valor Contratado',
                  valor: resultadoAtivo.valorClausulaPrimeira
                    ? `R$ ${resultadoAtivo.valorClausulaPrimeira}`
                    : '',
                  copy: resultadoAtivo.valorClausulaPrimeira,
                },
                ...(resultadoAtivo.valorJurosTotaisCet
                  ? [
                      {
                        id: 'juros_tot',
                        label: '📈 Juros Totais / A Pagar',
                        valor: `Juros R$ ${resultadoAtivo.valorJurosTotaisCet} (Total: R$ ${resultadoAtivo.valorTotalAPagarCet})`,
                      },
                    ]
                  : []),
                {
                  id: 'taxas',
                  label: '📊 Juros / CET / Bônus',
                  valor: `${resultadoAtivo.taxaJurosAnual} (${resultadoAtivo.taxaJurosMensal}) • CET: ${resultadoAtivo.cetAnual}${
                    resultadoAtivo.bonusAdimplenciaPerc
                      ? ` • Bônus: ${resultadoAtivo.bonusAdimplenciaPerc}`
                      : ''
                  }`,
                },
                {
                  id: 'dt_contr',
                  label: '📅 Data Contratação',
                  valor:
                    resultadoAtivo.dataCelebracaoCabecalho ||
                    resultadoAtivo.dataCelebracaoFechoAssinatura,
                },
                ...(resultadoAtivo.dataPrimeiraParcelaPrincipal
                  ? [
                      {
                        id: 'dt_1parc',
                        label: '🗓️ 1ª Parcela Principal',
                        valor: `${resultadoAtivo.dataPrimeiraParcelaPrincipal} (Carência: ${resultadoAtivo.carenciaAnosCalculada})`,
                        copy: resultadoAtivo.dataPrimeiraParcelaPrincipal,
                      },
                    ]
                  : []),
                {
                  id: 'dt_venc',
                  label: '⏳ Vencimento Final',
                  valor: `${resultadoAtivo.dataVencimento} (${resultadoAtivo.prazoAnosCalculado} / ${resultadoAtivo.prazoMesesCalculado}m)`,
                  copy: resultadoAtivo.dataVencimento,
                },
                {
                  id: 'cred',
                  label: '👤 Emitente / Creditado',
                  valor: resultadoAtivo.creditadoNome,
                },
                {
                  id: 'cpf_cred',
                  label: '🪪 CPF Emitente',
                  valor: resultadoAtivo.creditadoCpf,
                },
                {
                  id: 'rg_cred',
                  label: '🪪 RG / Emissão',
                  valor: `${resultadoAtivo.creditadoRg} (${resultadoAtivo.creditadoRgDataEmissao})`,
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
                      },
                      {
                        id: 'lcg_uso',
                        label: '📐 Uso / Suficiência LCG',
                        valor: `${resultadoAtivo.percentualUtilizacaoLimiteLcg} (Exige R$ ${resultadoAtivo.valorExigidoNoLimiteLcg} do limite)`,
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
                      },
                    ]
                  : []),
                ...(resultadoAtivo.possuiAvalista
                  ? [
                      {
                        id: 'aval_nome',
                        label: '🛡️ Avalista (Garantia)',
                        valor: resultadoAtivo.avalistaNome,
                      },
                      {
                        id: 'aval_cpf',
                        label: '🪪 CPF / RG Avalista',
                        valor: `${resultadoAtivo.avalistaCpf} • RG: ${resultadoAtivo.avalistaRg} (${resultadoAtivo.avalistaRgDataEmissao})`,
                        copy: resultadoAtivo.avalistaCpf,
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
                      },
                    ]
                  : []),
                ...(resultadoAtivo.conjugeNome
                  ? [
                      {
                        id: 'conj',
                        label: '👥 Cônjuge / Outorgante',
                        valor: resultadoAtivo.conjugeNome,
                      },
                      {
                        id: 'cpf_conj',
                        label: '🪪 CPF Cônjuge',
                        valor: resultadoAtivo.conjugeCpf,
                      },
                    ]
                  : []),
                ...(resultadoAtivo.imoveisGarantia[0]
                  ? [
                      {
                        id: 'imovel',
                        label: '🏡 Imóvel da Garantia',
                        valor: `${resultadoAtivo.imoveisGarantia[0].denominacao} (${resultadoAtivo.imoveisGarantia[0].areaHa})`,
                      },
                      {
                        id: 'mat',
                        label: '📜 Matrícula / Registro',
                        valor: `Nº ${resultadoAtivo.imoveisGarantia[0].registroMatricula} (${resultadoAtivo.imoveisGarantia[0].livro})`,
                        copy: resultadoAtivo.imoveisGarantia[0].registroMatricula,
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
                        color: chaveCopiada === row.id ? '#15803d' : '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {chaveCopiada === row.id ? '✔' : '📋'}
                    </button>
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

          {/* COLUNA 2: CHECKLIST DETALHADO DE AUDITORIA E SINTONIA */}
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
                        fontSize: '12px',
                        fontWeight: 900,
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      {item.titulo}
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

          {/* COLUNA 3: VISUALIZADOR DO PDF LADO A LADO */}
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
                  padding: '8px 14px',
                  background: '#1e293b',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>📄 Visualizando: {arquivoAtivo.name}</span>
                <a
                  href={urlPdfAtivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontSize: '11px',
                  }}
                >
                  ↗️ Abrir em Nova Guia
                </a>
              </div>
              <iframe
                src={urlPdfAtivo}
                title={arquivoAtivo.name}
                style={{
                  flex: 1,
                  width: '100%',
                  border: 'none',
                  background: '#334155',
                }}
              />
            </section>
          )}
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
            {/* Cabeçalho do Modal Copilot */}
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
              {/* 1. SELETOR DE QUAL DOCUMENTO O USUÁRIO QUER ANALISAR NO COPILOT */}
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
                          '🌟 Kit Completo Derivada (5 Docs: CCB + Orçamento + Disp. + CET + Anexo CET)',
                      },
                      {
                        id: 'CCB_DERIVADA',
                        label: '📄 Somente CCB (Cédula de Crédito Bancário)',
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

              {/* 2. CAIXA DO SCRIPT GERADO PARA COPIAR */}
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

              {/* 3. CAIXA PARA COLAR A RESPOSTA DO COPILOT E ATUALIZAR A CONFORMIDADE */}
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