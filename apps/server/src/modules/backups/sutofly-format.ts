import { createDecipheriv, createHash } from 'node:crypto';
import { AppError } from '../../shared/errors.js';
// Public compatibility constant used by the original extension, not an account credential.
const formatKey = 'ffce211a-7b07-4d91-ba5d-c40bb4034a83';
export function decodeSutofly(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('U2FsdGVkX1')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  try {
    const bytes = Buffer.from(value, 'base64');
    if (bytes.subarray(0, 8).toString() !== 'Salted__') throw new Error();
    const salt = bytes.subarray(8, 16);
    let derived = Buffer.alloc(0);
    let previous = Buffer.alloc(0);
    while (derived.length < 48) {
      previous = createHash('md5')
        .update(Buffer.concat([previous, Buffer.from(formatKey), salt]))
        .digest();
      derived = Buffer.concat([derived, previous]);
    }
    const decipher = createDecipheriv('aes-256-cbc', derived.subarray(0, 32), derived.subarray(32, 48));
    return JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(16)), decipher.final()]).toString('utf8'),
    );
  } catch {
    throw new AppError(
      422,
      'Esta configuração do Sutofly usa uma versão de criptografia não reconhecida. O arquivo original foi preservado.',
    );
  }
}
