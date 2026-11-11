'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  salvarCoringaGavetaSync,
  carregarCoringasGavetaSync,
  removerCoringaGavetaSync,
  salvarKanbanSync,
  salvarContratacoesSync,
  salvarDesembOpSync,
  salvarDesembEvSync,
  STORAGE_KEYS_V2,
} from '@/lib/firebaseSync';
import {
  CardKanban,
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
} from '@/types/painel';

export type TurnoBackup = 'MANHA_0730' | 'NOITE_1900' | 'MANUAL';

export interface SnapshotBackupSistema {
  id: string;
  dataISO: string; // Ex: '2026-11-11'
  dataBR: string; // Ex: '11/11/2026'
  horaBR: string; // Ex: '07:30' ou '19:00'
  turno: TurnoBackup;
  rotuloTurno: string;
  timestamp: number;
  qtdCardsKanban: number;
  qtdContratacoes: number;
  qtdDesembolsosEv: number;
  chavesLocalStorage: Record<string, string>;
}

const DB_NAME_BACKUPS = 'bnb_v2_cofre_backups_automaticos_db';
const STORE_NAME_BACKUPS = 'snapshots_sistema';
const TIPO_CORINGA_BACKUP = 'BACKUP_AUTOMATICO_NUVEM_V2';

function abrirBancoBackupsLocal(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME_BACKUPS, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME_BACKUPS)) {
        db.createObjectStore(STORE_NAME_BACKUPS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listarBackupsLocaisIdb(): Promise<SnapshotBackupSistema[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return [];
  try {
    const db = await abrirBancoBackupsLocal();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME_BACKUPS, 'readonly');
      const store = tx.objectStore(STORE_NAME_BACKUPS);
      const req = store.getAll();
      req.onsuccess = () =>
        resolve((req.result as SnapshotBackupSistema[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function salvarBackupLocalIdb(
  snap: SnapshotBackupSistema
): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  const db = await abrirBancoBackupsLocal();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME_BACKUPS, 'readwrite');
    tx.objectStore(STORE_NAME_BACKUPS).put(snap);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removerBackupLocalIdb(id: string): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  const db = await abrirBancoBackupsLocal();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME_BACKUPS, 'readwrite');
    tx.objectStore(STORE_NAME_BACKUPS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function codificarJsonParaBase64(obj: unknown): string {
  const jsonStr = JSON.stringify(obj);
  return window.btoa(unescape(encodeURIComponent(jsonStr)));
}

function decodificarBase64ParaJson<T>(b64: string): T | null {
  try {
    const jsonStr = decodeURIComponent(escape(window.atob(b64)));
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

function formatarDataISO(dt: Date): string {
  const aaaa = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${aaaa}-${mm}-${dd}`;
}

function formatarDataBR(dt: Date): string {
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const aaaa = dt.getFullYear();
  return `${dd}/${mm}/${aaaa}`;
}

function formatarHoraBR(dt: Date): string {
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

// Captura o estado atual completo do sistema a partir do localStorage
function capturarEstadoAtualDoSistema(): {
  chaves: Record<string, string>;
  qtdCards: number;
  qtdContratacoes: number;
  qtdDesembEv: number;
} {
  const chaves: Record<string, string> = {};
  if (typeof window === 'undefined') {
    return { chaves, qtdCards: 0, qtdContratacoes: 0, qtdDesembEv: 0 };
  }

  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    // Ignora cache temporário de PDFs para manter o backup leve e focado nos dados do painel
    if (k === 'bnb_v2_dados_projeto_extraidos_parecer') continue;
    if (k.startsWith('bnb_')) {
      chaves[k] = window.localStorage.getItem(k) || '';
    }
  }

  let qtdCards = 0;
  let qtdContratacoes = 0;
  let qtdDesembEv = 0;

  try {
    const rawKanban =
      chaves[STORAGE_KEYS_V2.KANBAN] ||
      chaves['bnb_v2_sandbox_kanban'] ||
      '[]';
    const arrK = JSON.parse(rawKanban);
    if (Array.isArray(arrK)) qtdCards = arrK.length;
  } catch {
    // Ignora
  }

  try {
    const rawContrat =
      chaves[STORAGE_KEYS_V2.CONTRATACOES] ||
      chaves['bnb_v2_sandbox_contratacoes'] ||
      '[]';
    const arrC = JSON.parse(rawContrat);
    if (Array.isArray(arrC)) qtdContratacoes = arrC.length;
  } catch {
    // Ignora
  }

  try {
    const rawEv =
      chaves[STORAGE_KEYS_V2.DESEMB_EV] ||
      chaves['bnb_v2_sandbox_desemb_ev'] ||
      '[]';
    const arrE = JSON.parse(rawEv);
    if (Array.isArray(arrE)) qtdDesembEv = arrE.length;
  } catch {
    // Ignora
  }

  return { chaves, qtdCards, qtdContratacoes, qtdDesembEv };
}

export function BotaoBackupNuvemCentral() {
  const [modalAberto, setModalAberto] = useState(false);
  const [backups, setBackups] = useState<SnapshotBackupSistema[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoBackupLabel, setUltimoBackupLabel] = useState<string>('');
  const inputImportarJsonRef = useRef<HTMLInputElement>(null);

  // Carrega e unifica os backups do IndexedDB Local + Firebase Nuvem, limpando os mais antigos que 4 dias
  const carregarTodosOsBackups = useCallback(async () => {
    setSincronizando(true);
    try {
      const locais = await listarBackupsLocaisIdb();
      const mapa = new Map<string, SnapshotBackupSistema>();
      locais.forEach((b) => mapa.set(b.id, b));

      try {
        const coringasNuvem = await carregarCoringasGavetaSync();
        if (Array.isArray(coringasNuvem)) {
          for (const item of coringasNuvem) {
            if (
              item.tipo === (TIPO_CORINGA_BACKUP as any) &&
              item.base64Dados
            ) {
              const decodificado =
                decodificarBase64ParaJson<SnapshotBackupSistema>(
                  item.base64Dados
                );
              if (decodificado && decodificado.id) {
                const existente = mapa.get(decodificado.id);
                if (
                  !existente ||
                  decodificado.timestamp > existente.timestamp
                ) {
                  mapa.set(decodificado.id, decodificado);
                  await salvarBackupLocalIdb(decodificado);
                }
              }
            }
          }
        }
      } catch {
        // Sem internet no momento: usa os backups locais do IndexedDB
      }

      // Mantém Hoje + Últimos 3 Dias Anteriores (janela de 4 dias de datas distintas)
      const todosOrdenados = Array.from(mapa.values()).sort(
        (a, b) => b.timestamp - a.timestamp
      );

      const datasDistintas = Array.from(
        new Set(todosOrdenados.map((b) => b.dataISO))
      ).sort((a, b) => b.localeCompare(a));

      const datasPermitidas = new Set(datasDistintas.slice(0, 4));
      const mantidos: SnapshotBackupSistema[] = [];

      for (const bkp of todosOrdenados) {
        if (datasPermitidas.has(bkp.dataISO)) {
          mantidos.push(bkp);
        } else {
          // Expurga backups com mais de 3 dias anteriores para nunca acumular lixo
          await removerBackupLocalIdb(bkp.id).catch(() => {});
          await removerCoringaGavetaSync(bkp.id).catch(() => {});
        }
      }

      setBackups(mantidos);
      if (mantidos[0]) {
        setUltimoBackupLabel(`${mantidos[0].dataBR} às ${mantidos[0].horaBR}`);
      }
      return mantidos;
    } finally {
      setSincronizando(false);
    }
  }, []);

  // Cria e salva um Snapshot de Backup (Local + Nuvem Firebase) com trava anti-esvaziamento!
  const executarCriacaoDeBackup = useCallback(
    async (
      turno: TurnoBackup,
      dataReferencia: Date = new Date(),
      forcarManual = false
    ): Promise<boolean> => {
      const estado = capturarEstadoAtualDoSistema();

      // TRAVA DE SEGURANÇA: Nunca permite que um backup automático sobrescreva outro se o Kanban estiver vazio ou corrompido!
      if (!forcarManual && estado.qtdCards < 5) {
        return false;
      }

      const existentes = await listarBackupsLocaisIdb();
      const maiorQtdCardsRecente = existentes.reduce(
        (max, b) => Math.max(max, b.qtdCardsKanban || 0),
        0
      );

      // Se tínhamos ex: 132 cards e de repente o estado atual caiu para menos de 40% disso, bloqueia o backup automático!
      if (
        !forcarManual &&
        maiorQtdCardsRecente >= 20 &&
        estado.qtdCards < maiorQtdCardsRecente * 0.4
      ) {
        console.warn(
          `🛡️ [Backup Nuvem] Backup automático bloqueado por segurança: Kanban atual (${estado.qtdCards} cards) está muito abaixo do histórico (${maiorQtdCardsRecente} cards).`
        );
        return false;
      }

      const dataISO = formatarDataISO(dataReferencia);
      const dataBR = formatarDataBR(dataReferencia);
      const horaBR =
        turno === 'MANHA_0730'
          ? '07:30'
          : turno === 'NOITE_1900'
          ? '19:00'
          : formatarHoraBR(dataReferencia);

      const idSlot =
        turno === 'MANUAL'
          ? `BKP_${dataISO}_MANUAL_${dataReferencia.getTime()}`
          : `BKP_${dataISO}_${turno}`;

      const rotuloTurno =
        turno === 'MANHA_0730'
          ? '🌅 Backup Início do Dia (07h30)'
          : turno === 'NOITE_1900'
          ? '🌙 Backup Final do Dia (19h00)'
          : `⚡ Backup Manual (${horaBR})`;

      const novoSnap: SnapshotBackupSistema = {
        id: idSlot,
        dataISO,
        dataBR,
        horaBR,
        turno,
        rotuloTurno,
        timestamp: Date.now(),
        qtdCardsKanban: estado.qtdCards,
        qtdContratacoes: estado.qtdContratacoes,
        qtdDesembolsosEv: estado.qtdDesembEv,
        chavesLocalStorage: estado.chaves,
      };

      await salvarBackupLocalIdb(novoSnap);

      try {
        const b64 = codificarJsonParaBase64(novoSnap);
        await salvarCoringaGavetaSync({
          id: idSlot,
          tipo: TIPO_CORINGA_BACKUP as any,
          chaveReferencia: `${dataISO}_${turno}`,
          nomeArquivoOriginal: `${idSlot}.json`,
          base64Dados: b64,
          dataAtualizacao: new Date().toISOString(),
        });
      } catch {
        // Fica salvo no IndexedDB local se estiver offline
      }

      await carregarTodosOsBackups();
      return true;
    },
    [carregarTodosOsBackups]
  );

  // VIGIA AUTOMÁTICO DE HORÁRIOS (07h30 DA MANHÃ E 19h00 DA NOITE)
  useEffect(() => {
    let cancelado = false;

    const verificarAgendamentoAutomatico = async () => {
      if (cancelado) return;
      const agora = new Date();
      const hojeISO = formatarDataISO(agora);
      const minutosDoDia = agora.getHours() * 60 + agora.getMinutes();

      const listaAtual = await carregarTodosOsBackups();

      // 1. Regra das 07h30 (Início do Dia):
      // Se já passou das 07h30 de hoje (minutos >= 450) e ainda não existe o backup MANHA_0730 de hoje, cria imediatamente!
      const jaTemManhaHoje = listaAtual.some(
        (b) => b.dataISO === hojeISO && b.turno === 'MANHA_0730'
      );
      if (minutosDoDia >= 7 * 60 + 30 && !jaTemManhaHoje) {
        await executarCriacaoDeBackup('MANHA_0730', agora, false);
      }

      // 2. Regra das 19h00 (Final do Dia):
      // Se já são 19h00 ou mais (minutos >= 1140) e ainda não existe o backup NOITE_1900 de hoje, cria imediatamente!
      const jaTemNoiteHoje = listaAtual.some(
        (b) => b.dataISO === hojeISO && b.turno === 'NOITE_1900'
      );
      if (minutosDoDia >= 19 * 60 && !jaTemNoiteHoje) {
        await executarCriacaoDeBackup('NOITE_1900', agora, false);
      }

      // 3. Catch-up Inteligente do Dia Anterior:
      // Se ontem o computador foi desligado antes das 19h00 e não gerou o backup NOITE_1900 de ontem,
      // garante a criação do fechamento do dia anterior ao ligar pela manhã!
      const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
      const ontemISO = formatarDataISO(ontem);
      const jaTemNoiteOntem = listaAtual.some(
        (b) => b.dataISO === ontemISO && b.turno === 'NOITE_1900'
      );
      if (!jaTemNoiteOntem) {
        await executarCriacaoDeBackup('NOITE_1900', ontem, false);
      }
    };

    // Aguarda 6 segundos após abrir o sistema (tempo para o Firebase carregar) e verifica os backups de 07h30 e 19h00
    const timerInicial = setTimeout(verificarAgendamentoAutomatico, 6000);

    // Continua checando a cada 60 segundos para disparar cravado às 07h30 e às 19h00 enquanto o navegador estiver aberto
    const intervaloRelogio = setInterval(
      verificarAgendamentoAutomatico,
      60 * 1000
    );

    return () => {
      cancelado = true;
      clearTimeout(timerInicial);
      clearInterval(intervaloRelogio);
    };
  }, [carregarTodosOsBackups, executarCriacaoDeBackup]);

  // Restaura um backup selecionado (para o localStorage, para a Tela ao vivo e para o Firebase!)
  const restaurarSnapshotCompleto = async (snap: SnapshotBackupSistema) => {
    const confirmar = window.confirm(
      `🛡️ RESTAURAR BACKUP DE SEGURANÇA\n\n` +
        `Deseja restaurar o sistema para a cópia de:\n` +
        `📅 Data: ${snap.dataBR} — ${snap.rotuloTurno}\n` +
        `🗂️ Conteúdo: ${snap.qtdCardsKanban} Cards no Kanban • ${snap.qtdContratacoes} Contratações • ${snap.qtdDesembolsosEv} Eventos de Desembolso?\n\n` +
        `Isso atualizará imediatamente a tela e gravará esses dados na Nuvem.`
    );
    if (!confirmar) return;

    setSincronizando(true);
    try {
      // 1. Restaura todas as chaves salvas no localStorage
      Object.entries(snap.chavesLocalStorage || {}).forEach(([chave, valor]) => {
        if (typeof valor === 'string') {
          window.localStorage.setItem(chave, valor);
        }
      });

      const rawCards =
        snap.chavesLocalStorage[STORAGE_KEYS_V2.KANBAN] ||
        snap.chavesLocalStorage['bnb_v2_sandbox_kanban'] ||
        '[]';
      const rawContrat =
        snap.chavesLocalStorage[STORAGE_KEYS_V2.CONTRATACOES] ||
        snap.chavesLocalStorage['bnb_v2_sandbox_contratacoes'] ||
        '[]';
      const rawDesembOp =
        snap.chavesLocalStorage[STORAGE_KEYS_V2.DESEMB_OP] ||
        snap.chavesLocalStorage['bnb_v2_sandbox_desemb_op'] ||
        '[]';
      const rawDesembEv =
        snap.chavesLocalStorage[STORAGE_KEYS_V2.DESEMB_EV] ||
        snap.chavesLocalStorage['bnb_v2_sandbox_desemb_ev'] ||
        '[]';

      const cardsRestaurados: CardKanban[] = JSON.parse(rawCards);
      const contratRestauradas: RegistroContratacao[] = JSON.parse(rawContrat);
      const opRestauradas: OperacaoBaseDesembolso[] = JSON.parse(rawDesembOp);
      const evRestaurados: EventoDesembolso[] = JSON.parse(rawDesembEv);

      // 2. Crava imediatamente no Firebase para que todos os computadores recebam o backup restaurado!
      await Promise.all([
        salvarKanbanSync(cardsRestaurados),
        salvarContratacoesSync(contratRestauradas),
        salvarDesembOpSync(opRestauradas),
        salvarDesembEvSync(evRestaurados),
      ]);

      // 3. Atualiza os componentes em tempo real
      window.dispatchEvent(
        new CustomEvent('bnb_v2_sync_externo', {
          detail: {
            cards: cardsRestaurados,
            contratacoes: contratRestauradas,
          },
        })
      );

      alert(
        `✅ Backup de ${snap.dataBR} (${snap.horaBR}) restaurado e sincronizado na Nuvem com sucesso!\n\nA página será recarregada para atualizar todos os painéis.`
      );
      window.location.reload();
    } catch (err: any) {
      alert(
        `❌ Erro ao restaurar backup: ${err?.message || 'Verifique o arquivo.'}`
      );
    } finally {
      setSincronizando(false);
    }
  };

  const baixarSnapshotComoArquivoJson = (snap: SnapshotBackupSistema) => {
    const blob = new Blob([JSON.stringify(snap.chavesLocalStorage, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_PAINEL_BNB_${snap.dataISO}_${snap.horaBR.replace(
      ':',
      'h'
    )}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Permite carregar qualquer arquivo .JSON salvo no computador (como o BACKUP_COMPLETO_SISTEMA_ONTEM.json)
  const importarBackupDeArquivoJson = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const jsonLido = JSON.parse(texto);

      let chavesParaRestaurar: Record<string, string> = {};
      if (Array.isArray(jsonLido)) {
        chavesParaRestaurar[STORAGE_KEYS_V2.KANBAN] = JSON.stringify(jsonLido);
        chavesParaRestaurar['bnb_v2_sandbox_kanban'] = JSON.stringify(jsonLido);
      } else if (jsonLido && typeof jsonLido === 'object') {
        chavesParaRestaurar = jsonLido.chavesLocalStorage || jsonLido;
      }

      const rawK =
        chavesParaRestaurar[STORAGE_KEYS_V2.KANBAN] ||
        chavesParaRestaurar['bnb_v2_sandbox_kanban'] ||
        '[]';
      const cardsLidos = JSON.parse(rawK);

      if (!Array.isArray(cardsLidos) || cardsLidos.length === 0) {
        alert('⚠️ O arquivo selecionado não contém cards válidos do Kanban.');
        e.target.value = '';
        return;
      }

      const snapTemp: SnapshotBackupSistema = {
        id: `IMPORT_${Date.now()}`,
        dataISO: formatarDataISO(new Date()),
        dataBR: formatarDataBR(new Date()),
        horaBR: formatarHoraBR(new Date()),
        turno: 'MANUAL',
        rotuloTurno: `📂 Arquivo Importado (${file.name})`,
        timestamp: Date.now(),
        qtdCardsKanban: cardsLidos.length,
        qtdContratacoes: 0,
        qtdDesembolsosEv: 0,
        chavesLocalStorage: {
          ...capturarEstadoAtualDoSistema().chaves,
          ...chavesParaRestaurar,
        },
      };

      await restaurarSnapshotCompleto(snapTemp);
    } catch {
      alert('❌ Arquivo .JSON inválido.');
    }
    e.target.value = '';
  };

  // Agrupa os backups por Data (Hoje + Últimos 3 Dias Anteriores)
  const backupsAgrupadosPorData = React.useMemo(() => {
    const grupos = new Map<string, SnapshotBackupSistema[]>();
    backups.forEach((b) => {
      if (!grupos.has(b.dataISO)) grupos.set(b.dataISO, []);
      grupos.get(b.dataISO)!.push(b);
    });
    return Array.from(grupos.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4);
  }, [backups]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setModalAberto(true);
          carregarTodosOsBackups();
        }}
        style={{
          width: 'auto',
          padding: '8px 14px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          color: '#ffffff',
          border: '1px solid #38bdf8',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)',
        }}
        title="Backups automáticos diários (07h30 e 19h00) dos últimos 3 dias salvos na Nuvem"
      >
        <span>☁️ Nuvem</span>
        {ultimoBackupLabel && (
          <span
            style={{
              fontSize: '9.5px',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#bae6fd',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 700,
            }}
          >
            ✔ {ultimoBackupLabel}
          </span>
        )}
      </button>

      {modalAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setModalAberto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.76)',
              zIndex: 999995,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#f8fafc',
                width: '94vw',
                maxWidth: '820px',
                maxHeight: '90vh',
                borderRadius: '12px',
                borderTop: '5px solid #0284c7',
                boxShadow: '0 25px 55px rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* CABEÇALHO DO MODAL DE BACKUP NUVEM */}
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
                    ☁️ CENTRAL DE BACKUP AUTOMÁTICO NA NUVEM (07h30 & 19h00)
                  </h3>
                  <span style={{ fontSize: '11px', color: '#bae6fd' }}>
                    Guarda automaticamente o Início do Dia (07h30) e o Final do
                    Dia (19h00) dos últimos 3 dias anteriores com trava
                    anti-perda.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
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

              {/* BARRA DE AÇÕES MANUAIS */}
              <div
                style={{
                  padding: '12px 20px',
                  background: '#ffffff',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={sincronizando}
                    onClick={async () => {
                      await executarCriacaoDeBackup('MANUAL', new Date(), true);
                      alert(
                        '✅ Ponto de Backup Manual criado e sincronizado na Nuvem com sucesso!'
                      );
                    }}
                    style={{
                      width: 'auto',
                      padding: '8px 14px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '7px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Criar Backup Agora (Manual)
                  </button>

                  <input
                    ref={inputImportarJsonRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={importarBackupDeArquivoJson}
                  />

                  <button
                    type="button"
                    onClick={() => inputImportarJsonRef.current?.click()}
                    style={{
                      width: 'auto',
                      padding: '8px 14px',
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title="Restaurar a partir de um arquivo .JSON salvo no computador"
                  >
                    📂 Importar Arquivo .JSON do PC
                  </button>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: sincronizando ? '#b45309' : '#15803d',
                  }}
                >
                  {sincronizando
                    ? '⏳ Sincronizando com a Nuvem...'
                    : `☁️ ${backups.length} ponto(s) de recuperação disponíveis`}
                </span>
              </div>

              {/* LISTA DOS ÚLTIMOS 3 DIAS ANTERIORES (+ HOJE) */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {backupsAgrupadosPorData.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      color: '#64748b',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    Nenhum backup registrado ainda. Clique em{' '}
                    <b>&ldquo;⚡ Criar Backup Agora&rdquo;</b> acima para gerar o
                    primeiro ponto de segurança!
                  </div>
                ) : (
                  backupsAgrupadosPorData.map(([dataIso, listaDoDia], idxDia) => {
                    const hojeIso = formatarDataISO(new Date());
                    const ehHoje = dataIso === hojeIso;
                    const dataBrTitulo = listaDoDia[0]?.dataBR || dataIso;

                    return (
                      <div
                        key={dataIso}
                        style={{
                          background: '#ffffff',
                          borderRadius: '10px',
                          border: ehHoje
                            ? '1.5px solid #38bdf8'
                            : '1px solid #cbd5e1',
                          overflow: 'hidden',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 14px',
                            background: ehHoje ? '#e0f2fe' : '#f1f5f9',
                            borderBottom: '1px solid #cbd5e1',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <strong
                            style={{
                              fontSize: '12.5px',
                              color: ehHoje ? '#0369a1' : '#1e293b',
                            }}
                          >
                            📅 {ehHoje ? `HOJE (${dataBrTitulo})` : `${idxDia}º DIA ANTERIOR (${dataBrTitulo})`}
                          </strong>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 800,
                              color: '#475569',
                            }}
                          >
                            {listaDoDia.length} cópia(s) salva(s)
                          </span>
                        </div>

                        <div
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {listaDoDia.map((snap) => (
                            <div
                              key={snap.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background:
                                  snap.turno === 'NOITE_1900'
                                    ? '#f8fafc'
                                    : snap.turno === 'MANHA_0730'
                                    ? '#fffbeb'
                                    : '#f0fdf4',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 900,
                                    color: '#0f172a',
                                  }}
                                >
                                  {snap.rotuloTurno}
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: '#475569',
                                    marginTop: '3px',
                                    fontWeight: 600,
                                  }}
                                >
                                  🗂️ <b>{snap.qtdCardsKanban}</b> Cards/Notas no
                                  Kanban • 📝 <b>{snap.qtdContratacoes}</b>{' '}
                                  Contratações • 💸{' '}
                                  <b>{snap.qtdDesembolsosEv}</b> Eventos de
                                  Desembolso
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    baixarSnapshotComoArquivoJson(snap)
                                  }
                                  style={{
                                    width: 'auto',
                                    padding: '6px 10px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    background: '#ffffff',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                  title="Baixar arquivo .JSON desta cópia para o computador"
                                >
                                  📥 Baixar .JSON
                                </button>

                                <button
                                  type="button"
                                  onClick={() => restaurarSnapshotCompleto(snap)}
                                  style={{
                                    width: 'auto',
                                    padding: '6px 14px',
                                    fontSize: '11.5px',
                                    fontWeight: 900,
                                    background: '#15803d',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    boxShadow:
                                      '0 2px 5px rgba(21, 128, 61, 0.25)',
                                  }}
                                >
                                  🔄 Restaurar Este Backup
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}