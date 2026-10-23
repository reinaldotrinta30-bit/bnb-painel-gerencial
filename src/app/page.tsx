'use client';

import React, { useState, useEffect } from 'react';
import ModuloContratacoes from '@/components/ModuloContratacoes';
import ModuloDesembolsos from '@/components/ModuloDesembolsos';
import ModuloKanban from '@/components/ModuloKanban';
import ModuloRelatorioCarteira from '@/components/ModuloRelatorioCarteira';
import ModuloFerramentas from '@/components/ModuloFerramentas';
import ModalInspecaoKanban from '@/components/ModalInspecaoKanban';
import { parseMoeda, getHojeBR } from '@/lib/utils';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
  CardKanban,
  EtapaKanban,
} from '@/types/painel';
import {
  carregarTudoDaNuvem,
  salvarContratacoesSync,
  salvarDesembOpSync,
  salvarDesembEvSync,
  salvarKanbanSync,
  clonarDadosDaProducaoLegada,
  setModoEstritoLocal,
  publicarEstadoAtualNaNuvemV2,
} from '@/lib/firebaseSync';
import {
  sincronizarAposSalvarContratacao,
  sincronizarAposEventoDesembolso,
  gerarCardsKanbanDaBaseExistente,
  propagarEdicaoKanbanParaBases,
  localizarCardDoClienteNoKanban,
  montarHtmlCardSincronizado,
  mesclarKanbanAntigoComContratacoes,
} from '@/lib/integradorSincronizado';


