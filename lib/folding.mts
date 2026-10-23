import type { Edge, ParsedFile } from "../parser/types.mts";

const parent = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
const depth = (path: string) => path === "." ? 0 : path.split("/").length;

export function foldFiles(files: ParsedFile[], edges: Edge[]) {
  function pass(threshold: number) {
    const groups = new Map<string, ParsedFile[]>();
    for (const file of files) {
      let directory = file.folder;
      while (true) {
        if (!groups.has(directory)) groups.set(directory, []);
        if (directory === ".") break;
        directory = parent(directory);
      }
      groups.get(file.folder)!.push(file);
    }
    const deepest = Math.max(0, ...Array.from(groups.keys(), depth));
    for (let level = deepest; level > 0; level--) {
      // Decisions share a depth snapshot; siblings never affect one another.
      const merges = [...groups].filter(([path, members]) => depth(path) === level && members.length < threshold);
      for (const [path, members] of merges) {
        groups.get(parent(path))!.push(...members);
        groups.delete(path);
      }
    }
    return [...groups].filter(([, members]) => members.length > 0).sort(([a], [b]) => a.localeCompare(b));
  }
  let threshold = 2;
  let groups = pass(threshold);
  while (groups.length > 24 && threshold <= files.length) groups = pass(++threshold);
  const owners = new Map(groups.flatMap(([id, members]) => members.map(file => [file.path, id] as const)));
  const modules = groups.map(([id, members]) => {
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    for (const edge of edges) {
      if (owners.get(edge.target) === id && owners.get(edge.source) !== id) incoming.add(edge.source);
      if (owners.get(edge.source) === id && owners.get(edge.target) !== id) outgoing.add(edge.target);
    }
    return { id, files: members.sort((a, b) => a.path.localeCompare(b.path)), fanIn: incoming.size, fanOut: outgoing.size };
  });
  return { modules, owners, threshold };
}

export function shortLabels(paths: string[]) {
  return new Map(paths.map(path => {
    const parts = path.split("/");
    for (let length = 1; length <= parts.length; length++) {
      const suffix = parts.slice(-length).join("/");
      if (paths.every(other => other === path || (other !== suffix && !other.endsWith(`/${suffix}`)))) return [path, suffix];
    }
    return [path, path];
  }));
}
