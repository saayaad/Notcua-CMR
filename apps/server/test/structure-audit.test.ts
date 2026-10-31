import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

test('REQ-001: workspaces compilam em modo estrito e não têm marcadores de implementação pendente', () => {
  assert.ok(existsSync(tsc), 'REQ-001: TypeScript instalado no workspace');
  for (const workspace of ['apps/server', 'apps/web']) {
    execFileSync(
      process.execPath,
      [tsc, '--noEmit', '--project', resolve(root, workspace, 'tsconfig.json')],
      { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 120_000 },
    );
  }

  const pendingMarkers = ['apps/server/src', 'apps/web/src'].flatMap((directory) =>
    sourceFiles(resolve(root, directory)).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .flatMap((line, index) =>
          /(?:\/\/|\/\*|\*)\s*(?:TODO\s*:|FIXME\b|IMPLEMENT[\s_-]*ME\b|NOT[\s_-]*IMPLEMENTED\b)/i.test(line)
            ? [`${file}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    ),
  );
  assert.deepEqual(pendingMarkers, [], 'REQ-001: não há marcador explícito de implementação omitida');
});
