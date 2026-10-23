import type { Edge, ParsedFile } from "../parser/types.mts";

export function graphIndex(files: readonly Pick<ParsedFile, "path">[], edges: readonly Edge[]) {
  const incoming = new Map(files.map(file => [file.path, new Set<string>()]));
  const outgoing = new Map(files.map(file => [file.path, new Set<string>()]));
  for (const edge of edges) {
    if (!outgoing.has(edge.source) || !incoming.has(edge.target)) throw new Error("Edge endpoint is absent from the file list.");
    incoming.get(edge.target)!.add(edge.source);
    outgoing.get(edge.source)!.add(edge.target);
  }
  return { incoming, outgoing };
}

export function walkGraph(files: readonly Pick<ParsedFile, "path">[], edges: readonly Edge[], start: string, direction: "incoming" | "outgoing", depth = 2): string[] {
  const adjacency = graphIndex(files, edges)[direction];
  if (!adjacency.has(start)) return [];
  const seen = new Set([start]);
  let frontier = [start];
  const result: string[] = [];
  for (let level = 0; level < depth && frontier.length; level++) {
    const next: string[] = [];
    for (const path of frontier) for (const neighbor of adjacency.get(path) ?? []) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      next.push(neighbor);
      result.push(neighbor);
    }
    frontier = next;
  }
  return result.sort();
}

// Explicit DFS frames keep deep repositories off the JavaScript call stack.
// Back edges give actual closed import walks, rather than implying that every
// pair of files in a connected component imports one another.
export function importCycles(files: readonly Pick<ParsedFile, "path">[], edges: readonly Edge[]): string[][] {
  const { outgoing } = graphIndex(files, edges);
  const finished = new Set<string>();
  const active = new Map<string, number>();
  const cycles: string[][] = [];
  for (const file of files) {
    if (finished.has(file.path)) continue;
    const stack = [{ path: file.path, neighbors: [...outgoing.get(file.path) ?? []], next: 0 }];
    active.set(file.path, 0);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const target = frame.neighbors[frame.next++];
      if (target === undefined) {
        finished.add(frame.path);
        active.delete(frame.path);
        stack.pop();
        continue;
      }
      const position = active.get(target);
      if (position !== undefined) {
        cycles.push([...stack.slice(position).map(item => item.path), target]);
      } else if (!finished.has(target)) {
        active.set(target, stack.length);
        stack.push({ path: target, neighbors: [...outgoing.get(target) ?? []], next: 0 });
      }
    }
  }
  return cycles;
}

export function graphFacts(files: readonly ParsedFile[], edges: readonly Edge[]) {
  const { incoming } = graphIndex(files, edges);
  const counts = files.map(file => incoming.get(file.path)!.size);
  const mean = counts.reduce((sum, count) => sum + count, 0) / (counts.length || 1);
  const deviation = Math.sqrt(counts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / (counts.length || 1));
  return {
    unimported: files.filter(file => incoming.get(file.path)!.size === 0).map(file => file.path).sort(),
    heavilyImported: files.filter(file => incoming.get(file.path)!.size >= 5 && incoming.get(file.path)!.size > mean + 2 * deviation).map(file => file.path).sort(),
    long: files.filter(file => file.lines >= 500).map(file => file.path).sort(),
    cycles: importCycles(files, edges),
  };
}
