export const stages = ["queued", "fetching", "selecting", "parsing", "storing", "completed", "failed"] as const;
export type ProgressStage = typeof stages[number];
export type Progress = { stage: ProgressStage; message: string };
export const stageNames: Record<ProgressStage, string> = {
  queued: "Queued", fetching: "Fetching archive", selecting: "Selecting files",
  parsing: "Parsing imports", storing: "Storing graph", completed: "Completed", failed: "Failed",
};
export function progressPayload(value: unknown): Progress | null {
  if (typeof value !== "object" || value === null || !("stage" in value) || !("message" in value)) return null;
  const stage = stages.find((stage) => stage === value.stage);
  return stage && typeof value.message === "string" ? { stage, message: value.message } : null;
}
export function isFinished(stage: string) { return stage === "completed" || stage === "failed"; }
export function stageMessage(analysis: { stage: string; stage_message: string; failed_stage: string | null }) {
  return analysis.stage === "failed" && analysis.failed_stage ? `Failed during ${analysis.failed_stage}: ${analysis.stage_message}` : analysis.stage_message;
}
