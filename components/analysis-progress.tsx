"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readProgress } from "@/lib/analysis-snapshots";
import { useRealtimeClientFactory } from "@/lib/supabase/use-realtime";
import { isFinished, progressPayload, stageNames, type Progress } from "@/lib/progress";
import { useStaleRun } from "./use-stale-run";

const runStages = ["fetching", "selecting", "parsing", "storing"] as const;
export function AnalysisProgress({ id, initial, initiallyStale }: {
  id: string; initial: Progress & { updatedAt: string }; initiallyStale: boolean;
}) {
  const [progress, setProgress] = useState(initial);
  const [connection, setConnection] = useState("Connecting live updates");
  const createRealtimeClient = useRealtimeClientFactory();
  const router = useRouter();
  const stale = useStaleRun(progress.updatedAt, isFinished(progress.stage), initiallyStale);
  useEffect(() => {
    const client = createRealtimeClient();
    let disposed = false;
    let revision = 0;
    const accept = (next: Progress & { updatedAt: string }) => {
      if (disposed) return;
      setProgress(next);
      if (next.stage === "completed") router.refresh();
    };
    const recover = () => {
      const snapshotRevision = ++revision;
      void readProgress(id).then((snapshot) => {
        if (disposed || revision !== snapshotRevision) return;
        if (snapshot) accept(snapshot);
        else setConnection("This analysis is unavailable for the active organization.");
      }).catch(() => { if (!disposed && revision === snapshotRevision) setConnection("Could not recover progress. Reload to try again."); });
    };
    // Recover the current row even when the socket cannot join. Further reads
    // happen on connection/user events, never on a polling timer.
    recover();
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    const channel = client.channel(`analysis:${id}`, { config: { private: true } })
      .on("broadcast", { event: "progress" }, ({ payload }: { payload: unknown }) => {
        if (disposed) return;
        const next = progressPayload(payload);
        if (!next) { setConnection("Received invalid progress. Reload to recover."); return; }
        revision++;
        accept({ ...next, updatedAt: new Date().toISOString() });
      });
    void client.realtime.setAuth().then(() => {
      if (disposed) return;
      channel.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setConnection("Live updates connected");
          // Events can finish the run before the socket joins. Read once after
          // joining (also on reconnect), discarding snapshots overtaken by events.
          recover();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("Live updates interrupted. Reconnecting");
      });
    }).catch(() => { if (!disposed) setConnection("Live updates unavailable. Reload to reconnect."); });
    return () => {
      disposed = true;
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
      void client.removeChannel(channel);
    };
  }, [createRealtimeClient, id, router]);
  const current = runStages.findIndex((stage) => stage === progress.stage);
  return <section className="analysis-progress" aria-labelledby="progress-title">
    <div className="progress-heading"><h2 id="progress-title">Repository analysis</h2></div>
    <ol className="progress-stages" aria-label="Analysis stages">
      {runStages.map((stage, index) => <li key={stage} aria-current={stage === progress.stage ? "step" : undefined} data-state={stage === progress.stage ? "current" : current > index || progress.stage === "completed" ? "done" : "waiting"}>
        <span>{stageNames[stage]}</span><span>{progress.stage === "failed" ? "Stopped" : stage === progress.stage ? "In progress" : current > index || progress.stage === "completed" ? "Done" : "Waiting"}</span>
      </li>)}
    </ol>
    <div className="progress-message" role={progress.stage === "failed" ? "alert" : "status"}>
      <h2>{stale ? "Stale run" : stageNames[progress.stage]}</h2>
      <p>{progress.message}</p>
      {stale ? <p>No progress for five minutes. The process may have stopped. This page will still receive any later updates.</p> : null}
    </div>
    <p className="live-connection" role="status">{connection}</p>
  </section>;
}
