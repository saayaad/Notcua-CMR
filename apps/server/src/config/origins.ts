import { env } from './env.js';

export const allowedOrigins = [
  ...new Set([
    env.CLIENT_ORIGIN,
    ...env.CLIENT_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    `http://127.0.0.1:${env.PORT}`,
    `http://localhost:${env.PORT}`,
    `http://[::1]:${env.PORT}`,
  ]),
];
const allowed = new Set(allowedOrigins);
export function trustedOrigin(origin: string | undefined): boolean {
  return origin === undefined || allowed.has(origin);
}
