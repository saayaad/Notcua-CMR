import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase64 } from '../src/modules/backups/validation.js';

test('aceita Data URL do MediaRecorder com codec sem enfraquecer validação Base64', () => {
  for (const mime of ['audio/ogg;codecs=opus', 'audio/webm; codecs=opus', 'audio/webm;codecs="opus"']) {
    const decoded = decodeBase64(`data:${mime};base64,T2dnUw==`, mime);
    assert.equal(decoded.mimeType, mime.split(';')[0]);
    assert.equal(decoded.data.toString(), 'OggS');
  }
  assert.throws(() => decodeBase64('data:audio/webm;codecs=opus;base64,%%'), /Base64/);
  assert.throws(() => decodeBase64('data:audio/webm;unexpected=html;base64,T2dnUw=='), /Data URL/);
  assert.throws(() => decodeBase64('data:audio/webm;codecs=opus;base64,T2dnUw==', undefined, 2), /limite/);
});
