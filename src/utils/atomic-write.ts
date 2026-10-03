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
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, filePath);
  } catch (error) {
    await unlink(tmpFile).catch(() => undefined);
    throw error;
  }
}
