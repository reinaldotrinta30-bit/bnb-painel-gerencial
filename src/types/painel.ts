export interface RegistroContratacao {
  id: string;
  porte: string;
  cliente: string;
  cpf: string;
  valor: string;
  tipo: string;
  situacao: string;
  projetista: string;
  responsavel: string;
  telefone: string;
  data: string;
  obs: string; // Usado para PENDÊNCIAS / OBSERVAÇÕES
  situacaoDetalhada?: string; // Campo livre abaixo de SITUAÇÃO
  espacoAnalise?: string; // ITEM 3: Espaço livre exclusivo no Kanban para análise de conformidade/cálculos
  programa?: string; // Ex: PRONAF MULHER (406), PRONAF ECO (408), PRONAF A - JOVEM (673), etc.
  cadaVezMelhor?: boolean;
  // Campos de Garantia para enriquecer o Card do Kanban (salvo PRONAF A)
  tipoGarantiaKanban?: 'NENHUMA' | 'AVAL' | 'LCGH' | 'LCGA';
  avalistaNome?: string;
  avalistaCpf?: string;
  lcgValor?: string;
  lcgSituacao?: string; // Ex: "OK (AGUARDANDO ASSINAR)", "Na Central", etc.
}

export interface OperacaoBaseDesembolso {
  id: string;
  porte: string;
  cliente: string;
  cpf: string;
  projetista: string;
  op: string;
  valor: string;
  propostaIdOrigem?: string;
}

export interface EventoDesembolso {
  id: string;
  timestamp: number;
  cliente: string;
  op: string;
  valor: string;
  parcela: string;
  situacao: string;
  data: string;
  obs: string;
}

export type EtapaKanban =
  | 'NOTAS'
  | 'CADASTROS'
  | 'PCE'
  | 'S522'
  | 'CONTRATOS'
  | 'DESEMBOLSOS'
  | 'ACOMPANHAMENTO';

export type StatusCorKanban = 'azul' | 'vermelho' | 'amarelo' | 'verde' | 'roxo';

export interface CardKanban {
  id: string;
  etapa: EtapaKanban;
  statusCor: StatusCorKanban;
  texto: string;
  textoPuro?: string;
  dataModificacao: string;
  isNovo?: boolean;
  dataConclusaoNota?: number;
  lembreteData?: string;
  lembreteHora?: string;
  lembreteDispensado?: boolean;
  estagnacaoDispensada?: boolean;
  // Vínculos Bidirecionais (Contratações ⇄ Desembolsos ⇄ Kanban)
  propostaIdVinculada?: string;
  lcgPropostaIdVinculada?: string;
  opDesembolsoVinculada?: string;
  clienteVinculado?: string;
  cpfVinculado?: string;
  porteVinculado?: string;
  tipoOpVinculado?: string;
  valorVinculado?: string;
  situacaoVinculada?: string; // Etapa macro ("Na Agência", "Na Central", "Contratado", etc.)
  situacaoDesembolsoVinculada?: string; // ITEM 7: Situação do Desembolso ("Desembolso Solicitado", "Desembolso Pendente", "Desembolso Efetivado", etc.)
  situacaoDetalhadaVinculada?: string; // Tópicos livres abaixo de SITUAÇÃO
  obsVinculada?: string; // Tópicos livres abaixo de PENDÊNCIAS / OBSERVAÇÕES
  espacoAnaliseVinculado?: string; // ITEM 3: Texto extenso de análise/conformidade (oculto no PDF)
  idsPropostasAgrupadas?: string[]; // ITEM 2: Guarda os IDs de todas as propostas (LCGH + Investimento + Custeio) deste cliente
}