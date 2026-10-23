import { MapShell } from "@/components/map-shell";

export const instant = false;

export default function Home() {
  return <MapShell><div className="empty-map-surface"><div className="empty-map">
    <span className="empty-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="8.5" width="6" height="6" rx="1" /><rect x="15.5" y="2.5" width="6" height="6" rx="1" /><rect x="15.5" y="15.5" width="6" height="6" rx="1" /><path d="M8.5 11.5H12V5.5h3.5M12 11.5v7h3.5" /></svg></span>
    <p>No repository selected</p>
    <p>Select an analysis on the left, or paste a public GitHub URL to map a repository.</p>
  </div></div></MapShell>;
}
