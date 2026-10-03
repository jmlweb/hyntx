import { rm } from 'node:fs/promises';

/** Test-only recursive delete of a temp dir created by makeTempDir. */
export async function removeTempDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
