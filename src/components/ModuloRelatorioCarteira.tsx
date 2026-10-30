'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';

import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

import ModuloKanban from '@/components/ModuloKanban';

import BotaoInfoSomaEstoque, {
  SimulacaoEstoqueCarteira,
} from '@/components/ModalDetalheSomaEstoque';

import {
  salvarFerramentasSync,
  carregarFerramentasSync,
  salvarKanbanSync,
  salvarContratacoesSync,
  salvarDesembOpSync,
  salvarDesembEvSync,
  lerCacheLocal,
  STORAGE_KEYS_V2,
} from '@/lib/firebaseSync';

import {
  localizarCardDoClienteNoKanban,
  montarHtmlCardSincronizado,
} from '@/lib/integradorSincronizado';

import {
  parseMoeda,
  formatarMoedaBD,
  isEnquadradoCadaVezMelhor,
  getHojeBR,
} from '@/lib/utils';

import {
  RegistroContratacao,
  CardKanban,
  OperacaoBaseDesembolso,
  EventoDesembolso,
} from '@/types/painel';

interface ModuloRelatorioCarteiraProps {
  contratacoes: RegistroContratacao[];
  cardsKanban: CardKanban[];
}

interface ParametrosOficiaisBanco {
  carteira: string;
  categorizacao: string;
  pontuacao: number;
  receitaEstAnual: number;
  gestaoAtivo: number;
  fneContratacao: number;
  fneDesembolso: number;
  pronafRealizadoOficial: number;
  pronafMetaPeriodo: number;
  pronafMetaAnual: number;
  pronafMetaPontos: number;
  pronafPontosFeitos: number;

  miniRealizadoOficial: number;
  miniMetaPeriodo: number;
  miniMetaAnual: number;
  miniMetaPontos: number;
  miniPontosFeitos: number;

  cvmRealizadoOficial: number;
  cvmMetaPeriodo: number;
  cvmMetaAnual: number;
  cvmMetaPontos: number;
  cvmPontosFeitos: number;

  reembolsoRealizado: number;
  reembolsoMetaPeriodo: number;
  reembolsoMetaPontos: number;
  reembolsoPontosFeitos: number;
}

type EtapaEstoqueKey = 'AG' | 'CENTRAL' | 'DEVOLVIDO_AG' | 'RENOV_CUSTEIO';

interface GrupoEstoqueDetalhado {
  AG: number;
  CENTRAL: number;
  DEVOLVIDO_AG: number;
  RENOV_CUSTEIO: number;
  total: number;
  propostas: {
    AG: RegistroContratacao[];
    CENTRAL: RegistroContratacao[];
    DEVOLVIDO_AG: RegistroContratacao[];
    RENOV_CUSTEIO: RegistroContratacao[];
    todas: RegistroContratacao[];
  };
}

function criarGrupoEstoqueVazio(): GrupoEstoqueDetalhado {
  return {
    AG: 0,
    CENTRAL: 0,
    DEVOLVIDO_AG: 0,
    RENOV_CUSTEIO: 0,
    total: 0,
    propostas: {
      AG: [],
      CENTRAL: [],
      DEVOLVIDO_AG: [],
      RENOV_CUSTEIO: [],
      todas: [],
    },
  };
}

const STORAGE_KEY_PARAMETROS_CARTEIRA = 'bnb_v2_parametros_oficiais_carteira';
const STORAGE_KEY_SIMULACAO_CARTEIRA = 'bnb_v2_simulacao_hipotetica_carteira';

const SIMULACAO_VAZIA: SimulacaoEstoqueCarteira = {
  idsDesmarcados: [],
  valoresCustomizados: {},
  modoFlexivelAtivo: false,
};

const PARAMETROS_INICIAIS: ParametrosOficiaisBanco = {
  carteira: '3332',
  categorizacao: '1',
  pontuacao: 58.74,
  receitaEstAnual: 0.0226,
  gestaoAtivo: 0.9223,
  fneContratacao: 0.3631,
  fneDesembolso: 1.5933,

  pronafRealizadoOficial: 986005.0,
  pronafMetaPeriodo: 2801400.0,
  pronafMetaAnual: 4060000.0,
  pronafMetaPontos: 9.0,
  pronafPontosFeitos: 3.17,

  miniRealizadoOficial: 287348.0,
  miniMetaPeriodo: 2090700.0,
  miniMetaAnual: 3030000.0,
  miniMetaPontos: 9.0,
  miniPontosFeitos: 0.0,

  cvmRealizadoOficial: 80172.0,
  cvmMetaPeriodo: 1027341.0,
  cvmMetaAnual: 1488900.0,
  cvmMetaPontos: 9.0,
  cvmPontosFeitos: 0.0,

  reembolsoRealizado: 3106838.51,
  reembolsoMetaPeriodo: 4317849.71,
  reembolsoMetaPontos: 10.0,
  reembolsoPontosFeitos: 0.0,
};

// Classifica subgrupo dentro de PRONAF para ordenação: 1º PRONAF Mulher/CVM, 2º PRONAF Comum, 3º PRONAF A
function classificarSubgrupoPronaf(
  reg: RegistroContratacao
): 'PRONAF_MULHER_CVM' | 'PRONAF_COMUM' | 'PRONAF_A' {
  const porteUp = (reg.porte || '').toUpperCase().trim();
  if (porteUp === 'PRONAF A') return 'PRONAF_A';
  const progUp = (reg.programa || '').toUpperCase().trim();
  if (
    progUp.includes('MULHER') ||
    progUp.includes('406') ||
    isEnquadradoCadaVezMelhor(reg.programa, reg.cadaVezMelhor)
  ) {
    return 'PRONAF_MULHER_CVM';
  }
  return 'PRONAF_COMUM';
}

