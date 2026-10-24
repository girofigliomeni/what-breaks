import type { listAnalyses } from "./analyses";
import { progressPayload } from "./progress";

export type AnalysisListSnapshot = Awaited<ReturnType<typeof listAnalyses>>;

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
function isList(value: unknown): value is AnalysisListSnapshot {
  return object(value) && typeof value.hasMore === "boolean" && Array.isArray(value.analyses) && value.analyses.every((row: unknown) =>
    object(row) && typeof row.id === "string" && typeof row.status === "string" && typeof row.stage === "string" &&
    typeof row.stage_message === "string" && typeof row.updated_at === "string" && typeof row.created_at === "string" &&
    typeof row.stale === "boolean" && object(row.projects) && typeof row.projects.repository_url === "string");
}

// Reads use GET so socket recovery never waits behind the Server Action queue.
export async function readAnalysisList() {
  const response = await fetch("/api/analyses", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load analyses.");
  const value: unknown = await response.json();
  if (!isList(value)) throw new Error("Invalid analysis list.");
  return value;
}

export async function readProgress(id: string) {
  const response = await fetch(`/api/analyses/${encodeURIComponent(id)}/progress`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load progress.");
  const value: unknown = await response.json();
  const progress = progressPayload(value);
  if (!progress || !object(value) || typeof value.updatedAt !== "string") throw new Error("Invalid progress snapshot.");
  return { ...progress, updatedAt: value.updatedAt };
}
