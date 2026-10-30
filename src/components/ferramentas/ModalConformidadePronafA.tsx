'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  salvarFerramentasSync,
  carregarFerramentasSync,
} from '@/lib/firebaseSync';
import {
  RegistroContratacao,
  CardKanban,
  EtapaKanban,
} from '@/types/painel';
import {
  aplicarMascaraCPF,
  aplicarMascaraMoedaInput,
  aplicarMascaraDataBR,
  getHojeBR,
  getHojeISO,
  LISTA_PROJETISTAS_CURTOS,
  obterListaProgramas,
  isEnquadradoCadaVezMelhor,
} from '@/lib/utils';
import { montarHtmlCardSincronizado } from '@/lib/integradorSincronizado';

export type StatusVisitado = 'SIM' | 'NAO' | 'PENDENTE';
export type StatusCadastroPessoa = 'OK' | 'A_RENOVAR' | 'A_ELABORAR';
export type StatusCadastroOpcional = 'NAO_SE_APLICA' | 'OK' | 'A_RENOVAR' | 'A_ELABORAR';
export type NivelRestricaoCI = 'SEM_RESTRICAO' | 'LEVE' | 'GRAVE';

export interface ItemConformidadePronafA {
  id: string;
  nomeCliente: string;
  cpfCliente: string;
  visitado: StatusVisitado;
  cadastroClienteOk: StatusCadastroPessoa;
  dataRefCadastral: string;
  restricaoClienteNivel: NivelRestricaoCI;
  restricaoClienteDetalhe: string;
  contaCorrente: string;
  conjugeNome: string;
  conjugeCpf: string;
  cadastroConjugeOk: StatusCadastroOpcional;
  restricaoConjugeNivel: NivelRestricaoCI;
  restricaoConjugeDetalhe: string;
  procuradorNome: string;
  procuradorCpf: string;
  cadastroProcuradorOk: StatusCadastroOpcional;
  restricaoProcuradorNivel: NivelRestricaoCI;
  restricaoProcuradorDetalhe: string;
}

export interface ListaSalvaConformidadePronafA {
  id: string;
  nomeLista: string;
  dataCriacao: string;
  dataAtualizacao: string;
  itens: ItemConformidadePronafA[];
}

export interface ResultadoClassificacaoPronafA {
  item: ItemConformidadePronafA;
  grupoNumero: 1 | 2 | 3 | 4;
  grupoTitulo: string;
  subgrupoOrdem: number;
  subgrupoDescricao: string;
  scoreDesempate: number;
  resumoPendencias: string[];
  resumoPontosOk: string[];
  jaCadastradoNoPainel: boolean;
}

interface ModalConformidadePronafAProps {
  aberto: boolean;
  onFechar: () => void;
  contratacoes: RegistroContratacao[];
  cardsKanban: CardKanban[];
  onCadastrarPropostaNoPainel: (
    novaContratacao: RegistroContratacao,
    novoCardKanban: CardKanban
  ) => void;
}

export const STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A =
  'bnb_v2_listas_conformidade_pronaf_a';
const STORAGE_KEY_LEGADO_CONFORMIDADE = 'bnb_v2_conformidade_pronaf_a';

// Cabeçalhos exatos das 14 colunas oficiais da planilha de conferência
const CABECALHOS_EXCEL_14_COLUNAS = [
  '1. Nome do cliente',
  '2. CPF do cliente',
  '3. Visitado?',
  '4. Cadastro do cliente OK?',
  '5. Data (ref.) da situação Cadastral',
  '6. Restrição CI?',
  '7. C/C aberta? (nº)',
  '8. Cônjuge / Comp.',
  '9. CPF do Cônjuge / Comp.',
  '10. Cadastro do cônjuge/companheiro(a) OK?',
  '11. Restrição do cônjuge/companheiro(a) CI?',
  '12. Nome do procurador',
  '13. CPF do procurador',
  '14. Cadastro do procurador OK?',
];

function detectarNivelRestricaoPorTexto(texto: string): NivelRestricaoCI {
  const up = (texto || '').toUpperCase().trim();
  if (
    !up ||
    up === 'NÃO' ||
    up === 'NAO' ||
    up === 'NADA CONSTA' ||
    up === 'SEM RESTRIÇÃO' ||
    up === 'SEM RESTRICAO' ||
    up === 'OK' ||
    up === '-'
  ) {
    return 'SEM_RESTRICAO';
  }
  if (
    up.includes('REFIN') ||
    up.includes('BANCO') ||
    up.includes('BRADESCO') ||
    up.includes('BRASIL') ||
    up.includes('CAIXA') ||
    up.includes('ITAU') ||
    up.includes('ITAÚ') ||
    up.includes('SANTANDER') ||
    up.includes('SICOOB') ||
    up.includes('SICREDI') ||
    up.includes('BNB') ||
    up.includes('BACEN') ||
    up.includes('SCR') ||
    up.includes('PREJUIZO') ||
    up.includes('PREJUÍZO') ||
    up.includes('GRAVE')
  ) {
    return 'GRAVE';
  }
  return 'LEVE';
}

function interpretarVisitadoExcel(val: string): StatusVisitado {
  const up = (val || '').toUpperCase().trim();
  if (up.startsWith('N')) return 'NAO';
  if (up.startsWith('P')) return 'PENDENTE';
  return 'SIM';
}

function interpretarStatusCadastroTitularExcel(val: string): StatusCadastroPessoa {
  const up = (val || '').toUpperCase().trim();
  if (up.includes('RENOV') || up.includes('VENCID') || up.includes('ATUALIZAR')) {
    return 'A_RENOVAR';
  }
  if (
    up.includes('ELAB') ||
    up.includes('FAZER') ||
    up.includes('SEM CAD') ||
    up === 'NÃO' ||
    up === 'NAO'
  ) {
    return 'A_ELABORAR';
  }
  return 'OK';
}

function interpretarStatusCadastroOpcionalExcel(
  val: string,
  temNomeVinculado: boolean
): StatusCadastroOpcional {
  if (!temNomeVinculado) return 'NAO_SE_APLICA';
  const up = (val || '').toUpperCase().trim();
  if (!up || up.includes('NÃO SE APLICA') || up === '-') return 'OK';
  if (up.includes('RENOV') || up.includes('VENCID') || up.includes('ATUALIZAR')) {
    return 'A_RENOVAR';
  }
  if (
    up.includes('ELAB') ||
    up.includes('FAZER') ||
    up.includes('SEM CAD') ||
    up === 'NÃO' ||
    up === 'NAO'
  ) {
    return 'A_ELABORAR';
  }
  return 'OK';
}

function calcularSubgrupoGrupos1e2(
  temConjuge: boolean,
  temProcurador: boolean,
  restConjuge: NivelRestricaoCI,
  restProcurador: NivelRestricaoCI
): { ordem: number; desc: string } {
  const conjLeve = restConjuge === 'LEVE';
  const procLeve = restProcurador === 'LEVE';

  if (!temConjuge && !temProcurador) {
    return { ordem: 1, desc: 'Sem cônjuge e sem procurador' };
  }
  if (!temConjuge && temProcurador && !procLeve) {
    return { ordem: 2, desc: 'Sem cônjuge e com procurador sem restrição' };
  }
  if (temConjuge && !conjLeve && !temProcurador) {
    return { ordem: 3, desc: 'Com cônjuge sem restrição e sem procurador' };
  }
  if (temConjuge && !conjLeve && temProcurador && !procLeve) {
    return { ordem: 4, desc: 'Com cônjuge sem restrição e com procurador sem restrição' };
  }
  if (!temConjuge && temProcurador && procLeve) {
    return { ordem: 5, desc: 'Sem cônjuge e com procurador com restrição leve' };
  }
  if (temConjuge && conjLeve && !temProcurador) {
    return { ordem: 6, desc: 'Com cônjuge com restrição leve e sem procurador' };
  }
  if (temConjuge && !conjLeve && temProcurador && procLeve) {
    return {
      ordem: 7,
      desc: 'Com cônjuge sem restrição e com procurador com restrição leve',
    };
  }
  if (temConjuge && conjLeve && temProcurador && !procLeve) {
    return {
      ordem: 8,
      desc: 'Com cônjuge com restrição leve e com procurador sem restrição',
    };
  }
  return {
    ordem: 9,
    desc: 'Com cônjuge com restrição leve e com procurador com restrição leve',
  };
}

