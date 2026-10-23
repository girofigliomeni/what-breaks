import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { graphFacts, importCycles, walkGraph } from "../lib/graph-maths.mts";
import { isFrameworkEntry, fileExtension } from "../adapters/file-conventions.mts";
import { validateResult } from "../parser/contract.mts";
import { foldFiles } from "../lib/folding.mts";
import type { Edge, ParsedFile } from "../parser/types.mts";

const paths = ["a.ts", "b.ts", "c.ts", "d.ts", "isolated.ts"];
const files: ParsedFile[] = paths.map(path => ({ path, folder: ".", module: path, lines: 10, hash: "", fanIn: 0, fanOut: 0 }));
const edges: Edge[] = [["a.ts", "b.ts"], ["b.ts", "c.ts"], ["c.ts", "a.ts"], ["c.ts", "d.ts"]].map(([source, target]) => ({ source, target, kinds: ["import"] }));
assert.deepEqual(walkGraph(files, edges, "a.ts", "outgoing"), ["b.ts", "c.ts"]);
assert.deepEqual(walkGraph(files, edges, "a.ts", "incoming"), ["b.ts", "c.ts"]);
assert.deepEqual(walkGraph(files, edges, "a.ts", "outgoing", 3), ["b.ts", "c.ts", "d.ts"]);
assert.deepEqual(walkGraph(files, edges, "isolated.ts", "outgoing"), []);
assert.deepEqual(walkGraph(files, edges, "a.ts", "outgoing", 0), []);
assert.deepEqual(importCycles(files, edges), [["a.ts", "b.ts", "c.ts", "a.ts"]]);
assert.deepEqual(importCycles([files[0]], [{ source: "a.ts", target: "a.ts", kinds: ["import"] }]), [["a.ts", "a.ts"]]);
const deep = Array.from({ length: 20000 }, (_, index) => ({ path: `${index}.ts` }));
const deepEdges: Edge[] = deep.map((file, index) => ({ source: file.path, target: deep[(index + 1) % deep.length].path, kinds: ["import"] }));
assert.equal(importCycles(deep, deepEdges)[0].length, 20001);
for (const path of ["app/page.tsx", "src/app/api/test/route.ts", "app/layout.tsx", "pages/index.tsx", "src/pages/api/example.ts", "middleware.ts", "src/proxy.ts", "next.config.mjs"]) assert.equal(isFrameworkEntry(path), true, path);
assert.equal(isFrameworkEntry("lib/page.ts"), false);
const many: ParsedFile[] = Array.from({ length: 30 }, (_, index) => ({ ...files[0], path: `${index}.ts`, lines: index === 0 ? 500 : 499 }));
const manyEdges: Edge[] = many.slice(1, 7).map(file => ({ source: file.path, target: "0.ts", kinds: ["import"] }));
assert.deepEqual(graphFacts(many, manyEdges).heavilyImported, ["0.ts"]);
assert.deepEqual(graphFacts(many, manyEdges).long, ["0.ts"]);
const preview = validateResult(JSON.parse(await readFile(new URL("../data/preview.json", import.meta.url), "utf8")));
const cycles = importCycles(preview.files, preview.edges);
assert.ok(cycles.length > 0, "Checked-in repository must contain a real cycle");
const edgeKeys = new Set(preview.edges.map(edge => JSON.stringify([edge.source, edge.target])));
for (const cycle of cycles) for (let index = 1; index < cycle.length; index++) assert.ok(edgeKeys.has(JSON.stringify([cycle[index - 1], cycle[index]])));
const folded = foldFiles(preview.files, preview.edges);
for (const category of new Set(preview.files.map(file => fileExtension(file.path)))) {
  const matches = (items: readonly { path: string }[]) => items.filter(file => fileExtension(file.path) === category).length;
  assert.equal(folded.modules.reduce((sum, module) => sum + matches(module.files), 0), matches(preview.files));
}
console.log(`Passed directional depth limits, cycles, 20,000-file traversal, framework exclusions, thresholds, and category totals. Checked-in repository: ${cycles.length} real cycle walks.`);
console.log(`Example: ${cycles[0].join(" -> ")}`);
