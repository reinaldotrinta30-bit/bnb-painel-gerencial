'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, } from 'react';
import {
  CardKanban,
  EtapaKanban,
  StatusCorKanban,
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
} from '@/types/painel';
import {
  getHojeISO,
  getHojeBR,
  LISTA_PROJETISTAS_CURTOS,
  obterListaProgramas,
  isEnquadradoCadaVezMelhor,
  buscarTelefoneProjetista,
  mascaraDocumento,
  mascaraMoedaInput,
  aplicarMascaraCPF,
  aplicarMascaraMoedaInput,
  aplicarMascaraDataBR,
  classificarCategoriaPorte,
  htmlKanbanParaTextoLimpo,
} from '@/lib/utils';
import {
  mapearEtapaKanbanParaSituacaoContratacao,
  extrairCamposLivresDoTextoKanban,
  extrairCamposLivresDoHtmlKanban,
  exportarKanbanParaPDFExecutivo,
  OpcoesFiltroExportacaoPDF,
} from '@/lib/integradorSincronizado';

interface ModuloKanbanProps {
  cards: CardKanban[];
  contratacoes?: RegistroContratacao[];
  operacoesBase?: OperacaoBaseDesembolso[];
  eventos?: EventoDesembolso[];
  onAtualizarContratacoes?: (novos: RegistroContratacao[]) => void;
  onRegistroContratacaoSalvo?: (
    regSalvo: RegistroContratacao,
    todas: RegistroContratacao[]
  ) => void;
  onAtualizarOperacoesBase?: (novas: OperacaoBaseDesembolso[]) => void;
  onAtualizarEventos?: (novos: EventoDesembolso[]) => void;
  onEventoDesembolsoSalvo?: (
    evSalvo: EventoDesembolso,
    opBase?: OperacaoBaseDesembolso
  ) => void;
  onAtualizarCards: (novos: CardKanban[]) => void;
  onCardSincronizadoAlterado?: (
    cardAtualizado: CardKanban,
    todosOsCards: CardKanban[]
  ) => void;
  onAlterarSituacaoDesembolsoPeloKanban?: (
    card: CardKanban,
    novaSituacaoDesembolso: string
  ) => void;
  onInlineEditCabecalho?: (
    card: CardKanban,
    updates: {
      cliente: string;
      cpf: string;
      porte: string;
      projetista: string;
      avalistaNome?: string;
      avalistaCpf?: string;
      operacoesEditadas: Array<{ opId?: string; tipo: string; valor: string; programa?: string }>;
    }
  ) => void;
  onCriarClientePeloKanban?: (
    opPrincipal: RegistroContratacao,
    opLimiteOpcional?: RegistroContratacao,
    etapaForcada?: EtapaKanban
  ) => void;
  onSincronizarBaseCompleta?: () => void;
  cardDestaqueExternoId?: string | null;
  onLimparDestaqueExterno?: () => void;
  onAbrirClienteEmContratacoes?: (card: CardKanban) => void;
  onAbrirClienteEmDesembolsos?: (card: CardKanban) => void;
}

const ORDEM_ETAPAS: EtapaKanban[] = [
  'NOTAS',
  'CADASTROS',
  'PCE',
  'S522',
  'CONTRATOS',
  'DESEMBOLSOS',
  'ACOMPANHAMENTO',
];

const NOMES_AMIGAVEIS: Record<EtapaKanban, string> = {
  NOTAS: '📌 Lembretes',
  CADASTROS: 'Cadastros',
  PCE: 'PCE Crédito',
  S522: 'S522 Central',
  CONTRATOS: 'Contratos',
  DESEMBOLSOS: 'Desembolsos',
  ACOMPANHAMENTO: 'Acompanham.',
};

const TITULOS_COLUNAS: Record<
  EtapaKanban,
  { titulo: string; corTopo: string; corBotao: string }
> = {
  NOTAS: { titulo: '📌 NOTAS / LEMBRETES', corTopo: '#455a64', corBotao: '#607d8b' },
  CADASTROS: { titulo: '📂 CADASTROS', corTopo: '#607d8b', corBotao: '#607d8b' },
  PCE: { titulo: '⚡ PCE (SOLICITAÇÕES)', corTopo: '#e65100', corBotao: '#e65100' },
  S522: { titulo: '🏛️ S522 / CENTRAL', corTopo: '#1a73e8', corBotao: '#1a73e8' },
  CONTRATOS: { titulo: '📝 CONTRATOS / RENOVAÇÕES', corTopo: '#9c27b0', corBotao: '#9c27b0' },
  DESEMBOLSOS: { titulo: '💸 DESEMBOLSOS', corTopo: '#7a1231', corBotao: '#7a1231' },
  ACOMPANHAMENTO: { titulo: '📈 ACOMPANHAMENTO', corTopo: '#137333', corBotao: '#137333' },
};

function extrairTextoPuro(html: string): string {
  if (typeof document === 'undefined') return html || '';
  const temp = document.createElement('div');
  temp.innerHTML = html || '';
  return temp.innerText || temp.textContent || '';
}

function ordenarCardsPorPeso(lista: CardKanban[]): CardKanban[] {
  const pesoCor: Record<string, number> = {
    azul: 5,
    vermelho: 4,
    amarelo: 3,
    verde: 2,
    roxo: 1,
  };
  return [...lista].sort((a, b) => {
    const pesoA = a.isNovo ? 5 : pesoCor[a.statusCor] || 0;
    const pesoB = b.isNovo ? 5 : pesoCor[b.statusCor] || 0;
    if (pesoA !== pesoB) return pesoB - pesoA;
    return 0;
  });
}

