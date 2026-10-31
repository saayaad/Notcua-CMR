import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { createSqliteClient } from '../src/database/sqlite-client.js';
import request from 'supertest';
import { BackupService } from '../src/modules/backups/backup.service.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { decodeBase64 } from '../src/modules/backups/validation.js';
import { stableDigest, stableStringify, digest } from '../src/modules/backups/validation.js';
import { setTimeout as delay } from 'node:timers/promises';
import { DeliveryWorker } from '../src/modules/operations/delivery.worker.js';

const directory = await mkdtemp(join(tmpdir(), 'noctua-test-'));
const db = createSqliteClient(`file:${join(directory, 'test.db').replace(/\\/g, '/')}`);
const copyDb = new PrismaClient({ datasourceUrl: `file:${join(directory, 'copy.db').replace(/\\/g, '/')}` });
const service = new BackupService(db);
const fixture = JSON.parse(
  await readFile(new URL('../../../examples/ZV_backup.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const prismaCli = fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url));
const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));

before(async () => {
  for (const filename of ['test.db', 'copy.db']) {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], {
      env: {
        ...process.env,
        RUST_LOG: 'info',
        DATABASE_URL: `file:${join(directory, filename).replace(/\\/g, '/')}`,
      },
      stdio: 'pipe',
    });
  }
  await db.$connect();
  await copyDb.$connect();
});
after(async () => {
  await db.$disconnect();
  await copyDb.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test('REQ-076/077/080/081/082: importa módulos, mídia e converte segundos de macros', async () => {
  const report = await service.import(fixture, 'teste.json');
  assert.equal(report.duplicate, false);
  assert.deepEqual(report.counts, {
    assets: 2,
    files: 1,
    labels: 1,
    contacts: 1,
    macros: 1,
    funnels: 1,
    flows: 1,
  });
  const file = await db.storedFile.findFirstOrThrow();
  assert.equal(Buffer.from(file.data).toString(), 'Noctua');
  const message = await db.asset.findUniqueOrThrow({ where: { id: 'msg-boas-vindas' } });
  assert.equal(message.kind, 'MESSAGE');
  assert.equal(message.text, 'Olá, #nome! Como posso ajudar?');
  const audio = await db.asset.findUniqueOrThrow({ where: { id: 'audio-exemplo' }, include: { file: true } });
  assert.equal(audio.kind, 'AUDIO');
  assert.equal(audio.file?.mimeType, 'text/plain');
  const label = await db.label.findUniqueOrThrow({ where: { id: 'label-novo' } });
  assert.equal(label.name, 'Novo lead');
  const funnel = await db.funnel.findUniqueOrThrow({ where: { id: 'funil-inicial' }, include: { items: true } });
  assert.equal(funnel.items.length, 1);
  assert.equal(funnel.items[0]!.assetId, 'msg-boas-vindas');
  const action = await db.macroAction.findFirstOrThrow({ where: { type: 'TEXT' } });
  assert.equal(action.waitMs, 1000);
  assert.equal(action.composingMs, 2000);
  const flow = await db.flow.findUniqueOrThrow({ where: { id: 'fluxo-inicial' }, include: { versions: true } });
  assert.equal(flow.enabled, false);
  assert.deepEqual(flow.versions.map((version) => version.status), ['DRAFT']);
  assert.equal(await db.flowNode.count(), 4);
  assert.deepEqual(
    (await db.importBatch.findUniqueOrThrow({ where: { id: report.batchId } })).payload,
    fixture,
  );
});

test('reimportação é idempotente mesmo com outra ordem das chaves', async () => {
  const reverse = Object.fromEntries(Object.entries(fixture).reverse());
  assert.equal((await service.import(reverse)).duplicate, true);
  assert.equal(await db.asset.count(), 2);
  assert.equal(await db.flowVersion.count(), 1);
});

test('referência inválida desfaz arquivos, etiquetas e ativos da transação', async () => {
  const counts = [
    await db.asset.count(),
    await db.storedFile.count(),
    await db.label.count(),
    await db.importBatch.count(),
  ];
  await assert.rejects(
    service.import({
      messages: [{ id: 'rollback', text: 'texto' }],
      labels: [{ id: 'rollback-label', name: 'Rollback' }],
      objectsList: [{ id: 'rollback-file', base64: 'YWJj' }],
      funnels: [{ id: 'bad', name: 'Falha', itemsSequence: [{ itemId: 'ausente', type: 'message' }] }],
    }),
    /ausente/,
  );
  assert.deepEqual(
    [
      await db.asset.count(),
      await db.storedFile.count(),
      await db.label.count(),
      await db.importBatch.count(),
    ],
    counts,
  );
});

test('exportação pode ser importada em outro banco preservando relações e bytes', async () => {
  const exported = JSON.parse(JSON.stringify(await service.export())) as unknown;
  const report = await new BackupService(copyDb).import(exported);
  assert.equal(report.counts.assets, 2);
  assert.equal(await copyDb.contactLabel.count(), 1);
  assert.equal(await copyDb.funnelItem.count(), 1);
  assert.equal(await copyDb.flowNode.count(), 4);
  assert.equal(Buffer.from((await copyDb.storedFile.findFirstOrThrow()).data).toString(), 'Noctua');
});

test('aceita macros isoladas como array e objectsList em mapa', async () => {
  const macro = { id: 'isolada', name: 'Isolada', acao: [{ type: 'txt', text: 'Oi' }] };
  assert.equal((await service.import([macro])).format, 'respostasRapidasAcao');
  const report = await service.import({
    ZV_backup: {
      docs: [{ id: 'doc-map', objectId: 'mapa' }],
      objectsList: { mapa: 'data:text/plain;base64,bWFwYQ==' },
    },
  });
  assert.equal(report.counts.files, 1);
});

test('rejeita Base64 inválido, IDs duplicados, nós órfãos e tipos incompatíveis', async () => {
  assert.throws(() => decodeBase64('%%invalido'), /Base64/);
  await assert.rejects(
    service.import({
      messages: [
        { id: 'dup', text: 'a' },
        { id: 'dup', text: 'b' },
      ],
    }),
    /duplicado/,
  );
  await assert.rejects(
    service.import({
      flows: [
        { id: 'bad-flow', name: 'Bad', nodes: [{ id: 'start', type: 'start', nextNodeIds: ['missing'] }] },
      ],
    }),
    /inexistente/,
  );
  await assert.rejects(
    service.import({
      funnels: [
        { id: 'bad-type', name: 'Bad', itemsSequence: [{ itemId: 'msg-boas-vindas', type: 'audio' }] },
      ],
    }),
    /incompatível/,
  );
});

test('HTTP: health, importação, exportação, original, mídia, erros e autenticação', async () => {
  const app = createApp(db);
  await request(app).get('/health').expect(200);
  const imported = await request(app).post('/api/backups/import').send(fixture).expect(200);
  assert.equal(imported.body.duplicate, true);
  await request(app).get('/api/backups/export').expect(200).expect('Content-Type', /json/);
  const original = await request(app)
    .get(`/api/backups/imports/${imported.body.batchId}/original`)
    .expect(200);
  assert.deepEqual(original.body, fixture);
  const file = await db.storedFile.findFirstOrThrow({ where: { mimeType: 'text/plain' } });
  await request(app)
    .get(`/api/files/${file.id}`)
    .expect(200)
    .expect('Content-Disposition', /attachment/);
  await request(app).post('/api/backups/import').send({ invalid: true }).expect(422);
  await request(app)
    .post('/api/backups/import')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  await request(app).get('/api/files/missing').expect(404);
  env.API_TOKEN = 'token-de-teste';
  try {
    await request(app).get('/api/backups/export').expect(401);
    await request(app).get('/api/backups/export').set('Authorization', 'Bearer token-de-teste').expect(200);
  } finally {
    env.API_TOKEN = '';
  }
});
test('hash incremental preserva a identidade dos backups existentes', () => {
  assert.equal(stableDigest(fixture), digest(stableStringify(fixture)));
});
test('Sutofly recupera nomes cifrados, propriedades, áudio, figurinha, PIX, fluxo incompleto e configurações', async () => {
  const input = JSON.parse(
    await readFile(new URL('../../../examples/Sutofly_backup_ficticio.json', import.meta.url), 'utf8'),
  );
  const session = await db.whatsappSession.create({ data: { name: 'Sutofly fictício' } });
  const result = await service.import(input, 'sutofly.json', { sessionId: session.id });
  assert.equal(result.format, 'Sutofly');
  assert.equal(result.counts.macros, 2);
  assert.equal(
    (await db.macro.findUniqueOrThrow({ where: { id: 'suto-script-a' } })).name,
    'Roteiro fictício',
  );
  const actions = await db.macroAction.findMany({
    where: { macroId: 'suto-script-a' },
    orderBy: { position: 'asc' },
    include: { file: true },
  });
  assert.equal(actions[0]!.waitMs, 2000);
  assert.equal(actions[0]!.composingMs, 3000);
  assert.equal((actions[1]!.payload as { send: { kind: string } }).send.kind, 'audio');
  assert.equal((actions[2]!.payload as { send: { kind: string } }).send.kind, 'sticker');
  assert.equal((actions[3]!.text ?? '').includes('PIX'), true);
  assert.equal(actions[4]!.labelId, 'sutofly:label:12');
  assert.equal((actions[1]!.payload as { base64?: string }).base64, undefined);
  assert.equal(actions[1]!.file?.mimeType, 'audio/mpeg');
  const flow = await db.flow.findUniqueOrThrow({ where: { id: 'suto-flow' }, include: { versions: true } });
  assert.equal(flow.enabled, false);
  assert.equal(flow.sessionId, session.id);
  assert.equal(flow.versions[0]!.status, 'DRAFT');
  const graph = flow.versions[0]!.graph as {
    nodes: {
      type: string;
      data: { expirationTimeoutInMs?: number; simulationDelay?: number; triggerMode?: string };
    }[];
  };
  assert.equal(graph.nodes.find((n) => n.type === 'user-input')?.data.expirationTimeoutInMs, 300000);
  assert.equal(graph.nodes.find((n) => n.type === 'start')?.data.triggerMode, 'any');
  assert.equal(graph.nodes.find((n) => n.type === 'text')?.data.simulationDelay, 2000);
  assert.ok(result.warnings.some((w) => w.includes('1 mídias')));
  assert.equal(result.configurations?.schedules, 1);
  assert.equal(result.preferences?.replacements, '#teste=Valor fictício');
  const schedule = await db.operationRecord.findUniqueOrThrow({
    where: { id: 'sutofly:schedule:schedule-suto' },
  });
  assert.equal((schedule.data as { status: string }).status, 'DRAFT');
  assert.equal(await db.deliveryTask.count({ where: { batchId: schedule.id } }), 1);
  const settings = await db.operationRecord.findUniqueOrThrow({ where: { id: 'settings:backups' } });
  assert.equal((settings.data as { time: string }).time, '10:30');
  assert.equal((settings.data as { automatic: boolean }).automatic, false);
  assert.equal((await service.import(input)).duplicate, true);
  const exported = await service.export();
  await new BackupService(copyDb).import(exported);
  const copied = await copyDb.macroAction.findFirstOrThrow({
    where: { macroId: 'suto-script-a', position: 1 },
    include: { file: true },
  });
  assert.equal(copied.file?.mimeType, 'audio/mpeg');
});
test('Sutofly reutiliza etiquetas existentes da conexão em vez de criar cópias', async () => {
  const input = JSON.parse(
    await readFile(new URL('../../../examples/Sutofly_backup_ficticio.json', import.meta.url), 'utf8'),
  );
  const session = await copyDb.whatsappSession.create({ data: { name: 'Conexão de teste de etiquetas' } });
  await copyDb.label.create({
    data: {
      id: 'existing-whatsapp-12',
      name: 'Nome atual preservado',
      sessionId: session.id,
      whatsappId: '12',
    },
  });
  const imported = await new BackupService(copyDb).import(input, 'sutofly.json', { sessionId: session.id });
  assert.ok(imported.warnings.some((w) => w.includes('1 etiquetas dos scripts')));
  const action = await copyDb.macroAction.findFirstOrThrow({
    where: { macroId: 'suto-script-a', type: 'ADD_LABEL' },
  });
  assert.equal(action.labelId, 'existing-whatsapp-12');
  assert.equal(
    (await copyDb.label.findUniqueOrThrow({ where: { id: 'existing-whatsapp-12' } })).name,
    'Nome atual preservado',
  );
});
async function waitForImport(app: ReturnType<typeof createApp>, id: string) {
  for (let i = 0; i < 1200; i++) {
    const response = await request(app)
      .get('/api/backups/jobs/' + encodeURIComponent(id))
      .expect(200);
    if (['COMPLETED', 'FAILED'].includes(response.body.status)) return response.body;
    await delay(100);
  }
  throw new Error('Importação não concluiu no tempo de teste.');
}
test('REQ-521 upload de backup acima de 100 MiB aceita mídia grande via API e processa em segundo plano', async () => {
  const oldLimit = env.BODY_LIMIT_MB;
  env.BODY_LIMIT_MB = 1;
  const app = createApp(db);
  try {
    const payload = {
      medias: [
        {
          id: 'large-backup-file',
          name: 'Mídia grande fictícia',
          base64: 'data:video/mp4;base64,' + Buffer.alloc(76 * 1024 * 1024, 65).toString('base64'),
        },
      ],
    };
    const body = JSON.stringify(payload);
    assert.ok(Buffer.byteLength(body) > 100 * 1024 * 1024);
    const response = await request(app)
      .post('/api/backups/upload')
      .set('Content-Type', 'application/json')
      .set('X-Backup-Name', encodeURIComponent('backup grande.json'))
      .send(body)
      .expect(202);
    const result = await waitForImport(app, response.body.id);
    assert.equal(result.status, 'COMPLETED', result.error);
    assert.equal(result.report.counts.files, 1);
    const asset = await db.asset.findUniqueOrThrow({
      where: { id: 'large-backup-file' },
      include: { file: true },
    });
    assert.equal(asset.file?.byteLength, 76 * 1024 * 1024);
  } finally {
    env.BODY_LIMIT_MB = oldLimit;
  }
});
test('upload inválido falha sem gravar importação e exige autenticação antes de receber o arquivo', async () => {
  const app = createApp(db);
  const before = await db.importBatch.count();
  const response = await request(app)
    .post('/api/backups/upload')
    .set('Content-Type', 'application/json')
    .send('{invalid')
    .expect(202);
  assert.equal((await waitForImport(app, response.body.id)).status, 'FAILED');
  assert.equal(await db.importBatch.count(), before);
  env.API_TOKEN = 'token-ficticio';
  try {
    await request(app)
      .post('/api/backups/upload')
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(401);
  } finally {
    env.API_TOKEN = '';
  }
});

test('backup ZapVoice importa imagem e vídeo válidos com bytes preservados', async () => {
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
  const png = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=green:s=16x16:d=0.1',
    '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1',
  ], { windowsHide: true });
  const mp4 = execFileSync(ffmpeg, [
    '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=green:s=32x32:d=0.1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov', 'pipe:1',
  ], { windowsHide: true });
  const report = await service.import({
    ZV_backup: {
      type: 'full',
      messages: [],
      medias: [
        { id: 'zv-image-test', name: 'Imagem de exemplo', objectId: 'zv-image-object' },
        { id: 'zv-video-test', name: 'Vídeo de exemplo', objectId: 'zv-video-object' },
      ],
      objectsList: [
        { id: 'zv-image-object', filename: 'amostra.png', data: `data:image/png;base64,${png.toString('base64')}` },
        { id: 'zv-video-object', filename: 'amostra.mp4', data: `data:video/mp4;base64,${mp4.toString('base64')}` },
      ],
    },
  }, 'zapvoice-midias-ficticias.json');
  assert.equal(report.format, 'ZV_backup');
  assert.equal(report.counts.assets, 2);
  assert.equal(report.counts.files, 2);
  const exported = await service.export();
  for (const [id, mimeType, expected] of [
    ['zv-image-test', 'image/png', png],
    ['zv-video-test', 'video/mp4', mp4],
  ] as const) {
    const asset = await db.asset.findUniqueOrThrow({ where: { id }, include: { file: true } });
    assert.equal(asset.kind, 'MEDIA');
    assert.equal(asset.file?.mimeType, mimeType);
    assert.deepEqual(Buffer.from(asset.file!.data), expected);
    const exportedAsset = exported.medias.find((item) => item.id === id);
    const exportedFile = exported.objectsList.find((item) => item.id === exportedAsset?.objectId);
    assert.equal(exportedFile?.mimeType, mimeType);
    assert.deepEqual(Buffer.from(exportedFile!.base64, 'base64'), expected);
  }
});

