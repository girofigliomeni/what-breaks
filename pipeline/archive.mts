import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const maximumExpanded = 512 * 1024 * 1024;

// GitHub's ZIP archives use a central directory. Never let archive names become
// filesystem paths until every entry has passed validation (including on Windows).
export async function extractArchive(zip: Buffer, directory: string): Promise<{ path: string; reason: string }[]> {
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65557) && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || end < zip.length - 65557 || end + 22 + zip.readUInt16LE(end + 20) !== zip.length) throw new Error("Invalid ZIP directory.");
  const count = zip.readUInt16LE(end + 10);
  if (zip.readUInt32LE(end + 4) !== 0 || count !== zip.readUInt16LE(end + 8) || count === 65535) throw new Error("Split and ZIP64 archives are not supported.");
  let offset = zip.readUInt32LE(end + 16);
  const directoryEnd = offset + zip.readUInt32LE(end + 12);
  if (directoryEnd !== end || count > 20000) throw new Error("Archive exceeds 20,000 entries or has an invalid directory.");
  const entries: { name: string; start: number; size: number; expanded: number; method: number; crc: number; folder: boolean; link: boolean }[] = [];
  const skipped: { path: string; reason: string }[] = [];
  const names = new Set<string>();
  let total = 0;
  let root: string | undefined;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > directoryEnd || zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP entry.");
    const nameSize = zip.readUInt16LE(offset + 28);
    const extraSize = zip.readUInt16LE(offset + 30);
    const commentSize = zip.readUInt16LE(offset + 32);
    const next = offset + 46 + nameSize + extraSize + commentSize;
    if (next > directoryEnd) throw new Error("Truncated ZIP entry.");
    const archiveName = zip.subarray(offset + 46, offset + 46 + nameSize).toString("utf8");
    const segments = archiveName.replace(/\/$/, "").split("/");
    if (segments.some((part) => !part || part === "." || part === ".." || /[\\:\x00-\x1f<>"|?*]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) throw new Error(`Unsafe archive path: ${JSON.stringify(archiveName)}`);
    root ??= segments[0];
    if (segments[0] !== root) throw new Error("Archive must have one repository root.");
    const folder = archiveName.endsWith("/");
    const mode = zip.readUInt32LE(offset + 38) >>> 16;
    const link = (mode & 0xf000) === 0xa000;
    if (!link && (mode & 0xf000) !== 0 && (mode & 0xf000) !== (folder ? 0x4000 : 0x8000)) throw new Error(`Archive contains a special file: ${archiveName}`);
    const method = zip.readUInt16LE(offset + 10);
    if ((zip.readUInt16LE(offset + 8) & 1) || ![0, 8].includes(method)) throw new Error("Encrypted or unsupported ZIP compression.");
    const size = zip.readUInt32LE(offset + 20);
    const expanded = zip.readUInt32LE(offset + 24);
    total += expanded;
    if (total > maximumExpanded) throw new Error("Repository exceeds the 512 MiB extracted archive limit.");
    const local = zip.readUInt32LE(offset + 42);
    if (local + 30 > zip.readUInt32LE(end + 16) || zip.readUInt32LE(local) !== 0x04034b50) throw new Error("Invalid ZIP file header.");
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    if (start + size > zip.readUInt32LE(end + 16)) throw new Error("Truncated ZIP file.");
    const name = segments.slice(1).join("/");
    if (name) {
      const key = name.toLowerCase();
      if (names.has(key)) throw new Error(`Archive has conflicting paths: ${name}`);
      names.add(key);
      entries.push({ name, start, size, expanded, method, crc: zip.readUInt32LE(offset + 16), folder, link });
    } else if (!folder) throw new Error("Invalid archive root.");
    offset = next;
  }
  if (offset !== directoryEnd) throw new Error("Invalid ZIP directory length.");
  for (const entry of entries) {
    if (entry.link) { skipped.push({ path: entry.name, reason: "Archive symbolic link was not extracted or followed" }); continue; }
    const destination = path.join(directory, ...entry.name.split("/"));
    if (entry.folder) { await mkdir(destination, { recursive: true }); continue; }
    const compressed = zip.subarray(entry.start, entry.start + entry.size);
    const content = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.expanded) });
    if (content.length !== entry.expanded || crc32(content) !== entry.crc) throw new Error(`Corrupt archive file: ${entry.name}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, { flag: "wx" });
  }
  return skipped;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(content: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of content) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
