import { setTimeout as delay } from 'node:timers/promises';

const transientCodes = new Set(['P1008', 'P2024', 'P2028', 'P2034']);

export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  wait: (milliseconds: number) => Promise<unknown> = delay,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (attempt >= 2 || typeof code !== 'string' || !transientCodes.has(code)) throw error;
      await wait(250 * 2 ** attempt);
    }
  }
}