export function classificarListaConformidadePronafA(
  lista: ItemConformidadePronafA[],
  contratacoesAtuais: RegistroContratacao[]
): ResultadoClassificacaoPronafA[] {
  const validos = lista.filter((it) => it.nomeCliente.trim() !== '');

  const resultados: ResultadoClassificacaoPronafA[] = validos.map((item) => {
    const temConjuge = Boolean(item.conjugeNome.trim() || item.conjugeCpf.trim());
    const temProcurador = Boolean(
      item.procuradorNome.trim() || item.procuradorCpf.trim()
    );

    const restCli = item.restricaoClienteNivel;
    const restConj: NivelRestricaoCI = temConjuge
      ? item.restricaoConjugeNivel
      : 'SEM_RESTRICAO';
    const restProc: NivelRestricaoCI = temProcurador
      ? item.restricaoProcuradorNivel
      : 'SEM_RESTRICAO';

    const temGraveCli = restCli === 'GRAVE';
    const temGraveConj = temConjuge && restConj === 'GRAVE';
    const temGraveProc = temProcurador && restProc === 'GRAVE';
    const possuiAlgumaGrave = temGraveCli || temGraveConj || temGraveProc;

    const resumoPontosOk: string[] = [];
    const resumoPendencias: string[] = [];

    if (item.cadastroClienteOk === 'OK') {
      resumoPontosOk.push(
        `CADASTRO TITULAR OK${item.dataRefCadastral ? ` (REF: ${item.dataRefCadastral})` : ''}`
      );
    } else if (item.cadastroClienteOk === 'A_RENOVAR') {
      resumoPendencias.push('RENOVAR CADASTRO DO TITULAR');
    } else {
      resumoPendencias.push('ELABORAR CADASTRO DO TITULAR');
    }

    if (item.visitado === 'SIM') {
      resumoPontosOk.push('VISITA TÉCNICA REALIZADA');
    } else {
      resumoPendencias.push('REALIZAR VISITA AO CLIENTE');
    }

    const ccLimpa = item.contaCorrente.trim().toUpperCase();
    if (ccLimpa && ccLimpa !== 'NÃO' && ccLimpa !== 'NAO' && ccLimpa !== '-') {
      resumoPontosOk.push(`CONTA CORRENTE ABERTA (${item.contaCorrente.trim()})`);
    } else {
      resumoPendencias.push('ABRIR CONTA CORRENTE DO CLIENTE');
    }

    if (restCli === 'LEVE') {
      resumoPendencias.push(
        `RESTRIÇÃO LEVE TITULAR${
          item.restricaoClienteDetalhe
            ? `: ${item.restricaoClienteDetalhe.toUpperCase()}`
            : ' (PEFIN COMERCIAL)'
        }`
      );
    } else if (restCli === 'GRAVE') {
      resumoPendencias.push(
        `RESTRIÇÃO GRAVE TITULAR (REFIN/BANCOS)${
          item.restricaoClienteDetalhe
            ? `: ${item.restricaoClienteDetalhe.toUpperCase()}`
            : ''
        }`
      );
    }

    if (temConjuge) {
      if (item.cadastroConjugeOk === 'OK') {
        resumoPontosOk.push(`CADASTRO CÔNJUGE OK (${item.conjugeNome.toUpperCase()})`);
      } else if (item.cadastroConjugeOk === 'A_RENOVAR') {
        resumoPendencias.push(
          `RENOVAR CADASTRO DO CÔNJUGE (${item.conjugeNome.toUpperCase() || 'CÔNJUGE'})`
        );
      } else if (item.cadastroConjugeOk === 'A_ELABORAR') {
        resumoPendencias.push(
          `ELABORAR CADASTRO DO CÔNJUGE (${item.conjugeNome.toUpperCase() || 'CÔNJUGE'})`
        );
      }

      if (restConj === 'LEVE') {
        resumoPendencias.push(
          `RESTRIÇÃO LEVE DO CÔNJUGE${
            item.restricaoConjugeDetalhe
              ? `: ${item.restricaoConjugeDetalhe.toUpperCase()}`
              : ''
          }`
        );
      } else if (restConj === 'GRAVE') {
        resumoPendencias.push(
          `RESTRIÇÃO GRAVE DO CÔNJUGE${
            item.restricaoConjugeDetalhe
              ? `: ${item.restricaoConjugeDetalhe.toUpperCase()}`
              : ''
          }`
        );
      }
    }

    if (temProcurador) {
      if (item.cadastroProcuradorOk === 'OK') {
        resumoPontosOk.push(
          `CADASTRO PROCURADOR OK (${item.procuradorNome.toUpperCase()})`
        );
      } else if (item.cadastroProcuradorOk === 'A_RENOVAR') {
        resumoPendencias.push(
          `RENOVAR CADASTRO DO PROCURADOR (${item.procuradorNome.toUpperCase() || 'PROCURADOR'})`
        );
      } else if (item.cadastroProcuradorOk === 'A_ELABORAR') {
        resumoPendencias.push(
          `ELABORAR CADASTRO DO PROCURADOR (${item.procuradorNome.toUpperCase() || 'PROCURADOR'})`
        );
      }

      if (restProc === 'LEVE') {
        resumoPendencias.push(
          `RESTRIÇÃO LEVE DO PROCURADOR${
            item.restricaoProcuradorDetalhe
              ? `: ${item.restricaoProcuradorDetalhe.toUpperCase()}`
              : ''
          }`
        );
      } else if (restProc === 'GRAVE') {
        resumoPendencias.push(
          `RESTRIÇÃO GRAVE DO PROCURADOR${
            item.restricaoProcuradorDetalhe
              ? `: ${item.restricaoProcuradorDetalhe.toUpperCase()}`
              : ''
          }`
        );
      }
    }

    let penalidade = 0;
    if (restCli === 'LEVE') penalidade += 100;
    const qtdEnvolvidosExtras = (temConjuge ? 1 : 0) + (temProcurador ? 1 : 0);
    penalidade += qtdEnvolvidosExtras * 30;

    if (temConjuge) {
      if (item.cadastroConjugeOk === 'A_RENOVAR') penalidade += 15;
      else if (item.cadastroConjugeOk === 'A_ELABORAR') penalidade += 35;
    }
    if (temProcurador) {
      if (item.cadastroProcuradorOk === 'A_RENOVAR') penalidade += 15;
      else if (item.cadastroProcuradorOk === 'A_ELABORAR') penalidade += 35;
    }
    if (item.visitado !== 'SIM') penalidade += 5;
    if (!ccLimpa || ccLimpa === 'NÃO' || ccLimpa === 'NAO') penalidade += 5;

    let grupoNumero: 1 | 2 | 3 | 4 = 1;
    let grupoTitulo = '';
    let subgrupoOrdem = 1;
    let subgrupoDescricao = '';

    if (possuiAlgumaGrave) {
      grupoNumero = 4;
      grupoTitulo = 'Grupo 4 — Com restrição grave (REFIN / Bancos / Pend. Financeira)';
      if (!temGraveCli && !temGraveConj && temGraveProc) {
        subgrupoOrdem = 1;
        subgrupoDescricao = 'Restrição grave somente do procurador';
      } else if (!temGraveCli && temGraveConj && !temGraveProc) {
        subgrupoOrdem = 2;
        subgrupoDescricao = 'Restrição grave somente do cônjuge';
      } else if (!temGraveCli && temGraveConj && temGraveProc) {
        subgrupoOrdem = 3;
        subgrupoDescricao = 'Restrição grave do cônjuge e do procurador';
      } else {
        subgrupoOrdem = 4;
        subgrupoDescricao = 'Restrição grave do próprio cliente (Final da fila)';
      }
    } else if (item.cadastroClienteOk === 'OK') {
      grupoNumero = 1;
      grupoTitulo = 'Grupo 1 — Cliente com cadastro OK e sem REFIN';
      const sub = calcularSubgrupoGrupos1e2(
        temConjuge,
        temProcurador,
        restConj,
        restProc
      );
      subgrupoOrdem = sub.ordem;
      subgrupoDescricao =
        restCli === 'LEVE'
          ? `${sub.desc} (Titular c/ PEFIN Comercial Leve)`
          : sub.desc;
    } else if (item.cadastroClienteOk === 'A_RENOVAR') {
      grupoNumero = 2;
      grupoTitulo = 'Grupo 2 — Cliente com cadastro para renovar e sem REFIN';
      const sub = calcularSubgrupoGrupos1e2(
        temConjuge,
        temProcurador,
        restConj,
        restProc
      );
      subgrupoOrdem = sub.ordem;
      subgrupoDescricao =
        restCli === 'LEVE'
          ? `${sub.desc} (Titular c/ PEFIN Comercial Leve)`
          : sub.desc;
    } else {
      grupoNumero = 3;
      grupoTitulo = 'Grupo 3 — Cadastro ainda não elaborado';
      const temAlgumaLeve =
        restCli === 'LEVE' || restConj === 'LEVE' || restProc === 'LEVE';
      const pendCadastraisExtras =
        (temConjuge && item.cadastroConjugeOk !== 'OK' ? 1 : 0) +
        (temProcurador && item.cadastroProcuradorOk !== 'OK' ? 1 : 0);

      if (!temConjuge && !temProcurador && !temAlgumaLeve) {
        subgrupoOrdem = 1;
        subgrupoDescricao = 'Sem cônjuge e sem procurador • Sem restrições';
      } else if (!temAlgumaLeve) {
        subgrupoOrdem = 2;
        subgrupoDescricao = 'Com cônjuge/procurador sem restrições identificadas';
      } else if (pendCadastraisExtras === 0) {
        subgrupoOrdem = 3;
        subgrupoDescricao = 'Com restrições leves identificadas';
      } else {
        subgrupoOrdem = 4;
        subgrupoDescricao =
          'Com maior quantidade de pendências cadastrais / envolvidos';
      }
    }

    const cpfLimpo = item.cpfCliente.replace(/\D/g, '');
    const nomeUpper = item.nomeCliente.toUpperCase().trim();
    const jaCadastradoNoPainel = contratacoesAtuais.some((r) => {
      const rCpf = (r.cpf || '').replace(/\D/g, '');
      const rNome = (r.cliente || '').toUpperCase().trim();
      return (
        (cpfLimpo.length === 11 && rCpf === cpfLimpo) ||
        (nomeUpper.length > 3 && rNome === nomeUpper)
      );
    });

    return {
      item,
      grupoNumero,
      grupoTitulo,
      subgrupoOrdem,
      subgrupoDescricao,
      scoreDesempate: penalidade,
      resumoPendencias,
      resumoPontosOk,
      jaCadastradoNoPainel,
    };
  });

  return resultados.sort((a, b) => {
    if (a.grupoNumero !== b.grupoNumero) return a.grupoNumero - b.grupoNumero;
    if (a.subgrupoOrdem !== b.subgrupoOrdem) return a.subgrupoOrdem - b.subgrupoOrdem;
    if (a.scoreDesempate !== b.scoreDesempate) return a.scoreDesempate - b.scoreDesempate;
    return a.item.nomeCliente.localeCompare(b.item.nomeCliente);
  });
}