export default function ModuloKanban({
  cards,
  contratacoes = [],
  operacoesBase = [],
  eventos = [],
  onAtualizarContratacoes,
  onRegistroContratacaoSalvo,
  onAtualizarOperacoesBase,
  onAtualizarEventos,
  onEventoDesembolsoSalvo,
  onAtualizarCards,
  onCardSincronizadoAlterado,
  onCriarClientePeloKanban,
  onSincronizarBaseCompleta,
  cardDestaqueExternoId,
  onLimparDestaqueExterno,
  onAbrirClienteEmContratacoes,
  onAbrirClienteEmDesembolsos,
  onAlterarSituacaoDesembolsoPeloKanban,
  onInlineEditCabecalho,
}: ModuloKanbanProps) {
  const [termoBusca, setTermoBusca] = useState('');
  const [incluirArquivadosNaBusca, setIncluirArquivadosNaBusca] = useState(false);
  const [filtroCor, setFiltroCor] = useState<'TODOS' | StatusCorKanban>('TODOS');
  const [filtroEtapa, setFiltroEtapa] = useState<'TODOS' | 'ARQUIVADOS' | EtapaKanban>('TODOS');

  // ITEM 6.1: Filtro de Múltipla Seleção por Porte no Kanban (Inicia com todos selecionados)
  const TODOS_PORTES_KANBAN = ['PRONAF V', 'PRONAF A', 'MINI', 'OUTROS'];
  const [filtroPortesKanban, setFiltroPortesKanban] = useState<string[]>([
    'PRONAF V',
    'PRONAF A',
    'MINI',
    'OUTROS',
  ]);
  const [menuFiltroPorteAberto, setMenuFiltroPorteAberto] = useState(false);

  // Estados do Modal de Configuração e Filtros do PDF (Itens 5, 6 e 7)
  const [modalPdfAberto, setModalPdfAberto] = useState(false);
  const [pdfEtapas, setPdfEtapas] = useState<EtapaKanban[]>([
    'CADASTROS',
    'PCE',
    'S522',
    'CONTRATOS',
    'DESEMBOLSOS',
    'ACOMPANHAMENTO',
  ]);
  const [pdfPortes, setPdfPortes] = useState<string[]>([
    'MINI',
    'PRONAF V',
    'PRONAF A',
    'GERAL / OUTROS',
  ]);
  const [pdfPrioridades, setPdfPrioridades] = useState<StatusCorKanban[]>([
    'azul',
    'vermelho',
    'amarelo',
    'verde',
  ]);
  const [pdfIncluirArquivados, setPdfIncluirArquivados] = useState(false);
  const [pdfFiltroTipoOp, setPdfFiltroTipoOp] = useState<
    OpcoesFiltroExportacaoPDF['filtroTipoOperacao']
  >('TODOS');
  const [pdfProjetistasSel, setPdfProjetistasSel] = useState<string[]>([]);
  const [pdfLayout, setPdfLayout] = useState<
    'QUADRINHOS' | 'LISTAGEM' | 'DIDATICA_ROBUSTA'
  >('QUADRINHOS');
  const [notasMinimizadas, setNotasMinimizadas] = useState(false);

  const [menuFiltroCorAberto, setMenuFiltroCorAberto] = useState(false);
  const [menuCorCardAbertoId, setMenuCorCardAbertoId] = useState<string | null>(null);

  const [cardFullscreenId, setCardFullscreenId] = useState<string | null>(null);
  const [termoBuscaInterna, setTermoBuscaInterna] = useState('');
  const [buscaInternaStatus, setBuscaInternaStatus] = useState<'neutro' | 'achou' | 'erro'>('neutro');

  const [modalLembreteCardId, setModalLembreteCardId] = useState<string | null>(null);
  const [lembreteDataInput, setLembreteDataInput] = useState('');
  const [lembreteHoraInput, setLembreteHoraInput] = useState('');

  // Modal de Edição Sincronizada de Card Existente
  const [cardEditSync, setCardEditSync] = useState<CardKanban | null>(null);
  const [syncSitInput, setSyncSitInput] = useState('');
  const [syncSitDetalhadaInput, setSyncSitDetalhadaInput] = useState('');
  const [syncValorInput, setSyncValorInput] = useState('');
  const [syncObsInput, setSyncObsInput] = useState('');

  // Modal de Criação de Novo Cliente/Operação a partir do "+" das Colunas do Kanban (Regra 4)
  const [modalNovoClienteEtapa, setModalNovoClienteEtapa] = useState<EtapaKanban | null>(null);
  const [ncPorte, setNcPorte] = useState('');
  const [ncCliente, setNcCliente] = useState('');
  const [ncCpf, setNcCpf] = useState('');
  const [ncValor, setNcValor] = useState('');
  const [ncTipo, setNcTipo] = useState('Investimento');
  const [ncSituacao, setNcSituacao] = useState('Na Agência');
  const [ncSitDetalhada, setNcSitDetalhada] = useState('');
  const [ncProjetista, setNcProjetista] = useState('');
  const [ncResponsavel, setNcResponsavel] = useState('');
  const [ncData, setNcData] = useState('');
  const [ncTelefone, setNcTelefone] = useState('');
  const [ncObs, setNcObs] = useState('');
  const [ncPrograma, setNcPrograma] = useState('');
  const listaProgramas = useMemo(() => obterListaProgramas(), []);
  const [ncTipoGarantia, setNcTipoGarantia] = useState<'NENHUMA' | 'AVAL' | 'LCGH' | 'LCGA'>('NENHUMA');
  const [ncAvalistaNome, setNcAvalistaNome] = useState('');
  const [ncAvalistaCpf, setNcAvalistaCpf] = useState('');
  const [ncLcgValor, setNcLcgValor] = useState('');
  const [ncLcgSituacao, setNcLcgSituacao] = useState('');
  const [ncCriarLinhaLcgSeparada, setNcCriarLinhaLcgSeparada] = useState(true);

  const [cardPulsandoId, setCardPulsandoId] = useState<string | null>(null);

  const [historico, setHistorico] = useState<string[]>([]);
  const [ponteiroHist, setPonteiroHist] = useState(-1);

  // ITEM 5: Só permite arrastar o card se o mouse foi pressionado especificamente no cabeçalho (.card-drag-handle)
  const [dragHabilitadoId, setDragHabilitadoId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    cardId: string;
    pos: 'top' | 'bottom';
  } | null>(null);

  const execFormat = useCallback((comando: string, valor?: string) => {
  document.execCommand(comando, false, valor);
}, []);

const aplicarHighlight = useCallback((cor: string) => {
  document.execCommand('hiliteColor', false, cor);
}, []);

  // ITEM 10: Gerador de mensagem estilizada para WhatsApp / Área de Transferência
  const gerarMensagemCobrancaWhatsApp = (card: CardKanban): string => {
    const puro = card.textoPuro || extrairTextoPuro(card.texto);
    const extraidos = extrairCamposLivresDoTextoKanban(puro);
    const clienteNome = card.clienteVinculado || 'Cliente';
    const cpfTxt = card.cpfVinculado ? ` (CPF: ${card.cpfVinculado})` : '';
    const tipoTxt = card.tipoOpVinculado || 'Proposta Rural';
    const valorTxt = card.valorVinculado ? ` - R$ ${card.valorVinculado}` : '';

    const sitTxt =
      extraidos.situacaoDetalhada ||
      card.situacaoDetalhadaVinculada ||
      `- ${card.situacaoVinculada || 'Em análise'}`;
    const pendTxt =
      extraidos.pendenciasObs ||
      card.obsVinculada ||
      'Verificar andamento.';

    return (
      `🏦 *ACOMPANHAMENTO DE PROPOSTA - BNB*\n\n` +
      `👤 *Cliente:* ${clienteNome}${cpfTxt}\n` +
      `🚜 *Operação:* ${tipoTxt}${valorTxt}\n\n` +
      `📊 *SITUAÇÃO ATUAL:*\n${sitTxt}\n\n` +
      `📝 *PENDÊNCIAS / OBSERVAÇÕES:*\n${pendTxt}`
    );
  };

  const copiarMensagemCobranca = (card: CardKanban) => {
    const msg = gerarMensagemCobrancaWhatsApp(card);
    navigator.clipboard.writeText(msg);
    alert('📋 Mensagem de situação/pendências copiada para a área de transferência!');
  };

  const enviarWhatsAppCobranca = (card: CardKanban) => {
    const msg = gerarMensagemCobrancaWhatsApp(card);
    const puro = card.textoPuro || extrairTextoPuro(card.texto);
    const matchProj = puro.match(/PROJETISTA:\s*([^\n]+)/i);
    const nomeProj = matchProj && matchProj[1] ? matchProj[1].trim() : '';
    const fone = buscarTelefoneProjetista(nomeProj);

    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const carouselRef = useRef<HTMLDivElement>(null);

  // ITEM 4.1: Quando vem pelo atalho da Lupinha, rola até a coluna e já ABRE A NOTA MAXIMIZADA (Modo Foco)!
  useEffect(() => {
    if (!cardDestaqueExternoId) return;
    const cardAlvo = cards.find((c) => c.id === cardDestaqueExternoId);
    if (!cardAlvo) {
      onLimparDestaqueExterno?.();
      return;
    }

    setFiltroEtapa('TODOS');
    setFiltroCor('TODOS');
    setTermoBusca('');

    setTimeout(() => {
      const colEl = document.getElementById(`col_${cardAlvo.etapa}`);
      if (carouselRef.current && colEl) {
        carouselRef.current.scrollTo({
          left: colEl.offsetLeft - 20,
          behavior: 'smooth',
        });
      }
      // Abre imediatamente o Card em Modo Foco (Maximizado / Expandido)
      setCardFullscreenId(cardAlvo.id);
      onLimparDestaqueExterno?.();
    }, 120);
  }, [cardDestaqueExternoId, cards, onLimparDestaqueExterno]);

  // ITEM 2: Motor de Histórico (Desfazer / Refazer) 100% Sincronizado e Imune a Closure Stale
  const histRef = useRef<{ snaps: string[]; ptr: number }>({
    snaps: [],
    ptr: -1,
  });

  // Inicializa o histórico assim que os cards reais são carregados pela primeira vez
  useEffect(() => {
    if (histRef.current.snaps.length === 0 && cards.length > 0) {
      const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
      const agora = Date.now();
      let expurgou = false;

      const limpos = cards.filter((c) => {
        if (c.etapa === 'NOTAS' && c.statusCor === 'verde' && c.dataConclusaoNota) {
          if (agora - c.dataConclusaoNota >= trintaDiasMs) {
            expurgou = true;
            return false;
          }
        }
        return true;
      });

      if (expurgou) {
        onAtualizarCards(limpos);
      }

      const snapInicial = JSON.stringify(limpos);
      histRef.current = { snaps: [snapInicial], ptr: 0 };
      setHistorico([snapInicial]);
      setPonteiroHist(0);
    }
  }, [cards, onAtualizarCards]);

  const salvarComHistorico = useCallback(
    (novaLista: CardKanban[], pularHistorico = false, cardParaPropagar?: CardKanban) => {
      const ordenada = ordenarCardsPorPeso(novaLista);
      if (cardParaPropagar && onCardSincronizadoAlterado) {
        onCardSincronizadoAlterado(cardParaPropagar, ordenada);
      } else {
        onAtualizarCards(ordenada);
      }

      if (!pularHistorico) {
        const snap = JSON.stringify(ordenada);
        const { snaps, ptr } = histRef.current;
        const cortado = snaps.slice(0, ptr + 1);
        if (cortado[cortado.length - 1] !== snap) {
          const novo = [...cortado, snap];
          if (novo.length > 50) novo.shift();
          const novoPtr = novo.length - 1;
          histRef.current = { snaps: novo, ptr: novoPtr };
          setHistorico(novo);
          setPonteiroHist(novoPtr);
        }
      }
    },
    [onAtualizarCards, onCardSincronizadoAlterado]
  );

  const desfazer = useCallback(() => {
    const { snaps, ptr } = histRef.current;
    if (ptr > 0) {
      const novoPonteiro = ptr - 1;
      const restaurado = JSON.parse(snaps[novoPonteiro]) as CardKanban[];
      histRef.current.ptr = novoPonteiro;
      setPonteiroHist(novoPonteiro);
      onAtualizarCards(restaurado);
    }
  }, [onAtualizarCards]);

  const refazer = useCallback(() => {
    const { snaps, ptr } = histRef.current;
    if (ptr < snaps.length - 1) {
      const novoPonteiro = ptr + 1;
      const restaurado = JSON.parse(snaps[novoPonteiro]) as CardKanban[];
      histRef.current.ptr = novoPonteiro;
      setPonteiroHist(novoPonteiro);
      onAtualizarCards(restaurado);
    }
  }, [onAtualizarCards]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const foco = document.activeElement as HTMLElement | null;
      if (foco && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' || foco.isContentEditable))
        return;

      if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if (
        e.ctrlKey &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        refazer();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desfazer, refazer]);

  useEffect(() => {
    function fecharMenus() {
      setMenuFiltroCorAberto(false);
      setMenuCorCardAbertoId(null);
      setMenuFiltroPorteAberto(false);
    }
    window.addEventListener('click', fecharMenus);
    return () => window.removeEventListener('click', fecharMenus);
  }, []);

  // =========================================================================
  // REGRA 3 E 4: CLIQUE NO BOTÃO "+" DAS COLUNAS
  // =========================================================================
  const handleClicarBotaoMaisColuna = (etapaAlvo: EtapaKanban) => {
    // Regra 3: Na coluna 📌 NOTAS / LEMBRETES, cria card livre imediatamente
    if (etapaAlvo === 'NOTAS') {
      const novoCard: CardKanban = {
        id: 'wk_' + Date.now(),
        etapa: 'NOTAS',
        statusCor: 'amarelo',
        texto: '',
        textoPuro: '',
        dataModificacao: getHojeISO(),
        isNovo: true,
      };
      const novaLista = [novoCard, ...cards];
      salvarComHistorico(novaLista);
      setTimeout(() => {
        const el = document
          .getElementById(novoCard.id)
          ?.querySelector('.card-editor') as HTMLElement | null;
        el?.focus();
      }, 80);
      return;
    }

    // Regra 4: Nas demais colunas, abre o Modal de Cadastro Completo de Cliente/Operação
    setNcPorte('');
    setNcCliente('');
    setNcCpf('');
    setNcValor('');
    setNcTipo(etapaAlvo === 'CONTRATOS' ? 'Renovação - Custeio' : 'Investimento');
    setNcSituacao(
      mapearEtapaKanbanParaSituacaoContratacao(etapaAlvo, 'azul', 'Na Agência')
    );
    setNcSitDetalhada('');
    setNcProjetista('');
    setNcResponsavel('');
    setNcData(getHojeBR());
    setNcTelefone('');
    setNcObs('');
    setNcPrograma('');
    setNcTipoGarantia('NENHUMA');
    setNcAvalistaNome('');
    setNcAvalistaCpf('');
    setNcLcgValor('');
    setNcLcgSituacao('');
    setNcCriarLinhaLcgSeparada(true);
    setModalNovoClienteEtapa(etapaAlvo);
  };

  const confirmarCriacaoClientePeloKanban = () => {
    if (!ncCliente.trim() || !ncValor.trim() || !modalNovoClienteEtapa) {
      alert('Preencha ao menos o Nome do Cliente e o Valor da Proposta!');
      return;
    }

    const cpfDigitadoLimpo = ncCpf.replace(/\D/g, '');
    const nomeDigitadoUpper = ncCliente.toUpperCase().trim();

    // ITEM 4: Verifica se este cliente JÁ possui um Card ativo no Kanban (pelo CPF ou pelo Nome exato)
    const cardJaExistente = cards.find((c) => {
      if (c.etapa === 'NOTAS') return false;
      const cpfCardLimpo = (c.cpfVinculado || '').replace(/\D/g, '');
      if (cpfDigitadoLimpo.length === 11 && cpfCardLimpo === cpfDigitadoLimpo) {
        return true;
      }
      const nomeCardUpper = (c.clienteVinculado || '').toUpperCase().trim();
      if (nomeCardUpper && nomeCardUpper === nomeDigitadoUpper) {
        return true;
      }
      return false;
    });

    if (cardJaExistente) {
      const nomeColunaExistente =
        TITULOS_COLUNAS[cardJaExistente.etapa]?.titulo || cardJaExistente.etapa;

      alert(
        `⚠️ ATENÇÃO: O cliente "${nomeDigitadoUpper}" já possui um Kanban ativo na coluna [${nomeColunaExistente}]!\n\n` +
          `Você será redirecionado agora mesmo para a nota existente deste cliente para realizar a edição ou adicionar a nova operação.`
      );

      setModalNovoClienteEtapa(null);

      // Se estava arquivado, abre a guia de arquivados; senão, mostra todas e foca/maximiza o card do cliente!
      if (cardJaExistente.statusCor === 'roxo') {
        setFiltroEtapa('ARQUIVADOS');
      } else {
        setFiltroEtapa('TODOS');
      }
      setFiltroCor('TODOS');
      setTermoBusca('');

      setTimeout(() => {
        const colEl = document.getElementById(`col_${cardJaExistente.etapa}`);
        if (carouselRef.current && colEl) {
          carouselRef.current.scrollTo({
            left: colEl.offsetLeft - 20,
            behavior: 'smooth',
          });
        }
        setCardFullscreenId(cardJaExistente.id);
      }, 150);

      return;
    }

    const isPronafA = ncPorte.toUpperCase().trim() === 'PRONAF A';
    const agora = Date.now();

    const opPrincipal: RegistroContratacao = {
      id: String(agora),
      porte: ncPorte || 'PRONAF V',
      cliente: nomeDigitadoUpper,
      cpf: ncCpf,
      valor: ncValor,
      tipo: ncTipo || 'Investimento',
      situacao: ncSituacao || 'Na Agência',
      situacaoDetalhada:
        ncSitDetalhada.trim() || `- ${ncSituacao || 'Na Agência'}`,
      projetista: ncProjetista.toUpperCase().trim(),
      responsavel: ncResponsavel.toUpperCase().trim(),
      telefone: ncTelefone,
      data: ncData || getHojeBR(),
      obs: ncObs,
      programa: ncPrograma.toUpperCase().trim(),
      cadaVezMelhor:
        ncPorte.includes('PRONAF') && isEnquadradoCadaVezMelhor(ncPrograma),
      tipoGarantiaKanban: isPronafA ? 'NENHUMA' : ncTipoGarantia,
      avalistaNome:
        !isPronafA && ncTipoGarantia === 'AVAL'
          ? ncAvalistaNome.toUpperCase().trim()
          : undefined,
      avalistaCpf:
        !isPronafA && ncTipoGarantia === 'AVAL' ? ncAvalistaCpf : undefined,
      lcgValor:
        !isPronafA && (ncTipoGarantia === 'LCGH' || ncTipoGarantia === 'LCGA')
          ? ncLcgValor
          : undefined,
      lcgSituacao:
        !isPronafA && (ncTipoGarantia === 'LCGH' || ncTipoGarantia === 'LCGA')
          ? ncLcgSituacao
          : undefined,
    };

    // O page.tsx (garantirProcessoLimiteNaLista) cuidará automaticamente de criar/verificar o limite LCGH/LCGA pelo valor!
    onCriarClientePeloKanban?.(opPrincipal, undefined, modalNovoClienteEtapa);
    setModalNovoClienteEtapa(null);
  };

  const excluirCard = (cardId: string) => {
    if (confirm('Deseja remover esta nota do Kanban?')) {
      if (cardFullscreenId === cardId) setCardFullscreenId(null);
      salvarComHistorico(cards.filter((c) => c.id !== cardId));
    }
  };

  const mudarCorStatusCard = (cardId: string, novaCor: StatusCorKanban) => {
    const hoje = getHojeISO();
    const novaLista: CardKanban[] = [];
    let cardPropagar: CardKanban | undefined;

    cards.forEach((c) => {
      if (c.id !== cardId) {
        novaLista.push(c);
        return;
      }

      const cardAtualizado: CardKanban = { ...c };
      if (cardAtualizado.statusCor !== novaCor) {
        cardAtualizado.dataModificacao = hoje;
      }
      delete cardAtualizado.isNovo;

      if (cardAtualizado.etapa === 'NOTAS') {
        cardAtualizado.statusCor = novaCor;
        if (novaCor === 'verde') {
          cardAtualizado.dataConclusaoNota = Date.now();
        } else {
          delete cardAtualizado.dataConclusaoNota;
        }
        novaLista.push(cardAtualizado);
      } else {
        cardAtualizado.statusCor = novaCor;
        if (novaCor === 'verde') {
          const idxAtual = ORDEM_ETAPAS.indexOf(cardAtualizado.etapa);
          if (idxAtual !== -1 && idxAtual < ORDEM_ETAPAS.length - 1) {
            cardAtualizado.etapa = ORDEM_ETAPAS[idxAtual + 1];
            cardAtualizado.statusCor = 'amarelo';
            if (cardAtualizado.propostaIdVinculada) {
              cardAtualizado.situacaoVinculada = mapearEtapaKanbanParaSituacaoContratacao(
                cardAtualizado.etapa,
                cardAtualizado.statusCor,
                cardAtualizado.situacaoVinculada
              );
              cardPropagar = cardAtualizado;
            }
            novaLista.push(cardAtualizado);
          }
        } else {
          novaLista.push(cardAtualizado);
        }
      }
    });

    salvarComHistorico(novaLista, false, cardPropagar);
  };

  const rotearCardViaMenu = (cardId: string, destinoEtapa: EtapaKanban) => {
    const hoje = getHojeISO();
    let cardPropagar: CardKanban | undefined;

    const novaLista = cards.map((c) => {
      if (c.id === cardId && c.etapa !== destinoEtapa) {
        const novaSit = c.propostaIdVinculada
          ? mapearEtapaKanbanParaSituacaoContratacao(
              destinoEtapa,
              c.statusCor,
              c.situacaoVinculada
            )
          : c.situacaoVinculada;

        const atualizado: CardKanban = {
          ...c,
          etapa: destinoEtapa,
          situacaoVinculada: novaSit,
          dataModificacao: hoje,
          estagnacaoDispensada: false,
          lembreteDispensado:
            c.lembreteData && c.lembreteData <= hoje ? true : c.lembreteDispensado,
        };
        if (atualizado.propostaIdVinculada) cardPropagar = atualizado;
        return atualizado;
      }
      return c;
    });
    salvarComHistorico(novaLista, false, cardPropagar);
  };

  const atualizarDataManual = (cardId: string, novaData: string) => {
    const novaLista = cards.map((c) =>
      c.id === cardId ? { ...c, dataModificacao: novaData } : c
    );
    salvarComHistorico(novaLista);
  };

  // ITEM 2: Altera a Situação Rígida diretamente pela tarja do Card e reflete na tabela de Contratações!
  const [menuHighlightFullscreenAberto, setMenuHighlightFullscreenAberto] =
    useState(false);
  const [menuEmojiFullscreenAberto, setMenuEmojiFullscreenAberto] =
    useState(false);

   
   // =========================================================================
  // ITEM 2: ABAS ESTILO PLANILHA EXCEL NO RODAPÉ DO CARD MAXIMIZADO
  // =========================================================================
  const [abaInternaCard, setAbaInternaCard] = useState<
    'notas' | 'contratacoes' | 'desembolsos' | 'parecer'
  >('notas');

  // ITEM 4: Estados e Motor de Regras do Gerador de Pareceres Técnicos BNB
  const [modeloParecer, setModeloParecer] = useState<
    'APROVACAO_S522' | 'DEVOLUCAO_PENDENCIAS' | 'CONTRATACAO' | 'DESEMBOLSO'
  >('APROVACAO_S522');
  const [textoParecerEditavel, setTextoParecerEditavel] = useState('');

  const gerarParecerTecnicoDoCard = useCallback(
    (
      card: CardKanban,
      modelo: 'APROVACAO_S522' | 'DEVOLUCAO_PENDENCIAS' | 'CONTRATACAO' | 'DESEMBOLSO'
    ) => {
      const opsCli = obterContratacoesDoCard(card);
      const { ops: opsDesemb, evs: evsDesemb } = obterDesembolsosDoCard(card);
      const extraidos = extrairCamposLivresDoHtmlKanban(
        card.texto,
        card.textoPuro
      );

      const nomeCli = (
        card.clienteVinculado ||
        opsCli[0]?.cliente ||
        'CLIENTE NÃO IDENTIFICADO'
      ).toUpperCase();
      const cpfCli = card.cpfVinculado || opsCli[0]?.cpf || 'Não informado';
      const porteCli = (
        card.porteVinculado ||
        opsCli[0]?.porte ||
        'PRONAF V'
      ).toUpperCase();
      const projCli =
        Array.from(
          new Set(opsCli.map((o) => (o.projetista || '').toUpperCase()).filter(Boolean))
        ).join(' / ') || 'Não informado';

      const opsDerivadas = opsCli.filter((o) => {
        const t = (o.tipo || '').toUpperCase().trim();
        return t !== 'LCGH' && t !== 'LCGA';
      });
      const opsLimites = opsCli.filter((o) => {
        const t = (o.tipo || '').toUpperCase().trim();
        return t === 'LCGH' || t === 'LCGA';
      });

      const linhasOpsTexto =
        opsDerivadas.length > 0
          ? opsDerivadas
              .map(
                (o, i) =>
                  `  • OP${i + 1} - ${o.tipo.toUpperCase()}: R$ ${o.valor}${
                    o.programa ? ` | Programa: ${o.programa}` : ''
                  } (Status: ${o.situacao})`
              )
              .join('\n')
          : `  • ${(card.tipoOpVinculado || 'Operação Rural').toUpperCase()}: R$ ${
              card.valorVinculado || '0,00'
            }`;

      // Regra Automática de Garantia
      let blocoGarantia = '';
      if (porteCli === 'PRONAF A') {
        blocoGarantia =
          '• GARANTIA: Operação enquadrada no PRONAF Grupo A, dispensada de exigência de garantias reais ou fidejussórias adicionais conforme normativo vigente.';
      } else if (opsLimites.length > 0) {
        blocoGarantia = opsLimites
          .map(
            (l) =>
              `• GARANTIA REAL (${l.tipo.toUpperCase()}): Amparada por processo de limite no valor de R$ ${
                l.valor
              } (${l.lcgSituacao || l.situacaoDetalhada || l.situacao}).`
          )
          .join('\n');
      } else {
        const regComAval = opsCli.find((o) => o.avalistaNome || o.avalistaCpf);
        if (regComAval) {
          blocoGarantia = `• GARANTIA FIDEJUSSÓRIA (AVAL): Prestada por ${
            regComAval.avalistaNome || 'Avalista indicado'
          }${regComAval.avalistaCpf ? `, CPF nº ${regComAval.avalistaCpf}` : ''}.`;
        } else {
          blocoGarantia =
            '• GARANTIA: Conforme minuta e proposta técnica vinculada ao processo.';
        }
      }

      const sitTexto = htmlKanbanParaTextoLimpo(
        extraidos.situacaoDetalhada || card.situacaoDetalhadaVinculada || '-'
      );
      const pendTexto = htmlKanbanParaTextoLimpo(
        extraidos.pendenciasObs || card.obsVinculada || '-'
      );
      const analiseTexto = htmlKanbanParaTextoLimpo(
        extraidos.espacoAnalise || card.espacoAnaliseVinculado || '-'
      );

      const titulosModelo: Record<typeof modelo, string> = {
        APROVACAO_S522:
          'PARECER DE CONFORMIDADE E ENCAMINHAMENTO À CENTRAL DE CRÉDITO (PCE / S522)',
        DEVOLUCAO_PENDENCIAS:
          'DESPACHO TÉCNICO DE PENDÊNCIAS E SOLICITAÇÃO DE REGULARIZAÇÃO',
        CONTRATACAO:
          'PARECER DE CONFORMIDADE PARA EMISSÃO E FORMALIZAÇÃO DE CONTRATO',
        DESEMBOLSO:
          'PARECER DE CONFORMIDADE PARA LIBERAÇÃO DE DESEMBOLSO RURAL',
      };

      let conclusaoPadrao = '';
      if (modelo === 'APROVACAO_S522') {
        conclusaoPadrao =
          'CONCLUSÃO / ENCAMINHAMENTO:\nApós verificação prévia da documentação cadastral, capacidade produtiva e garantias vinculadas na Agência, encaminha-se a proposta para análise técnica e deliberação pela Central de Crédito (S522).';
      } else if (modelo === 'DEVOLUCAO_PENDENCIAS') {
        conclusaoPadrao =
          'CONCLUSÃO / PROVIDÊNCIAS:\nSolicita-se ao projetista/proponente o saneamento integral das pendências listadas no item 3 deste despacho para prosseguimento da análise e contratação.';
      } else if (modelo === 'CONTRATACAO') {
        conclusaoPadrao =
          'CONCLUSÃO / FORMALIZAÇÃO:\nVerificada a conformidade da aprovação e das condicionantes prévias, o processo encontra-se apto para emissão do instrumento de crédito, coleta de assinaturas e registro de garantias.';
      } else {
        const resumoDesemb =
          evsDesemb.length > 0
            ? evsDesemb
                .map(
                  (e) =>
                    `  • OP ${e.op} (${e.parcela}ª Parcela): R$ ${e.valor} — ${e.situacao} (${e.data})`
                )
                .join('\n')
            : opsDesemb
                .map((o) => `  • OP ${o.op}: Valor Contratado R$ ${o.valor}`)
                .join('\n');
        conclusaoPadrao = `DADOS DE LIBERAÇÃO / DESEMBOLSO:\n${
          resumoDesemb || '  • Aguardando detalhamento da parcela.'
        }\n\nCONCLUSÃO / LIBERAÇÃO:\nVerificada a regularidade da aplicação/comprovantes da etapa, opina-se favoravelmente ao processamento do desembolso conforme valores discriminados.`;
      }

      const corpoParecer =
        `BANCO DO NORDESTE DO BRASIL S.A. - BNB\n` +
        `${titulosModelo[modelo]}\n` +
        `Data de Emissão: ${getHojeBR()}\n` +
        `====================================================================\n\n` +
        `1. IDENTIFICAÇÃO DO PROPONENTE E OPERAÇÕES:\n` +
        `• Cliente: ${nomeCli} | CPF: ${cpfCli}\n` +
        `• Porte / Enquadramento: ${porteCli} | Assistência Técnica: ${projCli}\n` +
        `• Operações Vinculadas:\n${linhasOpsTexto}\n` +
        `${blocoGarantia}\n\n` +
        `2. SITUAÇÃO ATUAL E APONTAMENTOS DE ANÁLISE / CONFORMIDADE:\n` +
        `${sitTexto !== '-' && sitTexto !== '' ? sitTexto : '• Em tramitação regular.'}\n` +
        `${
          analiseTexto !== '-' && analiseTexto !== ''
            ? `\n[CONFORMIDADE / CÁLCULOS E VERIFICAÇÕES S400/GED]:\n${analiseTexto}\n`
            : ''
        }\n` +
        `3. PENDÊNCIAS / CONDICIONANTES OBSERVADAS:\n` +
        `${
          pendTexto !== '-' && pendTexto !== ''
            ? pendTexto
            : '• Sem pendências impeditivas registradas no momento.'
        }\n\n` +
        `4. ${conclusaoPadrao}`;

      setModeloParecer(modelo);
      setTextoParecerEditavel(corpoParecer);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contratacoes, operacoesBase, eventos]
  );

  // Estados do Editor de Contratação na Página 2 do Card
  const [editContratCardId, setEditContratCardId] = useState<string | null>(null);
  const [fcPorte, setFcPorte] = useState('PRONAF V');
  const [fcTipo, setFcTipo] = useState('INVESTIMENTO');
  const [fcSituacao, setFcSituacao] = useState('Na Agência');
  const [fcValor, setFcValor] = useState('');
  const [fcData, setFcData] = useState('');
  const [fcObs, setFcObs] = useState('');
  const [fcSitDetalhada, setFcSitDetalhada] = useState('');

  // Estados do Editor de Desembolso na Página 3 do Card
  const [editEventoCardId, setEditEventoCardId] = useState<string | null>(null);
  const [fdOp, setFdOp] = useState('');
  const [fdParcela, setFdParcela] = useState('1');
  const [fdValor, setFdValor] = useState('');
  const [fdSituacao, setFdSituacao] = useState('Desembolso Solicitado');
  const [fdData, setFdData] = useState('');
  const [fdObs, setFdObs] = useState('');

  // Localiza todas as Contratações vinculadas ao Card aberto
  const obterContratacoesDoCard = (card: CardKanban): RegistroContratacao[] => {
    const cpfLimpo = (card.cpfVinculado || '').replace(/\D/g, '');
    const nomeUpper = (card.clienteVinculado || '').toUpperCase().trim();
    const idsGrupo = card.idsPropostasAgrupadas || [];

    return contratacoes.filter((r) => {
      const matchId =
        String(r.id) === String(card.propostaIdVinculada) ||
        String(r.id) === String(card.lcgPropostaIdVinculada) ||
        idsGrupo.includes(String(r.id));
      const matchCpf =
        cpfLimpo.length === 11 && (r.cpf || '').replace(/\D/g, '') === cpfLimpo;
      const matchNome =
        nomeUpper.length > 3 &&
        (r.cliente || '').toUpperCase().trim() === nomeUpper;
      return matchId || matchCpf || matchNome;
    });
  };

  // Localiza Operações Base e Eventos de Desembolso vinculados ao Card aberto
  const obterDesembolsosDoCard = (card: CardKanban) => {
    const cpfLimpo = (card.cpfVinculado || '').replace(/\D/g, '');
    const nomeUpper = (card.clienteVinculado || '').toUpperCase().trim();
    const idsGrupo = card.idsPropostasAgrupadas || [];

    const ops = operacoesBase.filter((o) => {
      const matchId =
        o.propostaIdOrigem &&
        (String(o.propostaIdOrigem) === String(card.propostaIdVinculada) ||
          idsGrupo.includes(String(o.propostaIdOrigem)));
      const matchCpf =
        cpfLimpo.length === 11 && (o.cpf || '').replace(/\D/g, '') === cpfLimpo;
      const matchNome =
        nomeUpper.length > 3 &&
        (o.cliente || '').toUpperCase().trim() === nomeUpper;
      return matchId || matchCpf || matchNome;
    });

    const opsNumeros = ops.map((o) => o.op.toUpperCase().trim());
    const evs = eventos.filter((e) => {
      const matchNome =
        nomeUpper.length > 3 &&
        (e.cliente || '').toUpperCase().trim() === nomeUpper;
      const matchOp =
        (card.opDesembolsoVinculada &&
          e.op === card.opDesembolsoVinculada) ||
        opsNumeros.includes((e.op || '').toUpperCase().trim());
      return matchNome || matchOp;
    });

    return { ops, evs };
  };

  const iniciarEdicaoContratacaoNoCard = (reg?: RegistroContratacao, card?: CardKanban) => {
    if (reg) {
      setEditContratCardId(String(reg.id));
      setFcPorte(reg.porte || 'PRONAF V');
      setFcTipo(reg.tipo || 'INVESTIMENTO');
      setFcSituacao(reg.situacao || 'Na Agência');
      setFcValor(reg.valor || '');
      setFcData(reg.data || getHojeBR());
      setFcObs(reg.obs || '');
      setFcSitDetalhada(reg.situacaoDetalhada || '');
    } else {
      setEditContratCardId(null);
      setFcPorte(card?.porteVinculado || 'PRONAF V');
      setFcTipo('INVESTIMENTO');
      setFcSituacao(card?.situacaoVinculada || 'Na Agência');
      setFcValor('');
      setFcData(getHojeBR());
      setFcObs('');
      setFcSitDetalhada('');
    }
  };

  const salvarContratacaoPeloCard = (card: CardKanban) => {
    if (!fcValor.trim()) {
      alert('Informe o valor da operação!');
      return;
    }
    const listaCli = obterContratacoesDoCard(card);
    const refBase = listaCli[0];
    const clienteNome = (
      card.clienteVinculado ||
      refBase?.cliente ||
      'CLIENTE'
    ).toUpperCase();
    const clienteCpf = card.cpfVinculado || refBase?.cpf || '';
    const clienteProj = refBase?.projetista || '';

    let novas = [...contratacoes];
    let regSalvo: RegistroContratacao;

    if (editContratCardId) {
      const idx = novas.findIndex((r) => String(r.id) === String(editContratCardId));
      if (idx !== -1) {
        regSalvo = {
          ...novas[idx],
          porte: fcPorte,
          tipo: fcTipo,
          situacao: fcSituacao,
          valor: fcValor,
          data: fcData || getHojeBR(),
          obs: fcObs,
          situacaoDetalhada: fcSitDetalhada,
        };
        novas[idx] = regSalvo;
      } else {
        return;
      }
    } else {
      regSalvo = {
        id: String(Date.now()),
        cliente: clienteNome,
        cpf: clienteCpf,
        porte: fcPorte,
        projetista: clienteProj,
        responsavel: refBase?.responsavel || '',
        telefone: refBase?.telefone || '',
        tipo: fcTipo,
        situacao: fcSituacao,
        valor: fcValor,
        data: fcData || getHojeBR(),
        obs: fcObs,
        situacaoDetalhada: fcSitDetalhada,
      };
      novas = [regSalvo, ...novas];
    }

    onAtualizarContratacoes?.(novas);
    onRegistroContratacaoSalvo?.(regSalvo, novas);
    iniciarEdicaoContratacaoNoCard(undefined, card);
  };

  const excluirContratacaoPeloCard = (idReg: string, card: CardKanban) => {
    if (!window.confirm('Deseja realmente excluir esta proposta de contratação?')) return;
    const novas = contratacoes.filter((r) => String(r.id) !== String(idReg));
    onAtualizarContratacoes?.(novas);
    const restantes = novas.filter(
      (r) =>
        (r.cliente || '').toUpperCase().trim() ===
        (card.clienteVinculado || '').toUpperCase().trim()
    );
    if (restantes[0]) {
      onRegistroContratacaoSalvo?.(restantes[0], novas);
    }
    if (editContratCardId === String(idReg)) {
      iniciarEdicaoContratacaoNoCard(undefined, card);
    }
  };

  const iniciarEdicaoEventoNoCard = (ev?: EventoDesembolso, card?: CardKanban) => {
    const { ops } = obterDesembolsosDoCard(card || ({} as CardKanban));
    if (ev) {
      setEditEventoCardId(String(ev.id));
      setFdOp(ev.op || ops[0]?.op || '');
      setFdParcela(ev.parcela || '1');
      setFdValor(ev.valor || '');
      setFdSituacao(ev.situacao || 'Desembolso Solicitado');
      setFdData(ev.data || getHojeBR());
      setFdObs(ev.obs || '');
    } else {
      setEditEventoCardId(null);
      const derivs = obterContratacoesDoCard(card || ({} as CardKanban)).filter(
  (o) => !['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
);
const opPadrao =
  derivs.length > 0
    ? `OP1 (${derivs[0].tipo})`
    : 'OP1 (Investimento)';
setFdOp(ops[0]?.op || card?.opDesembolsoVinculada || opPadrao);
      setFdParcela('1');
      setFdValor(ops[0]?.valor || card?.valorVinculado || '');
      setFdSituacao(card?.situacaoDesembolsoVinculada || 'Desembolso Solicitado');
      setFdData(getHojeBR());
      setFdObs('');
    }
  };

  const salvarEventoDesembolsoPeloCard = (card: CardKanban) => {
    if (!fdValor.trim()) {
      alert('Informe o valor da liberação/parcela!');
      return;
    }
    const { ops } = obterDesembolsosDoCard(card);
    const clienteNome = (
      card.clienteVinculado ||
      ops[0]?.cliente ||
      'CLIENTE'
    ).toUpperCase();
    const derivs = obterContratacoesDoCard(card).filter(
  (o) => !['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
);
const opNumero =
  fdOp.trim() ||
  ops[0]?.op ||
  `OP${ ops.length + 1 } (${derivs[0]?.tipo || 'Investimento'})`;

    // Se ainda não existir Operação Base de Desembolso para este cliente, cria automaticamente
    let opBaseVinc = ops.find((o) => o.op === opNumero) || ops[0];
    if (!opBaseVinc) {
      opBaseVinc = {
        id: `op_${Date.now()}`,
        propostaIdOrigem: card.propostaIdVinculada,
        porte: card.porteVinculado || 'PRONAF V',
        cliente: clienteNome,
        cpf: card.cpfVinculado || '',
        projetista: '',
        op: opNumero,
        valor: card.valorVinculado || fdValor,
      };
      onAtualizarOperacoesBase?.([...operacoesBase, opBaseVinc]);
    }

    let novosEv = [...eventos];
    let evSalvo: EventoDesembolso;

    if (editEventoCardId) {
      const idx = novosEv.findIndex((e) => String(e.id) === String(editEventoCardId));
      if (idx !== -1) {
        evSalvo = {
          ...novosEv[idx],
          op: opNumero,
          parcela: fdParcela,
          valor: fdValor,
          situacao: fdSituacao,
          data: fdData || getHojeBR(),
          obs: fdObs,
        };
        novosEv[idx] = evSalvo;
      } else {
        return;
      }
    } else {
      evSalvo = {
        id: String(Date.now()),
        timestamp: Date.now(),
        cliente: clienteNome,
        op: opNumero,
        parcela: fdParcela,
        valor: fdValor,
        situacao: fdSituacao,
        data: fdData || getHojeBR(),
        obs: fdObs,
      };
      novosEv = [...novosEv, evSalvo];
    }

    onAtualizarEventos?.(novosEv);
    onEventoDesembolsoSalvo?.(evSalvo, opBaseVinc);
    iniciarEdicaoEventoNoCard(undefined, card);
  };

  const excluirEventoDesembolsoPeloCard = (idEv: string, card: CardKanban) => {
    if (!window.confirm('Deseja realmente excluir este evento de desembolso?')) return;
    const novos = eventos.filter((e) => String(e.id) !== String(idEv));
    onAtualizarEventos?.(novos);
    if (editEventoCardId === String(idEv)) {
      iniciarEdicaoEventoNoCard(undefined, card);
    }
  };
   
   
    // Estados da Edição Rápida por Duplo Clique no Cabeçalho do Card
  const [cardHeaderEditId, setCardHeaderEditId] = useState<string | null>(null);
  const [heCliente, setHeCliente] = useState('');
  const [heCpf, setHeCpf] = useState('');
  const [hePorte, setHePorte] = useState('');
  const [heProjetista, setHeProjetista] = useState('');
  const [heTemAval, setHeTemAval] = useState(false);
  const [heAvalNome, setHeAvalNome] = useState('');
  const [heAvalCpf, setHeAvalCpf] = useState('');
  const [heOperacoes, setHeOperacoes] = useState<
  Array<{ opId?: string; tipo: string; valor: string; programa?: string }>
>([]);

  const abrirEdicaoInlineCabecalho = (card: CardKanban) => {
    if (card.etapa === 'NOTAS') return;
    const puro = card.textoPuro || extrairTextoPuro(card.texto);
    const linhas = puro.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Extrai Nome e CPF
    let cli = card.clienteVinculado || '';
    let cpf = card.cpfVinculado || '';
    const primLinha = linhas[0] || '';
    if (!cli || !cpf) {
      const mCpf = primLinha.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
      if (mCpf && !cpf) cpf = mCpf[1];
      if (!cli) {
        cli = primLinha
          .split(/-\s*CPF:?/i)[0]
          .replace(/^CLIENTE:\s*/i, '')
          .trim();
      }
    }

    // 2. Extrai Porte, Projetista, Avalista e Operações
    let porte = card.porteVinculado || 'PRONAF V';
    let proj = '';
    let temAval = false;
    let avalNome = '';
    let avalCpf = '';
    const opsExtraidas: Array<{ opId?: string; tipo: string; valor: string }> = [];

    // Tenta extrair os opIds dos spans HTML se já existirem
    const mapaOpIdPorIndice: Record<number, string> = {};
    if (typeof document !== 'undefined') {
      const temp = document.createElement('div');
      temp.innerHTML = card.texto;
      let idxVal = 0;
      temp.querySelectorAll('.inline-edit-value[data-field="valor"]').forEach((el) => {
        const idAttr = el.getAttribute('data-opid');
        if (idAttr) mapaOpIdPorIndice[idxVal] = idAttr;
        idxVal++;
      });
    }

    let contadorOps = 0;
    for (const l of linhas) {
      const up = l.toUpperCase();
      if (up.includes('SITUAÇÃO:') || up.includes('PENDÊNCIAS')) break;

      if (up.startsWith('PORTE:')) {
        porte = l.substring(6).trim().toUpperCase();
      } else if (up.startsWith('PROJETISTA:')) {
        proj = l.substring(11).trim().toUpperCase();
      } else if (up.startsWith('AVAL:') || up.startsWith('AVALISTA:')) {
        temAval = true;
        const resto = l.replace(/^AVAL(?:ISTA)?:\s*/i, '').trim();
        const mCpfAval = resto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        if (mCpfAval) {
          avalCpf = mCpfAval[1];
          avalNome = resto.replace(avalCpf, '').replace(/[-:]/g, '').trim();
        } else {
          avalNome = resto;
        }
      } else if (
        up.startsWith('LCGH:') ||
        up.startsWith('LCGA:') ||
        up.startsWith('INVESTIMENTO:') ||
        up.startsWith('CUSTEIO:') ||
        up.startsWith('RENOV. CUSTEIO:') ||
        up.startsWith('RENOVAÇÃO') ||
        up.startsWith('CARTÃO BNB:') ||
        up.startsWith('PROPOSTA:')
      ) {
        const partes = l.split(':');
        const tipoLabel = partes[0].trim().toUpperCase();
        const restoValor = partes.slice(1).join(':').replace(/R\$\s*/i, '').trim();
        const valorLimpo = restoValor.split('(')[0].trim();
        opsExtraidas.push({
          opId: mapaOpIdPorIndice[contadorOps],
          tipo: tipoLabel,
          valor: valorLimpo,
        });
        contadorOps++;
      }
    }

    if (opsExtraidas.length === 0 && card.valorVinculado) {
      opsExtraidas.push({
        opId: card.propostaIdVinculada,
        tipo: (card.tipoOpVinculado || 'INVESTIMENTO').toUpperCase(),
        valor: card.valorVinculado,
      });
    }

    const opsClienteNaBase = obterContratacoesDoCard(card);
    const opsComPrograma = opsExtraidas.map((opEx) => {
      const regMatch =
        opsClienteNaBase.find((r) => opEx.opId && String(r.id) === String(opEx.opId)) ||
        opsClienteNaBase.find((r) => {
          const tReg = (r.tipo || '').toUpperCase().trim();
          const labelReg = tReg.includes('RENOVA') ? 'RENOV. CUSTEIO' : tReg;
          return labelReg === opEx.tipo.toUpperCase();
        });
      return {
        ...opEx,
        opId: opEx.opId || (regMatch ? String(regMatch.id) : undefined),
        programa: regMatch?.programa || '',
      };
    });

    setHeCliente(cli.toUpperCase());
    setHeCpf(cpf);
    setHePorte(porte === '-' ? 'PRONAF V' : porte);
    setHeProjetista(proj === '-' ? '' : proj);
    setHeTemAval(temAval);
    setHeAvalNome(avalNome);
    setHeAvalCpf(avalCpf);
    setHeOperacoes(opsComPrograma);
    setCardHeaderEditId(card.id);
    };

  const salvarEdicaoInlineCabecalho = (card: CardKanban) => {
    if (onInlineEditCabecalho) {
      onInlineEditCabecalho(card, {
        cliente: heCliente.toUpperCase().trim(),
        cpf: heCpf.trim(),
        porte: hePorte.toUpperCase().trim(),
        projetista: heProjetista.toUpperCase().trim(),
        avalistaNome: heTemAval ? heAvalNome.toUpperCase().trim() : undefined,
        avalistaCpf: heTemAval ? heAvalCpf.trim() : undefined,
        operacoesEditadas: heOperacoes,
      });
    }
    setCardHeaderEditId(null);
  };

    

  const EMOJIS_RAPIDOS_KANBAN = [
    { icone: '✅', desc: 'Concluído / OK' },
    { icone: '⚠️', desc: 'Atenção / Alerta' },
    { icone: '🚨', desc: 'Urgente / Prioridade' },
    { icone: '⏳', desc: 'Aguardando / Prazo' },
    { icone: '📌', desc: 'Fixar / Importante' },
    { icone: '🔒', desc: 'Travado / Bloqueio' },
    { icone: '📋', desc: 'Checklist / Laudo' },
    { icone: '📞', desc: 'Cobrar / Contato' },
    { icone: '💰', desc: 'Valor / Financeiro' },
    { icone: '🏛️', desc: 'Cartório / Registro' },
    { icone: '👀', desc: 'Em Verificação' },
    { icone: '❌', desc: 'Pendente / Negado' },
    { icone: '➡️', desc: 'Encaminhado / Seta' },
    { icone: '🔔', desc: 'Lembrete' },
  ];

  // ITEM 2: Lista completa das 11 situações oficiais de Desembolso
  const SITUACOES_DESEMBOLSO_OFICIAIS = [
    'Sem Registro',
    'Solicitar Documentação',
    'Verificar Conformidade',
    'Solicitar Desembolso',
    'Desembolso Solicitado',
    'Desembolso Pendente',
    'Desembolso na Vinculada',
    'Disponível para C/C',
    'Desembolso Efetivado',
    'Não Desembolsar',
    'Finalizado',
  ];

  // ITEM 9.1: A Tag de Desembolso SÓ deve aparecer se:
  // 1) Estiver nas etapas DESEMBOLSOS ou ACOMPANHAMENTO
  // 2) Estiver com situação da contratação = "Contratado"
  // 3) Possuir pelo menos uma Operação Derivada (não aparece se o cliente tiver apenas limite LCGH / LCGA!)
  const cardElegivelParaTagDesembolso = (card: CardKanban): boolean => {
    if (card.etapa !== 'DESEMBOLSOS' && card.etapa !== 'ACOMPANHAMENTO') {
      return false;
    }
    const opsCli = obterContratacoesDoCard(card);
    const temContratado =
      card.situacaoVinculada === 'Contratado' ||
      opsCli.some((o) => o.situacao === 'Contratado');
    if (!temContratado) return false;

    if (opsCli.length > 0) {
      return opsCli.some((o) => {
        const t = (o.tipo || '').toUpperCase().trim();
        return t !== 'LCGH' && t !== 'LCGA';
      });
    }

    const tipoCard = (card.tipoOpVinculado || '').toUpperCase();
    const PartesTipo = tipoCard
      .split('+')
      .map((s) => s.trim())
      .filter(Boolean);
    if (PartesTipo.length > 0) {
      return PartesTipo.some((t) => t !== 'LCGH' && t !== 'LCGA');
    }

    const puro = (card.textoPuro || card.texto || '').toUpperCase();
    const temDerivadaNoTexto =
      puro.includes('INVESTIMENTO:') ||
      puro.includes('CUSTEIO:') ||
      puro.includes('RENOV. CUSTEIO:') ||
      puro.includes('RENOVAÇÃO') ||
      puro.includes('CARTÃO BNB:');
    const temApenasLimiteNoTexto =
      (puro.includes('LCGH:') || puro.includes('LCGA:')) && !temDerivadaNoTexto;

    return !temApenasLimiteNoTexto;
  };

  // ITEM 2 e ITEM 10: Altera a Situação da Contratação pela tarja sem sujar o texto livre da Situação!
  const alterarSituacaoRigidaPelaTarja = (
    card: CardKanban,
    novaSitRigida: string
  ) => {
    const hoje = getHojeISO();
    const novaEtapa =
      novaSitRigida === 'Contratado' &&
      card.etapa !== 'DESEMBOLSOS' &&
      card.etapa !== 'ACOMPANHAMENTO'
        ? 'DESEMBOLSOS'
        : card.etapa;

    const atualizado: CardKanban = {
      ...card,
      etapa: novaEtapa,
      situacaoVinculada: novaSitRigida,
      situacaoDesembolsoVinculada:
        novaSitRigida === 'Contratado'
          ? card.situacaoDesembolsoVinculada || 'Desembolso Solicitado'
          : card.situacaoDesembolsoVinculada,
      dataModificacao: hoje,
    };
    const novaLista = cards.map((c) => (c.id === card.id ? atualizado : c));
    salvarComHistorico(novaLista, false, atualizado);
  };

  // ITEM 9.1, 9.2 e 9.3: Aciona o motor de Desembolso que verifica múltiplas OPs, pergunta o valor quando necessário e grava no Histórico!
  const alterarSituacaoDesembolsoPelaTarja = (
    card: CardKanban,
    novaSitDesemb: string
  ) => {
    if (onAlterarSituacaoDesembolsoPeloKanban) {
      onAlterarSituacaoDesembolsoPeloKanban(card, novaSitDesemb);
      return;
    }
    const hoje = getHojeISO();
    const novaEtapa: EtapaKanban =
      novaSitDesemb === 'Finalizado' || novaSitDesemb === 'Desembolso Efetivado'
        ? 'ACOMPANHAMENTO'
        : card.etapa === 'ACOMPANHAMENTO'
        ? 'DESEMBOLSOS'
        : card.etapa;

    const novaCor: StatusCorKanban =
      card.statusCor === 'roxo'
        ? 'roxo'
        : novaSitDesemb === 'Desembolso Pendente' ||
          novaSitDesemb === 'Não Desembolsar'
        ? 'vermelho'
        : novaSitDesemb === 'Desembolso Efetivado' ||
          novaSitDesemb === 'Finalizado' ||
          novaSitDesemb === 'Disponível para C/C'
        ? 'verde'
        : 'azul';

    const atualizado: CardKanban = {
      ...card,
      etapa: novaEtapa,
      statusCor: novaCor,
      situacaoDesembolsoVinculada: novaSitDesemb,
      dataModificacao: hoje,
    };
    const novaLista = cards.map((c) => (c.id === card.id ? atualizado : c));
    salvarComHistorico(novaLista, false);
  };

  // ITEM 1: Interceptador Inteligente de Colagem (Smart Paste)
  // Impede que fontes gigantes, cores de fundo ou tabelas quebradas do Word/PDF/Web baguncem o card,
  // preservando maiúsculas/minúsculas, quebras de linha e convertendo marcadores externos em "- ".
  const handleSmartPasteCard = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const htmlCopiado = e.clipboardData.getData('text/html');
    const textoPuro = e.clipboardData.getData('text/plain');

    // Se o texto foi copiado de dentro do próprio sistema Kanban (contém nossas tags simples sem lixo do Word/Office),
    // permite manter negritos (<b>) e grifos (<span style="background-color:...">) limpando o resto!
    if (
      htmlCopiado &&
      !htmlCopiado.includes('mso-') &&
      !htmlCopiado.includes('<table') &&
      (htmlCopiado.includes('bloco-editavel') ||
        htmlCopiado.includes('#fff3cd') ||
        htmlCopiado.includes('#f8d7da'))
    ) {
      const temp = document.createElement('div');
      temp.innerHTML = htmlCopiado;
      // Remove eventuais blocos de cabeçalho fixo para não duplicar cabeçalho dentro do texto livre
      temp
        .querySelectorAll(
          '.card-bloco-cliente, .card-titulo-situacao, .card-titulo-pendencias, .card-titulo-analise'
        )
        .forEach((el) => el.remove());

      // Remove atributos de fonte/tamanho externos mantendo apenas negrito, itálico, sublinhado e marca-texto
      temp.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const bg = htmlEl.style?.backgroundColor;
        const color = htmlEl.style?.color;
        htmlEl.removeAttribute('class');
        htmlEl.removeAttribute('id');
        htmlEl.removeAttribute('style');
        if (bg) htmlEl.style.backgroundColor = bg;
        if (color === 'rgb(128, 0, 0)' || color === '#800000') {
          htmlEl.style.color = '#800000';
        }
      });

      document.execCommand('insertHTML', false, temp.innerHTML);
      return;
    }

    // Se veio de fora (Word, PDF, Excel, S400, WhatsApp, Web):
    // Insere como texto limpo na fonte oficial do card, convertendo marcadores (•, *, ▪) em "- "
    const textoHigienizado = (textoPuro || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((linha) => linha.replace(/^[\s]*[•*▪▸►]\s*/, '- '))
      .join('\n');

    document.execCommand('insertText', false, textoHigienizado);
  };

  const salvarTextoCardBlur = (
    cardId: string,
    novoHtml: string,
    novoTextoPuro: string
  ) => {
    const cardAtual = cards.find((c) => c.id === cardId);
    if (!cardAtual || cardAtual.texto === novoHtml) return;

    const hoje = getHojeISO();
    // ITEM 6: Extrai preservando o HTML rico (cores, negritos, grifos e emojis) de cada seção!
    const extraidos = extrairCamposLivresDoHtmlKanban(novoHtml, novoTextoPuro);

    // Intercepta as edições inline do cabeçalho (Duplo Clique) e limpa os spans editados
    const temp = document.createElement('div');
    temp.innerHTML = novoHtml;

    temp.querySelectorAll('.inline-edit-value').forEach((span) => {
      const htmlEl = span as HTMLElement;
      if (htmlEl.contentEditable === 'true') {
        htmlEl.contentEditable = 'false';
        htmlEl.style.backgroundColor = 'transparent';
        htmlEl.style.border = 'none';
        htmlEl.style.borderBottom = '1px dotted #94a3b8';
        htmlEl.style.padding = '0';
      }
    });

    const htmlParaSalvar = temp.innerHTML;

    let cardModificado: CardKanban | undefined;

    const novos = cards.map((c) => {
      if (c.id !== cardId) return c;
      cardModificado = {
        ...c,
        texto: htmlParaSalvar,
        textoPuro: novoTextoPuro,
        dataModificacao: hoje,
        situacaoDetalhadaVinculada:
          extraidos.situacaoDetalhada !== undefined
            ? extraidos.situacaoDetalhada
            : c.situacaoDetalhadaVinculada,
        obsVinculada:
          extraidos.pendenciasObs !== undefined
            ? extraidos.pendenciasObs
            : c.obsVinculada,
        espacoAnaliseVinculado:
          extraidos.espacoAnalise !== undefined
            ? extraidos.espacoAnalise
            : c.espacoAnaliseVinculado,
      };
      return cardModificado;
    });

    salvarComHistorico(
      novos,
      false,
      cardModificado?.propostaIdVinculada ? cardModificado : undefined
    );
  };

  // =========================================================================
  // SISTEMA DE NOTIFICAÇÕES
  // =========================================================================
  const hojeStr = getHojeISO();
  const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
  const agoraMs = Date.now();

  const notificacoes = cards.reduce<
    Array<{
      card: CardKanban;
      tipo: 'lembrete' | 'estagnado';
      resumo: string;
      labelTempo: string;
    }>
  >((acc, card) => {
    const puro = card.textoPuro || extrairTextoPuro(card.texto);
    const resumo = puro.trim()
      ? puro.trim().substring(0, 55) + '...'
      : 'Nota sem descrição...';

    if (card.lembreteData && !card.lembreteDispensado && card.lembreteData <= hojeStr) {
      const dataFmt = card.lembreteData.split('-').reverse().join('/');
      const horaFmt = card.lembreteHora ? ` às ${card.lembreteHora}` : '';
      acc.push({
        card,
        tipo: 'lembrete',
        resumo,
        labelTempo: `⏰ Agendado para: ${dataFmt}${horaFmt}`,
      });
    }

    if (
      (card.statusCor === 'vermelho' || card.statusCor === 'amarelo') &&
      card.etapa !== 'NOTAS' &&
      card.etapa !== 'ACOMPANHAMENTO' &&
      card.dataModificacao
    ) {
      const p = card.dataModificacao.split('-');
      if (p.length === 3) {
        const dataMod = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getTime();
        if (agoraMs - dataMod >= trintaDiasMs && !card.estagnacaoDispensada) {
          acc.push({
            card,
            tipo: 'estagnado',
            resumo,
            labelTempo: '⚠️ Sem avanço > 30 dias',
          });
        }
      }
    }
    return acc;
  }, []);

  const dispensarNotificacao = (cardId: string, isStagnant: boolean) => {
    const novaLista = cards.map((c) => {
      if (c.id !== cardId) return c;
      return isStagnant
        ? { ...c, estagnacaoDispensada: true }
        : { ...c, lembreteDispensado: true };
    });
    salvarComHistorico(novaLista);
  };

  const focarCardKanban = (card: CardKanban, isStagnant: boolean) => {
    dispensarNotificacao(card.id, isStagnant);
    if (filtroEtapa !== 'TODOS' && filtroEtapa !== card.etapa) {
      setFiltroEtapa('TODOS');
    }
    setTimeout(() => {
      const colEl = document.getElementById(`col_${card.etapa}`);
      if (carouselRef.current && colEl) {
        carouselRef.current.scrollTo({
          left: colEl.offsetLeft - 20,
          behavior: 'smooth',
        });
      }
      const cardEl = document.getElementById(card.id);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setCardPulsandoId(card.id);
        setTimeout(() => setCardPulsandoId(null), 4500);
      }
    }, 200);
  };

  // =========================================================================
  // MODO FOCO E BUSCA INTERNA
  // =========================================================================
  const limparGrifosBuscaInterna = (cardId: string) => {
    const cardEl = document.getElementById(cardId);
    if (!cardEl) return;
    const editor = cardEl.querySelector('.card-editor');
    if (!editor) return;
    const marks = editor.querySelectorAll('mark.kanban-busca-temp');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
      }
    });
    editor.normalize();
  };

  const executarBuscaInterna = (termo: string, cardId: string) => {
    setTermoBuscaInterna(termo);
    limparGrifosBuscaInterna(cardId);

    const termoLimpo = termo.toLowerCase().trim();
    if (!termoLimpo) {
      setBuscaInternaStatus('neutro');
      return;
    }

    const cardEl = document.getElementById(cardId);
    const editor = cardEl?.querySelector('.card-editor') as HTMLElement | null;
    if (!editor) return;

    if (!editor.innerText.toLowerCase().includes(termoLimpo)) {
      setBuscaInternaStatus('erro');
      return;
    }

    try {
      const termoEscapado = termoLimpo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${termoEscapado})(?![^<]*>)`, 'gi');
      editor.innerHTML = editor.innerHTML.replace(
        regex,
        `<mark class="kanban-busca-temp" style="background-color: #ffeb3b; color: #000; border-radius: 2px; box-shadow: 0 0 4px #fbc02d; padding: 0 2px;">$1</mark>`
      );
      setBuscaInternaStatus('achou');
    } catch {
      setBuscaInternaStatus('neutro');
    }
  };

  const toggleFullscreenCard = (cardId: string) => {
    setAbaInternaCard('notas');
    setEditContratCardId(null);
    setEditEventoCardId(null);
    limparGrifosBuscaInterna(cardId);
    setTermoBuscaInterna('');
    setBuscaInternaStatus('neutro');

    const cardEl = document.getElementById(cardId);
    const editor = cardEl?.querySelector('.card-editor') as HTMLElement | null;
    if (editor) {
      salvarTextoCardBlur(cardId, editor.innerHTML, editor.innerText);
    }

    setCardFullscreenId((prev) => (prev === cardId ? null : cardId));
  };

  // =========================================================================
  // DRAG & DROP
  // =========================================================================
  const handleDragOverColuna = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (carouselRef.current) {
      const vRect = carouselRef.current.getBoundingClientRect();
      if (vRect.right - e.clientX < 50) carouselRef.current.scrollLeft += 12;
      else if (e.clientX - vRect.left < 50) carouselRef.current.scrollLeft -= 12;
    }
  };

  const handleDropColuna = (
    e: React.DragEvent<HTMLDivElement>,
    destinoEtapa: EtapaKanban
  ) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain') || draggingCardId;
    setDraggingCardId(null);
    setDragHabilitadoId(null);
    const infoAlvo = dragOverInfo;
    setDragOverInfo(null);

    if (!cardId) return;
    const cardMovido = cards.find((c) => c.id === cardId);
    if (!cardMovido) return;

    const mudouEtapa = cardMovido.etapa !== destinoEtapa;

    // ITEM 5: Se o usuário soltou na MESMA coluna e NÃO mirou sobre outro card específico (ou mirou nele mesmo),
    // NÃO altera a ordem nem joga o card para o final da coluna!
    if (!mudouEtapa && (!infoAlvo || infoAlvo.cardId === cardId)) {
      return;
    }

    const novaSitVinculada =
      mudouEtapa && cardMovido.propostaIdVinculada
        ? mapearEtapaKanbanParaSituacaoContratacao(
            destinoEtapa,
            cardMovido.statusCor,
            cardMovido.situacaoVinculada
          )
        : cardMovido.situacaoVinculada;

    const cardAtualizado: CardKanban = {
      ...cardMovido,
      etapa: destinoEtapa,
      situacaoVinculada: novaSitVinculada,
      dataModificacao: mudouEtapa ? getHojeISO() : cardMovido.dataModificacao,
    };

    const semMovido = cards.filter((c) => c.id !== cardId);
    if (infoAlvo && infoAlvo.cardId !== cardId) {
      const idxAlvo = semMovido.findIndex((c) => c.id === infoAlvo.cardId);
      if (idxAlvo !== -1) {
        const posInsercao = infoAlvo.pos === 'top' ? idxAlvo : idxAlvo + 1;
        semMovido.splice(posInsercao, 0, cardAtualizado);
        salvarComHistorico(
          semMovido,
          false,
          mudouEtapa && cardAtualizado.propostaIdVinculada
            ? cardAtualizado
            : undefined
        );
        return;
      }
    }

    // Só adiciona ao final se realmente mudou para uma coluna diferente vazia/sem mira específica
    semMovido.push(cardAtualizado);
    salvarComHistorico(
      semMovido,
      false,
      mudouEtapa && cardAtualizado.propostaIdVinculada
        ? cardAtualizado
        : undefined
    );
  };

  const temBuscaTextoAtiva = termoBusca.trim() !== '';

  // ITEM 4.1, 4.2, 4.3 e 6.1: Regras de visibilidade dos cards (Arquivados + Porte + Cor + Busca)
  const cardPassaNoFiltro = (card: CardKanban): boolean => {
    const isArquivado = card.statusCor === 'roxo';

    // Se clicou na guia "📦 ARQUIVADOS", mostra apenas os cards que estão arquivados!
    if (filtroEtapa === 'ARQUIVADOS') {
      if (!isArquivado) return false;
    } else {
      if (
        isArquivado &&
        !(temBuscaTextoAtiva && incluirArquivadosNaBusca) &&
        filtroCor !== 'roxo'
      ) {
        return false;
      }
    }

    // ITEM 6.1: Filtra os cards de clientes pelos Portes selecionados (Notas livres permanecem visíveis)
    if (card.etapa !== 'NOTAS' && filtroPortesKanban.length < 4) {
      let porteDoCard = card.porteVinculado || '';
      if (!porteDoCard) {
        const mPorte = (card.textoPuro || card.texto || '').match(/PORTE:\s*([^\n<]+)/i);
        if (mPorte && mPorte[1]) porteDoCard = mPorte[1].trim();
      }
      const catPorte = classificarCategoriaPorte(porteDoCard);
      if (!filtroPortesKanban.includes(catPorte)) return false;
    }

    if (filtroCor !== 'TODOS' && card.statusCor !== filtroCor) return false;

    if (temBuscaTextoAtiva) {
      const puro = (card.textoPuro || extrairTextoPuro(card.texto)).toLowerCase();
      if (!puro.includes(termoBusca.toLowerCase().trim())) return false;
    }
    return true;
  };

  // ITEM 1.2: Filtrar por Porte NÃO esconde as colunas vazias! Mantém a visão panorâmica de todas as etapas do processo!
  const modoFiltroCruzadoAtivo =
    temBuscaTextoAtiva ||
    filtroCor !== 'TODOS' ||
    filtroEtapa === 'ARQUIVADOS';

  // Só ativa o modo foco de coluna única se o usuário clicou em 1 etapa específica ou pesquisou texto/cor que restou em 1 coluna
  const etapasComCardsVisiveis = ORDEM_ETAPAS.filter((et) =>
    cards.some((c) => c.etapa === et && cardPassaNoFiltro(c))
  );
  const totalArquivados = cards.filter((c) => c.statusCor === 'roxo').length;
  const isNovoClientePronafA = ncPorte.toUpperCase().trim() === 'PRONAF A';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px', background: '#f4f5f7', overflow: 'hidden' }}>
      <datalist id="dl_projetistas_kanban">
        {LISTA_PROJETISTAS_CURTOS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <datalist id="dl_programas_kanban">
        {listaProgramas.map((prog) => (
          <option key={prog} value={prog} />
        ))}
      </datalist>

      {/* BARRA DE FERRAMENTAS SUPERIOR DO KANBAN */}
      <div
        className="notas-toolbar"
        style={{
          marginBottom: '10px',
          borderRadius: '6px',
          border: '1px solid #e0e0e0',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }} title="Negrito"><b>B</b></button>
          <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }} title="Itálico"><i>I</i></button>
          <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }} title="Sublinhado"><u>U</u></button>
          <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('strikeThrough'); }} title="Tachado"><s>S</s></button>

          <div className="toolbar-divisor" />

          <div className="color-dropdown">
            <button title="Grifar Texto">🖍️ ▼</button>
            <div className="color-dropdown-content">
              <button className="color-swatch" style={{ backgroundColor: '#fff3cd' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('hiliteColor', false, '#fff3cd'); }} />
              <button className="color-swatch" style={{ backgroundColor: '#f8d7da' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('hiliteColor', false, '#f8d7da'); }} />
              <button className="color-swatch" style={{ backgroundColor: '#e2e3e5' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('hiliteColor', false, '#e2e3e5'); }} />
            </div>
          </div>

          <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#800000'); }} title="Texto em Destaque">🅰️</button>
          <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat'); }} title="Remover Formatações">✖️</button>

          <div className="toolbar-divisor" />

          <div className="list-dropdown">
            <button title="Listas">≣ ▼</button>
            <div className="list-dropdown-content">
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList'); }}>• Marcadores</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList'); }}>1. Numeração</button>
            </div>
          </div>

          <div className="toolbar-divisor" />
          <button
            onClick={() => setModalPdfAberto(true)}
            style={{
              width: 'auto',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#8B1530',
              fontWeight: 'bold',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '4px',
            }}
            title="Gera um PDF Executivo separado por Etapa, Porte e Prioridades (Ocultando o Espaço para Análise)"
          >
            🖨️ Exportar PDF
          </button>

          {/* ITEM 6.1: Filtro de Múltipla Seleção por Porte ao lado de Exportar PDF */}
          <div
            style={{ position: 'relative', display: 'inline-block', marginLeft: '4px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuFiltroPorteAberto((p) => !p)}
              style={{
                width: 'auto',
                background:
                  filtroPortesKanban.length < 4 ? '#8B1530' : '#f8fafc',
                color: filtroPortesKanban.length < 4 ? '#ffffff' : '#334155',
                border: `1px solid ${
                  filtroPortesKanban.length < 4 ? '#8B1530' : '#cbd5e1'
                }`,
                fontWeight: 'bold',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="Filtrar cards do Kanban por Porte do Cliente"
            >
              🏷️ Portes{' '}
              {filtroPortesKanban.length === 4
                ? '(Todos)'
                : `(${filtroPortesKanban.length})`}{' '}
              ▾
            </button>

            {menuFiltroPorteAberto && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  left: 0,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.16)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  zIndex: 1000,
                  width: '205px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '4px',
                    fontSize: '10.5px',
                    fontWeight: 'bold',
                    color: '#64748b',
                  }}
                >
                  <span>FILTRAR POR PORTE</span>
                  <span
                    onClick={() =>
                      setFiltroPortesKanban(
                        filtroPortesKanban.length === 4
                          ? []
                          : [...TODOS_PORTES_KANBAN]
                      )
                    }
                    style={{ color: '#8B1530', cursor: 'pointer' }}
                  >
                    {filtroPortesKanban.length === 4 ? 'Desmarcar' : 'Marcar Todos'}
                  </span>
                </div>

                {[
                  { id: 'PRONAF V', label: 'PRONAF (V / Mulher / B)' },
                  { id: 'PRONAF A', label: 'PRONAF A' },
                  { id: 'MINI', label: 'MINI Produtor' },
                  { id: 'OUTROS', label: 'Outros / Sem Porte' },
                ].map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#1e293b',
                      cursor: 'pointer',
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filtroPortesKanban.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFiltroPortesKanban([...filtroPortesKanban, item.id]);
                        } else {
                          setFiltroPortesKanban(
                            filtroPortesKanban.filter((p) => p !== item.id)
                          );
                        }
                      }}
                      style={{ width: '13px', height: '13px', margin: 0 }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          </div>

        {/* Busca Global, Filtro de Cor e Botões Desfazer/Refazer */}
        <div style={{ display: 'flex', flex: 1, minWidth: '250px', maxWidth: '420px', margin: '0 10px', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="🔍 Pesquisar tarefa, cliente, nota ou CPF..."
              style={{
                width: '100%',
                padding: '7px 72px 7px 14px',
                border: '1px solid #ccc',
                borderRadius: '20px',
                fontSize: '11.5px',
                background: '#f9f9f9',
                height: '32px',
              }}
            />
            <label
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                right: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '9.5px',
                fontWeight: 'bold',
                color: incluirArquivadosNaBusca ? '#6b21a8' : '#64748b',
                background: incluirArquivadosNaBusca ? '#f3e8ff' : '#eef2f6',
                border: `1px solid ${incluirArquivadosNaBusca ? '#d8b4fe' : '#cbd5e1'}`,
                padding: '2px 6px',
                borderRadius: '10px',
                cursor: 'pointer',
                margin: 0,
                userSelect: 'none',
                lineHeight: 1,
              }}
              title="Se marcado, a busca por texto também incluirá os cards Arquivados (roxos)"
            >
              <input
                type="checkbox"
                checked={incluirArquivadosNaBusca}
                onChange={(e) => setIncluirArquivadosNaBusca(e.target.checked)}
                style={{ width: '10px', height: '10px', margin: 0, cursor: 'pointer', accentColor: '#7e22ce' }}
              />
              📦 Arq.
            </label>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuFiltroCorAberto((prev) => !prev);
            }}
            title="Filtrar por Situação/Cor"
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              borderRadius: '50%',
              border: filtroCor !== 'TODOS' ? '2px solid var(--primary-color)' : '1px solid #ccc',
              background: '#fff',
              fontSize: '16px',
              padding: 0,
            }}
          >
            🎨
          </button>

          <div style={{ width: '1px', height: '24px', background: '#ccc', margin: '0 2px' }} />

          <button
            onClick={desfazer}
            disabled={ponteiroHist <= 0}
            title="Desfazer Ação (Ctrl+Z)"
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              borderRadius: '50%',
              border: '1px solid #ccc',
              background: '#fff',
              fontSize: '16px',
              padding: 0,
              opacity: ponteiroHist > 0 ? 1 : 0.4,
            }}
          >
            ↩
          </button>

          <button
            onClick={refazer}
            disabled={ponteiroHist >= historico.length - 1}
            title="Refazer Ação (Ctrl+Y)"
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              borderRadius: '50%',
              border: '1px solid #ccc',
              background: '#fff',
              fontSize: '16px',
              padding: 0,
              opacity: ponteiroHist < historico.length - 1 ? 1 : 0.4,
            }}
          >
            ↪
          </button>

          {menuFiltroCorAberto && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                background: 'white',
                border: '1px solid #e0e0e0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '6px',
                padding: '6px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                width: '160px',
              }}
            >
              <div onClick={() => { setFiltroCor('TODOS'); setMenuFiltroCorAberto(false); }} style={{ padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                🎨 Geral
              </div>
              <div onClick={() => { setFiltroCor('azul'); setMenuFiltroCorAberto(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1a73e8' }} /> Em Análise
              </div>
              <div onClick={() => { setFiltroCor('vermelho'); setMenuFiltroCorAberto(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#d93025' }} /> Prioritário
              </div>
              <div onClick={() => { setFiltroCor('amarelo'); setMenuFiltroCorAberto(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f29900' }} /> Pendente Geral
              </div>
              <div onClick={() => { setFiltroCor('verde'); setMenuFiltroCorAberto(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#137333' }} /> Concluído
              </div>
              <div
                onClick={() => {
                  setFiltroCor('roxo');
                  setMenuFiltroCorAberto(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#6b21a8',
                  borderTop: '1px dashed #eee',
                  marginTop: '2px',
                }}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#7e22ce' }} /> Arquivados
              </div>
            </div>
          )}
        </div>

        {/* ITEM 3: Botões de Filtro de Coluna Compactados para melhor alocação de espaço */}
        <div className="kanban-filter-controls" style={{ gap: '4px' }}>
          <button
            className={`btn-filter-kanban ${filtroEtapa === 'TODOS' ? 'active' : ''}`}
            onClick={() => setFiltroEtapa('TODOS')}
            style={{ padding: '4px 8px', fontSize: '10.5px' }}
          >
            👁️ TODAS
          </button>
          {ORDEM_ETAPAS.map((et) => (
            <button
              key={et}
              className={`btn-filter-kanban ${filtroEtapa === et ? 'active' : ''}`}
              onClick={() => {
                setFiltroEtapa(et);
                if (et === 'NOTAS') setNotasMinimizadas(false);
              }}
              style={{ padding: '4px 8px', fontSize: '10.5px' }}
            >
              {et === 'NOTAS' ? '📌 NOTAS' : et === 'S522' ? 'S522/CENTRAL' : et}
            </button>
          ))}
          <button
            className={`btn-filter-kanban ${
              filtroEtapa === 'ARQUIVADOS' ? 'active' : ''
            }`}
            onClick={() => setFiltroEtapa('ARQUIVADOS')}
            style={{
              borderColor: '#d8b4fe',
              color: filtroEtapa === 'ARQUIVADOS' ? '#fff' : '#6b21a8',
              background:
                filtroEtapa === 'ARQUIVADOS' ? '#7e22ce' : '#faf5ff',
              padding: '4px 8px',
              fontSize: '10.5px',
            }}
            title={`Pasta de Clientes Arquivados (${totalArquivados})`}
          >
            📦{totalArquivados > 0 ? ` ${totalArquivados}` : ''}
          </button>
        </div>
      </div>

      {/* CARROSSEL DE COLUNAS DO KANBAN */}
      <div className="kanban-carousel-viewport" ref={carouselRef}>
        {ORDEM_ETAPAS.map((etapa) => {
          const cardsDaColuna = cards.filter(
            (c) => c.etapa === etapa && cardPassaNoFiltro(c)
          );
          // Contador da coluna reflete os cards visíveis (respeitando o filtro de Porte ativo!)
          const totalRealColuna = cardsDaColuna.length;

          let mostrarColuna = true;
          if (
            filtroEtapa !== 'TODOS' &&
            filtroEtapa !== 'ARQUIVADOS' &&
            filtroEtapa !== etapa
          ) {
            mostrarColuna = false;
          } else if (modoFiltroCruzadoAtivo && cardsDaColuna.length === 0) {
            mostrarColuna = false;
          }

          if (!mostrarColuna) return null;

          const configCol = TITULOS_COLUNAS[etapa];
          const isNotas = etapa === 'NOTAS';
          // ITEM 1.1: Permite minimizar a coluna de NOTAS mesmo quando há filtros ativos!
          const isMinimized =
            isNotas &&
            notasMinimizadas &&
            filtroEtapa !== 'NOTAS';

          // ITEM 1.2: Só expande em coluna única se o usuário clicou na guia de uma etapa ou se há busca de texto/cor com 1 coluna restante
          const isFocusSingle =
            (filtroEtapa === etapa && !modoFiltroCruzadoAtivo) ||
            (modoFiltroCruzadoAtivo && etapasComCardsVisiveis.length === 1);

          return (
            <React.Fragment key={etapa}>
              <div
                id={`col_${etapa}`}
                className={`kanban-coluna-workflow ${isMinimized ? 'is-minimized' : ''} ${
                  isFocusSingle ? 'focus-single' : ''
                } ${isNotas && notificacoes.length > 0 ? 'has-notifications' : ''}`}
                style={{ borderTopColor: configCol.corTopo }}
                onDragOver={handleDragOverColuna}
                onDrop={(e) => handleDropColuna(e, etapa)}
              >
                <div className="kanban-column-title normal-view">
                  <span style={{ color: isNotas ? '#455a64' : '#333' }}>
                    {configCol.titulo}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <button
                      onClick={() => handleClicarBotaoMaisColuna(etapa)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: configCol.corBotao,
                        fontWeight: 'bold',
                        fontSize: '16px',
                        padding: '0 5px',
                      }}
                      title={
                        isNotas
                          ? 'Adicionar Nota/Lembrete Livre'
                          : 'Cadastrar Novo Cliente/Operação nesta etapa'
                      }
                    >
                      +
                    </button>
                    <span style={{ fontSize: '12px', color: '#666' }}>{totalRealColuna}</span>
                    {isNotas && (
                      <button
                        onClick={() => setNotasMinimizadas(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#455a64',
                          fontWeight: 'bold',
                          fontSize: '20px',
                          padding: '0 5px',
                          lineHeight: 0,
                        }}
                        title="Minimizar Aba"
                      >
                        «
                      </button>
                    )}
                  </div>
                </div>

                <div className="kanban-cards-container normal-view">
                  {isNotas && notificacoes.length > 0 && (
                    <div id="kanban_notifications_wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                      {notificacoes.map((notif, idx) => (
                        <div
                          key={`${notif.card.id}_${idx}`}
                          className={`notif-mini-card ${notif.tipo === 'estagnado' ? 'stagnant' : ''}`}
                        >
                          <div className="notif-header">
                            <span>{notif.labelTempo}</span>
                            {notif.tipo === 'lembrete' && (
                              <button
                                className="btn-lembrete-icon"
                                onClick={() => {
                                  setModalLembreteCardId(notif.card.id);
                                  setLembreteDataInput(notif.card.lembreteData || '');
                                  setLembreteHoraInput(notif.card.lembreteHora || '');
                                }}
                                title="Reagendar"
                              >
                                ⏰
                              </button>
                            )}
                          </div>
                          <div className="notif-body">
                            <strong>{NOMES_AMIGAVEIS[notif.card.etapa]}:</strong> {notif.resumo}
                          </div>
                          <div className="notif-actions">
                            <button
                              className="btn-notif btn-notif-verify"
                              onClick={() =>
                                focarCardKanban(notif.card, notif.tipo === 'estagnado')
                              }
                            >
                              Verificar
                            </button>
                            <button
                              className="btn-notif btn-notif-dismiss"
                              onClick={() =>
                                dispensarNotificacao(
                                  notif.card.id,
                                  notif.tipo === 'estagnado'
                                )
                              }
                            >
                              Dispensar
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={{ width: '100%', height: '2px', background: '#ccc', marginTop: '5px', borderRadius: '2px' }} />
                    </div>
                  )}

                  {cardsDaColuna.map((card) => {
                    const isFullscreen = cardFullscreenId === card.id;
                    const isPulsing = cardPulsandoId === card.id;
                    const dragOverClass =
                      dragOverInfo?.cardId === card.id
                        ? dragOverInfo.pos === 'top'
                          ? 'drag-over-top'
                          : 'drag-over-bottom'
                        : '';

                    const estiloNotaConcluida: React.CSSProperties =
                      card.etapa === 'NOTAS' && card.statusCor === 'verde'
                        ? { textDecoration: 'line-through', opacity: 0.6, fontStyle: 'italic' }
                        : {};

                    // ITEM 11: Verifica discretamente (apenas quando expandido) se há menção a LCGH/LCGA pendente em uma operação derivada
                    const puroCard = (card.textoPuro || card.texto || '').toUpperCase();
                    const temTravaLcgDiscreta =
                      isFullscreen &&
                      card.tipoOpVinculado !== 'LCGH' &&
                      card.tipoOpVinculado !== 'LCGA' &&
                      (puroCard.includes('LCGH:') || puroCard.includes('LCGA:')) &&
                      (puroCard.includes('AGUARDANDO') ||
                        puroCard.includes('CORRIGI') ||
                        puroCard.includes('PENDÊN') ||
                        puroCard.includes('CENTRAL'));

                    return (
                      <div
                        key={card.id}
                        id={card.id}
                        className={`kanban-card status-${card.statusCor || 'amarelo'} ${
                          isFullscreen ? 'fullscreen-mode' : ''
                        } ${isPulsing ? 'card-highlight-pulse' : ''} ${
                          draggingCardId === card.id ? 'is-dragging' : ''
                        } ${dragOverClass}`}
                        style={{ position: 'relative', paddingBottom: '25px' }}
                        draggable={!isFullscreen && dragHabilitadoId === card.id}
                        onDragStart={(e) => {
                          if (dragHabilitadoId !== card.id) {
                            e.preventDefault();
                            return;
                          }
                          e.dataTransfer.setData('text/plain', card.id);
                          setDraggingCardId(card.id);
                        }}
                        onDragEnd={() => {
                          setDraggingCardId(null);
                          setDragHabilitadoId(null);
                          setDragOverInfo(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!draggingCardId || draggingCardId === card.id) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pos =
                            e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
                          setDragOverInfo({ cardId: card.id, pos });
                        }}
                      >
                        {/* Gatilho na borda esquerda APENAS para trocar cor (sem arrastar) */}
                        <div
                          title="Alterar Situação (Cor)"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuCorCardAbertoId((prev) =>
                              prev === card.id ? null : card.id
                            );
                          }}
                          style={{
                            position: 'absolute',
                            left: '-5px',
                            top: 0,
                            bottom: 0,
                            width: '10px',
                            cursor: 'pointer',
                            zIndex: 5,
                          }}
                        />

                        {menuCorCardAbertoId === card.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              left: '10px',
                              top: '25px',
                              background: 'white',
                              border: '1px solid #e0e0e0',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              borderRadius: '6px',
                              padding: '6px',
                              zIndex: 100,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              width: '140px',
                            }}
                          >
                            <div onClick={() => { mudarCorStatusCard(card.id, 'azul'); setMenuCorCardAbertoId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1a73e8' }} /> Em Análise
                            </div>
                            <div onClick={() => { mudarCorStatusCard(card.id, 'vermelho'); setMenuCorCardAbertoId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#d93025' }} /> Prioritário
                            </div>
                            <div onClick={() => { mudarCorStatusCard(card.id, 'amarelo'); setMenuCorCardAbertoId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f29900' }} /> Pendente Geral
                            </div>
                            <div onClick={() => { mudarCorStatusCard(card.id, 'verde'); setMenuCorCardAbertoId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#137333' }} /> Concluído
                            </div>
                            {card.etapa !== 'NOTAS' && (
                              <div
                                onClick={() => {
                                  mudarCorStatusCard(card.id, 'roxo');
                                  setMenuCorCardAbertoId(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: '#6b21a8',
                                  borderTop: '1px dashed #eee',
                                  marginTop: '2px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: '#7e22ce',
                                  }}
                                />{' '}
                                Arquivar
                              </div>
                            )}
                          </div>
                        )}

                        {/* ITEM 5: CABEÇALHO DO CARD — Única área onde segurar o mouse ativa o arrasto! */}
                        <div
                          className="card-drag-handle"
                          onMouseDown={(e) => {
                            const tag = (e.target as HTMLElement).tagName;
                            if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT') {
                              setDragHabilitadoId(null);
                              return;
                            }
                            if (!isFullscreen) setDragHabilitadoId(card.id);
                          }}
                          onMouseUp={() => setDragHabilitadoId(null)}
                          onMouseLeave={() => {
                            if (!draggingCardId) setDragHabilitadoId(null);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            {/* ITEM 7 e 7.1: Ícones compactos alinhados à esquerda logo após o seletor de colunas */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <select
                                className="select-route-fast"
                                value=""
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  rotearCardViaMenu(card.id, e.target.value as EtapaKanban)
                                }
                              >
                                <option value="" disabled>
                                  ⮂
                                </option>
                                {ORDEM_ETAPAS.map((et) => (
                                  <option key={et} value={et}>
                                    {NOMES_AMIGAVEIS[et]}
                                  </option>
                                ))}
                              </select>

                              {/* Pequena margem entre o seletor da extrema esquerda e o início dos ícones */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                                {card.propostaIdVinculada && (
                                  <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCardEditSync(card);
                                      setSyncSitInput(card.situacaoVinculada || 'Na Agência');
                                      setSyncSitDetalhadaInput(
                                        card.situacaoDetalhadaVinculada || ''
                                      );
                                      setSyncValorInput(card.valorVinculado || '');
                                      setSyncObsInput(card.obsVinculada || '');
                                    }}
                                    style={{
                                      background: '#e8f0fe',
                                      color: '#1967d2',
                                      border: '1px solid #a8c7fa',
                                      borderRadius: '4px',
                                      padding: '2px 6px',
                                      fontSize: '12px',
                                    }}
                                    title="Edição Sincronizada (Situação / Valor / Pendências)"
                                  >
                                    🔗
                                  </button>
                                )}

                                {(card.propostaIdVinculada || card.clienteVinculado) &&
                                  onAbrirClienteEmContratacoes && (
                                    <button
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAbrirClienteEmContratacoes(card);
                                      }}
                                      style={{
                                        background: '#fff3e0',
                                        color: '#e65100',
                                        border: '1px solid #ffb74d',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        fontSize: '12px',
                                      }}
                                      title="Abrir e Filtrar Cliente na Base de Dados de Contratações"
                                    >
                                      📝
                                    </button>
                                  )}

                                {(card.etapa === 'DESEMBOLSOS' ||
                                  card.situacaoVinculada === 'Contratado') &&
                                  onAbrirClienteEmDesembolsos && (
                                    <button
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAbrirClienteEmDesembolsos(card);
                                      }}
                                      style={{
                                        background: '#e6f4ea',
                                        color: '#137333',
                                        border: '1px solid #a8dab5',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        fontSize: '12px',
                                      }}
                                      title="Abrir Histórico de Eventos de Desembolso deste Cliente"
                                    >
                                      💸
                                    </button>
                                  )}

                                {/* ITEM 10: Botões de Copiar Mensagem e Enviar no WhatsApp (Aparecem apenas quando o Card está EXPANDIDO) */}
                                {isFullscreen && card.etapa !== 'NOTAS' && (
                                  <>
                                    <button
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copiarMensagemCobranca(card);
                                      }}
                                      style={{
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        padding: '2px 7px',
                                        fontSize: '12px',
                                      }}
                                      title="Copiar Resumo Formatado (Situação + Pendências)"
                                    >
                                      📋
                                    </button>

                                    <button
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        enviarWhatsAppCobranca(card);
                                      }}
                                      style={{
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        border: '1px solid #86efac',
                                        borderRadius: '4px',
                                        padding: '2px 7px',
                                        fontSize: '12px',
                                      }}
                                      title="Enviar Cobrança de Pendências via WhatsApp para o Projetista"
                                    >
                                      📲
                                    </button>
                                  </>
                                )}

                                {/* ITEM 2.1 e ITEM 7: Quando EXPANDIDO, exibe a Tarja de Contratação e (se Contratado/Desembolso) a Tarja de Desembolso ao lado direito! */}
                                {isFullscreen && card.etapa !== 'NOTAS' && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                                    <select
                                      value={card.situacaoVinculada || 'Na Agência'}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        alterarSituacaoRigidaPelaTarja(
                                          card,
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        width: 'auto',
                                        padding: '2px 7px',
                                        fontSize: '10.5px',
                                        fontWeight: 'bold',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        height: '23px',
                                        background:
                                          card.situacaoVinculada === 'Contratado'
                                            ? '#e6f4ea'
                                            : card.situacaoVinculada === 'Na Central'
                                            ? '#fef7e0'
                                            : card.situacaoVinculada === 'Devolvido AG'
                                            ? '#fff3e0'
                                            : card.situacaoVinculada ===
                                              'Com Cliente/Projetista'
                                            ? '#fce8e6'
                                            : '#e8f0fe',
                                        color:
                                          card.situacaoVinculada === 'Contratado'
                                            ? '#137333'
                                            : card.situacaoVinculada === 'Na Central'
                                            ? '#b06000'
                                            : card.situacaoVinculada === 'Devolvido AG'
                                            ? '#e65100'
                                            : card.situacaoVinculada ===
                                              'Com Cliente/Projetista'
                                            ? '#c5221f'
                                            : '#1967d2',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                      }}
                                      title="Situação da Contratação"
                                    >
                                      <option value="Com Cliente/Projetista" style={{ background: '#fff', color: '#333' }}>
                                        Com Cliente/Projetista
                                      </option>
                                      <option value="Na Agência" style={{ background: '#fff', color: '#333' }}>
                                        Na Agência (AG)
                                      </option>
                                      <option value="Devolvido AG" style={{ background: '#fff', color: '#333' }}>
                                        Devolvido AG
                                      </option>
                                      <option value="Na Central" style={{ background: '#fff', color: '#333' }}>
                                        Na Central (S522)
                                      </option>
                                      <option value="Contratado" style={{ background: '#fff', color: '#333' }}>
                                        Contratado
                                      </option>
                                    </select>

                                    {/* ITEM 2 e 9.1: Segunda Tarja (11 Situações de Desembolso) — Só aparece se tiver OP Derivada Contratada em Desembolsos/Acompanhamento! */}
                                    {cardElegivelParaTagDesembolso(card) && (
                                      <select
                                        value={
                                          card.situacaoDesembolsoVinculada ||
                                          'Sem Registro'
                                        }
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onChange={(e) =>
                                          alterarSituacaoDesembolsoPelaTarja(
                                            card,
                                            e.target.value
                                          )
                                        }
                                        style={{
                                          width: 'auto',
                                          padding: '2px 7px',
                                          fontSize: '10.5px',
                                          fontWeight: 'bold',
                                          borderRadius: '10px',
                                          cursor: 'pointer',
                                          height: '23px',
                                          background:
                                            card.situacaoDesembolsoVinculada ===
                                              'Desembolso Efetivado' ||
                                            card.situacaoDesembolsoVinculada ===
                                              'Finalizado' ||
                                            card.situacaoDesembolsoVinculada ===
                                              'Disponível para C/C'
                                              ? '#dcfce7'
                                              : card.situacaoDesembolsoVinculada ===
                                                  'Desembolso Pendente' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Não Desembolsar'
                                              ? '#fee2e2'
                                              : card.situacaoDesembolsoVinculada ===
                                                  'Desembolso na Vinculada' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Desembolso Solicitado' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Solicitar Desembolso'
                                              ? '#fef7e0'
                                              : '#f3e8ff',
                                          color:
                                            card.situacaoDesembolsoVinculada ===
                                              'Desembolso Efetivado' ||
                                            card.situacaoDesembolsoVinculada ===
                                              'Finalizado' ||
                                            card.situacaoDesembolsoVinculada ===
                                              'Disponível para C/C'
                                              ? '#15803d'
                                              : card.situacaoDesembolsoVinculada ===
                                                  'Desembolso Pendente' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Não Desembolsar'
                                              ? '#b91c1c'
                                              : card.situacaoDesembolsoVinculada ===
                                                  'Desembolso na Vinculada' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Desembolso Solicitado' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Solicitar Desembolso'
                                              ? '#b06000'
                                              : '#6b21a8',
                                          border: '1px solid rgba(107,33,168,0.25)',
                                        }}
                                        title="Situação do Desembolso (Registra automaticamente no Histórico da aba Desembolsos)"
                                      >
                                        {SITUACOES_DESEMBOLSO_OFICIAIS.map((sit) => (
                                          <option
                                            key={sit}
                                            value={sit}
                                            style={{ background: '#fff', color: '#333' }}
                                          >
                                            💸 {sit}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                )}

                                {/* ITEM 11: Alerta discreto de Derivada aguardando Limite LCGA/LCGH (Apenas com Card Expandido) */}
                                {temTravaLcgDiscreta && (
                                  <span
                                    style={{
                                      marginLeft: '6px',
                                      background: '#fff3cd',
                                      color: '#856404',
                                      border: '1px solid #ffeeba',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '10.5px',
                                      fontWeight: 'bold',
                                    }}
                                    title="Esta operação derivada possui vínculo com limite LCGH/LCGA em andamento"
                                  >
                                    🔒 Aguardando Limite LCGA/LCGH
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                              <button
                                className="btn-lembrete-icon"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                  setModalLembreteCardId(card.id);
                                  setLembreteDataInput(card.lembreteData || '');
                                  setLembreteHoraInput(card.lembreteHora || '');
                                }}
                                title="Agendar Lembrete"
                              >
                                ⏰
                              </button>
                              <input
                                type="date"
                                className="card-date-input"
                                value={card.dataModificacao || hojeStr}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  atualizarDataManual(card.id, e.target.value)
                                }
                                title="Data da Última Modificação"
                              />
                              {!isFullscreen ? (
                                <button
                                  className="card-delete-btn"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => excluirCard(card.id)}
                                  title="Excluir Card"
                                >
                                  X
                                </button>
                              ) : (
                                <button
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => {
                                    setMenuHighlightFullscreenAberto(false);
                                    setMenuEmojiFullscreenAberto(false);
                                    toggleFullscreenCard(card.id);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    color: '#555',
                                    padding: '0 6px',
                                    lineHeight: 1,
                                  }}
                                  title="Minimizar Tarefa"
                                >
                                  −
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ITEM 6.1 e 6.2: BARRA DE FERRAMENTAS COMPLETA NO CARD MAXIMIZADO (Tópicos + Pincel 3 Cores + Emojis) */}
                          {isFullscreen && (
                            <div
                              className="notas-toolbar"
                              style={{
                                marginTop: '10px',
                                borderTop: '1px solid #eee',
                                paddingTop: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '10px',
                                background: 'transparent',
                                borderBottom: 'none',
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                                <button onMouseDown={(e) => { e.preventDefault(); execFormat('bold'); }} title="Negrito"><b>B</b></button>
                                <button onMouseDown={(e) => { e.preventDefault(); execFormat('italic'); }} title="Itálico"><i>I</i></button>
                                <button onMouseDown={(e) => { e.preventDefault(); execFormat('underline'); }} title="Sublinhado"><u>U</u></button>
                                <button onMouseDown={(e) => { e.preventDefault(); execFormat('strikeThrough'); }} title="Tachado"><s>S</s></button>

                                <div className="toolbar-divisor" />

                                {/* ITEM 6.2: Marcação por Tópicos */}
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    execFormat('insertUnorderedList');
                                  }}
                                  title="Inserir Lista de Tópicos"
                                >
                                  • Lista
                                </button>

                                {/* Cor Vinho e Pincel de Marca-Texto com as 3 Cores */}
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    execFormat('foreColor', '#800000');
                                  }}
                                  title="Texto em Cor Vinho Destaque"
                                >
                                  🅰️
                                </button>

                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setMenuHighlightFullscreenAberto((p) => !p);
                                      setMenuEmojiFullscreenAberto(false);
                                    }}
                                    title="Pincel de Marca-Texto (3 Cores)"
                                  >
                                    🖍️ ▾
                                  </button>
                                  {menuHighlightFullscreenAberto && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        background: 'white',
                                        border: '1px solid #ccc',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                                        borderRadius: '6px',
                                        padding: '6px',
                                        display: 'flex',
                                        gap: '6px',
                                        zIndex: 10000010,
                                      }}
                                    >
                                      <button
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          aplicarHighlight('#fff3cd');
                                          setMenuHighlightFullscreenAberto(false);
                                        }}
                                        style={{ background: '#fff3cd', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #ffeeba' }}
                                        title="Marca-Texto Amarelo"
                                      />
                                      <button
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          aplicarHighlight('#d4edda');
                                          setMenuHighlightFullscreenAberto(false);
                                        }}
                                        style={{ background: '#d4edda', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #c3e6cb' }}
                                        title="Marca-Texto Verde"
                                      />
                                      <button
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          aplicarHighlight('#f8d7da');
                                          setMenuHighlightFullscreenAberto(false);
                                        }}
                                        style={{ background: '#f8d7da', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #f5c6cb' }}
                                        title="Marca-Texto Rosa/Vinho"
                                      />
                                      <button
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          aplicarHighlight('transparent');
                                          setMenuHighlightFullscreenAberto(false);
                                        }}
                                        style={{ background: '#fff', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #ccc', fontSize: '10px' }}
                                        title="Remover Marca-Texto"
                                      >
                                        ✖
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Escudo invisível para fechar os menus suspensos ao clicar fora */}
                                {(menuEmojiFullscreenAberto || menuHighlightFullscreenAberto) && (
                                  <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 10000009 }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setMenuEmojiFullscreenAberto(false);
                                      setMenuHighlightFullscreenAberto(false);
                                    }}
                                  />
                                )}

                                {/* ITEM 6.1: Seletor de Emojis de Check, Alerta, Fixação e Tópicos */}
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setMenuEmojiFullscreenAberto((p) => !p);
                                      setMenuHighlightFullscreenAberto(false);
                                    }}
                                    title="Inserir Emoji de Check, Alerta, Atenção ou Tópico"
                                  >
                                    ✅▾
                                  </button>
                                  {menuEmojiFullscreenAberto && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        background: 'white',
                                        border: '1px solid #cbd5e1',
                                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                                        borderRadius: '8px',
                                        padding: '8px',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                        width: '270px',
                                        zIndex: 10000010,
                                      }}
                                    >
                                      {EMOJIS_RAPIDOS_KANBAN.map((em) => (
                                        <button
                                          key={em.icone}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            document.execCommand(
                                              'insertText',
                                              false,
                                              `${em.icone} `
                                            );
                                            setMenuEmojiFullscreenAberto(false);
                                          }}
                                          style={{
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '4px',
                                            padding: '4px',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                          }}
                                          title={em.desc}
                                        >
                                          {em.icone}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="toolbar-divisor" />

                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    execFormat('removeFormat');
                                  }}
                                  title="Limpar Formatação do Texto Selecionado"
                                >
                                  ✖️
                                </button>
                              </div>

                              <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: '5px', minWidth: '180px' }}>
                                <input
                                  type="text"
                                  value={termoBuscaInterna}
                                  onChange={(e) =>
                                    executarBuscaInterna(e.target.value, card.id)
                                  }
                                  placeholder="Pesquisar no texto..."
                                  style={{
                                    padding: '6px 12px',
                                    border: `1px solid ${
                                      buscaInternaStatus === 'erro'
                                        ? '#d93025'
                                        : buscaInternaStatus === 'achou'
                                        ? 'var(--primary-color)'
                                        : '#ccc'
                                    }`,
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    maxWidth: '240px',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ITEM 2.2 e ITEM 7: Quando MINIMIZADO, exibe as tarjas compactas lado a lado (Contratação + Desembolso se aplicável) */}
                        {!isFullscreen && card.etapa !== 'NOTAS' && (
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              padding: '4px 8px 0 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              flexWrap: 'wrap',
                              background: 'transparent',
                            }}
                          >
                            <select
                              value={card.situacaoVinculada || 'Na Agência'}
                              onChange={(e) =>
                                alterarSituacaoRigidaPelaTarja(
                                  card,
                                  e.target.value
                                )
                              }
                              style={{
                                width: 'auto',
                                maxWidth: '135px',
                                padding: '1px 5px',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                height: '19px',
                                lineHeight: 1,
                                background:
                                  card.situacaoVinculada === 'Contratado'
                                    ? '#e6f4ea'
                                    : card.situacaoVinculada === 'Na Central'
                                    ? '#fef7e0'
                                    : card.situacaoVinculada === 'Devolvido AG'
                                    ? '#fff3e0'
                                    : card.situacaoVinculada ===
                                      'Com Cliente/Projetista'
                                    ? '#fce8e6'
                                    : '#e8f0fe',
                                color:
                                  card.situacaoVinculada === 'Contratado'
                                    ? '#137333'
                                    : card.situacaoVinculada === 'Na Central'
                                    ? '#b06000'
                                    : card.situacaoVinculada === 'Devolvido AG'
                                    ? '#e65100'
                                    : card.situacaoVinculada ===
                                      'Com Cliente/Projetista'
                                    ? '#c5221f'
                                    : '#1967d2',
                                border: '1px solid rgba(0,0,0,0.15)',
                              }}
                              title="Situação da Contratação"
                            >
                              <option value="Com Cliente/Projetista" style={{ background: '#fff', color: '#333' }}>
                                Com Cliente/Proj.
                              </option>
                              <option value="Na Agência" style={{ background: '#fff', color: '#333' }}>
                                Na Agência (AG)
                              </option>
                              <option value="Devolvido AG" style={{ background: '#fff', color: '#333' }}>
                                Devolvido AG
                              </option>
                              <option value="Na Central" style={{ background: '#fff', color: '#333' }}>
                                Na Central (S522)
                              </option>
                              <option value="Contratado" style={{ background: '#fff', color: '#333' }}>
                                Contratado
                              </option>
                            </select>

                            {/* ITEM 2 e 9.1: Segunda Tarja compacta (11 Situações) — Apenas para Derivada Contratada em Desembolsos/Acompanhamento */}
                            {cardElegivelParaTagDesembolso(card) && (
                              <select
                                value={
                                  card.situacaoDesembolsoVinculada ||
                                  'Sem Registro'
                                }
                                onChange={(e) =>
                                  alterarSituacaoDesembolsoPelaTarja(
                                    card,
                                    e.target.value
                                  )
                                }
                                style={{
                                  width: 'auto',
                                  maxWidth: '150px',
                                  padding: '1px 5px',
                                  fontSize: '9px',
                                  fontWeight: 'bold',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  height: '19px',
                                  lineHeight: 1,
                                  background:
                                    card.situacaoDesembolsoVinculada ===
                                      'Desembolso Efetivado' ||
                                    card.situacaoDesembolsoVinculada ===
                                      'Finalizado' ||
                                    card.situacaoDesembolsoVinculada ===
                                      'Disponível para C/C'
                                      ? '#dcfce7'
                                      : card.situacaoDesembolsoVinculada ===
                                          'Desembolso Pendente' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Não Desembolsar'
                                      ? '#fee2e2'
                                      : card.situacaoDesembolsoVinculada ===
                                          'Desembolso na Vinculada' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Desembolso Solicitado' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Solicitar Desembolso'
                                      ? '#fef7e0'
                                      : '#f3e8ff',
                                  color:
                                    card.situacaoDesembolsoVinculada ===
                                      'Desembolso Efetivado' ||
                                    card.situacaoDesembolsoVinculada ===
                                      'Finalizado' ||
                                    card.situacaoDesembolsoVinculada ===
                                      'Disponível para C/C'
                                      ? '#15803d'
                                      : card.situacaoDesembolsoVinculada ===
                                          'Desembolso Pendente' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Não Desembolsar'
                                      ? '#b91c1c'
                                      : card.situacaoDesembolsoVinculada ===
                                          'Desembolso na Vinculada' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Desembolso Solicitado' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Solicitar Desembolso'
                                      ? '#b06000'
                                      : '#6b21a8',
                                  border: '1px solid rgba(107,33,168,0.25)',
                                }}
                                title="Situação do Desembolso"
                              >
                                {SITUACOES_DESEMBOLSO_OFICIAIS.map((sit) => (
                                  <option
                                    key={sit}
                                    value={sit}
                                    style={{ background: '#fff', color: '#333' }}
                                  >
                                    💸 {sit}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        
                        {/* EDITOR INLINE DO CABEÇALHO (Ativado ao dar Duplo Clique nos dados do cliente) */}
                        {cardHeaderEditId === card.id && (
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                salvarEdicaoInlineCabecalho(card);
                              } else if (e.key === 'Escape') {
                                setCardHeaderEditId(null);
                              }
                            }}
                            style={{
                              margin: '6px 8px 0 8px',
                              padding: '8px 10px',
                              background: '#fffbeb',
                              border: '1.5px dashed #8B1530',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fde68a', paddingBottom: '4px', marginBottom: '2px' }}>
                              <strong style={{ color: '#8B1530', fontSize: '10.5px' }}>
                                ✏️ EDITANDO CABEÇALHO (ENTER PARA SALVAR)
                              </strong>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => salvarEdicaoInlineCabecalho(card)}
                                  style={{ background: '#137333', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  ✔ Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCardHeaderEditId(null)}
                                  style={{ background: '#e2e8f0', color: '#333', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
                                >
                                  ✖
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <b>CLIENTE:</b>
                              <input
                                type="text"
                                value={heCliente}
                                onChange={(e) => setHeCliente(e.target.value)}
                                style={{ flex: 1, minWidth: '140px', padding: '2px 6px', fontSize: '11.5px', height: '24px' }}
                                autoFocus
                              />
                              <b>CPF:</b>
                              <input
                                type="text"
                                value={heCpf}
                                onChange={(e) => setHeCpf(mascaraDocumento(e.target.value))}
                                style={{ width: '125px', padding: '2px 6px', fontSize: '11.5px', height: '24px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <b>PORTE:</b>
                              <select
                                value={hePorte}
                                onChange={(e) => setHePorte(e.target.value)}
                                style={{ width: 'auto', padding: '2px 6px', fontSize: '11.5px', height: '24px' }}
                              >
                                <option value="PRONAF V">PRONAF V</option>
                                <option value="PRONAF A">PRONAF A</option>
                                <option value="MINI">MINI</option>
                                <option value="PEQUENO">PEQUENO</option>
                                <option value="MÉDIO">MÉDIO</option>
                              </select>

                              <b>PROJETISTA:</b>
                              <input
                                type="search"
                                list="dl_projetistas_kanban"
                                value={heProjetista}
                                onChange={(e) => setHeProjetista(e.target.value)}
                                placeholder="Selecione ou digite..."
                                style={{ flex: 1, minWidth: '110px', padding: '2px 6px', fontSize: '11.5px', height: '24px' }}
                              />
                            </div>

                            {heTemAval && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <b>AVAL:</b>
                                <input
                                  type="text"
                                  value={heAvalNome}
                                  onChange={(e) => setHeAvalNome(e.target.value)}
                                  placeholder="Nome do Avalista"
                                  style={{ flex: 1, minWidth: '120px', padding: '2px 6px', fontSize: '11.5px', height: '24px' }}
                                />
                                <b>CPF AVAL:</b>
                                <input
                                  type="text"
                                  value={heAvalCpf}
                                  onChange={(e) => setHeAvalCpf(mascaraDocumento(e.target.value))}
                                  placeholder="000.000.000-00"
                                  style={{ width: '120px', padding: '2px 6px', fontSize: '11.5px', height: '24px' }}
                                />
                              </div>
                            )}

                            {heOperacoes.map((opItem, idxOp) => (
                              <div key={idxOp} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <b style={{ color: opItem.tipo.includes('LCG') ? '#8B1530' : '#1e293b' }}>
                                  {opItem.tipo}: R$
                                </b>
                                <input
                                  type="text"
                                  value={opItem.valor}
                                  onChange={(e) => {
                                    const novas = [...heOperacoes];
                                    novas[idxOp] = {
                                      ...novas[idxOp],
                                      valor: mascaraMoedaInput(e.target.value),
                                    };
                                    setHeOperacoes(novas);
                                  }}
                                  style={{ width: '115px', padding: '2px 6px', fontSize: '11.5px', fontWeight: 'bold', height: '24px' }}
                                />
                                {!opItem.tipo.includes('LCG') && (
                                  <>
                                    <b style={{ fontSize: '10.5px', color: '#475569' }}>PROG.:</b>
                                    <input
                                      type="search"
                                      list="dl_programas_kanban"
                                      value={opItem.programa || ''}
                                      onChange={(e) => {
                                        const novas = [...heOperacoes];
                                        novas[idxOp] = {
                                          ...novas[idxOp],
                                          programa: e.target.value,
                                        };
                                        setHeOperacoes(novas);
                                      }}
                                      placeholder="Ex: PRONAF MULHER (406)"
                                      style={{ flex: 1, minWidth: '145px', padding: '2px 6px', fontSize: '11px', height: '24px' }}
                                    />
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}


                        {/* PÁGINA 1 (PADRÃO): Notas, Situação, Pendências e Espaço para Análise */}
                        <div
                          className="card-editor"
                          style={{
                            ...estiloNotaConcluida,
                            display:
                              !isFullscreen || abaInternaCard === 'notas'
                                ? 'block'
                                : 'none',
                          }}
                          contentEditable={
                            card.etapa === 'NOTAS' ||
                            !card.texto.includes('bloco-editavel-')
                          }
                          suppressContentEditableWarning
                          onPaste={handleSmartPasteCard}
                          onMouseDown={() => setDragHabilitadoId(null)}
                          onDoubleClick={(e) => {
                            const target = e.target as HTMLElement;
                            // Abre a edição inline APENAS se o clique for estritamente dentro da área do cabeçalho do cliente!
                            if (
                              target.closest('.card-bloco-cliente') ||
                              target.classList.contains('inline-edit-value')
                            ) {
                              e.preventDefault();
                              abrirEdicaoInlineCabecalho(card);
                            }
                          }}
                          onFocus={() => {
                            if (isFullscreen) limparGrifosBuscaInterna(card.id);
                          }}
                          onBlur={(e) => {
                            if (
                              e.relatedTarget &&
                              e.currentTarget.contains(e.relatedTarget as Node)
                            ) {
                              return;
                            }
                            salvarTextoCardBlur(
                              card.id,
                              e.currentTarget.innerHTML,
                              e.currentTarget.innerText
                            );
                          }}
                          dangerouslySetInnerHTML={{ __html: card.texto }}
                        />

                        {/* ITEM 2: PÁGINA 2 (CONTRATAÇÕES DO CLIENTE) E PÁGINA 3 (DESEMBOLSOS DO CLIENTE) DENTRO DO CARD */}
                        {isFullscreen &&
                          card.etapa !== 'NOTAS' &&
                          abaInternaCard !== 'notas' && (() => {
                            const opsContratCliente = obterContratacoesDoCard(card);
                            const { ops: opsDesembCliente, evs: evsDesembCliente } =
                              obterDesembolsosDoCard(card);

                            return (
                              <div
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                  flex: 1,
                                  overflowY: 'auto',
                                  padding: '16px 24px 70px 24px',
                                  background: '#f8fafc',
                                }}
                              >
                                {/* CABEÇALHO DO CLIENTE PRESERVADO NO TOPO DAS PÁGINAS 2 E 3 (Duplo Clique Ativo!) */}
                                <div
                                  onDoubleClick={() => abrirEdicaoInlineCabecalho(card)}
                                  title="Editar"
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #cbd5e1',
                                    borderLeft: '5px solid #8B1530',
                                    borderRadius: '6px',
                                    padding: '10px 14px',
                                    marginBottom: '16px',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    userSelect: 'text',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <div>
                                      <b>CLIENTE:</b> {(card.clienteVinculado || 'CLIENTE').toUpperCase()}{' '}
                                      {card.cpfVinculado && (
                                        <span>
                                          • <b>CPF:</b> {card.cpfVinculado}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      <b>PORTE:</b> {card.porteVinculado || '-'} •{' '}
                                      <span style={{ color: '#8B1530', fontWeight: 'bold' }}>
                                        ✏️
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* CONTEÚDO DA PÁGINA 2: CONTRATAÇÕES DO CLIENTE */}
                                {abaInternaCard === 'contratacoes' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Formulário: Editando Operação Selecionada / Nova Operação */}
                                    <div
                                      style={{
                                        background: '#fff',
                                        border: `1.5px solid ${
                                          editContratCardId ? '#f59e0b' : '#cbd5e1'
                                        }`,
                                        borderRadius: '8px',
                                        padding: '14px 16px',
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <strong style={{ color: editContratCardId ? '#b45309' : '#8B1530', fontSize: '13px' }}>
                                          {editContratCardId
                                            ? '📝 EDITANDO OPERAÇÃO SELECIONADA'
                                            : '➕ INSERIR NOVA PROPOSTA / OPERAÇÃO PARA ESTE CLIENTE'}
                                        </strong>
                                        {editContratCardId && (
                                          <button
                                            type="button"
                                            onClick={() => iniciarEdicaoContratacaoNoCard(undefined, card)}
                                            style={{ width: 'auto', padding: '4px 10px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#000' }}
                                          >
                                            ✖ Cancelar Edição
                                          </button>
                                        )}
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Porte</label>
                                          <select value={fcPorte} onChange={(e) => setFcPorte(e.target.value)} style={{ height: '32px', fontSize: '12px' }}>
                                            <option value="PRONAF V">PRONAF V</option>
                                            <option value="PRONAF A">PRONAF A</option>
                                            <option value="MINI">MINI</option>
                                            <option value="PEQUENO">PEQUENO</option>
                                            <option value="MÉDIO">MÉDIO</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Tipo de Operação</label>
                                          <select value={fcTipo} onChange={(e) => setFcTipo(e.target.value)} style={{ height: '32px', fontSize: '12px' }}>
                                            <option value="INVESTIMENTO">INVESTIMENTO</option>
                                            <option value="CUSTEIO">CUSTEIO</option>
                                            <option value="RENOVAÇÃO DE CUSTEIO">RENOVAÇÃO DE CUSTEIO</option>
                                            <option value="LCGH">LCGH (Limite Hipotecário)</option>
                                            <option value="LCGA">LCGA (Limite Alienação)</option>
                                            <option value="CARTÃO BNB">CARTÃO BNB</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Situação Oficial</label>
                                          <select value={fcSituacao} onChange={(e) => setFcSituacao(e.target.value)} style={{ height: '32px', fontSize: '12px' }}>
                                            <option value="Com Cliente/Projetista">Com Cliente/Projetista</option>
                                            <option value="Na Agência">Na Agência</option>
                                            <option value="Devolvido AG">Devolvido AG</option>
                                            <option value="Na Central">Na Central</option>
                                            <option value="Contratado">Contratado</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Valor da Proposta (R$)</label>
                                          <input
                                            type="text"
                                            value={fcValor}
                                            onChange={(e) => setFcValor(mascaraMoedaInput(e.target.value))}
                                            placeholder="0,00"
                                            style={{ height: '32px', fontSize: '12px', fontWeight: 'bold' }}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Data Atualização</label>
                                          <input
                                            type="text"
                                            value={fcData}
                                            onChange={(e) => setFcData(e.target.value)}
                                            placeholder="DD/MM/AAAA"
                                            style={{ height: '32px', fontSize: '12px' }}
                                          />
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button
                                          type="button"
                                          onClick={() => salvarContratacaoPeloCard(card)}
                                          style={{
                                            width: 'auto',
                                            padding: '6px 16px',
                                            background: editContratCardId ? '#d97706' : '#8B1530',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {editContratCardId
                                            ? '💾 Salvar Alterações na Proposta'
                                            : '➕ Adicionar Proposta ao Cliente'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Tabela: Registros Salvos deste Cliente */}
                                    <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px 16px' }}>
                                      <strong style={{ color: '#1e293b', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                                        🗂️ REGISTROS SALVOS DESTE CLIENTE EM CONTRATAÇÕES ({opsContratCliente.length})
                                      </strong>
                                      {opsContratCliente.length === 0 ? (
                                        <p style={{ fontSize: '12px', color: '#64748b' }}>
                                          Nenhuma proposta localizada na base de Contratações para este cliente. Use o formulário acima para inserir!
                                        </p>
                                      ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                          <thead>
                                            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                              <th style={{ padding: '8px' }}>Tipo Operação</th>
                                              <th style={{ padding: '8px' }}>Porte</th>
                                              <th style={{ padding: '8px' }}>Valor (R$)</th>
                                              <th style={{ padding: '8px' }}>Situação ↕️</th>
                                              <th style={{ padding: '8px' }}>Data</th>
                                              <th style={{ padding: '8px', textAlign: 'right' }}>Ações</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {opsContratCliente.map((reg) => {
                                              const isSel = String(reg.id) === String(editContratCardId);
                                              return (
                                                <tr
                                                  key={reg.id}
                                                  style={{
                                                    borderBottom: '1px solid #e2e8f0',
                                                    background: isSel ? '#fffbeb' : 'transparent',
                                                  }}
                                                >
                                                  <td style={{ padding: '8px', fontWeight: 'bold', color: (reg.tipo || '').includes('LCG') ? '#8B1530' : '#1e293b' }}>
                                                    {reg.tipo}
                                                  </td>
                                                  <td style={{ padding: '8px' }}>{reg.porte}</td>
                                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>R$ {reg.valor}</td>
                                                  <td style={{ padding: '8px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: reg.situacao === 'Contratado' ? '#e6f4ea' : '#e8f0fe', color: reg.situacao === 'Contratado' ? '#137333' : '#1967d2' }}>
                                                      {reg.situacao}
                                                    </span>
                                                  </td>
                                                  <td style={{ padding: '8px' }}>{reg.data || '-'}</td>
                                                  <td style={{ padding: '8px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                    <button
                                                      type="button"
                                                      onClick={() => iniciarEdicaoContratacaoNoCard(reg, card)}
                                                      style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                      ✏️ Editar
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => excluirContratacaoPeloCard(String(reg.id), card)}
                                                      style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                      🗑️ Excluir
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* CONTEÚDO DA PÁGINA 3: DESEMBOLSOS DO CLIENTE */}
                                {abaInternaCard === 'desembolsos' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Resumo das Operações Contratadas Base para Desembolso */}
                                    <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' }}>
                                      <strong style={{ color: '#1e293b', fontSize: '12.5px', display: 'block', marginBottom: '8px' }}>
                                        🏦 OPERAÇÕES CONTRATADAS VINCULADAS AO DESEMBOLSO ({opsDesembCliente.length})
                                      </strong>
                                      {opsDesembCliente.length === 0 ? (
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                          Nenhuma operação base cadastrada ainda. Ao registrar um evento abaixo, a operação será criada automaticamente!
                                        </span>
                                      ) : (
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                          {opsDesembCliente.map((opB) => (
                                            <div
                                              key={opB.id}
                                              style={{
                                                background: '#f8fafc',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                padding: '6px 12px',
                                                fontSize: '12px',
                                              }}
                                            >
                                              <b>OP:</b>{' '}
                                              <input
                                                type="text"
                                                value={opB.op}
                                                onChange={(e) => {
                                                  const novoNumOp = e.target.value;
                                                  const novasOps = operacoesBase.map((o) =>
                                                    o.id === opB.id ? { ...o, op: novoNumOp } : o
                                                  );
                                                  onAtualizarOperacoesBase?.(novasOps);
                                                }}
                                                style={{ width: '130px', display: 'inline-block', padding: '2px 6px', fontSize: '12px', fontWeight: 'bold', height: '24px', margin: '0 6px' }}
                                                title="Altere o número da OP diretamente aqui"
                                              />
                                              • <b>Valor Contratado:</b> R$ {opB.valor}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Formulário: Registrar Novo Evento / Editar Evento */}
                                    <div
                                      style={{
                                        background: '#fff',
                                        border: `1.5px solid ${
                                          editEventoCardId ? '#f59e0b' : '#cbd5e1'
                                        }`,
                                        borderRadius: '8px',
                                        padding: '14px 16px',
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <strong style={{ color: editContratCardId ? '#b45309' : '#8B1530', fontSize: '13px' }}>
                                          {editEventoCardId
                                            ? '📝 EDITANDO EVENTO DE DESEMBOLSO SELECIONADO'
                                            : '⏱️ REGISTRAR NOVO EVENTO / LIBERAÇÃO DE DESEMBOLSO'}
                                        </strong>
                                        {editEventoCardId && (
                                          <button
                                            type="button"
                                            onClick={() => iniciarEdicaoEventoNoCard(undefined, card)}
                                            style={{ width: 'auto', padding: '4px 10px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#000'}}
                                          >
                                            ✖ Cancelar Edição
                                          </button>
                                        )}
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Nº da Operação (OP)</label>
                                          <input
                                            type="text"
                                            value={fdOp}
                                            onChange={(e) => setFdOp(e.target.value)}
                                            placeholder="Ex: 192.2026..."
                                            style={{ height: '32px', fontSize: '12px' }}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Parcela</label>
                                          <select value={fdParcela} onChange={(e) => setFdParcela(e.target.value)} style={{ height: '32px', fontSize: '12px' }}>
                                            <option value="1">1ª Parcela (Ou Única)</option>
                                            <option value="2">2ª Parcela</option>
                                            <option value="3">3ª Parcela</option>
                                            <option value="4">4ª Parcela</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Valor do Desembolso (R$)</label>
                                          <input
                                            type="text"
                                            value={fdValor}
                                            onChange={(e) => setFdValor(mascaraMoedaInput(e.target.value))}
                                            placeholder="0,00"
                                            style={{ height: '32px', fontSize: '12px', fontWeight: 'bold' }}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Situação do Desembolso</label>
                                          <select value={fdSituacao} onChange={(e) => setFdSituacao(e.target.value)} style={{ height: '32px', fontSize: '12px' }}>
                                            {SITUACOES_DESEMBOLSO_OFICIAIS.filter((s) => s !== 'Sem Registro').map((sit) => (
                                              <option key={sit} value={sit}>
                                                {sit}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Data do Evento</label>
                                          <input
                                            type="text"
                                            value={fdData}
                                            onChange={(e) => setFdData(e.target.value)}
                                            placeholder="DD/MM/AAAA"
                                            style={{ height: '32px', fontSize: '12px' }}
                                          />
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          value={fdObs}
                                          onChange={(e) => setFdObs(e.target.value)}
                                          placeholder="Observações da liberação / pendência de notas fiscais..."
                                          style={{ flex: 1, height: '32px', fontSize: '12px' }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => salvarEventoDesembolsoPeloCard(card)}
                                          style={{
                                            width: 'auto',
                                            padding: '6px 16px',
                                            background: editContratCardId ? '#d97706' : '#8B1530',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {editEventoCardId
                                            ? '💾 Salvar Evento'
                                            : '➕ Registrar Evento'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Tabela: Histórico de Eventos Registrados */}
                                    <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px 16px' }}>
                                      <strong style={{ color: '#1e293b', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                                        📜 HISTÓRICO DE EVENTOS REGISTRADOS DESTE CLIENTE ({evsDesembCliente.length})
                                      </strong>
                                      {evsDesembCliente.length === 0 ? (
                                        <p style={{ fontSize: '12px', color: '#64748b' }}>
                                          Nenhum evento de desembolso registrado ainda para este cliente.
                                        </p>
                                      ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                          <thead>
                                            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                              <th style={{ padding: '8px' }}>OP</th>
                                              <th style={{ padding: '8px' }}>Parcela</th>
                                              <th style={{ padding: '8px' }}>Valor (R$)</th>
                                              <th style={{ padding: '8px' }}>Situação</th>
                                              <th style={{ padding: '8px' }}>Data</th>
                                              <th style={{ padding: '8px' }}>Observações</th>
                                              <th style={{ padding: '8px', textAlign: 'right' }}>Ações</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {evsDesembCliente.map((ev) => (
                                              <tr key={ev.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{ev.op}</td>
                                                <td style={{ padding: '8px' }}>{ev.parcela}ª</td>
                                                <td style={{ padding: '8px', fontWeight: 'bold' }}>R$ {ev.valor}</td>
                                                <td style={{ padding: '8px' }}>
                                                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: '#f3e8ff', color: '#6b21a8' }}>
                                                    {ev.situacao}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '8px' }}>{ev.data}</td>
                                                <td style={{ padding: '8px' }}>{ev.obs || '-'}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => iniciarEdicaoEventoNoCard(ev, card)}
                                                    style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    ✏️ Editar
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => excluirEventoDesembolsoPeloCard(String(ev.id), card)}
                                                    style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    🗑️ Excluir
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* ITEM 4: CONTEÚDO DA PÁGINA 4: GERADOR DE PARECER TÉCNICO BNB */}
                                {abaInternaCard === 'parecer' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div
                                      style={{
                                        background: '#fff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '10px',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <strong style={{ color: '#8B1530', fontSize: '12.5px' }}>
                                          📄 MODELO DE PARECER / DESPACHO:
                                        </strong>
                                        <select
                                          value={modeloParecer}
                                          onChange={(e) => {
                                            const novoMod = e.target.value as
                                              | 'APROVACAO_S522'
                                              | 'DEVOLUCAO_PENDENCIAS'
                                              | 'CONTRATACAO'
                                              | 'DESEMBOLSO';
                                            gerarParecerTecnicoDoCard(card, novoMod);
                                          }}
                                          style={{ width: 'auto', height: '32px', fontSize: '12px', fontWeight: 'bold', padding: '0 10px' }}
                                        >
                                          <option value="APROVACAO_S522">
                                            1. Encaminhamento / Aprovação à Central (PCE / S522)
                                          </option>
                                          <option value="DEVOLUCAO_PENDENCIAS">
                                            2. Despacho de Pendências / Solicitação de Regularização
                                          </option>
                                          <option value="CONTRATACAO">
                                            3. Conformidade para Emissão / Assinatura de Contrato
                                          </option>
                                          <option value="DESEMBOLSO">
                                            4. Conformidade para Liberação de Desembolso
                                          </option>
                                        </select>
                                      </div>

                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                          type="button"
                                          onClick={() => gerarParecerTecnicoDoCard(card, modeloParecer)}
                                          style={{ width: 'auto', padding: '6px 12px', fontSize: '11.5px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                          🔄 Atualizar com Dados do Card
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(textoParecerEditavel);
                                            alert('📋 Parecer Técnico copiado para a área de transferência! Pronto para colar no S400 / GED / Despacho.');
                                          }}
                                          style={{ width: 'auto', padding: '6px 14px', fontSize: '11.5px', background: '#8B1530', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                          📋 Copiar Parecer (S400 / GED)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const jan = window.open('', '_blank');
                                            if (!jan) return;
                                            jan.document.write(
                                              `<html><head><title>Parecer Técnico - ${card.clienteVinculado || 'Cliente'}</title><style>body{font-family:Arial,sans-serif;padding:30px;line-height:1.6;color:#111;}pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px;}</style></head><body><pre>${textoParecerEditavel}</pre><script>window.print();</script></body></html>`
                                            );
                                            jan.document.close();
                                          }}
                                          style={{ width: 'auto', padding: '6px 14px', fontSize: '11.5px', background: '#15803d', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                          🖨️ Imprimir / PDF
                                        </button>
                                      </div>
                                    </div>

                                    <textarea
                                      value={textoParecerEditavel}
                                      onChange={(e) => setTextoParecerEditavel(e.target.value)}
                                      rows={18}
                                      style={{
                                        width: '100%',
                                        padding: '14px',
                                        fontSize: '12.5px',
                                        lineHeight: 1.55,
                                        fontFamily: 'monospace',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        background: '#ffffff',
                                        color: '#0f172a',
                                      }}
                                    />
                                  </div>
                                )}



                              </div>
                            );
                          })()}

                        {/* ITEM 2: BARRA DE ABAS ESTILO PLANILHA EXCEL NO CENTRO DO RODAPÉ INFERIOR (Apenas com Card Maximizado) */}
                        {isFullscreen && card.etapa !== 'NOTAS' && (() => {
                          const qtdContrat = obterContratacoesDoCard(card).length;
                          const qtdDesemb = obterDesembolsosDoCard(card).evs.length;

                          return (
                            <div
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '42px',
                                background: '#e2e8f0',
                                borderTop: '1px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                padding: '0 16px',
                                gap: '6px',
                                zIndex: 20,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setAbaInternaCard('notas')}
                                style={{
                                  width: 'auto',
                                  height: '34px',
                                  padding: '0 18px',
                                  borderRadius: '8px 8px 0 0',
                                  border: '1px solid #cbd5e1',
                                  borderBottom: abaInternaCard === 'notas' ? '3px solid #8B1530' : 'none',
                                  background: abaInternaCard === 'notas' ? '#ffffff' : '#f1f5f9',
                                  color: abaInternaCard === 'notas' ? '#8B1530' : '#475569',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  boxShadow: abaInternaCard === 'notas' ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
                                }}
                              >
                                📝 1. Notas & Análise
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  iniciarEdicaoContratacaoNoCard(undefined, card);
                                  setAbaInternaCard('contratacoes');
                                }}
                                style={{
                                  width: 'auto',
                                  height: '34px',
                                  padding: '0 18px',
                                  borderRadius: '8px 8px 0 0',
                                  border: '1px solid #cbd5e1',
                                  borderBottom: abaInternaCard === 'contratacoes' ? '3px solid #1967d2' : 'none',
                                  background: abaInternaCard === 'contratacoes' ? '#ffffff' : '#f1f5f9',
                                  color: abaInternaCard === 'contratacoes' ? '#1967d2' : '#475569',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  boxShadow: abaInternaCard === 'contratacoes' ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
                                }}
                              >
                                💼 2. Contratações ({qtdContrat})
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  iniciarEdicaoEventoNoCard(undefined, card);
                                  setAbaInternaCard('desembolsos');
                                }}
                                style={{
                                  width: 'auto',
                                  height: '34px',
                                  padding: '0 18px',
                                  borderRadius: '8px 8px 0 0',
                                  border: '1px solid #cbd5e1',
                                  borderBottom: abaInternaCard === 'desembolsos' ? '3px solid #6b21a8' : 'none',
                                  background: abaInternaCard === 'desembolsos' ? '#ffffff' : '#f1f5f9',
                                  color: abaInternaCard === 'desembolsos' ? '#6b21a8' : '#475569',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  boxShadow: abaInternaCard === 'desembolsos' ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
                                }}
                              >
                                💸 3. Desembolsos ({qtdDesemb})
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  gerarParecerTecnicoDoCard(card, modeloParecer);
                                  setAbaInternaCard('parecer');
                                }}
                                style={{
                                  width: 'auto',
                                  height: '34px',
                                  padding: '0 18px',
                                  borderRadius: '8px 8px 0 0',
                                  border: '1px solid #cbd5e1',
                                  borderBottom: abaInternaCard === 'parecer' ? '3px solid #15803d' : 'none',
                                  background: abaInternaCard === 'parecer' ? '#ffffff' : '#f1f5f9',
                                  color: abaInternaCard === 'parecer' ? '#15803d' : '#475569',
                                  fontWeight: 'bold',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  boxShadow: abaInternaCard === 'parecer' ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
                                }}
                              >
                                📄 4. Parecer Técnico
                              </button>

                  
                            </div>
                          );
                        })()}

                        {!isFullscreen && (
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => toggleFullscreenCard(card.id)}
                            className="btn-expandir-card"
                            title="Expandir Tarefa em Modo Foco"
                          >
                            ⤢
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isNotas && (
                  <div
                    className="minimized-view"
                    style={{ display: isMinimized ? 'flex' : 'none' }}
                    onClick={() => setNotasMinimizadas(false)}
                    title="Clique para Expandir as Notas"
                  >
                    <span style={{ fontSize: '16px' }}>📌</span>
                    <div className="minimized-text">NOTAS / LEMBRETES</div>
                  </div>
                )}
              </div>

              {isNotas && filtroEtapa === 'TODOS' && (
                <div
                  style={{
                    width: '2px',
                    background: '#e0e0e0',
                    alignSelf: 'stretch',
                    margin: '5px 0',
                    flexShrink: 0,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {cardFullscreenId && (
        <div
          onClick={() => toggleFullscreenCard(cardFullscreenId)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'transparent',
            zIndex: 999998,
            cursor: 'pointer',
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL DE CADASTRO DE CLIENTE/OPERAÇÃO PELO "+" DO KANBAN (REGRA 4)    */}
      {/* ===================================================================== */}
      {modalNovoClienteEtapa && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '22px',
              borderRadius: '8px',
              width: '720px',
              maxWidth: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              borderTop: '5px solid var(--primary-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '16px' }}>
                  ➕ CADASTRAR CLIENTE / PROPOSTA ({TITULOS_COLUNAS[modalNovoClienteEtapa].titulo})
                </h3>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  Os dados preenchidos abaixo criarão o Card estruturado nesta etapa e salvarão o cliente automaticamente na aba de Contratações.
                </span>
              </div>
              <button
                onClick={() => setModalNovoClienteEtapa(null)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', padding: 0 }}
              >
                &times;
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 2fr 1.2fr' }}>
              <div className="form-group">
                <label>Porte do Cliente</label>
                <select value={ncPorte} onChange={(e) => setNcPorte(e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="PRONAF V">PRONAF V</option>
                  <option value="PRONAF A">PRONAF A (Isento de Garantia)</option>
                  <option value="MINI">MINI</option>
                </select>
              </div>
              <div className="form-group">
                <label>Nome Completo do Cliente</label>
                <input
                  type="text"
                  value={ncCliente}
                  onChange={(e) => setNcCliente(e.target.value)}
                  placeholder="Ex: EDILIA BARBOZA MEDEIROS"
                />
              </div>
              <div className="form-group">
                <label>CPF</label>
                <input
                  type="text"
                  value={ncCpf}
                  onChange={(e) => setNcCpf(aplicarMascaraCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              <div className="form-group">
                <label>Tipo de Operação</label>
                <select value={ncTipo} onChange={(e) => setNcTipo(e.target.value)}>
                  <option value="Investimento">Investimento</option>
                  <option value="Custeio">Custeio</option>
                  <option value="Renovação - Custeio">Renovação - Custeio</option>
                  <option value="LCGH">LCGH</option>
                  <option value="LCGA">LCGA</option>
                  <option value="Cartão BNB">Cartão BNB</option>
                </select>
              </div>
              <div className="form-group">
                <label>Valor da Proposta (R$)</label>
                <input
                  type="text"
                  value={ncValor}
                  onChange={(e) => setNcValor(aplicarMascaraMoedaInput(e.target.value))}
                  placeholder="0,00"
                />
              </div>
              <div className="form-group">
                <label>Projetista</label>
                <input
                  type="text"
                  list="dl_projetistas_kanban"
                  value={ncProjetista}
                  onChange={(e) => setNcProjetista(e.target.value)}
                  placeholder="Ex: PEDRO / ALTEMAR"
                />
              </div>
              <div className="form-group">
                <label>Etapa Oficial (Estoque)</label>
                <select value={ncSituacao} onChange={(e) => setNcSituacao(e.target.value)}>
                  <option value="Com Cliente/Projetista">Com Cliente/Projetista</option>
                  <option value="Na Agência">Na Agência (AG)</option>
                  <option value="Na Central">Na Central (S522)</option>
                  <option value="Devolvido AG">Devolvido AG</option>
                  <option value="Contratado">Contratado</option>
                </select>
              </div>
            </div>

            {/* BLOCO DE GARANTIA DA OPERAÇÃO DERIVADA (Oculto para PRONAF A) */}
            {!isNovoClientePronafA && ncTipo !== 'LCGH' && ncTipo !== 'LCGA' && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '12px',
                }}
              >
                <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr 1.2fr', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: 'var(--primary-color)' }}>
                      🛡️ Garantia da Operação (Exibida na mesma Nota)
                    </label>
                    <select
                      value={ncTipoGarantia}
                      onChange={(e) =>
                        setNcTipoGarantia(
                          e.target.value as 'NENHUMA' | 'AVAL' | 'LCGH' | 'LCGA'
                        )
                      }
                    >
                      <option value="NENHUMA">Sem Garantia Específica</option>
                      <option value="AVAL">Aval (Informar Avalista e CPF)</option>
                      <option value="LCGH">LCGH (Informar Limite/Status)</option>
                      <option value="LCGA">LCGA (Informar Limite/Status)</option>
                    </select>
                  </div>

                  {ncTipoGarantia === 'AVAL' && (
                    <>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Nome do Avalista</label>
                        <input
                          type="text"
                          value={ncAvalistaNome}
                          onChange={(e) => setNcAvalistaNome(e.target.value)}
                          placeholder="Ex: RAIMUNDO NASCIMENTO MEDEIROS"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>CPF do Avalista</label>
                        <input
                          type="text"
                          value={ncAvalistaCpf}
                          onChange={(e) => setNcAvalistaCpf(aplicarMascaraCPF(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                        />
                      </div>
                    </>
                  )}

                  {(ncTipoGarantia === 'LCGH' || ncTipoGarantia === 'LCGA') && (
                    <>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Valor do Limite {ncTipoGarantia} (R$)</label>
                        <input
                          type="text"
                          value={ncLcgValor}
                          onChange={(e) => setNcLcgValor(aplicarMascaraMoedaInput(e.target.value))}
                          placeholder="Ex: 537.285,30 (Opcional)"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Status da {ncTipoGarantia}</label>
                        <input
                          type="text"
                          value={ncLcgSituacao}
                          onChange={(e) => setNcLcgSituacao(e.target.value)}
                          placeholder="Ex: OK (AGUARDANDO ASSINAR)"
                        />
                      </div>
                    </>
                  )}
                </div>

                {(ncTipoGarantia === 'LCGH' || ncTipoGarantia === 'LCGA') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '8px', cursor: 'pointer', color: '#475569' }}>
                    <input
                      type="checkbox"
                      checked={ncCriarLinhaLcgSeparada}
                      onChange={(e) => setNcCriarLinhaLcgSeparada(e.target.checked)}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    Cadastrar também uma linha independente para esta {ncTipoGarantia} na tabela da aba Contratações
                  </label>
                )}
              </div>
            )}

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label style={{ color: 'var(--primary-color)' }}>
                  📊 SITUAÇÃO (Texto livre exibido abaixo de SITUAÇÃO no Card)
                </label>
                <textarea
                  rows={3}
                  value={ncSitDetalhada}
                  onChange={(e) => setNcSitDetalhada(e.target.value)}
                  placeholder={`Ex:\n- ENVIADO PARA A CENTRAL\n- VISITA REALIZADA`}
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'var(--accent-color)' }}>
                  📝 PENDÊNCIAS / OBSERVAÇÕES (Exibido abaixo no Card)
                </label>
                <textarea
                  rows={3}
                  value={ncObs}
                  onChange={(e) => setNcObs(e.target.value)}
                  placeholder={`Ex:\n- RENDA DO AVALISTA\n- ATUALIZAR DEC. CONSOLIDADA`}
                />
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1.2fr', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Responsável BNB</label>
                <input
                  type="text"
                  value={ncResponsavel}
                  onChange={(e) => setNcResponsavel(e.target.value)}
                  placeholder="Analista"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Telefone</label>
                <input
                  type="text"
                  value={ncTelefone}
                  onChange={(e) => setNcTelefone(e.target.value)}
                  placeholder="(99) 99999-9999"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Data</label>
                <input
                  type="text"
                  value={ncData}
                  onChange={(e) => setNcData(aplicarMascaraDataBR(e.target.value))}
                  maxLength={10}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ color: 'var(--primary-color)' }}>📑 Programa</label>
                <input
                  type="search"
                  list="dl_programas_kanban"
                  value={ncPrograma}
                  onChange={(e) => setNcPrograma(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Selecione ou digite..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
              <button
                onClick={() => setModalNovoClienteEtapa(null)}
                style={{ background: '#e2e8f0', color: '#333', padding: '9px 16px', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCriacaoClientePeloKanban}
                style={{ background: 'var(--primary-color)', color: '#fff', padding: '9px 20px', fontSize: '13px' }}
              >
                💾 Cadastrar Cliente & Criar Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO RÁPIDA SINCRONIZADA DE CARD EXISTENTE */}
      {cardEditSync && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 10000005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ background: '#fff', padding: '22px', borderRadius: '8px', width: '480px', maxWidth: '92%', boxShadow: '0 8px 25px rgba(0,0,0,0.25)' }}>
            <h4 style={{ marginTop: 0, color: 'var(--primary-color)', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              🔗 Edição Sincronizada: {cardEditSync.clienteVinculado}
            </h4>

            <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
              <div className="form-group">
                <label>Etapa Oficial na Carteira</label>
                <select
                  value={syncSitInput}
                  onChange={(e) => setSyncSitInput(e.target.value)}
                >
                  <option value="Com Cliente/Projetista">Com Cliente/Projetista</option>
                  <option value="Na Agência">Na Agência (AG)</option>
                  <option value="Na Central">Na Central (S522)</option>
                  <option value="Devolvido AG">Devolvido AG</option>
                  <option value="Contratado">Contratado</option>
                </select>
              </div>

              <div className="form-group">
                <label>Valor da Proposta (R$)</label>
                <input
                  type="text"
                  value={syncValorInput}
                  onChange={(e) => setSyncValorInput(aplicarMascaraMoedaInput(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ color: 'var(--primary-color)' }}>
                📊 SITUAÇÃO (Tópicos livres abaixo de SITUAÇÃO)
              </label>
              <textarea
                rows={3}
                value={syncSitDetalhadaInput}
                onChange={(e) => setSyncSitDetalhadaInput(e.target.value)}
                placeholder="- ENVIADO PARA A CENTRAL..."
              />
            </div>

            <div className="form-group">
              <label style={{ color: 'var(--accent-color)' }}>
                📝 PENDÊNCIAS / OBSERVAÇÕES
              </label>
              <textarea
                rows={3}
                value={syncObsInput}
                onChange={(e) => setSyncObsInput(e.target.value)}
                placeholder="- RENDA DO AVALISTA..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '15px' }}>
              <button
                onClick={() => setCardEditSync(null)}
                style={{ background: '#e2e8f0', color: '#333', padding: '8px 14px', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const atualizado: CardKanban = {
                    ...cardEditSync,
                    situacaoVinculada: syncSitInput,
                    situacaoDetalhadaVinculada: syncSitDetalhadaInput,
                    valorVinculado: syncValorInput,
                    obsVinculada: syncObsInput,
                  };
                  const novaLista = cards.map((c) =>
                    c.id === atualizado.id ? atualizado : c
                  );
                  salvarComHistorico(novaLista, false, atualizado);
                  setCardEditSync(null);
                }}
                style={{ background: 'var(--primary-color)', color: '#fff', padding: '8px 16px', fontSize: '12px' }}
              >
                💾 Salvar em Todas as Abas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AGENDAMENTO DE LEMBRETE (⏰) */}
      {modalLembreteCardId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10000005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
            <h4 style={{ marginTop: 0, color: 'var(--primary-color)' }}>⏰ Agendar Lembrete</h4>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Escolha a data e o horário (opcional).
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input
                type="date"
                value={lembreteDataInput}
                onChange={(e) => setLembreteDataInput(e.target.value)}
                style={{ flex: 2 }}
              />
              <input
                type="time"
                value={lembreteHoraInput}
                onChange={(e) => setLembreteHoraInput(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                onClick={() => {
                  const novaLista = cards.map((c) => {
                    if (c.id !== modalLembreteCardId) return c;
                    const copia = { ...c };
                    delete copia.lembreteData;
                    delete copia.lembreteHora;
                    return copia;
                  });
                  salvarComHistorico(novaLista);
                  setModalLembreteCardId(null);
                }}
                style={{ padding: '6px 12px', background: '#ffeb3b', color: '#333', fontSize: '11px' }}
              >
                Limpar Alarme
              </button>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => setModalLembreteCardId(null)}
                  style={{ padding: '6px 12px', border: '1px solid var(--primary-color)', background: '#fff', color: 'var(--primary-color)', fontSize: '12px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (lembreteDataInput) {
                      const novaLista = cards.map((c) =>
                        c.id === modalLembreteCardId
                          ? {
                              ...c,
                              lembreteData: lembreteDataInput,
                              lembreteHora: lembreteHoraInput,
                              lembreteDispensado: false,
                            }
                          : c
                      );
                      salvarComHistorico(novaLista);
                    }
                    setModalLembreteCardId(null);
                  }}
                  style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', fontSize: '12px' }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE FILTROS AVANÇADOS E ESCOLHA DE LAYOUT PARA EXPORTAÇÃO PDF     */}
      {/* ===================================================================== */}
      {modalPdfAberto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 10000008,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '22px',
              borderRadius: '8px',
              width: '680px',
              maxWidth: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              borderTop: '5px solid var(--primary-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '16px' }}>
                  🖨️ CONFIGURAR EXPORTAÇÃO DO RELATÓRIO PDF DO KANBAN
                </h3>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  Ordenação automática: Etapa ➔ Porte (MINI, PRONAF V, PRONAF A) ➔ Prioridade ➔ Maior Valor
                </span>
              </div>
              <button
                onClick={() => setModalPdfAberto(false)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', padding: 0 }}
              >
                &times;
              </button>
            </div>

            {/* 1. ESCOLHA DO LAYOUT DO PDF (ITEM 7) */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: 'var(--primary-color)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                1. Formato / Layout de Saída do PDF:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  {
                    id: 'QUADRINHOS',
                    titulo: '🗂️ Em Quadrinhos',
                    desc: 'Cards lado a lado (2 por linha), fiel ao visual do Kanban.',
                  },
                  {
                    id: 'LISTAGEM',
                    titulo: '📋 Em Listagem (Tabela)',
                    desc: 'Tabela executiva em paisagem, ideal para conferência rápida.',
                  },
                  {
                    id: 'DIDATICA_ROBUSTA',
                    titulo: '📑 Listagem Didática Robusta',
                    desc: 'Dossiê horizontal amplo separando Operações, Situação e Pendências.',
                  },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() =>
                      setPdfLayout(
                        opt.id as 'QUADRINHOS' | 'LISTAGEM' | 'DIDATICA_ROBUSTA'
                      )
                    }
                    style={{
                      border:
                        pdfLayout === opt.id
                          ? '2px solid var(--primary-color)'
                          : '1px solid #cbd5e1',
                      background: pdfLayout === opt.id ? '#f8ecee' : '#f8fafc',
                      padding: '10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--primary-color)' }}>
                      {opt.titulo}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#555', marginTop: '4px', lineHeight: 1.3 }}>
                      {opt.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. FILTRO POR TIPO DE OPERAÇÃO (DERIVADAS VS LIMITES) */}
            <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', marginBottom: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px' }}>2. Filtrar por Natureza da Operação:</label>
                <select
                  value={pdfFiltroTipoOp}
                  onChange={(e) =>
                    setPdfFiltroTipoOp(
                      e.target.value as OpcoesFiltroExportacaoPDF['filtroTipoOperacao']
                    )
                  }
                >
                  <option value="TODOS">Todas as Operações (Derivadas e Limites)</option>
                  <option value="SOMENTE_DERIVADAS_GERAL">
                    Somente Operações Derivadas (Inv / Cust / Renov / Cartão — com ou sem limite)
                  </option>
                  <option value="SOMENTE_DERIVADAS_SEM_LIMITE">
                    Somente Operações Derivadas SEM Limite LCGH/LCGA
                  </option>
                  <option value="SOMENTE_LIMITES_GERAL">
                    Somente Processos com LCGH ou LCGA
                  </option>
                  <option value="SOMENTE_LCGH">Somente Processos com LCGH</option>
                  <option value="SOMENTE_LCGA">Somente Processos com LCGA</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px' }}>3. Filtrar por Projetista (Vazio = Todos):</label>
                <select
                  multiple
                  size={2}
                  value={pdfProjetistasSel}
                  onChange={(e) =>
                    setPdfProjetistasSel(
                      Array.from(e.target.selectedOptions).map((o) => o.value)
                    )
                  }
                  style={{ height: '42px', fontSize: '11px' }}
                  title="Segure Ctrl para marcar mais de um projetista"
                >
                  {LISTA_PROJETISTAS_CURTOS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. ETAPAS / COLUNAS A INCLUIR */}
            <div style={{ marginBottom: '12px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '11.5px', color: '#334155' }}>4. Colunas / Etapas do Processo:</strong>
                <button
                  type="button"
                  onClick={() =>
                    setPdfEtapas(
                      pdfEtapas.length === 6
                        ? []
                        : [
                            'CADASTROS',
                            'PCE',
                            'S522',
                            'CONTRATOS',
                            'DESEMBOLSOS',
                            'ACOMPANHAMENTO',
                          ]
                    )
                  }
                  style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '11px', padding: 0 }}
                >
                  {pdfEtapas.length === 6 ? 'Desmarcar Todas' : 'Marcar Todas'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {(
                  [
                    'CADASTROS',
                    'PCE',
                    'S522',
                    'CONTRATOS',
                    'DESEMBOLSOS',
                    'ACOMPANHAMENTO',
                  ] as EtapaKanban[]
                ).map((et) => (
                  <label key={et} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={pdfEtapas.includes(et)}
                      onChange={(e) => {
                        if (e.target.checked) setPdfEtapas([...pdfEtapas, et]);
                        else setPdfEtapas(pdfEtapas.filter((x) => x !== et));
                      }}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    {NOMES_AMIGAVEIS[et]}
                  </label>
                ))}
              </div>
            </div>

            {/* 4. PORTES E PRIORIDADES */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1.3fr', gap: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '11.5px', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  5. Portes (Ordem: MINI ➔ PRONAF V ➔ PRONAF A):
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['MINI', 'PRONAF V', 'PRONAF A', 'GERAL / OUTROS'].map((prt) => (
                    <label key={prt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={pdfPortes.includes(prt)}
                        onChange={(e) => {
                          if (e.target.checked) setPdfPortes([...pdfPortes, prt]);
                          else setPdfPortes(pdfPortes.filter((x) => x !== prt));
                        }}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      {prt}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '11.5px', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  6. Classificações / Prioridades:
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { cor: 'azul', nome: '🔵 Em Análise' },
                    { cor: 'vermelho', nome: '🔴 Prioritário' },
                    { cor: 'amarelo', nome: '🟡 Pendente Geral' },
                    { cor: 'verde', nome: '🟢 Concluído' },
                  ].map((pr) => (
                    <label key={pr.cor} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={pdfPrioridades.includes(pr.cor as StatusCorKanban)}
                        onChange={(e) => {
                          const c = pr.cor as StatusCorKanban;
                          if (e.target.checked)
                            setPdfPrioridades([...pdfPrioridades, c]);
                          else
                            setPdfPrioridades(
                              pdfPrioridades.filter((x) => x !== c)
                            );
                        }}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      {pr.nome}
                    </label>
                  ))}
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #cbd5e1',
                    color: '#6b21a8',
                    marginBottom: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pdfIncluirArquivados}
                    onChange={(e) => setPdfIncluirArquivados(e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  🟣 Incluir também clientes marcados como &quot;Arquivados&quot; na exportação
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setPdfProjetistasSel([]);
                  setPdfFiltroTipoOp('TODOS');
                  setPdfIncluirArquivados(false);
                }}
                style={{ background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', padding: '7px 12px', fontSize: '11px' }}
              >
                🧹 Limpar Filtros Extras
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setModalPdfAberto(false)}
                  style={{ background: '#e2e8f0', color: '#333', padding: '9px 16px', fontSize: '12px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const priosFinais: StatusCorKanban[] = pdfIncluirArquivados
                      ? Array.from(new Set([...pdfPrioridades, 'roxo']))
                      : pdfPrioridades;

                    exportarKanbanParaPDFExecutivo(cards, {
                      etapas: pdfEtapas,
                      portes: pdfPortes,
                      prioridades: priosFinais,
                      incluirArquivados: pdfIncluirArquivados,
                      filtroTipoOperacao: pdfFiltroTipoOp,
                      projetistas: pdfProjetistasSel,
                      layoutSaida: pdfLayout,
                    });
                    setModalPdfAberto(false);
                  }}
                  style={{ background: 'var(--primary-color)', color: '#fff', padding: '9px 20px', fontSize: '13px' }}
                >
                  🖨️ Gerar PDF Agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}