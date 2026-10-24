import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32 } from "node:zlib";
import { extractArchive } from "../pipeline/archive.mts";
import { repositoryUrl } from "../pipeline/github.mts";
import { analyseRepository } from "../pipeline/run.mts";
import type { AnalysisStore, Stage } from "../pipeline/run.mts";
import type { ParseResult } from "../parser/types.mts";
import { validateResult } from "../parser/contract.mts";

function zip(files: { name: string; content: string; mode?: number }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const content = Buffer.from(file.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt32LE(crc32(content), 16);
    record.writeUInt32LE(content.length, 20);
    record.writeUInt32LE(content.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(((file.mode ?? 0x81a4) * 65536) >>> 0, 38);
    record.writeUInt32LE(offset, 42);
    locals.push(local, name, content);
    central.push(record, name);
    offset += local.length + name.length + content.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const archive = zip([
  { name: "repo/main.ts", content: "export { value } from './value';\n" },
  { name: "repo/value.ts", content: "export const value = 1;\n" },
  { name: "repo/README.md", content: "A fixture." },
]);
assert.equal(repositoryUrl(" https://github.com/Owner/Repo.git/ "), "https://github.com/owner/repo");
for (const input of ["http://github.com/a/b", "https://github.com/a/b/tree/main", "https://github.com/a/b?token=x", "https://github.com.evil.test/a/b", "https://user@github.com/a/b"]) assert.throws(() => repositoryUrl(input));

const directory = await mkdtemp(path.join(tmpdir(), "what-breaks-verify-pipeline-"));
try {
  await extractArchive(archive, directory);
  assert.equal(await readFile(path.join(directory, "main.ts"), "utf8"), "export { value } from './value';\n");
  for (const name of ["repo/../escape.ts", "repo/C:/escape.ts", "repo/a\\escape.ts", "repo/CON", "repo/name."]) {
    await assert.rejects(extractArchive(zip([{ name, content: "" }]), directory), /Unsafe/);
  }
  assert.deepEqual(await extractArchive(zip([{ name: "repo/link.ts", content: "../secret", mode: 0xa1ff }]), directory), [{ path: "link.ts", reason: "Archive symbolic link was not extracted or followed" }]);
  await assert.rejects(readFile(path.join(directory, "link.ts")), { code: "ENOENT" });
  const corrupt = Buffer.from(archive);
  corrupt[30 + Buffer.byteLength("repo/main.ts")] ^= 1;
  await assert.rejects(extractArchive(corrupt, directory), /Corrupt/);
  const originalFetch = globalThis.fetch;
  const stages: Stage[] = [];
  let stored: ParseResult | undefined;
  let failed: { stage: Stage; message: string } | undefined;
  let failStorage = false;
  let created = true;
  const commit = "a".repeat(40);
  let savedCommit: string | undefined;
  const store: AnalysisStore = {
    async begin() { return { id: "fixture-id", created }; },
    async stage(_id, stage, _message, sha) { stages.push(stage); if (sha) savedCommit = sha; },
    async complete(_id, result) { if (failStorage) throw new Error("Storage unavailable"); stored = validateResult(result); },
    async fail(_id, stage, message) { failed = { stage, message }; },
  };
  try {
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      assert.equal(new Headers(options?.headers).has("authorization"), false);
      if (url.startsWith("https://api.github.com/")) return Response.json({ sha: commit });
      assert.equal(url, `https://codeload.github.com/owner/repo/zip/${commit}`);
      return new Response(Uint8Array.from(archive));
    };
    const success = await analyseRepository("https://github.com/owner/repo", store);
    assert.equal(success.existing, false);
    assert.deepEqual(stages, ["fetching", "selecting", "parsing", "storing"]);
    assert.equal(savedCommit, commit);
    assert.equal(stored?.files.length, 2);
    assert.equal(stored?.edges.length, 1);
    assert.equal(stored?.coverage.filesSkipped, 1);
    created = false;
    globalThis.fetch = async () => { throw new Error("Existing analyses must not fetch"); };
    assert.deepEqual(await analyseRepository("https://github.com/owner/repo", store), { id: "fixture-id", existing: true });
    created = true;
    globalThis.fetch = async () => new Response("Not found", { status: 404 });
    await analyseRepository("https://github.com/owner/missing", store);
    assert.equal(failed?.stage, "fetching");
    assert.match(failed?.message ?? "", /not found or is not public/);
    globalThis.fetch = async (input) => String(input).startsWith("https://api.github.com/") ? Response.json({ sha: commit }) : new Response(Uint8Array.from(archive));
    failStorage = true;
    await analyseRepository("https://github.com/owner/repo", store);
    assert.equal(failed?.stage, "storing");
    assert.equal(failed?.message, "Storage unavailable");
    console.log("Pipeline: real parser, commit pinning, coverage, deduplication, failed stages and archive safety passed (in-memory store).");
  } finally { globalThis.fetch = originalFetch; }
} finally { await rm(directory, { recursive: true, force: true }); }

if (process.argv.includes("--live")) {
  let completed = false;
  let commit: string | undefined;
  const outcome = await analyseRepository("https://github.com/jonschlinkert/is-number", {
    async begin() { return { id: "live-verification", created: true }; },
    async stage(_id, stage, _message, sha) { if (sha) commit = sha; console.log(`Live: ${stage}`); },
    async complete(_id, result) {
      validateResult(result);
      assert.ok(result.files.length > 0);
      completed = true;
      console.log(`Live public archive ${commit}: ${result.files.length} files, ${result.edges.length} edges, ${result.coverage.filesSkipped} skipped (in-memory store).`);
    },
    async fail(_id, stage, message) { throw new Error(`${stage}: ${message}`); },
  });
  assert.equal(outcome.failed, undefined);
  assert.ok(completed);
}
