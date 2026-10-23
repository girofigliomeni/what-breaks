import { readResult } from "../parser/contract.mts";
import { foldFiles } from "../lib/folding.mts";

const result = await readResult("data/preview.json");
const folded = foldFiles(result.files, result.edges);
const ids = new Set(folded.modules.map(module => module.id));
const singles = folded.modules.filter(module => module.files.length < 2);
const invalid = result.edges.filter(edge => !ids.has(folded.owners.get(edge.source) ?? "") || !ids.has(folded.owners.get(edge.target) ?? ""));
console.log(`${result.files.length} files; ${folded.modules.length} nodes; threshold ${folded.threshold}; ${(result.files.length / folded.modules.length).toFixed(1)} files/node`);
console.log(`Nodes with fewer than two files: ${singles.length}; invalid edge endpoints: ${invalid.length}; original edges: ${result.edges.length}`);
if (singles.length || invalid.length || folded.modules.length > 24) throw new Error("Folding check failed.");
if (JSON.stringify(foldFiles(result.files, result.edges).modules) !== JSON.stringify(folded.modules)) throw new Error("Folding is not deterministic.");
