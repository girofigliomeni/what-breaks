"use client";

import { useActionState } from "react";
import { analysePublicRepository } from "@/app/analyse-action";

export function RepositoryForm() {
  const [state, action, pending] = useActionState(analysePublicRepository, { message: "" });
  return <form action={action} className="repository-form">
    <label htmlFor="repository-url">Public GitHub repository</label>
    <input id="repository-url" name="repository" type="url" placeholder="https://github.com/owner/repository" required maxLength={2048} autoComplete="off" aria-describedby={state.message ? "repository-message" : undefined} />
    <button className="button" disabled={pending}>{pending ? "Starting analysis" : "Analyse repository"}</button>
    {state.message ? <p id="repository-message" role="status">{state.message}</p> : null}
  </form>;
}
