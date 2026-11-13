// Runs Vitest from a cwd with an uppercase drive letter. On Windows, "c:\" vs "C:\" makes Vitest
// load two copies of itself and fail with "failed to find the current suite".
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(r.status ?? 1);
