import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
  CardKanban,
  EtapaKanban,
  StatusCorKanban,
} from '@/types/painel';
import { getHojeISO, getHojeBR } from '@/lib/utils';

export interface ItemOperacaoClienteKanban {
  id?: string;
  tipo: string;
  valor: string;
  situacao?: string;
  detalheExtra?: string;
}

// ============================================================================
// 1. GERADOR DO LAYOUT DIDÁTICO DO CARD (SUPORTA MÚLTIPLAS OPERAÇÕES + ESPAÇO ANÁLISE)
// ============================================================================
export function montarHtmlCardSincronizado(params: {
  cliente: string;
  cpf: string;
  porte: string;
  projetista?: string;
  tipo: string;
  valor: string;
  situacaoMacro: string;
  situacaoDetalhada?: string;
  pendenciasObs?: string;
  espacoAnalise?: string;
  // Dados de Garantia (ignorados automaticamente se PRONAF A)
  tipoGarantia?: 'NENHUMA' | 'AVAL' | 'LCGH' | 'LCGA';
  avalistaNome?: string;
  avalistaCpf?: string;
  lcgTipo?: 'LCGH' | 'LCGA';
  lcgValor?: string;
  lcgSituacao?: string;
  // ITEM 2: Lista de todas as operações do mesmo cliente (ex: LCGH + Investimento + Renov. Custeio)
  operacoesAgrupadas?: ItemOperacaoClienteKanban[];
  opNum?: string;
  parcela?: string;
}): { html: string; textoPuro: string } {
  const {
    cliente,
    cpf,
    porte,
    projetista,
    tipo,
    valor,
    situacaoMacro,
    situacaoDetalhada,
    pendenciasObs,
    espacoAnalise,
    tipoGarantia,
    avalistaNome,
    avalistaCpf,
    lcgTipo,
    lcgValor,
    lcgSituacao,
    operacoesAgrupadas,
    opNum,
    parcela,
  } = params;

  const isPronafA = (porte || '').toUpperCase().trim() === 'PRONAF A';

  const formatarLabelTipo = (t: string) => {
    const tu = (t || '').toUpperCase().trim();
    if (tu.includes('RENOVA')) return 'RENOV. CUSTEIO';
    return tu || 'PROPOSTA';
  };

  // 1. Linha de Avalista (se houver e não for PRONAF A)
  let linhaAvalHtml = '';
  let linhaAvalPuro = '';
  if (!isPronafA && tipoGarantia === 'AVAL' && (avalistaNome || avalistaCpf)) {
    linhaAvalHtml = `<div><b>AVAL:</b> ${avalistaNome || 'INFORMAR AVALISTA'}${
      avalistaCpf ? ` - ${avalistaCpf}` : ''
    }</div>`;
    linhaAvalPuro = `AVAL: ${avalistaNome || ''} - ${avalistaCpf || ''}\n`;
  }

  // 2. Montagem das Linhas de Operações (Suporta 1 ou Múltiplas Operações como LCGH + Investimento + Custeio)
  let linhasOperacoesHtml = '';
  let linhasOperacoesPuro = '';

  if (operacoesAgrupadas && operacoesAgrupadas.length > 0) {
    // Ordena para que LCGH / LCGA apareçam primeiro no cabeçalho, mostrando apenas TIPO: R$ VALOR
    const ordenadas = [...operacoesAgrupadas].sort((a, b) => {
      const aLim = a.tipo.toUpperCase().includes('LCG') ? 0 : 1;
      const bLim = b.tipo.toUpperCase().includes('LCG') ? 0 : 1;
      return aLim - bLim;
    });

    ordenadas.forEach((opItem) => {
      const label = formatarLabelTipo(opItem.tipo);
      const isLim = label === 'LCGH' || label === 'LCGA';
      const corEstilo = isLim ? ' style="color:#8B1530;"' : '';
      linhasOperacoesHtml += `<div${corEstilo}><b>${label}:</b> R$ ${
        opItem.valor || '0,00'
      }</div>`;
      linhasOperacoesPuro += `${label}: R$ ${opItem.valor || '0,00'}\n`;
    });
  } else {
    const tipoUpper = (tipo || '').toUpperCase().trim();
    const isSomenteLimite = tipoUpper === 'LCGH' || tipoUpper === 'LCGA';

    if (isSomenteLimite) {
      linhasOperacoesHtml = `<div style="color:#8B1530;"><b>${tipoUpper}:</b> R$ ${
        valor || '0,00'
      }</div>`;
      linhasOperacoesPuro = `${tipoUpper}: R$ ${valor || '0,00'}\n`;
    } else {
      if (
        !isPronafA &&
        (tipoGarantia === 'LCGH' || tipoGarantia === 'LCGA' || lcgTipo) &&
        lcgValor
      ) {
        const labelLcg = lcgTipo || tipoGarantia || 'LCGH';
        linhasOperacoesHtml += `<div style="color:#8B1530;"><b>${labelLcg}:</b> R$ ${lcgValor}</div>`;
        linhasOperacoesPuro += `${labelLcg}: R$ ${lcgValor}\n`;
      }
      const labelDerivada = formatarLabelTipo(tipo);
      linhasOperacoesHtml += `<div><b>${labelDerivada}:</b> R$ ${
        valor || '0,00'
      }</div>`;
      linhasOperacoesPuro += `${labelDerivada}: R$ ${valor || '0,00'}\n`;
    }
  }

  // 3. Formatação inteligente que PRESERVA cores, negritos, grifos e emojis (Item 6)
  // e elimina o bug de multiplicação de traços "- " vazios (Item 6.3)!
  const formatarBlocoRicoOuTexto = (conteudoBruto?: string, padraoVazio = '-'): string => {
    if (!conteudoBruto || !conteudoBruto.trim()) {
      return `<div>${padraoVazio}</div>`;
    }
    const limpo = conteudoBruto.trim();

    // Se já contém tags HTML de formatação (ex: <b>, <span style=...>, <font>, <div>),
    // preserva o HTML intacto limpando apenas excessos de linhas "- " vazias consecutivas!
    if (/<(div|span|b|strong|i|em|u|s|strike|font|br|ul|li)\b/i.test(limpo)) {
      return limpo
        .replace(/(<div>\s*-\s*<\/div>\s*){2,}/gi, '<div>-</div>')
        .replace(/(<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){2,}/gi, '<div><br></div>');
    }

    // Se for texto puro, converte quebras de linha sem duplicar traços soltos
    const linhas = limpo.split('\n');
    const resultado: string[] = [];
    let ultimoFoiTracoVazio = false;

    linhas.forEach((l) => {
      const t = l.trim();
      if (!t || t === '-') {
        if (!ultimoFoiTracoVazio) {
          resultado.push('<div>-</div>');
          ultimoFoiTracoVazio = true;
        }
      } else {
        ultimoFoiTracoVazio = false;
        resultado.push(`<div>${t.startsWith('-') ? t : `- ${t}`}</div>`);
      }
    });

    return resultado.length > 0 ? resultado.join('') : `<div>${padraoVazio}</div>`;
  };

  // ITEM 10: Se não houver situação detalhada escrita pelo usuário, inicia apenas com "-" (sem injetar o nome da tarja no texto!)
  const textoSitLivre =
    situacaoDetalhada && situacaoDetalhada.trim() !== ''
      ? situacaoDetalhada.trim()
      : '-';

  const textoPendencias =
    pendenciasObs && pendenciasObs.trim() !== '' ? pendenciasObs.trim() : '-';

  const textoAnalise =
    espacoAnalise && espacoAnalise.trim() !== '' ? espacoAnalise.trim() : '-';

  const linhasSitHtml = formatarBlocoRicoOuTexto(textoSitLivre, '-');
  const linhasPendHtml = formatarBlocoRicoOuTexto(textoPendencias, '-');
  const linhasAnaliseHtml = formatarBlocoRicoOuTexto(textoAnalise, '-');

  const linhaOpDesemb = opNum
    ? `<div><b>OPERAÇÃO:</b> ${opNum}${
        parcela ? ` (${parcela}ª PARCELA)` : ''
      }</div>`
    : '';

  // ITEM 4 e ITEM 5: O cabeçalho permite seleção de texto (user-select: text),
  // os títulos têm contenteditable="false", e SOMENTE as 3 caixas internas têm contenteditable="true"!
  const html = `<div contenteditable="false" class="card-bloco-cliente"><div><b>${(
    cliente || 'CLIENTE SEM NOME'
  ).toUpperCase()}</b>${
    cpf ? ` - <b>CPF:</b> ${cpf}` : ''
  }</div><div><b>PORTE:</b> ${porte || '-'}</div><div><b>PROJETISTA:</b> ${
    projetista || '-'
  }</div>${linhaAvalHtml}${linhasOperacoesHtml}${linhaOpDesemb}</div><div contenteditable="false" class="card-titulo-situacao">📊 SITUAÇÃO:</div><div contenteditable="true" class="bloco-editavel-situacao">${linhasSitHtml}</div><div contenteditable="false" class="card-titulo-pendencias">📝 PENDÊNCIAS / OBSERVAÇÕES:</div><div contenteditable="true" class="bloco-editavel-pendencias">${linhasPendHtml}</div><div contenteditable="false" class="card-titulo-analise">🔍 ESPAÇO PARA ANÁLISE (CONFORMIDADE / CÁLCULOS):</div><div contenteditable="true" class="bloco-editavel-analise">${linhasAnaliseHtml}</div>`;

  // Remove tags HTML apenas para gerar o índice de busca rápida (textoPuro)
  const removerTags = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();

  const textoPuro = `${cliente} - CPF: ${cpf}\nPORTE: ${porte}\nPROJETISTA: ${
    projetista || '-'
  }\n${linhaAvalPuro}${linhasOperacoesPuro}\nSITUAÇÃO:\n${removerTags(
    linhasSitHtml
  )}\n\nPENDÊNCIAS / OBSERVAÇÕES:\n${removerTags(
    linhasPendHtml
  )}\n\nESPAÇO PARA ANÁLISE:\n${removerTags(linhasAnaliseHtml)}`;

  return { html, textoPuro };
}

