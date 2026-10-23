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
    <main id="main-content" className="dependency-workspace" aria-label="Repository map">
      <div className="dependency-columns">
        <aside className="dependency-rail" aria-labelledby="file-categories-heading">
          <h2 id="file-categories-heading" className="dependency-heading">File categories</h2>
          {files === undefined ? <p className="dependency-empty">No repository loaded.</p> : <ul className="file-categories" aria-label="Files by extension">
            {categories.map(([extension, count]) => <li key={extension}><button className="file-category" aria-pressed={category === extension} onClick={() => setCategory?.(category === extension ? null : extension)}>
              <span className="category-swatch" data-extension={extension} aria-hidden="true" />
              <span className="category-name">{extension}</span>{" "}
              <span className="category-count">{count}</span>
            </button></li>)}
          </ul>}
        </aside>
        <section className="dependency-map" aria-labelledby="dependency-map-heading">
          <h1 id="dependency-map-heading" className="dependency-heading">Dependency map</h1>
          <div className="dependency-canvas">{children}</div>
        </section>
        <aside className="dependency-details" aria-label="Repository details">{details}</aside>
      </div>
    </main>
  );
}
