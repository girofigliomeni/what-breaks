import assert from "node:assert/strict";
import dagre from "@dagrejs/dagre";
import { spacePanels } from "../lib/panel-spacing.mts";

const graph = new dagre.graphlib.Graph().setGraph({ rankdir: "LR", nodesep: 26, ranksep: 72, marginx: 20, marginy: 20 }).setDefaultEdgeLabel(() => ({}));
for (let i = 0; i < 24; i++) graph.setNode(String(i), { width: 200, height: 100 });
for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if (i !== j) graph.setEdge(String(i), String(j));
const started = performance.now();
dagre.layout(graph);
const dagreMs = performance.now() - started;
const baseline = Array.from({ length: 24 }, (_, i) => {
  const placed = graph.node(String(i));
  return { id: String(i), x: placed.x - placed.width / 2, y: placed.y - placed.height / 2, width: 200, height: 100 };
});
const collapsed = spacePanels(baseline, baseline);
for (const panel of baseline) assert.deepEqual(collapsed.get(panel.id), { x: panel.x, y: panel.y });
let slowest = 0;
for (const opened of baseline) {
  const sizes = baseline.map(panel => ({ ...panel, width: panel === opened ? 900 : panel.width, height: panel === opened ? 298 : panel.height }));
  const start = performance.now();
  const positions = spacePanels(baseline, sizes);
  slowest = Math.max(slowest, performance.now() - start);
  assert.deepEqual(spacePanels(baseline, sizes), positions);
  for (let i = 0; i < sizes.length; i++) for (let j = i + 1; j < sizes.length; j++) {
    const a = { ...sizes[i], ...positions.get(sizes[i].id)! };
    const b = { ...sizes[j], ...positions.get(sizes[j].id)! };
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, "Expanded panels must not overlap");
  }
}
assert.throws(() => spacePanels(baseline, []), /size is absent/);
console.log(`Dense 24-node layout: ${dagreMs.toFixed(1)} ms once; opening-time spacing at most ${slowest.toFixed(2)} ms. Every expansion is deterministic and non-overlapping; collapse restores baseline.`);
