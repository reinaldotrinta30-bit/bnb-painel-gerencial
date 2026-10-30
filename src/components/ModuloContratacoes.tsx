'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { RegistroContratacao, CardKanban } from '@/types/painel';
import { localizarCardDoClienteNoKanban } from '@/lib/integradorSincronizado';
import {
  META_PRONAF,
  META_MINI,
  LISTA_PROJETISTAS_CURTOS,
  parseMoeda,
  formatarMoedaBD,
  aplicarMascaraCPF,
  aplicarMascaraMoedaInput,
  aplicarMascaraDataBR,
  formatarMoedaExcel,
  formatarDataExcel,
  obterListaProgramas,
  isEnquadradoCadaVezMelhor,
  classificarCategoriaPorte,
  htmlKanbanParaTextoLimpo,
} from '@/lib/utils';

interface ModuloContratacoesProps {
  registros: RegistroContratacao[];
  cardsKanban: CardKanban[];
  onAtualizarRegistros: (novos: RegistroContratacao[]) => void;
  onRegistroSalvoSincronizar?: (
    reg: RegistroContratacao,
    listaCompleta: RegistroContratacao[]
  ) => void;
  onInspecionarNoKanban?: (reg: RegistroContratacao) => void;
  focoExternoContratacao?: {
    propostaId?: string;
    cliente?: string;
    cpf?: string;
  } | null;
  onLimparFocoExterno?: () => void;
}

