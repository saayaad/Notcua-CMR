import type { Contact } from '../types';
export type OpportunityStatus = 'OPEN' | 'WON' | 'LOST';
export interface CrmCard {
  conversationId: string;
  contact: Pick<Contact, 'id' | 'name' | 'phoneNumber' | 'profilePicture' | 'labels'>;
  title: string;
  valueInCents: number;
  status: OpportunityStatus;
  version: number;
  unreadCount: number;
  attendanceStatus: string;
  lastMessageAt: string | null;
  sync: 'SYNCED' | 'PENDING' | 'FAILED';
}
export interface CrmColumn {
  id: string;
  labelId: string | null;
  name: string;
  color: string;
  description: string;
  whatsappId: string | null;
  conversationIds: string[];
  totalValueInCents: number;
}
export interface CrmBoard {
  cards: CrmCard[];
  columns: CrmColumn[];
  total: number;
  loaded: number;
  limit: number;
  pendingSync: number;
  failedSync: number;
}
export interface CrmMetrics {
  days: number;
  since: string;
  contacts: number;
  attendances: number;
  unread: number;
  active: number;
  openValueInCents: number;
  wonValueInCents: number;
  won: number;
  lost: number;
  conversion: number;
  inbound: number;
  outbound: number;
  activity: { date: string; received: number; sent: number }[];
}
export const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const statusName = { OPEN: 'Em negociação', WON: 'Ganho', LOST: 'Perdido' };