// ============================================================================
// 2. EXTRATOR RICO (PRESERVA CORES, NEGRITOS, MARCA-TEXTO E CORRIGE TRAÇOS DUPLICADOS)
// ============================================================================
export function extrairCamposLivresDoHtmlKanban(
  htmlCard: string,
  textoPuroFallback?: string
): {
  situacaoDetalhada?: string;
  pendenciasObs?: string;
  espacoAnalise?: string;
} {
  if (typeof document !== 'undefined' && htmlCard && htmlCard.includes('bloco-editavel-')) {
    const temp = document.createElement('div');
    temp.innerHTML = htmlCard;

    // Remove grifos temporários da lupa de pesquisa interna se houver
    temp.querySelectorAll('mark.highlight-find').forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m);
        parent.normalize();
      }
    });

    const limparHtmlCaixa = (el: Element | null): string | undefined => {
      if (!el) return undefined;
      const htmlInterno = el.innerHTML
        .replace(/(<div>\s*-\s*<\/div>\s*){2,}/gi, '<div>-</div>')
        .trim();
      const textoLimpo = (el.textContent || '').trim();
      if (!textoLimpo || textoLimpo === '-') return '';
      return htmlInterno;
    };

    const elSit = temp.querySelector('.bloco-editavel-situacao');
    const elPend = temp.querySelector('.bloco-editavel-pendencias');
    const elAnalise = temp.querySelector('.bloco-editavel-analise');

    return {
      situacaoDetalhada: limparHtmlCaixa(elSit),
      pendenciasObs: limparHtmlCaixa(elPend),
      espacoAnalise: limparHtmlCaixa(elAnalise),
    };
  }

  return extrairCamposLivresDoTextoKanban(textoPuroFallback || htmlCard);
}

export function extrairCamposLivresDoTextoKanban(textoPuro: string): {
  situacaoDetalhada?: string;
  pendenciasObs?: string;
  espacoAnalise?: string;
} {
  if (!textoPuro) return {};
  const textoNormalizado = textoPuro
    .replace(/\r/g, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const limparTracosRepetidos = (bloco: string): string => {
    const linhas = bloco.split('\n');
    const out: string[] = [];
    let ultimoVazio = false;
    linhas.forEach((l) => {
      const t = l.trim();
      if (t.includes('📌')) return;
      if (!t || t === '-') {
        if (!ultimoVazio && out.length > 0) {
          out.push('-');
          ultimoVazio = true;
        }
      } else {
        ultimoVazio = false;
        out.push(t);
      }
    });
    while (out.length > 0 && out[out.length - 1] === '-') {
      out.pop();
    }
    return out.join('\n').trim();
  };

  let situacaoDetalhada: string | undefined;
  let pendenciasObs: string | undefined;
  let espacoAnalise: string | undefined;

  const regexSit =
    /(?:📊\s*)?(?:SITUAÇÃO|SIRUAÇÃO)(?:\s*\/\s*OBSERVAÇÕES)?\s*:\s*([\s\S]*?)(?=(?:📝\s*)?PENDÊNCIAS|(?:🔍\s*)?ESPAÇO PARA ANÁLISE|$)/i;
  const matchSit = textoNormalizado.match(regexSit);
  if (matchSit && matchSit[1] !== undefined) {
    situacaoDetalhada = limparTracosRepetidos(matchSit[1]);
  }

  const regexPend =
    /(?:📝\s*)?PENDÊNCIAS(?:\s*\/\s*OBSERVAÇÕES)?\s*:\s*([\s\S]*?)(?=(?:🔍\s*)?ESPAÇO PARA ANÁLISE|$)/i;
  const matchPend = textoNormalizado.match(regexPend);
  if (matchPend && matchPend[1] !== undefined) {
    pendenciasObs = limparTracosRepetidos(matchPend[1]);
  }

  const regexAnalise =
    /(?:🔍\s*)?ESPAÇO PARA ANÁLISE(?:\s*\([^)]*\))?\s*:\s*([\s\S]*?)$/i;
  const matchAnalise = textoNormalizado.match(regexAnalise);
  if (matchAnalise && matchAnalise[1] !== undefined) {
    espacoAnalise = limparTracosRepetidos(matchAnalise[1]);
  }

  return { situacaoDetalhada, pendenciasObs, espacoAnalise };
}

