import type { ParseResult } from "@/parser/types.mts";

export function CoverageBanner({ coverage }: { coverage: ParseResult["coverage"] }) {
  const partial = coverage.filesSkipped > 0 || coverage.excludedDirectories.length > 0 || coverage.imports.unresolved > 0;
  const figure = coverage.filesFound ? `${(coverage.filesParsed / coverage.filesFound * 100).toFixed(1)}%` : "No files found";
  return <details className="coverage-banner">
    <summary><span className="coverage-summary">
      <span className="coverage-label">{partial ? "Partial graph" : "Graph coverage"}</span>
      <span className="coverage-figure"><strong>{figure}</strong> coverage</span>
      <span><strong>{coverage.filesParsed} of {coverage.filesFound}</strong> files parsed</span>
      <span><strong>{coverage.imports.unresolved}</strong> unresolved imports</span>
    </span></summary>
    <p>{coverage.filesSkipped} files skipped. {coverage.excludedDirectories.length} directories excluded as a whole. File coverage does not count the unknown contents of excluded directories.</p>
    {coverage.skipped.length ? <><p>Skipped files{coverage.skipped.length > 50 ? " (first 50)" : ""}</p><ul>{coverage.skipped.slice(0, 50).map((file) => <li key={file.path}><code>{file.path}</code>: {file.reason}</li>)}</ul></> : null}
    {coverage.excludedDirectories.length ? <><p>Excluded directories</p><ul>{coverage.excludedDirectories.map((folder) => <li key={folder.path}><code>{folder.path}</code>: {folder.reason}</li>)}</ul></> : null}
  </details>;
}
