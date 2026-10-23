// Filename conventions describe roles without inferring them from a folder name.
export function fileRole(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  if (/\.d\.[cm]?ts$/.test(name)) return "Type declaration";
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) return "Test";
  if (/\.config\.[cm]?[jt]s$/.test(name) || /^\.[\w-]+rc\.[cm]?[jt]s$/.test(name)) return "Configuration";
  if (/^index\.[cm]?[jt]sx?$/.test(name)) return "Module index";
  return "Unidentified";
}

export function fileLanguage(path: string): string {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  switch (extension) {
    case ".ts": case ".mts": case ".cts": return "TypeScript";
    case ".tsx": return "TypeScript (TSX)";
    case ".js": case ".mjs": case ".cjs": return "JavaScript";
    case ".jsx": return "JavaScript (JSX)";
    default: return "Unknown language";
  }
}

export function fileKind(path: string): string {
  const language = fileLanguage(path);
  const role = fileRole(path);
  return role === "Unidentified" ? language : `${language} / ${role}`;
}

export function fileKindCounts(files: readonly { path: string }[]) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const kind = fileKind(file.path);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts].sort(([kindA, countA], [kindB, countB]) => countB - countA || kindA.localeCompare(kindB));
}