test('REQ-079: importa documento Base64 com MIME e bytes preservados e reexporta a referência', async () => {
  const bytes = Buffer.from('%PDF-1.4\nFixture documental fictícia.\n', 'utf8');
  const report = await service.import({
    format: 'ZV_backup',
    docs: [{ id: 'req079-document', name: 'Contrato fictício', objectId: 'req079-object' }],
    objectsList: [{ id: 'req079-object', filename: 'contrato-ficticio.pdf', mimeType: 'application/pdf', base64: bytes.toString('base64') }],
  }, 'REQ-079-documento-ficticio.json');
  assert.equal(report.counts.assets, 1);
  assert.equal(report.counts.files, 1);
  const document = await db.asset.findUniqueOrThrow({ where: { id: 'req079-document' }, include: { file: true } });
  assert.equal(document.kind, 'DOCUMENT');
  assert.equal(document.file?.mimeType, 'application/pdf');
  assert.deepEqual(Buffer.from(document.file!.data), bytes);
  const exported = await service.export();
  const doc = exported.docs.find((item) => item.id === 'req079-document');
  assert.equal(doc?.objectId, document.fileId);
  const object = exported.objectsList.find((item) => item.id === document.fileId);
  assert.equal(object?.mimeType, 'application/pdf');
  assert.deepEqual(Buffer.from(object!.base64, 'base64'), bytes);
  const directory = fileURLToPath(new URL('../../../REVISAO/evidencias/REQ-079/', import.meta.url));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'sqlite-temporario.json'), JSON.stringify({
    req: 'REQ-079', result: 'APROVADO', database: 'SQLite temporário descartável',
    assetKind: document.kind, mimeType: document.file?.mimeType, bytes: bytes.byteLength,
    reexportedBytes: Buffer.from(object!.base64, 'base64').byteLength,
  }, null, 2), 'utf8');
});

