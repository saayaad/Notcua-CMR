import { createServer } from 'node:http';
import { createApp } from './app.js';
import { prisma } from './database/client.js';
import { env } from './config/env.js';
import { RealtimeHub } from './realtime/socket.js';
import { WhatsappService } from './modules/whatsapp/whatsapp.service.js';
import { CredentialCipher } from './modules/whatsapp/credential-cipher.js';
import { MessagingService } from './modules/attendance/messaging.service.js';
import { FlowEngine } from './modules/flows/flow.engine.js';
import { SequenceService } from './modules/attendance/sequence.service.js';
import { DeliveryWorker } from './modules/operations/delivery.worker.js';
import { BusinessWorker } from './modules/operations/business.worker.js';
import { AiWorker } from './modules/operations/ai.worker.js';
import { BackupWorker } from './modules/operations/system-backups.js';
import { InactivityWorker } from './modules/operations/inactivity.js';

async function main() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT COUNT(*) FROM ImportBatch`;
  const cipher = await CredentialCipher.load(env.WHATSAPP_KEY_FILE);
  const hub = new RealtimeHub();
  const whatsapp = new WhatsappService(prisma, cipher, hub);
  const messaging = new MessagingService(prisma, whatsapp);
  const sequences = new SequenceService(prisma, whatsapp, messaging);
  const flows = new FlowEngine(prisma, whatsapp, messaging);
  const deliveries = new DeliveryWorker(prisma, whatsapp, messaging, sequences, flows);
  const business = new BusinessWorker(prisma, whatsapp);
  const ai = new AiWorker(prisma, whatsapp, messaging);
  const backups = new BackupWorker(prisma);
  const inactivity = new InactivityWorker(prisma, flows, whatsapp);
  const http = createServer(createApp(prisma, whatsapp, sequences, messaging, flows));
  const io = hub.attach(http, () => whatsapp.list());
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 45_000).unref();
    await flows.stop();
    await deliveries.stop();
    await business.stop();
    await ai.stop();
    await backups.stop();
    await inactivity.stop();
    await sequences.stop();
    await whatsapp.shutdown();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await prisma.$disconnect();
    clearTimeout(deadline);
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
  http.on('error', (error) => {
    console.error('Falha ao iniciar servidor:', error.message);
    void stop().finally(() => {
      process.exitCode = 1;
    });
  });
  await sequences.start();
  await flows.start();
  await deliveries.start();
  business.start();
  ai.start();
  backups.start();
  inactivity.start();
  http.listen(env.PORT, env.HOST, () => {
    console.log(`Noctua: http://${env.HOST}:${env.PORT}/atendimento | Etapa 5`);
    void whatsapp.restore().catch((error: unknown) => {
      console.error(
        'Não foi possível restaurar as sessões WhatsApp.',
        error instanceof Error ? error.name : 'Erro',
      );
    });
  });
}

main().catch(async (error: unknown) => {
  console.error(
    'Não foi possível iniciar. Execute npm run db:deploy e confira .env.',
    error instanceof Error ? error.message : error,
  );
  await prisma.$disconnect();
  process.exitCode = 1;
});
