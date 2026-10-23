'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, } from 'react';
import {
  CardKanban,
  EtapaKanban,
  StatusCorKanban,
  RegistroContratacao,
} from '@/types/painel';
import {
  getHojeISO,
  getHojeBR,
  LISTA_PROJETISTAS_CURTOS,
  obterListaProgramas,
  isEnquadradoCadaVezMelhor,
  buscarTelefoneProjetista,
  aplicarMascaraCPF,
  aplicarMascaraMoedaInput,
  aplicarMascaraDataBR,
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
  onAtualizarCards: (novos: CardKanban[]) => void;
  onCardSincronizadoAlterado?: (
    cardAtualizado: CardKanban,
    todosOsCards: CardKanban[]
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
  onAlterarSituacaoDesembolsoPeloKanban?: (
    card: CardKanban,
    novaSituacaoDesembolso: string
  ) => void;
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
  onAtualizarCards,
  onCardSincronizadoAlterado,
  onCriarClientePeloKanban,
  onSincronizarBaseCompleta,
  cardDestaqueExternoId,
  onLimparDestaqueExterno,
  onAbrirClienteEmContratacoes,
  onAbrirClienteEmDesembolsos,
  onAlterarSituacaoDesembolsoPeloKanban,
}: ModuloKanbanProps) {
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroCor, setFiltroCor] = useState<'TODOS' | StatusCorKanban>('TODOS');
  const [filtroEtapa, setFiltroEtapa] = useState<'TODOS' | 'ARQUIVADOS' | EtapaKanban>('TODOS');

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

  useEffect(() => {
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

    if (historico.length === 0 && limpos.length >= 0) {
      const snap = JSON.stringify(limpos);
      setHistorico([snap]);
      setPonteiroHist(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setHistorico((prev) => {
          const cortado = prev.slice(0, ponteiroHist + 1);
          if (cortado[cortado.length - 1] === snap) return cortado;
          const novo = [...cortado, snap];
          if (novo.length > 50) novo.shift();
          setPonteiroHist(novo.length - 1);
          return novo;
        });
      }
    },
    [onAtualizarCards, onCardSincronizadoAlterado, ponteiroHist]
  );

  const desfazer = useCallback(() => {
    if (ponteiroHist > 0) {
      const novoPonteiro = ponteiroHist - 1;
      const restaurado = JSON.parse(historico[novoPonteiro]) as CardKanban[];
      setPonteiroHist(novoPonteiro);
      onAtualizarCards(restaurado);
    }
  }, [ponteiroHist, historico, onAtualizarCards]);

  const refazer = useCallback(() => {
    if (ponteiroHist < historico.length - 1) {
      const novoPonteiro = ponteiroHist + 1;
      const restaurado = JSON.parse(historico[novoPonteiro]) as CardKanban[];
      setPonteiroHist(novoPonteiro);
      onAtualizarCards(restaurado);
    }
  }, [ponteiroHist, historico, onAtualizarCards]);

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

  // ITEM 7: Altera a Situação do Desembolso pela 2ª Tarja e sincroniza com a aba de Desembolsos!
  const alterarSituacaoDesembolsoPelaTarja = (
    card: CardKanban,
    novaSitDesemb: string
  ) => {
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
          novaSitDesemb === 'Finalizado'
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
    onAlterarSituacaoDesembolsoPeloKanban?.(atualizado, novaSitDesemb);
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

    let cardModificado: CardKanban | undefined;

    const novos = cards.map((c) => {
      if (c.id !== cardId) return c;
      cardModificado = {
        ...c,
        texto: novoHtml,
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
      true,
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

  // ITEM 4.1, 4.2 e 4.3: Regras de visibilidade dos cards Arquivados ('roxo')
  const cardPassaNoFiltro = (card: CardKanban): boolean => {
    const isArquivado = card.statusCor === 'roxo';

    // Se clicou na guia "📦 ARQUIVADOS", mostra apenas os cards que estão arquivados!
    if (filtroEtapa === 'ARQUIVADOS') {
      if (!isArquivado) return false;
    } else {
      // Se NÃO está na guia Arquivados:
      // Os arquivados ficam ocultos em "👁️ VER TODAS" e nas colunas normais,
      // EXCETO se o usuário digitou algo na busca (Item 4.2) ou filtrou especificamente pela cor roxa!
      if (isArquivado && !temBuscaTextoAtiva && filtroCor !== 'roxo') {
        return false;
      }
      if (filtroEtapa !== 'TODOS' && card.etapa !== filtroEtapa) {
        return false;
      }
    }

    if (filtroCor !== 'TODOS' && card.statusCor !== filtroCor) return false;

    if (temBuscaTextoAtiva) {
      const puro = (card.textoPuro || extrairTextoPuro(card.texto)).toLowerCase();
      if (!puro.includes(termoBusca.toLowerCase().trim())) return false;
    }
    return true;
  };

  const modoFiltroCruzadoAtivo =
    temBuscaTextoAtiva || filtroCor !== 'TODOS' || filtroEtapa === 'ARQUIVADOS';

  // ITEM 5: Conta quantas colunas possuem resultados visíveis no momento.
  // Se apenas 1 coluna tiver resultados (ex: numa busca por nome ou ao selecionar 1 guia),
  // ela ganha automaticamente a classe .focus-single (cards largos com altura vertical completa)!
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

          {onSincronizarBaseCompleta && (
            <>
              <div className="toolbar-divisor" />
              <button
                onClick={onSincronizarBaseCompleta}
                style={{
                  background: '#e8f0fe',
                  border: '1px solid #a8c7fa',
                  color: '#1967d2',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                }}
                title="Agrupa e sincroniza os clientes e garantias da aba Contratações para o Kanban"
              >
                🔄 Sincronizar
              </button>
              <button
                onClick={() => setModalPdfAberto(true)}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#8B1530',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  marginLeft: '4px',
                }}
                title="Gera um PDF Executivo separado por Etapa, Porte e Prioridades (Ocultando o Espaço para Análise)"
              >
                🖨️ Exportar PDF
              </button>
            </>
          )}
        </div>

        {/* Busca Global, Filtro de Cor e Botões Desfazer/Refazer */}
        <div style={{ display: 'flex', flex: 1, minWidth: '250px', maxWidth: '420px', margin: '0 10px', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="🔍 Pesquisar tarefa, cliente, nota ou CPF..."
            style={{
              flex: 1,
              padding: '8px 15px',
              border: '1px solid #ccc',
              borderRadius: '20px',
              fontSize: '12px',
              background: '#f9f9f9',
            }}
          />

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

        {/* Botões de Filtro de Coluna */}
        <div className="kanban-filter-controls">
          <button
            className={`btn-filter-kanban ${filtroEtapa === 'TODOS' ? 'active' : ''}`}
            onClick={() => setFiltroEtapa('TODOS')}
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
              padding: '6px 10px',
              fontSize: '13px',
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
          // Em modo normal, o contador do topo da coluna ignora os arquivados para não confundir
          const totalRealColuna = cards.filter(
            (c) =>
              c.etapa === etapa &&
              (filtroEtapa === 'ARQUIVADOS'
                ? c.statusCor === 'roxo'
                : c.statusCor !== 'roxo')
          ).length;

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
          const isMinimized =
            isNotas &&
            notasMinimizadas &&
            !modoFiltroCruzadoAtivo &&
            filtroEtapa === 'TODOS';

          // ITEM 5: Fica em modo expandido vertical (.focus-single) se o usuário clicou na guia da coluna
          // OU se uma pesquisa/filtro deixou apenas esta coluna com resultados na tela!
          const isFocusSingle =
            (filtroEtapa === etapa && !modoFiltroCruzadoAtivo) ||
            etapasComCardsVisiveis.length === 1;

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

                                    {/* ITEM 7: Segunda Tarja (Situação do Desembolso) ao lado direito quando Contratado / Desembolso */}
                                    {(card.situacaoVinculada === 'Contratado' ||
                                      card.etapa === 'DESEMBOLSOS' ||
                                      card.etapa === 'ACOMPANHAMENTO') && (
                                      <select
                                        value={
                                          card.situacaoDesembolsoVinculada ||
                                          'Desembolso Solicitado'
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
                                              'Finalizado'
                                              ? '#dcfce7'
                                              : card.situacaoDesembolsoVinculada ===
                                                  'Desembolso Pendente' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Não Desembolsar'
                                              ? '#fee2e2'
                                              : '#f3e8ff',
                                          color:
                                            card.situacaoDesembolsoVinculada ===
                                              'Desembolso Efetivado' ||
                                            card.situacaoDesembolsoVinculada ===
                                              'Finalizado'
                                              ? '#15803d'
                                              : card.situacaoDesembolsoVinculada ===
                                                  'Desembolso Pendente' ||
                                                card.situacaoDesembolsoVinculada ===
                                                  'Não Desembolsar'
                                              ? '#b91c1c'
                                              : '#6b21a8',
                                          border: '1px solid rgba(107,33,168,0.25)',
                                        }}
                                        title="Situação do Desembolso (Sincronizada com a aba Desembolsos)"
                                      >
                                        <option value="Desembolso Solicitado" style={{ background: '#fff', color: '#333' }}>
                                          💸 Desemb. Solicitado
                                        </option>
                                        <option value="Em Análise" style={{ background: '#fff', color: '#333' }}>
                                          💸 Desemb. Em Análise
                                        </option>
                                        <option value="Desembolso Pendente" style={{ background: '#fff', color: '#333' }}>
                                          💸 Desemb. Pendente
                                        </option>
                                        <option value="Desembolso Liberado" style={{ background: '#fff', color: '#333' }}>
                                          💸 Desemb. Liberado
                                        </option>
                                        <option value="Desembolso Efetivado" style={{ background: '#fff', color: '#333' }}>
                                          💸 Desemb. Efetivado
                                        </option>
                                        <option value="Finalizado" style={{ background: '#fff', color: '#333' }}>
                                          💸 Finalizado
                                        </option>
                                        <option value="Não Desembolsar" style={{ background: '#fff', color: '#333' }}>
                                          💸 Não Desembolsar
                                        </option>
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
                                    ✅ Emojis ▾
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
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(7, 1fr)',
                                        gap: '4px',
                                        width: '230px',
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

                            {/* ITEM 7: Segunda Tarja compacta ao lado direito quando Contratado / Desembolso */}
                            {(card.situacaoVinculada === 'Contratado' ||
                              card.etapa === 'DESEMBOLSOS' ||
                              card.etapa === 'ACOMPANHAMENTO') && (
                              <select
                                value={
                                  card.situacaoDesembolsoVinculada ||
                                  'Desembolso Solicitado'
                                }
                                onChange={(e) =>
                                  alterarSituacaoDesembolsoPelaTarja(
                                    card,
                                    e.target.value
                                  )
                                }
                                style={{
                                  width: 'auto',
                                  maxWidth: '140px',
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
                                      'Finalizado'
                                      ? '#dcfce7'
                                      : card.situacaoDesembolsoVinculada ===
                                          'Desembolso Pendente' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Não Desembolsar'
                                      ? '#fee2e2'
                                      : '#f3e8ff',
                                  color:
                                    card.situacaoDesembolsoVinculada ===
                                      'Desembolso Efetivado' ||
                                    card.situacaoDesembolsoVinculada ===
                                      'Finalizado'
                                      ? '#15803d'
                                      : card.situacaoDesembolsoVinculada ===
                                          'Desembolso Pendente' ||
                                        card.situacaoDesembolsoVinculada ===
                                          'Não Desembolsar'
                                      ? '#b91c1c'
                                      : '#6b21a8',
                                  border: '1px solid rgba(107,33,168,0.25)',
                                }}
                                title="Situação do Desembolso"
                              >
                                <option value="Desembolso Solicitado" style={{ background: '#fff', color: '#333' }}>
                                  💸 Solicitado
                                </option>
                                <option value="Em Análise" style={{ background: '#fff', color: '#333' }}>
                                  💸 Em Análise
                                </option>
                                <option value="Desembolso Pendente" style={{ background: '#fff', color: '#333' }}>
                                  💸 Pendente
                                </option>
                                <option value="Desembolso Liberado" style={{ background: '#fff', color: '#333' }}>
                                  💸 Liberado
                                </option>
                                <option value="Desembolso Efetivado" style={{ background: '#fff', color: '#333' }}>
                                  💸 Efetivado
                                </option>
                                <option value="Finalizado" style={{ background: '#fff', color: '#333' }}>
                                  💸 Finalizado
                                </option>
                                <option value="Não Desembolsar" style={{ background: '#fff', color: '#333' }}>
                                  💸 Não Desembolsar
                                </option>
                              </select>
                            )}
                          </div>
                        )}

                        {/* ITEM 4 e ITEM 5: Para cards de clientes, o contêiner externo tem contentEditable={false}
                            (protegendo os títulos fixos e permitindo selecionar o cabeçalho), enquanto as 3 caixas internas são editáveis! */}
                        <div
                          className="card-editor"
                          contentEditable={
                            card.etapa === 'NOTAS' ||
                            !card.texto.includes('bloco-editavel-')
                          }
                          suppressContentEditableWarning
                          style={estiloNotaConcluida}
                          onPaste={handleSmartPasteCard}
                          onMouseDown={() => setDragHabilitadoId(null)}
                          onFocus={() => {
                            if (isFullscreen) limparGrifosBuscaInterna(card.id);
                          }}
                          onBlur={(e) => {
                            // Só dispara o salvamento quando o foco realmente sai de dentro do card
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