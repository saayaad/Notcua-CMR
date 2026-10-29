import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { io as connectSocket } from 'socket.io-client';
import request from 'supertest';
import { AccessService, PLATFORM_OWNER, addMonths } from '../src/modules/access/access.service.js';
import {
  createWorkspaceGateway,
  WorkspaceManager,
  type WorkspaceRuntime,
} from '../src/modules/access/workspaces.js';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import { setDatabasePaths } from '../src/database/paths.js';
import { env } from '../src/config/env.js';
import { authorizeAccount, authorizeToken, verifyRegisteredToken } from '../src/http/auth.js';
import { createApp } from '../src/app.js';
import { WhatsappService } from '../src/modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from '../src/modules/whatsapp/credential-cipher.js';
import { RealtimeHub } from '../src/realtime/socket.js';
import { createSystemBackup } from '../src/modules/operations/system-backups.js';
import { AiWorker } from '../src/modules/operations/ai.worker.js';
import { MessagingService } from '../src/modules/attendance/messaging.service.js';

const directory = await mkdtemp(join(tmpdir(), 'noctua-access-'));
const databasePath = (name: string) => join(directory, name + '.db');
const databaseUrl = (name: string) => `file:${databasePath(name).replace(/\\/g, '/')}`;
const registry = createSqliteClient(databaseUrl('registry'));
const ownerDb = createSqliteClient(databaseUrl('owner'));
const alphaDb = createSqliteClient(databaseUrl('alpha'));
const betaDb = createSqliteClient(databaseUrl('beta'));
const access = new AccessService(registry);
const accounts = {
  owner: { uid: 'platform-owner', email: PLATFORM_OWNER },
  alpha: { uid: 'customer-a', email: 'alpha@example.invalid' },
  beta: { uid: 'customer-b', email: 'beta@example.invalid' },
  staff: { uid: 'staff-user', email: 'staff@example.invalid' },
  preferenceMember: { uid: 'preference-member', email: 'preference-member@example.invalid' },
};
const previous = { mode: env.AUTH_MODE, owner: env.OWNER_EMAIL, project: env.FIREBASE_PROJECT_ID };
const hub = new RealtimeHub();
let a = '';
let b = '';
let app: ReturnType<typeof createApp>;
let runtimes: Map<string, WorkspaceRuntime>;
let manager: WorkspaceManager | undefined;
let alphaKey = '';
let betaKey = '';
before(async () => {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
      'migrate',
      'deploy',
      '--schema',
      fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
    ],
    { env: { ...process.env, DATABASE_URL: databaseUrl('registry'), RUST_LOG: 'info' }, stdio: 'pipe' },
  );
  for (const name of ['owner', 'alpha', 'beta']) await copyFile(databasePath('registry'), databasePath(name));
  env.AUTH_MODE = 'firebase';
  env.OWNER_EMAIL = PLATFORM_OWNER;
  env.FIREBASE_PROJECT_ID = 'noctua-license-test';
  if (!getApps().length) initializeApp({ projectId: 'noctua-license-test' });
  mock.method(getAuth(), 'verifyIdToken', async (token: string) => {
    if (token === 'unverified') return { ...accounts.alpha, email_verified: false };
    const account = accounts[token as keyof typeof accounts];
    if (!account) throw new Error('Invalid token');
    return { ...account, email_verified: true };
  });
  alphaKey = (await access.create(accounts.owner, { label: 'Alpha', months: 1 })).secret;
  betaKey = (await access.create(accounts.owner, { label: 'Beta', months: 3 })).secret;
  a = (await access.activate(accounts.alpha, { key: alphaKey })).id;
  b = (await access.activate(accounts.beta, { key: betaKey })).id;
  const make = (db: typeof registry, id: string) => {
    const whatsapp = new WhatsappService(db, new CredentialCipher(randomBytes(32)), hub.scope(id), () => {
      throw new Error('No external WhatsApp');
    });
    return {
      app: createApp(db, whatsapp, undefined, undefined, undefined, {
        workspaceId: id,
        configureAuth: false,
      }),
      whatsapp,
      stop: () => whatsapp.shutdown(),
    };
  };
  runtimes = new Map([
    ['owner', make(ownerDb, 'owner')],
    [a, make(alphaDb, a)],
    [b, make(betaDb, b)],
  ]);
  app = createWorkspaceGateway(
    registry,
    runtimes.get('owner')!.app,
    async (id) => {
      await access.assertActive(id);
      return runtimes.get(id)!;
    },
    async () => {},
    undefined,
    ownerDb,
  );
  for (const [db, id, text] of [
    [alphaDb, a, 'ALPHA_PRIVATE'],
    [betaDb, b, 'BETA_PRIVATE'],
  ] as const) {
    await db.whatsappSession.create({ data: { id: 'same-session', name: text } });
    const bytes = Buffer.from(text);
    await db.storedFile.create({
      data: {
        id: 'same-file',
        filename: 'review.txt',
        mimeType: 'text/plain',
        byteLength: bytes.length,
        data: bytes,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    });
    await db.asset.create({ data: { id: 'same-asset', name: text, kind: 'MESSAGE', text } });
    setDatabasePaths(db, {
      keyFile: join(directory, id + '.key'),
      backupDir: join(directory, id + '-backups'),
    });
  }
});
after(async () => {
  await manager?.stop();
  for (const runtime of runtimes?.values() ?? []) await runtime.stop();
  mock.restoreAll();
  env.AUTH_MODE = previous.mode;
  env.OWNER_EMAIL = previous.owner;
  env.FIREBASE_PROJECT_ID = previous.project;
  await Promise.all([registry, ownerDb, alphaDb, betaDb].map((db) => db.$disconnect()));
  const target = resolve(directory),
    parent = resolve(tmpdir());
  assert.ok(target.startsWith(parent + '\\') || target.startsWith(parent + '/'));
  await rm(target, { recursive: true, force: true });
});
test('REQ-113: token fictício de e-mail não confirmado é recusado antes do acesso', async () => {
  await assert.rejects(verifyRegisteredToken('unverified'), /Confirme seu e-mail/);
  await request(app)
    .get('/api/access/me')
    .set('Authorization', 'Bearer unverified')
    .expect(403);
});
test('somente o e-mail proprietário gera chaves e o código completo não fica armazenado', async () => {
  await assert.rejects(access.create(accounts.alpha, { label: 'No', months: 1 }), /proprietário/);
  const generated = await access.create(accounts.owner, { label: 'Teste', trialDays: 7 });
  assert.match(generated.secret, /^NOCTUA-/);
  const rows = await registry.operationRecord.findMany({ where: { kind: 'ACCESS_KEY' } });
  assert.ok(!JSON.stringify(rows).includes(generated.secret));
  const listed = await access.list(accounts.owner);
  assert.ok(!JSON.stringify(listed).includes(generated.secret));
  await assert.rejects(access.create(accounts.owner, { label: '', months: 1 }));
  await assert.rejects(access.create(accounts.owner, { label: 'Inválido', months: 2 }));
  await assert.rejects(access.create(accounts.owner, { label: 'Inválido', months: 1, trialDays: 7 }));
});
test('chaves são de uso único, respeitam e-mail reservado e não dão acesso pelo corpo da requisição', async () => {
  await assert.rejects(access.activate(accounts.beta, { key: alphaKey }), /já foi utilizada/);
  const reserved = await access.create(accounts.owner, {
    label: 'Reservada',
    months: 6,
    intendedEmail: 'alpha@example.invalid',
  });
  await assert.rejects(access.activate(accounts.beta, { key: reserved.secret }), /outro e-mail/);
  await request(app)
    .post('/api/access/keys')
    .set('Authorization', 'Bearer alpha')
    .send({ email: PLATFORM_OWNER, label: 'Falsa', months: 1, role: 'ADMIN' })
    .expect(403);
  await request(app).get('/api/access/keys').expect(401);
  await request(app).get('/api/access/keys').set('Authorization', 'Bearer beta').expect(403);
});
test('validade começa na ativação e meses respeitam o último dia do calendário', async () => {
  assert.equal(addMonths(new Date('2026-01-31T12:00:00Z'), 1).toISOString(), '2026-02-28T12:00:00.000Z');
  assert.equal(addMonths(new Date('2028-01-31T12:00:00Z'), 1).toISOString(), '2028-02-29T12:00:00.000Z');
  const dated = new AccessService(registry, () => new Date('2030-05-05T12:00:00Z'));
  const code = await dated.create(accounts.owner, { label: 'Relógio', trialDays: 7 });
  const activated = await new AccessService(registry, () => new Date('2030-05-10T12:00:00Z')).activate(
    { uid: 'clock-user', email: 'clock@example.invalid' },
    { key: code.secret },
  );
  assert.equal(activated.expiresAt, '2030-05-17T12:00:00.000Z');
});
test('duas ativações simultâneas não compartilham a mesma chave', async () => {
  const code = await access.create(accounts.owner, { label: 'Concorrência', months: 12 });
  const results = await Promise.allSettled([
    access.activate({ uid: 'race-a', email: 'race-a@example.invalid' }, { key: code.secret }),
    access.activate({ uid: 'race-b', email: 'race-b@example.invalid' }, { key: code.secret }),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
});
test('HTTP isola conexões, biblioteca, arquivos e preferências mesmo com identificadores iguais', async () => {
  assert.notEqual(a, b);
  for (const [token, expected] of [
    ['alpha', 'ALPHA_PRIVATE'],
    ['beta', 'BETA_PRIVATE'],
  ] as const) {
    const list = await request(app)
      .get('/api/whatsapp/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(list.body.items[0].name, expected);
    const library = await request(app)
      .get('/api/attendance/library')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(library.body.assets[0].text, expected);
    const file = await request(app)
      .get('/api/files/same-file')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(file.text, expected);
    await request(app)
      .put('/api/operations/settings/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ density: token, brandingName: 'forged' })
      .expect(200);
  }
  assert.equal(
    (await request(app).get('/api/operations/settings/preferences').set('Authorization', 'Bearer alpha')).body
      .density,
    'alpha',
  );
  assert.equal(
    (await request(app).get('/api/operations/settings/preferences').set('Authorization', 'Bearer beta')).body
      .brandingName,
    'noctua',
  );
  await request(app).get('/api/files/same-file').set('Authorization', 'Bearer owner').expect(404);
  assert.equal(await ownerDb.asset.count(), 0);
  assert.equal(await alphaDb.operationRecord.count({ where: { kind: 'ACCESS_KEY' } }), 0);
  await request(runtimes.get('owner')!.app)
    .get('/api/attendance/library')
    .set('Authorization', 'Bearer alpha')
    .expect(403);
});
test('REQ-493/494/503/206/208/209/214/215/216: preferências fictícias persistem por usuário', async () => {
  const route = '/api/operations/settings/preferences';
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  const settings = {
    pinnedResourceIds: ['same-asset', 'other-asset'],
    pinnedButtonSettings: {
      'same-asset': { label: 'Primeiro', category: 'Respostas', preview: 'never' },
      'other-asset': { label: 'Segundo', category: 'Respostas', preview: 'always' },
    },
    showPinnedPreview: false,
    menuLabels: { inbox: 'Conversas' },
    folderLabels: { MESSAGE: 'Textos salvos' },
    labelStyles: { 'label-a': { color: '#123456', icon: '★' } },
    brandingLogo: image,
    favicon: image,
    density: 'expanded',
    panelPosition: 'left',
  };
  await request(app).put(route).set('Authorization', 'Bearer alpha').send(settings).expect(200);
  const saved = (await request(app).get(route).set('Authorization', 'Bearer alpha').expect(200)).body;
  assert.deepEqual(saved, { ...settings, brandingName: 'noctua' });
  const reopened = createSqliteClient(databaseUrl('alpha'));
  try {
    const row = await reopened.operationRecord.findUniqueOrThrow({
      where: { id: `preferences:${accounts.alpha.uid}` },
    });
    assert.deepEqual(row.data, saved);
  } finally {
    await reopened.$disconnect();
  }
  assert.notDeepEqual(
    (await request(app).get(route).set('Authorization', 'Bearer beta').expect(200)).body,
    saved,
  );
  const removed = { ...settings, pinnedResourceIds: ['other-asset'] };
  await request(app).put(route).set('Authorization', 'Bearer alpha').send(removed).expect(200);
  assert.deepEqual(
    (await request(app).get(route).set('Authorization', 'Bearer alpha').expect(200)).body.pinnedResourceIds,
    ['other-asset'],
  );
  assert.equal(await alphaDb.asset.count({ where: { id: 'same-asset' } }), 1);

  const binding = { email: accounts.preferenceMember.email, workspaceId: a, role: 'MEMBER', active: true };
  await registry.operationRecord.upsert({
    where: { id: `access-member:${accounts.preferenceMember.email}` },
    create: { id: `access-member:${accounts.preferenceMember.email}`, kind: 'ACCESS_MEMBER', data: binding },
    update: { data: binding },
  });
  const member = { email: accounts.preferenceMember.email, role: 'MEMBER', active: true };
  await alphaDb.operationRecord.upsert({
    where: { id: `team:${accounts.preferenceMember.email}` },
    create: { id: `team:${accounts.preferenceMember.email}`, kind: 'TEAM', data: member },
    update: { data: member },
  });
  await request(app).put(route).set('Authorization', 'Bearer preferenceMember').send({ density: 'medium' }).expect(200);
  assert.equal(
    (await request(app).get(route).set('Authorization', 'Bearer preferenceMember').expect(200)).body.density,
    'medium',
  );
  assert.equal(
    (await request(app).get(route).set('Authorization', 'Bearer alpha').expect(200)).body.density,
    'expanded',
  );
  await request(app).get(route).expect(401);
});
test('atendente não recebe privilégio de outro papel nem mantém acesso depois da desativação', async () => {
  const centralId = `access-member:${accounts.staff.email}`;
  await registry.operationRecord.create({
    data: {
      id: centralId,
      kind: 'ACCESS_MEMBER',
      data: { email: accounts.staff.email, workspaceId: a, role: 'ADMIN', active: true },
    },
  });
  await alphaDb.operationRecord.create({
    data: {
      id: `team:${accounts.staff.email}`,
      kind: 'TEAM',
      data: { email: accounts.staff.email, role: 'MEMBER', active: true },
    },
  });
  await request(app).get('/api/backups/export').set('Authorization', 'Bearer staff').expect(403);
  await registry.operationRecord.update({
    where: { id: centralId },
    data: { data: { email: accounts.staff.email, workspaceId: a, role: 'MEMBER', active: true } },
  });
  await request(app).get('/api/attendance/library').set('Authorization', 'Bearer staff').expect(200);
  await alphaDb.operationRecord.update({
    where: { id: `team:${accounts.staff.email}` },
    data: { data: { email: accounts.staff.email, role: 'MEMBER', active: false } },
  });
  await request(app).get('/api/attendance/library').set('Authorization', 'Bearer staff').expect(403);
});
test('REQ-110/111: setores e equipe persistem com isolamento e permissão de administrador', async () => {
  const departments = { items: [{ name: 'Suporte de teste', label: '' }] };
  await request(app)
    .put('/api/operations/settings/departments')
    .set('Authorization', 'Bearer alpha')
    .send(departments)
    .expect(200);
  assert.deepEqual(
    (await request(app).get('/api/operations/settings/departments').set('Authorization', 'Bearer alpha').expect(200)).body,
    departments,
  );
  assert.deepEqual(
    (await request(app).get('/api/operations/directory').set('Authorization', 'Bearer alpha').expect(200)).body.departments,
    departments.items,
  );
  assert.notDeepEqual(
    (await request(app).get('/api/operations/settings/departments').set('Authorization', 'Bearer beta').expect(200)).body,
    departments,
  );

  const member = {
    email: accounts.staff.email,
    name: 'Atendente de teste',
    role: 'MEMBER',
    active: true,
    department: departments.items[0]!.name,
    avatar: '',
  };
  await request(app).put('/api/operations/team').set('Authorization', 'Bearer alpha').send(member).expect(200);
  const listed = await request(app).get('/api/operations/team').set('Authorization', 'Bearer alpha').expect(200);
  assert.ok(listed.body.items.some((item: { email: string; department: string }) =>
    item.email === member.email && item.department === member.department));

  await request(app)
    .put('/api/operations/settings/departments')
    .set('Authorization', 'Bearer staff')
    .send({ items: [] })
    .expect(403);
  await request(app).get('/api/operations/team').set('Authorization', 'Bearer staff').expect(403);
  await request(app).put('/api/operations/team').set('Authorization', 'Bearer staff').send(member).expect(403);

  const reopened = createSqliteClient(databaseUrl('alpha'));
  try {
    const savedDepartments = await reopened.operationRecord.findUniqueOrThrow({ where: { id: 'settings:departments' } });
    const savedMember = await reopened.operationRecord.findUniqueOrThrow({ where: { id: `team:${member.email}` } });
    assert.deepEqual(savedDepartments.data, departments);
    assert.deepEqual(savedMember.data, member);
    const binding = await registry.operationRecord.findUniqueOrThrow({ where: { id: `access-member:${member.email}` } });
    assert.deepEqual(binding.data, { email: member.email, workspaceId: a, role: 'MEMBER', active: true });
  } finally {
    await reopened.$disconnect();
  }
});
test('REQ-104: perfil persiste por usuário e fica isolado entre espaços', async () => {
  const profile = {
    name: 'Operador fictício',
    company: 'Empresa de teste',
    segment: 'Atendimento',
    employees: '3',
    objective: 'Conferir persistência',
    social: '',
    phone: '62999999999',
    completed: true,
  };
  await request(app).put('/api/operations/me').set('Authorization', 'Bearer alpha').send(profile).expect(200);
  const alpha = await request(app).get('/api/operations/me').set('Authorization', 'Bearer alpha').expect(200);
  const beta = await request(app).get('/api/operations/me').set('Authorization', 'Bearer beta').expect(200);
  assert.deepEqual(alpha.body.profile, profile);
  assert.notDeepEqual(beta.body.profile, profile);

  const reopened = createSqliteClient(databaseUrl('alpha'));
  try {
    const saved = await reopened.operationRecord.findUniqueOrThrow({ where: { id: `profile:${accounts.alpha.uid}` } });
    assert.deepEqual(saved.data, profile);
  } finally {
    await reopened.$disconnect();
  }
});
test('REQ-109: configuração do negócio persiste com isolamento e permissão de administrador', async () => {
  const staffId = `access-member:${accounts.staff.email}`;
  const binding = { email: accounts.staff.email, workspaceId: a, role: 'MEMBER', active: true };
  await registry.operationRecord.upsert({
    where: { id: staffId },
    create: { id: staffId, kind: 'ACCESS_MEMBER', data: binding },
    update: { data: binding },
  });
  const teamId = `team:${accounts.staff.email}`;
  const teamMember = { email: accounts.staff.email, role: 'MEMBER', active: true };
  await alphaDb.operationRecord.upsert({
    where: { id: teamId },
    create: { id: teamId, kind: 'TEAM', data: teamMember },
    update: { data: teamMember },
  });
  const business = {
    company: 'Empresa fictícia',
    schedule: { days: [1, 2, 3, 4, 5], minTime: '08:00', maxTime: '18:00' },
    afterHoursReplyEnabled: true,
    afterHoursReplyText: 'Voltaremos no próximo horário.',
    autoCloseMinutes: 10,
    distribution: false,
  };
  await request(app)
    .put('/api/operations/settings/business')
    .set('Authorization', 'Bearer alpha')
    .send(business)
    .expect(200);
  assert.deepEqual(
    (await request(app).get('/api/operations/settings/business').set('Authorization', 'Bearer alpha').expect(200)).body,
    business,
  );
  assert.notDeepEqual(
    (await request(app).get('/api/operations/settings/business').set('Authorization', 'Bearer beta').expect(200)).body,
    business,
  );
  await request(app)
    .put('/api/operations/settings/business')
    .set('Authorization', 'Bearer staff')
    .send(business)
    .expect(403);
  await request(app)
    .put('/api/operations/settings/business')
    .set('Authorization', 'Bearer alpha')
    .send({ ...business, afterHoursReplyText: '' })
    .expect(422);

  const reopened = createSqliteClient(databaseUrl('alpha'));
  try {
    const saved = await reopened.operationRecord.findUniqueOrThrow({ where: { id: 'settings:business' } });
    assert.deepEqual(saved.data, business);
  } finally {
    await reopened.$disconnect();
  }
});
test('renovação mantém a operação; revogar a licença atual bloqueia acesso sem apagar arquivos', async () => {
  const previous = await access.workspace(a);
  const renewal = await access.create(accounts.owner, { label: 'Renovação', months: 3 });
  const renewed = await access.activate(accounts.alpha, { key: renewal.secret });
  assert.equal(renewed.id, a);
  assert.equal(renewed.expiresAt, addMonths(new Date(previous!.expiresAt), 3).toISOString());
  const old = (await access.list(accounts.owner)).find((item) => item.suffix === alphaKey.slice(-6))!;
  await access.revoke(accounts.owner, old.id);
  await access.assertActive(a);
  await access.revoke(accounts.owner, renewal.id);
  await request(app).get('/api/attendance/library').set('Authorization', 'Bearer alpha').expect(402);
  assert.equal(await alphaDb.storedFile.count(), 1);
  assert.equal(
    (await request(app).get('/api/access/me').set('Authorization', 'Bearer alpha')).body.allowed,
    false,
  );
  const restore = await access.create(accounts.owner, { label: 'Retomada', months: 1 });
  await access.activate(accounts.alpha, { key: restore.secret });
});
test('licença vencida não recebe dados da operação original', async () => {
  const row = await registry.operationRecord.findUniqueOrThrow({ where: { id: `workspace:${b}` } });
  await registry.operationRecord.update({
    where: { id: row.id },
    data: { data: { ...(row.data as object), expiresAt: '2000-01-01T00:00:00Z' } },
  });
  await request(app).get('/api/whatsapp/sessions').set('Authorization', 'Bearer beta').expect(402);
  await registry.operationRecord.update({ where: { id: row.id }, data: { data: row.data! } });
});
test('Socket.IO entrega eventos somente à operação autenticada', async () => {
  const http = createServer(app);
  const io = hub.attach(http, async (identity) =>
    runtimes.get(identity.workspaceId ?? 'owner')!.whatsapp.list(),
  );
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address !== 'string');
  const clients = ['owner', 'alpha', 'beta'].map((token) =>
    connectSocket(`http://127.0.0.1:${address.port}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    }),
  );
  try {
    await Promise.all(
      clients.map(
        (client) =>
          new Promise<void>((resolve, reject) => {
            client.once('connect', resolve);
            client.once('connect_error', reject);
          }),
      ),
    );
    const events: number[] = [0, 0, 0];
    clients.forEach((client, index) =>
      client.on('whatsapp:sync', () => {
        events[index] = (events[index] ?? 0) + 1;
      }),
    );
    hub.scope(a).sync({ sessionId: 'a', kind: 'labels', count: 1 });
    await delay(120);
    assert.deepEqual(events, [0, 1, 0]);
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
});
test('backup do cliente usa sua própria chave e não inclui o registro central de licenças', async () => {
  const backup = await createSystemBackup(alphaDb);
  assert.ok(backup.key.startsWith(directory));
  const copy = createSqliteClient(`file:${backup.database.replace(/\\/g, '/')}`);
  try {
    assert.equal(await copy.operationRecord.count({ where: { kind: 'ACCESS_KEY' } }), 0);
    assert.equal(await copy.storedFile.count(), 1);
  } finally {
    await copy.$disconnect();
  }
});
test('licença vencida bloqueia trabalho de IA antes de chamar o provedor', async () => {
  const row = await registry.operationRecord.findUniqueOrThrow({ where: { id: `workspace:${a}` } });
  await registry.operationRecord.update({
    where: { id: row.id },
    data: { data: { ...(row.data as object), expiresAt: '2000-01-01T00:00:00Z' } },
  });
  const whatsapp = runtimes.get(a)!.whatsapp;
  const worker = new AiWorker(alphaDb, whatsapp, new MessagingService(alphaDb, whatsapp), () =>
    access.assertActive(a),
  );
  try {
    await assert.rejects(worker.flush(), /expirou|suspenso/);
    assert.equal(await alphaDb.operationRecord.count({ where: { kind: 'AI_USAGE' } }), 0);
  } finally {
    await worker.stop();
    await registry.operationRecord.update({ where: { id: row.id }, data: { data: row.data! } });
  }
});
test('provisionamento cria bases novas sem copiar dados do proprietário', async () => {
  const code = await access.create(accounts.owner, { label: 'Provisionamento', months: 1 });
  const space = await access.activate(
    { uid: 'provision-user', email: 'provision@example.invalid' },
    { key: code.secret },
  );
  manager = new WorkspaceManager(registry, runtimes.get('owner')!, hub, join(directory, 'tenant-files'));
  const runtime = await manager.get(space.id);
  assert.equal((await runtime.whatsapp.list()).length, 0);
  assert.equal((await request(runtime.app).get('/health').expect(200)).body.status, 'ok');
  assert.equal((await authorizeAccount(accounts.owner, ownerDb, registry)).workspaceId, 'owner');
  assert.equal((await authorizeToken('beta')).workspaceId, b);
});
