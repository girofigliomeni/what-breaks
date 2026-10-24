"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { readAnalysisList } from "@/lib/analysis-snapshots";
import { useRealtimeClientFactory } from "@/lib/supabase/use-realtime";
import { isFinished, stageNames, progressPayload } from "@/lib/progress";
import { useStaleRun } from "./use-stale-run";
import { RepositoryForm } from "./repository-form";
import { AnalysisActions } from "./analysis-actions";

type List = Awaited<ReturnType<typeof readAnalysisList>>;
type Connection = "connecting" | "connected" | "reconnecting" | "unavailable";
const connectionLabels: Record<Connection, string> = {
  connecting: "Connecting", connected: "Live", reconnecting: "Reconnecting...", unavailable: "Unavailable",
};
function AnalysisRow({ analysis, selected, removed, retried }: { analysis: List["analyses"][number]; selected: boolean; removed: (id: string) => void; retried: () => Promise<void> }) {
  const stale = useStaleRun(analysis.updated_at, isFinished(analysis.stage), analysis.stale);
  const progress = progressPayload({ stage: analysis.stage, message: analysis.stage_message });
  return <li data-selected={selected}>
    <Link href={`/analyses/${analysis.id}`} prefetch={false} aria-current={selected ? "page" : undefined}><code>{analysis.projects.repository_url.replace(/^https:\/\/github\.com\//, "")}</code></Link>
    <span className="analysis-status" data-status={stale ? "stale" : analysis.status}>{stale ? "Stale: " : ""}{progress ? stageNames[progress.stage] : analysis.status}</span>
    <time dateTime={analysis.created_at}>{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(analysis.created_at))} UTC</time>
    <p className="analysis-message">{stale ? "No progress for five minutes. The process may have stopped." : analysis.stage_message}</p>
    {isFinished(analysis.stage) || stale ? <AnalysisActions id={analysis.id} name={analysis.projects.repository_url.replace(/^https:\/\/github\.com\//, "")} retryable={analysis.status === "failed" || stale} selected={selected} removed={removed} retried={retried} /> : null}
  </li>;
}

export function AnalysisList({ initial, organizationId }: { initial: List; organizationId: string }) {
  const pathname = usePathname();
  const [list, setList] = useState(initial);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [connectionError, setConnectionError] = useState("");
  const createRealtimeClient = useRealtimeClientFactory();
  const revision = useRef(0);
  const invalidateReads = useCallback(() => { revision.current++; }, []);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const next = await readAnalysisList();
      if (current === revision.current) { setList(next); setConnectionError(""); }
    } catch {
      if (current === revision.current) setConnectionError("Could not update the list. Reload to reconnect.");
    }
  }, []);
  useEffect(() => {
    const client = createRealtimeClient();
    let disposed = false;
    const recover = () => { void refresh(); };
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    const channel = client.channel(`organization:${organizationId}:analyses`, { config: { private: true } })
      .on("broadcast", { event: "progress" }, () => { void refresh(); });
    void client.realtime.setAuth().then(() => {
      if (disposed) return;
      channel.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          // Subscribe first, then reconcile once to cover the initial render gap.
          void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("reconnecting");
      });
    }).catch(() => {
      if (!disposed) { setConnection("unavailable"); setConnectionError("Live updates unavailable. Reload to reconnect."); }
    });
    return () => {
      disposed = true;
      invalidateReads();
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
      void client.removeChannel(channel);
    };
  }, [createRealtimeClient, organizationId, refresh, invalidateReads]);
  return <aside className="panel repository-panel" aria-labelledby="repository-title">
    <div className="panel-heading"><h2 id="repository-title">Repositories</h2><span className="panel-count" aria-label={`${list.analyses.length}${list.hasMore ? " or more" : ""} analyses`}>{list.analyses.length}{list.hasMore ? "+" : ""}</span></div>
    <RepositoryForm />
    <div className="analyses-toolbar">
      <h3 className="analyses-heading">Analyses</h3>
      <span className="live-status" data-state={connectionError ? "unavailable" : connection} role="status" aria-label={`Live updates: ${connectionError ? "unavailable" : connectionLabels[connection]}`}>
        <span className="connection-dot" aria-hidden="true" />{connectionError ? "Unavailable" : connectionLabels[connection]}
      </span>
    </div>
    {connectionError ? <p className="live-connection" role="status">{connectionError}</p> : null}
    {list.analyses.length === 0 ? <p>No analyses yet for this team.</p> : <ul className="analysis-list">
      {list.analyses.map((analysis) => <AnalysisRow key={analysis.id} analysis={analysis} selected={pathname === `/analyses/${analysis.id}`} retried={refresh} removed={id => { invalidateReads(); setList(previous => ({ ...previous, analyses: previous.analyses.filter(row => row.id !== id) })); }} />)}
    </ul>}
    {list.hasMore ? <p>Showing the latest 50 analyses.</p> : null}
  </aside>;
}

export function RepositorySidebar({ initial, organizationId }: { initial: List; organizationId: string }) {
  const { orgId } = useAuth();
  if (!orgId) return <aside className="panel repository-panel"><p>Select an organization to view repositories.</p></aside>;
  // Shared layouts persist across navigation. A team switch must discard the
  // previous team's initial rows and subscription before loading the new list.
  const current = orgId === organizationId ? initial : { analyses: [], hasMore: false };
  // A refreshed server snapshot must replace local rows, including retry state.
  const snapshotKey = current.analyses.map(row => `${row.id}:${row.updated_at}`).join(",");
  return <AnalysisList key={`${orgId}:${snapshotKey}`} initial={current} organizationId={orgId} />;
}
