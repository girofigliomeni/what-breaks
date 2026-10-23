import type { Edge, ParsedFile } from "./types.mts";

export function calculateGraph(files: ParsedFile[], input: Edge[]): { files: ParsedFile[]; edges: Edge[] } {
  const paths = new Set(files.map((file) => file.path));
  const edges = new Map<string, Edge>();
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const edge of input) {
    if (!paths.has(edge.source) || !paths.has(edge.target)) throw new Error("Edge endpoint is absent from the file list.");
    const key = JSON.stringify([edge.source, edge.target]);
    const previous = edges.get(key);
    edges.set(key, { ...edge, kinds: [...new Set([...(previous?.kinds ?? []), ...edge.kinds])].sort() });
    const sources = incoming.get(edge.target) ?? new Set<string>();
    sources.add(edge.source);
    incoming.set(edge.target, sources);
    const targets = outgoing.get(edge.source) ?? new Set<string>();
    targets.add(edge.target);
    outgoing.set(edge.source, targets);
  }
  return {
    files: files.map((file) => ({ ...file, fanIn: incoming.get(file.path)?.size ?? 0, fanOut: outgoing.get(file.path)?.size ?? 0 })),
    edges: [...edges.values()].sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
  };
}
