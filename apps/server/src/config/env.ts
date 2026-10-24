import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).default('file:./noctua.db'),
  API_TOKEN: z.string().default(''),
  AUTH_MODE: z.enum(['local', 'firebase']).default('local'),
  FIREBASE_PROJECT_ID: z.string().default(''),
  OWNER_EMAIL: z.string().default(''),
  BACKUP_DIR: z.string().default('backups/system'),
  BODY_LIMIT_MB: z.coerce.number().int().min(1).max(100).default(40),
  WHATSAPP_KEY_FILE: z.string().min(1).default('.secrets/whatsapp.key'),
  WHATSAPP_LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn']).default('silent'),
  WHATSAPP_SYNC_PHOTOS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  WHATSAPP_MAX_RETRIES: z.coerce.number().int().min(0).max(20).default(5),
});

export const env = schema.parse(process.env);
if (
  !['127.0.0.1', 'localhost', '::1'].includes(env.HOST) &&
  env.API_TOKEN.length < 32 &&
  env.AUTH_MODE !== 'firebase'
) {
  throw new Error('Configure API_TOKEN com pelo menos 32 caracteres para acesso fora do computador local.');
}
if (env.AUTH_MODE === 'firebase' && (!env.FIREBASE_PROJECT_ID || !env.OWNER_EMAIL))
  throw new Error('Configure FIREBASE_PROJECT_ID e OWNER_EMAIL antes de ativar Firebase.');
process.env.DATABASE_URL = env.DATABASE_URL;
