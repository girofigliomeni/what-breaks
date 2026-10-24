import assert from "node:assert/strict";
import { batchEdgeDraws, edgeEndpoints, fileHandleTop, type EdgePanel, type EdgeConnection } from "../lib/edge-geometry.mts";

const panels: EdgePanel[] = Array.from({ length: 24 }, (_, i) => ({
  id: `folder-${i}`, x: i * 300, y: (i % 4) * 400, width: 240, height: 298,
  open: false, paths: Array.from({ length: 200 }, (_, row) => `folder-${i}/file-${row}.ts`),
}));
let elapsed = 0;
for (const opened of [0, 1, 12, 24]) {
  const current = panels.map((panel, index) => ({ ...panel, open: index < opened }));
  const connections: EdgeConnection[] = Array.from({ length: 10000 }, (_, i) => {
    const source = current[i % current.length];
    const target = current[(i * 7 + 1) % current.length];
    return { id: String(i), source: source.id, target: target.id,
      sourceHandle: source.open ? source.paths[i % source.paths.length] : undefined,
      targetHandle: target.open ? target.paths[(i * 3) % target.paths.length] : undefined };
  });
  const scroll = new Map(current.map((panel, i) => [panel.id, i * 26]));
  const started = performance.now();
  const endpoints = edgeEndpoints(current, connections, scroll);
  elapsed = Math.max(elapsed, performance.now() - started);
  assert.equal(endpoints.length, connections.length);
  for (let i = 0; i < endpoints.length; i++) {
    const source = current[i % current.length];
    const target = current[(i * 7 + 1) % current.length];
    const endpoint = endpoints[i];
    assert.equal(endpoint.id, connections[i].id);
    assert.equal(endpoint.sourceX, source.x + source.width);
    assert.equal(endpoint.targetX, target.x);
    // Match the previous DOM handle's exact row/clipping formula independently.
    const expectedTop = (panel: EdgePanel, row: number) => panel.open
      ? 63 + Math.max(2, Math.min(8 * 26 - 2, row * 26 + 13 - (scroll.get(panel.id) ?? 0)))
      : panel.height / 2;
    assert.equal(endpoint.sourceY, source.y + expectedTop(source, i % source.paths.length));
    assert.equal(endpoint.targetY, target.y + expectedTop(target, (i * 3) % target.paths.length));
  }
}
assert.equal(fileHandleTop(0, 200, 26), 65);
assert.equal(fileHandleTop(199, 200, 0), 269);
assert.equal(fileHandleTop(0, 1, 0), 76);
assert.throws(() => edgeEndpoints([], [{ id: "missing", source: "absent", target: "absent" }], new Map()), /panel is absent/);
assert.throws(() => edgeEndpoints([{ ...panels[0], open: true }], [{ id: "missing", source: panels[0].id, target: panels[0].id, sourceHandle: "absent.ts" }], new Map()), /file is absent/);
const repeated = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), sourceX: 0, sourceY: 63, targetX: 300, targetY: 100 }));
const paints = repeated.map(() => ({ stroke: "var(--muted)", opacity: 0.06 }));
const batches = batchEdgeDraws(repeated, paints);
assert.equal(batches.length, 1);
assert.equal(batches.reduce((sum, batch) => sum + batch.count, 0), repeated.length);
assert.equal(batches[0].opacity, 1 - 0.94 ** 10000);
assert.equal(batchEdgeDraws(repeated.slice(0, 2), [{ stroke: "var(--incoming)", opacity: 0.65 }, { stroke: "var(--outgoing)", opacity: 0.65 }]).length, 2);
assert.throws(() => batchEdgeDraws(repeated, []), /paint style/);
console.log(`10,000 connections preserved with 0, 1, 12 and 24 open folders; row positions, scrolling and endpoint validation pass. Slowest endpoint calculation: ${elapsed.toFixed(1)} ms.`);
