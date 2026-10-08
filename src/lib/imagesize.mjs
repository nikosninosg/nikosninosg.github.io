/**
 * Intrinsic image size from the file header (PNG / JPEG), cached per process. No dependencies.
 * Used by layout.mjs for og:image:width/height. Returns null when the file is missing or unsupported.
 */
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './content.mjs';

const cache = new Map();

export function imageSize(rel, root = ROOT) {
  if (cache.has(rel)) return cache.get(rel);
  let size = null;
  try {
    const file = join(root, rel);
    const fd = openSync(file, 'r');
    try {
      const head = Buffer.alloc(32);
      readSync(fd, head, 0, 32, 0);
      if (head.readUInt32BE(0) === 0x89504e47) {
        size = { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
      } else if (head[0] === 0xff && head[1] === 0xd8) {
        const buf = Buffer.alloc(Math.min(statSync(file).size, 512 * 1024));
        readSync(fd, buf, 0, buf.length, 0);
        let i = 2;
        while (i < buf.length - 9) {
          if (buf[i] !== 0xff) {
            i++;
            continue;
          }
          const marker = buf[i + 1];
          if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
            break;
          }
          i += 2 + buf.readUInt16BE(i + 2);
        }
      }
    } finally {
      closeSync(fd);
    }
  } catch {
    size = null;
  }
  cache.set(rel, size?.width && size?.height ? size : null);
  return cache.get(rel);
}
