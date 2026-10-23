"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { readAnalysisList } from "@/app/analyses/actions";
import { useRealtimeClientFactory } from "@/lib/supabase/use-realtime";
import { isFinished, stageNames, progressPayload } from "@/lib/progress";
import { useStaleRun } from "./use-stale-run";
import { RepositoryForm } from "./repository-form";

type List = Awaited<ReturnType<typeof readAnalysisList>>;
type Connection = "connecting" | "connected" | "reconnecting" | "unavailable";
const connectionLabels: Record<Connection, string> = {
  connecting: "Connecting", connected: "Live", reconnecting: "Reconnecting", unavailable: "Unavailable",
};
function AnalysisRow({ analysis, selected }: { analysis: List["analyses"][number]; selected: boolean }) {
  const stale = useStaleRun(analysis.updated_at, isFinished(analysis.stage), analysis.stale);
  const progress = progressPayload({ stage: analysis.stage, message: analysis.stage_message });
  return <li data-selected={selected}>
    <Link href={`/analyses/${analysis.id}`} prefetch={false} aria-current={selected ? "page" : undefined}><code>{analysis.projects.repository_url.replace(/^https:\/\/github\.com\//, "")}</code></Link>
    <span className="analysis-status" data-status={stale ? "stale" : analysis.status}>{stale ? "Stale · " : ""}{progress ? stageNames[progress.stage] : analysis.status}</span>
    <time dateTime={analysis.created_at}>{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(analysis.created_at))} UTC</time>
    <p className="analysis-message">{stale ? "No progress for five minutes. The process may have stopped." : analysis.stage_message}</p>
  </li>;
}

export function AnalysisList({ initial, organizationId }: { initial: List; organizationId: string }) {
  const pathname = usePathname();
  const [list, setList] = useState(initial);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [connectionError, setConnectionError] = useState("");
  const createRealtimeClient = useRealtimeClientFactory();
  useEffect(() => {
    const client = createRealtimeClient();
    let disposed = false;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const next = await readAnalysisList();
        if (!disposed && current === revision) { setList(next); setConnectionError(""); }
      } catch {
        if (!disposed && current === revision) setConnectionError("Could not update the list. Reload to reconnect.");
      }
    };
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
    return () => { disposed = true; void client.removeChannel(channel); };
  }, [createRealtimeClient, organizationId]);
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
      {list.analyses.map((analysis) => <AnalysisRow key={`${analysis.id}:${analysis.updated_at}`} analysis={analysis} selected={pathname === `/analyses/${analysis.id}`} />)}
    </ul>}
    {list.hasMore ? <p>Showing the latest 50 analyses.</p> : null}
  </aside>;
}

export function RepositorySidebar({ initial, organizationId }: { initial: List; organizationId: string }) {
  const { orgId } = useAuth();
  if (!orgId) return <aside className="panel repository-panel"><p>Select an organization to view repositories.</p></aside>;
  // Shared layouts persist across navigation. A team switch must discard the
  // previous team's initial rows and subscription before loading the new list.
  return <AnalysisList key={orgId} initial={orgId === organizationId ? initial : { analyses: [], hasMore: false }} organizationId={orgId} />;
}
