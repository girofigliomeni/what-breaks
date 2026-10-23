import { parseRepository } from "../parser/index.mts";
import { readResult, validateResult, writeResult } from "../parser/contract.mts";

async function main(): Promise<void> {
  const [directory, option, output, ...extra] = process.argv.slice(2);
  if (!directory || (option !== undefined && (option !== "--output" || !output)) || extra.length) throw new Error("Usage: pnpm parse <directory> [--output <new-file.json>]");
  const result = validateResult(await parseRepository(directory));
  const { coverage } = result;
  console.log(`Files found: ${coverage.filesFound}; parsed: ${coverage.filesParsed}; skipped: ${coverage.filesSkipped}`);
  console.log(`Folders: ${new Set(result.files.map((file) => file.folder)).size}; edges: ${result.edges.length}`);
  console.log(`Imports: ${JSON.stringify(coverage.imports)}`);
  const exports = result.imports.filter((item) => item.kind === "re-export");
  console.log(`Re-exports found: ${exports.length}; resolved: ${exports.filter((item) => item.status === "resolved").length}`);
  for (const skipped of coverage.skipped) console.log(`Skipped ${skipped.path}: ${skipped.reason}`);
  for (const excluded of coverage.excludedDirectories) console.log(`Excluded directory ${excluded.path}: ${excluded.reason}`);
  for (const item of result.imports.filter((item) => item.status !== "resolved")) console.log(`${item.status} ${item.source}:${item.line} ${JSON.stringify(item.specifier)}: ${item.reason}`);
  if (output) {
    await writeResult(output, result);
    const restored = await readResult(output);
    if (JSON.stringify(restored) !== JSON.stringify(result)) throw new Error("Output round trip changed the result.");
    console.log(`Wrote and validated ${output}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
