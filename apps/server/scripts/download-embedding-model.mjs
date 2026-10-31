import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const modelId = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const revision = '2c4055b12046f11709e9df2c122e59ffbdc2f900';
const modelRoot = resolve(repoRoot, '.audit', 'models');
const modelDir = join(modelRoot, 'Xenova', 'paraphrase-multilingual-MiniLM-L12-v2');
const files = [
  'config.json',
  'special_tokens_map.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'unigram.json',
  'onnx/model_quantized.onnx',
];
const expectedSha256 = '66fc00f5f29afcaff34092e1bdd20008ca3918265a82fb9695a551e510cc4ebc';

await mkdir(modelDir, { recursive: true });
for (const file of files) {
  const target = resolve(modelDir, file);
  if (!target.startsWith(`${modelDir}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('Invalid model path');
  await mkdir(dirname(target), { recursive: true });
  const url = `https://huggingface.co/${modelId}/resolve/${revision}/${file}`;
  const temporary = `${target}.download`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} downloading ${file}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if (file === 'onnx/model_quantized.onnx') {
      const hash = createHash('sha256');
      const { createReadStream } = await import('node:fs');
      for await (const chunk of createReadStream(temporary)) hash.update(chunk);
      const actual = hash.digest('hex');
      if (actual !== expectedSha256) throw new Error(`Model hash mismatch: ${actual}`);
    }
    await rm(target, { force: true });
    await rename(temporary, target);
    const details = await stat(target);
    process.stdout.write(`Downloaded ${file} (${details.size} bytes)\n`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
process.stdout.write(`Local model ready: ${modelId}@${revision}\n`);