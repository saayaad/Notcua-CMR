import { execFileSync } from 'node:child_process';

function resolveBuildCommit() {
  const supplied = process.env.BUILD_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (supplied && supplied !== 'unknown') return supplied.slice(0, 40);
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

export const BUILD_COMMIT = resolveBuildCommit();
