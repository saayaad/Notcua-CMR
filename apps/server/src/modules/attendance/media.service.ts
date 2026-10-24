import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { cleanFilename, decodeBase64, digest } from '../backups/validation.js';

const ffmpeg: unknown = createRequire(import.meta.url)('ffmpeg-static');

export class MediaService {
  constructor(private readonly db: PrismaClient) {}

  async upload(input: { base64: string; filename?: string; mimeType?: string; voice?: boolean }) {
    const decoded = decodeBase64(input.base64, input.mimeType);
    let data: Uint8Array<ArrayBuffer> = new Uint8Array(decoded.data);
    let mimeType = decoded.mimeType;
    let filename = cleanFilename(input.filename);
    if (input.voice) {
      if (!mimeType.startsWith('audio/') && mimeType !== 'video/webm')
        throw new AppError(422, 'A gravação deve ser um arquivo de áudio.');
      data = await this.transcodeVoice(data);
      mimeType = 'audio/ogg; codecs=opus';
      filename = 'gravacao.ogg';
    }
    return this.db.storedFile.upsert({
      where: { sha256: digest(Buffer.from(data)) },
      create: { filename, mimeType, byteLength: data.length, sha256: digest(Buffer.from(data)), data },
      update: {},
      select: { id: true, filename: true, mimeType: true, byteLength: true },
    });
  }

  async transcodeVoice(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    if (!ffmpeg || typeof ffmpeg !== 'string')
      throw new AppError(
        503,
        'O conversor de áudio não está instalado. Execute npm.cmd rebuild ffmpeg-static.',
      );
    const binary = ffmpeg;
    const directory = await mkdtemp(join(tmpdir(), 'noctua-audio-'));
    try {
      const source = join(directory, 'entrada');
      const target = join(directory, 'gravacao.ogg');
      await writeFile(source, data);
      await new Promise<void>((resolve, reject) => {
        const process = spawn(
          binary,
          [
            '-nostdin',
            '-v',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-i',
            source,
            '-vn',
            '-c:a',
            'libopus',
            '-b:a',
            '32k',
            '-ar',
            '48000',
            '-ac',
            '1',
            '-y',
            target,
          ],
          { windowsHide: true, stdio: 'ignore' },
        );
        const timer = setTimeout(() => {
          process.kill();
          reject(new AppError(422, 'A conversão do áudio excedeu o tempo limite.'));
        }, 45_000);
        process.once('error', () => {
          clearTimeout(timer);
          reject(
            new AppError(
              503,
              'Não foi possível abrir o conversor de áudio. Execute npm.cmd rebuild ffmpeg-static.',
            ),
          );
        });
        process.once('exit', (code) => {
          clearTimeout(timer);
          code === 0 ? resolve() : reject(new AppError(422, 'Não foi possível converter este áudio.'));
        });
      });
      return new Uint8Array(await readFile(target));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