export default function PainelGerencialPage() {
  const [guiaAtiva, setGuiaAtiva] = useState<
    'contratacoes' | 'desembolsos' | 'kanban' | 'carteira' | 'ferramentas'
  >('contratacoes');

  const [contratacoes, setContratacoes] = useState<RegistroContratacao[]>([]);
  const [operacoesBase, setOperacoesBase] = useState<OperacaoBaseDesembolso[]>([]);
  const [eventos, setEventos] = useState<EventoDesembolso[]>([]);
  const [cardsKanban, setCardsKanban] = useState<CardKanban[]>([]);

  const [carregandoNuvem, setCarregandoNuvem] = useState(true);
  const [modoIsoladoLocal, setModoIsoladoLocal] = useState(true);

  // Estado para o Modal da Lupinha (Inspeção da Nota do Kanban + Atalho)
  const [inspecaoModal, setInspecaoModal] = useState<{
    aberto: boolean;
    card?: CardKanban;
    fallbackTitulo?: string;
    fallbackHtml?: string;
  }>({ aberto: false });

  // ID do Card que deve piscar/rolar quando o usuário clica no atalho da Lupinha
  const [cardDestaqueKanbanId, setCardDestaqueKanbanId] = useState<string | null>(
    null
  );

  const [focoContratacao, setFocoContratacao] = useState<{
    propostaId?: string;
    cliente?: string;
    cpf?: string;
  } | null>(null);

  const [focoDesembolso, setFocoDesembolso] = useState<{
    cliente: string;
    op?: string;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarTudoDaNuvem().then((dados) => {
      if (!ativo) return;
      setContratacoes(dados.contratacoes);
      setOperacoesBase(dados.desembOp);
      setEventos(dados.desembEv);
      setCardsKanban(dados.kanban);
      setModoIsoladoLocal(dados.modoLocal);
      setCarregandoNuvem(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const handleAtualizarContratacoes = (novas: RegistroContratacao[]) => {
    setContratacoes(novas);
    salvarContratacoesSync(novas);
  };

  // Salvar ou Editar em Contratações -> Atualiza e unifica Card no Kanban
  // ITEM 3: Função inteligente que verifica se a operação derivada possui garantia LCGH/LCGA com valor informado.
  // Se o cliente JÁ tiver esse mesmo tipo de limite (LCGH/LCGA) com o MESMO VALOR, apenas atualiza (não duplica).
  // Se for um VALOR DIFERENTE (outro imóvel/garantia complementar) ou ainda não existir, cria automaticamente o processo de limite na aba Contratações!
  const garantirProcessoLimiteNaLista = (
    opPrincipal: RegistroContratacao,
    listaBase: RegistroContratacao[]
  ): RegistroContratacao[] => {
    const lista = [...listaBase];
    const isPronafA = (opPrincipal.porte || '').toUpperCase().trim() === 'PRONAF A';
    const tipoOpUpper = (opPrincipal.tipo || '').toUpperCase().trim();
    const isDerivada = tipoOpUpper !== 'LCGH' && tipoOpUpper !== 'LCGA';

    const tipoGar = opPrincipal.tipoGarantiaKanban;
    const valorLimiteNum = parseMoeda(opPrincipal.lcgValor);

    if (
      !isPronafA &&
      isDerivada &&
      (tipoGar === 'LCGH' || tipoGar === 'LCGA') &&
      valorLimiteNum > 0
    ) {
      const cpfLimpo = (opPrincipal.cpf || '').replace(/\D/g, '');
      const nomeLimpo = (opPrincipal.cliente || '').toUpperCase().trim();

      // Procura se já existe para este cliente um limite (LCGH ou LCGA) com EXATAMENTE O MESMO VALOR
      const idxLimiteMesmoValor = lista.findIndex((r) => {
        const mesmoCli =
          cpfLimpo !== ''
            ? (r.cpf || '').replace(/\D/g, '') === cpfLimpo
            : (r.cliente || '').toUpperCase().trim() === nomeLimpo;
        const mesmoTipoLimite = (r.tipo || '').toUpperCase().trim() === tipoGar;
        const mesmoValor = Math.abs(parseMoeda(r.valor) - valorLimiteNum) < 0.01;
        return mesmoCli && mesmoTipoLimite && mesmoValor;
      });

      if (idxLimiteMesmoValor !== -1) {
        // Já existe com o mesmo valor -> Atualiza apenas a situação/observação se foi informada
        if (opPrincipal.lcgSituacao) {
          lista[idxLimiteMesmoValor] = {
            ...lista[idxLimiteMesmoValor],
            situacaoDetalhada: opPrincipal.lcgSituacao,
            obs: opPrincipal.lcgSituacao,
          };
        }
      } else {
        // Não existe com esse valor -> Cria automaticamente o processo de LCGH/LCGA na aba de Contratações!
        const novoProcessoLimite: RegistroContratacao = {
          id: `${Date.now()}_lcg_${Math.floor(Math.random() * 1000)}`,
          porte: opPrincipal.porte,
          cliente: opPrincipal.cliente,
          cpf: opPrincipal.cpf,
          valor: opPrincipal.lcgValor || '0,00',
          tipo: tipoGar,
          programa: tipoGar === 'LCGH' ? 'LCGH (975)' : 'LCGA (653)',
          situacao: opPrincipal.situacao || 'Na Agência',
          situacaoDetalhada:
            opPrincipal.lcgSituacao || `AGUARDANDO ANÁLISE (${tipoGar})`,
          projetista: opPrincipal.projetista,
          responsavel: opPrincipal.responsavel,
          telefone: opPrincipal.telefone,
          data: opPrincipal.data || getHojeBR(),
          obs: opPrincipal.lcgSituacao || '',
        };
        lista.push(novoProcessoLimite);
      }
    }

    return lista;
  };

  // Salvar ou Editar em Contratações -> Verifica auto-criação de LCGH/LCGA e unifica Card no Kanban
  const handleRegistroContratacaoSalvo = (
    regSalvo: RegistroContratacao,
    listaCompletaContratacoes: RegistroContratacao[]
  ) => {
    const listaComLimiteVerificado = garantirProcessoLimiteNaLista(
      regSalvo,
      listaCompletaContratacoes
    );

    setContratacoes(listaComLimiteVerificado);
    salvarContratacoesSync(listaComLimiteVerificado);

    const { novosCards, novasOperacoesDesemb } = sincronizarAposSalvarContratacao({
      registroSalvo: regSalvo,
      todasContratacoes: listaComLimiteVerificado,
      cardsAtuais: cardsKanban,
      operacoesDesembAtuais: operacoesBase,
    });

    setCardsKanban(novosCards);
    salvarKanbanSync(novosCards);

    if (
      novasOperacoesDesemb.length !== operacoesBase.length ||
      regSalvo.situacao === 'Contratado'
    ) {
      setOperacoesBase(novasOperacoesDesemb);
      salvarDesembOpSync(novasOperacoesDesemb);
    }
  };

  // Criar Novo Cliente/Operação pelo botão "+" das colunas do Kanban (Com checagem de LCGH/LCGA por valor)
  const handleCriarClientePeloKanban = (
    opPrincipal: RegistroContratacao,
    _opLimiteIgnorado?: RegistroContratacao,
    etapaForcada?: EtapaKanban
  ) => {
    const listaInicial = [...contratacoes, opPrincipal];
    const novaListaContrat = garantirProcessoLimiteNaLista(
      opPrincipal,
      listaInicial
    );

    setContratacoes(novaListaContrat);
    salvarContratacoesSync(novaListaContrat);

    const { novosCards, novasOperacoesDesemb } = sincronizarAposSalvarContratacao({
      registroSalvo: opPrincipal,
      todasContratacoes: novaListaContrat,
      cardsAtuais: cardsKanban,
      operacoesDesembAtuais: operacoesBase,
    });

    const cardsComEtapaEscolhida = etapaForcada
      ? novosCards.map((c) =>
          String(c.propostaIdVinculada) === String(opPrincipal.id) ||
          c.idsPropostasAgrupadas?.includes(String(opPrincipal.id))
            ? { ...c, etapa: etapaForcada }
            : c
        )
      : novosCards;

    setCardsKanban(cardsComEtapaEscolhida);
    salvarKanbanSync(cardsComEtapaEscolhida);

    if (novasOperacoesDesemb.length !== operacoesBase.length) {
      setOperacoesBase(novasOperacoesDesemb);
      salvarDesembOpSync(novasOperacoesDesemb);
    }
  };

  const handleAtualizarOperacoesBase = (novas: OperacaoBaseDesembolso[]) => {
    setOperacoesBase(novas);
    salvarDesembOpSync(novas);
  };

  const handleAtualizarEventos = (novos: EventoDesembolso[]) => {
    setEventos(novos);
    salvarDesembEvSync(novos);

    if (novos.length > 0) {
      const ultimoEv = novos[novos.length - 1];
      const opBase = operacoesBase.find(
        (o) => o.cliente === ultimoEv.cliente && o.op === ultimoEv.op
      );
      const novosCards = sincronizarAposEventoDesembolso({
        eventoSalvo: ultimoEv,
        operacaoBase: opBase,
        cardsAtuais: cardsKanban,
      });
      setCardsKanban(novosCards);
      salvarKanbanSync(novosCards);
    }
  };

  const handleAtualizarKanban = (novos: CardKanban[]) => {
    setCardsKanban(novos);
    salvarKanbanSync(novos);
  };

  const handleCardKanbanSincronizadoAlterado = (
    cardAlterado: CardKanban,
    todosOsCards: CardKanban[]
  ) => {
    const {
      contratacoesAtualizadas,
      operacoesDesembAtualizadas,
      cardFormatado,
    } = propagarEdicaoKanbanParaBases({
      cardEditado: cardAlterado,
      contratacoesAtuais: contratacoes,
      operacoesDesembAtuais: operacoesBase,
    });

    const listaFinalCards = todosOsCards.map((c) =>
      c.id === cardFormatado.id ? cardFormatado : c
    );

    setContratacoes(contratacoesAtualizadas);
    salvarContratacoesSync(contratacoesAtualizadas);

    setOperacoesBase(operacoesDesembAtualizadas);
    salvarDesembOpSync(operacoesDesembAtualizadas);

    setCardsKanban(listaFinalCards);
    salvarKanbanSync(listaFinalCards);
  };

  const handleSincronizarCarteiraParaKanban = () => {
    const { novosCards, qtdCriados, qtdAtualizados } =
      gerarCardsKanbanDaBaseExistente({
        contratacoes,
        cardsAtuais: cardsKanban,
      });
    setCardsKanban(novosCards);
    salvarKanbanSync(novosCards);
    alert(
      `✅ Sincronização concluída (com agrupamento automático de garantias LCGH/LCGA por cliente)!\n- ${qtdCriados} novos cards gerados\n- ${qtdAtualizados} cards atualizados.`
    );
  };

  // =========================================================================
  // LUPINHA (🔎) DE CONTRATAÇÕES E DESEMBOLSOS ➡️ ABRE MODAL DO CARD DO KANBAN
  // =========================================================================
  const handleInspecionarContratacaoNoKanban = (reg: RegistroContratacao) => {
    let cardEncontrado = localizarCardDoClienteNoKanban(reg, cardsKanban);

    // Se o cliente ainda não tinha card no Kanban, gera e vincula na hora para que o atalho funcione 100%!
    if (!cardEncontrado) {
      const res = sincronizarAposSalvarContratacao({
        registroSalvo: reg,
        todasContratacoes: contratacoes,
        cardsAtuais: cardsKanban,
        operacoesDesembAtuais: operacoesBase,
      });
      setCardsKanban(res.novosCards);
      salvarKanbanSync(res.novosCards);
      cardEncontrado = localizarCardDoClienteNoKanban(reg, res.novosCards);
    }

    setInspecaoModal({
      aberto: true,
      card: cardEncontrado,
      fallbackTitulo: reg.cliente,
    });
  };

  const handleInspecionarDesembolsoNoKanban = (dados: {
    cliente: string;
    op?: string;
    obsFallback?: string;
  }) => {
    const cardEncontrado = localizarCardDoClienteNoKanban(
      { cliente: dados.cliente, op: dados.op },
      cardsKanban
    );

    const fallback = montarHtmlCardSincronizado({
      cliente: dados.cliente,
      cpf: '',
      porte: '',
      tipo: 'DESEMBOLSO',
      valor: '-',
      situacaoMacro: 'Em Acompanhamento',
      pendenciasObs: dados.obsFallback || '-',
      opNum: dados.op,
    });

    setInspecaoModal({
      aberto: true,
      card: cardEncontrado,
      fallbackTitulo: dados.cliente,
      fallbackHtml: fallback.html,
    });
  };

  const handleIrParaKanbanDaLupinha = (cardId?: string) => {
    setInspecaoModal({ aberto: false });
    setGuiaAtiva('kanban');
    if (cardId) {
      setCardDestaqueKanbanId(cardId);
    }
  };

  const alternarModoIsolamento = async () => {
    const novoModoLocal = !modoIsoladoLocal;
    setModoIsoladoLocal(novoModoLocal);
    setModoEstritoLocal(novoModoLocal);

    // Se acabou de ligar a Nuvem (saiu do modo isolado), faz o upload imediato de toda a sua base atual para o Firebase V2!
    if (!novoModoLocal) {
      setCarregandoNuvem(true);
      const ok = await publicarEstadoAtualNaNuvemV2({
        contratacoes,
        desembOp: operacoesBase,
        desembEv: eventos,
        kanban: cardsKanban,
      });
      setCarregandoNuvem(false);
      if (ok) {
        alert(
          '☁️ NUVEM ATIVADA E SINCRONIZADA!\n\nTodos os dados atuais do seu Painel Gerencial foram salvos com segurança na estrutura oficial V2 do Firebase!'
        );
      }
    }
  };

  // ITEM 1 e 1.1: Puxa a base atual da nuvem (100% Somente-Leitura, sem tocar no Firebase em uso)
  // e executa o Motor de Fusão Inteligente que captura todas as situações e pendências do Kanban antigo!
  const importarCopiaFrescaProducao = async () => {
    if (
      !confirm(
        '☁️ MIGRAÇÃO E FUSÃO INTELIGENTE (MODO SEGURO SOMENTE-LEITURA):\n\nDeseja ler o seu Kanban e Contratações atuais da nuvem antiga e mesclar automaticamente todas as Situações, Pendências, Avalistas e Múltiplas Operações dos clientes para este novo Painel?\n\n🔒 Fique tranquilo: a sincronização continua DESLIGADA e o seu sistema antigo no Firebase permanecerá 100% intocado!'
      )
    ) {
      return;
    }
    setCarregandoNuvem(true);
    const clone = await clonarDadosDaProducaoLegada();

    const {
      contratacoesMescladas,
      cardsKanbanMesclados,
      resumo,
    } = mesclarKanbanAntigoComContratacoes({
      contratacoesDaNuvem: clone.contratacoes,
      kanbanAntigoDaNuvem: clone.kanban,
      operacoesDesembDaNuvem: clone.desembOp,
    });

    setContratacoes(contratacoesMescladas);
    salvarContratacoesSync(contratacoesMescladas);

    setOperacoesBase(clone.desembOp);
    salvarDesembOpSync(clone.desembOp);

    setEventos(clone.desembEv);
    salvarDesembEvSync(clone.desembEv);

    setCardsKanban(cardsKanbanMesclados);
    salvarKanbanSync(cardsKanbanMesclados);

    setCarregandoNuvem(false);
    alert(
      `✅ Migração e Fusão Inteligente concluída com sucesso!\n\n` +
        `📋 Cards lidos do Kanban antigo: ${resumo.cardsLidos}\n` +
        `🔗 Clientes com Situação/Pendências/Operações unificadas: ${resumo.clientesVinculados}\n` +
        `📌 Notas e lembretes preservados: ${resumo.notasLivresPreservadas}\n\n` +
        `🛡️ Sincronização com a nuvem antiga permanece DESLIGADA.`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* TOPBAR INSTITUCIONAL BNB */}
      <header
        style={{
          background: 'var(--primary-color)',
          color: 'white',
          padding: '10px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          zIndex: 100,
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              background: 'var(--accent-color)',
              color: '#fff',
              fontWeight: 'bold',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            BNB
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.2 }}>
              PAINEL GERENCIAL DE CRÉDITO RURAL
            </div>
            <div style={{ fontSize: '10px', opacity: 0.85 }}>
              Contratações ⇄ Desembolsos ⇄ Kanban ⇄ Relatório da Carteira
            </div>
          </div>
        </div>

        {/* Seletor Central das 4 Guias */}
        <nav style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setGuiaAtiva('contratacoes')}
            style={{
              background: guiaAtiva === 'contratacoes' ? '#ffffff' : 'transparent',
              color: guiaAtiva === 'contratacoes' ? 'var(--primary-color)' : '#ffffff',
              padding: '7px 13px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            📈 1. Contratações
          </button>

          <button
            onClick={() => setGuiaAtiva('desembolsos')}
            style={{
              background: guiaAtiva === 'desembolsos' ? '#ffffff' : 'transparent',
              color: guiaAtiva === 'desembolsos' ? 'var(--primary-color)' : '#ffffff',
              padding: '7px 13px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            📊 2. Desembolsos
          </button>

          <button
            onClick={() => setGuiaAtiva('kanban')}
            style={{
              background: guiaAtiva === 'kanban' ? '#ffffff' : 'transparent',
              color: guiaAtiva === 'kanban' ? 'var(--primary-color)' : '#ffffff',
              padding: '7px 13px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            📋 3. Quadro de Tarefas
          </button>

          <button
            onClick={() => setGuiaAtiva('carteira')}
            style={{
              background: guiaAtiva === 'carteira' ? 'var(--support-yellow)' : 'rgba(255,203,5,0.18)',
              color: guiaAtiva === 'carteira' ? '#333' : '#fff',
              border: '1px solid rgba(255,203,5,0.5)',
              padding: '7px 13px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            📑 4. Planilha da Carteira (GG)
          </button>

            <button
            onClick={() => setGuiaAtiva('ferramentas')}
            style={{
              background: guiaAtiva === 'ferramentas' ? '#ffffff' : 'transparent',
              color: guiaAtiva === 'ferramentas' ? 'var(--primary-color)' : '#ffffff',
              padding: '7px 13px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            🛠️ 5. Ferramentas
          </button>
        </nav>

        {/* Controles de Blindagem Anti-Conflito */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={importarCopiaFrescaProducao}
            style={{
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              padding: '6px 10px',
              fontSize: '11px',
              borderRadius: '4px',
            }}
            title="Lê os dados atuais do Firebase antigo sem alterar nada lá"
          >
            📥 Puxar Cópia do Firebase Atual
          </button>

          <button
            onClick={alternarModoIsolamento}
            style={{
              background: modoIsoladoLocal ? '#137333' : '#e65100',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              padding: '6px 10px',
              fontSize: '11px',
              borderRadius: '12px',
            }}
          >
            {carregandoNuvem
              ? '⏳ Carregando...'
              : modoIsoladoLocal
              ? '🛡️ Isolado (100% Offline Seguro)'
              : '☁️ Sandbox Nuvem V2'}
          </button>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO DA GUIA SELECIONADA */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {guiaAtiva === 'contratacoes' && (
          <ModuloContratacoes
            registros={contratacoes}
            cardsKanban={cardsKanban}
            onAtualizarRegistros={handleAtualizarContratacoes}
            onRegistroSalvoSincronizar={handleRegistroContratacaoSalvo}
            onInspecionarNoKanban={handleInspecionarContratacaoNoKanban}
            focoExternoContratacao={focoContratacao}
            onLimparFocoExterno={() => setFocoContratacao(null)}
          />
        )}

        {guiaAtiva === 'desembolsos' && (
          <ModuloDesembolsos
            contratacoes={contratacoes}
            operacoesBase={operacoesBase}
            eventos={eventos}
            onAtualizarOperacoesBase={handleAtualizarOperacoesBase}
            onAtualizarEventos={handleAtualizarEventos}
            onInspecionarNoKanban={handleInspecionarDesembolsoNoKanban}
            focoExternoDesembolso={focoDesembolso}
            onLimparFocoExternoDesembolso={() => setFocoDesembolso(null)}
          />
        )}

        {guiaAtiva === 'kanban' && (
          <ModuloKanban
            cards={cardsKanban}
            onAtualizarCards={handleAtualizarKanban}
            onCardSincronizadoAlterado={handleCardKanbanSincronizadoAlterado}
            onCriarClientePeloKanban={handleCriarClientePeloKanban}
            onSincronizarBaseCompleta={handleSincronizarCarteiraParaKanban}
            cardDestaqueExternoId={cardDestaqueKanbanId}
            onLimparDestaqueExterno={() => setCardDestaqueKanbanId(null)}
            onAbrirClienteEmContratacoes={(card) => {
              setFocoContratacao({
                propostaId: card.propostaIdVinculada,
                cliente: card.clienteVinculado,
                cpf: card.cpfVinculado,
              });
              setGuiaAtiva('contratacoes');
            }}
            onAbrirClienteEmDesembolsos={(card) => {
              setFocoDesembolso({
                cliente: card.clienteVinculado || '',
                op: card.opDesembolsoVinculada,
              });
              setGuiaAtiva('desembolsos');
            }}

            onAlterarSituacaoDesembolsoPeloKanban={(card, novaSitDesemb) => {
              const nomeCli = (card.clienteVinculado || '').toUpperCase().trim();
              if (!nomeCli) return;

              // Atualiza o último evento de desembolso desse cliente (ou cria um registro rápido se ainda não houver evento)
              const opDoCli = operacoesBase.find(
                (o) =>
                  (card.propostaIdVinculada &&
                    String(o.propostaIdOrigem) ===
                      String(card.propostaIdVinculada)) ||
                  o.cliente.toUpperCase().trim() === nomeCli
              );

              const indicesEv = eventos
                .map((ev, idx) =>
                  ev.cliente.toUpperCase().trim() === nomeCli ? idx : -1
                )
                .filter((idx) => idx !== -1);

              if (indicesEv.length > 0) {
                const ultimoIdx = indicesEv[indicesEv.length - 1];
                const novosEv = [...eventos];
                novosEv[ultimoIdx] = {
                  ...novosEv[ultimoIdx],
                  situacao: novaSitDesemb,
                  data: getHojeBR(),
                };
                setEventos(novosEv);
                salvarDesembEvSync(novosEv);
              } else if (opDoCli) {
                const novoEv = {
                  id: String(Date.now()),
                  cliente: opDoCli.cliente,
                  op: opDoCli.op,
                  parcela: '1',
                  valor: opDoCli.valor,
                  situacao: novaSitDesemb,
                  data: getHojeBR(),
                  obs: 'Atualizado via Tarja do Kanban',
                } as EventoDesembolso;
                
                const novosEv = [...eventos, novoEv];
                setEventos(novosEv);
                salvarDesembEvSync(novosEv);
              }
            }}

          />
        )}

        {guiaAtiva === 'carteira' && (
          <ModuloRelatorioCarteira
            contratacoes={contratacoes}
            cardsKanban={cardsKanban}
          />
        )}

       {guiaAtiva === 'ferramentas' && (
          <ModuloFerramentas
            contratacoes={contratacoes}
            operacoesBase={operacoesBase}
            eventos={eventos}
            cardsKanban={cardsKanban}
            onRestaurarBackupCompleto={(dados) => {
              setContratacoes(dados.contratacoes);
              salvarContratacoesSync(dados.contratacoes);
              setOperacoesBase(dados.operacoesBase);
              salvarDesembOpSync(dados.operacoesBase);
              setEventos(dados.eventos);
              salvarDesembEvSync(dados.eventos);
              setCardsKanban(dados.cardsKanban);
              salvarKanbanSync(dados.cardsKanban);
            }}
          />
        )} 

      </main>

      {/* MODAL UNIFICADO DA LUPINHA (INSPEÇÃO DA NOTA DO KANBAN + ATALHO DIRETO) */}
      <ModalInspecaoKanban
        aberto={inspecaoModal.aberto}
        onFechar={() => setInspecaoModal({ aberto: false })}
        card={inspecaoModal.card}
        fallbackTitulo={inspecaoModal.fallbackTitulo}
        fallbackHtml={inspecaoModal.fallbackHtml}
        onIrParaKanban={handleIrParaKanbanDaLupinha}
      />
    </div>
  );
}