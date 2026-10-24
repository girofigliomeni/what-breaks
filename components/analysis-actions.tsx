"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeAnalysis } from "@/app/analyses/actions";

export function AnalysisActions({ id, name, retryable, selected, removed }: {
  id: string; name: string; retryable: boolean; selected: boolean; removed: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function act(operation: "retry" | "remove") {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await changeAnalysis(id, operation);
        if (result.message) { setMessage(result.message); return; }
        dialog.current?.close();
        if (operation === "remove") {
          removed(id);
          if (selected) router.replace("/");
        } else router.push(`/analyses/${id}`);
        router.refresh();
      } catch { setMessage("The request failed. Reload and try again."); }
    });
  }
  return <div className="analysis-actions">
    {retryable ? <button type="button" className="button" disabled={pending} onClick={() => act("retry")} aria-label={`Retry ${name}`}>{pending ? "Working..." : "Retry"}</button> : null}
    <button type="button" className="button" disabled={pending} onClick={() => dialog.current?.showModal()} aria-label={`Remove ${name}`}>Remove</button>
    {message ? <p role="alert">{message}</p> : null}
    <dialog ref={dialog} className="analysis-confirmation" aria-labelledby={titleId} onCancel={event => { if (pending) event.preventDefault(); }}>
      <h2 id={titleId}>Remove analysis?</h2>
      <p><code>{name}</code></p>
      <p>This deletes the saved analysis and graph for everyone in this organization. You can analyse the repository again later.</p>
      <div className="confirmation-actions">
        <button type="button" className="button" disabled={pending} onClick={() => dialog.current?.close()} autoFocus>Cancel</button>
        <button type="button" className="button" disabled={pending} onClick={() => act("remove")}>{pending ? "Removing..." : "Remove analysis"}</button>
      </div>
      {message ? <p role="alert">{message}</p> : null}
    </dialog>
  </div>;
}
