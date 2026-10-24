import { graphFixture } from "./graph-fixture.mts";
import { foldFiles, shortLabels } from "../lib/folding.mts";
import assert from "node:assert/strict";

// Preserve the shortest-unique-suffix contract, including paths that are
// themselves suffixes of another path and duplicate entries in the input.
const paths = [".", "src/button.tsx", "test/button.tsx", "button.tsx", "src/unique.ts", "src/unique.ts", "lib/deep/test/button.tsx"];
const reference = new Map(paths.map(path => {
  const parts = path.split("/");
  for (let length = 1; length <= parts.length; length++) {
    const suffix = parts.slice(-length).join("/");
    if (paths.every(other => other === path || (other !== suffix && !other.endsWith(`/${suffix}`)))) return [path, suffix];
  }
  return [path, path];
}));
assert.deepEqual(shortLabels(paths), reference);
const largePaths = Array.from({ length: 4411 }, (_, i) => `apps/v4/registry/group-${Math.floor(i / 50)}/example-${i % 50}.tsx`);
const started = performance.now();
const labels = shortLabels(largePaths);
const elapsed = performance.now() - started;
for (const path of largePaths) assert.equal(labels.get(path), path.split("/").slice(-2).join("/"));
console.log(`Shortest unique labels: ${largePaths.length} paths in ${elapsed.toFixed(1)} ms.`);

const result = await graphFixture();
const folded = foldFiles(result.files, result.edges);
const ids = new Set(folded.modules.map(module => module.id));
const singles = folded.modules.filter(module => module.files.length < 2);
const invalid = result.edges.filter(edge => !ids.has(folded.owners.get(edge.source) ?? "") || !ids.has(folded.owners.get(edge.target) ?? ""));
console.log(`${result.files.length} files; ${folded.modules.length} nodes; threshold ${folded.threshold}; ${(result.files.length / folded.modules.length).toFixed(1)} files/node`);
console.log(`Nodes with fewer than two files: ${singles.length}; invalid edge endpoints: ${invalid.length}; original edges: ${result.edges.length}`);
if (singles.length || invalid.length || folded.modules.length > 24) throw new Error("Folding check failed.");
if (JSON.stringify(foldFiles(result.files, result.edges).modules) !== JSON.stringify(folded.modules)) throw new Error("Folding is not deterministic.");