test('REQ-089: mantém nove agendamentos Sutofly e fluxo como rascunhos na conexão de teste', async () => {
  const input = JSON.parse(
    await readFile(new URL('../../../examples/Sutofly_backup_ficticio.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  const schedules = Array.from({ length: 9 }, (_, index) => ({
    id: `req089-schedule-${index + 1}`,
    data: '2000-01-01',
    hora: '10:30',
    titulo: `Agendamento descartável ${index + 1}`,
    mensagem: 'Lembrete fictício de auditoria.',
    userID: String(5511999000800 + index),
    tipo: 'txt',
  }));
  input.agendamentosNaoDisparados = schedules;
  const session = await db.whatsappSession.create({ data: { name: 'Conexão Teste fictícia REQ-089' } });
  const report = await service.import(input, 'REQ-089-sutofly-nove-agendamentos.json', { sessionId: session.id });
  assert.equal(report.format, 'Sutofly');
  assert.equal(report.configurations?.schedules, 9);
  const batchIds = schedules.map((schedule) => `sutofly:schedule:${schedule.id}`);
  for (const id of batchIds) {
    const record = await db.operationRecord.findUniqueOrThrow({ where: { id } });
    assert.equal((record.data as { status: string; sessionId: string }).status, 'DRAFT');
    assert.equal((record.data as { status: string; sessionId: string }).sessionId, session.id);
  }
  const flow = await db.flow.findUniqueOrThrow({ where: { id: 'suto-flow' }, include: { versions: true } });
  assert.equal(flow.enabled, false);
  assert.ok(flow.versions.every((version) => version.status === 'DRAFT'));
  const queuedBefore = await db.deliveryTask.count({ where: { batchId: { in: batchIds }, status: 'QUEUED' } });
  assert.equal(queuedBefore, 9);
  const sends: unknown[] = [];
  const messaging = { send: async (...args: unknown[]) => { sends.push(args); } } as never;
  const worker = new DeliveryWorker(db, {} as never, messaging, {} as never);
  await worker.flush();
  assert.equal(await db.deliveryTask.count({ where: { batchId: { in: batchIds }, status: 'QUEUED' } }), 9);
  assert.deepEqual(sends, []);
  const directory = fileURLToPath(new URL('../../../REVISAO/evidencias/REQ-089/', import.meta.url));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'sqlite-temporario.json'), JSON.stringify({
    req: 'REQ-089', result: 'APROVADO', database: 'SQLite temporário descartável',
    source: 'fixture Sutofly fictício, não arquivo histórico', session: 'Conexão Teste fictícia',
    schedules: 9, status: 'DRAFT', flowEnabled: false, queuedTasksRetained: 9, sends: 0,
  }, null, 2), 'utf8');
});

