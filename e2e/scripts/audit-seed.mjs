import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.includes('/.audit/') && !databaseUrl?.includes('\\.audit\\'))
  throw new Error('A carga de exemplo só pode usar o banco dentro de .audit.');

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const now = new Date('2026-10-30T12:00:00.000Z');
const sessionId = 'audit-session';

try {
  await db.whatsappSession.create({
    data: {
      id: sessionId,
      name: 'Conexão fictícia da auditoria',
      phoneNumber: '5511999999900',
      status: 'DISCONNECTED',
      autoConnect: false,
      settings: { create: { timezone: 'America/Sao_Paulo' } },
    },
  });

  const labels = [
    { id: 'audit-label-new', name: 'Novo lead', color: '#8B5CF6', position: 0 },
    { id: 'audit-label-budget', name: 'Orçamento', color: '#F59E0B', position: 1 },
    { id: 'audit-label-client', name: 'Cliente', color: '#10B981', position: 2 },
  ];
  await db.label.createMany({ data: labels.map((label) => ({ ...label, sessionId })) });

  const contacts = [
    { id: 'audit-contact-ana', name: 'Ana Exemplo', phoneNumber: '5511999999901', labelId: 'audit-label-new' },
    { id: 'audit-contact-bruno', name: 'Bruno Exemplo', phoneNumber: '5511999999902', labelId: 'audit-label-budget' },
    { id: 'audit-contact-carla', name: 'Carla Exemplo', phoneNumber: '5511999999903', labelId: 'audit-label-client' },
  ];
  for (const [index, contact] of contacts.entries()) {
    await db.contact.create({
      data: {
        id: contact.id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        whatsappJid: `${contact.phoneNumber}@s.whatsapp.net`,
        isSavedContact: true,
        firstInboundAt: new Date(now.getTime() - (index + 1) * 3_600_000),
        metadata: { source: 'AUDIT_FIXTURE', email: `${contact.name.split(' ')[0].toLowerCase()}@example.com` },
        identities: { create: { jid: `${contact.phoneNumber}@s.whatsapp.net` } },
        labels: { create: { labelId: contact.labelId } },
      },
    });
    const conversationId = `audit-conversation-${index + 1}`;
    const sentAt = new Date(now.getTime() - index * 600_000);
    await db.conversation.create({
      data: {
        id: conversationId,
        sessionId,
        contactId: contact.id,
        status: index === 2 ? 'ARCHIVED' : 'OPEN',
        unreadCount: index === 0 ? 2 : 0,
        assignedTo: index === 1 ? 'membro@example.com' : 'admin@example.com',
        firstInboundAt: sentAt,
        lastMessageAt: sentAt,
        hasHistory: true,
        messages: {
          create: [
            {
              id: `audit-message-${index + 1}-in`,
              whatsappMessageId: `audit-wa-${index + 1}-in`,
              direction: 'INBOUND',
              status: 'READ',
              type: 'text',
              text: index === 0 ? 'Olá, gostaria de saber o prazo.' : 'Mensagem fictícia para a auditoria.',
              sentAt: new Date(sentAt.getTime() - 60_000),
            },
            {
              id: `audit-message-${index + 1}-out`,
              whatsappMessageId: `audit-wa-${index + 1}-out`,
              direction: 'OUTBOUND',
              status: 'SENT',
              type: 'text',
              text: 'Resposta fictícia, sem envio ao WhatsApp.',
              sentAt,
            },
          ],
        },
        opportunity: {
          create: { title: `Oportunidade ${contact.name}`, valueInCents: (index + 1) * 10_000 },
        },
      },
    });
  }

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const fileId = `audit-file-${createHash('sha256').update(png).digest('hex').slice(0, 12)}`;
  await db.storedFile.create({
    data: { id: fileId, sha256: createHash('sha256').update(png).digest('hex'), filename: 'imagem-auditoria.png', mimeType: 'image/png', byteLength: png.length, data: png },
  });
  const pdf = Buffer.from('%PDF-1.4\n% arquivo fictício da auditoria\n%%EOF\n');
  const pdfFileId = `audit-file-${createHash('sha256').update(pdf).digest('hex').slice(0, 12)}`;
  await db.storedFile.create({
    data: { id: pdfFileId, sha256: createHash('sha256').update(pdf).digest('hex'), filename: 'documento-auditoria.pdf', mimeType: 'application/pdf', byteLength: pdf.length, data: pdf },
  });
  await db.asset.createMany({ data: [
    { id: 'audit-asset-welcome', kind: 'MESSAGE', name: 'Boas-vindas da auditoria', text: 'Olá, #nome! Esta é uma resposta fictícia.', metadata: { category: 'Auditoria' } },
    { id: 'audit-asset-budget', kind: 'MESSAGE', name: 'Orçamento fictício', text: 'O orçamento fictício está pronto.', metadata: { category: 'Auditoria' } },
    { id: 'audit-asset-image', kind: 'MEDIA', name: 'Imagem fictícia', caption: 'Imagem gerada para teste local.', fileId, metadata: { category: 'Auditoria' } },
    { id: 'audit-asset-document', kind: 'DOCUMENT', name: 'Documento fictício', caption: 'Documento gerado para teste local.', fileId: pdfFileId, metadata: { category: 'Auditoria' } },
  ] });
  await db.funnel.create({
    data: {
      id: 'audit-funnel',
      name: 'Funil fictício da auditoria',
      metadata: { source: 'AUDIT_FIXTURE' },
      items: { create: [
        { position: 0, assetId: 'audit-asset-welcome', delayBeforeSendMs: 0 },
        { position: 1, assetId: 'audit-asset-budget', delayBeforeSendMs: 60_000 },
      ] },
    },
  });
  await db.macro.create({
    data: {
      id: 'audit-macro',
      name: 'Macro fictícia',
      text: 'Macro de auditoria',
      metadata: { source: 'AUDIT_FIXTURE' },
      actions: { create: [{ position: 0, type: 'TEXT', text: 'Texto fictício da macro.' }] },
    },
  });
  await db.flow.create({
    data: {
      id: 'audit-flow',
      name: 'Fluxo fictício',
      sessionId,
      enabled: false,
      metadata: { source: 'AUDIT_FIXTURE' },
      versions: { create: { version: 1, status: 'DRAFT', graph: { nodes: [], edges: [] } } },
    },
  });

  const records = [
    ['settings:departments', 'SETTINGS', { items: [{ name: 'Comercial', label: 'audit-label-budget' }, { name: 'Suporte', label: '' }] }],
    ['team:admin@example.com', 'TEAM', { email: 'admin@example.com', name: 'Administrador Exemplo', role: 'ADMIN', department: 'Comercial', active: true }],
    ['team:membro@example.com', 'TEAM', { email: 'membro@example.com', name: 'Membro Exemplo', role: 'MEMBER', department: 'Suporte', active: true }],
    ['profile:local', 'PROFILE', { name: 'Operador Auditoria', company: 'Empresa Exemplo', segment: 'Testes locais', employees: '3', objective: 'Auditar requisitos', social: '', phone: '5511999999904', completed: true }],
    ['preferences:local', 'PREFERENCES', { brandingName: 'noctua', theme: 'dark', density: 'compact', attendanceCustomizationVersion: 3 }],
    ['settings:features', 'FEATURES', { aiEnabled: false }],
    ['integration:ai', 'AI_SETTINGS', { provider: 'gemini', model: 'modelo-falso-auditoria', instructions: '', knowledge: '', style: '', enabled: false }],
    ['settings:business', 'BUSINESS_SETTINGS', { company: 'Empresa Exemplo', segment: 'Testes locais', distribution: false }],
  ];
  for (const [id, kind, data] of records)
    await db.operationRecord.create({ data: { id, kind, data } });

  const [contactCount, conversationCount, assetCount] = await Promise.all([
    db.contact.count(), db.conversation.count(), db.asset.count(),
  ]);
  console.log(`Auditoria recriada: ${contactCount} contatos, ${conversationCount} conversas, ${assetCount} recursos.`);
} finally {
  await db.$disconnect();
}
