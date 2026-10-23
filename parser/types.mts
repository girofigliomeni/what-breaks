export type ImportKind = "import" | "re-export" | "dynamic-import";
export type ImportStatus = "resolved" | "external" | "excluded" | "unresolved";

export interface ParsedFile {
  path: string;
  folder: string;
  module: string;
  lines: number;
  hash: string;
  fanIn: number;
  fanOut: number;
}

export interface Edge {
  source: string;
  target: string;
  kinds: ImportKind[];
}

export interface ImportRecord {
  source: string;
  line: number;
  kind: ImportKind;
  specifier: string;
  status: ImportStatus;
  target: string | null;
  reason: string;
}

export interface ParseResult {
  version: 1;
  adapter: string;
  files: ParsedFile[];
  edges: Edge[];
  imports: ImportRecord[];
  coverage: {
    filesFound: number;
    filesParsed: number;
    filesSkipped: number;
    skipped: { path: string; reason: string }[];
    excludedDirectories: { path: string; reason: string }[];
    imports: Record<ImportStatus, number>;
  };
}

export interface RepositoryAdapter {
  name: string;
  describeFile(path: string): { module: string };
}

// A module is identified by its complete repository-relative file path.
// Framework adapters can add knowledge later without changing file selection.
export const fallbackAdapter: RepositoryAdapter = {
  name: "none",
  describeFile: (path) => ({ module: path }),
};
