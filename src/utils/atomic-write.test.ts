import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeFileAtomic } from './atomic-write.js';

describe('writeFileAtomic', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hyntx-atomic-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the content', async () => {
    const file = join(dir, 'nested', 'out.json');
    await writeFileAtomic(file, '{"a":1}');
    expect(await readFile(file, 'utf-8')).toBe('{"a":1}');
  });

  it.skipIf(process.platform === 'win32')(
    'creates the file with owner-only permissions',
    async () => {
      const file = join(dir, 'out.json');
      await writeFileAtomic(file, 'x');
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'replaces an existing world-readable file with owner-only permissions',
    async () => {
      const file = join(dir, 'out.json');
      await writeFile(file, 'old', { mode: 0o644 });
      await writeFileAtomic(file, 'new');
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    },
  );
});
