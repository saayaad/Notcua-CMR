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

  async upload(input: { base64: string; filename?: string; mimeType?: string; voice?: boolean; watermark?: string }) {
    const decoded = decodeBase64(input.base64, input.mimeType);
    let data: Uint8Array<ArrayBuffer> = new Uint8Array(decoded.data) as Uint8Array<ArrayBuffer>;
    let mimeType = decoded.mimeType;
    let filename = cleanFilename(input.filename);
    let watermark: Uint8Array | undefined;
    if (input.watermark) {
      if (!mimeType.startsWith('video/') || input.voice) throw new AppError(422, 'A camada de marca d’água deve acompanhar um vídeo.');
      const overlay = decodeBase64(input.watermark, 'image/png');
      const bytes = Buffer.from(overlay.data);
      if (bytes.length < 24 || bytes.length > 4 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(20) > 4096)
        throw new AppError(422, 'A marca d’água deve ser PNG de até 4 MiB e 4096 pixels por lado.');
      watermark = overlay.data;
    }
    if (input.voice) {
      if (!mimeType.startsWith('audio/') && mimeType !== 'video/webm')
        throw new AppError(422, 'A gravação deve ser um arquivo de áudio.');
      data = (await this.transcodeVoice(data)) as Uint8Array<ArrayBuffer>;
      mimeType = 'audio/ogg; codecs=opus';
      filename = 'gravacao.ogg';
    }
    if (!input.voice && (mimeType.startsWith('image/') || mimeType.startsWith('video/'))) {
      const optimized = await this.optimizeVisual(data, mimeType, filename, watermark);
      data = optimized.data as Uint8Array<ArrayBuffer>;
      mimeType = optimized.mimeType;
      filename = optimized.filename;
    }
    return this.db.storedFile.upsert({
      where: { sha256: digest(Buffer.from(data)) },
      create: { filename, mimeType, byteLength: data.length, sha256: digest(Buffer.from(data)), data },
      update: {},
      select: { id: true, filename: true, mimeType: true, byteLength: true },
    });
  }

  private async optimizeVisual(data: Uint8Array, mimeType: string, filename: string, watermark?: Uint8Array) {
    if (!ffmpeg || typeof ffmpeg !== 'string') {
      if (watermark) throw new AppError(503, 'O conversor de vídeo está indisponível. A amostra não foi enviada sem marca d’água.');
      return { data, mimeType, filename };
    }
    if (mimeType === 'image/gif' || (mimeType === 'image/webp' && Buffer.from(data).includes(Buffer.from('ANIM'))))
      return { data, mimeType, filename };
    const image = mimeType.startsWith('image/');
    const directory = await mkdtemp(join(tmpdir(), 'noctua-media-'));
    try {
      const input = join(directory, image ? 'entrada.img' : 'entrada.mp4');
      const output = join(directory, image ? 'otimizada.webp' : 'otimizado.mp4');
      await writeFile(input, data);
      const overlay = join(directory, 'marca.png');
      if (watermark) await writeFile(overlay, watermark);
      await new Promise<void>((resolve, reject) => {
        const args = image
          ? ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', input, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '86', '-compression_level', '5', '-y', output]
          : ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', input,
            ...(watermark ? ['-protocol_whitelist', 'file,pipe', '-i', overlay, '-filter_complex', "[0:v:0]scale=w='min(1920,iw)-mod(min(1920,iw),2)':h=-2[base];[base][1:v:0]overlay=0:0:format=auto[marked]", '-map', '[marked]']
              : ['-map', '0:v:0', '-vf', "scale=w='min(1920,iw)-mod(min(1920,iw),2)':h=-2"]),
            '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-y', output];
        const child = spawn(ffmpeg as string, args, { windowsHide: true, stdio: 'ignore' });
        const timer = setTimeout(() => { child.kill(); reject(new AppError(422, 'A otimização do arquivo excedeu o tempo limite.')); }, 120_000);
        child.once('error', () => { clearTimeout(timer); reject(new AppError(503, 'Não foi possível iniciar a otimização de mídia.')); });
        child.once('exit', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new AppError(422, 'Não foi possível otimizar este arquivo de mídia.'));
        });
      });
      const optimized = new Uint8Array(await readFile(output));
      if (!optimized.byteLength) throw new AppError(422, 'O conversor não produziu um arquivo válido.');
      if (!watermark && optimized.byteLength >= data.byteLength) return { data, mimeType, filename };
      const base = filename.replace(/\.[^.]+$/, '') || 'arquivo';
      return { data: optimized, mimeType: image ? 'image/webp' : 'video/mp4', filename: `${base}${image ? '.webp' : '.mp4'}` };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