test('REQ-090: importa ZapVoice na conexão fictícia com todos os fluxos desativados', async () => {
  const session = await db.whatsappSession.create({ data: { name: 'Conexão Teste fictícia REQ-090' } });
  const result = await service.import({
    type: 'full',
    messages: [{ id: 'req090-message', name: 'Texto fictício' }],
    objectsList: [{ id: 'req090-message', data: 'Mensagem fictícia de auditoria.' }],
    flows: [{
      id: 'req090-flow', name: 'Fluxo fictício ZapVoice',
      draft: { nodes: [{ id: 'req090-text', type: 'text', position: { x: 120, y: 0 }, data: { itemId: 'req090-message', nextNodeIds: [] } }], edges: [] },
      draftStartNode: { id: 'req090-start', type: 'start', position: { x: 0, y: 0 }, data: { nextNodeIds: ['req090-text'] } },
    }],
  }, 'REQ-090-zapvoice-ficticio.json', { sessionId: session.id });
  assert.equal(result.duplicate, false);
  assert.ok(result.warnings.some((warning) => warning.includes('ZapVoice importados desativados')));
  const flow = await db.flow.findUniqueOrThrow({ where: { id: 'req090-flow' }, include: { versions: true } });
  assert.equal(flow.sessionId, session.id);
  assert.equal(flow.enabled, false);
  assert.deepEqual(flow.versions.map((version) => version.status), ['DRAFT']);
  const batch = await db.importBatch.findFirstOrThrow({ where: { sourceName: 'REQ-090-zapvoice-ficticio.json' } });
  assert.deepEqual(batch.payload, {
    type: 'full',
    messages: [{ id: 'req090-message', name: 'Texto fictício' }],
    objectsList: [{ id: 'req090-message', data: 'Mensagem fictícia de auditoria.' }],
    flows: [{
      id: 'req090-flow', name: 'Fluxo fictício ZapVoice',
      draft: { nodes: [{ id: 'req090-text', type: 'text', position: { x: 120, y: 0 }, data: { itemId: 'req090-message', nextNodeIds: [] } }], edges: [] },
      draftStartNode: { id: 'req090-start', type: 'start', position: { x: 0, y: 0 }, data: { nextNodeIds: ['req090-text'] } },
    }],
  });
  const directory = fileURLToPath(new URL('../../../REVISAO/evidencias/REQ-090/', import.meta.url));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'sqlite-temporario.json'), JSON.stringify({
    req: 'REQ-090', result: 'APROVADO', database: 'SQLite temporário descartável',
    source: 'fixture ZapVoice fictício, não arquivo histórico', session: 'Conexão Teste fictícia',
    flow: 'req090-flow', enabled: flow.enabled, versionStatuses: flow.versions.map((version) => version.status),
  }, null, 2), 'utf8');
});