function criarLinhaVazia(): ItemConformidadePronafA {
  return {
    id: `conf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nomeCliente: '',
    cpfCliente: '',
    visitado: 'SIM',
    cadastroClienteOk: 'OK',
    dataRefCadastral: getHojeBR(),
    restricaoClienteNivel: 'SEM_RESTRICAO',
    restricaoClienteDetalhe: '',
    contaCorrente: '',
    conjugeNome: '',
    conjugeCpf: '',
    cadastroConjugeOk: 'NAO_SE_APLICA',
    restricaoConjugeNivel: 'SEM_RESTRICAO',
    restricaoConjugeDetalhe: '',
    procuradorNome: '',
    procuradorCpf: '',
    cadastroProcuradorOk: 'NAO_SE_APLICA',
    restricaoProcuradorNivel: 'SEM_RESTRICAO',
    restricaoProcuradorDetalhe: '',
  };
}

function criarNovaListaPadrao(nomePersonalizado?: string): ListaSalvaConformidadePronafA {
  const agora = getHojeBR();
  return {
    id: `lista_pronafa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nomeLista: nomePersonalizado || `Lista de Conferência (${agora})`,
    dataCriacao: agora,
    dataAtualizacao: agora,
    itens: [criarLinhaVazia()],
  };
}

export default function ModalConformidadePronafA({
  aberto,
  onFechar,
  contratacoes,
  onCadastrarPropostaNoPainel,
}: ModalConformidadePronafAProps) {
  const [abaAtiva, setAbaAtiva] = useState<'PLANILHA' | 'RANKING'>('PLANILHA');

  // Gerenciador de Múltiplas Listas Salvas (Local + Nuvem)
  const [listasSalvas, setListasSalvas] = useState<ListaSalvaConformidadePronafA[]>([]);
  const [listaAtivaId, setListaAtivaId] = useState<string>('');
  const [statusSyncNuvem, setStatusSyncNuvem] = useState<'SINCRONIZADO' | 'SALVANDO'>(
    'SINCRONIZADO'
  );

  const inputImportarExcelRef = useRef<HTMLInputElement>(null);

  // Sub-Modal de Colagem Rápida
  const [modalColarAberto, setModalColarAberto] = useState(false);
  const [textoColagemMassa, setTextoColagemMassa] = useState('');

  // Sub-Modal de Iniciar Proposta PRONAF A no Painel e Kanban
  const [itemParaCadastro, setItemParaCadastro] =
    useState<ResultadoClassificacaoPronafA | null>(null);
  const [cadValor, setCadValor] = useState('');
  const [cadTipo, setCadTipo] = useState('Investimento');
  const [cadProjetista, setCadProjetista] = useState('');
  const [cadPrograma, setCadPrograma] = useState('FNE/PRONAF A - RES.5.183/24 (699)');
  const [cadSituacao, setCadSituacao] = useState('Na Agência');
  const [cadResponsavel, setCadResponsavel] = useState('');
  const [cadTelefone, setCadTelefone] = useState('');
  const [cadData, setCadData] = useState(() => getHojeBR());
  const [cadSitDetalhada, setCadSitDetalhada] = useState('');
  const [cadObsPendencias, setCadObsPendencias] = useState('');

  const listaProgramas = useMemo(() => obterListaProgramas(), []);

  // Carrega as listas salvas (do Servidor/Nuvem e do LocalStorage, migrando listas antigas sem nunca apagar!)
  useEffect(() => {
    if (!aberto || typeof window === 'undefined') return;

    const carregarListasIniciais = async () => {
      let listasLocais: ListaSalvaConformidadePronafA[] = [];

      try {
        const salvoMulti = window.localStorage.getItem(
          STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A
        );
        if (salvoMulti) {
          const parsed = JSON.parse(salvoMulti);
          if (Array.isArray(parsed) && parsed.length > 0) {
            listasLocais = parsed;
          }
        } else {
          // Migra eventual lista única da versão anterior para não perder nenhum dado já digitado
          const legado = window.localStorage.getItem(STORAGE_KEY_LEGADO_CONFORMIDADE);
          if (legado) {
            const itensLegado = JSON.parse(legado);
            if (Array.isArray(itensLegado) && itensLegado.length > 0) {
              listasLocais = [
                {
                  id: `lista_migrada_${Date.now()}`,
                  nomeLista: `Lista Principal PRONAF A (${getHojeBR()})`,
                  dataCriacao: getHojeBR(),
                  dataAtualizacao: getHojeBR(),
                  itens: itensLegado,
                },
              ];
            }
          }
        }
      } catch {
        // Ignora erro local
      }

      // Consulta diretamente o Firebase Realtime Database (sistema_bnb_v2_homolog/ferramentas)
      try {
        const dadosNuvem = await carregarFerramentasSync();
        const listasNuvem = dadosNuvem?.listasConformidadePronafA;
        if (Array.isArray(listasNuvem) && listasNuvem.length > 0) {
          const mapa = new Map<string, ListaSalvaConformidadePronafA>();
          listasLocais.forEach((l) => mapa.set(l.id, l));
          // Prioriza a versão mais recente da nuvem e mantém listas locais novas
          (listasNuvem as ListaSalvaConformidadePronafA[]).forEach((l) =>
            mapa.set(l.id, l)
          );
          listasLocais = Array.from(mapa.values());
        }
      } catch {
        // Fallback para listasLocais
      }

      if (listasLocais.length === 0) {
        listasLocais = [criarNovaListaPadrao('Lista 01 — Conformidade PRONAF A')];
      }

      setListasSalvas(listasLocais);
      setListaAtivaId((prev) =>
        listasLocais.some((l) => l.id === prev) ? prev : listasLocais[0].id
      );
      window.localStorage.setItem(
        STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A,
        JSON.stringify(listasLocais)
      );
    };

    carregarListasIniciais();
  }, [aberto]);

  // Salva todas as listas no LocalStorage e sincroniza com o Servidor/Nuvem
  const persistirListas = (novasListas: ListaSalvaConformidadePronafA[]) => {
    setListasSalvas(novasListas);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        STORAGE_KEY_LISTAS_CONFORMIDADE_PRONAF_A,
        JSON.stringify(novasListas)
      );
      window.dispatchEvent(
        new CustomEvent('bnb_ferramentas_sync_changed', {
          detail: { listasConformidadePronafA: novasListas },
        })
      );
    }

    setStatusSyncNuvem('SALVANDO');
    salvarFerramentasSync({
  listasConformidadePronafA: novasListas,
})
      .catch(() => {})
      .finally(() => setStatusSyncNuvem('SINCRONIZADO'));
  };

  const listaAtiva = useMemo(() => {
    return (
      listasSalvas.find((l) => l.id === listaAtivaId) ||
      listasSalvas[0] ||
      criarNovaListaPadrao()
    );
  }, [listasSalvas, listaAtivaId]);

  const itens = listaAtiva.itens;

  const salvarItensDaListaAtiva = (novosItens: ItemConformidadePronafA[]) => {
    const novasListas = listasSalvas.map((l) =>
      l.id === listaAtiva.id
        ? { ...l, dataAtualizacao: getHojeBR(), itens: novosItens }
        : l
    );
    persistirListas(novasListas);
  };

  // Ações de Gestão de Múltiplas Listas (Criar, Renomear, Excluir)
  const handleCriarNovaLista = () => {
    const nome = window.prompt(
      'Digite o nome da nova Lista de Conferência PRONAF A:',
      `Lote PRONAF A — ${getHojeBR()}`
    );
    if (!nome || !nome.trim()) return;
    const nova = criarNovaListaPadrao(nome.trim());
    const atualizadas = [nova, ...listasSalvas];
    persistirListas(atualizadas);
    setListaAtivaId(nova.id);
    setAbaAtiva('PLANILHA');
  };

  const handleRenomearListaAtiva = () => {
    const novoNome = window.prompt(
      'Renomear a lista atual:',
      listaAtiva.nomeLista
    );
    if (!novoNome || !novoNome.trim()) return;
    const atualizadas = listasSalvas.map((l) =>
      l.id === listaAtiva.id ? { ...l, nomeLista: novoNome.trim() } : l
    );
    persistirListas(atualizadas);
  };

  const handleExcluirListaAtiva = () => {
    if (
      !window.confirm(
        `⚠️ Tem certeza que deseja EXCLUIR permanentemente a lista "${listaAtiva.nomeLista}" (${itens.length} linhas)?`
      )
    ) {
      return;
    }
    const restantes = listasSalvas.filter((l) => l.id !== listaAtiva.id);
    if (restantes.length === 0) {
      const novaPadrao = criarNovaListaPadrao('Lista 01 — Conformidade PRONAF A');
      persistirListas([novaPadrao]);
      setListaAtivaId(novaPadrao.id);
    } else {
      persistirListas(restantes);
      setListaAtivaId(restantes[0].id);
    }
  };

  const atualizarCampo = <K extends keyof ItemConformidadePronafA>(
    idx: number,
    campo: K,
    valor: ItemConformidadePronafA[K]
  ) => {
    const copia = [...itens];
    copia[idx] = { ...copia[idx], [campo]: valor };

    if (
      campo === 'conjugeNome' &&
      String(valor).trim() !== '' &&
      copia[idx].cadastroConjugeOk === 'NAO_SE_APLICA'
    ) {
      copia[idx].cadastroConjugeOk = 'OK';
    }
    if (
      campo === 'procuradorNome' &&
      String(valor).trim() !== '' &&
      copia[idx].cadastroProcuradorOk === 'NAO_SE_APLICA'
    ) {
      copia[idx].cadastroProcuradorOk = 'OK';
    }

    salvarItensDaListaAtiva(copia);
  };

  const rankingClassificado = useMemo(
    () => classificarListaConformidadePronafA(itens, contratacoes),
    [itens, contratacoes]
  );

  // =========================================================================
  // INTEGRAÇÃO DIRETA COM EXCEL (.XLSX): MODELO, EXPORTAÇÃO E IMPORTAÇÃO
  // =========================================================================

  // 1. EXPORTAR MODELO (.XLSX) EM BRANCO COM AS 14 COLUNAS EXATAS
  const exportarModeloExcel14Colunas = () => {
    const linhaExemplo = [
      'EXEMPLO: MARIA JOSÉ DA SILVA (APAGUE ESTA LINHA)',
      '000.000.000-00',
      'SIM',
      'OK',
      getHojeBR(),
      'CAEMA (LEVE)',
      '47706-6',
      'JOÃO DA SILVA',
      '111.222.333-44',
      'OK',
      'NÃO',
      '',
      '',
      'NÃO SE APLICA',
    ];

    const aoa = [CABECALHOS_EXCEL_14_COLUNAS, linhaExemplo, []];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 34 },
      { wch: 16 },
      { wch: 12 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 16 },
      { wch: 30 },
      { wch: 16 },
      { wch: 26 },
      { wch: 24 },
      { wch: 28 },
      { wch: 16 },
      { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MODELO_CONFERENCIA_PRONAF_A');
    XLSX.writeFile(wb, 'MODELO_CONFORMIDADE_CADASTRAL_PRONAF_A.xlsx');
  };

  // 2. EXPORTAR LISTA ATUAL (.XLSX) COM 2 ABAS (CONFERÊNCIA + FILA PRIORIZADA)
  const exportarListaAtivaParaExcel = () => {
    const linhasConferencia = itens
      .filter((i) => i.nomeCliente.trim() !== '')
      .map((it) => {
        const fmtRest = (niv: NivelRestricaoCI, det: string) => {
          if (niv === 'SEM_RESTRICAO') return det || 'NÃO';
          const rotulo = niv === 'GRAVE' ? 'GRAVE (REFIN/BANCOS)' : 'LEVE (PEFIN)';
          return det ? `${rotulo} - ${det}` : rotulo;
        };

        return [
          it.nomeCliente.toUpperCase(),
          it.cpfCliente,
          it.visitado,
          it.cadastroClienteOk === 'OK'
            ? 'OK'
            : it.cadastroClienteOk === 'A_RENOVAR'
            ? 'A RENOVAR'
            : 'A ELABORAR',
          it.dataRefCadastral,
          fmtRest(it.restricaoClienteNivel, it.restricaoClienteDetalhe),
          it.contaCorrente || 'NÃO',
          it.conjugeNome.toUpperCase(),
          it.conjugeCpf,
          it.cadastroConjugeOk === 'NAO_SE_APLICA' ? 'NÃO SE APLICA' : it.cadastroConjugeOk,
          fmtRest(it.restricaoConjugeNivel, it.restricaoConjugeDetalhe),
          it.procuradorNome.toUpperCase(),
          it.procuradorCpf,
          it.cadastroProcuradorOk === 'NAO_SE_APLICA'
            ? 'NÃO SE APLICA'
            : `${it.cadastroProcuradorOk} (${
                it.restricaoProcuradorNivel === 'SEM_RESTRICAO'
                  ? 'S/ Restr.'
                  : it.restricaoProcuradorNivel
              })`,
        ];
      });

    const wsConferencia = XLSX.utils.aoa_to_sheet([
      CABECALHOS_EXCEL_14_COLUNAS,
      ...linhasConferencia,
    ]);
    wsConferencia['!cols'] = CABECALHOS_EXCEL_14_COLUNAS.map(() => ({ wch: 24 }));

    const cabecalhoRanking = [
      'Ordem na Fila',
      'Grupo de Prioridade',
      'Subgrupo / Critério',
      'Nome do Cliente',
      'CPF do Cliente',
      'C/C Aberta',
      'Visitado?',
      'Cônjuge / Comp.',
      'Procurador',
      'Diagnóstico / Pendências',
    ];

    const linhasRanking = rankingClassificado.map((r, idx) => [
      `${idx + 1}º`,
      r.grupoTitulo,
      `Subgrupo ${r.grupoNumero}.${r.subgrupoOrdem}: ${r.subgrupoDescricao}`,
      r.item.nomeCliente.toUpperCase(),
      r.item.cpfCliente,
      r.item.contaCorrente || 'Não aberta',
      r.item.visitado,
      r.item.conjugeNome || 'Sem cônjuge',
      r.item.procuradorNome || 'Sem procurador',
      r.resumoPendencias.length > 0
        ? r.resumoPendencias.join(' | ')
        : '100% OK — Pronta para encaminhamento',
    ]);

    const wsRanking = XLSX.utils.aoa_to_sheet([cabecalhoRanking, ...linhasRanking]);
    wsRanking['!cols'] = cabecalhoRanking.map(() => ({ wch: 26 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsConferencia, '1_CONFERENCIA_14_COLUNAS');
    XLSX.utils.book_append_sheet(wb, wsRanking, '2_FILA_PRIORIDADES');

    const nomeLimpo = listaAtiva.nomeLista
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    XLSX.writeFile(wb, `CONFORMIDADE_PRONAF_A_${nomeLimpo || getHojeISO()}.xlsx`);
  };

  // 3. IMPORTAR LISTA DIRETAMENTE DO EXCEL (.XLSX / .XLS)
  const handleImportarArquivoExcel = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const primeiraAba = wb.SheetNames[0];
      const ws = wb.Sheets[primeiraAba];
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: '',
      });

      const novosItens: ItemConformidadePronafA[] = [];

      matriz.forEach((linhaRaw, idxLinha) => {
        if (!Array.isArray(linhaRaw)) return;
        const cols = linhaRaw.map((c) => String(c ?? '').trim());
        const nomeCandidato = (cols[0] || '').toUpperCase().trim();

        // Ignora cabeçalho ou linha de exemplo do modelo
        if (
          !nomeCandidato ||
          (idxLinha === 0 &&
            (nomeCandidato.includes('NOME DO CLIENTE') ||
              nomeCandidato.includes('1. NOME') ||
              nomeCandidato === 'NOME')) ||
          nomeCandidato.startsWith('EXEMPLO:')
        ) {
          return;
        }

        const novo = criarLinhaVazia();
        novo.nomeCliente = nomeCandidato;
        novo.cpfCliente = aplicarMascaraCPF(cols[1] || '');
        novo.visitado = interpretarVisitadoExcel(cols[2] || 'SIM');
        novo.cadastroClienteOk = interpretarStatusCadastroTitularExcel(cols[3] || 'OK');
        novo.dataRefCadastral = cols[4] || getHojeBR();

        const restCliTxt = cols[5] || '';
        novo.restricaoClienteDetalhe =
          restCliTxt.toUpperCase() === 'NÃO' || restCliTxt.toUpperCase() === 'NAO'
            ? ''
            : restCliTxt;
        novo.restricaoClienteNivel = detectarNivelRestricaoPorTexto(restCliTxt);

        novo.contaCorrente = cols[6] || '';
        novo.conjugeNome = (cols[7] || '').toUpperCase().trim();
        novo.conjugeCpf = aplicarMascaraCPF(cols[8] || '');
        novo.cadastroConjugeOk = interpretarStatusCadastroOpcionalExcel(
          cols[9] || '',
          Boolean(novo.conjugeNome || novo.conjugeCpf)
        );

        const restConjTxt = cols[10] || '';
        novo.restricaoConjugeDetalhe =
          restConjTxt.toUpperCase() === 'NÃO' || restConjTxt.toUpperCase() === 'NAO'
            ? ''
            : restConjTxt;
        novo.restricaoConjugeNivel = detectarNivelRestricaoPorTexto(restConjTxt);

        novo.procuradorNome = (cols[11] || '').toUpperCase().trim();
        novo.procuradorCpf = aplicarMascaraCPF(cols[12] || '');
        novo.cadastroProcuradorOk = interpretarStatusCadastroOpcionalExcel(
          cols[13] || '',
          Boolean(novo.procuradorNome || novo.procuradorCpf)
        );
        novo.restricaoProcuradorNivel = detectarNivelRestricaoPorTexto(cols[13] || '');

        novosItens.push(novo);
      });

      if (novosItens.length === 0) {
        alert('⚠️ Nenhum cliente válido foi encontrado nas linhas da planilha Excel.');
        e.target.value = '';
        return;
      }

      const criarComoNovaLista = window.confirm(
        `✅ Foram lidos ${novosItens.length} cliente(s) da planilha "${file.name}".\n\n` +
          `• Clique em [OK] para criar uma NOVA LISTA salva com esses clientes;\n` +
          `• Ou clique em [Cancelar] para ADICIONAR esses clientes dentro da lista atual ("${listaAtiva.nomeLista}").`
      );

      if (criarComoNovaLista) {
        const nomeSugerido = file.name.replace(/\.xlsx?$/i, '');
        const novaLista: ListaSalvaConformidadePronafA = {
          id: `lista_xlsx_${Date.now()}`,
          nomeLista: nomeSugerido,
          dataCriacao: getHojeBR(),
          dataAtualizacao: getHojeBR(),
          itens: novosItens,
        };
        const atualizadas = [novaLista, ...listasSalvas];
        persistirListas(atualizadas);
        setListaAtivaId(novaLista.id);
      } else {
        const atuaisPreenchidos = itens.filter((i) => i.nomeCliente.trim() !== '');
        salvarItensDaListaAtiva([...atuaisPreenchidos, ...novosItens]);
      }
    } catch {
      alert('❌ Erro ao ler a planilha Excel. Verifique se o arquivo é um .xlsx válido.');
    }

    e.target.value = '';
  };

  const processarColagemEmLote = () => {
    const linhas = textoColagemMassa
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (linhas.length === 0) return;

    const novosItens: ItemConformidadePronafA[] = [];

    linhas.forEach((linha) => {
      const cols = linha.includes('\t') ? linha.split('\t') : linha.split(/[;|-]/);
      const nomeLimpo = (cols[0] || '').toUpperCase().trim();
      if (!nomeLimpo || nomeLimpo === 'NOME DO CLIENTE' || nomeLimpo === 'NOME') return;

      const novo = criarLinhaVazia();
      novo.nomeCliente = nomeLimpo;
      novo.cpfCliente = aplicarMascaraCPF(cols[1] || '');

      if (cols.length >= 4) {
        novo.visitado = interpretarVisitadoExcel(cols[2] || 'SIM');
        novo.cadastroClienteOk = interpretarStatusCadastroTitularExcel(cols[3] || 'OK');
        novo.dataRefCadastral = cols[4] || getHojeBR();
        const txtRestCli = cols[5] || '';
        novo.restricaoClienteDetalhe = txtRestCli;
        novo.restricaoClienteNivel = detectarNivelRestricaoPorTexto(txtRestCli);
        novo.contaCorrente = cols[6] || '';
        novo.conjugeNome = (cols[7] || '').toUpperCase().trim();
        novo.conjugeCpf = aplicarMascaraCPF(cols[8] || '');
        novo.cadastroConjugeOk = interpretarStatusCadastroOpcionalExcel(
          cols[9] || '',
          Boolean(novo.conjugeNome)
        );
        const txtRestConj = cols[10] || '';
        novo.restricaoConjugeDetalhe = txtRestConj;
        novo.restricaoConjugeNivel = detectarNivelRestricaoPorTexto(txtRestConj);
        novo.procuradorNome = (cols[11] || '').toUpperCase().trim();
        novo.procuradorCpf = aplicarMascaraCPF(cols[12] || '');
        novo.cadastroProcuradorOk = interpretarStatusCadastroOpcionalExcel(
          cols[13] || '',
          Boolean(novo.procuradorNome)
        );
      }

      novosItens.push(novo);
    });

    if (novosItens.length > 0) {
      const atuaisLimpos = itens.filter((i) => i.nomeCliente.trim() !== '');
      salvarItensDaListaAtiva([...atuaisLimpos, ...novosItens]);
      setTextoColagemMassa('');
      setModalColarAberto(false);
    }
  };

  const abrirModalIniciarProposta = (res: ResultadoClassificacaoPronafA) => {
    setItemParaCadastro(res);
    setCadValor('');
    setCadTipo('Investimento');
    setCadProjetista('');
    setCadPrograma('FNE/PRONAF A - RES.5.183/24 (699)');
    setCadSituacao('Na Agência');
    setCadResponsavel('');
    setCadTelefone('');
    setCadData(getHojeBR());

    const sitLinhas =
      res.resumoPontosOk.length > 0
        ? res.resumoPontosOk.map((p) => `- ${p}`).join('\n')
        : '- CONFORMIDADE CADASTRAL PRONAF A INICIADA';
    const pendLinhas =
      res.resumoPendencias.length > 0
        ? res.resumoPendencias.map((p) => `- ${p}`).join('\n')
        : '- SEM PENDÊNCIAS CADASTRAIS IDENTIFICADAS';

    setCadSitDetalhada(sitLinhas);
    setCadObsPendencias(pendLinhas);
  };

  const confirmarCadastroPropostaNoPainel = () => {
    if (!itemParaCadastro) return;
    if (!cadValor.trim()) {
      alert('Informe o Valor da Proposta (R$) para cadastrar a operação!');
      return;
    }

    const { item } = itemParaCadastro;
    const idNovaOp = String(Date.now());
    const nomeUpper = item.nomeCliente.toUpperCase().trim();
    const cpfFmt = item.cpfCliente.trim();

    const novaContratacao: RegistroContratacao = {
      id: idNovaOp,
      porte: 'PRONAF A',
      cliente: nomeUpper,
      cpf: cpfFmt,
      valor: cadValor.trim(),
      tipo: cadTipo || 'Investimento',
      situacao: cadSituacao || 'Na Agência',
      situacaoDetalhada: cadSitDetalhada.trim(),
      projetista: cadProjetista.toUpperCase().trim(),
      responsavel: cadResponsavel.toUpperCase().trim(),
      telefone: cadTelefone.trim(),
      data: cadData || getHojeBR(),
      obs: cadObsPendencias.trim(),
      programa: cadPrograma.toUpperCase().trim(),
      cadaVezMelhor: isEnquadradoCadaVezMelhor(cadPrograma),
      tipoGarantiaKanban: 'NENHUMA',
    };

    const { html, textoPuro } = montarHtmlCardSincronizado({
      cliente: nomeUpper,
      cpf: cpfFmt,
      porte: 'PRONAF A',
      projetista: novaContratacao.projetista,
      tipo: novaContratacao.tipo,
      valor: novaContratacao.valor,
      situacaoMacro: novaContratacao.situacao,
      situacaoDetalhada: novaContratacao.situacaoDetalhada,
      pendenciasObs: novaContratacao.obs,
      programa: novaContratacao.programa,
      operacoesAgrupadas: [
        {
          id: idNovaOp,
          tipo: novaContratacao.tipo,
          valor: novaContratacao.valor,
          situacao: novaContratacao.situacao,
          detalheExtra: novaContratacao.programa,
        },
      ],
    });

    const corCard =
      itemParaCadastro.grupoNumero === 1
        ? 'azul'
        : itemParaCadastro.grupoNumero === 4
        ? 'vermelho'
        : 'amarelo';

    const etapaInicial: EtapaKanban = 'CADASTROS';

    const novoCardKanban: CardKanban = {
      id: `wk_pronafa_${idNovaOp}`,
      etapa: etapaInicial,
      statusCor: corCard,
      texto: html,
      textoPuro,
      dataModificacao: getHojeISO(),
      isNovo: true,
      propostaIdVinculada: idNovaOp,
      idsPropostasAgrupadas: [idNovaOp],
      clienteVinculado: nomeUpper,
      cpfVinculado: cpfFmt,
      porteVinculado: 'PRONAF A',
      valorVinculado: novaContratacao.valor,
      tipoOpVinculado: novaContratacao.tipo,
      situacaoVinculada: novaContratacao.situacao,
      situacaoDetalhadaVinculada: novaContratacao.situacaoDetalhada,
      obsVinculada: novaContratacao.obs,
    };

    onCadastrarPropostaNoPainel(novaContratacao, novoCardKanban);
    setItemParaCadastro(null);
    alert(
      `✅ Cliente "${nomeUpper}" cadastrado com sucesso!\n\n` +
        `• Incluído na aba 1. Contratações (Porte: PRONAF A)\n` +
        `• Card criado automaticamente na coluna [📂 CADASTROS] do Kanban!`
    );
  };

  // ITEM 1 CORRIGIDO: O Grupo 1 inicia imediatamente na Página 1 abaixo do cabeçalho (sem page-break-inside no container do grupo)
  const exportarRelatorioPrioridadesPDF = () => {
    if (rankingClassificado.length === 0) {
      alert('Preencha ao menos um cliente na planilha antes de gerar o PDF.');
      return;
    }

    const jan = window.open('', '_blank', 'width=1020,height=840');
    if (!jan) return;

    const grupos = [1, 2, 3, 4] as const;
    const coresGrupo: Record<number, { bg: string; borda: string; texto: string }> = {
      1: { bg: '#f0fdf4', borda: '#15803d', texto: '#166534' },
      2: { bg: '#eff6ff', borda: '#1d4ed8', texto: '#1e40af' },
      3: { bg: '#fffbeb', borda: '#d97706', texto: '#92400e' },
      4: { bg: '#fef2f2', borda: '#dc2626', texto: '#991b1b' },
    };

    let htmlGrupos = '';
    let posGeral = 1;

    grupos.forEach((numG) => {
      const doGrupo = rankingClassificado.filter((r) => r.grupoNumero === numG);
      if (doGrupo.length === 0) return;

      const estilo = coresGrupo[numG];
      htmlGrupos += `
        <div style="margin-bottom: 16px;">
          <div style="background:${estilo.bg}; border-left:5px solid ${estilo.borda}; padding:7px 12px; font-weight:bold; color:${estilo.texto}; font-size:10.5pt; margin-bottom:6px; page-break-after: avoid; break-after: avoid;">
            ${doGrupo[0].grupoTitulo} (${doGrupo.length} cliente${doGrupo.length > 1 ? 's' : ''})
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:8.5pt; page-break-inside: auto;">
            <thead style="display: table-header-group;">
              <tr style="background:#f1f5f9; text-align:left; page-break-inside: avoid; break-inside: avoid;">
                <th style="border:1px solid #cbd5e1; padding:5px; width:36px; text-align:center;"> Fila </th>
                <th style="border:1px solid #cbd5e1; padding:5px;"> Cliente / CPF </th>
                <th style="border:1px solid #cbd5e1; padding:5px;"> Enquadramento & Envolvidos </th>
                <th style="border:1px solid #cbd5e1; padding:5px;"> C/C & Visita </th>
                <th style="border:1px solid #cbd5e1; padding:5px;"> Pendências / Observações </th>
              </tr>
            </thead>
            <tbody>
      `;

      doGrupo.forEach((r) => {
        const it = r.item;
        const envTxt = [
          it.conjugeNome ? `Cônjuge: ${it.conjugeNome} (${it.cadastroConjugeOk})` : 'Sem Cônjuge',
          it.procuradorNome
            ? `Proc.: ${it.procuradorNome} (${it.cadastroProcuradorOk})`
            : 'Sem Procurador',
        ].join(' • ');

        htmlGrupos += `
          <tr style="page-break-inside: avoid; break-inside: avoid;">
            <td style="border:1px solid #cbd5e1; padding:5px; text-align:center; font-weight:bold; font-size:9.5pt; color:${estilo.texto};">
              ${posGeral++}º
            </td>
            <td style="border:1px solid #cbd5e1; padding:5px;">
              <strong>${it.nomeCliente.toUpperCase()}</strong><br/>
              <span style="color:#475569;">CPF: ${it.cpfCliente || '-'}</span>
            </td>
            <td style="border:1px solid #cbd5e1; padding:5px;">
              <strong>${r.subgrupoDescricao}</strong><br/>
              <span style="color:#475569; font-size:8pt;">${envTxt}</span>
            </td>
            <td style="border:1px solid #cbd5e1; padding:5px;">
              C/C: <strong>${it.contaCorrente || 'Não aberta'}</strong><br/>
              Visitado: <strong>${it.visitado}</strong>
            </td>
            <td style="border:1px solid #cbd5e1; padding:5px; color:${
              r.resumoPendencias.length > 0 ? '#b91c1c' : '#15803d'
            };">
              ${
                r.resumoPendencias.length > 0
                  ? r.resumoPendencias.join('<br/>')
                  : '✔ Pronto para encaminhamento'
              }
            </td>
          </tr>
        `;
      });

      htmlGrupos += `</tbody></table></div>`;
    });

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
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#1e293b; color:#fff; padding:10px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; border-radius:6px;">
    <span>🏆 <strong>${listaAtiva.nomeLista.toUpperCase()} — RELATÓRIO DE PRIORIDADES PRONAF A</strong></span>
    <button onclick="window.print()" style="background:#dc2626; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>
  </div>
  <div style="border-bottom:2px solid #8B1530; padding-bottom:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:flex-end;">
    <div>
      <h2 style="margin:0; color:#8B1530; font-size:13pt;">ORDEM DE PRIORIDADE E CONFORMIDADE CADASTRAL — PRONAF A (${listaAtiva.nomeLista})</h2>
      <span style="font-size:8.5pt; color:#475569;">Classificação Automática por Grupos (1 a 4), Vínculos (Cônjuge/Procurador) e Nível de Restrições</span>
    </div>
    <span style="font-size:8.5pt; font-weight:bold; color:#334155;">Data: ${getHojeBR()} • Total: ${rankingClassificado.length} clientes</span>
  </div>
  ${htmlGrupos}
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
  </script>
</body>
</html>`);
    jan.document.close();
  };

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        zIndex: 20000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '97vw',
          height: '94vh',
          borderRadius: '12px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #8B1530',
        }}
      >
        {/* CABEÇALHO DO MODAL + GERENCIADOR DE LISTAS SALVAS */}
        <div
          style={{
            padding: '12px 22px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15.5px', color: '#8B1530', fontWeight: 800 }}>
                  🎯 CONFORMIDADE CADASTRAL — PRONAF A
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: statusSyncNuvem === 'SINCRONIZADO' ? '#dcfce7' : '#fef9c3',
                    color: statusSyncNuvem === 'SINCRONIZADO' ? '#15803d' : '#854d0e',
                  }}
                >
                  {statusSyncNuvem === 'SINCRONIZADO'
                    ? '☁️ Sincronizado no Servidor'
                    : '⏳ Salvando...'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Suas listas ficam salvas permanentemente no servidor e nunca são zeradas sozinhas.
              </span>
            </div>

            {/* SELETOR DE MÚLTIPLAS LISTAS SALVAS */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '5px 10px',
                borderRadius: '8px',
              }}
            >
              <strong style={{ fontSize: '11.5px', color: '#334155', whiteSpace: 'nowrap' }}>
                📂 Lista Salva:
              </strong>
              <select
                value={listaAtiva.id}
                onChange={(e) => setListaAtivaId(e.target.value)}
                style={{
                  width: 'auto',
                  minWidth: '210px',
                  height: '30px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#8B1530',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0 8px',
                }}
              >
                {listasSalvas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nomeLista} ({l.itens.filter((x) => x.nomeCliente.trim() !== '').length}{' '}
                    clientes)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCriarNovaLista}
                title="Criar uma nova lista de conferência em branco"
                style={{
                  width: 'auto',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ➕ Nova Lista
              </button>

              <button
                type="button"
                onClick={handleRenomearListaAtiva}
                title="Renomear a lista selecionada"
                style={{
                  width: 'auto',
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                ✏️
              </button>

              <button
                type="button"
                onClick={handleExcluirListaAtiva}
                title="Excluir esta lista inteira permanentemente"
                style={{
                  width: 'auto',
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                🗑️ Excluir Lista
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setAbaAtiva('PLANILHA')}
              style={{
                width: 'auto',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: abaAtiva === 'PLANILHA' ? '#8B1530' : '#ffffff',
                color: abaAtiva === 'PLANILHA' ? '#ffffff' : '#334155',
                cursor: 'pointer',
              }}
            >
              📋 1. Planilha (14 Colunas) ({itens.length})
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('RANKING')}
              style={{
                width: 'auto',
                padding: '7px 16px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #15803d',
                background: abaAtiva === 'RANKING' ? '#15803d' : '#f0fdf4',
                color: abaAtiva === 'RANKING' ? '#ffffff' : '#15803d',
                cursor: 'pointer',
              }}
            >
              🏆 2. Fila de Prioridades ({rankingClassificado.length})
            </button>

            <button
              type="button"
              onClick={exportarRelatorioPrioridadesPDF}
              style={{
                width: 'auto',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid #dc2626',
                background: '#fef2f2',
                color: '#dc2626',
                cursor: 'pointer',
              }}
            >
              🖨️ Exportar PDF
            </button>

            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0 6px',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* ABA 1: PLANILHA DE CONFERÊNCIA COM AS 14 COLUNAS OFICIAIS           */}
        {/* =================================================================== */}
        {abaAtiva === 'PLANILHA' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Barra de Ações da Planilha + Botões Excel (.XLSX) */}
            <div
              style={{
                padding: '10px 22px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => salvarItensDaListaAtiva([...itens, criarLinhaVazia()])}
                  style={{
                    width: 'auto',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#8B1530',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Adicionar Cliente
                </button>

                <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 2px' }} />

                {/* 3 BOTÕES EXCEL: IMPORTAR LISTA, EXPORTAR LISTA E EXPORTAR MODELO */}
                <input
                  ref={inputImportarExcelRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleImportarArquivoExcel}
                />

                <button
                  type="button"
                  onClick={() => inputImportarExcelRef.current?.click()}
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    background: '#dcfce7',
                    color: '#166534',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  title="Importar uma planilha Excel (.xlsx) preenchida com os clientes"
                >
                  📥 Importar Lista (.XLSX)
                </button>

                <button
                  type="button"
                  onClick={exportarListaAtivaParaExcel}
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  title="Exportar esta lista e o ranking de prioridades diretamente para o Excel (.xlsx)"
                >
                  📊 Exportar Lista (.XLSX)
                </button>

                <button
                  type="button"
                  onClick={exportarModeloExcel14Colunas}
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    background: '#fef9c3',
                    color: '#854d0e',
                    border: '1px solid #fde047',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  title="Baixar a planilha modelo em branco com as 14 colunas exatas para preencher no Excel e importar depois"
                >
                  📄 Exportar Modelo (.XLSX)
                </button>

                <button
                  type="button"
                  onClick={() => setModalColarAberto(true)}
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  📋 Colar Texto Rápido
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#475569' }}>
                💡 PEFIN comercial (CAEMA, Equatorial) ={' '}
                <b style={{ color: '#b45309' }}>Leve</b> • REFIN / Bancos ={' '}
                <b style={{ color: '#dc2626' }}>Grave</b>
              </div>
            </div>

            {/* Tabela Rolável com as 14 Colunas */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px', background: '#f8fafc' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '2150px',
                  borderCollapse: 'collapse',
                  background: '#ffffff',
                  fontSize: '11.5px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <thead>
                  <tr style={{ background: '#1e293b', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px', width: '32px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '8px 6px', width: '210px' }}>1. Nome do Cliente</th>
                    <th style={{ padding: '8px 6px', width: '125px' }}>2. CPF do Cliente</th>
                    <th style={{ padding: '8px 6px', width: '95px' }}>3. Visitado?</th>
                    <th style={{ padding: '8px 6px', width: '130px' }}>4. Cadastro OK?</th>
                    <th style={{ padding: '8px 6px', width: '105px' }}>5. Data Ref. Cad.</th>
                    <th style={{ padding: '8px 6px', width: '240px' }}>
                      6. Restrição CI? (Nível + Detalhe)
                    </th>
                    <th style={{ padding: '8px 6px', width: '115px' }}>7. C/C Aberta? (Nº)</th>
                    <th style={{ padding: '8px 6px', width: '180px', background: '#0f172a' }}>
                      8. Cônjuge / Comp.
                    </th>
                    <th style={{ padding: '8px 6px', width: '125px', background: '#0f172a' }}>
                      9. CPF Cônjuge
                    </th>
                    <th style={{ padding: '8px 6px', width: '135px', background: '#0f172a' }}>
                      10. Cad. Cônjuge OK?
                    </th>
                    <th style={{ padding: '8px 6px', width: '210px', background: '#0f172a' }}>
                      11. Restrição Cônjuge CI?
                    </th>
                    <th style={{ padding: '8px 6px', width: '175px', background: '#334155' }}>
                      12. Nome Procurador
                    </th>
                    <th style={{ padding: '8px 6px', width: '125px', background: '#334155' }}>
                      13. CPF Procurador
                    </th>
                    <th style={{ padding: '8px 6px', width: '220px', background: '#334155' }}>
                      14. Cad. & Restrição Procurador
                    </th>
                    <th style={{ padding: '8px 6px', width: '80px', textAlign: 'center' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td
                        style={{
                          padding: '6px',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#64748b',
                        }}
                      >
                        {idx + 1}
                      </td>

                      <td style={{ padding: '5px' }}>
                        <input
                          type="text"
                          value={it.nomeCliente}
                          onChange={(e) =>
                            atualizarCampo(idx, 'nomeCliente', e.target.value)
                          }
                          placeholder="NOME COMPLETO..."
                          style={{ height: '30px', fontSize: '11.5px', fontWeight: 700 }}
                        />
                      </td>

                      <td style={{ padding: '5px' }}>
                        <input
                          type="text"
                          value={it.cpfCliente}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'cpfCliente',
                              aplicarMascaraCPF(e.target.value)
                            )
                          }
                          placeholder="000.000.000-00"
                          maxLength={14}
                          style={{ height: '30px', fontSize: '11.5px' }}
                        />
                      </td>

                      <td style={{ padding: '5px' }}>
                        <select
                          value={it.visitado}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'visitado',
                              e.target.value as StatusVisitado
                            )
                          }
                          style={{ height: '30px', fontSize: '11px' }}
                        >
                          <option value="SIM">SIM</option>
                          <option value="NAO">NÃO</option>
                          <option value="PENDENTE">PENDENTE</option>
                        </select>
                      </td>

                      <td style={{ padding: '5px' }}>
                        <select
                          value={it.cadastroClienteOk}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'cadastroClienteOk',
                              e.target.value as StatusCadastroPessoa
                            )
                          }
                          style={{
                            height: '30px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background:
                              it.cadastroClienteOk === 'OK'
                                ? '#dcfce7'
                                : it.cadastroClienteOk === 'A_RENOVAR'
                                ? '#dbeafe'
                                : '#fef3c7',
                            color:
                              it.cadastroClienteOk === 'OK'
                                ? '#15803d'
                                : it.cadastroClienteOk === 'A_RENOVAR'
                                ? '#1d4ed8'
                                : '#b45309',
                          }}
                        >
                          <option value="OK">OK (Atualizado)</option>
                          <option value="A_RENOVAR">A RENOVAR</option>
                          <option value="A_ELABORAR">A ELABORAR</option>
                        </select>
                      </td>

                      <td style={{ padding: '5px' }}>
                        <input
                          type="text"
                          value={it.dataRefCadastral}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'dataRefCadastral',
                              aplicarMascaraDataBR(e.target.value)
                            )
                          }
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          style={{ height: '30px', fontSize: '11px' }}
                        />
                      </td>

                      <td style={{ padding: '5px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <select
                            value={it.restricaoClienteNivel}
                            onChange={(e) =>
                              atualizarCampo(
                                idx,
                                'restricaoClienteNivel',
                                e.target.value as NivelRestricaoCI
                              )
                            }
                            style={{
                              width: '105px',
                              height: '30px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              background:
                                it.restricaoClienteNivel === 'SEM_RESTRICAO'
                                  ? '#f8fafc'
                                  : it.restricaoClienteNivel === 'LEVE'
                                  ? '#fef3c7'
                                  : '#fee2e2',
                              color:
                                it.restricaoClienteNivel === 'SEM_RESTRICAO'
                                  ? '#334155'
                                  : it.restricaoClienteNivel === 'LEVE'
                                  ? '#b45309'
                                  : '#dc2626',
                            }}
                          >
                            <option value="SEM_RESTRICAO">Sem Restr.</option>
                            <option value="LEVE">Leve (PEFIN)</option>
                            <option value="GRAVE">Grave (REFIN)</option>
                          </select>
                          <input
                            type="text"
                            value={it.restricaoClienteDetalhe}
                            onChange={(e) => {
                              const txt = e.target.value;
                              const copia = [...itens];
                              copia[idx] = {
                                ...copia[idx],
                                restricaoClienteDetalhe: txt,
                                restricaoClienteNivel: detectarNivelRestricaoPorTexto(txt),
                              };
                              salvarItensDaListaAtiva(copia);
                            }}
                            placeholder="Ex: CAEMA / REFIN..."
                            style={{ flex: 1, height: '30px', fontSize: '11px' }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: '5px' }}>
                        <input
                          type="text"
                          value={it.contaCorrente}
                          onChange={(e) =>
                            atualizarCampo(idx, 'contaCorrente', e.target.value)
                          }
                          placeholder="Nº C/C ou NÃO"
                          style={{ height: '30px', fontSize: '11px' }}
                        />
                      </td>

                      <td style={{ padding: '5px', background: '#f8fafc' }}>
                        <input
                          type="text"
                          value={it.conjugeNome}
                          onChange={(e) =>
                            atualizarCampo(idx, 'conjugeNome', e.target.value)
                          }
                          placeholder="Vazio = Sem cônjuge"
                          style={{ height: '30px', fontSize: '11px' }}
                        />
                      </td>

                      <td style={{ padding: '5px', background: '#f8fafc' }}>
                        <input
                          type="text"
                          value={it.conjugeCpf}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'conjugeCpf',
                              aplicarMascaraCPF(e.target.value)
                            )
                          }
                          placeholder="000.000.000-00"
                          maxLength={14}
                          style={{ height: '30px', fontSize: '11px' }}
                        />
                      </td>

                      <td style={{ padding: '5px', background: '#f8fafc' }}>
                        <select
                          value={it.cadastroConjugeOk}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'cadastroConjugeOk',
                              e.target.value as StatusCadastroOpcional
                            )
                          }
                          style={{ height: '30px', fontSize: '10.5px' }}
                        >
                          <option value="NAO_SE_APLICA">Não se aplica</option>
                          <option value="OK">OK</option>
                          <option value="A_RENOVAR">A RENOVAR</option>
                          <option value="A_ELABORAR">A ELABORAR</option>
                        </select>
                      </td>

                      <td style={{ padding: '5px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <select
                            value={it.restricaoConjugeNivel}
                            onChange={(e) =>
                              atualizarCampo(
                                idx,
                                'restricaoConjugeNivel',
                                e.target.value as NivelRestricaoCI
                              )
                            }
                            style={{ width: '95px', height: '30px', fontSize: '10.5px' }}
                          >
                            <option value="SEM_RESTRICAO">Sem Restr.</option>
                            <option value="LEVE">Leve</option>
                            <option value="GRAVE">Grave</option>
                          </select>
                          <input
                            type="text"
                            value={it.restricaoConjugeDetalhe}
                            onChange={(e) => {
                              const txt = e.target.value;
                              const copia = [...itens];
                              copia[idx] = {
                                ...copia[idx],
                                restricaoConjugeDetalhe: txt,
                                restricaoConjugeNivel: detectarNivelRestricaoPorTexto(txt),
                              };
                              salvarItensDaListaAtiva(copia);
                            }}
                            placeholder="Detalhe..."
                            style={{ flex: 1, height: '30px', fontSize: '11px' }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: '5px' }}>
                        <input
                          type="text"
                          value={it.procuradorNome}
                          onChange={(e) =>
                            atualizarCampo(idx, 'procuradorNome', e.target.value)
                          }
                          placeholder="Vazio = Sem proc."
                          style={{ height: '30px', fontSize: '11px' }}
                        />
                      </td>

                      <td style={{ padding: '5px' }}>
                        <input
                          type="text"
                          value={it.procuradorCpf}
                          onChange={(e) =>
                            atualizarCampo(
                              idx,
                              'procuradorCpf',
                              aplicarMascaraCPF(e.target.value)
                            )
                          }
                          placeholder="000.000.000-00"
                          maxLength={14}
                          style={{ height: '30px', fontSize: '11px' }}
                        />
                      </td>

                      <td style={{ padding: '5px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <select
                            value={it.cadastroProcuradorOk}
                            onChange={(e) =>
                              atualizarCampo(
                                idx,
                                'cadastroProcuradorOk',
                                e.target.value as StatusCadastroOpcional
                              )
                            }
                            style={{ width: '105px', height: '30px', fontSize: '10.5px' }}
                          >
                            <option value="NAO_SE_APLICA">Não se aplica</option>
                            <option value="OK">Cad. OK</option>
                            <option value="A_RENOVAR">A RENOVAR</option>
                            <option value="A_ELABORAR">A ELABORAR</option>
                          </select>
                          <select
                            value={it.restricaoProcuradorNivel}
                            onChange={(e) =>
                              atualizarCampo(
                                idx,
                                'restricaoProcuradorNivel',
                                e.target.value as NivelRestricaoCI
                              )
                            }
                            style={{ flex: 1, height: '30px', fontSize: '10.5px' }}
                          >
                            <option value="SEM_RESTRICAO">Sem Restr.</option>
                            <option value="LEVE">Restr. Leve</option>
                            <option value="GRAVE">Restr. Grave</option>
                          </select>
                        </div>
                      </td>

                      <td style={{ padding: '5px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() =>
                            salvarItensDaListaAtiva(
                              itens.length > 1
                                ? itens.filter((_, i) => i !== idx)
                                : [criarLinhaVazia()]
                            )
                          }
                          style={{
                            width: 'auto',
                            padding: '4px 8px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Remover este cliente da lista"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 2: RELATÓRIO FINAL DE PRIORIDADES (GRUPOS 1 A 4) + ENCAMINHAR   */}
        {/* =================================================================== */}
        {abaAtiva === 'RANKING' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', background: '#f1f5f9' }}>
            {rankingClassificado.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  padding: '30px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                Nenhum cliente preenchido nesta lista ainda. Volte à aba{' '}
                <b>1. Planilha (14 Colunas)</b> para inserir ou importar do Excel!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {([1, 2, 3, 4] as const).map((numGrupo) => {
                  const listaDoGrupo = rankingClassificado.filter(
                    (r) => r.grupoNumero === numGrupo
                  );
                  if (listaDoGrupo.length === 0) return null;

                  const paleta =
                    numGrupo === 1
                      ? { cor: '#15803d', bg: '#f0fdf4', borda: '#86efac' }
                      : numGrupo === 2
                      ? { cor: '#1d4ed8', bg: '#eff6ff', borda: '#93c5fd' }
                      : numGrupo === 3
                      ? { cor: '#b45309', bg: '#fffbeb', borda: '#fcd34d' }
                      : { cor: '#dc2626', bg: '#fef2f2', borda: '#fca5a5' };

                  return (
                    <div
                      key={numGrupo}
                      style={{
                        background: '#ffffff',
                        border: `1px solid ${paleta.borda}`,
                        borderLeft: `6px solid ${paleta.cor}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          background: paleta.bg,
                          padding: '10px 16px',
                          borderBottom: `1px solid ${paleta.borda}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <strong style={{ fontSize: '13.5px', color: paleta.cor }}>
                          {listaDoGrupo[0].grupoTitulo}
                        </strong>
                        <span
                          style={{
                            background: paleta.cor,
                            color: '#fff',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                          }}
                        >
                          {listaDoGrupo.length} proposta(s)
                        </span>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                            <th style={{ padding: '10px 12px', width: '65px', textAlign: 'center' }}>
                              Prioridade
                            </th>
                            <th style={{ padding: '10px 12px' }}>Cliente / CPF</th>
                            <th style={{ padding: '10px 12px' }}>Critério de Enquadramento</th>
                            <th style={{ padding: '10px 12px' }}>C/C & Visita</th>
                            <th style={{ padding: '10px 12px' }}>Diagnóstico / Pendências</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', width: '215px' }}>
                              Ação no Painel / Kanban
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {listaDoGrupo.map((res) => {
                            const posGeral =
                              rankingClassificado.findIndex(
                                (x) => x.item.id === res.item.id
                              ) + 1;
                            const { item } = res;

                            return (
                              <tr
                                key={item.id}
                                style={{ borderBottom: '1px solid #f1f5f9' }}
                              >
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      background: paleta.cor,
                                      color: '#fff',
                                      fontWeight: 800,
                                      fontSize: '12px',
                                      padding: '4px 10px',
                                      borderRadius: '14px',
                                    }}
                                  >
                                    {posGeral}º
                                  </span>
                                </td>

                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '12.5px' }}>
                                    {item.nomeCliente.toUpperCase()}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    CPF: {item.cpfCliente || 'Não informado'}
                                  </div>
                                </td>

                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 700, color: paleta.cor }}>
                                    Subgrupo {res.grupoNumero}.{res.subgrupoOrdem}:{' '}
                                    {res.subgrupoDescricao}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                                    {item.conjugeNome
                                      ? `👥 Cônjuge: ${item.conjugeNome.toUpperCase()} (${item.cadastroConjugeOk})`
                                      : '👤 Sem Cônjuge'}{' '}
                                    •{' '}
                                    {item.procuradorNome
                                      ? `📝 Proc.: ${item.procuradorNome.toUpperCase()} (${item.cadastroProcuradorOk})`
                                      : 'Sem Procurador'}
                                  </div>
                                </td>

                                <td style={{ padding: '10px 12px', fontSize: '11.5px' }}>
                                  <div>
                                    <b>C/C:</b> {item.contaCorrente || 'Não aberta'}
                                  </div>
                                  <div>
                                    <b>Visitado:</b> {item.visitado}
                                  </div>
                                </td>

                                <td style={{ padding: '10px 12px', fontSize: '11px' }}>
                                  {res.resumoPendencias.length === 0 ? (
                                    <span
                                      style={{
                                        color: '#15803d',
                                        fontWeight: 700,
                                        background: '#dcfce7',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      ✔ 100% OK — Pronta p/ sair
                                    </span>
                                  ) : (
                                    <div style={{ color: '#b91c1c', fontWeight: 600 }}>
                                      {res.resumoPendencias.map((p, i) => (
                                        <div key={i}>• {p}</div>
                                      ))}
                                    </div>
                                  )}
                                </td>

                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  {res.jaCadastradoNoPainel ? (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        background: '#e2e8f0',
                                        color: '#334155',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                      }}
                                    >
                                      ✅ Já Cadastrado no Painel
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalIniciarProposta(res)}
                                      style={{
                                        width: 'auto',
                                        padding: '7px 12px',
                                        fontSize: '11.5px',
                                        fontWeight: 800,
                                        background: '#8B1530',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 5px rgba(139,21,48,0.25)',
                                      }}
                                    >
                                      🚀 Iniciar Proposta PRONAF A
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUB-MODAL: COLAR LISTA EM LOTE */}
      {modalColarAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 20000010,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '10px',
              width: '620px',
              maxWidth: '94%',
              boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
            }}
          >
            <h4 style={{ margin: '0 0 6px 0', color: '#8B1530' }}>
              📋 Colar Texto Rápido (Linhas do Excel ou Nome + CPF)
            </h4>
            <textarea
              rows={9}
              value={textoColagemMassa}
              onChange={(e) => setTextoColagemMassa(e.target.value)}
              placeholder={`Exemplo:\nMARIA JOSÉ DA SILVA\t012.345.678-90\nJOÃO BATISTA PEREIRA - 123.456.789-00`}
              style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setModalColarAberto(false)}
                style={{ width: 'auto', padding: '7px 14px', background: '#e2e8f0', color: '#334155', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={processarColagemEmLote}
                style={{ width: 'auto', padding: '7px 18px', background: '#8B1530', color: '#fff', fontSize: '12px', fontWeight: 700 }}
              >
                ✔ Adicionar à Lista Atual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: CADASTRAR NOVA OPERAÇÃO PRONAF A */}
      {itemParaCadastro && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 20000020,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '22px',
              borderRadius: '10px',
              width: '680px',
              maxWidth: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderTop: '5px solid #8B1530',
              boxShadow: '0 20px 45px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#8B1530', fontSize: '15.5px' }}>
                  🚀 INICIAR PROPOSTA PRONAF A (CADASTRAR NO PAINEL & KANBAN)
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  O cliente será inserido em <b>1. Contratações</b> e criará um Card na etapa <b>📂 CADASTROS</b> do Kanban.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setItemParaCadastro(null)}
                style={{ width: 'auto', background: 'none', border: 'none', fontSize: '22px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.2fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Porte</label>
                <input type="text" value="PRONAF A" disabled style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800 }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Cliente</label>
                <input type="text" value={itemParaCadastro.item.nomeCliente.toUpperCase()} disabled style={{ background: '#f8fafc', fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>CPF</label>
                <input type="text" value={itemParaCadastro.item.cpfCliente} disabled style={{ background: '#f8fafc' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Tipo de Operação</label>
                <select value={cadTipo} onChange={(e) => setCadTipo(e.target.value)}>
                  <option value="Investimento">Investimento</option>
                  <option value="Custeio">Custeio</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#8B1530' }}>
                  Valor da Proposta (R$) *
                </label>
                <input
                  type="text"
                  value={cadValor}
                  onChange={(e) => setCadValor(aplicarMascaraMoedaInput(e.target.value))}
                  placeholder="Ex: 55.000,00"
                  autoFocus
                  style={{ fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Projetista</label>
                <input
                  type="search"
                  list="dl_proj_conf_pronafa"
                  value={cadProjetista}
                  onChange={(e) => setCadProjetista(e.target.value)}
                  placeholder="Ex: DEIMID / PEDRO"
                />
                <datalist id="dl_proj_conf_pronafa">
                  {LISTA_PROJETISTAS_CURTOS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Situação Inicial</label>
                <select value={cadSituacao} onChange={(e) => setCadSituacao(e.target.value)}>
                  <option value="Com Cliente/Projetista">Com Cliente/Projetista</option>
                  <option value="Na Agência">Na Agência (AG)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#8B1530' }}>
                  📊 SITUAÇÃO (Gerada da Conferência p/ o Card)
                </label>
                <textarea
                  rows={4}
                  value={cadSitDetalhada}
                  onChange={(e) => setCadSitDetalhada(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>
                  📝 PENDÊNCIAS / OBSERVAÇÕES (Geradas da Conferência)
                </label>
                <textarea
                  rows={4}
                  value={cadObsPendencias}
                  onChange={(e) => setCadObsPendencias(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.9fr 1.5fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Responsável BNB</label>
                <input
                  type="text"
                  value={cadResponsavel}
                  onChange={(e) => setCadResponsavel(e.target.value)}
                  placeholder="Analista"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Telefone Cliente</label>
                <input
                  type="text"
                  value={cadTelefone}
                  onChange={(e) => setCadTelefone(e.target.value)}
                  placeholder="(98) 99999-9999"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>Data</label>
                <input
                  type="text"
                  value={cadData}
                  onChange={(e) => setCadData(aplicarMascaraDataBR(e.target.value))}
                  maxLength={10}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>📑 Programa</label>
                <input
                  type="search"
                  list="dl_prog_conf_pronafa"
                  value={cadPrograma}
                  onChange={(e) => setCadPrograma(e.target.value)}
                />
                <datalist id="dl_prog_conf_pronafa">
                  {listaProgramas.map((pr) => (
                    <option key={pr} value={pr} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setItemParaCadastro(null)}
                style={{ width: 'auto', padding: '8px 16px', background: '#e2e8f0', color: '#334155', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCadastroPropostaNoPainel}
                style={{ width: 'auto', padding: '8px 20px', background: '#8B1530', color: '#ffffff', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}
              >
                💾 Cadastrar em Contratações & Criar Card em Cadastros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}