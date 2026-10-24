"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const CHUNK = 40;

export function DetailPathList({ entries, renderPath, incoming }: {
  entries: string[];
  renderPath: (path: string) => ReactNode;
  incoming?: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const [limit, setLimit] = useState(CHUNK);
  const list = useRef<HTMLOListElement>(null);
  const next = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!list.current || !next.current || limit >= entries.length) return;
    // Keep wrapped, full paths and the existing scroll box. More local rows
    // mount near its bottom; opening a folder never mounts thousands at once.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit(current => Math.min(entries.length, current + CHUNK));
    }, { root: list.current, rootMargin: "0px 0px 112px 0px" });
    observer.observe(next.current);
    return () => observer.disconnect();
  }, [entries.length, limit]);
  return <ol className="detail-paths" ref={list}>
    {entries.slice(0, limit).map((path, index) => <li key={path} aria-posinset={index + 1} aria-setsize={entries.length}>
      {renderPath(path)}{incoming && <span className="detail-count">{incoming.get(path)?.size ?? 0}</span>}
    </li>)}
    {limit < entries.length && <li ref={next} aria-hidden="true" style={{ height: 1, border: 0 }} />}
  </ol>;
}