export default function ModuloRelatorioCarteira({
  contratacoes,
  cardsKanban,
}: ModuloRelatorioCarteiraProps) {
  const [params, setParams] = useState<ParametrosOficiaisBanco>(PARAMETROS_INICIAIS);
  const [modoEdicaoParametros, setModoEdicaoParametros] = useState(false);
  const [considerarArquivados, setConsiderarArquivados] = useState(false);

  // Estados vivos para permitir edição real no Card Expandido do Kanban sem sair desta aba
  const [listaContratacoes, setListaContratacoes] = useState<RegistroContratacao[]>(contratacoes);
  const [listaCards, setListaCards] = useState<CardKanban[]>(cardsKanban);
  const [listaOpBase, setListaOpBase] = useState<OperacaoBaseDesembolso[]>([]);
  const [listaEventos, setListaEventos] = useState<EventoDesembolso[]>([]);
  const [cardOverlayKanbanId, setCardOverlayKanbanId] = useState<string | null>(null);

  useEffect(() => {
    setListaContratacoes(contratacoes);
  }, [contratacoes]);

  useEffect(() => {
    setListaCards(cardsKanban);
  }, [cardsKanban]);

  useEffect(() => {
    setListaOpBase(lerCacheLocal<OperacaoBaseDesembolso[]>(STORAGE_KEYS_V2.DESEMB_OP, []));
    setListaEventos(lerCacheLocal<EventoDesembolso[]>(STORAGE_KEYS_V2.DESEMB_EV, []));
  }, []);

  const propagarAlteracaoRealParaSistema = (
    novosCards: CardKanban[],
    novasContratacoes?: RegistroContratacao[]
  ) => {
    setListaCards(novosCards);
    salvarKanbanSync(novosCards).catch(() => {});

    if (novasContratacoes) {
      setListaContratacoes(novasContratacoes);
      salvarContratacoesSync(novasContratacoes).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bnb_v2_sync_externo', {
          detail: {
            cards: novosCards,
            contratacoes: novasContratacoes || listaContratacoes,
          },
        })
      );
    }
  };

  // Abre o Card Expandido do cliente por cima do Modal de Composição do Valor
  const handleAbrirCardKanbanDoCliente = useCallback(
    (proposta: RegistroContratacao) => {
      const cardExistente = localizarCardDoClienteNoKanban(proposta, listaCards);
      if (cardExistente) {
        setCardOverlayKanbanId(cardExistente.id);
        return;
      }

      // Caso o cliente ainda não possua card no Kanban, cria automaticamente e abre!
      const idNovoCard = `wk_auto_${Date.now()}`;
      const { html, textoPuro } = montarHtmlCardSincronizado({
        cliente: proposta.cliente,
        cpf: proposta.cpf || '',
        porte: proposta.porte || 'PRONAF V',
        projetista: proposta.projetista || '',
        tipo: proposta.tipo || 'Investimento',
        valor: proposta.valor || '0,00',
        situacaoMacro: proposta.situacao || 'Na Agência',
        situacaoDetalhada: proposta.situacaoDetalhada || `- ${proposta.situacao || 'Na Agência'}`,
        pendenciasObs: proposta.obs || 'Verificar andamento.',
        programa: proposta.programa || '',
        operacoesAgrupadas: [
          {
            id: String(proposta.id),
            tipo: proposta.tipo || 'Investimento',
            valor: proposta.valor || '0,00',
            situacao: proposta.situacao,
            detalheExtra: proposta.programa,
          },
        ],
      });

      const novoCard: CardKanban = {
        id: idNovoCard,
        etapa:
          proposta.situacao === 'Na Central' || proposta.situacao === 'Devolvido AG'
            ? 'S522'
            : proposta.situacao === 'F. Assinar' || proposta.situacao === 'F. Conformidade'
            ? 'CONTRATOS'
            : 'PCE',
        statusCor: proposta.situacao === 'Devolvido AG' ? 'vermelho' : 'azul',
        texto: html,
        textoPuro,
        dataModificacao: new Date().toISOString().split('T')[0],
        propostaIdVinculada: String(proposta.id),
        idsPropostasAgrupadas: [String(proposta.id)],
        clienteVinculado: proposta.cliente,
        cpfVinculado: proposta.cpf,
        porteVinculado: proposta.porte,
        valorVinculado: proposta.valor,
        tipoOpVinculado: proposta.tipo,
        situacaoVinculada: proposta.situacao,
        situacaoDetalhadaVinculada: proposta.situacaoDetalhada,
        obsVinculada: proposta.obs,
      };

      const atualizados = [novoCard, ...listaCards];
      propagarAlteracaoRealParaSistema(atualizados);
      setCardOverlayKanbanId(novoCard.id);
    },
    [listaCards, listaContratacoes]
  );

  // Estado da Simulação Hipotética (Salvo no LocalStorage e no Firebase)
  const [simulacao, setSimulacao] =
    useState<SimulacaoEstoqueCarteira>(SIMULACAO_VAZIA);

  // Estados do Modal de Exportação PDF Executivo da Planilha da Carteira
  const [modalPdfAberto, setModalPdfAberto] = useState(false);
  const [pdfModoBase, setPdfModoBase] = useState<'SIMULACAO_ATUAL' | 'PADRAO_OFICIAL'>(
    'SIMULACAO_ATUAL'
  );
  const [pdfSecaoIdentificacao, setPdfSecaoIdentificacao] = useState(true);
  const [pdfSecaoFaixasAnuais, setPdfSecaoFaixasAnuais] = useState(true);
  const [pdfSecaoIndicadoresMetas, setPdfSecaoIndicadoresMetas] = useState(true);
  const [pdfSecaoQuadrosEstoque, setPdfSecaoQuadrosEstoque] = useState(true);
  const [pdfListaNominalPronaf, setPdfListaNominalPronaf] = useState(true);
  const [pdfListaNominalCvm, setPdfListaNominalCvm] = useState(true);
  const [pdfListaNominalMini, setPdfListaNominalMini] = useState(true);
  const [pdfEtapasIncluidas, setPdfEtapasIncluidas] = useState<EtapaEstoqueKey[]>([
    'AG',
    'CENTRAL',
    'DEVOLVIDO_AG',
    'RENOV_CUSTEIO',
  ]);

  const [pdfModoNominalSimplificado, setPdfModoNominalSimplificado] =
    useState(false);

  // Carrega parâmetros e simulação salvos localmente e na Nuvem Firebase V2
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const salvoParams = window.localStorage.getItem(STORAGE_KEY_PARAMETROS_CARTEIRA);
      if (salvoParams) {
        setParams({ ...PARAMETROS_INICIAIS, ...JSON.parse(salvoParams) });
      }
      const salvoSim = window.localStorage.getItem(STORAGE_KEY_SIMULACAO_CARTEIRA);
      if (salvoSim) {
        setSimulacao({ ...SIMULACAO_VAZIA, ...JSON.parse(salvoSim) });
      }
    } catch {
      // Ignora erro local
    }

    carregarFerramentasSync()
      .then((dadosNuvem) => {
        if (
          dadosNuvem?.parametrosCarteira &&
          typeof dadosNuvem.parametrosCarteira === 'object'
        ) {
          const mesclado = {
            ...PARAMETROS_INICIAIS,
            ...(dadosNuvem.parametrosCarteira as Partial<ParametrosOficiaisBanco>),
          };
          setParams(mesclado);
          window.localStorage.setItem(
            STORAGE_KEY_PARAMETROS_CARTEIRA,
            JSON.stringify(mesclado)
          );
        }
        if (
          dadosNuvem?.simulacaoEstoqueCarteira &&
          typeof dadosNuvem.simulacaoEstoqueCarteira === 'object'
        ) {
          const simNuvem = {
            ...SIMULACAO_VAZIA,
            ...(dadosNuvem.simulacaoEstoqueCarteira as Partial<SimulacaoEstoqueCarteira>),
          };
          setSimulacao(simNuvem);
          window.localStorage.setItem(
            STORAGE_KEY_SIMULACAO_CARTEIRA,
            JSON.stringify(simNuvem)
          );
        }
      })
      .catch(() => {});
  }, []);

  const salvarSimulacao = useCallback((nova: SimulacaoEstoqueCarteira) => {
    setSimulacao(nova);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        STORAGE_KEY_SIMULACAO_CARTEIRA,
        JSON.stringify(nova)
      );
      salvarFerramentasSync({ simulacaoEstoqueCarteira: nova }).catch(() => {});
    }
  }, []);

  const handleTogglePropostaSimulacao = useCallback(
    (idProposta: string) => {
      const atuais = new Set(simulacao.idsDesmarcados || []);
      if (atuais.has(idProposta)) atuais.delete(idProposta);
      else atuais.add(idProposta);
      salvarSimulacao({
        ...simulacao,
        idsDesmarcados: Array.from(atuais),
      });
    },
    [simulacao, salvarSimulacao]
  );

  const handleToggleVariasPropostasSimulacao = useCallback(
    (ids: string[], marcar: boolean) => {
      const atuais = new Set(simulacao.idsDesmarcados || []);
      ids.forEach((id) => {
        if (marcar) atuais.delete(id);
        else atuais.add(id);
      });
      salvarSimulacao({
        ...simulacao,
        idsDesmarcados: Array.from(atuais),
      });
    },
    [simulacao, salvarSimulacao]
  );

  const handleAlterarValorProvisorio = useCallback(
    (idProposta: string, novoValor: string | null) => {
      const copiaValores = { ...(simulacao.valoresCustomizados || {}) };
      if (novoValor === null) {
        delete copiaValores[idProposta];
      } else {
        copiaValores[idProposta] = novoValor;
      }
      salvarSimulacao({
        ...simulacao,
        valoresCustomizados: copiaValores,
      });
    },
    [simulacao, salvarSimulacao]
  );

  const handleToggleModoFlexivel = useCallback(
    (ativo: boolean) => {
      salvarSimulacao({
        ...simulacao,
        modoFlexivelAtivo: ativo,
      });
    },
    [simulacao, salvarSimulacao]
  );

  const limparFiltrosSimulacao = () => {
    salvarSimulacao(SIMULACAO_VAZIA);
  };

  const qtdAlteracoesSimulacao =
    (simulacao.idsDesmarcados?.length || 0) +
    Object.keys(simulacao.valoresCustomizados || {}).length;

  const atualizarParametro = <K extends keyof ParametrosOficiaisBanco>(
    chave: K,
    valor: ParametrosOficiaisBanco[K]
  ) => {
    setParams((prev) => {
      const novo = { ...prev, [chave]: valor };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEY_PARAMETROS_CARTEIRA,
          JSON.stringify(novo)
        );
        window.dispatchEvent(new Event('bnb_parametros_carteira_atualizados'));
        salvarFerramentasSync({ parametrosCarteira: novo }).catch(() => {});
      }
      return novo;
    });
  };

  // =========================================================================
  // FUNÇÃO GERADORA DE APURAÇÃO (Suporta tanto a Simulação Hipotética quanto o Padrão Oficial)
  // =========================================================================
  const calcularApuracao = useCallback(
    (usarSimulacaoHipotetica: boolean) => {
      const estoque = {
        pronaf: criarGrupoEstoqueVazio(),
        mini: criarGrupoEstoqueVazio(),
        cvm: criarGrupoEstoqueVazio(),
        pronafA: criarGrupoEstoqueVazio(),
      };

      const realizadoNaBase = {
        pronaf: 0,
        mini: 0,
        cvm: 0,
      };

      const idsDesmarcadosSet = new Set(
        usarSimulacaoHipotetica ? simulacao.idsDesmarcados || [] : []
      );
      const mapaValoresCustom = usarSimulacaoHipotetica
        ? simulacao.valoresCustomizados || {}
        : {};

      let qtdExcluidasLCG = 0;
      let qtdNoEstoque = 0;

      (Array.isArray(listaContratacoes) ? listaContratacoes : []).forEach((reg) => {
        const tipoUpper = (reg.tipo || '').toUpperCase().trim();
        if (tipoUpper === 'LCGH' || tipoUpper === 'LCGA') {
          qtdExcluidasLCG++;
          return;
        }

        const idStr = String(reg.id);
        const valorEfetivoStr =
          mapaValoresCustom[idStr] !== undefined
            ? mapaValoresCustom[idStr]
            : reg.valor;
        const val = parseMoeda(valorEfetivoStr);
        if (val <= 0 && parseMoeda(reg.valor) <= 0) return;

        const porteUpper = (reg.porte || '').toUpperCase().trim();
        const isPronafA = porteUpper === 'PRONAF A';
        const isPronafGeral = porteUpper.includes('PRONAF');
        const isMini = porteUpper === 'MINI';
        const isCVM =
          isPronafGeral &&
          isEnquadradoCadaVezMelhor(reg.programa, reg.cadaVezMelhor);

        if (reg.situacao === 'Contratado') {
          const valReal = parseMoeda(reg.valor);
          if (isPronafGeral) realizadoNaBase.pronaf += valReal;
          if (isMini) realizadoNaBase.mini += valReal;
          if (isCVM) realizadoNaBase.cvm += valReal;
          return;
        }

        const card = localizarCardDoClienteNoKanban(reg, listaCards);
        const isArquivado = card?.statusCor === 'roxo';
        if (isArquivado && !considerarArquivados) {
          return;
        }

        let etapaEstoque: EtapaEstoqueKey = 'AG';
        if (tipoUpper.includes('RENOV')) {
          etapaEstoque = 'RENOV_CUSTEIO';
        } else if (
          reg.situacao === 'Na Central' ||
          reg.situacao === 'F. Assinar' ||
          reg.situacao === 'F. Conformidade'
        ) {
          etapaEstoque = 'CENTRAL';
        } else if (reg.situacao === 'Devolvido AG') {
          etapaEstoque = 'DEVOLVIDO_AG';
        } else {
          etapaEstoque = 'AG';
        }

        const estaMarcadaNaSimulacao = !idsDesmarcadosSet.has(idStr);
        if (estaMarcadaNaSimulacao) {
          qtdNoEstoque++;
        }

        // Guarda a proposta na lista do modal (i), mas só soma o valor se estiver marcada!
        const adicionarAoGrupo = (grupo: GrupoEstoqueDetalhado) => {
          grupo.propostas[etapaEstoque].push(reg);
          grupo.propostas.todas.push(reg);
          if (estaMarcadaNaSimulacao) {
            grupo[etapaEstoque] += val;
            grupo.total += val;
          }
        };

        if (isPronafGeral) adicionarAoGrupo(estoque.pronaf);
        if (isMini) adicionarAoGrupo(estoque.mini);
        if (isCVM) adicionarAoGrupo(estoque.cvm);
        if (isPronafA) adicionarAoGrupo(estoque.pronafA);
      });

      const estoqueConsolidadoGeral = estoque.pronaf.total + estoque.mini.total;

      const percPeriodoPronaf =
        params.pronafMetaPeriodo > 0
          ? (params.pronafRealizadoOficial / params.pronafMetaPeriodo) * 100
          : 0;
      const percPeriodoMini =
        params.miniMetaPeriodo > 0
          ? (params.miniRealizadoOficial / params.miniMetaPeriodo) * 100
          : 0;
      const percPeriodoCvm =
        params.cvmMetaPeriodo > 0
          ? (params.cvmRealizadoOficial / params.cvmMetaPeriodo) * 100
          : 0;
      const percPeriodoReembolso =
        params.reembolsoMetaPeriodo > 0
          ? (params.reembolsoRealizado / params.reembolsoMetaPeriodo) * 100
          : 0;

      const faltaPontosPronaf = params.pronafMetaPontos - params.pronafPontosFeitos;
      const faltaPontosMini = params.miniMetaPontos - params.miniPontosFeitos;
      const faltaPontosCvm = params.cvmMetaPontos - params.cvmPontosFeitos;
      const faltaPontosReembolso =
        params.reembolsoMetaPontos - params.reembolsoPontosFeitos;

      const faltaPeriodoPronaf =
        params.pronafMetaPeriodo -
        params.pronafRealizadoOficial -
        estoque.pronaf.total;
      const faltaPeriodoMini =
        params.miniMetaPeriodo - params.miniRealizadoOficial - estoque.mini.total;
      const faltaPeriodoCvm =
        params.cvmMetaPeriodo - params.cvmRealizadoOficial - estoque.cvm.total;

      const faltaAnoPronaf =
        params.pronafMetaAnual -
        params.pronafRealizadoOficial -
        estoque.pronaf.total;
      const faltaAnoMini =
        params.miniMetaAnual - params.miniRealizadoOficial - estoque.mini.total;
      const faltaAnoCvm =
        params.cvmMetaAnual - params.cvmRealizadoOficial - estoque.cvm.total;

      const metaAnualConsolidada = params.pronafMetaAnual + params.miniMetaAnual;
      const realizadoConsolidado =
        params.pronafRealizadoOficial + params.miniRealizadoOficial;

      const faltaFaixa100 =
        1.0 * metaAnualConsolidada -
        realizadoConsolidado -
        estoqueConsolidadoGeral;
      const faltaFaixa90 =
        0.9 * metaAnualConsolidada -
        realizadoConsolidado -
        estoqueConsolidadoGeral;
      const faltaFaixa80 =
        0.8 * metaAnualConsolidada -
        realizadoConsolidado -
        estoqueConsolidadoGeral;

      return {
        estoque,
        realizadoNaBase,
        qtdExcluidasLCG,
        qtdNoEstoque,
        estoqueConsolidadoGeral,
        percPeriodoPronaf,
        percPeriodoMini,
        percPeriodoCvm,
        percPeriodoReembolso,
        faltaPontosPronaf,
        faltaPontosMini,
        faltaPontosCvm,
        faltaPontosReembolso,
        faltaPeriodoPronaf,
        faltaPeriodoMini,
        faltaPeriodoCvm,
        faltaAnoPronaf,
        faltaAnoMini,
        faltaAnoCvm,
        metaAnualConsolidada,
        realizadoConsolidado,
        faltaFaixa100,
        faltaFaixa90,
        faltaFaixa80,
      };
    },
    [listaContratacoes, params, listaCards, considerarArquivados, simulacao]
  );

  // Apuração exibida na tela (sempre reflete a simulação ativa)
  const apuracaoCarteira = useMemo(
    () => calcularApuracao(true),
    [calcularApuracao]
  );

  const puxarRealizadoDaAbaContratacoes = () => {
    setParams((prev) => {
      const novo = {
        ...prev,
        pronafRealizadoOficial: apuracaoCarteira.realizadoNaBase.pronaf,
        miniRealizadoOficial: apuracaoCarteira.realizadoNaBase.mini,
        cvmRealizadoOficial: apuracaoCarteira.realizadoNaBase.cvm,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEY_PARAMETROS_CARTEIRA,
          JSON.stringify(novo)
        );
        window.dispatchEvent(new Event('bnb_parametros_carteira_atualizados'));
        salvarFerramentasSync({ parametrosCarteira: novo }).catch(() => {});
      }
      return novo;
    });
    alert(
      '✅ Valores de "Realizado" atualizados e sincronizados com a nuvem com base nas propostas marcadas como "Contratado"!'
    );
  };

  // =========================================================================
  // GERADOR DO PDF EXECUTIVO DA PLANILHA DA CARTEIRA (ITEM 2.5 E 2.4)
  // =========================================================================
  const executarExportacaoPDFCarteira = () => {
    const usarSimulacao =
      qtdAlteracoesSimulacao > 0 && pdfModoBase === 'SIMULACAO_ATUAL';
    const dadosApuracao = calcularApuracao(usarSimulacao);
    const idsDesmarcadosSet = new Set(
      usarSimulacao ? simulacao.idsDesmarcados || [] : []
    );
    const mapaValoresCustom = usarSimulacao
      ? simulacao.valoresCustomizados || {}
      : {};

    const obterValEfetivo = (r: RegistroContratacao): string => {
      const idStr = String(r.id);
      return mapaValoresCustom[idStr] !== undefined
        ? mapaValoresCustom[idStr]
        : r.valor;
    };

    const NOMES_ETAPAS_PDF: Record<EtapaEstoqueKey, string> = {
      AG: 'AG (Agência / PCE)',
      CENTRAL: 'CENTRAL (S522 / F. Assinar / F. Conformidade)',
      DEVOLVIDO_AG: 'DEVOLVIDO AG',
      RENOV_CUSTEIO: 'RENOV. CUSTEIO',
    };

    // Monta linhas HTML da tabela com numeração contínua (offsetIdx)
    const montarLinhasTabelaPropostas = (
      lista: RegistroContratacao[],
      offsetIdx = 0
    ) => {
      return lista
        .map((p, idx) => {
          const valStr = obterValEfetivo(p);
          const foiEditado =
            usarSimulacao && mapaValoresCustom[String(p.id)] !== undefined;
          return `
            <tr style="page-break-inside: avoid;">
              <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:center; color:#64748b; font-weight:bold;">${
                offsetIdx + idx + 1
              }</td>
              <td style="border:1px solid #cbd5e1; padding:4px 6px;">
                <strong>${p.cliente}</strong>
                ${
                  p.cpf
                    ? `<span style="color:#64748b; font-size:8pt;"> (${p.cpf})</span>`
                    : ''
                }
              </td>
              <td style="border:1px solid #cbd5e1; padding:4px 6px;">
                <strong>${p.tipo}</strong>
                ${
                  p.programa
                    ? `<div style="color:#8B1530; font-size:7.5pt;">${p.programa}</div>`
                    : ''
                }
              </td>
              <td style="border:1px solid #cbd5e1; padding:4px 6px;">${
                p.projetista || '-'
              }</td>
              <td style="border:1px solid #cbd5e1; padding:4px 6px; font-weight:bold;">${
                p.situacao
              }</td>
              <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:right; font-weight:bold; color:#15803d;">
                R$ ${valStr}${foiEditado ? ' *' : ''}
              </td>
            </tr>
          `;
        })
        .join('');
    };

    // Monta seção de Estoque Nominal (Modo Simplificado Direto OU Modo Completo por Etapas)
    const montarSecaoNominalEstoqueHtml = (paramsSecao: {
      titulo: string;
      corPrincipal: string;
      bgDestaque: string;
      grupoEstoque: GrupoEstoqueDetalhado;
      realizadoOficial: number;
      metaPeriodo: number;
      metaAnual: number;
      faltaPeriodo: number;
      faltaAno: number;
      agruparPorSubtipoPronaf?: boolean;
    }) => {
      const {
        titulo,
        corPrincipal,
        bgDestaque,
        grupoEstoque,
        realizadoOficial,
        metaPeriodo,
        metaAnual,
        faltaPeriodo,
        faltaAno,
        agruparPorSubtipoPronaf,
      } = paramsSecao;

      // =======================================================================
      // MODO 1: VERSÃO SIMPLIFICADA / RESUMIDA (Sem dividir por etapas)
      // =======================================================================
      if (pdfModoNominalSimplificado) {
        const todasAtivas = pdfEtapasIncluidas.flatMap((etKey) =>
          (grupoEstoque.propostas[etKey] || []).filter(
            (p) => !idsDesmarcadosSet.has(String(p.id))
          )
        );

        const somaTotalBloco = todasAtivas.reduce(
          (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
          0
        );

        let corpoUnificadoHtml = '';

        if (todasAtivas.length === 0) {
          corpoUnificadoHtml = `
            <tr>
              <td colspan="6" style="border:1px solid #cbd5e1; padding:10px; text-align:center; color:#64748b;">
                Nenhuma proposta em estoque para este parâmetro.
              </td>
            </tr>
          `;
        } else if (agruparPorSubtipoPronaf) {
          // Mantém a ordem: 1º PRONAF Mulher/CVM -> 2º PRONAF Comum -> 3º PRONAF A
          const listaMulher = todasAtivas.filter(
            (p) => classificarSubgrupoPronaf(p) === 'PRONAF_MULHER_CVM'
          );
          const listaComum = todasAtivas.filter(
            (p) => classificarSubgrupoPronaf(p) === 'PRONAF_COMUM'
          );
          const listaPronafA = todasAtivas.filter(
            (p) => classificarSubgrupoPronaf(p) === 'PRONAF_A'
          );

          const somaPronafA = listaPronafA.reduce(
            (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
            0
          );

          const htmlMulher = montarLinhasTabelaPropostas(listaMulher, 0);
          const htmlComum = montarLinhasTabelaPropostas(
            listaComum,
            listaMulher.length
          );
          const htmlPronafA = montarLinhasTabelaPropostas(
            listaPronafA,
            listaMulher.length + listaComum.length
          );

          // Exibe de forma discreta APENAS o subtotal de PRONAF A logo abaixo das propostas de PRONAF A
          const linhaSubtotalPronafA =
            listaPronafA.length > 0
              ? `
                <tr style="background:#fff7ed; page-break-inside: avoid;">
                  <td colspan="5" style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-size:8pt; color:#c2410c; font-weight:bold;">
                    🏕️ Subtotal correspondente a PRONAF A (${
                      listaPronafA.length
                    } proposta${listaPronafA.length > 1 ? 's' : ''}):
                  </td>
                  <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:right; font-size:8.5pt; color:#c2410c; font-weight:bold;">
                    R$ ${formatarMoedaBD(somaPronafA)}
                  </td>
                </tr>
              `
              : '';

          corpoUnificadoHtml =
            htmlMulher + htmlComum + htmlPronafA + linhaSubtotalPronafA;
        } else {
          corpoUnificadoHtml = montarLinhasTabelaPropostas(todasAtivas, 0);
        }

        return `
          <div style="margin-top: 16px;">
            <div style="background:${bgDestaque}; border-left:5px solid ${corPrincipal}; padding:7px 12px; font-weight:bold; color:${corPrincipal}; font-size:10.5pt; display:flex; justify-content:space-between; align-items:center; page-break-after: avoid;">
              <span>${titulo}</span>
              <span>${todasAtivas.length} proposta(s)</span>
            </div>

            <table style="width:100%; border-collapse:collapse; font-size:8.5pt; margin-top:4px;">
              <thead style="display:table-header-group;">
                <tr style="background:#f8fafc; text-align:left; color:#334155;">
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:28px; text-align:center;">#</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px;">Cliente / CPF</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px;">Tipo / Programa</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:90px;">Projetista</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:115px;">Situação</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:110px; text-align:right;">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${corpoUnificadoHtml}
              </tbody>
            </table>

            <div style="background:${bgDestaque}; border:1px solid ${corPrincipal}; padding:8px 12px; margin-top:4px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; font-size:9.5pt; page-break-inside: avoid;">
              <div>
                <b>VALOR TOTAL DAS PROPOSTAS (${todasAtivas.length}):</b>
                <span style="color:${corPrincipal}; font-weight:bold; font-size:10.5pt;"> R$ ${formatarMoedaBD(
          somaTotalBloco
        )}</span>
              </div>
              <div style="font-weight:bold;">
                <span>FALTA PARA A META ANUAL (Meta: R$ ${formatarMoedaBD(
                  metaAnual
                )}): <strong style="color:${
          faltaAno <= 0 ? '#15803d' : '#dc2626'
        }; font-size:10.5pt;">R$ ${formatarMoedaBD(faltaAno)} ${
          faltaAno <= 0 ? '✅ (Meta Atingida / Excedente)' : ''
        }</strong></span>
              </div>
            </div>
          </div>
        `;
      }

      // =======================================================================
      // MODO 2: VERSÃO COMPLETA (Dividida por Etapas + Subtotais)
      // =======================================================================
      let htmlEtapas = '';
      let somaMulherTotal = 0;
      let somaComumTotal = 0;
      let somaPronafATotal = 0;
      let totalEtapasSelecionadas = 0;
      let qtdPropostasSelecionadas = 0;

      pdfEtapasIncluidas.forEach((etKey) => {
        const ativasDaEtapa = (grupoEstoque.propostas[etKey] || []).filter(
          (p) => !idsDesmarcadosSet.has(String(p.id))
        );
        if (ativasDaEtapa.length === 0) return;

        const somaEtapa = ativasDaEtapa.reduce(
          (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
          0
        );
        totalEtapasSelecionadas += somaEtapa;
        qtdPropostasSelecionadas += ativasDaEtapa.length;

        let corpoLinhasHtml = '';

        if (agruparPorSubtipoPronaf) {
          const listaMulher = ativasDaEtapa.filter(
            (p) => classificarSubgrupoPronaf(p) === 'PRONAF_MULHER_CVM'
          );
          const listaComum = ativasDaEtapa.filter(
            (p) => classificarSubgrupoPronaf(p) === 'PRONAF_COMUM'
          );
          const listaPronafA = ativasDaEtapa.filter(
            (p) => classificarSubgrupoPronaf(p) === 'PRONAF_A'
          );

          const renderSubbloco = (
            nomeSub: string,
            corSub: string,
            itensSub: RegistroContratacao[]
          ) => {
            if (itensSub.length === 0) return '';
            const somaSub = itensSub.reduce(
              (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
              0
            );
            return `
              ${montarLinhasTabelaPropostas(itensSub, 0)}
              <tr style="background:#f8fafc; page-break-inside: avoid;">
                <td colspan="5" style="border:1px solid #cbd5e1; padding:4px 8px; text-align:right; font-size:8pt; color:${corSub}; font-weight:bold;">
                  Subtotal ${nomeSub} (${itensSub.length} proposta${
              itensSub.length > 1 ? 's' : ''
            }):
                </td>
                <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:right; font-size:8.5pt; color:${corSub}; font-weight:bold;">
                  R$ ${formatarMoedaBD(somaSub)}
                </td>
              </tr>
            `;
          };

          somaMulherTotal += listaMulher.reduce(
            (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
            0
          );
          somaComumTotal += listaComum.reduce(
            (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
            0
          );
          somaPronafATotal += listaPronafA.reduce(
            (acc, p) => acc + parseMoeda(obterValEfetivo(p)),
            0
          );

          corpoLinhasHtml =
            renderSubbloco(
              '1º PRONAF Mulher / Cada Vez Melhor',
              '#ad1457',
              listaMulher
            ) +
            renderSubbloco('2º PRONAF Comum (V)', '#1e293b', listaComum) +
            renderSubbloco('3º PRONAF A', '#e65100', listaPronafA);
        } else {
          corpoLinhasHtml = montarLinhasTabelaPropostas(ativasDaEtapa, 0);
        }

        htmlEtapas += `
          <div style="margin-top: 8px;">
            <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-bottom:none; padding:5px 10px; display:flex; justify-content:space-between; font-weight:bold; font-size:9pt; color:#1e293b; page-break-after: avoid;">
              <span>📍 ETAPA: ${NOMES_ETAPAS_PDF[etKey]} (${ativasDaEtapa.length} propostas)</span>
              <span>Subtotal da Etapa: R$ ${formatarMoedaBD(somaEtapa)}</span>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:8.5pt;">
              <thead style="display:table-header-group;">
                <tr style="background:#f8fafc; text-align:left; color:#334155;">
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:28px; text-align:center;">#</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px;">Cliente / CPF</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px;">Tipo / Programa</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:90px;">Projetista</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:115px;">Situação</th>
                  <th style="border:1px solid #cbd5e1; padding:4px 6px; width:105px; text-align:right;">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${corpoLinhasHtml}
              </tbody>
            </table>
          </div>
        `;
      });

      if (!htmlEtapas) {
        htmlEtapas = `<div style="padding:10px; font-size:9pt; color:#64748b;">Nenhuma proposta ativa nas etapas selecionadas para esta métrica.</div>`;
      }

      const resumoSubtiposPronafHtml = agruparPorSubtipoPronaf
        ? `
          <div style="display:flex; gap:14px; flex-wrap:wrap; font-size:8.5pt; padding:6px 10px; background:#f8fafc; border:1px solid #cbd5e1; border-top:none;">
            <span>🌸 <b>Total PRONAF Mulher / CVM:</b> R$ ${formatarMoedaBD(
              somaMulherTotal
            )}</span>
            <span>🌾 <b>Total PRONAF Comum:</b> R$ ${formatarMoedaBD(
              somaComumTotal
            )}</span>
            <span>🏕️ <b>Total PRONAF A:</b> R$ ${formatarMoedaBD(
              somaPronafATotal
            )}</span>
          </div>
        `
        : '';

      return `
        <div style="margin-top: 18px;">
          <div style="background:${bgDestaque}; border-left:5px solid ${corPrincipal}; padding:7px 12px; font-weight:bold; color:${corPrincipal}; font-size:10.5pt; display:flex; justify-content:space-between; align-items:center; page-break-after: avoid;">
            <span>${titulo}</span>
            <span>${qtdPropostasSelecionadas} proposta(s) • Total em Estoque: R$ ${formatarMoedaBD(
        totalEtapasSelecionadas
      )}</span>
          </div>
          ${htmlEtapas}
          ${resumoSubtiposPronafHtml}
          <div style="background:${bgDestaque}; border:1px solid ${corPrincipal}; padding:8px 12px; margin-top:4px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; font-size:9pt; page-break-inside: avoid;">
            <div>
              <b>SOMATÓRIO DO ESTOQUE (${qtdPropostasSelecionadas} propostas):</b>
              <span style="color:${corPrincipal}; font-weight:bold; font-size:10pt;"> R$ ${formatarMoedaBD(
        grupoEstoque.total
      )}</span>
              <span style="color:#475569; margin-left:8px;">(Realizado: R$ ${formatarMoedaBD(
                realizadoOficial
              )} | Meta Anual: R$ ${formatarMoedaBD(metaAnual)})</span>
            </div>
            <div style="font-weight:bold;">
              <span>Falta p/ Meta do Período (R$ ${formatarMoedaBD(
                metaPeriodo
              )}): <strong style="color:${
        faltaPeriodo <= 0 ? '#15803d' : '#dc2626'
      };">R$ ${formatarMoedaBD(faltaPeriodo)} ${
        faltaPeriodo <= 0 ? '(Excedente)' : ''
      }</strong></span>
              <span style="margin-left:12px;">Falta p/ Meta Anual: <strong style="color:${
                faltaAno <= 0 ? '#15803d' : '#0f172a'
              };">R$ ${formatarMoedaBD(faltaAno)}</strong></span>
            </div>
          </div>
        </div>
      `;
    };

    let htmlCorpoRelatorio = '';

    // 1. Identificação e Faixas de Cumprimento Anual
    if (pdfSecaoIdentificacao || pdfSecaoFaixasAnuais) {
      htmlCorpoRelatorio += `<div style="display:grid; grid-template-columns: ${
        pdfSecaoIdentificacao && pdfSecaoFaixasAnuais ? '1.15fr 1fr' : '1fr'
      }; gap:12px; margin-bottom:14px; page-break-inside: avoid;">`;

      if (pdfSecaoIdentificacao) {
        htmlCorpoRelatorio += `
          <div style="border:1px solid #cbd5e1; border-left:4px solid #8B1530; border-radius:6px; padding:10px;">
            <div style="font-weight:bold; color:#8B1530; font-size:9.5pt; margin-bottom:6px; text-transform:uppercase;">
              🏦 1. Identificação e Desempenho Corporativo
            </div>
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; font-size:8.5pt; margin-bottom:6px;">
              <div style="background:#f8fafc; padding:6px; border:1px solid #e2e8f0; border-radius:4px;">
                <span style="color:#64748b; font-size:7.5pt; display:block;">CARTEIRA / CATEG.</span>
                <strong>${params.carteira} (Nível ${params.categorizacao})</strong>
              </div>
              <div style="background:#f8fafc; padding:6px; border:1px solid #e2e8f0; border-radius:4px;">
                <span style="color:#64748b; font-size:7.5pt; display:block;">PONTUAÇÃO ATUAL</span>
                <strong style="color:#8B1530;">${params.pontuacao.toFixed(2)} pts</strong>
              </div>
              <div style="background:#f8fafc; padding:6px; border:1px solid #e2e8f0; border-radius:4px;">
                <span style="color:#64748b; font-size:7.5pt; display:block;">ESTOQUE (PRONAF+MINI)</span>
                <strong style="color:#15803d;">R$ ${formatarMoedaBD(
                  dadosApuracao.estoqueConsolidadoGeral
                )}</strong>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; font-size:8pt;">
              <div>Receita Est.: <b>${(params.receitaEstAnual * 100).toFixed(2)}%</b></div>
              <div>Gestão Ativo: <b>${(params.gestaoAtivo * 100).toFixed(2)}%</b></div>
              <div>FNE Contr.: <b>${(params.fneContratacao * 100).toFixed(2)}%</b></div>
              <div>FNE Desemb.: <b>${(params.fneDesembolso * 100).toFixed(2)}%</b></div>
            </div>
          </div>
        `;
      }

      if (pdfSecaoFaixasAnuais) {
        htmlCorpoRelatorio += `
          <div style="border:1px solid #cbd5e1; border-left:4px solid #d97706; border-radius:6px; padding:10px;">
            <div style="font-weight:bold; color:#8B1530; font-size:9.5pt; margin-bottom:6px; text-transform:uppercase;">
              🎯 Faixas de Cumprimento Anual (Meta: R$ ${formatarMoedaBD(
                dadosApuracao.metaAnualConsolidada
              )})
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; font-size:8.5pt;">
              ${[
                { label: '≥ 100% da Meta Anual', valor: dadosApuracao.faltaFaixa100 },
                { label: '≥ 90% da Meta Anual', valor: dadosApuracao.faltaFaixa90 },
                { label: '≥ 80% da Meta Anual', valor: dadosApuracao.faltaFaixa80 },
              ]
                .map((fx) => {
                  const sup = fx.valor <= 0;
                  return `<div style="display:flex; justify-content:space-between; padding:4px 8px; background:${
                    sup ? '#dcfce7' : '#fef3c7'
                  }; border-radius:4px; font-weight:bold;">
                    <span>${fx.label}</span>
                    <span style="color:${sup ? '#15803d' : '#b45309'};">${
                    sup ? '✅ Superada (' : 'Falta: '
                  }R$ ${formatarMoedaBD(fx.valor)}${sup ? ')' : ''}</span>
                  </div>`;
                })
                .join('')}
            </div>
          </div>
        `;
      }

      htmlCorpoRelatorio += `</div>`;
    }

    // 2. Tabela de Indicadores, Metas e Pontuação
    if (pdfSecaoIndicadoresMetas) {
      htmlCorpoRelatorio += `
        <div style="margin-bottom:14px; page-break-inside: avoid;">
          <div style="font-weight:bold; color:#8B1530; font-size:10pt; margin-bottom:6px; text-transform:uppercase;">
            📈 2. Indicadores, Metas e Pontuação
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:8.5pt;">
            <thead>
              <tr style="background:#1e293b; color:#fff; text-align:center;">
                <th style="border:1px solid #cbd5e1; padding:5px; text-align:left;">INDICADOR</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">REALIZADO (R$)</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">META PERÍODO (R$)</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">% PERÍODO</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">META ANUAL (R$)</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">META PTS</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">PTS FEITOS</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">FALTA GANHAR</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">FNE PRONAF (Consolidado)</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  params.pronafRealizadoOficial
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.pronafMetaPeriodo
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold; color:#8B1530;">${dadosApuracao.percPeriodoPronaf.toFixed(
                  2
                )}%</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.pronafMetaAnual
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.pronafMetaPontos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.pronafPontosFeitos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold;">${dadosApuracao.faltaPontosPronaf.toFixed(
                  2
                )}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">FNE MINI</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  params.miniRealizadoOficial
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.miniMetaPeriodo
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold; color:#8B1530;">${dadosApuracao.percPeriodoMini.toFixed(
                  2
                )}%</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.miniMetaAnual
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.miniMetaPontos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.miniPontosFeitos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold;">${dadosApuracao.faltaPontosMini.toFixed(
                  2
                )}</td>
              </tr>
              <tr style="background:#fff9fb;">
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold; color:#ad1457;">FNE CADA VEZ MELHOR</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  params.cvmRealizadoOficial
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.cvmMetaPeriodo
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold; color:#ad1457;">${dadosApuracao.percPeriodoCvm.toFixed(
                  2
                )}%</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.cvmMetaAnual
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.cvmMetaPontos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.cvmPontosFeitos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold;">${dadosApuracao.faltaPontosCvm.toFixed(
                  2
                )}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold;">REEMBOLSO</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  params.reembolsoRealizado
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  params.reembolsoMetaPeriodo
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold;">${dadosApuracao.percPeriodoReembolso.toFixed(
                  2
                )}%</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; color:#94a3b8;">-</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.reembolsoMetaPontos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${params.reembolsoPontosFeitos.toFixed(
                  2
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold;">${dadosApuracao.faltaPontosReembolso.toFixed(
                  2
                )}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Quadros Resumo de Estoque (Visão sintética das 4 etapas)
    if (pdfSecaoQuadrosEstoque) {
      const e = dadosApuracao.estoque;
      htmlCorpoRelatorio += `
        <div style="margin-bottom:14px; page-break-inside: avoid;">
          <div style="font-weight:bold; color:#8B1530; font-size:10pt; margin-bottom:6px; text-transform:uppercase;">
            📊 3. Resumo Sintético do Estoque por Etapa
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:8.5pt;">
            <thead>
              <tr style="background:#f1f5f9; text-align:right;">
                <th style="border:1px solid #cbd5e1; padding:5px; text-align:left;">MÉTRICA / LINHA</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">AG (Agência / PCE)</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">CENTRAL (S522)</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">DEVOLVIDO AG</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">RENOV. CUSTEIO</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">TOTAL ESTOQUE</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">FALTA / PERÍODO</th>
                <th style="border:1px solid #cbd5e1; padding:5px;">FALTA / ANO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold; color:#8B1530;">FNE PRONAF (Geral)</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronaf.AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronaf.CENTRAL
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronaf.DEVOLVIDO_AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronaf.RENOV_CUSTEIO
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  e.pronaf.total
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  dadosApuracao.faltaPeriodoPronaf
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  dadosApuracao.faltaAnoPronaf
                )}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold; color:#1967d2;">FNE MINI</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.mini.AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.mini.CENTRAL
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.mini.DEVOLVIDO_AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.mini.RENOV_CUSTEIO
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  e.mini.total
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  dadosApuracao.faltaPeriodoMini
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  dadosApuracao.faltaAnoMini
                )}</td>
              </tr>
              <tr style="background:#fff9fb;">
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold; color:#ad1457;">FNE CADA VEZ MELHOR</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.cvm.AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.cvm.CENTRAL
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.cvm.DEVOLVIDO_AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.cvm.RENOV_CUSTEIO
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  e.cvm.total
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  dadosApuracao.faltaPeriodoCvm
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  dadosApuracao.faltaAnoCvm
                )}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cbd5e1; padding:5px; font-weight:bold; color:#e65100;">FNE PRONAF A</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronafA.AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronafA.CENTRAL
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronafA.DEVOLVIDO_AG
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">R$ ${formatarMoedaBD(
                  e.pronafA.RENOV_CUSTEIO
                )}</td>
                <td style="border:1px solid #cbd5e1; padding:5px; text-align:right; font-weight:bold;">R$ ${formatarMoedaBD(
                  e.pronafA.total
                )}</td>
                <td colspan="2" style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-size:7.5pt; color:#64748b;">
                  MESMOS PARÂMETROS DE FNE PRONAF
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // 4. Listagens Nominais Detalhadas por Situação (PRONAF, CVM e MINI)
    if (pdfListaNominalPronaf) {
      htmlCorpoRelatorio += montarSecaoNominalEstoqueHtml({
        titulo:
          '📋 DETALHAMENTO NOMINAL — ESTOQUE PRONAF [Inclui PRONAF Mulher/CVM + PRONAF Comum + PRONAF A]',
        corPrincipal: '#8B1530',
        bgDestaque: '#fdf2f4',
        grupoEstoque: dadosApuracao.estoque.pronaf,
        realizadoOficial: params.pronafRealizadoOficial,
        metaPeriodo: params.pronafMetaPeriodo,
        metaAnual: params.pronafMetaAnual,
        faltaPeriodo: dadosApuracao.faltaPeriodoPronaf,
        faltaAno: dadosApuracao.faltaAnoPronaf,
        agruparPorSubtipoPronaf: true,
      });
    }

    if (pdfListaNominalCvm) {
      htmlCorpoRelatorio += montarSecaoNominalEstoqueHtml({
        titulo:
          '🌸 DETALHAMENTO NOMINAL — ESTOQUE PRONAF CVM (Apenas FNE Cada Vez Melhor)',
        corPrincipal: '#ad1457',
        bgDestaque: '#fce4ec',
        grupoEstoque: dadosApuracao.estoque.cvm,
        realizadoOficial: params.cvmRealizadoOficial,
        metaPeriodo: params.cvmMetaPeriodo,
        metaAnual: params.cvmMetaAnual,
        faltaPeriodo: dadosApuracao.faltaPeriodoCvm,
        faltaAno: dadosApuracao.faltaAnoCvm,
        agruparPorSubtipoPronaf: false,
      });
    }

    if (pdfListaNominalMini) {
      htmlCorpoRelatorio += montarSecaoNominalEstoqueHtml({
        titulo: '🚜 DETALHAMENTO NOMINAL — ESTOQUE FNE MINI',
        corPrincipal: '#1967d2',
        bgDestaque: '#eff6ff',
        grupoEstoque: dadosApuracao.estoque.mini,
        realizadoOficial: params.miniRealizadoOficial,
        metaPeriodo: params.miniMetaPeriodo,
        metaAnual: params.miniMetaAnual,
        faltaPeriodo: dadosApuracao.faltaPeriodoMini,
        faltaAno: dadosApuracao.faltaAnoMini,
        agruparPorSubtipoPronaf: false,
      });
    }

    const jan = window.open('', '_blank', 'width=1060,height=860');
    if (!jan) return;

    jan.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>&nbsp;</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm !important;
    }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#1e293b; color:#fff; padding:10px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; border-radius:6px;">
    <span>📑 <strong>RELATÓRIO EXECUTIVO DE ANÁLISE DA CARTEIRA (${
      usarSimulacao ? 'CENÁRIO SIMULADO / FLEXIBILIZADO' : 'ESTOQUE OFICIAL PADRÃO'
    })</strong></span>
    <button onclick="window.print()" style="background:#dc2626; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>
  </div>

  <div style="border-bottom:2px solid #8B1530; padding-bottom:6px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-end;">
    <div>
      <h2 style="margin:0; color:#8B1530; font-size:13.5pt;">RELATÓRIO EXECUTIVO DE ANÁLISE DA CARTEIRA — CARTEIRA ${
        params.carteira
      }</h2>
      <span style="font-size:8.5pt; color:#475569;">${
        usarSimulacao
          ? '⚡ Visão com Filtros / Valores Hipotéticos de Estoque Aplicados'
          : '🏛️ Visão Oficial Completa da Base de Contratações'
      }</span>
    </div>
    <span style="font-size:8.5pt; font-weight:bold; color:#334155;">Data: ${getHojeBR()}</span>
  </div>

  ${htmlCorpoRelatorio}

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
  </script>