export default function ModuloContratacoes({
  registros,
  cardsKanban,
  onAtualizarRegistros,
  onRegistroSalvoSincronizar,
  onInspecionarNoKanban,
  focoExternoContratacao,
  onLimparFocoExterno,
}: ModuloContratacoesProps) {
  const [abaAtiva, setAbaAtiva] = useState<'dash' | 'dados'>('dash');

  // Estados dos Filtros do Dashboard Analítico
  const [dashFiltroCliente, setDashFiltroCliente] = useState('');
  const [dashFiltroPorte, setDashFiltroPorte] = useState<string[]>([]);
  const [dashFiltroTipo, setDashFiltroTipo] = useState<string[]>([]);
  const [dashFiltroSituacao, setDashFiltroSituacao] = useState<string[]>([]);
  const [dashFiltroProjetista, setDashFiltroProjetista] = useState<string[]>([]);

  // Estados do Formulário CRUD (Base de Dados & Cadastro)
  const [idRegistro, setIdRegistro] = useState('');
  const [porte, setPorte] = useState('');
  const [cliente, setCliente] = useState('');
  const [cpf, setCpf] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('');
  const [situacao, setSituacao] = useState('');
  const [situacaoDetalhada, setSituacaoDetalhada] = useState('');
  const [projetista, setProjetista] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [dataSit, setDataSit] = useState('');
  const [telefone, setTelefone] = useState('');
  const [obs, setObs] = useState('');
  const [programa, setPrograma] = useState('');
  const listaProgramas = useMemo(() => obterListaProgramas(), []);

  // ITEM 5 e 5.1: Lê em tempo real as Metas e o Realizado Efetivo do Banco configurados na Planilha da Carteira
  const [paramsBancoOficial, setParamsBancoOficial] = useState({
    pronafRealizadoOficial: 986005.0,
    pronafMetaPeriodo: 2801400.0,
    pronafMetaAnual: META_PRONAF,
    miniRealizadoOficial: 287348.0,
    miniMetaPeriodo: 2090700.0,
    miniMetaAnual: META_MINI,
    cvmRealizadoOficial: 80172.0,
    cvmMetaPeriodo: 1027341.0,
    cvmMetaAnual: 1488900.0,
  });

  useEffect(() => {
    const carregarParamsCarteira = () => {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem('bnb_v2_parametros_oficiais_carteira');
        if (raw) {
          setParamsBancoOficial((prev) => ({ ...prev, ...JSON.parse(raw) }));
        }
      } catch {
        // Ignora erro de leitura
      }
    };
    carregarParamsCarteira();
    window.addEventListener('bnb_parametros_carteira_atualizados', carregarParamsCarteira);
    window.addEventListener('storage', carregarParamsCarteira);
    return () => {
      window.removeEventListener('bnb_parametros_carteira_atualizados', carregarParamsCarteira);
      window.removeEventListener('storage', carregarParamsCarteira);
    };
  }, []);

  // Estados de Garantia para exibição didática no Card do Kanban (Oculto para PRONAF A)
  const [tipoGarantiaKanban, setTipoGarantiaKanban] = useState<
    'NENHUMA' | 'AVAL' | 'LCGH' | 'LCGA'
  >('NENHUMA');
  const [avalistaNome, setAvalistaNome] = useState('');
  const [avalistaCpf, setAvalistaCpf] = useState('');
  const [lcgValor, setLcgValor] = useState('');
  const [lcgSituacao, setLcgSituacao] = useState('');

  // Estados dos Filtros da Tabela de Registros Salvos
  const [tbFiltroCliente, setTbFiltroCliente] = useState('');
  const [tbFiltroCpf, setTbFiltroCpf] = useState('');
  const [tbFiltroProj, setTbFiltroProj] = useState('');
  const [tbFiltroResp, setTbFiltroResp] = useState('');
  const [tbFiltroPorte, setTbFiltroPorte] = useState<string[]>([]);
  const [tbFiltroTipo, setTbFiltroTipo] = useState<string[]>([]);
  const [tbFiltroSituacao, setTbFiltroSituacao] = useState<string[]>([]);

  // Filtro de Data Flutuante
  const [popupDataAberto, setPopupDataAberto] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDataDisplay, setFiltroDataDisplay] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  // Ordenação da Tabela
  const [ordem, setOrdem] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
    coluna: '',
    direcao: 'asc',
  });

  // Refs para inputs de arquivos ocultos
  const inputJsonRef = useRef<HTMLInputElement>(null);
  const inputExcelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupDataAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clientesUnicos = useMemo(() => {
    return Array.from(new Set(registros.map((r) => r.cliente).filter(Boolean))).sort();
  }, [registros]);

  const projetistasUnicos = useMemo(() => {
    return Array.from(
      new Set(registros.map((r) => (r.projetista || '').toUpperCase()).filter(Boolean))
    ).sort();
  }, [registros]);

  const renderBadgeStatus = (status: string) => {
    switch (status) {
      case 'Contratado':
        return (
          <span style={{ background: '#e6f4ea', color: '#137333', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #a8dab5' }}>
            {status}
          </span>
        );
      case 'Na Central':
        return (
          <span style={{ background: '#fef7e0', color: '#b06000', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #fde293' }}>
            {status}
          </span>
        );
      case 'Devolvido AG':
        return (
          <span style={{ background: '#fff3e0', color: '#e65100', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #ffb74d' }}>
            {status}
          </span>
        );
      case 'Na Agência':
        return (
          <span style={{ background: '#e8f0fe', color: '#1967d2', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #a8c7fa' }}>
            {status}
          </span>
        );
      case 'Com Cliente/Projetista':
        return (
          <span style={{ background: '#fce8e6', color: '#c5221f', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #f1a8a2' }}>
            {status}
          </span>
        );
      default:
        return (
          <span style={{ background: '#f1f3f4', color: '#5f6368', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #dadce0' }}>
            {status}
          </span>
        );
    }
  };

  // =========================================================================
  // LÓGICA DO DASHBOARD ANALÍTICO
  // =========================================================================
  const dadosFiltradosDash = useMemo(() => {
    const busca = dashFiltroCliente.toUpperCase();
    return registros.filter((r) => {
      const matchCliente =
        !busca || (r.cliente || '').includes(busca) || (r.cpf || '').includes(busca);
      const catPorte = classificarCategoriaPorte(r.porte);
const matchPorte =
  dashFiltroPorte.length === 0 ||
  dashFiltroPorte.includes(r.porte) ||
  (dashFiltroPorte.includes('CADA VEZ MELHOR') && r.cadaVezMelhor) ||
  dashFiltroPorte.includes(catPorte) ||
  (catPorte === 'OUTROS' && dashFiltroPorte.includes('PEQUENO'));
      const matchTipo =
        dashFiltroTipo.length === 0 || dashFiltroTipo.includes(r.tipo);
      const matchSit =
        dashFiltroSituacao.length === 0 || dashFiltroSituacao.includes(r.situacao);
      const matchProj =
        dashFiltroProjetista.length === 0 ||
        dashFiltroProjetista.includes((r.projetista || '').toUpperCase());

      return matchCliente && matchPorte && matchTipo && matchSit && matchProj;
    });
  }, [
    registros,
    dashFiltroCliente,
    dashFiltroPorte,
    dashFiltroTipo,
    dashFiltroSituacao,
    dashFiltroProjetista,
  ]);

  const temFiltroDashAtivo =
    dashFiltroCliente.trim() !== '' ||
    dashFiltroPorte.length > 0 ||
    dashFiltroTipo.length > 0 ||
    dashFiltroSituacao.length > 0 ||
    dashFiltroProjetista.length > 0;

  const metricasDash = useMemo(() => {
    let volTotal = 0;
    let volContratadoSistema = 0;
    let volEstoque = 0;
    const mapStatus: Record<string, { v: number; q: number }> = {
      'Com Cliente/Projetista': { v: 0, q: 0 },
      'Na Agência': { v: 0, q: 0 },
      'Devolvido AG': { v: 0, q: 0 },
      'Na Central': { v: 0, q: 0 },
      Contratado: { v: 0, q: 0 },
    };

    dadosFiltradosDash.forEach((r) => {
      const v = parseMoeda(r.valor);
      const t = (r.tipo || '').toUpperCase();
      if (t !== 'LCGH' && t !== 'LCGA') {
        const isContratado = r.situacao === 'Contratado';
        const card = localizarCardDoClienteNoKanban(r, cardsKanban);
        const isArquivado = card?.statusCor === 'roxo';

        if (isContratado) {
          volTotal += v;
          volContratadoSistema += v;
          if (mapStatus[r.situacao]) {
            mapStatus[r.situacao].v += v;
            mapStatus[r.situacao].q += 1;
          }
        } else if (!isArquivado) {
          volTotal += v;
          volEstoque += v;
          if (mapStatus[r.situacao]) {
            mapStatus[r.situacao].v += v;
            mapStatus[r.situacao].q += 1;
          }
        }
      }
    });

    // ITEM 5 e 5.1: Cálculo do Realizado Efetivo do Banco e da Meta Oficial da Planilha da Carteira
    // Muda apenas conforme o filtro de Porte ("📑 Porte"), pois são parâmetros macro oficiais do Banco!
    const semFiltroPorte = dashFiltroPorte.length === 0;
    const temPronafGeral =
      semFiltroPorte ||
      dashFiltroPorte.includes('PRONAF V') ||
      dashFiltroPorte.includes('PRONAF A');
    const temCvmIsolado =
      !temPronafGeral && dashFiltroPorte.includes('CADA VEZ MELHOR');
    const temMini = semFiltroPorte || dashFiltroPorte.includes('MINI');

    let volContratadoBancoOficial = 0;
    let metaAplicavel = 0;

    if (temPronafGeral) {
      // O FNE PRONAF (Consolidado) da Planilha da Carteira já contempla PRONAF V + PRONAF A + CVM
      volContratadoBancoOficial += Number(paramsBancoOficial.pronafRealizadoOficial) || 0;
      metaAplicavel += Number(paramsBancoOficial.pronafMetaAnual) || META_PRONAF;
    } else if (temCvmIsolado) {
      volContratadoBancoOficial += Number(paramsBancoOficial.cvmRealizadoOficial) || 0;
      metaAplicavel += Number(paramsBancoOficial.cvmMetaAnual) || 0;
    }

    if (temMini) {
      volContratadoBancoOficial += Number(paramsBancoOficial.miniRealizadoOficial) || 0;
      metaAplicavel += Number(paramsBancoOficial.miniMetaAnual) || META_MINI;
    }

    // Gap Oficial do Banco (Meta da Planilha da Carteira - Realizado Oficial do Banco)
    const faltaContratarBancoOficial = Math.max(
      0,
      metaAplicavel - volContratadoBancoOficial
    );

    // Gap considerando apenas os contratos cadastrados no nosso sistema (respeita os filtros ativos)
    const faltaContratarSistema = Math.max(
      0,
      metaAplicavel - volContratadoSistema
    );

    const percMetaBancoOficial =
      metaAplicavel > 0
        ? Math.min(100, (volContratadoBancoOficial / metaAplicavel) * 100)
        : 0;

    const percMetaSistema =
      metaAplicavel > 0
        ? Math.min(100, (volContratadoSistema / metaAplicavel) * 100)
        : 0;

    let maxVolumeStatus = 0;
    Object.values(mapStatus).forEach((st) => {
      if (st.v > maxVolumeStatus) maxVolumeStatus = st.v;
    });

    return {
      volTotal,
      volContratado: volContratadoBancoOficial,
      volContratadoSistema,
      volEstoque,
      faltaContratar: faltaContratarBancoOficial,
      faltaContratarSistema,
      metaAplicavel,
      percMeta: percMetaBancoOficial,
      percMetaSistema,
      mapStatus,
      maxVolumeStatus,
    };
  }, [dadosFiltradosDash, dashFiltroPorte, cardsKanban, paramsBancoOficial]);

  // =========================================================================
  // LÓGICA DO FORMULÁRIO CRUD E TABELA DA BASE DE DADOS
  // =========================================================================
  const limparFormContratacao = () => {
    setIdRegistro('');
    setPorte('');
    setCliente('');
    setCpf('');
    setValor('');
    setTipo('');
    setSituacao('');
    setSituacaoDetalhada('');
    setProjetista('');
    setResponsavel('');
    setDataSit('');
    setTelefone('');
    setObs('');
    setPrograma('');
    setTipoGarantiaKanban('NENHUMA');
    setAvalistaNome('');
    setAvalistaCpf('');
    setLcgValor('');
    setLcgSituacao('');
  };

  const salvarRegistroContratacao = () => {
    if (!cliente.trim() || !valor.trim()) {
      alert('Preencha ao menos o Nome do Cliente e o Valor!');
      return;
    }

    const isPronafA = porte.toUpperCase().trim() === 'PRONAF A';

    const novoReg: RegistroContratacao = {
      id: idRegistro ? idRegistro : Date.now().toString(),
      porte,
      cliente: cliente.toUpperCase(),
      cpf,
      valor,
      tipo,
      situacao: situacao || 'Na Agência',
      situacaoDetalhada:
        situacaoDetalhada.trim() || `- ${situacao || 'Na Agência'}`,
      projetista: projetista.toUpperCase(),
      responsavel: responsavel.toUpperCase(),
      telefone,
      data: dataSit,
      obs,
      programa: programa.toUpperCase().trim(),
      cadaVezMelhor:
        porte.includes('PRONAF') && isEnquadradoCadaVezMelhor(programa),
      tipoGarantiaKanban: isPronafA ? 'NENHUMA' : tipoGarantiaKanban,
      avalistaNome:
        !isPronafA && tipoGarantiaKanban === 'AVAL'
          ? avalistaNome.toUpperCase()
          : undefined,
      avalistaCpf:
        !isPronafA && tipoGarantiaKanban === 'AVAL' ? avalistaCpf : undefined,
      lcgValor:
        !isPronafA &&
        (tipoGarantiaKanban === 'LCGH' || tipoGarantiaKanban === 'LCGA')
          ? lcgValor
          : undefined,
      lcgSituacao:
        !isPronafA &&
        (tipoGarantiaKanban === 'LCGH' || tipoGarantiaKanban === 'LCGA')
          ? lcgSituacao
          : undefined,
    };

    let novaLista: RegistroContratacao[];
    if (idRegistro) {
      novaLista = registros.map((r) => (r.id === idRegistro ? novoReg : r));
    } else {
      novaLista = [...registros, novoReg];
    }

    if (onRegistroSalvoSincronizar) {
      onRegistroSalvoSincronizar(novoReg, novaLista);
    } else {
      onAtualizarRegistros(novaLista);
    }

    limparFormContratacao();
    alert('✅ Registro salvo e Card atualizado no Kanban!');
  };

  const editarRegistroContratacao = (id: string) => {
    const reg = registros.find((r) => String(r.id) === String(id));
    if (!reg) return;
    setIdRegistro(reg.id);
    setPorte(reg.porte || '');
    setCliente(reg.cliente || '');
    setCpf(reg.cpf || '');
    setValor(reg.valor || '');
    setTipo(reg.tipo || '');
    setSituacao(reg.situacao || '');
    setSituacaoDetalhada(htmlKanbanParaTextoLimpo(reg.situacaoDetalhada || ''));
setProjetista(reg.projetista || '');
setResponsavel(reg.responsavel || '');
setTelefone(reg.telefone || '');
setDataSit(reg.data || '');
setObs(htmlKanbanParaTextoLimpo(reg.obs || ''));
    setPrograma(
      reg.programa || (reg.cadaVezMelhor ? 'PRONAF MULHER (406)' : '')
    );
    setTipoGarantiaKanban(reg.tipoGarantiaKanban || 'NENHUMA');
    setAvalistaNome(reg.avalistaNome || '');
    setAvalistaCpf(reg.avalistaCpf || '');
    setLcgValor(reg.lcgValor || '');
    setLcgSituacao(reg.lcgSituacao || '');
    setAbaAtiva('dados');
  };

  // ITEM 2: Quando acionado pelo botão do Kanban, abre "Base de Dados & Cadastro", filtra a tabela por Nome/CPF e abre o form em modo Edição!
  useEffect(() => {
    if (!focoExternoContratacao) return;
    setAbaAtiva('dados');

    // Filtra a tabela de Registros Salvos pelo Nome e CPF do cliente
    setTbFiltroCliente(focoExternoContratacao.cliente || '');
    setTbFiltroCpf(focoExternoContratacao.cpf || '');

    // Localiza o registro para preencher o formulário "INSERIR / EDITAR OPERAÇÃO"
    const regAlvo = registros.find(
      (r) =>
        (focoExternoContratacao.propostaId &&
          String(r.id) === String(focoExternoContratacao.propostaId)) ||
        (focoExternoContratacao.cpf && r.cpf === focoExternoContratacao.cpf) ||
        (focoExternoContratacao.cliente &&
          r.cliente.toUpperCase() ===
            focoExternoContratacao.cliente.toUpperCase())
    );

    if (regAlvo) {
      editarRegistroContratacao(regAlvo.id);
    }

    onLimparFocoExterno?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoExternoContratacao]);

  const excluirRegistroContratacao = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta operação?')) {
      const novaLista = registros.filter((r) => String(r.id) !== String(id));
      onAtualizarRegistros(novaLista);
    }
  };

  const alternarOrdenacao = (coluna: string) => {
    setOrdem((prev) => ({
      coluna,
      direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  };

  const dadosTabelaFiltradosEOrdenados = useMemo(() => {
    const fCli = tbFiltroCliente.toUpperCase();
    const fProj = tbFiltroProj.toUpperCase();
    const fResp = tbFiltroResp.toUpperCase();

    const filtrados = registros.filter((r) => {
      if (fCli && !(r.cliente || '').includes(fCli) && !(r.cpf || '').includes(fCli))
        return false;
      if (tbFiltroCpf && !(r.cpf || '').includes(tbFiltroCpf)) return false;
      if (fProj && !(r.projetista || '').toUpperCase().includes(fProj)) return false;
      if (fResp && !(r.responsavel || '').toUpperCase().includes(fResp)) return false;

      if (
  tbFiltroPorte.length > 0 &&
  !tbFiltroPorte.includes(r.porte) &&
  !tbFiltroPorte.includes(classificarCategoriaPorte(r.porte))
)
  return false;
      if (tbFiltroTipo.length > 0 && !tbFiltroTipo.includes(r.tipo)) return false;
      if (tbFiltroSituacao.length > 0 && !tbFiltroSituacao.includes(r.situacao))
        return false;

      if (filtroDataIni) {
        const pR = (r.data || '').split('/');
        if (pR.length === 3) {
          const dR = new Date(Number(pR[2]), Number(pR[1]) - 1, Number(pR[0]), 12).getTime();
          const pI = filtroDataIni.split('-');
          const dI = new Date(Number(pI[0]), Number(pI[1]) - 1, Number(pI[2]), 12).getTime();
          if (filtroDataFim) {
            const pF = filtroDataFim.split('-');
            const dF = new Date(Number(pF[0]), Number(pF[1]) - 1, Number(pF[2]), 12).getTime();
            if (dR < dI || dR > dF) return false;
          } else {
            if (dR !== dI) return false;
          }
        } else {
          return false;
        }
      }
      return true;
    });

    const ordenados = [...filtrados];
    if (ordem.coluna) {
      ordenados.sort((a, b) => {
        let valA: number | string = '';
        let valB: number | string = '';
        if (ordem.coluna === 'valor') {
          valA = parseMoeda(a.valor);
          valB = parseMoeda(b.valor);
        } else if (ordem.coluna === 'data') {
          const pA = (a.data || '').split('/');
          valA = pA.length === 3 ? new Date(Number(pA[2]), Number(pA[1]) - 1, Number(pA[0])).getTime() : 0;
          const pB = (b.data || '').split('/');
          valB = pB.length === 3 ? new Date(Number(pB[2]), Number(pB[1]) - 1, Number(pB[0])).getTime() : 0;
        } else {
          const key = ordem.coluna as keyof RegistroContratacao;
          valA = String(a[key] || '').toUpperCase();
          valB = String(b[key] || '').toUpperCase();
        }
        if (valA < valB) return ordem.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordem.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      ordenados.sort((a, b) => Number(b.id) - Number(a.id));
    }

    return ordenados;
  }, [
    registros,
    tbFiltroCliente,
    tbFiltroCpf,
    tbFiltroProj,
    tbFiltroResp,
    tbFiltroPorte,
    tbFiltroTipo,
    tbFiltroSituacao,
    filtroDataIni,
    filtroDataFim,
    ordem,
  ]);

  const somaTabelaContratacoes = useMemo(() => {
    const fTiposUpper = tbFiltroTipo.map((t) => t.toUpperCase());
    const somarSomenteLimites =
      fTiposUpper.length > 0 &&
      fTiposUpper.every((t) => t === 'LCGA' || t === 'LCGH');

    let soma = 0;
    dadosTabelaFiltradosEOrdenados.forEach((r) => {
      const tipoOp = (r.tipo || '').toUpperCase();
      const isLimite = tipoOp === 'LCGA' || tipoOp === 'LCGH';
      if (!isLimite || somarSomenteLimites) {
        soma += parseMoeda(r.valor);
      }
    });
    return soma;
  }, [dadosTabelaFiltradosEOrdenados, tbFiltroTipo]);

  const exportarJSON = () => {
    if (registros.length === 0) {
      alert('O banco de dados está vazio.');
      return;
    }
    const dataStr = JSON.stringify(registros, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const hoje = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `bnb_base_contratacoes_${hoje}.json`;
    a.click();
  };

  const importarJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const importados = JSON.parse(String(ev.target?.result));
        if (Array.isArray(importados)) {
          onAtualizarRegistros(importados);
          alert('Base de dados importada com sucesso!');
        } else {
          alert('O arquivo não tem o formato correto.');
        }
      } catch {
        alert('Erro ao ler o arquivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportarExcel = () => {
    if (registros.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    const wb = XLSX.utils.book_new();
    const dadosContrat = [
      [
        'Porte',
        'Cliente',
        'CPF',
        'Projetista',
        'Valor',
        'Tipo de OP.',
        'Situação',
        'Observações',
        'Responsável',
        'Telefone/Contato',
        'Data da Sit.',
        'Cada Vez Melhor',
      ],
    ];
    registros.forEach((r) => {
      const obsLimpa = r.obs ? r.obs.replace(/\n/g, ' ') : '';
      dadosContrat.push([
        r.porte || '',
        r.cliente || '',
        r.cpf || '',
        r.projetista || '',
        r.valor || '',
        r.tipo || '',
        r.situacao || '',
        obsLimpa,
        r.responsavel || '',
        r.telefone || '',
        r.data || '',
        r.cadaVezMelhor ? 'SIM' : 'NÃO',
      ]);
    });
    const wsContrat = XLSX.utils.aoa_to_sheet(dadosContrat);
    XLSX.utils.book_append_sheet(wb, wsContrat, 'Contratações');
    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Contratacoes_Atualizadas_${hoje}.xlsx`);
  };

  const importarExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        '⚠️ ATENÇÃO: Esta ação vai APAGAR a base atual de Contratações deste ambiente e substituí-la pelos dados da planilha do Excel selecionada. Deseja continuar?'
      )
    ) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const nomeAba = wb.SheetNames.find(
          (n) => n.toUpperCase() === 'DADOS' || n.toUpperCase().includes('CONTRATA')
        );
        const ws = nomeAba ? wb.Sheets[nomeAba] : wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

        let headerRowIndex = -1;
        let headers: string[] = [];
        for (let i = 0; i < Math.min(30, rawData.length); i++) {
          const rowValues = (rawData[i] || []).map((v) => String(v).toUpperCase().trim());
          if (
            (rowValues.includes('CLIENTE') || rowValues.includes('NOME')) &&
            (rowValues.includes('CPF') || rowValues.includes('PORTE'))
          ) {
            headerRowIndex = i;
            headers = (rawData[i] || []).map((v) => String(v).trim());
            break;
          }
        }

        if (headerRowIndex === -1) {
          alert("❌ Erro: Não encontrou o cabeçalho com colunas 'Cliente' ou 'CPF' na planilha.");
          return;
        }

        const novaBase: RegistroContratacao[] = [];
        const agora = Date.now();

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.join('').trim() === '') continue;
          const obj: Record<string, unknown> = {};
          headers.forEach((h, colIdx) => {
            obj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
          });

          if (!obj['Cliente'] && !obj['Nome']) continue;

          novaBase.push({
            id: String(agora + i),
            data: formatarDataExcel(obj['Data da Sit.'] || obj['Data'] || ''),
            porte: String(obj['Porte'] || '').trim(),
            cliente: String(obj['Cliente'] || obj['Nome'] || '').trim().toUpperCase(),
            cpf: String(obj['CPF'] || '').trim(),
            valor: formatarMoedaExcel(obj['Valor'] || obj['Valor (R$)']),
            tipo: String(obj['Tipo de OP.'] || obj['Tipo'] || '').trim(),
            situacao: String(obj['Situação'] || '').trim(),
            projetista: String(obj['Projetista'] || '').trim(),
            responsavel: String(obj['Responsável'] || obj['RESP. BNB'] || '').trim(),
            obs: String(obj['Observações'] || obj['OBS'] || '').trim(),
            telefone: String(obj['Telefone/Contato'] || obj['Telefone'] || '').trim(),
            cadaVezMelhor:
              String(obj['Cada Vez Melhor'] || '').toUpperCase().trim() === 'SIM',
          });
        }

        onAtualizarRegistros(novaBase);
        alert(`✅ Sucesso! ${novaBase.length} contratações foram importadas do Excel.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao ler a planilha. Verifique se o formato e os nomes das colunas estão corretos.');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMultiSelect = (
    e: React.ChangeEvent<HTMLSelectElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    setter(values);
  };

  const isPortePronafA = porte.toUpperCase().trim() === 'PRONAF A';
  const isOpDerivada = tipo !== 'LCGH' && tipo !== 'LCGA';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f7f9' }}>
      {/* BARRA DE AÇÕES E SUB-ABAS DO MÓDULO */}
      <div
        style={{
          background: '#fff',
          borderBottom: '2px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 20px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex' }}>
          <button
            onClick={() => setAbaAtiva('dash')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontWeight: 'bold',
              color: abaAtiva === 'dash' ? 'var(--primary-color)' : 'var(--support-gray)',
              borderBottom: abaAtiva === 'dash' ? '3px solid var(--primary-color)' : '3px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              fontSize: '13px',
              textTransform: 'uppercase',
            }}
          >
            📊 Dashboard Analítico
          </button>
          <button
            onClick={() => setAbaAtiva('dados')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontWeight: 'bold',
              color: abaAtiva === 'dados' ? 'var(--primary-color)' : 'var(--support-gray)',
              borderBottom: abaAtiva === 'dados' ? '3px solid var(--primary-color)' : '3px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              fontSize: '13px',
              textTransform: 'uppercase',
            }}
          >
            📋 Base de Dados & Cadastro
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '6px 0' }}>
          <input
            type="file"
            ref={inputJsonRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={importarJSON}
          />
          <button
            onClick={() => inputJsonRef.current?.click()}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', color: '#333', fontSize: '12px' }}
          >
            📂 Importar JSON
          </button>
          <button
            onClick={exportarJSON}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', color: '#333', fontSize: '12px' }}
          >
            💾 Exportar JSON
          </button>

          <input
            type="file"
            ref={inputExcelRef}
            style={{ display: 'none' }}
            accept=".xlsx, .xls"
            onChange={importarExcel}
          />
          <button
            onClick={() => inputExcelRef.current?.click()}
            style={{ background: '#fff3e0', border: '1px solid #ffb74d', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', color: '#e65100', fontSize: '12px' }}
          >
            📥 Importar do Excel
          </button>
          <button
            onClick={exportarExcel}
            style={{ background: '#e6f4ea', border: '1px solid #a8dab5', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', color: '#137333', fontSize: '12px' }}
          >
            📊 Exportar para Excel
          </button>
        </div>
      </div>

      <datalist id="lista_clientes_dash">
        {clientesUnicos.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      
      <datalist id="lista_programas_credito">
        {listaProgramas.map((prog) => (
          <option key={prog} value={prog} />
        ))}
      </datalist>

      <datalist id="lista_projetistas_curtos">
        {LISTA_PROJETISTAS_CURTOS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* ÁREA CENTRAL SCROLLÁVEL */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {abaAtiva === 'dash' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            {/* 5 FILTROS SUPERIORES */}
            <div
              className="person-card"
              style={{
                borderLeftColor: 'var(--primary-color)',
                background: '#fff',
                padding: '15px',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '15px',
                alignItems: 'flex-end',
                marginBottom: '20px',
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px' }}>🔍 Pesquisar Cliente</label>
                <input
                  type="search"
                  list="lista_clientes_dash"
                  value={dashFiltroCliente}
                  onChange={(e) => setDashFiltroCliente(e.target.value)}
                  placeholder="Nome/CPF..."
                  style={{ padding: '6px 8px', fontSize: '13px', height: '30px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label style={{ fontSize: '12px' }}>📑 Porte</label>
                <select
                  multiple
                  size={1}
                  value={dashFiltroPorte}
                  onChange={(e) => handleMultiSelect(e, setDashFiltroPorte)}
                  title="Segure Ctrl para selecionar múltiplos"
                  style={{
                    height: '30px',
                    fontSize: '12px',
                    color: dashFiltroPorte.length > 0 ? '#333' : 'transparent',
                    background: '#fff',
                  }}
                >
                  <option value="PRONAF V" style={{ color: '#333' }}>PRONAF V</option>
                  <option value="PRONAF A" style={{ color: '#333' }}>PRONAF A</option>
                  <option value="CADA VEZ MELHOR" style={{ color: '#333' }}>CDV MELHOR</option>
                  <option value="MINI" style={{ color: '#333' }}>MINI</option>
                  <option value="PEQUENO" style={{ color: '#333' }}>PEQUENO</option>
                </select>
                <span style={{ position: 'absolute', right: '8px', top: '26px', fontSize: '10px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label style={{ fontSize: '12px' }}>🚜 Tipo OP.</label>
                <select
                  multiple
                  size={1}
                  value={dashFiltroTipo}
                  onChange={(e) => handleMultiSelect(e, setDashFiltroTipo)}
                  title="Segure Ctrl para selecionar múltiplos"
                  style={{
                    height: '30px',
                    fontSize: '12px',
                    color: dashFiltroTipo.length > 0 ? '#333' : 'transparent',
                    background: '#fff',
                  }}
                >
                  <option value="Investimento" style={{ color: '#333' }}>Investimento</option>
                  <option value="Custeio" style={{ color: '#333' }}>Custeio</option>
                  <option value="Renovação - Custeio" style={{ color: '#333' }}>Renovação Custeio</option>
                  <option value="Cartão BNB" style={{ color: '#333' }}>Cartão BNB</option>
                </select>
                <span style={{ position: 'absolute', right: '8px', top: '26px', fontSize: '10px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label style={{ fontSize: '12px' }}>📊 Situação</label>
                <select
                  multiple
                  size={1}
                  value={dashFiltroSituacao}
                  onChange={(e) => handleMultiSelect(e, setDashFiltroSituacao)}
                  title="Segure Ctrl para selecionar múltiplos"
                  style={{
                    height: '30px',
                    fontSize: '12px',
                    color: dashFiltroSituacao.length > 0 ? '#333' : 'transparent',
                    background: '#fff',
                  }}
                >
                  <option value="Com Cliente/Projetista" style={{ color: '#333' }}>Com Cliente/Projetista</option>
                  <option value="Na Agência" style={{ color: '#333' }}>Na Agência</option>
                  <option value="Devolvido AG" style={{ color: '#333' }}>Devolvido AG</option>
                  <option value="Na Central" style={{ color: '#333' }}>Na Central</option>
                  <option value="Contratado" style={{ color: '#333' }}>Contratado</option>
                </select>
                <span style={{ position: 'absolute', right: '8px', top: '26px', fontSize: '10px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label style={{ fontSize: '12px' }}>👨‍💼 Projetista</label>
                <select
                  multiple
                  size={1}
                  value={dashFiltroProjetista}
                  onChange={(e) => handleMultiSelect(e, setDashFiltroProjetista)}
                  title="Segure Ctrl para selecionar múltiplos"
                  style={{
                    height: '30px',
                    fontSize: '12px',
                    color: dashFiltroProjetista.length > 0 ? '#333' : 'transparent',
                    background: '#fff',
                  }}
                >
                  {projetistasUnicos.map((p) => (
                    <option key={p} value={p} style={{ color: '#333' }}>
                      {p}
                    </option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: '8px', top: '26px', fontSize: '10px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
              </div>
            </div>

            {/* 4 CARDS DE KPI (COM REALIZADO E GAP OFICIAIS DO BANCO + INDICADORES OPACOS DO SISTEMA) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--support-gray)', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  VOLUME TOTAL (NO SISTEMA)
                </div>
                <div style={{ marginTop: '5px', color: '#333', fontSize: '24px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(metricasDash.volTotal)}
                </div>
              </div>

              {/* ITEM 5.1: Card TOTAL CONTRATADO (Principal = Efetivo Banco | Opaco abaixo da % = Cadastrado no Sistema) */}
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--success-color)', borderRadius: '8px', padding: '18px 20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      TOTAL CONTRATADO (BANCO)
                    </div>
                    <div style={{ marginTop: '5px', color: 'var(--success-color)', fontSize: '23px', fontWeight: 'bold' }}>
                      R$ {formatarMoedaBD(metricasDash.volContratado)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--success-color)', background: '#e6f4ea', padding: '3px 8px', borderRadius: '12px' }}>
                      {metricasDash.percMeta.toFixed(1)}%
                    </div>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        color: '#64748b',
                        opacity: 0.78,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                      title="Total contratado considerando apenas as propostas cadastradas e filtradas no nosso sistema"
                    >
                      No Sistema: R$ {formatarMoedaBD(metricasDash.volContratadoSistema)}
                    </div>
                  </div>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${metricasDash.percMeta}%`, height: '100%', background: 'var(--success-color)', borderRadius: '4px', transition: 'width 0.8s ease-out' }} />
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--support-yellow)', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  ESTOQUE (EM TRAMITAÇÃO)
                </div>
                <div style={{ marginTop: '5px', color: '#333', fontSize: '24px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(metricasDash.volEstoque)}
                </div>
              </div>

              {/* ITEM 5.1: Card FALTA CONTRATAR (Principal = Meta - Realizado Banco | Opaco no canto direito = Meta - Contratado no Sistema) */}
              <div style={{ position: 'relative', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--error-color)', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    FALTA CONTRATAR (GAP)
                  </div>
                  <div
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: '#64748b',
                      opacity: 0.75,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                    }}
                    title="Quanto falta contratar considerando apenas os contratos cadastrados na base do nosso sistema"
                  >
                    No Sistema: R$ {formatarMoedaBD(metricasDash.faltaContratarSistema)}
                  </div>
                </div>
                <div style={{ marginTop: '5px', color: 'var(--error-color)', fontSize: '23px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(metricasDash.faltaContratar)}
                </div>
              </div>
            </div>

            {/* QUADRO DINÂMICO: DETALHES DA SITUAÇÃO DO CLIENTE */}
            {temFiltroDashAtivo && (
              <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px', borderLeft: '5px solid var(--accent-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '14px', textTransform: 'uppercase' }}>
                    👤 DETALHES DA SITUAÇÃO DO CLIENTE
                  </h3>
                  <button
                    onClick={() => {
                      setDashFiltroCliente('');
                      setDashFiltroPorte([]);
                      setDashFiltroTipo([]);
                      setDashFiltroSituacao([]);
                      setDashFiltroProjetista([]);
                    }}
                    style={{ background: '#fce8e6', color: '#c5221f', padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}
                  >
                    ✖ Limpar Filtros
                  </button>
                </div>
                <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                  <table className="conf-table" style={{ whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr>
                        <th>DATA</th>
                        <th>PORTE</th>
                        <th style={{ textAlign: 'left' }}>CLIENTE</th>
                        <th>CPF</th>
                        <th style={{ textAlign: 'right' }}>VALOR (R$)</th>
                        <th>TIPO OP.</th>
                        <th>SITUAÇÃO</th>
                        <th>PROJETISTA</th>
                        <th style={{ width: '40px' }}>OBS</th>
                        <th style={{ width: '40px' }}>EDITAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosFiltradosDash.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', padding: '15px', color: '#888' }}>
                            Nenhuma operação encontrada com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        dadosFiltradosDash.map((reg) => (
                          <tr key={reg.id}>
                            <td>{reg.data}</td>
                            <td style={{ fontWeight: 'bold' }}>{reg.porte}</td>
                            <td style={{ textAlign: 'left' }}>
                              {reg.cliente}{' '}
                              {reg.cadaVezMelhor && (
                                <span style={{ background: '#fce4ec', color: '#ad1457', fontSize: '10px', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                                  👩 Cada Vez Melhor
                                </span>
                              )}
                            </td>
                            <td>{reg.cpf}</td>
                            <td style={{ fontWeight: 'bold', textAlign: 'right' }}>R$ {reg.valor}</td>
                            <td>{reg.tipo}</td>
                            <td>{renderBadgeStatus(reg.situacao)}</td>
                            <td>{reg.projetista || '-'}</td>
                            <td>
                              <button
                                onClick={() => onInspecionarNoKanban?.(reg)}
                                style={{ background: 'none', border: 'none', fontSize: '16px', padding: 0 }}
                                title="Inspecionar Nota Completa no Kanban"
                              >
                                🔎
                              </button>
                            </td>
                            <td>
                              <button
                                onClick={() => editarRegistroContratacao(reg.id)}
                                style={{ background: 'none', border: 'none', fontSize: '16px', padding: 0 }}
                                title="Editar Registro"
                              >
                                ✏️
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GRÁFICOS INFERIORES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
              <div
                className="person-card"
                style={{
                  borderLeftColor: 'var(--support-yellow)',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                }}
              >
                <h3 style={{ marginTop: 0, color: 'var(--primary-color)', fontSize: '14px', alignSelf: 'flex-start', textTransform: 'uppercase', borderBottom: '1px dashed var(--border-color)', paddingBottom: '5px', width: '100%' }}>
                  📊 TERMÔMETRO DA META
                </h3>
                <div style={{ position: 'relative', width: '180px', height: '180px', marginTop: '15px' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: `conic-gradient(var(--primary-color) ${metricasDash.percMeta}%, var(--secondary-color) 0)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.8s ease-out',
                      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ width: '130px', height: '130px', background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}>
                      <span style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {metricasDash.percMeta.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--support-gray)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        Atingimento
                      </span>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--support-gray)', marginTop: '20px', fontWeight: 'bold', background: '#f9f9f9', padding: '5px 15px', borderRadius: '12px' }}>
                  Meta Considerada: R$ {formatarMoedaBD(metricasDash.metaAplicavel)}
                </p>
              </div>

              <div className="person-card" style={{ borderLeftColor: 'var(--primary-color)', background: '#fff', padding: '20px' }}>
                <h3 style={{ marginTop: 0, color: 'var(--primary-color)', fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px dashed var(--border-color)', paddingBottom: '5px', width: '100%' }}>
                  📂 VOLUME POR STATUS
                </h3>
                <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {Object.entries(metricasDash.mapStatus).map(([st, info]) => {
                    const widthPerc =
                      metricasDash.maxVolumeStatus > 0
                        ? (info.v / metricasDash.maxVolumeStatus) * 100
                        : 0;
                    const corBarra =
                      st === 'Contratado' ? 'var(--primary-color)' : 'var(--accent-color)';
                    return (
                      <div key={st}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                          <span style={{ color: 'var(--support-gray)', textTransform: 'uppercase' }}>
                            {st} ({info.q})
                          </span>
                          <span style={{ color: '#333' }}>R$ {formatarMoedaBD(info.v)}</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                          <div style={{ width: `${widthPerc}%`, height: '100%', background: corBarra, borderRadius: '6px', transition: 'width 0.8s ease-out' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================== */}
        {/* ABA 2: BASE DE DADOS & CADASTRO */}
        {/* ============================================== */}
        {abaAtiva === 'dados' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', padding: '20px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                <strong style={{ color: 'var(--primary-color)', fontSize: '15px' }}>
                  📝 {idRegistro ? 'EDITANDO OPERAÇÃO SELECIONADA' : 'INSERIR / EDITAR OPERAÇÃO'}
                </strong>
                <button
                  onClick={limparFormContratacao}
                  style={{ background: 'var(--secondary-color)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  🧹 Limpar Formulário
                </button>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Porte</label>
                  <select value={porte} onChange={(e) => setPorte(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="PRONAF V">PRONAF V</option>
                    <option value="PRONAF A">PRONAF A</option>
                    <option value="MINI">MINI</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Nome do Cliente</label>
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Valor (R$)</label>
                  <input
                    type="text"
                    value={valor}
                    onChange={(e) => setValor(aplicarMascaraMoedaInput(e.target.value))}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Tipo de OP.</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Investimento">Investimento</option>
                    <option value="Custeio">Custeio</option>
                    <option value="LCGH">LCGH</option>
                    <option value="LCGA">LCGA</option>
                    <option value="Cartão BNB">Cartão BNB</option>
                    <option value="Renovação - Custeio">Renovação - Custeio</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--accent-color)' }}>Etapa Oficial (Estoque)</label>
                  <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Com Cliente/Projetista">Com Cliente/Projetista</option>
                    <option value="Na Agência">Na Agência (AG)</option>
                    <option value="Na Central">Na Central (S522)</option>
                    <option value="Devolvido AG">Devolvido AG (Regularização)</option>
                    <option value="F. Assinar">F. Assinar (Liberado S522)</option>
                    <option value="F. Conformidade">F. Conformidade (Setor Operacional)</option>
                    <option value="Contratado">Contratado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Projetista</label>
                  <input
                    type="text"
                    list="lista_projetistas_curtos"
                    value={projetista}
                    onChange={(e) => setProjetista(e.target.value)}
                    placeholder="Nome do técnico"
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Responsável BNB</label>
                  <input
                    type="text"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    placeholder="Quem está analisando"
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px' }}>Data Situação</label>
                  <input
                    type="text"
                    value={dataSit}
                    onChange={(e) => setDataSit(aplicarMascaraDataBR(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* BLOCO INTELIGENTE DE GARANTIA NO CARD DO KANBAN (Oculto para PRONAF A ou se a própria linha já for LCGH/LCGA) */}
              {!isPortePronafA && isOpDerivada && porte !== '' && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '10px',
                  }}
                >
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1.5fr 1fr', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '11px', color: 'var(--primary-color)' }}>
                        🛡️ Garantia exibida na Nota do Kanban ({porte})
                      </label>
                      <select
                        value={tipoGarantiaKanban}
                        onChange={(e) =>
                          setTipoGarantiaKanban(
                            e.target.value as 'NENHUMA' | 'AVAL' | 'LCGH' | 'LCGA'
                          )
                        }
                      >
                        <option value="NENHUMA">Sem Garantia / Puxar LCGH-LCGA automática pelo CPF</option>
                        <option value="AVAL">Avalista (Exibir Nome e CPF no Card)</option>
                        <option value="LCGH">LCGH (Exibir Valor/Status do Limite no Card)</option>
                        <option value="LCGA">LCGA (Exibir Valor/Status do Limite no Card)</option>
                      </select>
                    </div>

                    {tipoGarantiaKanban === 'AVAL' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '11px' }}>Nome do Avalista</label>
                          <input
                            type="text"
                            value={avalistaNome}
                            onChange={(e) => setAvalistaNome(e.target.value)}
                            placeholder="Ex: RAIMUNDO NASCIMENTO MEDEIROS"
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '11px' }}>CPF do Avalista</label>
                          <input
                            type="text"
                            value={avalistaCpf}
                            onChange={(e) => setAvalistaCpf(aplicarMascaraCPF(e.target.value))}
                            placeholder="000.000.000-00"
                            maxLength={14}
                          />
                        </div>
                      </>
                    )}

                    {(tipoGarantiaKanban === 'LCGH' || tipoGarantiaKanban === 'LCGA') && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '11px' }}>Valor do Limite {tipoGarantiaKanban} (R$)</label>
                          <input
                            type="text"
                            value={lcgValor}
                            onChange={(e) => setLcgValor(aplicarMascaraMoedaInput(e.target.value))}
                            placeholder="Ex: 537.285,30"
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '11px' }}>Andamento da {tipoGarantiaKanban}</label>
                          <input
                            type="text"
                            value={lcgSituacao}
                            onChange={(e) => setLcgSituacao(e.target.value)}
                            placeholder="Ex: OK (AGUARDANDO ASSINAR)"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="grid" style={{ gridTemplateColumns: '1fr 1.8fr 1.8fr 1fr auto', alignItems: 'end', marginTop: '5px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '12px' }}>Telefone / Contato</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(99) 99999-9999"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '12px', color: 'var(--primary-color)' }}>
                    📊 Situação Detalhada (Livre no Kanban)
                  </label>
                  <input
                    type="text"
                    value={situacaoDetalhada}
                    onChange={(e) => setSituacaoDetalhada(e.target.value)}
                    placeholder="Ex: - ENVIADO PARA A CENTRAL / - VISITA REALIZADA"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '12px' }}>📝 Pendências / Observações</label>
                  <input
                    type="text"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex: - RENDA DO AVALISTA / - TÍTULO DE DOMÍNIO"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '12px', color: 'var(--primary-color)' }}>
                    📑 Programa de Crédito
                  </label>
                  <input
                    type="search"
                    list="lista_programas_credito"
                    value={programa}
                    onChange={(e) => setPrograma(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder="Selecione ou digite..."
                    style={{ fontSize: '13px', padding: '8px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <button
                    onClick={salvarRegistroContratacao}
                    className="btn-save"
                    style={{ padding: '10px 22px', height: '38px', fontSize: '13px' }}
                  >
                    💾 Salvar Registro
                  </button>
                </div>
              </div>
            </div>

            {/* TABELA REGISTROS SALVOS */}
            <div className="person-card" style={{ borderLeftColor: 'var(--primary-color)', background: '#fff', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--primary-color)' }}>
                  🗂️ REGISTROS SALVOS
                </h3>
                <span style={{ fontSize: '13px', color: '#fff', background: 'var(--support-gray)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {dadosTabelaFiltradosEOrdenados.length} operações cadastradas
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="conf-table" style={{ whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '90px', verticalAlign: 'top' }}>AÇÕES</th>

                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('data')}>
                          DATA SIT. ↕️
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={filtroDataDisplay}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPopupPos({ top: rect.bottom + 4, left: rect.left });
                            setPopupDataAberto(true);
                          }}
                          placeholder="Filtrar..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '12px', cursor: 'pointer', background: '#fff', textAlign: 'center' }}
                        />
                      </th>

                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('porte')}>
                          PORTE ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={tbFiltroPorte}
                            onChange={(e) => handleMultiSelect(e, setTbFiltroPorte)}
                            style={{ height: '28px', fontSize: '12px', color: tbFiltroPorte.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="PRONAF V" style={{ color: '#333' }}>PRONAF V</option>
                            <option value="PRONAF A" style={{ color: '#333' }}>PRONAF A</option>
                            <option value="MINI" style={{ color: '#333' }}>MINI</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>

                      <th style={{ minWidth: '250px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('cliente')}>
                          CLIENTE ↕️
                        </div>
                        <input
                          type="search"
                          value={tbFiltroCliente}
                          onChange={(e) => setTbFiltroCliente(e.target.value)}
                          placeholder="Buscar Cliente..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px', width: '100%', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '3px' }}
                        />
                      </th>

                      <th style={{ minWidth: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('cpf')}>
                          CPF ↕️
                        </div>
                        <input
                          type="text"
                          value={tbFiltroCpf}
                          onChange={(e) => setTbFiltroCpf(e.target.value)}
                          placeholder="Buscar CPF..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px', width: '100%', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '3px' }}
                        />
                      </th>

                      <th style={{ width: '110px', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => alternarOrdenacao('valor')}>
                        VALOR (R$) ↕️
                        <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', background: '#e6f4ea', color: '#137333', padding: '4px', borderRadius: '4px', border: '1px solid #a8dab5', textAlign: 'center' }}>
                          R$ {formatarMoedaBD(somaTabelaContratacoes)}
                        </span>
                      </th>

                      <th style={{ width: '140px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('tipo')}>
                          TIPO OP. ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={tbFiltroTipo}
                            onChange={(e) => handleMultiSelect(e, setTbFiltroTipo)}
                            style={{ height: '28px', fontSize: '12px', color: tbFiltroTipo.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="Investimento" style={{ color: '#333' }}>Investimento</option>
                            <option value="Custeio" style={{ color: '#333' }}>Custeio</option>
                            <option value="Renovação - Custeio" style={{ color: '#333' }}>Renovação Custeio</option>
                            <option value="LCGA" style={{ color: '#333' }}>LCGA</option>
                            <option value="LCGH" style={{ color: '#333' }}>LCGH</option>
                            <option value="Cartão BNB" style={{ color: '#333' }}>Cartão BNB</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>

                      <th style={{ minWidth: '170px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('situacao')}>
                          SITUAÇÃO ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={tbFiltroSituacao}
                            onChange={(e) => handleMultiSelect(e, setTbFiltroSituacao)}
                            style={{ height: '28px', fontSize: '12px', color: tbFiltroSituacao.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="Com Cliente/Projetista" style={{ color: '#333' }}>Com Cliente/Projetista</option>
                            <option value="Na Agência" style={{ color: '#333' }}>Na Agência</option>
                            <option value="Devolvido AG" style={{ color: '#333' }}>Devolvido AG</option>
                            <option value="Na Central" style={{ color: '#333' }}>Na Central</option>
                            <option value="Contratado" style={{ color: '#333' }}>Contratado</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>

                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('projetista')}>
                          PROJETISTA ↕️
                        </div>
                        <input
                          type="text"
                          value={tbFiltroProj}
                          onChange={(e) => setTbFiltroProj(e.target.value)}
                          placeholder="Projetista..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px' }}
                        />
                      </th>

                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => alternarOrdenacao('responsavel')}>
                          RESP. BNB ↕️
                        </div>
                        <input
                          type="text"
                          value={tbFiltroResp}
                          onChange={(e) => setTbFiltroResp(e.target.value)}
                          placeholder="Responsável..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px' }}
                        />
                      </th>

                      <th style={{ width: '50px', verticalAlign: 'top' }}>OBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosTabelaFiltradosEOrdenados.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => editarRegistroContratacao(reg.id)}
                            style={{ background: '#e8f0fe', border: '1px solid #a8c7fa', color: '#1967d2', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginRight: '4px' }}
                          >
                            ✏️ EDITAR
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirRegistroContratacao(reg.id)}
                            style={{ background: '#fce8e6', border: '1px solid #f1a8a2', color: '#c5221f', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}
                          >
                            🗑️ EXCLUIR
                          </button>
                        </td>
                        <td>{reg.data || ''}</td>
                        <td style={{ fontWeight: 'bold' }}>{reg.porte}</td>
                        <td style={{ textAlign: 'left' }}>
                          {reg.cliente}{' '}
                          {reg.cadaVezMelhor && (
                            <span style={{ background: '#fce4ec', color: '#ad1457', fontSize: '10px', padding: '2px 5px', borderRadius: '6px', fontWeight: 'bold' }}>
                              👩 CVM
                            </span>
                          )}
                        </td>
                        <td>{reg.cpf}</td>
                        <td style={{ fontWeight: 'bold', textAlign: 'right' }}>R$ {reg.valor}</td>
                        <td>{reg.tipo}</td>
                        <td>{renderBadgeStatus(reg.situacao)}</td>
                        <td>{reg.projetista}</td>
                        <td>{reg.responsavel}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => onInspecionarNoKanban?.(reg)}
                            style={{ background: 'none', border: 'none', fontSize: '16px', padding: 0 }}
                            title="Inspecionar Nota Completa no Kanban"
                          >
                            🔎
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POPUP FLUTUANTE DE FILTRO DE DATA */}
      {popupDataAberto && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: popupPos.top,
            left: popupPos.left,
            background: '#fff',
            border: '1px solid #ccc',
            padding: '12px',
            borderRadius: '4px',
            zIndex: 999999,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            width: '185px',
          }}
        >
          <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            Apenas data ou Inicial
          </label>
          <input
            type="date"
            value={filtroDataIni}
            onChange={(e) => setFiltroDataIni(e.target.value)}
            style={{ padding: '4px', fontSize: '12px', marginBottom: '8px' }}
          />
          <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            Data Final (Opcional)
          </label>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            style={{ padding: '4px', fontSize: '12px', marginBottom: '12px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
            <button
              type="button"
              onClick={() => {
                setFiltroDataIni('');
                setFiltroDataFim('');
                setFiltroDataDisplay('');
                setPopupDataAberto(false);
              }}
              style={{ padding: '5px 8px', fontSize: '11px', background: '#fce8e6', color: '#c5221f' }}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                if (filtroDataIni && filtroDataFim) {
                  setFiltroDataDisplay(
                    `${filtroDataIni.split('-').reverse().join('/')} a ${filtroDataFim.split('-').reverse().join('/')}`
                  );
                } else if (filtroDataIni) {
                  setFiltroDataDisplay(filtroDataIni.split('-').reverse().join('/'));
                } else {
                  setFiltroDataDisplay('');
                }
                setPopupDataAberto(false);
              }}
              style={{ padding: '5px 8px', fontSize: '11px', background: 'var(--primary-color)', color: '#fff' }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}