import { PrismaClient } from '@prisma/client';

export function createSqliteClient(databaseUrl: string) {
  const queryIndex = databaseUrl.indexOf('?');
  const filename = queryIndex < 0 ? databaseUrl : databaseUrl.slice(0, queryIndex);
  const parameters = new URLSearchParams(queryIndex < 0 ? '' : databaseUrl.slice(queryIndex + 1));
  // SQLite has one writer. Queue this process's work instead of competing for write locks.
  parameters.set('connection_limit', '1');
  parameters.set('socket_timeout', '30');
  parameters.set('pool_timeout', '30');
  return new PrismaClient({
    datasourceUrl: `${filename}?${parameters}`,
    transactionOptions: { maxWait: 30_000, timeout: 30_000 },
  });
}

export async function initializeSqliteClient(db: PrismaClient) {
  await db.$connect();
  await db.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await db.$queryRawUnsafe('PRAGMA busy_timeout = 30000');
}
