"use client";

import { useMemo, useState } from "react";
import { fileKind, fileKindCounts, fileRole } from "@/adapters/file-conventions.mts";
import styles from "./detail-pane.module.css";
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
  const index = useMemo(() => {
    const incoming = new Map(result.files.map(file => [file.path, new Set<string>()]));
    const outgoing = new Map(result.files.map(file => [file.path, new Set<string>()]));
    for (const edge of result.edges) {
      incoming.get(edge.target)?.add(edge.source);
      outgoing.get(edge.source)?.add(edge.target);
    }
    return { incoming, outgoing };
  }, [result]);
  const file = result.files.find(file => file.path === selection);
  const folder = file ? undefined : modules.find(module => module.id === selection);
  const ranked = [...result.files].sort((a, b) => (index.incoming.get(b.path)?.size ?? 0) - (index.incoming.get(a.path)?.size ?? 0) || a.path.localeCompare(b.path));
  const pathButton = (path: string) => <button className={styles.path} data-highlighted={hovered === path || modules.some(module => module.id === hovered && module.files.some(file => file.path === path))} onClick={() => select(path)} onMouseEnter={() => hover(path)} onMouseLeave={() => hover(null)} onFocus={() => hover(path)} onBlur={() => hover(null)}>{path}</button>;
  const paths = (title: string, entries: string[], counts = false) => <section className={styles.section}><h3>{title} <span>{entries.length}</span></h3>{entries.length ? <ol className={styles.paths}>{entries.map(path => <li key={path}>{pathButton(path)}{counts && <span className={styles.count}>{index.incoming.get(path)?.size ?? 0}</span>}</li>)}</ol> : <p className={styles.note}>None.</p>}</section>;
  const selected = file !== undefined || folder !== undefined;
  const state = !selected ? "repository" : tab === "Explanation" ? "explanation" : file ? "file" : "folder";
  return <div className={styles.pane} data-state={state}>
    {selected ? <div className={styles.tabs} role="tablist" aria-label="Detail view">{(["Structure", "Explanation"] as const).map(label => <button key={label} id={`tab-${label}`} role="tab" aria-selected={tab === label} aria-controls="detail-content" onClick={() => setTab(label)}>{label}</button>)}</div> : <h2 className={styles.heading}>Repository summary</h2>}
    <div className={styles.content} id="detail-content" role={selected ? "tabpanel" : undefined} aria-labelledby={selected ? `tab-${tab}` : undefined}>
      {state === "explanation" ? <p className={styles.note}>No explanation yet. An explanation will appear here after a model call.</p> : file ? <>
        <h2 className={styles.title}>{pathButton(file.path)}</h2>
        <dl className={styles.facts}><dt>Kind</dt><dd>{fileKind(file.path)}</dd><dt>Length</dt><dd>{file.lines} lines</dd></dl>
        {paths("Depends on", [...(index.outgoing.get(file.path) ?? [])].sort())}
        {paths("Depended on by", [...(index.incoming.get(file.path) ?? [])].sort())}
      </> : folder ? <>
        <h2 className={styles.title}><code>{folder.id}</code></h2>
        <dl className={styles.facts}>{fileKindCounts(folder.files).map(([kind, count]) => <div className={styles.kindRow} key={kind}><dt>{kind}</dt><dd>{count}</dd></div>)}</dl>
        {paths("Files", folder.files.map(file => file.path))}
      </> : <>
        <h2 className={styles.title}>{name}</h2>
        <dl className={styles.facts}><dt>Framework</dt><dd>Not detected</dd><dt>Files</dt><dd>{result.files.length}</dd><dt>Imports</dt><dd>{result.imports.length}</dd><dt>Routes</dt><dd>Unavailable</dd><dt>Unidentified roles</dt><dd>{result.files.filter(file => fileRole(file.path) === "Unidentified").length}</dd></dl>
        <p className={styles.note}>Languages use file extensions; roles use filename conventions. Framework and route detection are unavailable in this parse.</p>
        {paths("Most depended on", ranked.filter(file => (index.incoming.get(file.path)?.size ?? 0) > 0).map(file => file.path), true)}
        {paths("Start reading", ranked.filter(file => index.incoming.get(file.path)?.size === 0).map(file => file.path))}
      </>}
    </div>
  </div>;
}
