import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferJSON } from '@whiskeysockets/baileys';

export class CredentialCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error('A chave WhatsApp deve ter 32 bytes.');
  }

  static async load(keyFile: string): Promise<CredentialCipher> {
    const serverRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const filename = resolve(serverRoot, keyFile);
    await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
    try {
      await writeFile(filename, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    return new CredentialCipher(await readFile(filename));
  }

  encrypt(value: unknown): Buffer {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value, BufferJSON.replacer), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), encrypted]);
  }

  decrypt<T>(value: Uint8Array): T {
    const bytes = Buffer.from(value);
    if (bytes.length < 30 || bytes[0] !== 1) throw new Error('Credencial WhatsApp inválida.');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(1, 13));
      decipher.setAuthTag(bytes.subarray(13, 29));
      const clear = Buffer.concat([decipher.update(bytes.subarray(29)), decipher.final()]);
      return JSON.parse(clear.toString('utf8'), BufferJSON.reviver) as T;
    } catch {
      throw new Error('Não foi possível abrir a sessão WhatsApp. Confira a chave original em .secrets.');
    }
  }
}