</body>
</html>`);
    jan.document.close();
    setModalPdfAberto(false);
  };

  const exportarPlanilhaGerenteGeral = () => {
    const wb = XLSX.utils.book_new();
    const e = apuracaoCarteira.estoque;

    const aoa: (string | number | null)[][] = Array.from({ length: 36 }, () =>
      Array(8).fill(null)
    );

    aoa[0][0] = 'RELATÓRIO GERAL';
    aoa[1][0] = 'CARTEIRA';
    aoa[1][1] = Number(params.carteira) || params.carteira;
    aoa[1][6] = '≥ 100 %';
    aoa[1][7] = apuracaoCarteira.faltaFaixa100;

    aoa[2][0] = 'CATEGORIZAÇÃO';
    aoa[2][1] = Number(params.categorizacao) || params.categorizacao;
    aoa[2][6] = '≥ 90%';
    aoa[2][7] = apuracaoCarteira.faltaFaixa90;

    aoa[3][6] = '≥ 80%';
    aoa[3][7] = apuracaoCarteira.faltaFaixa80;

    aoa[5][0] = 'PONTUAÇÃO ';
    aoa[5][2] = 'RECEITA EST. ANUAL';
    aoa[5][3] = 'GESTÃO DO ATIVO';
    aoa[5][4] = 'FNE CONTRATAÇÃO';
    aoa[5][6] = 'FNE DESEMBOLSO';

    aoa[6][0] = params.pontuacao;
    aoa[6][2] = params.receitaEstAnual;
    aoa[6][3] = params.gestaoAtivo;
    aoa[6][4] = params.fneContratacao;
    aoa[6][6] = params.fneDesembolso;

    aoa[8] = [
      'INDICADOR',
      'REALIZADO',
      'META DO PERÍODO ',
      '% DO PERÍODO',
      'META ANUAL',
      'META DE PONTOS',
      'PONTOS FEITOS',
      'FALTA GANHAR',
    ];

    aoa[9] = [
      'FNE PRONAF',
      params.pronafRealizadoOficial,
      params.pronafMetaPeriodo,
      apuracaoCarteira.percPeriodoPronaf / 100,
      params.pronafMetaAnual,
      params.pronafMetaPontos,
      params.pronafPontosFeitos,
      apuracaoCarteira.faltaPontosPronaf,
    ];

    aoa[10] = [
      'FNE MINI',
      params.miniRealizadoOficial,
      params.miniMetaPeriodo,
      apuracaoCarteira.percPeriodoMini / 100,
      params.miniMetaAnual,
      params.miniMetaPontos,
      params.miniPontosFeitos,
      apuracaoCarteira.faltaPontosMini,
    ];

    aoa[11] = [
      'FNE CADA VEZ MELHOR',
      params.cvmRealizadoOficial,
      params.cvmMetaPeriodo,
      apuracaoCarteira.percPeriodoCvm / 100,
      params.cvmMetaAnual,
      params.cvmMetaPontos,
      params.cvmPontosFeitos,
      apuracaoCarteira.faltaPontosCvm,
    ];

    aoa[12] = [
      'REEMBOLSO',
      params.reembolsoRealizado,
      params.reembolsoMetaPeriodo,
      apuracaoCarteira.percPeriodoReembolso / 100,
      '-',
      params.reembolsoMetaPontos,
      params.reembolsoPontosFeitos,
      apuracaoCarteira.faltaPontosReembolso,
    ];

    aoa[15][0] = 'ESTOQUE DA CARTEIRA';
    aoa[16] = [
      'LOCAL',
      'INDICADOR',
      'R$',
      'TOTAL',
      'FALTA / PERÍODO',
      null,
      'FALTA / ANO',
      null,
    ];

    aoa[17] = [
      'AG',
      'FNE PRONAF',
      e.pronaf.AG,
      e.pronaf.total,
      apuracaoCarteira.faltaPeriodoPronaf,
      null,
      apuracaoCarteira.faltaAnoPronaf,
      null,
    ];
    aoa[18] = ['CENTRAL', null, e.pronaf.CENTRAL, null, null, null, null, null];
    aoa[19] = ['DEVOLVIDO AG', null, e.pronaf.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[20] = ['RENOV. CUSTEIO', null, e.pronaf.RENOV_CUSTEIO, null, null, null, null, null];

    aoa[22] = [
      'AG',
      'FNE MINI',
      e.mini.AG,
      e.mini.total,
      apuracaoCarteira.faltaPeriodoMini,
      null,
      apuracaoCarteira.faltaAnoMini,
      null,
    ];
    aoa[23] = ['CENTRAL', null, e.mini.CENTRAL, null, null, null, null, null];
    aoa[24] = ['DEVOLVIDO AG', null, e.mini.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[25] = ['RENOV. CUSTEIO', null, e.mini.RENOV_CUSTEIO, null, null, null, null, null];

    aoa[27] = [
      'AG',
      'FNE CADA VEZ MELHOR',
      e.cvm.AG,
      e.cvm.total,
      apuracaoCarteira.faltaPeriodoCvm,
      null,
      apuracaoCarteira.faltaAnoCvm,
      null,
    ];
    aoa[28] = ['CENTRAL', null, e.cvm.CENTRAL, null, null, null, null, null];
    aoa[29] = ['DEVOLVIDO AG', null, e.cvm.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[30] = ['RENOV. CUSTEIO', null, e.cvm.RENOV_CUSTEIO, null, null, null, null, null];

    aoa[32] = [
      'AG',
      'FNE PRONAF A',
      e.pronafA.AG,
      e.pronafA.total,
      'MESMOS PARÂMETROS DE FNE PRONAF',
      null,
      'MESMOS PARÂMETROS DE FNE PRONAF',
      null,
    ];
    aoa[33] = ['CENTRAL', null, e.pronafA.CENTRAL, null, null, null, null, null];
    aoa[34] = ['DEVOLVIDO AG', null, e.pronafA.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[35] = ['RENOV. CUSTEIO', null, e.pronafA.RENOV_CUSTEIO, null, null, null, null, null];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['H2'] = { t: 'n', f: '1*SUM(E10:E11)-SUM(B10:B11)-SUM(D18,D23)', v: apuracaoCarteira.faltaFaixa100 };
    ws['H3'] = { t: 'n', f: '0.9*SUM(E10:E11)-SUM(B10:B11)-SUM(D18,D23)', v: apuracaoCarteira.faltaFaixa90 };
    ws['H4'] = { t: 'n', f: '0.8*SUM(E10:E11)-SUM(B10:B11)-SUM(D18,D23)', v: apuracaoCarteira.faltaFaixa80 };

    ws['D10'] = { t: 'n', f: 'B10/C10', v: apuracaoCarteira.percPeriodoPronaf / 100 };
    ws['D11'] = { t: 'n', f: 'B11/C11', v: apuracaoCarteira.percPeriodoMini / 100 };
    ws['D12'] = { t: 'n', f: 'B12/C12', v: apuracaoCarteira.percPeriodoCvm / 100 };
    ws['D13'] = { t: 'n', f: 'B13/C13', v: apuracaoCarteira.percPeriodoReembolso / 100 };

    ws['H10'] = { t: 'n', f: 'F10-G10', v: apuracaoCarteira.faltaPontosPronaf };
    ws['H11'] = { t: 'n', f: 'F11-G11', v: apuracaoCarteira.faltaPontosMini };
    ws['H12'] = { t: 'n', f: 'F12-G12', v: apuracaoCarteira.faltaPontosCvm };
    ws['H13'] = { t: 'n', f: 'F13-G13', v: apuracaoCarteira.faltaPontosReembolso };

    ws['D18'] = { t: 'n', f: 'SUM(C18:C21)', v: e.pronaf.total };
    ws['E18'] = { t: 'n', f: 'C10-B10-D18', v: apuracaoCarteira.faltaPeriodoPronaf };
    ws['G18'] = { t: 'n', f: 'E10-B10-D18', v: apuracaoCarteira.faltaAnoPronaf };

    ws['D23'] = { t: 'n', f: 'SUM(C23:C26)', v: e.mini.total };
    ws['E23'] = { t: 'n', f: 'C11-B11-D23', v: apuracaoCarteira.faltaPeriodoMini };
    ws['G23'] = { t: 'n', f: 'E11-B11-D23', v: apuracaoCarteira.faltaAnoMini };

    ws['D28'] = { t: 'n', f: 'SUM(C28:C31)', v: e.cvm.total };
    ws['E28'] = { t: 'n', f: 'C12-B12-D28', v: apuracaoCarteira.faltaPeriodoCvm };
    ws['G28'] = { t: 'n', f: 'E12-B12-D28', v: apuracaoCarteira.faltaAnoCvm };

    ws['D33'] = { t: 'n', f: 'SUM(C33:C36)', v: e.pronafA.total };

    ws['!merges'] = [
      XLSX.utils.decode_range('A1:H1'),
      XLSX.utils.decode_range('A6:B6'),
      XLSX.utils.decode_range('E6:F6'),
      XLSX.utils.decode_range('G6:H6'),
      XLSX.utils.decode_range('A7:B7'),
      XLSX.utils.decode_range('E7:F7'),
      XLSX.utils.decode_range('G7:H7'),
      XLSX.utils.decode_range('A16:H16'),
      XLSX.utils.decode_range('E17:F17'),
      XLSX.utils.decode_range('G17:H17'),
      XLSX.utils.decode_range('B18:B21'),
      XLSX.utils.decode_range('D18:D21'),
      XLSX.utils.decode_range('E18:F21'),
      XLSX.utils.decode_range('G18:H21'),
      XLSX.utils.decode_range('B23:B26'),
      XLSX.utils.decode_range('D23:D26'),
      XLSX.utils.decode_range('E23:F26'),
      XLSX.utils.decode_range('G23:H26'),
      XLSX.utils.decode_range('B28:B31'),
      XLSX.utils.decode_range('D28:D31'),
      XLSX.utils.decode_range('E28:F31'),
      XLSX.utils.decode_range('G28:H31'),
      XLSX.utils.decode_range('B33:B36'),
      XLSX.utils.decode_range('D33:D36'),
      XLSX.utils.decode_range('E33:F36'),
      XLSX.utils.decode_range('G33:H36'),
    ];

    ws['!cols'] = [
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'MOLDE DO QUADRO');
    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `PLANILHA_DE_ANALISE_DA_CARTEIRA_${hoje}.xlsx`);
  };

  const renderBotaoInfo = (
    nomeCurtoModal: string,
    tituloColuna: string,
    propostas: RegistroContratacao[]
  ) => (
    <BotaoInfoSomaEstoque
      tituloLinha={nomeCurtoModal}
      tituloColuna={tituloColuna}
      propostas={propostas}
      simulacao={simulacao}
      onToggleProposta={handleTogglePropostaSimulacao}
      onToggleVariasPropostas={handleToggleVariasPropostasSimulacao}
      onAlterarValorProvisorio={handleAlterarValorProvisorio}
      onToggleModoFlexivel={handleToggleModoFlexivel}
      onAbrirCardKanbanCliente={handleAbrirCardKanbanDoCliente}
    />
  );

  const renderBlocoEstoque = (
    titulo: string,
    nomeCurtoModal: string,
    corDestaque: string,
    dados: GrupoEstoqueDetalhado,
    faltaPeriodo: number | string,
    faltaAno: number | string,
    avisoSubconjunto?: string
  ) => {
    const isNum = typeof faltaPeriodo === 'number' && typeof faltaAno === 'number';
    const excedentePeriodo = isNum && (faltaPeriodo as number) < 0;

    return (
      <div
        className="person-card"
        style={{
          borderLeftColor: corDestaque,
          background: '#fff',
          padding: '16px',
          marginBottom: '15px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <strong style={{ color: corDestaque, fontSize: '14px', textTransform: 'uppercase' }}>
              {titulo}
            </strong>
            {avisoSubconjunto && (
              <span
                style={{
                  marginLeft: '10px',
                  fontSize: '11px',
                  background: '#fff3cd',
                  color: '#856404',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                }}
              >
                ⚠️ {avisoSubconjunto}
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>
            Total do Estoque:{' '}
            <strong style={{ color: '#111', fontSize: '14px' }}>
              R$ {formatarMoedaBD(dados.total)}
            </strong>
            {renderBotaoInfo(
              nomeCurtoModal,
              'TOTAL CONSOLIDADO DO ESTOQUE',
              dados.propostas.todas
            )}
          </span>
        </div>

        <table className="conf-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '185px' }}>LOCAL / ETAPA</th>
              <th>VALOR EM ESTOQUE (R$)</th>
              <th>TOTAL CONSOLIDADO</th>
              <th>FALTA / PERÍODO</th>
              <th>FALTA / ANO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>
                AG (Agência / PCE)
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                R$ {formatarMoedaBD(dados.AG)}
                {renderBotaoInfo(
                  nomeCurtoModal,
                  'AG (Agência / PCE)',
                  dados.propostas.AG
                )}
              </td>
              <td
                rowSpan={4}
                style={{
                  fontWeight: 'bold',
                  fontSize: '15px',
                  background: '#f8fafc',
                  color: 'var(--primary-color)',
                }}
              >
                R$ {formatarMoedaBD(dados.total)}
                {renderBotaoInfo(
                  nomeCurtoModal,
                  'TOTAL CONSOLIDADO',
                  dados.propostas.todas
                )}
              </td>
              <td
                rowSpan={4}
                style={{
                  fontWeight: 'bold',
                  fontSize: isNum ? '14px' : '11px',
                  background: excedentePeriodo ? '#e6f4ea' : '#fff',
                  color: isNum
                    ? excedentePeriodo
                      ? '#137333'
                      : '#c62828'
                    : '#666',
                }}
              >
                {isNum ? (
                  <>
                    R$ {formatarMoedaBD(faltaPeriodo as number)}
                    {excedentePeriodo && (
                      <div style={{ fontSize: '10px', marginTop: '4px' }}>
                        ✅ Excedente Potencial
                      </div>
                    )}
                  </>
                ) : (
                  faltaPeriodo
                )}
              </td>
              <td
                rowSpan={4}
                style={{
                  fontWeight: 'bold',
                  fontSize: isNum ? '14px' : '11px',
                  background:
                    isNum && (faltaAno as number) <= 0 ? '#e6f4ea' : '#fff',
                  color: isNum
                    ? (faltaAno as number) <= 0
                      ? '#137333'
                      : '#333'
                    : '#666',
                }}
              >
                {isNum ? `R$ ${formatarMoedaBD(faltaAno as number)}` : faltaAno}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>
                CENTRAL (S522)
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                R$ {formatarMoedaBD(dados.CENTRAL)}
                {renderBotaoInfo(
                  nomeCurtoModal,
                  'CENTRAL (S522 + F. Assinar + F. Conformidade)',
                  dados.propostas.CENTRAL
                )}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>
                DEVOLVIDO AG
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                R$ {formatarMoedaBD(dados.DEVOLVIDO_AG)}
                {renderBotaoInfo(
                  nomeCurtoModal,
                  'DEVOLVIDO AG',
                  dados.propostas.DEVOLVIDO_AG
                )}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>
                RENOV. CUSTEIO
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                R$ {formatarMoedaBD(dados.RENOV_CUSTEIO)}
                {renderBotaoInfo(
                  nomeCurtoModal,
                  'RENOV. CUSTEIO',
                  dados.propostas.RENOV_CUSTEIO
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px', background: '#f4f7f9' }}>
      <div style={{ maxWidth: '1250px', margin: '0 auto' }}>
        {/* BARRA DE COMANDO DO RELATÓRIO DO GERENTE GERAL */}
        <div
          className="person-card"
          style={{
            borderLeftColor: 'var(--primary-color)',
            background: '#ffffff',
            padding: '12px 18px',
            marginBottom: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  color: 'var(--primary-color)',
                  fontSize: '15px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2px',
                }}
              >
                📑 PLANILHA DE ANÁLISE DA CARTEIRA
              </h2>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  background: '#fdf2f4',
                  color: 'var(--primary-color)',
                  border: '1px solid #f5c2c7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                }}
              >
                Visão GG
              </span>
              {qtdAlteracoesSimulacao > 0 && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  🎛️ Simulação Hipotética Ativa ({qtdAlteracoesSimulacao})
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              flexWrap: 'wrap',
            }}
          >
            {/* ITEM 2.3: Caixinha compacta apenas com o emoji 📦 para Arquivados */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                width: 'auto',
                height: '32px',
                padding: '0 9px',
                background: considerarArquivados ? '#f3e8ff' : '#f8fafc',
                color: considerarArquivados ? '#6b21a8' : '#475569',
                border: `1px solid ${considerarArquivados ? '#d8b4fe' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                margin: 0,
                userSelect: 'none',
              }}
              title="Incluir propostas arquivadas (roxas) no cálculo de estoque"
            >
              <input
                type="checkbox"
                checked={considerarArquivados}
                onChange={(e) => setConsiderarArquivados(e.target.checked)}
                style={{
                  width: '13px',
                  height: '13px',
                  margin: 0,
                  cursor: 'pointer',
                  accentColor: '#7e22ce',
                }}
              />
              📦
            </label>

            {/* ITEM 2.3: Botão discreto de Limpar Filtros (Desfaz marcações e valores hipotéticos) */}
            <button
              type="button"
              onClick={limparFiltrosSimulacao}
              disabled={qtdAlteracoesSimulacao === 0 && !simulacao.modoFlexivelAtivo}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 10px',
                background: qtdAlteracoesSimulacao > 0 ? '#fffbeb' : '#f8fafc',
                color: qtdAlteracoesSimulacao > 0 ? '#b45309' : '#94a3b8',
                border: `1px solid ${
                  qtdAlteracoesSimulacao > 0 ? '#fde68a' : '#e2e8f0'
                }`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                cursor:
                  qtdAlteracoesSimulacao > 0 || simulacao.modoFlexivelAtivo
                    ? 'pointer'
                    : 'default',
              }}
              title="Desfazer todas as desmarcações e edições provisórias de valores feitas na Planilha da Carteira"
            >
              🧹 Limpar Filtros
              {qtdAlteracoesSimulacao > 0 ? ` (${qtdAlteracoesSimulacao})` : ''}
            </button>

            <button
              type="button"
              onClick={puxarRealizadoDaAbaContratacoes}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 12px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
              title="Substitui o Realizado Oficial pela soma das propostas com status Contratado na aba Contratações"
            >
              ⚡ Puxar &quot;Realizado&quot;
            </button>

            <button
              type="button"
              onClick={() => setModoEdicaoParametros((prev) => !prev)}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 12px',
                background: modoEdicaoParametros ? 'var(--accent-color)' : '#ffffff',
                color: modoEdicaoParametros ? '#ffffff' : '#334155',
                border: `1px solid ${modoEdicaoParametros ? 'var(--accent-color)' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              ⚙️ {modoEdicaoParametros ? 'Concluir Edição' : 'Editar Metas / Banco'}
            </button>

            {/* ITEM 2.5: Novo Botão de Exportar PDF Executivo com Modal de Configuração */}
            <button
              type="button"
              onClick={() => {
                setPdfModoBase(
                  qtdAlteracoesSimulacao > 0 ? 'SIMULACAO_ATUAL' : 'PADRAO_OFICIAL'
                );
                setModalPdfAberto(true);
              }}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 13px',
                background: '#fef2f2',
                color: '#8B1530',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
              title="Exportar Relatório Executivo em PDF com detalhamento nominal do estoque por métrica"
            >
              🖨️ Exportar PDF
            </button>

            <button
              type="button"
              onClick={exportarPlanilhaGerenteGeral}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                background: '#15803d',
                color: '#ffffff',
                border: '1px solid #166534',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            >
              📊 Exportar (.XLSX)
            </button>
          </div>
        </div>

        {/* BLOCO 1: IDENTIFICAÇÃO, DESEMPENHO E FAIXAS DE 100%, 90% E 80% */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div className="person-card" style={{ background: '#fff', marginBottom: 0 }}>
            <strong style={{ color: 'var(--primary-color)', fontSize: '13px', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>
              🏦 1. Identificação e Desempenho Corporativo
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>CARTEIRA / CATEG.</div>
                {modoEdicaoParametros ? (
                  <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                    <input value={params.carteira} onChange={(e) => atualizarParametro('carteira', e.target.value)} style={{ padding: '4px', fontSize: '12px' }} />
                    <input value={params.categorizacao} onChange={(e) => atualizarParametro('categorizacao', e.target.value)} style={{ padding: '4px', fontSize: '12px', width: '50px' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                    {params.carteira} <span style={{ fontSize: '12px', color: 'var(--primary-color)' }}>(Nível {params.categorizacao})</span>
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>PONTUAÇÃO ATUAL</div>
                {modoEdicaoParametros ? (
                  <input type="number" step="0.01" value={params.pontuacao} onChange={(e) => atualizarParametro('pontuacao', parseFloat(e.target.value) || 0)} style={{ padding: '4px', fontSize: '12px', marginTop: '4px' }} />
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {params.pontuacao.toFixed(2)} pts
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>ESTOQUE CONSOLIDADO (PRONAF+MINI)</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#137333' }}>
                  R$ {formatarMoedaBD(apuracaoCarteira.estoqueConsolidadoGeral)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>RECEITA EST. ANUAL</span>
                <strong>{(params.receitaEstAnual * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>GESTÃO DO ATIVO</span>
                <strong>{(params.gestaoAtivo * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>FNE CONTRATAÇÃO</span>
                <strong>{(params.fneContratacao * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>FNE DESEMBOLSO</span>
                <strong>{(params.fneDesembolso * 100).toFixed(2)}%</strong>
              </div>
            </div>
          </div>

          <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', marginBottom: 0 }}>
            <strong style={{ color: 'var(--primary-color)', fontSize: '13px', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              🎯 Faixas de Cumprimento Anual (PRONAF + MINI = R$ {formatarMoedaBD(apuracaoCarteira.metaAnualConsolidada)})
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: '≥ 100% da Meta Anual', valor: apuracaoCarteira.faltaFaixa100 },
                { label: '≥ 90% da Meta Anual', valor: apuracaoCarteira.faltaFaixa90 },
                { label: '≥ 80% da Meta Anual', valor: apuracaoCarteira.faltaFaixa80 },
              ].map((faixa) => {
                const superada = faixa.valor <= 0;
                return (
                  <div
                    key={faixa.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: superada ? '#e6f4ea' : '#fff8e1',
                      border: `1px solid ${superada ? '#a8dab5' : '#ffe082'}`,
                    }}
                  >
                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
                      {faixa.label}
                    </span>
                    <span
                      style={{
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: superada ? '#137333' : '#b06000',
                      }}
                    >
                      {superada ? '✅ Faixa Superada (' : 'Falta: '}R$ {formatarMoedaBD(faixa.valor)}
                      {superada ? ')' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BLOCO 2: TABELA DE INDICADORES E METAS */}
        <div className="person-card" style={{ background: '#fff' }}>
          <strong style={{ color: 'var(--primary-color)', fontSize: '14px', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>
            📈 2. Indicadores, Metas e Pontuação
          </strong>
          <div style={{ overflowX: 'auto' }}>
            <table className="conf-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '12px' }}>INDICADOR</th>
                  <th>REALIZADO (R$)</th>
                  <th>META DO PERÍODO (R$)</th>
                  <th>% DO PERÍODO</th>
                  <th>META ANUAL (R$)</th>
                  <th>META DE PONTOS</th>
                  <th>PONTOS FEITOS</th>
                  <th>FALTA GANHAR</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>FNE PRONAF (Consolidado)</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafRealizadoOficial} onChange={(e) => atualizarParametro('pronafRealizadoOficial', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.pronafRealizadoOficial)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafMetaPeriodo} onChange={(e) => atualizarParametro('pronafMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.pronafMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {apuracaoCarteira.percPeriodoPronaf.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafMetaAnual} onChange={(e) => atualizarParametro('pronafMetaAnual', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.pronafMetaAnual)}`
                    )}
                  </td>
                  <td>{params.pronafMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafPontosFeitos} onChange={(e) => atualizarParametro('pronafPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.pronafPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosPronaf.toFixed(2)}</td>
                </tr>

                <tr>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>FNE MINI</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniRealizadoOficial} onChange={(e) => atualizarParametro('miniRealizadoOficial', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.miniRealizadoOficial)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniMetaPeriodo} onChange={(e) => atualizarParametro('miniMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.miniMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {apuracaoCarteira.percPeriodoMini.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniMetaAnual} onChange={(e) => atualizarParametro('miniMetaAnual', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.miniMetaAnual)}`
                    )}
                  </td>
                  <td>{params.miniMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniPontosFeitos} onChange={(e) => atualizarParametro('miniPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.miniPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosMini.toFixed(2)}</td>
                </tr>

                <tr style={{ background: '#fff9fb' }}>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px', color: '#ad1457' }}>
                    FNE CADA VEZ MELHOR
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmRealizadoOficial} onChange={(e) => atualizarParametro('cvmRealizadoOficial', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.cvmRealizadoOficial)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmMetaPeriodo} onChange={(e) => atualizarParametro('cvmMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.cvmMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: '#ad1457' }}>
                    {apuracaoCarteira.percPeriodoCvm.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmMetaAnual} onChange={(e) => atualizarParametro('cvmMetaAnual', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.cvmMetaAnual)}`
                    )}
                  </td>
                  <td>{params.cvmMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmPontosFeitos} onChange={(e) => atualizarParametro('cvmPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.cvmPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosCvm.toFixed(2)}</td>
                </tr>

                <tr>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>REEMBOLSO</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.reembolsoRealizado} onChange={(e) => atualizarParametro('reembolsoRealizado', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.reembolsoRealizado)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.reembolsoMetaPeriodo} onChange={(e) => atualizarParametro('reembolsoMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.reembolsoMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {apuracaoCarteira.percPeriodoReembolso.toFixed(2)}%
                  </td>
                  <td style={{ color: '#999' }}>Não informado</td>
                  <td>{params.reembolsoMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.reembolsoPontosFeitos} onChange={(e) => atualizarParametro('reembolsoPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.reembolsoPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosReembolso.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* BLOCO 3: ESTOQUE DA CARTEIRA POR ETAPA E SUBCONJUNTOS COM BOTÃO (i) */}
        {renderBlocoEstoque(
          '1. Estoque Consolidado — FNE PRONAF (Inclui Convencional + Cada Vez Melhor + PRONAF A)',
          'FNE PRONAF',
          'var(--primary-color)',
          apuracaoCarteira.estoque.pronaf,
          apuracaoCarteira.faltaPeriodoPronaf,
          apuracaoCarteira.faltaAnoPronaf
        )}

        {renderBlocoEstoque(
          '2. Estoque Consolidado — FNE MINI',
          'FNE MINI',
          '#1967d2',
          apuracaoCarteira.estoque.mini,
          apuracaoCarteira.faltaPeriodoMini,
          apuracaoCarteira.faltaAnoMini
        )}

        {renderBlocoEstoque(
          '3. Destaque Gerencial — FNE CADA VEZ MELHOR (Mulheres PRONAF)',
          'FNE CADA VEZ MELHOR',
          '#ad1457',
          apuracaoCarteira.estoque.cvm,
          apuracaoCarteira.faltaPeriodoCvm,
          apuracaoCarteira.faltaAnoCvm,
          'Já incluído no FNE PRONAF (Não somado novamente ao consolidado)'
        )}

        {renderBlocoEstoque(
          '4. Destaque Gerencial — FNE PRONAF A',
          'FNE PRONAF A',
          '#e65100',
          apuracaoCarteira.estoque.pronafA,
          'MESMOS PARÂMETROS DE FNE PRONAF',
          'MESMOS PARÂMETROS DE FNE PRONAF',
          'Já incluído no FNE PRONAF (Não somado novamente ao consolidado)'
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE CONFIGURAÇÃO E FILTROS DA EXPORTAÇÃO PDF DA CARTEIRA          */}
      {/* ===================================================================== */}
      {modalPdfAberto && (
        <div
          onClick={() => setModalPdfAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              width: '94%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '10px',
              borderTop: '5px solid #8B1530',
              padding: '20px 22px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', color: '#8B1530', fontWeight: 800 }}>
                  🖨️ CONFIGURAR EXPORTAÇÃO DO RELATÓRIO PDF DA CARTEIRA
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Escolha os quadros gerenciais e as listagens nominais de estoque que deseja incluir no PDF.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalPdfAberto(false)}
                style={{ width: 'auto', background: 'none', border: 'none', fontSize: '22px', color: '#64748b', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* PERGUNTA PRINCIPAL QUANDO HÁ FILTROS / MUDANÇAS HIPOTÉTICAS ATIVAS */}
            {qtdAlteracoesSimulacao > 0 && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}
              >
                <strong style={{ fontSize: '12px', color: '#b45309', display: 'block', marginBottom: '8px' }}>
                  🎛️ Há {qtdAlteracoesSimulacao} alteração(ões) provisória(s) ativa(s) na simulação de estoque. Como deseja gerar o PDF?
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div
                    onClick={() => setPdfModoBase('SIMULACAO_ATUAL')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border:
                        pdfModoBase === 'SIMULACAO_ATUAL'
                          ? '2px solid #b45309'
                          : '1px solid #cbd5e1',
                      background:
                        pdfModoBase === 'SIMULACAO_ATUAL' ? '#fef3c7' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '11.5px', color: '#92400e' }}>
                      🎯 Aplicar Simulação Hipotética Atual
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                      Usa apenas as propostas marcadas e os valores provisórios editados.
                    </div>
                  </div>

                  <div
                    onClick={() => setPdfModoBase('PADRAO_OFICIAL')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border:
                        pdfModoBase === 'PADRAO_OFICIAL'
                          ? '2px solid #15803d'
                          : '1px solid #cbd5e1',
                      background:
                        pdfModoBase === 'PADRAO_OFICIAL' ? '#dcfce7' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '11.5px', color: '#166534' }}>
                      🏛️ Usar Base Padrão Oficial (Sem Cortes)
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                      Ignora as desmarcações provisórias e considera 100% do estoque oficial.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ATALHOS RÁPIDOS DE SELEÇÃO */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setPdfSecaoIdentificacao(true);
                  setPdfSecaoFaixasAnuais(true);
                  setPdfSecaoIndicadoresMetas(true);
                  setPdfSecaoQuadrosEstoque(true);
                  setPdfListaNominalPronaf(true);
                  setPdfListaNominalCvm(true);
                  setPdfListaNominalMini(true);
                }}
                style={{
                  width: 'auto',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                ☑ Marcar Relatório Completo
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfSecaoIdentificacao(false);
                  setPdfSecaoFaixasAnuais(false);
                  setPdfSecaoIndicadoresMetas(false);
                  setPdfSecaoQuadrosEstoque(false);
                  setPdfListaNominalPronaf(true);
                  setPdfListaNominalCvm(true);
                  setPdfListaNominalMini(true);
                }}
                style={{
                  width: 'auto',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#f1f5f9',
                  color: '#8B1530',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                📋 Apenas Listagens Nominais de Estoque
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfSecaoIdentificacao(true);
                  setPdfSecaoFaixasAnuais(true);
                  setPdfSecaoIndicadoresMetas(true);
                  setPdfSecaoQuadrosEstoque(true);
                  setPdfListaNominalPronaf(false);
                  setPdfListaNominalCvm(false);
                  setPdfListaNominalMini(false);
                }}
                style={{
                  width: 'auto',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#f1f5f9',
                  color: '#1d4ed8',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                📊 Apenas Quadros Gerenciais e Metas
              </button>
            </div>

            {/* SEÇÕES DO RELATÓRIO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <strong style={{ fontSize: '11.5px', color: '#334155' }}>
                  1. Quadros Executivos & Metas:
                </strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfSecaoIdentificacao} onChange={(e) => setPdfSecaoIdentificacao(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  🏦 1. Identificação e Desempenho Corporativo
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfSecaoFaixasAnuais} onChange={(e) => setPdfSecaoFaixasAnuais(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  🎯 Faixas de Cumprimento Anual (100%, 90%, 80%)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfSecaoIndicadoresMetas} onChange={(e) => setPdfSecaoIndicadoresMetas(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  📈 2. Indicadores, Metas e Pontuação
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfSecaoQuadrosEstoque} onChange={(e) => setPdfSecaoQuadrosEstoque(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  📊 3. Quadro Sintético de Estoque
                </label>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <strong style={{ fontSize: '11.5px', color: '#334155' }}>
                  2. Listagens Nominais de Clientes em Estoque:
                </strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfListaNominalPronaf} onChange={(e) => setPdfListaNominalPronaf(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  🌾 Estoque PRONAF (Mulher + Comum + PRONAF A)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfListaNominalCvm} onChange={(e) => setPdfListaNominalCvm(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  🌸 Estoque PRONAF CVM (Apenas Cada Vez Melhor)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={pdfListaNominalMini} onChange={(e) => setPdfListaNominalMini(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  🚜 Estoque FNE MINI
                </label>

                {/* NOVO FILTRO: VERSÃO SIMPLIFICADA DO DETALHAMENTO NOMINAL */}
                <div
                  style={{
                    marginTop: '4px',
                    paddingTop: '7px',
                    borderTop: '1px dashed #cbd5e1',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      color: pdfModoNominalSimplificado ? '#8B1530' : '#1e293b',
                      background: pdfModoNominalSimplificado ? '#fdf2f4' : 'transparent',
                      padding: '5px 6px',
                      borderRadius: '6px',
                      border: pdfModoNominalSimplificado
                        ? '1px solid #f5c2c7'
                        : '1px solid transparent',
                      cursor: 'pointer',
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pdfModoNominalSimplificado}
                      onChange={(e) => {
                        const marcado = e.target.checked;
                        setPdfModoNominalSimplificado(marcado);
                        if (marcado) {
                          // No modo simplificado, foca nos 3 quadros do topo + as 3 listas diretas (PRONAF, CVM e MINI)
                          setPdfSecaoIdentificacao(true);
                          setPdfSecaoFaixasAnuais(true);
                          setPdfSecaoIndicadoresMetas(true);
                          setPdfSecaoQuadrosEstoque(false);
                          setPdfListaNominalPronaf(true);
                          setPdfListaNominalCvm(true);
                          setPdfListaNominalMini(true);
                        }
                      }}
                      style={{ width: 'auto', marginTop: '2px', accentColor: '#8B1530' }}
                    />
                    <div>
                      <div>⚡ Detalhamento Nominal Resumido / Simplificado</div>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          fontWeight: 500,
                          color: '#64748b',
                          lineHeight: 1.25,
                          marginTop: '2px',
                        }}
                      >
                        Lista direta por métrica (sem dividir por etapas), com subtotal de PRONAF A e quanto falta p/ a Meta Anual.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* ETAPAS A DETALHAR NAS LISTAGENS NOMINAIS */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
              <strong style={{ fontSize: '11.5px', color: '#334155', display: 'block', marginBottom: '6px' }}>
                3. Situações / Etapas a listar nas Tabelas Nominais de Estoque:
              </strong>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {(
                  [
                    { id: 'AG', label: 'AG (Agência / PCE)' },
                    { id: 'CENTRAL', label: 'CENTRAL (S522 / F. Assinar / F. Conf.)' },
                    { id: 'DEVOLVIDO_AG', label: 'DEVOLVIDO AG' },
                    { id: 'RENOV_CUSTEIO', label: 'RENOV. CUSTEIO' },
                  ] as Array<{ id: EtapaEstoqueKey; label: string }>
                ).map((et) => (
                  <label key={et.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={pdfEtapasIncluidas.includes(et.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPdfEtapasIncluidas([...pdfEtapasIncluidas, et.id]);
                        } else {
                          setPdfEtapasIncluidas(
                            pdfEtapasIncluidas.filter((x) => x !== et.id)
                          );
                        }
                      }}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    {et.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setModalPdfAberto(false)}
                style={{ width: 'auto', padding: '8px 16px', background: '#e2e8f0', color: '#334155', fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarExportacaoPDFCarteira}
                style={{ width: 'auto', padding: '8px 20px', background: '#8B1530', color: '#ffffff', fontSize: '12.5px', fontWeight: 800, borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                🖨️ Gerar PDF Executivo Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY DO CARD EXPANDIDO DO KANBAN (ABERTO POR CIMA DO MODAL DE COMPOSIÇÃO DO VALOR) */}
      {cardOverlayKanbanId &&
        typeof document !== 'undefined' &&
        createPortal(
          <ModuloKanban
            cards={listaCards}
            contratacoes={listaContratacoes}
            operacoesBase={listaOpBase}
            eventos={listaEventos}
            modoOverlayCardUnicoId={cardOverlayKanbanId}
            onFecharOverlayCardUnico={() => setCardOverlayKanbanId(null)}
            onAtualizarCards={(novosCards) => {
              propagarAlteracaoRealParaSistema(novosCards);
            }}
            onCardSincronizadoAlterado={(cardAtualizado, todosOsCards) => {
              const idsVinc = new Set([
                String(cardAtualizado.propostaIdVinculada || ''),
                ...(cardAtualizado.idsPropostasAgrupadas || []).map(String),
              ]);
              const novasContrat = listaContratacoes.map((r) => {
                if (
                  idsVinc.has(String(r.id)) ||
                  ((cardAtualizado.cpfVinculado || '').replace(/\D/g, '').length === 11 &&
                    (r.cpf || '').replace(/\D/g, '') ===
                      (cardAtualizado.cpfVinculado || '').replace(/\D/g, ''))
                ) {
                  return {
                    ...r,
                    situacao: cardAtualizado.situacaoVinculada || r.situacao,
                    situacaoDetalhada:
                      cardAtualizado.situacaoDetalhadaVinculada !== undefined
                        ? cardAtualizado.situacaoDetalhadaVinculada
                        : r.situacaoDetalhada,
                    obs:
                      cardAtualizado.obsVinculada !== undefined
                        ? cardAtualizado.obsVinculada
                        : r.obs,
                  };
                }
                return r;
              });
              propagarAlteracaoRealParaSistema(todosOsCards, novasContrat);
            }}
            onAtualizarContratacoes={(novas) => {
              propagarAlteracaoRealParaSistema(listaCards, novas);
            }}
            onRegistroContratacaoSalvo={(_regSalvo, todas) => {
              propagarAlteracaoRealParaSistema(listaCards, todas);
            }}
            onAtualizarOperacoesBase={(novasOps) => {
              setListaOpBase(novasOps);
              salvarDesembOpSync(novasOps).catch(() => {});
            }}
            onAtualizarEventos={(novosEvs) => {
              setListaEventos(novosEvs);
              salvarDesembEvSync(novosEvs).catch(() => {});
            }}
            onInlineEditCabecalho={(card, updates) => {
              const mapaEdicao = new Map(
                updates.operacoesEditadas.map((op) => [String(op.opId || ''), op])
              );
              const novasContrat = listaContratacoes.map((r) => {
                const matchCliente =
                  String(r.id) === String(card.propostaIdVinculada) ||
                  (card.idsPropostasAgrupadas || []).includes(String(r.id)) ||
                  ((card.cpfVinculado || '').replace(/\D/g, '').length === 11 &&
                    (r.cpf || '').replace(/\D/g, '') ===
                      (card.cpfVinculado || '').replace(/\D/g, ''));
                if (!matchCliente) return r;

                const opEdit = mapaEdicao.get(String(r.id));
                return {
                  ...r,
                  cliente: updates.cliente,
                  cpf: updates.cpf,
                  porte: updates.porte,
                  projetista: updates.projetista,
                  avalistaNome: updates.avalistaNome,
                  avalistaCpf: updates.avalistaCpf,
                  valor: opEdit ? opEdit.valor : r.valor,
                  programa:
                    opEdit && opEdit.programa !== undefined
                      ? opEdit.programa
                      : r.programa,
                };
              });

              const { html, textoPuro } = montarHtmlCardSincronizado({
                cliente: updates.cliente,
                cpf: updates.cpf,
                porte: updates.porte,
                projetista: updates.projetista,
                tipo: updates.operacoesEditadas[0]?.tipo || card.tipoOpVinculado || 'Investimento',
                valor: updates.operacoesEditadas[0]?.valor || card.valorVinculado || '0,00',
                situacaoMacro: card.situacaoVinculada || 'Na Agência',
                situacaoDetalhada: card.situacaoDetalhadaVinculada,
                pendenciasObs: card.obsVinculada,
                espacoAnalise: card.espacoAnaliseVinculado,
                tipoGarantia: updates.avalistaNome ? 'AVAL' : 'NENHUMA',
                avalistaNome: updates.avalistaNome,
                avalistaCpf: updates.avalistaCpf,
                operacoesAgrupadas: updates.operacoesEditadas.map((op) => ({
                  id: op.opId,
                  tipo: op.tipo,
                  valor: op.valor,
                  detalheExtra: op.programa,
                })),
              });

              const novosCards = listaCards.map((c) =>
                c.id === card.id
                  ? {
                      ...c,
                      clienteVinculado: updates.cliente,
                      cpfVinculado: updates.cpf,
                      porteVinculado: updates.porte,
                      valorVinculado:
                        updates.operacoesEditadas[0]?.valor || c.valorVinculado,
                      texto: html,
                      textoPuro,
                    }
                  : c
              );

              propagarAlteracaoRealParaSistema(novosCards, novasContrat);
            }}
          />,
          document.body
        )}
        
    </div>
  );
}