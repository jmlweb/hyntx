import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Writes through a temp file with a name no other process shares, then
 * renames it into place. Readers never see a partial file, and two runs
 * writing at once cannot trample each other's temp file.
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.${String(process.pid)}.${randomUUID()}.tmp`;
  try {
    // Reports hold personal excerpts; the rename keeps the temp file's owner-only mode
    await writeFile(tmpFile, content, { encoding: 'utf-8', mode: 0o600 });
    await rename(tmpFile, filePath);
  } catch (error) {
    await unlink(tmpFile).catch(() => undefined);
    throw error;
  }
}
