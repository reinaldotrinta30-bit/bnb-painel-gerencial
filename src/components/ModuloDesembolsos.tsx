'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
} from '@/types/painel';
import {
  LISTA_PROJETISTAS_CURTOS,
  parseMoeda,
  formatarMoedaBD,
  aplicarMascaraCPF,
  aplicarMascaraMoedaInput,
  aplicarMascaraDataBR,
  getHojeBR,
  formatarMoedaExcel,
  formatarDataExcel,
  classificarCategoriaPorte,
} from '@/lib/utils';

interface ModuloDesembolsosProps {
  contratacoes: RegistroContratacao[];
  operacoesBase: OperacaoBaseDesembolso[];
  eventos: EventoDesembolso[];
  onAtualizarOperacoesBase: (novas: OperacaoBaseDesembolso[]) => void;
  onAtualizarEventos: (novos: EventoDesembolso[]) => void;
  onInspecionarNoKanban?: (dados: {
    cliente: string;
    op?: string;
    obsFallback?: string;
  }) => void;
  focoExternoDesembolso?: { cliente: string; op?: string } | null;
  onLimparFocoExternoDesembolso?: () => void;
}

export default function ModuloDesembolsos({
  contratacoes,
  operacoesBase,
  eventos,
  onAtualizarOperacoesBase,
  onAtualizarEventos,
  onInspecionarNoKanban,
  focoExternoDesembolso,
  onLimparFocoExternoDesembolso,
}: ModuloDesembolsosProps) {
  const [abaAtiva, setAbaAtiva] = useState<'dash' | 'op' | 'ev'>('dash');

  // Filtros do Topo (Painel Geral Consolidado)
  const [dashClienteTop, setDashClienteTop] = useState('');
  const [dashPorteTop, setDashPorteTop] = useState<string[]>([]);

  // Filtros da Tabela Consolidada (Aba 1)
  const [fTbCliente, setFTbCliente] = useState('');
  const [fTbPortes, setFTbPortes] = useState<string[]>([]);
  const [fTbOp, setFTbOp] = useState('');
  const [fTbSits, setFTbSits] = useState<string[]>([]);
  const [fTbParcela, setFTbParcela] = useState('');
  const [fTbProjs, setFTbProjs] = useState<string[]>([]);
  const [fTbData, setFTbData] = useState('');
  const [ordemPainel, setOrdemPainel] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
    coluna: '',
    direcao: 'asc',
  });

  // Estados do Formulário da Aba 2 (Cadastrar Operação Base)
  const [opId, setOpId] = useState('');
  const [opPorte, setOpPorte] = useState('');
  const [opCliente, setOpCliente] = useState('');
  const [opCpf, setOpCpf] = useState('');
  const [opProj, setOpProj] = useState('');
  const [opNum, setOpNum] = useState('');
  const [opValor, setOpValor] = useState('');

  // Filtros e Ordenação da Tabela da Aba 2
  const [fOpCliente, setFOpCliente] = useState('');
  const [fOpCpf, setFOpCpf] = useState('');
  const [fOpNum, setFOpNum] = useState('');
  const [fOpPortes, setFOpPortes] = useState<string[]>([]);
  const [fOpProj, setFOpProj] = useState('');
  const [ordemOp, setOrdemOp] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
    coluna: '',
    direcao: 'asc',
  });

  // Estados do Formulário da Aba 3 (Registrar Eventos / Histórico)
  const [evId, setEvId] = useState('');
  const [evCliente, setEvCliente] = useState('');
  const [evOp, setEvOp] = useState('');
  const [evValor, setEvValor] = useState('');
  const [evParcela, setEvParcela] = useState('');
  const [evSit, setEvSit] = useState('');
  const [evData, setEvData] = useState('');
  const [evObs, setEvObs] = useState('');

  // Filtros e Ordenação da Tabela da Aba 3
  const [fEvData, setFEvData] = useState('');
  const [fEvCliente, setFEvCliente] = useState('');
  const [fEvOp, setFEvOp] = useState('');
  const [fEvParcela, setFEvParcela] = useState('');
  const [fEvSits, setFEvSits] = useState<string[]>([]);
  const [ordemEv, setOrdemEv] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({
    coluna: '',
    direcao: 'asc',
  });

  // Modal de Observações (Lupinha 🔎)
  const [obsModalTexto, setObsModalTexto] = useState<string | null>(null);

  // Refs de Arquivos
  const inputJsonRef = useRef<HTMLInputElement>(null);
  const inputExcelRef = useRef<HTMLInputElement>(null);

  const handleMultiSelect = (
    e: React.ChangeEvent<HTMLSelectElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    setter(values);
  };

  // Renderizador de Pílula de Status de Desembolso (fiel ao getBadgeDesemb)
  const renderBadgeDesemb = (status: string) => {
    if (
      status === 'Finalizado' ||
      status === 'Desembolso Efetivado' ||
      status === 'Disponível para C/C'
    ) {
      return (
        <span style={{ background: '#e6f4ea', color: '#137333', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #a8dab5' }}>
          {status}
        </span>
      );
    } else if (
      status === 'Desembolso na Vinculada' ||
      status === 'Desembolso Solicitado' ||
      status === 'Solicitar Desembolso'
    ) {
      return (
        <span style={{ background: '#fef7e0', color: '#b06000', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #fde293' }}>
          {status}
        </span>
      );
    } else if (status === 'Desembolso Pendente' || status === 'Não Desembolsar') {
      return (
        <span style={{ background: '#fce8e6', color: '#c5221f', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #f1a8a2' }}>
          {status}
        </span>
      );
    } else {
      return (
        <span style={{ background: '#e8f0fe', color: '#1967d2', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #a8c7fa' }}>
          {status}
        </span>
      );
    }
  };

  // =========================================================================
  // DATALISTS E AUTOCOMPLETAR DA BASE DE CONTRATAÇÕES
  // =========================================================================
  const clientesContratacoesUnicos = useMemo(() => {
    const map = new Map<string, RegistroContratacao>();
    contratacoes.forEach((r) => {
      if (r.cliente && r.cpf) map.set(r.cpf, r);
    });
    return Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
  }, [contratacoes]);

  const clientesDashDatalist = useMemo(() => {
    const setCli = new Set<string>();
    eventos.forEach((e) => {
      const opB = operacoesBase.find((o) => o.cliente === e.cliente && o.op === e.op);
      if (opB) {
        const matchPorte =
          dashPorteTop.length === 0 || dashPorteTop.includes(opB.porte);
        if (matchPorte) setCli.add(e.cliente);
      }
    });
    operacoesBase.forEach((o) => {
      if (dashPorteTop.length === 0 || dashPorteTop.includes(o.porte)) {
        setCli.add(o.cliente);
      }
    });
    return Array.from(setCli).sort();
  }, [eventos, operacoesBase, dashPorteTop]);

  const projetistasOpBaseUnicos = useMemo(() => {
    return Array.from(
      new Set(operacoesBase.map((r) => (r.projetista || '').toUpperCase()).filter(Boolean))
    ).sort();
  }, [operacoesBase]);

  const handleOpClienteChange = (val: string) => {
    setOpCliente(val);
    const nomeUpper = val.toUpperCase();
    const encontrado = contratacoes.find((r) => (r.cliente || '').toUpperCase() === nomeUpper);
    if (encontrado) {
      setOpPorte(encontrado.porte || '');
      setOpCpf(encontrado.cpf || '');
      setOpProj(encontrado.projetista || '');
      setOpValor(encontrado.valor || '');
    }
  };

  const handleOpCpfChange = (val: string) => {
    const formatado = aplicarMascaraCPF(val);
    setOpCpf(formatado);
    if (formatado.length === 14) {
      const encontrado = contratacoes.find((r) => r.cpf === formatado);
      if (encontrado) {
        setOpPorte(encontrado.porte || '');
        setOpCliente(encontrado.cliente || '');
        setOpProj(encontrado.projetista || '');
        setOpValor(encontrado.valor || '');
      }
    }
  };

  // =========================================================================
  // ABA 1: CÁLCULO CONSOLIDADO DO PAINEL GERAL
  // =========================================================================
  const consolidado = useMemo(() => {
    const buscaTop = dashClienteTop.toUpperCase();
    const buscaTbCli = fTbCliente.toUpperCase();
    const buscaTbOp = fTbOp.toUpperCase();

    const dataHoje = new Date();
    dataHoje.setHours(0, 0, 0, 0);

    let volContratado = 0;
    let volDesemb = 0;
    let volPendente = 0;
    let volEtapa = 0;

    interface LinhaConsolidada {
      idOp: string;
      cliente: string;
      porte: string;
      op: string;
      projetista: string;
      valContrato: number;
      totalDesembOp: number;
      pendenteOp: number;
      saldoLibOp: number;
      sitAtual: string;
      refParcela: string;
      dataAtual: string;
      ultObs: string;
    }

    const linhas: LinhaConsolidada[] = [];

    operacoesBase.forEach((op) => {
      const matchClienteTop =
        !buscaTop ||
        (op.cliente || '').toUpperCase().includes(buscaTop) ||
        (op.cpf || '').includes(buscaTop);
      const catPorteOp = classificarCategoriaPorte(op.porte);
   const matchPorteTop =
     dashPorteTop.length === 0 ||
     dashPorteTop.includes(op.porte) ||
     dashPorteTop.includes(catPorteOp);

   if (!matchClienteTop || !matchPorteTop) return;

   if (
     fTbPortes.length > 0 &&
     !fTbPortes.includes(op.porte) &&
     !fTbPortes.includes(catPorteOp)
   )
     return;
      if (
        fTbProjs.length > 0 &&
        !fTbProjs.includes((op.projetista || '').toUpperCase())
      )
        return;
      if (buscaTbCli && !(op.cliente || '').toUpperCase().includes(buscaTbCli)) return;
      if (buscaTbOp && !(op.op || '').toUpperCase().includes(buscaTbOp)) return;

      const evsDaOp = eventos
        .filter((e) => e.cliente === op.cliente && e.op === op.op)
        .sort((a, b) => a.timestamp - b.timestamp);

      let totalDesembOp = 0;
      evsDaOp.forEach((e) => {
        if (e.situacao === 'Desembolso Efetivado' || e.situacao === 'Finalizado') {
          totalDesembOp += parseMoeda(e.valor);
        }
      });

      const valContrato = parseMoeda(op.valor);
      const pendenteOp = valContrato - totalDesembOp;

      let sitAtual = 'Sem Registro';
      let saldoLibOp = 0;
      let refParcela = '-';
      let dataAtual = '-';
      let ultObs = '';

      if (evsDaOp.length > 0) {
        const ultimoEv = evsDaOp[evsDaOp.length - 1];
        sitAtual = ultimoEv.situacao;
        refParcela = ultimoEv.parcela || '-';
        dataAtual = ultimoEv.data || '-';
        ultObs = ultimoEv.obs || '';

        // Regra automática: Desembolso na Vinculada >= 2 dias vira Disponível para C/C
        if (sitAtual === 'Desembolso na Vinculada' && dataAtual) {
          const parts = dataAtual.split('/');
          if (parts.length === 3) {
            const dEv = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            const diffDays = (dataHoje.getTime() - dEv.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays >= 2) sitAtual = 'Disponível para C/C';
          }
        }

        if (
          (sitAtual === 'Desembolso Efetivado' || sitAtual === 'Finalizado') &&
          pendenteOp <= 0
        ) {
          sitAtual = 'Finalizado';
        }

        if (sitAtual === 'Desembolso Efetivado' || sitAtual === 'Finalizado') {
          saldoLibOp = 0;
        } else {
          saldoLibOp = parseMoeda(ultimoEv.valor);
        }
      }

      if (fTbSits.length > 0 && !fTbSits.includes(sitAtual)) return;
      if (fTbParcela && String(refParcela) !== fTbParcela) return;
      if (fTbData && !(dataAtual || '').includes(fTbData)) return;

      volContratado += valContrato;
      volDesemb += totalDesembOp;
      volPendente += pendenteOp;
      volEtapa += saldoLibOp;

      linhas.push({
        idOp: op.id,
        cliente: op.cliente,
        porte: op.porte,
        op: op.op,
        projetista: op.projetista,
        valContrato,
        totalDesembOp,
        pendenteOp,
        saldoLibOp,
        sitAtual,
        refParcela,
        dataAtual,
        ultObs,
      });
    });

    if (ordemPainel.coluna) {
      linhas.sort((a, b) => {
        let valA: number | string = '';
        let valB: number | string = '';
        switch (ordemPainel.coluna) {
          case 'cliente':
            valA = a.cliente.toUpperCase();
            valB = b.cliente.toUpperCase();
            break;
          case 'contratado':
            valA = a.valContrato;
            valB = b.valContrato;
            break;
          case 'desembolsado':
            valA = a.totalDesembOp;
            valB = b.totalDesembOp;
            break;
          case 'pendente':
            valA = a.pendenteOp;
            valB = b.pendenteOp;
            break;
          case 'liberar':
            valA = a.saldoLibOp;
            valB = b.saldoLibOp;
            break;
          case 'parcela':
            valA = parseInt(a.refParcela) || 0;
            valB = parseInt(b.refParcela) || 0;
            break;
          case 'data': {
            const pA = a.dataAtual.split('/');
            valA = pA.length === 3 ? new Date(Number(pA[2]), Number(pA[1]) - 1, Number(pA[0])).getTime() : 0;
            const pB = b.dataAtual.split('/');
            valB = pB.length === 3 ? new Date(Number(pB[2]), Number(pB[1]) - 1, Number(pB[0])).getTime() : 0;
            break;
          }
          case 'porte':
            valA = (a.porte || '').toUpperCase();
            valB = (b.porte || '').toUpperCase();
            break;
          case 'op':
            valA = (a.op || '').toUpperCase();
            valB = (b.op || '').toUpperCase();
            break;
          case 'sitAtual':
            valA = (a.sitAtual || '').toUpperCase();
            valB = (b.sitAtual || '').toUpperCase();
            break;
          case 'projetista':
            valA = (a.projetista || '').toUpperCase();
            valB = (b.projetista || '').toUpperCase();
            break;
        }
        if (valA < valB) return ordemPainel.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordemPainel.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const percDesemb = volContratado > 0 ? Math.min(100, (volDesemb / volContratado) * 100) : 0;

    return {
      linhas,
      volContratado,
      volDesemb,
      volPendente,
      volEtapa,
      percDesemb,
    };
  }, [
    operacoesBase,
    eventos,
    dashClienteTop,
    dashPorteTop,
    fTbCliente,
    fTbPortes,
    fTbOp,
    fTbSits,
    fTbParcela,
    fTbProjs,
    fTbData,
    ordemPainel,
  ]);

  // =========================================================================
  // ABA 2: LÓGICA DE OPERAÇÕES BASE
  // =========================================================================
  const limparFormOp = () => {
    setOpId('');
    setOpPorte('');
    setOpCliente('');
    setOpCpf('');
    setOpProj('');
    setOpNum('');
    setOpValor('');
  };

  const salvarDesembOp = () => {
    if (!opCliente.trim() || !opNum.trim() || !opValor.trim()) {
      alert('Preencha ao menos o Cliente, Nº da OP e Valor Contratado!');
      return;
    }

    const novoReg: OperacaoBaseDesembolso = {
      id: opId ? opId : Date.now().toString(),
      porte: opPorte,
      cliente: opCliente.toUpperCase(),
      cpf: opCpf,
      projetista: opProj.toUpperCase(),
      op: opNum.toUpperCase(),
      valor: opValor,
    };

    const novaLista = opId
      ? operacoesBase.map((r) => (r.id === opId ? novoReg : r))
      : [...operacoesBase, novoReg];

    onAtualizarOperacoesBase(novaLista);
    limparFormOp();
    alert('Operação Base salva com sucesso!');
  };

  const editarOpDesemb = (id: string) => {
    const reg = operacoesBase.find((r) => String(r.id) === String(id));
    if (!reg) return;
    setOpId(reg.id);
    setOpPorte(reg.porte || '');
    setOpCliente(reg.cliente || '');
    setOpCpf(reg.cpf || '');
    setOpProj(reg.projetista || '');
    setOpNum(reg.op || '');
    setOpValor(reg.valor || '');
  };

  const excluirOpDesemb = (id: string) => {
    if (
      confirm(
        'Excluir esta Operação Base? (Isso não exclui os eventos do histórico automaticamente)'
      )
    ) {
      onAtualizarOperacoesBase(operacoesBase.filter((r) => String(r.id) !== String(id)));
    }
  };

  const operacoesBaseFiltradas = useMemo(() => {
    const fc = fOpCliente.toUpperCase();
    const fo = fOpNum.toUpperCase();
    const fp = fOpProj.toUpperCase();

    const filtradas = operacoesBase.filter((r) => {
      if (fc && !(r.cliente || '').toUpperCase().includes(fc)) return false;
      if (fOpCpf && !(r.cpf || '').includes(fOpCpf)) return false;
      if (fo && !(r.op || '').toUpperCase().includes(fo)) return false;
      if (fp && !(r.projetista || '').toUpperCase().includes(fp)) return false;
      if (
  fOpPortes.length > 0 &&
  !fOpPortes.includes(r.porte) &&
  !fOpPortes.includes(classificarCategoriaPorte(r.porte))
)
  return false;
      return true;
    });

    const ordenadas = [...filtradas];
    if (ordemOp.coluna) {
      ordenadas.sort((a, b) => {
        let valA: number | string = '';
        let valB: number | string = '';
        if (ordemOp.coluna === 'valor') {
          valA = parseMoeda(a.valor);
          valB = parseMoeda(b.valor);
        } else {
          const k = ordemOp.coluna as keyof OperacaoBaseDesembolso;
          valA = String(a[k] || '').toUpperCase();
          valB = String(b[k] || '').toUpperCase();
        }
        if (valA < valB) return ordemOp.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordemOp.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      ordenadas.sort((a, b) => Number(b.id) - Number(a.id));
    }
    return ordenadas;
  }, [operacoesBase, fOpCliente, fOpCpf, fOpNum, fOpProj, fOpPortes, ordemOp]);

  // =========================================================================
  // ABA 3: LÓGICA DE REGISTRAR EVENTOS (HISTÓRICO)
  // =========================================================================
  const clientesComOpBase = useMemo(() => {
    return Array.from(new Set(operacoesBase.map((r) => r.cliente).filter(Boolean))).sort();
  }, [operacoesBase]);

  const opsDoClienteSelecionado = useMemo(() => {
    if (!evCliente) return [];
    return operacoesBase.filter((r) => r.cliente === evCliente);
  }, [operacoesBase, evCliente]);

  const handleEvClienteChange = (cli: string) => {
    setEvCliente(cli);
    setEvOp('');
    if (cli && !evData) {
      setEvData(getHojeBR());
    }
  };

  // ITEM 2.1: Quando acionado pelo botão "💸 Desemb." do Kanban, abre a Aba 3 (Registrar Eventos), seleciona o Cliente no form e filtra o Histórico!
  useEffect(() => {
    if (!focoExternoDesembolso) return;
    const nomeCli = focoExternoDesembolso.cliente.toUpperCase().trim();

    setAbaAtiva('ev');
    setEvCliente(nomeCli);
    setFEvCliente(nomeCli);
    setEvData(getHojeBR());

    // Se o cliente tiver apenas 1 operação base cadastrada, já seleciona a OP automaticamente para agilizar!
    const opsDoCli = operacoesBase.filter(
      (o) => o.cliente.toUpperCase().trim() === nomeCli
    );
    if (focoExternoDesembolso.op) {
      setEvOp(focoExternoDesembolso.op);
    } else if (opsDoCli.length === 1) {
      setEvOp(opsDoCli[0].op);
    } else {
      setEvOp('');
    }

    onLimparFocoExternoDesembolso?.();
  }, [focoExternoDesembolso, operacoesBase, onLimparFocoExternoDesembolso]);

  const limparFormEv = () => {
    setEvId('');
    setEvCliente('');
    setEvOp('');
    setEvValor('');
    setEvParcela('');
    setEvSit('');
    setEvData('');
    setEvObs('');
  };

  const salvarDesembEv = () => {
    if (!evCliente || !evOp || !evSit || !evValor) {
      alert('Preencha Cliente, Operação, Situação e Valor!');
      return;
    }

    const existente = eventos.find((r) => r.id === evId);
    const novoReg: EventoDesembolso = {
      id: evId ? evId : Date.now().toString(),
      timestamp: existente ? existente.timestamp : Date.now(),
      cliente: evCliente,
      op: evOp,
      valor: evValor,
      parcela: evParcela,
      situacao: evSit,
      data: evData,
      obs: evObs,
    };

    let novaLista: EventoDesembolso[];
    if (evId) {
      novaLista = eventos.map((r) => (r.id === evId ? novoReg : r));
    } else {
      novaLista = [...eventos, novoReg];

      // MÁGICA 1: Geração automática da próxima parcela caso sobre saldo pendente
      if (novoReg.situacao === 'Desembolso Efetivado') {
        const opBase = operacoesBase.find(
          (o) => o.cliente === novoReg.cliente && o.op === novoReg.op
        );
        if (opBase) {
          const totalContratado = parseMoeda(opBase.valor);
          const eventosOp = novaLista.filter(
            (e) => e.cliente === novoReg.cliente && e.op === novoReg.op
          );
          let totalEfetivado = 0;
          eventosOp.forEach((e) => {
            if (e.situacao === 'Desembolso Efetivado' || e.situacao === 'Finalizado') {
              totalEfetivado += parseMoeda(e.valor);
            }
          });

          const saldoPendente = totalContratado - totalEfetivado;
          if (saldoPendente > 0) {
            const proxParcela = (parseInt(novoReg.parcela) || 0) + 1;
            const autoReg: EventoDesembolso = {
              id: Date.now().toString() + '_auto',
              timestamp: Date.now() + 1000,
              cliente: novoReg.cliente,
              op: novoReg.op,
              valor: formatarMoedaBD(saldoPendente),
              parcela: proxParcela.toString(),
              situacao: 'Solicitar Documentação',
              data: novoReg.data,
              obs: 'Gerado automaticamente pelo sistema (Saldo Pendente).',
            };
            novaLista.push(autoReg);
          }
        }
      }
    }

    onAtualizarEventos(novaLista);
    setEvId('');
    setEvSit('');
    setEvObs('');
    alert('Evento registado com sucesso!');
  };

  const editarEvDesemb = (id: string) => {
    const reg = eventos.find((r) => String(r.id) === String(id));
    if (!reg) return;
    setEvId(reg.id);
    setEvCliente(reg.cliente);
    setEvOp(reg.op);
    setEvValor(reg.valor);
    setEvParcela(reg.parcela);
    setEvSit(reg.situacao);
    setEvData(reg.data);
    setEvObs(reg.obs);
  };

  const excluirEvDesemb = (id: string) => {
    if (confirm('Tem a certeza que deseja excluir este evento do histórico?')) {
      onAtualizarEventos(eventos.filter((r) => String(r.id) !== String(id)));
    }
  };

  const eventosFiltrados = useMemo(() => {
    const fc = fEvCliente.toUpperCase();
    const fo = fEvOp.toUpperCase();

    const filtrados = eventos.filter((r) => {
      if (evOp && r.op !== evOp) return false;
      if (fEvData && !(r.data || '').includes(fEvData)) return false;
      if (fc && !(r.cliente || '').toUpperCase().includes(fc)) return false;
      if (fo && !(r.op || '').toUpperCase().includes(fo)) return false;
      if (fEvParcela && String(r.parcela) !== fEvParcela) return false;
      if (fEvSits.length > 0 && !fEvSits.includes(r.situacao)) return false;
      return true;
    });

    const ordenados = [...filtrados];
    if (ordemEv.coluna) {
      ordenados.sort((a, b) => {
        let valA: number | string = '';
        let valB: number | string = '';
        if (ordemEv.coluna === 'valor') {
          valA = parseMoeda(a.valor);
          valB = parseMoeda(b.valor);
        } else if (ordemEv.coluna === 'data') {
          const pA = (a.data || '').split('/');
          valA = pA.length === 3 ? new Date(Number(pA[2]), Number(pA[1]) - 1, Number(pA[0])).getTime() : 0;
          const pB = (b.data || '').split('/');
          valB = pB.length === 3 ? new Date(Number(pB[2]), Number(pB[1]) - 1, Number(pB[0])).getTime() : 0;
        } else if (ordemEv.coluna === 'parcela') {
          valA = parseInt(a.parcela) || 0;
          valB = parseInt(b.parcela) || 0;
        } else {
          const k = ordemEv.coluna as keyof EventoDesembolso;
          valA = String(a[k] || '').toUpperCase();
          valB = String(b[k] || '').toUpperCase();
        }
        if (valA < valB) return ordemEv.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return ordemEv.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      ordenados.sort((a, b) => {
        const pA = (a.data || '').split('/');
        const valA = pA.length === 3 ? new Date(Number(pA[2]), Number(pA[1]) - 1, Number(pA[0])).getTime() : 0;
        const pB = (b.data || '').split('/');
        const valB = pB.length === 3 ? new Date(Number(pB[2]), Number(pB[1]) - 1, Number(pB[0])).getTime() : 0;
        return valB - valA;
      });
    }
    return ordenados;
  }, [eventos, evOp, fEvData, fEvCliente, fEvOp, fEvParcela, fEvSits, ordemEv]);

  // =========================================================================
  // IMPORTAR / EXPORTAR JSON E EXCEL (.XLSX)
  // =========================================================================
  const exportarJSON = () => {
    const dataCompleta = { base: operacoesBase, eventos };
    const blob = new Blob([JSON.stringify(dataCompleta, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const hoje = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `bnb_base_desembolsos_${hoje}.json`;
    a.click();
  };

  const importarJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(String(ev.target?.result));
        if (dados.base && dados.eventos) {
          onAtualizarOperacoesBase(dados.base);
          onAtualizarEventos(dados.eventos);
          alert('Base de Desembolsos importada com sucesso!');
        } else {
          alert('Ficheiro inválido.');
        }
      } catch {
        alert('Erro ao ler o arquivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportarExcel = () => {
    if (operacoesBase.length === 0 && eventos.length === 0) {
      alert('Não há dados de Desembolsos para exportar!');
      return;
    }
    const wb = XLSX.utils.book_new();
    const dadosClientes = [
      ['Nome', 'CPF', 'Projetista', 'Nº da OP.', 'Valor Contratado', 'Porte'],
    ];
    operacoesBase.forEach((r) => {
      dadosClientes.push([
        r.cliente || '',
        r.cpf || '',
        r.projetista || '',
        r.op || '',
        r.valor || '',
        r.porte || '',
      ]);
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(dadosClientes),
      'BD_Clientes'
    );

    const dadosEventos = [
      ['Data do Evento', 'Cliente', 'Nº da OP.', 'Valor', 'Parcela', 'Situação', 'Observações'],
    ];
    const evOrdenados = [...eventos].sort((a, b) => a.timestamp - b.timestamp);
    evOrdenados.forEach((r) => {
      const obsLimpa = r.obs ? r.obs.replace(/\n/g, ' ') : '';
      dadosEventos.push([
        r.data || '',
        r.cliente || '',
        r.op || '',
        r.valor || '',
        r.parcela || '',
        r.situacao || '',
        obsLimpa,
      ]);
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(dadosEventos),
      'BD_Eventos'
    );

    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Desembolsos_Base_e_Historico_${hoje}.xlsx`);
  };

  const importarExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        '⚠️ ATENÇÃO: Esta ação vai APAGAR toda a base atual de Desembolsos (Clientes e Eventos) e substituí-la pelos dados desta planilha. Tem certeza que deseja continuar?'
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
        const novaBaseOp: OperacaoBaseDesembolso[] = [];
        const novaBaseEv: EventoDesembolso[] = [];
        const agora = Date.now();

        const nomeAbaCli =
          wb.SheetNames.find((n) => n.toUpperCase().includes('CLIENTE')) ||
          wb.SheetNames[0];
        const rawCli = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAbaCli], {
          header: 1,
          defval: '',
        });

        let hdrCliIdx = -1;
        let hdrCli: string[] = [];
        for (let i = 0; i < Math.min(20, rawCli.length); i++) {
          const rowValues = (rawCli[i] || []).map((v) => String(v).toUpperCase().trim());
          if (
            (rowValues.includes('CLIENTE') || rowValues.includes('NOME')) &&
            rowValues.includes('CPF')
          ) {
            hdrCliIdx = i;
            hdrCli = (rawCli[i] || []).map((v) => String(v).trim());
            break;
          }
        }

        if (hdrCliIdx !== -1) {
          for (let i = hdrCliIdx + 1; i < rawCli.length; i++) {
            const row = rawCli[i];
            if (!row || row.join('').trim() === '') continue;
            const obj: Record<string, unknown> = {};
            hdrCli.forEach((h, col) => {
              obj[h] = row[col] !== undefined ? row[col] : '';
            });
            if (!obj['Nome'] && !obj['Cliente']) continue;

            novaBaseOp.push({
              id: String(agora + i),
              porte: String(obj['Porte'] || '').trim(),
              cliente: String(obj['Nome'] || obj['Cliente'] || '').trim().toUpperCase(),
              cpf: String(obj['CPF'] || '').trim(),
              projetista: String(obj['Projetista'] || '').trim(),
              op: String(obj['Nº da OP.'] || obj['OP'] || '').trim(),
              valor: formatarMoedaExcel(obj['Valor Contratado'] || obj['Valor']),
            });
          }
        } else {
          throw new Error('Não encontrou o cabeçalho na aba Clientes.');
        }

        if (wb.SheetNames.length > 1) {
          const nomeAbaEv =
            wb.SheetNames.find((n) => n.toUpperCase().includes('EVENTO')) ||
            wb.SheetNames[1];
          const rawEv = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAbaEv], {
            header: 1,
            defval: '',
          });

          let hdrEvIdx = -1;
          let hdrEv: string[] = [];
          for (let i = 0; i < Math.min(20, rawEv.length); i++) {
            const rowValues = (rawEv[i] || []).map((v) => String(v).toUpperCase().trim());
            if (
              rowValues.includes('CLIENTE') &&
              (rowValues.includes('PARCELA') || rowValues.includes('VALOR'))
            ) {
              hdrEvIdx = i;
              hdrEv = (rawEv[i] || []).map((v) => String(v).trim());
              break;
            }
          }

          if (hdrEvIdx !== -1) {
            for (let i = hdrEvIdx + 1; i < rawEv.length; i++) {
              const row = rawEv[i];
              if (!row || row.join('').trim() === '') continue;
              const obj: Record<string, unknown> = {};
              hdrEv.forEach((h, col) => {
                obj[h] = row[col] !== undefined ? row[col] : '';
              });
              if (!obj['Cliente'] && !obj['Nome']) continue;

              const ts = agora + 10000 + i * 1000;
              novaBaseEv.push({
                id: String(ts),
                timestamp: ts,
                cliente: String(obj['Cliente'] || obj['Nome'] || '').trim().toUpperCase(),
                op: String(obj['Nº da OP.'] || obj['OP'] || '').trim(),
                valor: formatarMoedaExcel(obj['Valor']),
                parcela: String(obj['Parcela'] || '').trim(),
                situacao: String(obj['Situação'] || '').trim(),
                data: formatarDataExcel(obj['Data do Evento'] || obj['Data'] || ''),
                obs: String(obj['Observações'] || obj['OBS'] || '').trim(),
              });
            }
          }
        }

        onAtualizarOperacoesBase(novaBaseOp);
        onAtualizarEventos(novaBaseEv);
        alert(
          `✅ Sucesso! Foram importados:\n- ${novaBaseOp.length} Clientes\n- ${novaBaseEv.length} Eventos no Histórico`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Formato inválido';
        alert('Erro ao ler a planilha: ' + message);
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f7f9' }}>
      {/* SUB-ABAS E BOTÕES DE IMPORTAÇÃO/EXPORTAÇÃO */}
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
            📊 Painel Geral Consolidado
          </button>
          <button
            onClick={() => setAbaAtiva('op')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontWeight: 'bold',
              color: abaAtiva === 'op' ? 'var(--primary-color)' : 'var(--support-gray)',
              borderBottom: abaAtiva === 'op' ? '3px solid var(--primary-color)' : '3px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              fontSize: '13px',
              textTransform: 'uppercase',
            }}
          >
            📋 Cadastrar Operação / Cliente
          </button>
          <button
            onClick={() => setAbaAtiva('ev')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontWeight: 'bold',
              color: abaAtiva === 'ev' ? 'var(--primary-color)' : 'var(--support-gray)',
              borderBottom: abaAtiva === 'ev' ? '3px solid var(--primary-color)' : '3px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              fontSize: '13px',
              textTransform: 'uppercase',
            }}
          >
            ⏱️ Registrar Eventos (Histórico)
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

      {/* DATALISTS GLOBAIS DO MÓDULO */}
      <datalist id="dl_dash_desemb_clientes">
        {clientesDashDatalist.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="dl_op_clientes">
        {clientesContratacoesUnicos.map((r) => (
          <option key={r.id} value={r.cliente} />
        ))}
      </datalist>
      <datalist id="dl_op_cpfs">
        {clientesContratacoesUnicos.map((r) => (
          <option key={r.id} value={r.cpf}>
            {r.cliente}
          </option>
        ))}
      </datalist>
      <datalist id="lista_projetistas_curtos_desemb">
        {LISTA_PROJETISTAS_CURTOS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* ÁREA CENTRAL SCROLLÁVEL */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* ============================================== */}
        {/* ABA 1: PAINEL GERAL CONSOLIDADO */}
        {/* ============================================== */}
        {abaAtiva === 'dash' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            {/* FILTROS DO DASHBOARD */}
            <div
              className="person-card"
              style={{
                borderLeftColor: 'var(--primary-color)',
                background: '#fff',
                padding: '15px',
                display: 'flex',
                gap: '15px',
                alignItems: 'flex-end',
                marginBottom: '20px',
              }}
            >
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px' }}>🔍 Pesquisar Cliente</label>
                <input
                  type="search"
                  list="dl_dash_desemb_clientes"
                  value={dashClienteTop}
                  onChange={(e) => setDashClienteTop(e.target.value)}
                  placeholder="Digite o Nome ou CPF..."
                  style={{ height: '35px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px' }}>📑 Filtrar por Porte</label>
                <div style={{ position: 'relative' }}>
                  <select
                    multiple
                    size={1}
                    value={dashPorteTop}
                    onChange={(e) => handleMultiSelect(e, setDashPorteTop)}
                    title="Segure Ctrl para selecionar múltiplos"
                    style={{
                      height: '35px',
                      color: dashPorteTop.length > 0 ? '#333' : 'transparent',
                      background: '#fff',
                    }}
                  >
                    <option value="PRONAF V" style={{ color: '#333' }}>PRONAF V</option>
                    <option value="PRONAF A" style={{ color: '#333' }}>PRONAF A</option>
                    <option value="MINI" style={{ color: '#333' }}>MINI</option>
                    <option value="OUTROS" style={{ color: '#333' }}>OUTROS / S/ PORTE</option>
                  </select>
                  <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                </div>
              </div>
            </div>

            {/* 4 CARDS DE KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid #000', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  VOLUME CONTRATADO
                </div>
                <div style={{ marginTop: '5px', color: '#333', fontSize: '24px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(consolidado.volContratado)}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--success-color)', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  TOTAL DESEMBOLSADO
                </div>
                <div style={{ marginTop: '5px', color: 'var(--success-color)', fontSize: '24px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(consolidado.volDesemb)}
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${consolidado.percDesemb}%`, height: '100%', background: 'var(--success-color)', transition: 'width 0.8s ease-out' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--support-gray)' }}>Progresso do Volume</span>
                  <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 'bold' }}>
                    {consolidado.percDesemb.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--error-color)', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  SALDO TOTAL PENDENTE
                </div>
                <div style={{ marginTop: '5px', color: 'var(--error-color)', fontSize: '24px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(consolidado.volPendente)}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--support-yellow)', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', color: 'var(--support-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  SALDO A LIBERAR (ETAPA ATUAL)
                </div>
                <div style={{ marginTop: '5px', color: '#b06000', fontSize: '24px', fontWeight: 'bold' }}>
                  R$ {formatarMoedaBD(consolidado.volEtapa)}
                </div>
              </div>
            </div>

            {/* TABELA CONSOLIDADO DE OPERAÇÕES */}
            <div className="person-card" style={{ borderLeftColor: 'var(--primary-color)', background: '#fff', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--primary-color)' }}>
                  🗂️ CONSOLIDADO DE OPERAÇÕES
                </h3>
                <span style={{ fontSize: '12px', color: '#fff', background: 'var(--support-gray)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {consolidado.linhas.length} operações
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="conf-table" style={{ whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '250px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'cliente', direcao: p.coluna === 'cliente' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          CLIENTE ↕️
                        </div>
                        <input
                          type="search"
                          value={fTbCliente}
                          onChange={(e) => setFTbCliente(e.target.value)}
                          placeholder="Buscar Cliente..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px' }}
                        />
                      </th>

                      <th style={{ width: '90px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'porte', direcao: p.coluna === 'porte' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          PORTE ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={fTbPortes}
                            onChange={(e) => handleMultiSelect(e, setFTbPortes)}
                            style={{ height: '28px', fontSize: '12px', color: fTbPortes.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="PRONAF V" style={{ color: '#333' }}>PRONAF V</option>
                            <option value="PRONAF A" style={{ color: '#333' }}>PRONAF A</option>
                            <option value="MINI" style={{ color: '#333' }}>MINI</option>
                            <option value="OUTROS" style={{ color: '#333' }}>OUTROS / S/ PORTE</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>

                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'op', direcao: p.coluna === 'op' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          Nº DA OP. ↕️
                        </div>
                        <input
                          type="text"
                          value={fTbOp}
                          onChange={(e) => setFTbOp(e.target.value)}
                          placeholder="Buscar OP..."
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px' }}
                        />
                      </th>

                      <th style={{ minWidth: '100px', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'contratado', direcao: p.coluna === 'contratado' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                        VAL. CONTRATADO ↕️
                      </th>

                      <th style={{ minWidth: '105px', background: '#e6f4ea', color: '#137333', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'desembolsado', direcao: p.coluna === 'desembolsado' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                        DESEMBOLSADO ↕️
                      </th>

                      <th style={{ minWidth: '100px', background: '#fce8e6', color: '#c5221f', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'pendente', direcao: p.coluna === 'pendente' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                        TOTAL PENDENTE ↕️
                      </th>

                      <th style={{ minWidth: '100px', background: '#fef7e0', color: '#b06000', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'liberar', direcao: p.coluna === 'liberar' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                        SALDO A LIBERAR ↕️
                      </th>

                      <th style={{ minWidth: '180px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'sitAtual', direcao: p.coluna === 'sitAtual' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          SITUAÇÃO ATUAL ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={fTbSits}
                            onChange={(e) => handleMultiSelect(e, setFTbSits)}
                            style={{ height: '28px', fontSize: '12px', color: fTbSits.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="Sem Registro" style={{ color: '#333' }}>Sem Registro</option>
                            <option value="Solicitar Documentação" style={{ color: '#333' }}>Solicitar Documentação</option>
                            <option value="Verificar Conformidade" style={{ color: '#333' }}>Verificar Conformidade</option>
                            <option value="Solicitar Desembolso" style={{ color: '#333' }}>Solicitar Desembolso</option>
                            <option value="Desembolso Solicitado" style={{ color: '#333' }}>Desembolso Solicitado</option>
                            <option value="Desembolso Pendente" style={{ color: '#333' }}>Desembolso Pendente</option>
                            <option value="Desembolso na Vinculada" style={{ color: '#333' }}>Desembolso na Vinculada</option>
                            <option value="Disponível para C/C" style={{ color: '#333' }}>Disponível para C/C</option>
                            <option value="Desembolso Efetivado" style={{ color: '#333' }}>Desembolso Efetivado</option>
                            <option value="Não Desembolsar" style={{ color: '#333' }}>Não Desembolsar</option>
                            <option value="Finalizado" style={{ color: '#333' }}>Finalizado</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>

                      <th style={{ width: '70px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'parcela', direcao: p.coluna === 'parcela' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          PARC. ↕️
                        </div>
                        <input
                          type="text"
                          value={fTbParcela}
                          onChange={(e) => setFTbParcela(e.target.value)}
                          placeholder="Ex: 1"
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px' }}
                        />
                      </th>

                      <th style={{ minWidth: '120px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'projetista', direcao: p.coluna === 'projetista' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          PROJETISTA ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={fTbProjs}
                            onChange={(e) => handleMultiSelect(e, setFTbProjs)}
                            style={{ height: '28px', fontSize: '12px', color: fTbProjs.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            {projetistasOpBaseUnicos.map((p) => (
                              <option key={p} value={p} style={{ color: '#333' }}>
                                {p}
                              </option>
                            ))}
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>

                      <th style={{ width: '90px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemPainel((p) => ({ coluna: 'data', direcao: p.coluna === 'data' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          DATA ATUAL. ↕️
                        </div>
                        <input
                          type="text"
                          value={fTbData}
                          onChange={(e) => setFTbData(e.target.value)}
                          placeholder="01/01/2026"
                          style={{ marginTop: '6px', padding: '5px', fontSize: '13px' }}
                        />
                      </th>

                      <th style={{ width: '50px', verticalAlign: 'top' }}>OBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.linhas.map((reg) => (
                      <tr key={reg.idOp}>
                        <td style={{ textAlign: 'left' }}>{reg.cliente}</td>
                        <td style={{ fontWeight: 'bold' }}>{reg.porte}</td>
                        <td style={{ fontWeight: 'bold' }}>{reg.op}</td>
                        <td style={{ textAlign: 'right' }}>R$ {formatarMoedaBD(reg.valContrato)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', background: '#e8f5e9' }}>
                          R$ {formatarMoedaBD(reg.totalDesembOp)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', background: '#fdf2f1' }}>
                          R$ {formatarMoedaBD(reg.pendenteOp)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', background: '#fffdf5' }}>
                          R$ {formatarMoedaBD(reg.saldoLibOp)}
                        </td>
                        <td>{renderBadgeDesemb(reg.sitAtual)}</td>
                        <td>{reg.refParcela}</td>
                        <td>{reg.projetista || '-'}</td>
                        <td>{reg.dataAtual}</td>
                        <td>
                          {reg.ultObs ? (
                            <button
  onClick={() =>
    onInspecionarNoKanban
      ? onInspecionarNoKanban({ cliente: reg.cliente, op: reg.op, obsFallback: reg.ultObs })
      : setObsModalTexto(reg.ultObs)
  }
  style={{ background: 'none', border: 'none', fontSize: '16px', padding: 0 }}
  title="Inspecionar Nota Completa no Kanban"
>
  🔎
</button>
                          ) : (
                            <span style={{ color: '#ccc' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================== */}
        {/* ABA 2: CADASTRAR OPERAÇÃO BASE */}
        {/* ============================================== */}
        {abaAtiva === 'op' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', padding: '20px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                <strong style={{ color: 'var(--primary-color)', fontSize: '15px' }}>
                  📝 {opId ? 'EDITANDO OPERAÇÃO BASE' : 'INSERIR OPERAÇÃO BASE'}
                </strong>
                <button
                  onClick={limparFormOp}
                  style={{ background: 'var(--secondary-color)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}
                >
                  🧹 Limpar
                </button>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 2fr 1fr 1.5fr' }}>
                <div className="form-group">
                  <label>Porte</label>
                  <select value={opPorte} onChange={(e) => setOpPorte(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="PRONAF V">PRONAF V</option>
                    <option value="PRONAF A">PRONAF A</option>
                    <option value="MINI">MINI</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nome do Cliente</label>
                  <input
                    type="text"
                    list="dl_op_clientes"
                    value={opCliente}
                    onChange={(e) => handleOpClienteChange(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="form-group">
                  <label>CPF</label>
                  <input
                    type="text"
                    list="dl_op_cpfs"
                    value={opCpf}
                    onChange={(e) => handleOpCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="form-group">
                  <label>Projetista</label>
                  <input
                    type="text"
                    list="lista_projetistas_curtos_desemb"
                    value={opProj}
                    onChange={(e) => setOpProj(e.target.value)}
                    placeholder="Nome do técnico"
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end', marginTop: '5px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nº da OP.</label>
                  <input
                    type="text"
                    value={opNum}
                    onChange={(e) => setOpNum(e.target.value)}
                    placeholder="Ex: C30050102/001"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Valor Contratado (R$)</label>
                  <input
                    type="text"
                    value={opValor}
                    onChange={(e) => setOpValor(aplicarMascaraMoedaInput(e.target.value))}
                    placeholder="0,00"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <button
                    onClick={salvarDesembOp}
                    className="btn-save"
                    style={{ padding: '10px 25px', height: '38px', fontSize: '13px' }}
                  >
                    💾 Salvar Operação
                  </button>
                </div>
              </div>
            </div>

            <div className="person-card" style={{ borderLeftColor: 'var(--primary-color)', background: '#fff', padding: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: 'var(--primary-color)' }}>
                OPERAÇÕES BASE CADASTRADAS
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="conf-table" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', verticalAlign: 'top' }}>AÇÕES</th>
                      <th style={{ minWidth: '200px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemOp((p) => ({ coluna: 'cliente', direcao: p.coluna === 'cliente' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          CLIENTE ↕️
                        </div>
                        <input
                          type="search"
                          value={fOpCliente}
                          onChange={(e) => setFOpCliente(e.target.value)}
                          placeholder="Buscar Cliente..."
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemOp((p) => ({ coluna: 'cpf', direcao: p.coluna === 'cpf' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          CPF ↕️
                        </div>
                        <input
                          type="text"
                          value={fOpCpf}
                          onChange={(e) => setFOpCpf(e.target.value)}
                          placeholder="Buscar CPF..."
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemOp((p) => ({ coluna: 'op', direcao: p.coluna === 'op' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          Nº DA OP. ↕️
                        </div>
                        <input
                          type="text"
                          value={fOpNum}
                          onChange={(e) => setFOpNum(e.target.value)}
                          placeholder="Buscar OP..."
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ width: '120px', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setOrdemOp((p) => ({ coluna: 'valor', direcao: p.coluna === 'valor' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                        VALOR CONTRATADO ↕️
                      </th>
                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemOp((p) => ({ coluna: 'porte', direcao: p.coluna === 'porte' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          PORTE ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={fOpPortes}
                            onChange={(e) => handleMultiSelect(e, setFOpPortes)}
                            style={{ height: '28px', fontSize: '11px', color: fOpPortes.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="PRONAF V" style={{ color: '#333' }}>PRONAF V</option>
                            <option value="PRONAF A" style={{ color: '#333' }}>PRONAF A</option>
                            <option value="MINI" style={{ color: '#333' }}>MINI</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>
                      <th style={{ minWidth: '130px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemOp((p) => ({ coluna: 'projetista', direcao: p.coluna === 'projetista' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          PROJETISTA ↕️
                        </div>
                        <input
                          type="text"
                          value={fOpProj}
                          onChange={(e) => setFOpProj(e.target.value)}
                          placeholder="Buscar Projetista..."
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {operacoesBaseFiltradas.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <button
                            onClick={() => editarOpDesemb(reg.id)}
                            style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '14px' }}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => excluirOpDesemb(reg.id)}
                            style={{ background: 'none', border: 'none', padding: '2px 5px', fontSize: '14px' }}
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </td>
                        <td style={{ textAlign: 'left' }}>{reg.cliente}</td>
                        <td>{reg.cpf}</td>
                        <td style={{ fontWeight: 'bold' }}>{reg.op}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {reg.valor}</td>
                        <td>{reg.porte}</td>
                        <td>{reg.projetista}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================== */}
        {/* ABA 3: REGISTRAR EVENTOS (HISTÓRICO) */}
        {/* ============================================== */}
        {abaAtiva === 'ev' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', padding: '20px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                <strong style={{ color: 'var(--primary-color)', fontSize: '15px' }}>
                  ⏱️ {evId ? 'EDITANDO EVENTO DO HISTÓRICO' : 'REGISTRAR NOVO EVENTO'}
                </strong>
                <button
                  onClick={limparFormEv}
                  style={{ background: 'var(--secondary-color)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}
                >
                  🧹 Limpar
                </button>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <div className="form-group">
                  <label>Selecionar Cliente</label>
                  <select
                    value={evCliente}
                    onChange={(e) => handleEvClienteChange(e.target.value)}
                  >
                    <option value="">Selecione o Cliente...</option>
                    {clientesComOpBase.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Nº da Operação</label>
                  <select value={evOp} onChange={(e) => setEvOp(e.target.value)}>
                    <option value="">
                      {evCliente ? 'Selecione a Operação...' : 'Selecione o Cliente primeiro'}
                    </option>
                    {opsDoClienteSelecionado.map((o) => (
                      <option key={o.id} value={o.op}>
                        {o.op}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Valor Desembolso (R$)</label>
                  <input
                    type="text"
                    value={evValor}
                    onChange={(e) => setEvValor(aplicarMascaraMoedaInput(e.target.value))}
                    placeholder="0,00"
                  />
                </div>
                <div className="form-group">
                  <label>Ref. Parcela</label>
                  <input
                    type="number"
                    min={1}
                    value={evParcela}
                    onChange={(e) => setEvParcela(e.target.value)}
                    placeholder="Ex: 1"
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr 3fr auto', alignItems: 'end', marginTop: '5px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ color: 'var(--accent-color)' }}>Situação Atual</label>
                  <select value={evSit} onChange={(e) => setEvSit(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Solicitar Documentação">Solicitar Documentação</option>
                    <option value="Verificar Conformidade">Verificar Conformidade</option>
                    <option value="Solicitar Desembolso">Solicitar Desembolso</option>
                    <option value="Desembolso Solicitado">Desembolso Solicitado</option>
                    <option value="Desembolso Pendente">Desembolso Pendente</option>
                    <option value="Desembolso na Vinculada">Desembolso na Vinculada</option>
                    <option value="Disponível para C/C">Disponível para C/C</option>
                    <option value="Desembolso Efetivado">Desembolso Efetivado</option>
                    <option value="Não Desembolsar">Não Desembolsar</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data da Situação</label>
                  <input
                    type="text"
                    value={evData}
                    onChange={(e) => setEvData(aplicarMascaraDataBR(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Observações Detalhadas</label>
                  <input
                    type="text"
                    value={evObs}
                    onChange={(e) => setEvObs(e.target.value)}
                    placeholder="Ex: Falta nota fiscal, aguardando central..."
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <button
                    onClick={salvarDesembEv}
                    className="btn-save"
                    style={{ padding: '10px 25px', height: '38px', fontSize: '13px' }}
                  >
                    💾 Salvar Evento
                  </button>
                </div>
              </div>
            </div>

            <div className="person-card" style={{ borderLeftColor: 'var(--primary-color)', background: '#fff', padding: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: 'var(--primary-color)' }}>
                HISTÓRICO DE EVENTOS REGISTRADOS
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="conf-table" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '90px', verticalAlign: 'top' }}>AÇÕES</th>
                      <th style={{ width: '90px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemEv((p) => ({ coluna: 'data', direcao: p.coluna === 'data' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          DATA ↕️
                        </div>
                        <input
                          type="text"
                          value={fEvData}
                          onChange={(e) => setFEvData(e.target.value)}
                          placeholder="Ex: 01/01"
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ minWidth: '200px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemEv((p) => ({ coluna: 'cliente', direcao: p.coluna === 'cliente' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          CLIENTE ↕️
                        </div>
                        <input
                          type="search"
                          value={fEvCliente}
                          onChange={(e) => setFEvCliente(e.target.value)}
                          placeholder="Buscar Cliente..."
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ width: '110px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemEv((p) => ({ coluna: 'op', direcao: p.coluna === 'op' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          OPERAÇÃO ↕️
                        </div>
                        <input
                          type="text"
                          value={fEvOp}
                          onChange={(e) => setFEvOp(e.target.value)}
                          placeholder="Buscar OP..."
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ width: '70px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemEv((p) => ({ coluna: 'parcela', direcao: p.coluna === 'parcela' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          PARCELA ↕️
                        </div>
                        <input
                          type="text"
                          value={fEvParcela}
                          onChange={(e) => setFEvParcela(e.target.value)}
                          placeholder="Ex: 1"
                          style={{ marginTop: '6px', padding: '4px', fontSize: '11px' }}
                        />
                      </th>
                      <th style={{ width: '95px', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setOrdemEv((p) => ({ coluna: 'valor', direcao: p.coluna === 'valor' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                        VALOR (R$) ↕️
                      </th>
                      <th style={{ minWidth: '150px', verticalAlign: 'top' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => setOrdemEv((p) => ({ coluna: 'situacao', direcao: p.coluna === 'situacao' && p.direcao === 'asc' ? 'desc' : 'asc' }))}>
                          SITUAÇÃO ↕️
                        </div>
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <select
                            multiple
                            size={1}
                            value={fEvSits}
                            onChange={(e) => handleMultiSelect(e, setFEvSits)}
                            style={{ height: '28px', fontSize: '11px', color: fEvSits.length > 0 ? '#333' : 'transparent', background: '#fff' }}
                          >
                            <option value="Solicitar Documentação" style={{ color: '#333' }}>Solicitar Documentação</option>
                            <option value="Verificar Conformidade" style={{ color: '#333' }}>Verificar Conformidade</option>
                            <option value="Solicitar Desembolso" style={{ color: '#333' }}>Solicitar Desembolso</option>
                            <option value="Desembolso Solicitado" style={{ color: '#333' }}>Desembolso Solicitado</option>
                            <option value="Desembolso Pendente" style={{ color: '#333' }}>Desembolso Pendente</option>
                            <option value="Desembolso na Vinculada" style={{ color: '#333' }}>Desembolso na Vinculada</option>
                            <option value="Disponível para C/C" style={{ color: '#333' }}>Disponível para C/C</option>
                            <option value="Desembolso Efetivado" style={{ color: '#333' }}>Desembolso Efetivado</option>
                            <option value="Não Desembolsar" style={{ color: '#333' }}>Não Desembolsar</option>
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--support-gray)', pointerEvents: 'none' }}>▼</span>
                        </div>
                      </th>
                      <th style={{ width: '50px', verticalAlign: 'top' }}>OBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventosFiltrados.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => editarEvDesemb(reg.id)}
                            style={{ background: 'none', border: 'none', color: '#1967d2', fontSize: '11px', padding: '2px 4px' }}
                          >
                            ✏️ EDITAR
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirEvDesemb(reg.id)}
                            style={{ background: 'none', border: 'none', color: '#c5221f', fontSize: '11px', padding: '2px 4px' }}
                          >
                            🗑️ EXCLUIR
                          </button>
                        </td>
                        <td>{reg.data}</td>
                        <td style={{ textAlign: 'left' }}>{reg.cliente}</td>
                        <td style={{ fontWeight: 'bold' }}>{reg.op}</td>
                        <td>{reg.parcela}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {reg.valor}</td>
                        <td>{renderBadgeDesemb(reg.situacao)}</td>
                        <td>
                          {reg.obs && reg.obs.trim() !== '' ? (
                            <button
  type="button"
  onClick={() =>
    onInspecionarNoKanban
      ? onInspecionarNoKanban({ cliente: reg.cliente, op: reg.op, obsFallback: reg.obs })
      : setObsModalTexto(reg.obs)
  }
  style={{ background: 'none', border: 'none', fontSize: '16px', padding: 0 }}
  title="Inspecionar Nota Completa no Kanban"
>
  🔎
</button>
                          ) : (
                            <span style={{ color: '#ccc' }}>-</span>
                          )}
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

      {/* MODAL DE OBSERVAÇÕES DE DESEMBOLSOS */}
      {obsModalTexto !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '90%', maxWidth: '650px', background: '#fff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--primary-color)', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '16px', textTransform: 'uppercase' }}>
                🔎 DETALHES DA OBSERVAÇÃO (DESEMBOLSOS)
              </strong>
              <button
                onClick={() => setObsModalTexto(null)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', padding: 0 }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '30px' }}>
              <p style={{ fontSize: '16px', color: '#333', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {obsModalTexto || 'Nenhuma observação registrada nesta etapa.'}
              </p>
            </div>
            <div style={{ padding: '15px 20px', background: '#f9f9f9', borderTop: '1px solid #eee', textAlign: 'right' }}>
              <button
                onClick={() => setObsModalTexto(null)}
                style={{ background: 'var(--support-gray)', color: 'white', padding: '10px 20px', borderRadius: '4px' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}