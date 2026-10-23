import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';
import {
  RegistroContratacao,
  OperacaoBaseDesembolso,
  EventoDesembolso,
  CardKanban,
} from '@/types/painel';

const firebaseConfig = {
  apiKey: 'AIzaSyAMCuod0s-BlTv5Q7YnR4mP2lN_UWao6PY',
  authDomain: 'ferramenta-rural.firebaseapp.com',
  databaseURL: 'https://ferramenta-rural-default-rtdb.firebaseio.com',
  projectId: 'ferramenta-rural',
  storageBucket: 'ferramenta-rural.firebasestorage.app',
  messagingSenderId: '516313081462',
  appId: '1:516313081462:web:32d8624dc48b5b2a252157',
  measurementId: 'G-74Y4QQXWM1',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const dbNuvem = getDatabase(app);

// ============================================================================
// 🛡️ BLINDAGEM SÊNIOR DE AMBIENTE (HOMOLOGAÇÃO / SANDBOX ISOLADO)
// ============================================================================
// Caminho antigo (SOMENTE LEITURA para clonagem inicial - NUNCA recebe escrita!)
const PATH_PRODUCAO_LEGADO = 'sistema_bnb';

// Novo caminho isolado no Firebase para não afetar o HTML antigo em uso
const PATH_SANDBOX_V2 = 'sistema_bnb_v2_homolog';

// Chaves de cache local exclusivas da V2 (não sobrescrevem o localStorage do HTML antigo)
export const STORAGE_KEYS_V2 = {
  CONTRATACOES: 'bnb_v2_sandbox_contratacoes',
  DESEMB_OP: 'bnb_v2_sandbox_desemb_op',
  DESEMB_EV: 'bnb_v2_sandbox_desemb_ev',
  KANBAN: 'bnb_v2_sandbox_kanban',
  JA_CLONOU_INICIAL: 'bnb_v2_sandbox_clonado_ok',
  MODO_ESTRITO_LOCAL: 'bnb_v2_modo_estrito_local',
};

function safeSetLocal(key: string, data: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Aviso: Espaço local cheio para ${key}.`, e);
  }
}

export function lerCacheLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function isModoEstritoLocal(): boolean {
  if (typeof window === 'undefined') return false;
  const salvo = window.localStorage.getItem(STORAGE_KEYS_V2.MODO_ESTRITO_LOCAL);
  // Agora inicia com a Nuvem V2 ATIVA por padrão (false = não restrito apenas ao local)
  return salvo === null ? false : salvo === 'true';
}

export function setModoEstritoLocal(apenasLocal: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS_V2.MODO_ESTRITO_LOCAL, String(apenasLocal));
}

// ============================================================================
// FUNÇÕES DE SALVAMENTO BLINDADAS (Gravam no LocalStorage V2 e, se autorizado, no Sandbox V2)
// ============================================================================
// Funções de Salvamento Híbrido com Limpeza de Undefined para o Firebase
export async function salvarContratacoesSync(dados: RegistroContratacao[]) {
  safeSetLocal(STORAGE_KEYS_V2.CONTRATACOES, dados);
  if (isModoEstritoLocal()) return;
  try {
    const dadosLimpos = JSON.parse(JSON.stringify(dados));
    await set(ref(dbNuvem, `${PATH_SANDBOX_V2}/contratacoes`), dadosLimpos);
  } catch (e) {
    console.error('Erro ao salvar contratações no Sandbox V2:', e);
  }
}

export async function salvarDesembOpSync(dados: OperacaoBaseDesembolso[]) {
  safeSetLocal(STORAGE_KEYS_V2.DESEMB_OP, dados);
  if (isModoEstritoLocal()) return;
  try {
    const dadosLimpos = JSON.parse(JSON.stringify(dados));
    await set(ref(dbNuvem, `${PATH_SANDBOX_V2}/desemb_op`), dadosLimpos);
  } catch (e) {
    console.error('Erro ao salvar operações base no Sandbox V2:', e);
  }
}

export async function salvarDesembEvSync(dados: EventoDesembolso[]) {
  safeSetLocal(STORAGE_KEYS_V2.DESEMB_EV, dados);
  if (isModoEstritoLocal()) return;
  try {
    const dadosLimpos = JSON.parse(JSON.stringify(dados));
    await set(ref(dbNuvem, `${PATH_SANDBOX_V2}/desemb_ev`), dadosLimpos);
  } catch (e) {
    console.error('Erro ao salvar eventos no Sandbox V2:', e);
  }
}

export async function salvarKanbanSync(dados: CardKanban[]) {
  safeSetLocal(STORAGE_KEYS_V2.KANBAN, dados);
  if (isModoEstritoLocal()) return;
  try {
    const dadosLimpos = JSON.parse(JSON.stringify(dados));
    await set(ref(dbNuvem, `${PATH_SANDBOX_V2}/kanban_tarefas`), dadosLimpos);
  } catch (e) {
    console.error('Erro ao salvar Kanban no Sandbox V2:', e);
  }
}

// ============================================================================
// CLONAGEM SOMENTE-LEITURA DA PRODUÇÃO (Importa os dados atuais sem afetar o HTML antigo)
// ============================================================================
export async function clonarDadosDaProducaoLegada(): Promise<{
  contratacoes: RegistroContratacao[];
  desembOp: OperacaoBaseDesembolso[];
  desembEv: EventoDesembolso[];
  kanban: CardKanban[];
  sucesso: boolean;
}> {
  try {
    const snapLegado = await get(ref(dbNuvem, PATH_PRODUCAO_LEGADO));
    if (snapLegado.exists()) {
      const val = snapLegado.val();
      const contratacoes: RegistroContratacao[] = Array.isArray(val.contratacoes)
        ? val.contratacoes
        : [];
      const desembOp: OperacaoBaseDesembolso[] = Array.isArray(val.desemb_op)
        ? val.desemb_op
        : [];
      const desembEv: EventoDesembolso[] = Array.isArray(val.desemb_ev)
        ? val.desemb_ev
        : [];
      const kanban: CardKanban[] = val.kanban_tarefas
        ? normalizarDadosKanban(val.kanban_tarefas)
        : [];

      // Salva tudo no cache isolado da V2
      safeSetLocal(STORAGE_KEYS_V2.CONTRATACOES, contratacoes);
      safeSetLocal(STORAGE_KEYS_V2.DESEMB_OP, desembOp);
      safeSetLocal(STORAGE_KEYS_V2.DESEMB_EV, desembEv);
      safeSetLocal(STORAGE_KEYS_V2.KANBAN, kanban);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS_V2.JA_CLONOU_INICIAL, 'true');
      }

      return { contratacoes, desembOp, desembEv, kanban, sucesso: true };
    }
  } catch (e) {
    console.warn('Não foi possível ler a nuvem legada, tentando cache local legado...', e);
  }

  // Fallback: lê do localStorage antigo se estiver no mesmo navegador sem internet
  const contratacoes = lerCacheLocal<RegistroContratacao[]>('bnb_db_contratacoes_v1', []);
  const desembOp = lerCacheLocal<OperacaoBaseDesembolso[]>('bnb_db_op_desemb_v1', []);
  const desembEv = lerCacheLocal<EventoDesembolso[]>('bnb_db_ev_desemb_v1', []);
  const kanban = normalizarDadosKanban(lerCacheLocal<unknown>('kanban_backup_local', []));

  safeSetLocal(STORAGE_KEYS_V2.CONTRATACOES, contratacoes);
  safeSetLocal(STORAGE_KEYS_V2.DESEMB_OP, desembOp);
  safeSetLocal(STORAGE_KEYS_V2.DESEMB_EV, desembEv);
  safeSetLocal(STORAGE_KEYS_V2.KANBAN, kanban);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS_V2.JA_CLONOU_INICIAL, 'true');
  }

  return { contratacoes, desembOp, desembEv, kanban, sucesso: true };
}

// ============================================================================
// CARREGAMENTO INICIAL INTELIGENTE
// ============================================================================
export async function carregarTudoDaNuvem(): Promise<{
  contratacoes: RegistroContratacao[];
  desembOp: OperacaoBaseDesembolso[];
  desembEv: EventoDesembolso[];
  kanban: CardKanban[];
  online: boolean;
  modoLocal: boolean;
}> {
  const modoLocal = isModoEstritoLocal();
  const jaClonou =
    typeof window !== 'undefined' &&
    window.localStorage.getItem(STORAGE_KEYS_V2.JA_CLONOU_INICIAL) === 'true';

  // Na 1ª vez que você abre o sistema novo, ele tira uma "foto" (somente leitura) do seu Firebase atual!
  if (!jaClonou) {
    const clone = await clonarDadosDaProducaoLegada();
    return { ...clone, online: true, modoLocal };
  }

  const localContrat = lerCacheLocal<RegistroContratacao[]>(STORAGE_KEYS_V2.CONTRATACOES, []);
  const localOp = lerCacheLocal<OperacaoBaseDesembolso[]>(STORAGE_KEYS_V2.DESEMB_OP, []);
  const localEv = lerCacheLocal<EventoDesembolso[]>(STORAGE_KEYS_V2.DESEMB_EV, []);
  const localKanban = normalizarDadosKanban(
    lerCacheLocal<unknown>(STORAGE_KEYS_V2.KANBAN, [])
  );

  // Se estiver em Modo Estrito Local (Desconectado de envios/recebimentos), usa apenas o banco local V2!
  if (modoLocal) {
    return {
      contratacoes: localContrat,
      desembOp: localOp,
      desembEv: localEv,
      kanban: localKanban,
      online: true,
      modoLocal: true,
    };
  }

  // Se você ativar o Sandbox Nuvem V2, ele lê da pasta separada 'sistema_bnb_v2_homolog'
  try {
    const snapshot = await get(ref(dbNuvem, PATH_SANDBOX_V2));
    if (snapshot.exists()) {
      const val = snapshot.val();
      const contratacoes = Array.isArray(val.contratacoes) ? val.contratacoes : localContrat;
      const desembOp = Array.isArray(val.desemb_op) ? val.desemb_op : localOp;
      const desembEv = Array.isArray(val.desemb_ev) ? val.desemb_ev : localEv;
      const kanban = val.kanban_tarefas
        ? normalizarDadosKanban(val.kanban_tarefas)
        : localKanban;

      safeSetLocal(STORAGE_KEYS_V2.CONTRATACOES, contratacoes);
      safeSetLocal(STORAGE_KEYS_V2.DESEMB_OP, desembOp);
      safeSetLocal(STORAGE_KEYS_V2.DESEMB_EV, desembEv);
      safeSetLocal(STORAGE_KEYS_V2.KANBAN, kanban);

      return { contratacoes, desembOp, desembEv, kanban, online: true, modoLocal: false };
    }
  } catch (err) {
    console.warn('Operando offline no Sandbox V2:', err);
  }

  return {
    contratacoes: localContrat,
    desembOp: localOp,
    desembEv: localEv,
    kanban: localKanban,
    online: false,
    modoLocal: false,
  };
}

export function normalizarDadosKanban(dados: unknown): CardKanban[] {
  if (!dados) return [];
  if (Array.isArray(dados)) return dados as CardKanban[];
  const obj = dados as Record<string, string[]>;
  if (obj.fazer || obj.andamento || obj.concluido) {
    const lista: CardKanban[] = [];
    const hoje = new Date().toISOString().split('T')[0];
    (obj.fazer || []).forEach((txt) =>
      lista.push({
        id: 'wk_' + Date.now() + Math.random(),
        etapa: 'CADASTROS',
        statusCor: 'amarelo',
        texto: txt,
        dataModificacao: hoje,
      })
    );
    (obj.andamento || []).forEach((txt) =>
      lista.push({
        id: 'wk_' + Date.now() + Math.random(),
        etapa: 'PCE',
        statusCor: 'azul',
        texto: txt,
        dataModificacao: hoje,
      })
    );
    (obj.concluido || []).forEach((txt) =>
      lista.push({
        id: 'wk_' + Date.now() + Math.random(),
        etapa: 'DESEMBOLSOS',
        statusCor: 'verde',
        texto: txt,
        dataModificacao: hoje,
      })
    );
    return lista;
  }
  return [];
}

export async function publicarEstadoAtualNaNuvemV2(dados: {
  contratacoes: RegistroContratacao[];
  desembOp: OperacaoBaseDesembolso[];
  desembEv: EventoDesembolso[];
  kanban: CardKanban[];
}): Promise<boolean> {
  setModoEstritoLocal(false);
  try {
    const limpo = JSON.parse(JSON.stringify(dados));
    await Promise.all([
      set(ref(dbNuvem, `${PATH_SANDBOX_V2}/contratacoes`), limpo.contratacoes),
      set(ref(dbNuvem, `${PATH_SANDBOX_V2}/desemb_op`), limpo.desembOp),
      set(ref(dbNuvem, `${PATH_SANDBOX_V2}/desemb_ev`), limpo.desembEv),
      set(ref(dbNuvem, `${PATH_SANDBOX_V2}/kanban_tarefas`), limpo.kanban),
    ]);
    return true;
  } catch (e) {
    console.error('Erro ao publicar estado na nuvem V2:', e);
    return false;
  }
}