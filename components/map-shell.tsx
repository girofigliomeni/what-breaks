"use client";

import { fileExtension } from "@/adapters/file-conventions.mts";
import type { ReactNode } from "react";
import type { ParsedFile } from "@/parser/types.mts";

export function MapShell({ children, files, details, category = null, setCategory }: { children?: ReactNode; files?: Pick<ParsedFile, "path">[]; details?: ReactNode; category?: string | null; setCategory?: (category: string | null) => void }) {
  const counts = new Map<string, number>();
  for (const file of files ?? []) {
    const extension = fileExtension(file.path);
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  const categories = [...counts].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b));
  return (
    <div className="dependency-workspace">
      <div className="dependency-columns">
        <section className="dependency-map" aria-labelledby="dependency-map-heading">
          <h1 id="dependency-map-heading" className="dependency-heading">Dependency map</h1>
          {files === undefined ? null : <div className="file-category-toolbar">
            <span>File types</span><ul className="file-categories" aria-label="Filter files by extension">
            {categories.map(([extension, count]) => <li key={extension}><button className="file-category" aria-pressed={category === extension} onClick={() => setCategory?.(category === extension ? null : extension)}>
              <span className="category-swatch" data-extension={extension} aria-hidden="true" />
              <span className="category-name">{extension}</span>{" "}
              <span className="category-count">{count}</span>
            </button></li>)}
          </ul></div>}
          <div className="dependency-canvas">{children}</div>
        </section>
        <aside className="dependency-details" aria-label="Repository details">{details ?? <>
          <h2 className="dependency-heading">File details</h2>
          <div className="panel-empty">
            <svg className="empty-file" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2.5H5.5v19h13v-14L14 2.5Z" /><path d="M14 2.5v5h4.5M8.5 12h7M8.5 16h7" /></svg>
            <p>No file selected</p><p>File imports and dependants will appear here.</p>
          </div>
        </>}</aside>
      </div>
    </div>
  );
}
