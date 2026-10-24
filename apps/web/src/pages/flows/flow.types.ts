export type BlockType = 'start' | 'text' | 'audio' | 'media' | 'document' | 'delay' | 'user-input';
export interface BlockData {
  triggerMode?: 'keyword' | 'any' | 'first' | 'first-day' | 'manual';
  startLabelId?: string;
  allowedLabelIds?: string[];
  excludedLabelIds?: string[];
  title?: string;
  itemId?: string;
  nextNodeIds?: string[];
  simulationDelay?: number;
  delayInMs?: number;
  keywordRules?: { rule: 'equals' | 'contains' | 'starts' | 'not-contains'; keyword: string }[];
  isCaseSensitive?: boolean;
  sendToContacts?: boolean;
  sendToGroups?: boolean;
  cooldownMs?: number;
  schedule?: { days: number[]; minTime: string; maxTime: string };
  compareRule?: 'anything' | 'contains';
  expectedMessages?: string[];
  expirationTimeoutInMs?: number;
  nextNodeIdOnExpiration?: string;
  nextNodeIdOnDifferentAnswer?: string;
  followUpData?: {
    enabled?: boolean;
    itemId?: string;
    simulationDelay?: number;
    expirationTimeoutInMs?: number;
    nextNodeIdOnExpiration?: string;
  };
}
export interface GraphBlock {
  id: string;
  type: BlockType;
  position: { x: number; y: number };
  data: BlockData;
}
export interface FlowGraph {
  nodes: GraphBlock[];
}
export interface VersionSummary {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  createdAt?: string;
}
export interface FlowSummary {
  id: string;
  name: string;
  enabled: boolean;
  revision: number;
  imported: boolean;
  archived: boolean;
  updatedAt: string;
  latest: VersionSummary | null;
  published: VersionSummary | null;
}
export interface FlowDetail {
  id: string;
  name: string;
  enabled: boolean;
  revision: number;
  archived: boolean;
  imported: boolean;
  graph: FlowGraph;
  versions: VersionSummary[];
  publishedVersion: number | null;
}
export interface FlowRun {
  id: string;
  conversationId: string;
  status: string;
  currentNodeId: string | null;
  nextRunAt: string | null;
  inputExpiresAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { name: string };
  version: { version: number; flow: { id: string; name: string } };
}
export const blockNames: Record<BlockType, string> = {
  start: 'Início',
  text: 'Mensagem',
  audio: 'Áudio',
  media: 'Mídia',
  document: 'Documento',
  delay: 'Espera',
  'user-input': 'Aguardar resposta',
};
export const executionNames: Record<string, string> = {
  QUEUED: 'Aguardando etapa',
  RUNNING: 'Executando',
  WAITING_INPUT: 'Aguardando cliente',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  FAILED: 'Falha',
};