// ============================================================================
// 3. PARSER INTELIGENTE DE CARDS ANTIGOS DA NUVEM (ITEM 1: MIGRAÇÃO AUTOMÁTICA)
// Lê o texto que você escrevia manualmente no Kanban antigo e extrai cada dado!
// ============================================================================
export function analisarCardManualLegado(cardLegado: CardKanban): {
  nomeCliente: string;
  cpfCliente: string;
  porte: string;
  projetista: string;
  avalistaNome?: string;
  avalistaCpf?: string;
  lcgTipo?: 'LCGH' | 'LCGA';
  lcgDetalhe?: string;
  situacaoLivre: string;
  pendenciasLivre: string;
} {
  let puro = cardLegado.textoPuro || '';
  if (!puro && typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = (cardLegado.texto || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n');
    puro = div.innerText || div.textContent || '';
  }

  const linhas = puro
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let nomeCliente = '';
  let cpfCliente = '';
  let porte = '';
  let projetista = '';
  let avalistaNome: string | undefined;
  let avalistaCpf: string | undefined;
  let lcgTipo: 'LCGH' | 'LCGA' | undefined;
  let lcgDetalhe: string | undefined;

  // Extrai CPF no formato 000.000.000-00 da primeira linha (ou de qualquer linha de cabeçalho)
  const primeiraLinha = linhas[0] || '';
  const matchCpf = primeiraLinha.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
  if (matchCpf) {
    cpfCliente = matchCpf[1];
    nomeCliente = primeiraLinha
      .split(/-\s*CPF:?/i)[0]
      .replace(cpfCliente, '')
      .replace(/[-:]/g, '')
      .trim()
      .toUpperCase();
  } else {
    nomeCliente = primeiraLinha.toUpperCase().trim();
  }

  linhas.forEach((l) => {
    const upper = l.toUpperCase();
    if (upper.startsWith('PORTE:')) {
      porte = l.substring(6).trim().toUpperCase();
      if (porte === 'PRONAF') porte = 'PRONAF V';
    } else if (upper.startsWith('PROJETISTA:')) {
      projetista = l.substring(11).trim().toUpperCase();
    } else if (upper.startsWith('AVAL:') || upper.startsWith('AVALISTA:')) {
      const resto = l.replace(/^AVAL(?:ISTA)?:\s*/i, '').trim();
      const mCpfAval = resto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
      if (mCpfAval) {
        avalistaCpf = mCpfAval[1];
        avalistaNome = resto.replace(avalistaCpf, '').replace(/[-:]/g, '').trim();
      } else {
        avalistaNome = resto;
      }
    } else if (upper.startsWith('LCGH:') || upper.startsWith('LCGA:')) {
      lcgTipo = upper.startsWith('LCGH:') ? 'LCGH' : 'LCGA';
      lcgDetalhe = l.substring(5).trim();
    }
  });

  const extraidos = extrairCamposLivresDoTextoKanban(puro);

  return {
    nomeCliente,
    cpfCliente,
    porte,
    projetista,
    avalistaNome,
    avalistaCpf,
    lcgTipo,
    lcgDetalhe,
    situacaoLivre: extraidos.situacaoDetalhada || '',
    pendenciasLivre: extraidos.pendenciasObs || '',
  };
}

// ============================================================================
// 4. FUSÃO INTELIGENTE: UNE OS CARDS MANUAIS DA NUVEM ANTIGA COM AS CONTRATAÇÕES!
// ============================================================================
export function mesclarKanbanAntigoComContratacoes(params: {
  contratacoesDaNuvem: RegistroContratacao[];
  kanbanAntigoDaNuvem: CardKanban[];
  operacoesDesembDaNuvem: OperacaoBaseDesembolso[];
}): {
  contratacoesMescladas: RegistroContratacao[];
  cardsKanbanMesclados: CardKanban[];
  resumo: {
    cardsLidos: number;
    clientesVinculados: number;
    notasLivresPreservadas: number;
  };
} {
  const { contratacoesDaNuvem, kanbanAntigoDaNuvem } = params;
  const novasContratacoes = contratacoesDaNuvem.map((c) => ({ ...c }));
  const cardsNotasLivres: CardKanban[] = [];

  let clientesVinculados = 0;
  let notasLivresPreservadas = 0;

  // Mapa auxiliar para guardar a etapa e a cor exatas que o card tinha no Kanban antigo
  const mapaPreferenciaKanban = new Map<
    string,
    { etapa: EtapaKanban; cor: StatusCorKanban; dataMod: string }
  >();

  kanbanAntigoDaNuvem.forEach((cardAntigo) => {
    if (cardAntigo.etapa === 'NOTAS') {
      cardsNotasLivres.push(cardAntigo);
      notasLivresPreservadas++;
      return;
    }

    const info = analisarCardManualLegado(cardAntigo);

    // Procura todas as propostas desse cliente na base de Contratações (pelo CPF ou pelo Nome)
    const indicesEncontrados: number[] = [];
    novasContratacoes.forEach((reg, idx) => {
      const matchCpf =
        info.cpfCliente &&
        reg.cpf &&
        reg.cpf.replace(/\D/g, '') === info.cpfCliente.replace(/\D/g, '');
      const matchNome =
        info.nomeCliente &&
        info.nomeCliente.length > 4 &&
        (reg.cliente.toUpperCase().trim() === info.nomeCliente ||
          reg.cliente.toUpperCase().includes(info.nomeCliente) ||
          info.nomeCliente.includes(reg.cliente.toUpperCase().trim()));

      if (matchCpf || matchNome) {
        indicesEncontrados.push(idx);
      }
    });

    if (indicesEncontrados.length > 0) {
      clientesVinculados++;
      indicesEncontrados.forEach((idx) => {
        const reg = novasContratacoes[idx];
        mapaPreferenciaKanban.set(String(reg.id), {
          etapa: cardAntigo.etapa,
          cor: cardAntigo.statusCor,
          dataMod: cardAntigo.dataModificacao || getHojeISO(),
        });

        novasContratacoes[idx] = {
          ...reg,
          situacaoDetalhada: info.situacaoLivre || reg.situacaoDetalhada,
          obs: info.pendenciasLivre || reg.obs,
          avalistaNome: info.avalistaNome || reg.avalistaNome,
          avalistaCpf: info.avalistaCpf || reg.avalistaCpf,
          tipoGarantiaKanban: info.avalistaNome
            ? 'AVAL'
            : info.lcgTipo
            ? info.lcgTipo
            : reg.tipoGarantiaKanban,
          lcgSituacao: info.lcgDetalhe || reg.lcgSituacao,
        };
      });
    } else {
      // Se era um card no Kanban antigo que ainda não tinha linha na planilha de Contratações, preserva o card intacto!
      cardsNotasLivres.push(cardAntigo);
      notasLivresPreservadas++;
    }
  });

  // Agora gera os cards unificados da carteira respeitando a etapa e a cor originais do Kanban antigo!
  const { novosCards } = gerarCardsKanbanDaBaseExistente({
    contratacoes: novasContratacoes,
    cardsAtuais: [],
  });

  const cardsComEtapaPreservada = novosCards.map((c) => {
    const pref = c.propostaIdVinculada
      ? mapaPreferenciaKanban.get(String(c.propostaIdVinculada))
      : undefined;
    if (pref) {
      return {
        ...c,
        etapa: pref.etapa,
        statusCor: pref.cor,
        dataModificacao: pref.dataMod,
      };
    }
    return c;
  });

  return {
    contratacoesMescladas: novasContratacoes,
    cardsKanbanMesclados: [...cardsNotasLivres, ...cardsComEtapaPreservada],
    resumo: {
      cardsLidos: kanbanAntigoDaNuvem.length,
      clientesVinculados,
      notasLivresPreservadas,
    },
  };
}

// ============================================================================
// 5. MAPEAMENTO DE SITUAÇÃO DE CONTRATAÇÕES ➡️ ETAPA E COR DO KANBAN
// ============================================================================
export function mapearContratacaoParaKanban(reg: RegistroContratacao): {
  etapa: EtapaKanban;
  cor: StatusCorKanban;
} {
  const sit = reg.situacao || '';
  const tipo = (reg.tipo || '').toUpperCase();
  const temPendencia = Boolean(
    reg.obs && reg.obs.trim() !== '' && reg.obs.trim() !== '-'
  );

  if (sit === 'Contratado') {
    return { etapa: 'DESEMBOLSOS', cor: 'azul' };
  }
  if (tipo.includes('RENOVAÇÃO')) {
    return { etapa: 'CONTRATOS', cor: temPendencia ? 'vermelho' : 'amarelo' };
  }
  if (sit === 'Na Central') {
    return { etapa: 'S522', cor: temPendencia ? 'vermelho' : 'azul' };
  }
  if (sit === 'Devolvido AG') {
    return { etapa: 'PCE', cor: 'vermelho' };
  }
  if (sit === 'Na Agência') {
    return { etapa: 'PCE', cor: temPendencia ? 'amarelo' : 'azul' };
  }
  return { etapa: 'CADASTROS', cor: 'amarelo' };
}

export function mapearEtapaKanbanParaSituacaoContratacao(
  etapa: EtapaKanban,
  corAtual?: StatusCorKanban,
  situacaoAnterior?: string
): string {
  switch (etapa) {
    case 'CADASTROS':
      return 'Com Cliente/Projetista';
    case 'PCE':
      if (corAtual === 'vermelho' && situacaoAnterior === 'Devolvido AG') {
        return 'Devolvido AG';
      }
      return 'Na Agência';
    case 'S522':
      return 'Na Central';
    case 'CONTRATOS':
      return situacaoAnterior === 'Na Central' ? 'Na Central' : 'Na Agência';
    case 'DESEMBOLSOS':
    case 'ACOMPANHAMENTO':
      return 'Contratado';
    default:
      return situacaoAnterior || 'Na Agência';
  }
}

export function localizarCardDoClienteNoKanban(
  reg: { id?: string; cliente: string; cpf?: string; op?: string },
  cards?: CardKanban[]
): CardKanban | undefined {
  if (!cards || !Array.isArray(cards)) return undefined;
  if (reg.id) {
    const porId = cards.find(
      (c) =>
        String(c.propostaIdVinculada) === String(reg.id) ||
        String(c.lcgPropostaIdVinculada) === String(reg.id) ||
        c.idsPropostasAgrupadas?.includes(String(reg.id))
    );
    if (porId) return porId;
  }
  if (reg.op) {
    const porOp = cards.find((c) => c.opDesembolsoVinculada === reg.op);
    if (porOp) return porOp;
  }
  if (reg.cpf && reg.cpf.trim() !== '') {
    const porCpf = cards.find(
      (c) =>
        c.cpfVinculado === reg.cpf ||
        (c.textoPuro || c.texto || '').includes(reg.cpf)
    );
    if (porCpf) return porCpf;
  }
  const nomeUpper = (reg.cliente || '').toUpperCase().trim();
  if (nomeUpper) {
    return cards.find(
      (c) =>
        (c.clienteVinculado || '').toUpperCase().trim() === nomeUpper ||
        (c.textoPuro || c.texto || '').toUpperCase().includes(nomeUpper)
    );
  }
  return undefined;
}

// ============================================================================
// 6. SINCRONIZAÇÃO INTELIGENTE: AGRUPA TODAS AS OPERAÇÕES DO CLIENTE NO MESMO CARD!
// (Ex: LCGH + Investimento + Renov. Custeio)
// ============================================================================
export function sincronizarAposSalvarContratacao(params: {
  registroSalvo: RegistroContratacao;
  todasContratacoes: RegistroContratacao[];
  cardsAtuais: CardKanban[];
  operacoesDesembAtuais: OperacaoBaseDesembolso[];
}): {
  novosCards: CardKanban[];
  novasOperacoesDesemb: OperacaoBaseDesembolso[];
} {
  const {
    registroSalvo,
    todasContratacoes,
    cardsAtuais,
    operacoesDesembAtuais,
  } = params;
  const hojeISO = getHojeISO();

  // Localiza TODAS as propostas do mesmo cliente (pelo CPF ou pelo Nome exato)
  const opsMesmoCliente = todasContratacoes.filter((r) => {
    if (registroSalvo.cpf && r.cpf) {
      return (
        r.cpf.replace(/\D/g, '') !== '' &&
        r.cpf.replace(/\D/g, '') === registroSalvo.cpf.replace(/\D/g, '')
      );
    }
    return (
      r.cliente.toUpperCase().trim() ===
      registroSalvo.cliente.toUpperCase().trim()
    );
  });

  const opsDerivadas = opsMesmoCliente.filter((r) => {
    const t = (r.tipo || '').toUpperCase();
    return t !== 'LCGH' && t !== 'LCGA';
  });

  const opLimite = opsMesmoCliente.find((r) => {
    const t = (r.tipo || '').toUpperCase();
    return t === 'LCGH' || t === 'LCGA';
  });

  // A operação principal que dita a coluna é a derivada recém-editada (ou a primeira derivada, ou o limite se só tiver limite)
  const opRepresentante =
    opsDerivadas.find((d) => String(d.id) === String(registroSalvo.id)) ||
    opsDerivadas[0] ||
    registroSalvo;

  const { etapa, cor } = mapearContratacaoParaKanban(opRepresentante);

  const idsDoGrupo = opsMesmoCliente.map((o) => String(o.id));

  // Localiza se já existe um card para qualquer uma das propostas deste cliente
  const idxCard = cardsAtuais.findIndex(
    (c) =>
      (c.propostaIdVinculada &&
        idsDoGrupo.includes(String(c.propostaIdVinculada))) ||
      (c.lcgPropostaIdVinculada &&
        idsDoGrupo.includes(String(c.lcgPropostaIdVinculada))) ||
      c.idsPropostasAgrupadas?.some((idAg) => idsDoGrupo.includes(String(idAg)))
  );

  const cardExistente = idxCard !== -1 ? cardsAtuais[idxCard] : undefined;

  // Monta a lista de operações agrupadas (Item 2: ex. LCGH + Investimento + Renov. Custeio)
  const operacoesAgrupadas: ItemOperacaoClienteKanban[] = opsMesmoCliente.map(
    (op) => ({
      id: op.id,
      tipo: op.tipo || 'Proposta',
      valor: op.valor || '0,00',
      situacao: op.situacao,
      detalheExtra:
        op.tipo === 'LCGH' || op.tipo === 'LCGA'
          ? op.lcgSituacao || op.situacaoDetalhada || op.situacao
          : undefined,
    })
  );

  // Se a operação principal tinha LCG informada diretamente nos campos de garantia sem uma linha separada na tabela, inclui também
  if (
    !opLimite &&
    (opRepresentante.tipoGarantiaKanban === 'LCGH' ||
      opRepresentante.tipoGarantiaKanban === 'LCGA') &&
    (opRepresentante.lcgValor || opRepresentante.lcgSituacao)
  ) {
    operacoesAgrupadas.unshift({
      tipo: opRepresentante.tipoGarantiaKanban,
      valor: opRepresentante.lcgValor || '0,00',
      detalheExtra: opRepresentante.lcgSituacao,
    });
  }

  // Consolida projetistas únicos caso tenha mais de um (ex: "MARCOS / FAGNER")
  const projetistasUnicos = Array.from(
    new Set(
      opsMesmoCliente
        .map((o) => (o.projetista || '').toUpperCase().trim())
        .filter(Boolean)
    )
  ).join(' / ');

  // ITEM 3.1: Monta a Situação abaixo do cabeçalho incluindo automaticamente a situação do Limite (LCGH/LCGA) e da Derivada
  const opsLimitesDoCliente = opsMesmoCliente.filter((r) => {
    const t = (r.tipo || '').toUpperCase();
    return t === 'LCGH' || t === 'LCGA';
  });

  let sitPadraoComLimite = '';
  if (opsLimitesDoCliente.length > 0 && opsDerivadas.length > 0) {
    const linhasAuto: string[] = [];
    opsLimitesDoCliente.forEach((lim) => {
      const detLim = lim.lcgSituacao || lim.situacaoDetalhada || lim.situacao || 'EM ANÁLISE';
      const detLimLimpo = detLim.replace(/^-\s*/, '').replace(new RegExp(`^${lim.tipo}:\\s*`, 'i'), '');
      linhasAuto.push(`- ${lim.tipo.toUpperCase()}: ${detLimLimpo}`);
    });
    opsDerivadas.forEach((der) => {
      const labelDer = der.tipo.toUpperCase().includes('RENOVA') ? 'RENOV. CUSTEIO' : der.tipo.toUpperCase();
      const detDer = der.situacaoDetalhada || der.situacao || 'EM ANÁLISE';
      const detDerLimpo = detDer.replace(/^-\s*/, '');
      linhasAuto.push(
        detDerLimpo.toUpperCase().startsWith(labelDer)
          ? `- ${detDerLimpo}`
          : `- ${labelDer}: ${detDerLimpo}`
      );
    });
    sitPadraoComLimite = linhasAuto.join('\n');
  } else if (
    (opRepresentante.tipoGarantiaKanban === 'LCGH' ||
      opRepresentante.tipoGarantiaKanban === 'LCGA') &&
    opRepresentante.lcgSituacao
  ) {
    const labelDer = opRepresentante.tipo.toUpperCase().includes('RENOVA')
      ? 'RENOV. CUSTEIO'
      : opRepresentante.tipo.toUpperCase();
    const sitDerLimpa = (
      opRepresentante.situacaoDetalhada ||
      opRepresentante.situacao ||
      'EM ANÁLISE'
    ).replace(/^-\s*/, '');
    sitPadraoComLimite = `- ${opRepresentante.tipoGarantiaKanban}: ${opRepresentante.lcgSituacao}\n- ${labelDer}: ${sitDerLimpa}`;
  }

  // ITEM 10: Preserva integralmente o texto que o usuário já escreveu no campo SITUAÇÃO,
  // NUNCA injetando o nome da Situação Rígida ("Na Agência", "Contratado", etc.) por cima do texto!
  let sitDetalhadaFinal =
    cardExistente?.situacaoDetalhadaVinculada ||
    registroSalvo.situacaoDetalhada ||
    opRepresentante.situacaoDetalhada ||
    sitPadraoComLimite ||
    '-';

  if (
    registroSalvo.situacaoDetalhada !== undefined &&
    registroSalvo.situacaoDetalhada.trim() !== ''
  ) {
    sitDetalhadaFinal = registroSalvo.situacaoDetalhada;
  }

  const pendenciasFinal =
    cardExistente?.obsVinculada ||
    (registroSalvo.obs !== undefined && registroSalvo.obs !== ''
      ? registroSalvo.obs
      : opRepresentante.obs || '');

  const analiseFinal =
    cardExistente?.espacoAnaliseVinculado ||
    (registroSalvo.espacoAnalise !== undefined
      ? registroSalvo.espacoAnalise
      : opRepresentante.espacoAnalise || '');

  const { html, textoPuro } = montarHtmlCardSincronizado({
    cliente: opRepresentante.cliente,
    cpf: opRepresentante.cpf,
    porte: opRepresentante.porte,
    projetista: projetistasUnicos || opRepresentante.projetista,
    tipo: opRepresentante.tipo,
    valor: opRepresentante.valor,
    situacaoMacro: opRepresentante.situacao,
    situacaoDetalhada: sitDetalhadaFinal,
    pendenciasObs: pendenciasFinal,
    espacoAnalise: analiseFinal,
    tipoGarantia: opRepresentante.tipoGarantiaKanban,
    avalistaNome: opRepresentante.avalistaNome,
    avalistaCpf: opRepresentante.avalistaCpf,
    operacoesAgrupadas,
  });

  const novosCards = [...cardsAtuais];

  const corFinalPreservada: StatusCorKanban =
    cardExistente?.statusCor === 'roxo'
      ? 'roxo'
      : cardExistente?.statusCor || cor;

  // ITEM 9: Só muda a coluna automaticamente se a situação rígida realmente mudou para Contratado ou se for card novo!
  const etapaFinalPreservada: EtapaKanban =
    opRepresentante.situacao === 'Contratado' &&
    cardExistente?.etapa !== 'ACOMPANHAMENTO'
      ? 'DESEMBOLSOS'
      : cardExistente
      ? cardExistente.etapa
      : etapa;

  const dadosCardUnificado: CardKanban = {
    ...(cardExistente || { id: `wk_sync_${opRepresentante.id}` }),
    etapa: etapaFinalPreservada,
    statusCor: corFinalPreservada,
    texto: html,
    textoPuro,
    dataModificacao: hojeISO,
    propostaIdVinculada: opRepresentante.id,
    lcgPropostaIdVinculada: opLimite?.id,
    idsPropostasAgrupadas: idsDoGrupo,
    clienteVinculado: opRepresentante.cliente,
    cpfVinculado: opRepresentante.cpf,
    porteVinculado: opRepresentante.porte,
    tipoOpVinculado: opsMesmoCliente.map((o) => o.tipo).join(' + '),
    valorVinculado: opRepresentante.valor,
    situacaoVinculada: opRepresentante.situacao,
    situacaoDetalhadaVinculada: sitDetalhadaFinal,
    obsVinculada: pendenciasFinal,
    espacoAnaliseVinculado: analiseFinal,
  };

  if (idxCard !== -1) {
    novosCards[idxCard] = dadosCardUnificado;
  } else {
    novosCards.unshift(dadosCardUnificado);
  }

  const posCardPrincipal = idxCard !== -1 ? idxCard : 0;
  const cardsSemDuplicatasDoCliente = novosCards.filter((c, i) => {
    if (i === posCardPrincipal) return true;
    if (
      c.propostaIdVinculada &&
      idsDoGrupo.includes(String(c.propostaIdVinculada))
    ) {
      return false;
    }
    return true;
  });

  // ITEM 8: Sincronização Completa com Desembolsos!
  // Se a operação derivada já existe em Desembolsos e teve o VALOR (ou Porte/CPF/Projetista) alterado em Contratações,
  // atualiza imediatamente o "Valor Contratado" lá na aba de Desembolsos!
  const novasOperacoesDesemb = [...operacoesDesembAtuais];
  opsDerivadas.forEach((opDeriv) => {
    const idxOpExistente = novasOperacoesDesemb.findIndex(
      (op) =>
        String(op.propostaIdOrigem) === String(opDeriv.id) ||
        (opsDerivadas.length === 1 &&
          op.cliente.toUpperCase().trim() ===
            opDeriv.cliente.toUpperCase().trim())
    );

    if (idxOpExistente !== -1) {
      novasOperacoesDesemb[idxOpExistente] = {
        ...novasOperacoesDesemb[idxOpExistente],
        propostaIdOrigem: opDeriv.id,
        porte: opDeriv.porte,
        cliente: opDeriv.cliente.toUpperCase(),
        cpf: opDeriv.cpf,
        projetista: opDeriv.projetista.toUpperCase(),
        valor: opDeriv.valor, // 👈 Atualiza o Valor Contratado imediatamente!
      };
    } else if (opDeriv.situacao === 'Contratado') {
      novasOperacoesDesemb.push({
        id: `op_${opDeriv.id}`,
        propostaIdOrigem: opDeriv.id,
        porte: opDeriv.porte,
        cliente: opDeriv.cliente.toUpperCase(),
        cpf: opDeriv.cpf,
        projetista: opDeriv.projetista.toUpperCase(),
        op: `PENDENTE-OP (${opDeriv.tipo})`,
        valor: opDeriv.valor,
      });
    }
  });

  return {
    novosCards: cardsSemDuplicatasDoCliente,
    novasOperacoesDesemb,
  };
}

export function sincronizarAposEventoDesembolso(params: {
  eventoSalvo: EventoDesembolso;
  operacaoBase?: OperacaoBaseDesembolso;
  cardsAtuais: CardKanban[];
}): CardKanban[] {
  const { eventoSalvo, operacaoBase, cardsAtuais } = params;
  const hojeISO = getHojeISO();

  const etapaAlvo: EtapaKanban =
    eventoSalvo.situacao === 'Finalizado' ||
    eventoSalvo.situacao === 'Desembolso Efetivado'
      ? 'ACOMPANHAMENTO'
      : 'DESEMBOLSOS';

  const corAlvo: StatusCorKanban =
    eventoSalvo.situacao === 'Desembolso Pendente' ||
    eventoSalvo.situacao === 'Não Desembolsar'
      ? 'vermelho'
      : eventoSalvo.situacao === 'Desembolso Efetivado' ||
        eventoSalvo.situacao === 'Finalizado'
      ? 'verde'
      : 'azul';

  const idxCard = cardsAtuais.findIndex(
    (c) =>
      (operacaoBase?.propostaIdOrigem &&
        String(c.propostaIdVinculada) ===
          String(operacaoBase.propostaIdOrigem)) ||
      c.opDesembolsoVinculada === eventoSalvo.op ||
      (c.clienteVinculado &&
        c.clienteVinculado.toUpperCase() === eventoSalvo.cliente.toUpperCase())
  );

  const cardExistente = idxCard !== -1 ? cardsAtuais[idxCard] : undefined;

  const { html, textoPuro } = montarHtmlCardSincronizado({
    cliente: eventoSalvo.cliente,
    cpf: operacaoBase?.cpf || cardExistente?.cpfVinculado || '',
    porte: operacaoBase?.porte || cardExistente?.porteVinculado || '',
    projetista: operacaoBase?.projetista || '',
    tipo: 'DESEMBOLSO',
    valor: eventoSalvo.valor,
    situacaoMacro: eventoSalvo.situacao,
    situacaoDetalhada: `- ${eventoSalvo.situacao} (Data: ${eventoSalvo.data})`,
    pendenciasObs: eventoSalvo.obs,
    espacoAnalise: cardExistente?.espacoAnaliseVinculado,
    opNum: eventoSalvo.op,
    parcela: eventoSalvo.parcela,
  });

  const novosCards = [...cardsAtuais];

  if (idxCard !== -1) {
    novosCards[idxCard] = {
      ...novosCards[idxCard],
      etapa: etapaAlvo,
      statusCor: corAlvo,
      texto: html,
      textoPuro,
      dataModificacao: hojeISO,
      opDesembolsoVinculada: eventoSalvo.op,
      situacaoVinculada: eventoSalvo.situacao,
      situacaoDetalhadaVinculada: `- ${eventoSalvo.situacao}`,
      obsVinculada: eventoSalvo.obs,
      valorVinculado: eventoSalvo.valor,
    };
  } else {
    novosCards.unshift({
      id: `wk_desemb_${Date.now()}`,
      etapa: etapaAlvo,
      statusCor: corAlvo,
      texto: html,
      textoPuro,
      dataModificacao: hojeISO,
      propostaIdVinculada: operacaoBase?.propostaIdOrigem,
      opDesembolsoVinculada: eventoSalvo.op,
      clienteVinculado: eventoSalvo.cliente,
      cpfVinculado: operacaoBase?.cpf,
      porteVinculado: operacaoBase?.porte,
      valorVinculado: eventoSalvo.valor,
      situacaoVinculada: eventoSalvo.situacao,
      situacaoDetalhadaVinculada: `- ${eventoSalvo.situacao}`,
      obsVinculada: eventoSalvo.obs,
    });
  }

  return novosCards;
}

export function gerarCardsKanbanDaBaseExistente(params: {
  contratacoes: RegistroContratacao[];
  cardsAtuais: CardKanban[];
}): { novosCards: CardKanban[]; qtdCriados: number; qtdAtualizados: number } {
  const { contratacoes, cardsAtuais } = params;
  let lista = [...cardsAtuais];
  let qtdCriados = 0;
  let qtdAtualizados = 0;

  const chavesClientesProcessados = new Set<string>();

  contratacoes.forEach((reg) => {
    const chaveCliente =
      reg.cpf && reg.cpf.replace(/\D/g, '') !== ''
        ? reg.cpf.replace(/\D/g, '')
        : reg.cliente.toUpperCase().trim();

    if (chavesClientesProcessados.has(chaveCliente)) return;
    chavesClientesProcessados.add(chaveCliente);

    const jaTem = Boolean(localizarCardDoClienteNoKanban(reg, lista));
    const res = sincronizarAposSalvarContratacao({
      registroSalvo: reg,
      todasContratacoes: contratacoes,
      cardsAtuais: lista,
      operacoesDesembAtuais: [],
    });
    lista = res.novosCards;
    if (jaTem) qtdAtualizados++;
    else qtdCriados++;
  });

  return { novosCards: lista, qtdCriados, qtdAtualizados };
}

export function propagarEdicaoKanbanParaBases(params: {
  cardEditado: CardKanban;
  contratacoesAtuais: RegistroContratacao[];
  operacoesDesembAtuais: OperacaoBaseDesembolso[];
}): {
  contratacoesAtualizadas: RegistroContratacao[];
  operacoesDesembAtualizadas: OperacaoBaseDesembolso[];
  cardFormatado: CardKanban;
} {
  const { cardEditado, contratacoesAtuais, operacoesDesembAtuais } = params;
  const novasContratacoes = [...contratacoesAtuais];
  let novasOpsDesemb = [...operacoesDesembAtuais];

  if (!cardEditado.propostaIdVinculada) {
    return {
      contratacoesAtualizadas: novasContratacoes,
      operacoesDesembAtualizadas: novasOpsDesemb,
      cardFormatado: cardEditado,
    };
  }

  const idxContrat = novasContratacoes.findIndex(
    (r) => String(r.id) === String(cardEditado.propostaIdVinculada)
  );

  if (idxContrat === -1) {
    return {
      contratacoesAtualizadas: novasContratacoes,
      operacoesDesembAtualizadas: novasOpsDesemb,
      cardFormatado: cardEditado,
    };
  }

  const regAtual = novasContratacoes[idxContrat];
  const novaSituacao =
    cardEditado.situacaoVinculada ||
    mapearEtapaKanbanParaSituacaoContratacao(
      cardEditado.etapa,
      cardEditado.statusCor,
      regAtual.situacao
    );

  const novoValor = cardEditado.valorVinculado || regAtual.valor;
  const novaSitDetalhada =
    cardEditado.situacaoDetalhadaVinculada !== undefined
      ? cardEditado.situacaoDetalhadaVinculada
      : regAtual.situacaoDetalhada;
  const novaObs =
    cardEditado.obsVinculada !== undefined
      ? cardEditado.obsVinculada
      : regAtual.obs;
  const novaAnalise =
    cardEditado.espacoAnaliseVinculado !== undefined
      ? cardEditado.espacoAnaliseVinculado
      : regAtual.espacoAnalise;

  const regAtualizado: RegistroContratacao = {
    ...regAtual,
    situacao: novaSituacao,
    situacaoDetalhada: novaSitDetalhada,
    valor: novoValor,
    obs: novaObs,
    espacoAnalise: novaAnalise,
    data: getHojeBR(),
  };

  novasContratacoes[idxContrat] = regAtualizado;

  const resSync = sincronizarAposSalvarContratacao({
    registroSalvo: regAtualizado,
    todasContratacoes: novasContratacoes,
    cardsAtuais: [cardEditado],
    operacoesDesembAtuais: novasOpsDesemb,
  });

  novasOpsDesemb = resSync.novasOperacoesDesemb;
  const cardReformatado = resSync.novosCards[0] || cardEditado;

  return {
    contratacoesAtualizadas: novasContratacoes,
    operacoesDesembAtualizadas: novasOpsDesemb,
    cardFormatado: {
      ...cardReformatado,
      etapa: cardEditado.etapa,
      // ITEM 5: Garante que se o card estava roxo (Arquivado), continua roxo mesmo após editar texto ou mudar de coluna!
      statusCor:
        cardEditado.statusCor === 'roxo' ? 'roxo' : cardReformatado.statusCor,
    },
  };
}

// ============================================================================
// 7. ITEM 4: GERADOR DE RELATÓRIO EXECUTIVO DO KANBAN EM PDF (DESIGN BNB)
// Separa por Etapa, organiza por Porte e ordena por Prioridades (Oculta Espaço Análise!)
// ============================================================================
export interface OpcoesFiltroExportacaoPDF {
  etapas: EtapaKanban[];
  portes: string[]; // ['MINI', 'PRONAF V', 'PRONAF A']
  prioridades: StatusCorKanban[]; // ['azul', 'vermelho', 'amarelo', 'verde', 'roxo']
  incluirArquivados: boolean;
  filtroTipoOperacao:
    | 'TODOS'
    | 'SOMENTE_DERIVADAS_GERAL'
    | 'SOMENTE_DERIVADAS_SEM_LIMITE'
    | 'SOMENTE_LIMITES_GERAL'
    | 'SOMENTE_LCGH'
    | 'SOMENTE_LCGA';
  projetistas: string[];
  layoutSaida: 'QUADRINHOS' | 'LISTAGEM' | 'DIDATICA_ROBUSTA';
}

// Extrai o maior valor das operações derivadas do card e o maior valor de limite (LCGH/LCGA)
function extrairValoresFinanceirosDoCard(card: CardKanban): {
  maiorDerivada: number;
  maiorLimite: number;
  temDerivada: boolean;
  temLCGH: boolean;
  temLCGA: boolean;
  resumoOperacoes: string[];
} {
  const puro = (card.textoPuro || card.texto || '').toUpperCase();
  const linhas = puro.split('\n').map((l) => l.trim());

  let maiorDerivada = 0;
  let maiorLimite = 0;
  let temDerivada = false;
  let temLCGH = false;
  let temLCGA = false;
  const resumoOperacoes: string[] = [];

  const parseValorLinha = (str: string): number => {
    const m = str.match(/R\$\s*([\d.]+,\d{2})/);
    if (!m || !m[1]) return 0;
    return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0;
  };

  linhas.forEach((l) => {
    if (l.startsWith('LCGH:')) {
      temLCGH = true;
      const v = parseValorLinha(l);
      if (v > maiorLimite) maiorLimite = v;
      resumoOperacoes.push(l);
    } else if (l.startsWith('LCGA:')) {
      temLCGA = true;
      const v = parseValorLinha(l);
      if (v > maiorLimite) maiorLimite = v;
      resumoOperacoes.push(l);
    } else if (
      l.startsWith('INVESTIMENTO:') ||
      l.startsWith('CUSTEIO:') ||
      l.startsWith('RENOV. CUSTEIO:') ||
      l.startsWith('RENOVAÇÃO') ||
      l.startsWith('CARTÃO BNB:') ||
      l.startsWith('DESEMBOLSO:')
    ) {
      temDerivada = true;
      const v = parseValorLinha(l);
      if (v > maiorDerivada) maiorDerivada = v;
      resumoOperacoes.push(l);
    }
  });

  // Fallback caso seja um card simples com valorVinculado
  if (!temDerivada && !temLCGH && !temLCGA && card.valorVinculado) {
    const vFallback =
      parseFloat(
        String(card.valorVinculado).replace(/\./g, '').replace(',', '.')
      ) || 0;
    const tUpper = (card.tipoOpVinculado || '').toUpperCase();
    if (tUpper.includes('LCGH')) {
      temLCGH = true;
      maiorLimite = vFallback;
    } else if (tUpper.includes('LCGA')) {
      temLCGA = true;
      maiorLimite = vFallback;
    } else {
      temDerivada = true;
      maiorDerivada = vFallback;
    }
  }

  return {
    maiorDerivada,
    maiorLimite,
    temDerivada,
    temLCGH,
    temLCGA,
    resumoOperacoes,
  };
}

export function exportarKanbanParaPDFExecutivo(
  cards: CardKanban[],
  opcoes?: OpcoesFiltroExportacaoPDF
) {
  if (typeof window === 'undefined') return;

  const todasEtapas: Array<{ id: EtapaKanban; nome: string; cor: string }> = [
    { id: 'CADASTROS', nome: '1. CADASTROS', cor: '#607d8b' },
    { id: 'PCE', nome: '2. PCE (SOLICITAÇÕES / AGÊNCIA)', cor: '#e65100' },
    { id: 'S522', nome: '3. S522 / CENTRAL DE CRÉDITO', cor: '#1a73e8' },
    { id: 'CONTRATOS', nome: '4. CONTRATOS / RENOVAÇÕES', cor: '#9c27b0' },
    { id: 'DESEMBOLSOS', nome: '5. DESEMBOLSOS RURAIS', cor: '#7a1231' },
    { id: 'ACOMPANHAMENTO', nome: '6. ACOMPANHAMENTO FINAL', cor: '#137333' },
  ];

  // ITEM 6: Ordem exata de Prioridades solicitada:
  // 1º Em Análise (azul), 2º Prioritário (vermelho), 3º Pendente Geral (amarelo), 4º Concluído (verde), 5º Arquivados (roxo)
  const pesoPrioridade: Record<string, number> = {
    azul: 5,
    vermelho: 4,
    amarelo: 3,
    verde: 2,
    roxo: 1,
  };

  const labelPrioridade: Record<
    string,
    { texto: string; bg: string; cor: string; borda: string }
  > = {
    azul: { texto: 'EM ANÁLISE', bg: '#e8f0fe', cor: '#1967d2', borda: '#1a73e8' },
    vermelho: { texto: 'PRIORITÁRIO', bg: '#fce8e6', cor: '#c5221f', borda: '#d93025' },
    amarelo: { texto: 'PENDENTE GERAL', bg: '#fef7e0', cor: '#b06000', borda: '#f29900' },
    verde: { texto: 'CONCLUÍDO', bg: '#e6f4ea', cor: '#137333', borda: '#137333' },
    roxo: { texto: 'ARQUIVADO', bg: '#f3e8ff', cor: '#6b21a8', borda: '#7e22ce' },
  };

  // ITEM 6: Ordem exata dos Portes solicitada: MINI -> PRONAF V -> PRONAF A
  const ordemPortes = ['MINI', 'PRONAF V', 'PRONAF A', 'GERAL / OUTROS'];

  const identificarPorteDoCard = (c: CardKanban): string => {
    if (c.porteVinculado) {
      const pv = c.porteVinculado.toUpperCase().trim();
      if (pv === 'PRONAF') return 'PRONAF V';
      if (ordemPortes.includes(pv)) return pv;
    }
    const puro = (c.textoPuro || c.texto || '').toUpperCase();
    if (puro.includes('PRONAF A')) return 'PRONAF A';
    if (puro.includes('PRONAF')) return 'PRONAF V';
    if (puro.includes('MINI')) return 'MINI';
    return 'GERAL / OUTROS';
  };

  const extrairProjetistaDoCard = (c: CardKanban): string => {
    const puro = c.textoPuro || c.texto || '';
    const m = puro.match(/PROJETISTA:\s*([^\n<]+)/i);
    return m && m[1] ? m[1].trim().toUpperCase() : '-';
  };

  const limparHtmlSemAnalise = (htmlBruto: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = htmlBruto;
    temp
      .querySelectorAll('.card-titulo-analise, .bloco-editavel-analise')
      .forEach((el) => el.remove());
    return temp.innerHTML.replace(
      /(?:🔍\s*)?ESPAÇO PARA ANÁLISE[\s\S]*$/i,
      ''
    );
  };

  // Aplica todos os filtros escolhidos no Modal de Exportação PDF
  const cardsFiltrados = cards.filter((c) => {
    if (c.etapa === 'NOTAS') return false;

    // Regra de Arquivados: só entra se incluirArquivados for true OU se 'roxo' foi marcado explicitamente
    const isArq = c.statusCor === 'roxo';
    if (isArq && !opcoes?.incluirArquivados) return false;

    if (opcoes) {
      if (opcoes.etapas.length > 0 && !opcoes.etapas.includes(c.etapa)) {
        return false;
      }
      const porteCard = identificarPorteDoCard(c);
      if (opcoes.portes.length > 0 && !opcoes.portes.includes(porteCard)) {
        return false;
      }
      if (
        opcoes.prioridades.length > 0 &&
        !opcoes.prioridades.includes(c.statusCor)
      ) {
        return false;
      }
      if (opcoes.projetistas.length > 0) {
        const projCard = extrairProjetistaDoCard(c);
        const matchProj = opcoes.projetistas.some((p) =>
          projCard.includes(p.toUpperCase())
        );
        if (!matchProj) return false;
      }

      // Filtro de Tipo de Operação (Derivadas vs LCGH/LCGA)
      if (opcoes.filtroTipoOperacao !== 'TODOS') {
        const fin = extrairValoresFinanceirosDoCard(c);
        const temAlgumLimite = fin.temLCGH || fin.temLCGA;
        switch (opcoes.filtroTipoOperacao) {
          case 'SOMENTE_DERIVADAS_GERAL':
            if (!fin.temDerivada) return false;
            break;
          case 'SOMENTE_DERIVADAS_SEM_LIMITE':
            if (!fin.temDerivada || temAlgumLimite) return false;
            break;
          case 'SOMENTE_LIMITES_GERAL':
            if (!temAlgumLimite) return false;
            break;
          case 'SOMENTE_LCGH':
            if (!fin.temLCGH) return false;
            break;
          case 'SOMENTE_LCGA':
            if (!fin.temLCGA) return false;
            break;
        }
      }
    }

    return true;
  });

  const layoutEscolhido = opcoes?.layoutSaida || 'QUADRINHOS';
  const dataHoraEmissao = new Date().toLocaleString('pt-BR');
  let conteudoEtapasHtml = '';
  let totalCardsRelatorio = 0;

  todasEtapas.forEach((et) => {
    const cardsEtapa = cardsFiltrados.filter((c) => c.etapa === et.id);
    if (cardsEtapa.length === 0) return;

    totalCardsRelatorio += cardsEtapa.length;
    let blocosPorteHtml = '';

    ordemPortes.forEach((porteAlvo) => {
      const cardsDoPorte = cardsEtapa
        .filter((c) => identificarPorteDoCard(c) === porteAlvo)
        .sort((a, b) => {
          // 1º Critério dentro do Porte: Prioridade (Em Análise > Prioritário > Pendente > Concluído > Arquivado)
          const pA = pesoPrioridade[a.statusCor] || 0;
          const pB = pesoPrioridade[b.statusCor] || 0;
          if (pA !== pB) return pB - pA;

          // 2º Critério (ITEM 6): Maior valor nas operações derivadas; na ausência de derivadas, maior valor nos limites
          const finA = extrairValoresFinanceirosDoCard(a);
          const finB = extrairValoresFinanceirosDoCard(b);

          if (finA.maiorDerivada !== finB.maiorDerivada) {
            return finB.maiorDerivada - finA.maiorDerivada;
          }
          return finB.maiorLimite - finA.maiorLimite;
        });

      if (cardsDoPorte.length === 0) return;

      let conteudoCardsPorteHtml = '';

      if (layoutEscolhido === 'QUADRINHOS') {
        const itemsHtml = cardsDoPorte
          .map((c) => {
            const prio = labelPrioridade[c.statusCor] || labelPrioridade.amarelo;
            const htmlLimpo = limparHtmlSemAnalise(c.texto);
            const dtMod = c.dataModificacao
              ? c.dataModificacao.split('-').reverse().join('/')
              : '-';

            return `
              <div class="pdf-card" style="border-left: 5px solid ${prio.borda};">
                <div class="pdf-card-top">
                  <span class="pdf-badge" style="background:${prio.bg}; color:${prio.cor}; border:1px solid ${prio.borda};">
                    ${prio.texto}
                  </span>
                  <span class="pdf-date">Atualizado: ${dtMod}</span>
                </div>
                <div class="pdf-card-body">${htmlLimpo}</div>
              </div>
            `;
          })
          .join('');

        conteudoCardsPorteHtml = `<div class="pdf-cards-grid">${itemsHtml}</div>`;
      } else if (layoutEscolhido === 'LISTAGEM') {
        const linhasTabela = cardsDoPorte
          .map((c) => {
            const prio = labelPrioridade[c.statusCor] || labelPrioridade.amarelo;
            const fin = extrairValoresFinanceirosDoCard(c);
            const extraidos = extrairCamposLivresDoTextoKanban(
              c.textoPuro || c.texto || ''
            );
            const proj = extrairProjetistaDoCard(c);
            const clienteTxt = c.clienteVinculado || 'CLIENTE';
            const cpfTxt = c.cpfVinculado || '-';
            const opsTxt =
              fin.resumoOperacoes.length > 0
                ? fin.resumoOperacoes.join('<br/>')
                : `${c.tipoOpVinculado || '-'} (R$ ${c.valorVinculado || '0,00'})`;
            const sitTxt = (
              extraidos.situacaoDetalhada ||
              c.situacaoDetalhadaVinculada ||
              c.situacaoVinculada ||
              '-'
            ).replace(/\n/g, '<br/>');
            const pendTxt = (
              extraidos.pendenciasObs ||
              c.obsVinculada ||
              '-'
            ).replace(/\n/g, '<br/>');

            return `
              <tr>
                <td style="border-left: 4px solid ${prio.borda}; text-align:center;">
                  <span class="pdf-badge" style="background:${prio.bg}; color:${prio.cor}; border:1px solid ${prio.borda};">${prio.texto}</span>
                </td>
                <td><strong>${clienteTxt}</strong><br/><span style="color:#64748b; font-size:9.5px;">CPF: ${cpfTxt} • Proj: ${proj}</span></td>
                <td style="font-weight:bold; color:#1e293b;">${opsTxt}</td>
                <td>${sitTxt}</td>
                <td style="color:#9a3412;">${pendTxt}</td>
              </tr>
            `;
          })
          .join('');

        conteudoCardsPorteHtml = `
          <table class="pdf-table-list">
            <thead>
              <tr>
                <th style="width:95px;">PRIORIDADE</th>
                <th style="width:210px;">CLIENTE / CPF / PROJETISTA</th>
                <th style="width:175px;">OPERAÇÕES E VALORES</th>
                <th>📊 SITUAÇÃO ATUAL</th>
                <th>📝 PENDÊNCIAS / OBS</th>
              </tr>
            </thead>
            <tbody>${linhasTabela}</tbody>
          </table>
        `;
      } else {
        // LAYOUT 3: DIDÁTICA ROBUSTA (Dossiê Horizontal Completo em 3 Colunas Internas)
        const blocosRobustos = cardsDoPorte
          .map((c) => {
            const prio = labelPrioridade[c.statusCor] || labelPrioridade.amarelo;
            const fin = extrairValoresFinanceirosDoCard(c);
            const extraidos = extrairCamposLivresDoTextoKanban(
              c.textoPuro || c.texto || ''
            );
            const proj = extrairProjetistaDoCard(c);
            const clienteTxt = c.clienteVinculado || 'CLIENTE';
            const cpfTxt = c.cpfVinculado || '-';
            const dtMod = c.dataModificacao
              ? c.dataModificacao.split('-').reverse().join('/')
              : '-';

            const opsHtml =
              fin.resumoOperacoes.length > 0
                ? fin.resumoOperacoes
                    .map((op) => `<div class="rob-op-pill">${op}</div>`)
                    .join('')
                : `<div class="rob-op-pill">${c.tipoOpVinculado || 'Proposta'}: R$ ${
                    c.valorVinculado || '0,00'
                  }</div>`;

            const sitTxt = (
              extraidos.situacaoDetalhada ||
              c.situacaoDetalhadaVinculada ||
              c.situacaoVinculada ||
              '-'
            ).replace(/\n/g, '<br/>');
            const pendTxt = (
              extraidos.pendenciasObs ||
              c.obsVinculada ||
              'Sem pendências registradas.'
            ).replace(/\n/g, '<br/>');

            return `
              <div class="pdf-robusto-card" style="border-left: 6px solid ${prio.borda};">
                <div class="pdf-robusto-header">
                  <div>
                    <strong style="font-size:12.5px; color:#8B1530;">👤 ${clienteTxt}</strong>
                    <span style="margin-left:8px; color:#475569; font-weight:600;">CPF: ${cpfTxt}</span>
                    <span style="margin-left:8px; color:#475569;">• <strong>Porte:</strong> ${porteAlvo}</span>
                    <span style="margin-left:8px; color:#475569;">• <strong>Projetista:</strong> ${proj}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="pdf-date">Atualizado: ${dtMod}</span>
                    <span class="pdf-badge" style="background:${prio.bg}; color:${prio.cor}; border:1px solid ${prio.borda};">
                      ${prio.texto}
                    </span>
                  </div>
                </div>
                <div class="pdf-robusto-body">
                  <div class="rob-col-ops">
                    <div class="rob-label">💰 OPERAÇÕES VINCULADAS</div>
                    ${opsHtml}
                  </div>
                  <div class="rob-col-sit">
                    <div class="rob-label" style="color:#8B1530;">📊 SITUAÇÃO DO PROCESSO</div>
                    <div>${sitTxt}</div>
                  </div>
                  <div class="rob-col-pend">
                    <div class="rob-label" style="color:#e65100;">📝 PENDÊNCIAS / OBSERVAÇÕES</div>
                    <div>${pendTxt}</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join('');

        conteudoCardsPorteHtml = `<div class="pdf-robusto-list">${blocosRobustos}</div>`;
      }

      blocosPorteHtml += `
        <div class="pdf-porte-section">
          <div class="pdf-porte-title">📑 PORTE: ${porteAlvo} (${cardsDoPorte.length} dossiê${
        cardsDoPorte.length > 1 ? 's' : ''
      })</div>
          ${conteudoCardsPorteHtml}
        </div>
      `;
    });

    conteudoEtapasHtml += `
      <section class="pdf-etapa-box">
        <div class="pdf-etapa-header" style="background:${et.cor};">
          <span>${et.nome}</span>
          <span>${cardsEtapa.length} cliente(s) na etapa</span>
        </div>
        ${blocosPorteHtml}
      </section>
    `;
  });

  const janelaPdf = window.open('', '_blank');
  if (!janelaPdf) {
    alert('Permita pop-ups no navegador para gerar o PDF Executivo.');
    return;
  }

  const orientacaoPagina =
    layoutEscolhido === 'LISTAGEM' ? 'A4 landscape' : 'A4 portrait';

  janelaPdf.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Relatório Gerencial Kanban - BNB</title>
      <style>
        @page { size: ${orientacaoPagina}; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #1e293b;
          background: #fff;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.45;
        }
        .report-header {
          border-bottom: 3px solid #8B1530;
          padding-bottom: 10px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .report-title {
          color: #8B1530;
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
        }
        .report-subtitle {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
          font-weight: 600;
        }
        .report-meta {
          text-align: right;
          font-size: 10px;
          color: #475569;
        }
        .pdf-etapa-box { margin-bottom: 20px; }
        .pdf-etapa-header {
          color: #fff;
          padding: 8px 12px;
          border-radius: 5px;
          font-size: 13px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          page-break-after: avoid;
        }
        .pdf-porte-section { margin-bottom: 14px; }
        .pdf-porte-title {
          font-size: 11px;
          font-weight: 800;
          color: #8B1530;
          background: #f8ecee;
          border-left: 4px solid #F68B1F;
          padding: 5px 10px;
          margin-bottom: 8px;
          border-radius: 0 4px 4px 0;
          page-break-after: avoid;
        }
        /* Layout 1: Quadrinhos */
        .pdf-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .pdf-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 10px;
          background: #ffffff;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px dashed #e2e8f0;
          padding-bottom: 5px;
          margin-bottom: 6px;
        }
        .pdf-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 10px;
          display: inline-block;
        }
        .pdf-date { font-size: 9px; color: #64748b; font-weight: 600; }
        .pdf-card-body .card-bloco-cliente {
          background: #f8fafc;
          padding: 6px 8px;
          border-radius: 4px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 6px;
        }
        .pdf-card-body .card-titulo-situacao { font-weight: bold; color: #8B1530; margin-top: 6px; margin-bottom: 2px; }
        .pdf-card-body .card-titulo-pendencias { font-weight: bold; color: #e65100; margin-top: 6px; margin-bottom: 2px; }

        /* Layout 2: Listagem Compacta em Tabela */
        .pdf-table-list {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
        }
        .pdf-table-list th {
          background: #8B1530;
          color: #fff;
          padding: 6px 8px;
          text-align: left;
          border: 1px solid #cbd5e1;
        }
        .pdf-table-list td {
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
          vertical-align: top;
        }
        .pdf-table-list tr { page-break-inside: avoid; break-inside: avoid; }

        /* Layout 3: Listagem Didática Robusta */
        .pdf-robusto-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pdf-robusto-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-robusto-header {
          background: #f8fafc;
          padding: 7px 12px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pdf-robusto-body {
          display: grid;
          grid-template-columns: 1.1fr 1.3fr 1.3fr;
          gap: 12px;
          padding: 10px 12px;
        }
        .rob-label {
          font-size: 9.5px;
          font-weight: 800;
          color: #475569;
          margin-bottom: 4px;
          text-transform: uppercase;
          border-bottom: 1px dashed #e2e8f0;
          padding-bottom: 2px;
        }
        .rob-op-pill {
          background: #f1f5f9;
          padding: 3px 7px;
          border-radius: 4px;
          font-weight: 700;
          margin-bottom: 4px;
          font-size: 10.5px;
        }
        .no-print-bar {
          background: #8B1530;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-radius: 6px;
        }
        .btn-print {
          background: #F68B1F;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          font-size: 12px;
        }
        @media print { .no-print-bar { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <span><strong>📄 PRÉ-VISUALIZAÇÃO DO PDF (${layoutEscolhido})</strong> — ${totalCardsRelatorio} cliente(s) listado(s)</span>
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
      </div>

      <header class="report-header">
        <div>
          <h1 class="report-title">Relatório Gerencial do Quadro de Tarefas (Kanban)</h1>
          <div class="report-subtitle">Ordenado por Etapa ➔ Porte (MINI, PRONAF V, PRONAF A) ➔ Prioridade ➔ Maior Valor</div>
        </div>
        <div class="report-meta">
          <div><strong>Emissão:</strong> ${dataHoraEmissao}</div>
          <div><strong>Total de Dossiês Filtrados:</strong> ${totalCardsRelatorio}</div>
        </div>
      </header>

      ${conteudoEtapasHtml || '<p style="text-align:center; padding:30px; color:#64748b;">Nenhum card corresponde aos filtros selecionados para exportação.</p>'}

      <script>
        setTimeout(() => { window.print(); }, 400);
      </script>
    </body>
    </html>
  `);
  janelaPdf.document.close();
}