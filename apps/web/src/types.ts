export interface Session {
  id: string;
  name: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'AWAITING_QR' | 'CONNECTED';
  phoneNumber: string | null;
  qrDataUrl: string | null;
  qrExpiresAt: string | null;
  error: string | null;
}
export interface Label {
  id: string;
  name: string;
  color: string;
  whatsappId: string | null;
}
export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  profilePicture: string | null;
  isGroup: boolean;
  metadata: { note?: string; [key: string]: unknown };
  labels: { label: Label; labelId: string }[];
}
export interface Message {
  id: string;
  text: string | null;
  caption: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  type: string;
  sentAt: string;
  isPtt: boolean;
  isPtv: boolean;
  asViewOnce: boolean;
  fileId: string | null;
  error: string | null;
}
export interface Conversation {
  pinned?: boolean;
  assignedTo?: string;
  id: string;
  sessionId: string;
  contactId: string;
  status: 'OPEN' | 'CLOSED';
  unreadCount: number;
  lastMessageAt: string | null;
  contact: Contact;
  messages: Pick<Message, 'text' | 'caption' | 'type' | 'direction' | 'status'>[];
}
export interface Asset {
  id: string;
  name: string;
  kind: 'MESSAGE' | 'AUDIO' | 'MEDIA' | 'DOCUMENT';
  text: string | null;
  caption: string | null;
  fileId: string | null;
  isFavorite: boolean;
  isPtt: boolean;
  isPtv: boolean;
  asViewOnce: boolean;
  file: { id: string; mimeType: string; filename: string; byteLength: number } | null;
}
export interface Funnel {
  id: string;
  name: string;
  items: { assetId: string; delayBeforeSendMs: number; asset: { name: string; kind: string } }[];
}
export interface Macro {
  id: string;
  name: string;
  text: string | null;
  _count: { actions: number };
}
export interface PixKey {
  id: string;
  name: string;
  type: 'EMAIL' | 'PHONE' | 'CPF' | 'CNPJ' | 'RANDOM';
  value: string;
  merchantName: string;
  merchantCity: string;
  isFavorite: boolean;
}
export interface Library {
  assets: Asset[];
  funnels: Funnel[];
  macros: Macro[];
  pixKeys: PixKey[];
}
export interface Sequence {
  id: string;
  name: string;
  position: number;
  status: string;
  nextRunAt: string;
  error: string | null;
  steps: unknown[];
}
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
