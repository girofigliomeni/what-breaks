"use client";

import { useMemo, useState } from "react";
import { fileExtension, fileRole, isFrameworkEntry } from "@/adapters/file-conventions.mts";
import { graphFacts, graphIndex, walkGraph } from "@/lib/graph-maths.mts";
import type { ParseResult } from "@/parser/types.mts";
import type { foldFiles } from "@/lib/folding.mts";

type Props = {
  result: ParseResult;
  name: string;
  selection: string | null;
  modules: ReturnType<typeof foldFiles>["modules"];
  hovered: string | null;
  select: (path: string) => void;
  hover: (path: string | null) => void;
};

export function DetailPane({ result, name, selection, modules, hovered, select, hover }: Props) {
  const [tab, setTab] = useState<"Structure" | "Explanation">("Structure");
  const [walk, setWalk] = useState<"incoming" | "outgoing" | null>(null);
  const [depth, setDepth] = useState(2);
  const index = useMemo(() => graphIndex(result.files, result.edges), [result]);
  const facts = useMemo(() => graphFacts(result.files, result.edges), [result]);
  const unimported = useMemo(() => facts.unimported.filter(path => !isFrameworkEntry(path)), [facts]);
  const walked = useMemo(() => selection && walk ? walkGraph(result.files, result.edges, selection, walk, depth) : [], [result, selection, walk, depth]);
  const file = result.files.find(file => file.path === selection);
  const folder = file ? undefined : modules.find(module => module.id === selection);
  const ranked = [...result.files].sort((a, b) => (index.incoming.get(b.path)?.size ?? 0) - (index.incoming.get(a.path)?.size ?? 0) || a.path.localeCompare(b.path));
  const pathButton = (path: string) => <button className="detail-path" data-highlighted={hovered === path || modules.some(module => module.id === hovered && module.files.some(file => file.path === path))} onClick={() => select(path)} onMouseEnter={() => hover(path)} onMouseLeave={() => hover(null)} onFocus={() => hover(path)} onBlur={() => hover(null)}>{path}</button>;
  const paths = (title: string, entries: string[], counts = false, description?: string) => <section className="detail-section"><h3>{title} <span>{entries.length}</span></h3>{description && <p className="detail-insight-description">{description}</p>}{entries.length ? <ol className="detail-paths">{entries.map(path => <li key={path}>{pathButton(path)}{counts && <span className="detail-count">{index.incoming.get(path)?.size ?? 0}</span>}</li>)}</ol> : <p className="detail-note">None.</p>}</section>;
  const extensionCounts = new Map<string, number>();
  for (const entry of folder?.files ?? []) {
    const extension = fileExtension(entry.path);
    extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
  }
  const extensions = [...extensionCounts].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b));
  const kindLabel = (extension: string) => <span className="detail-kind-label"><span className="category-swatch" data-extension={extension} aria-hidden="true" /><code>{extension}</code></span>;
  const selected = file !== undefined || folder !== undefined;
  const state = !selected ? "repository" : tab === "Explanation" ? "explanation" : file ? "file" : "folder";
  return <div className="detail-pane" data-state={state}>
    {selected ? <div className="detail-tabs" role="tablist" aria-label="Detail view">{(["Structure", "Explanation"] as const).map(label => <button key={label} id={`tab-${label}`} role="tab" aria-selected={tab === label} aria-controls="detail-content" onClick={() => setTab(label)}>{label}</button>)}</div> : <h2 className="detail-heading">Repository summary</h2>}
    <div className="detail-content" id="detail-content" role={selected ? "tabpanel" : undefined} aria-labelledby={selected ? `tab-${tab}` : undefined}>
      {state === "explanation" ? <p className="detail-note">No explanation yet. An explanation will appear here after a model call.</p> : file ? <>
        <h2 className="detail-title">{pathButton(file.path)}</h2>
        <dl className="detail-facts"><dt>Kind</dt><dd>{kindLabel(fileExtension(file.path))}</dd><dt>Length</dt><dd>{file.lines} lines</dd><dt>Depends on</dt><dd className="detail-outgoing">{index.outgoing.get(file.path)?.size ?? 0}</dd><dt>Depended on by</dt><dd className="detail-incoming">{index.incoming.get(file.path)?.size ?? 0}</dd></dl>
        <div className="detail-walk-controls">
          <button aria-pressed={walk === "incoming"} onClick={() => setWalk("incoming")}>Blast radius</button>
          <button aria-pressed={walk === "outgoing"} onClick={() => setWalk("outgoing")}>Dependency chain</button>
          <label>Depth <input type="number" min={1} max={Math.max(2, result.files.length)} value={depth} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isInteger(value) && value >= 1 && value <= Math.max(2, result.files.length)) setDepth(value); }} /></label>
        </div>
        {walk && paths(`${walk === "incoming" ? "Blast radius" : "Dependency chain"} (${depth} levels)`, walked)}
        {paths("Depends on", [...(index.outgoing.get(file.path) ?? [])].sort())}
        {paths("Depended on by", [...(index.incoming.get(file.path) ?? [])].sort())}
      </> : folder ? <>
        <h2 className="detail-title"><code>{folder.id}</code></h2>
        <dl className="detail-facts">{extensions.map(([kind, count]) => <div className="detail-kind-row" key={kind}><dt>{kindLabel(kind)}</dt><dd>{count}</dd></div>)}</dl>
        {paths("Files", folder.files.map(file => file.path))}
      </> : <>
        <h2 className="detail-title">{name}</h2>
        <dl className="detail-facts"><dt>Framework</dt><dd>Not detected</dd><dt>Files</dt><dd>{result.files.length}</dd><dt>Imports</dt><dd>{result.imports.length}</dd><dt>Routes</dt><dd>Unavailable</dd><dt>Unidentified roles</dt><dd>{result.files.filter(file => fileRole(file.path) === "Unidentified").length}</dd></dl>
        <p className="detail-note">Languages use file extensions; roles use filename conventions. Framework and route detection are unavailable in this parse.</p>
        {paths("Most depended on", ranked.filter(file => (index.incoming.get(file.path)?.size ?? 0) > 0).map(file => file.path), true)}
        {paths("Start reading", ranked.filter(file => index.incoming.get(file.path)?.size === 0).map(file => file.path))}
      </>}
      <details className="detail-insights">
        <summary>Insights</summary>
        {paths("Files nothing imports", unimported, false, "Nothing in the resolved import graph imports these files.")}
        {paths("Frequently imported", facts.heavilyImported, true, "An unusual number of files import these files.")}
        <section className="detail-section"><h3>Import cycles <span>{facts.cycles.length}</span></h3><p className="detail-insight-description">These imports form a cycle.</p>{facts.cycles.length ? facts.cycles.map((cycle, index) => <ol className="detail-paths" aria-label={`Import cycle ${index + 1}, each file imports the next`} key={JSON.stringify(cycle)}>{cycle.map((path, step) => <li key={`${step}:${path}`}>{pathButton(path)}</li>)}</ol>) : <p className="detail-note">None.</p>}</section>
        {paths("Long files", facts.long, false, "These files contain at least 500 lines.")}
      </details>
    </div>
  </div>;
}
