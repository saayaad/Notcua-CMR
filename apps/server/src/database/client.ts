import { env } from '../config/env.js';
import { createSqliteClient } from './sqlite-client.js';

export const prisma = createSqliteClient(env.DATABASE_URL);
