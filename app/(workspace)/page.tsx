import { MapShell } from "@/components/map-shell";

export const instant = false;

export default function Home() {
  return <MapShell><div className="empty-map-surface"><div className="empty-map">
    <span className="empty-symbol" aria-hidden="true">⌘</span>
    <p>No repository selected</p>
    <p>Select an analysis on the left, or paste a public GitHub URL to map a repository.</p>
  </div></div></MapShell>;
}
