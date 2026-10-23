import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRepository } from "../parser/index.mts";
import { validateResult } from "../parser/contract.mts";
import type { ParseResult } from "../parser/types.mts";
import { extractArchive } from "./archive.mts";
import { fetchRepository, repositoryUrl } from "./github.mts";

export type Stage = "fetching" | "selecting" | "parsing" | "storing";
export interface AnalysisStore {
  begin(url: string): Promise<{ id: string; created: boolean }>;
  stage(id: string, stage: Stage, message: string, commit?: string): Promise<void>;
  complete(id: string, result: ParseResult): Promise<void>;
  fail(id: string, stage: Stage, message: string): Promise<void>;
}
type RunOutcome = { id: string; existing: boolean; failed?: { stage: Stage; message: string } };

export async function analyseRepository(input: string, store: AnalysisStore): Promise<RunOutcome> {
  const url = repositoryUrl(input);
  const analysis = await store.begin(url);
  if (!analysis.created) return { id: analysis.id, existing: true };
  return runAnalysis(url, analysis.id, store);
}

// Submission owns creation. Next's after() can run this already-bound analysis
// after returning its ID, without holding up navigation to the progress page.
export async function runAnalysis(url: string, id: string, store: AnalysisStore): Promise<RunOutcome> {
  const analysis = { id };
  let stage: Stage = "fetching";
  let directory: string | undefined;
  try {
    await store.stage(analysis.id, stage, "Downloading the public repository archive.");
    const { archive, commit } = await fetchRepository(url);
    stage = "selecting";
    await store.stage(analysis.id, stage, "Validating and extracting repository files.", commit);
    directory = await mkdtemp(path.join(tmpdir(), "what-breaks-"));
    const skipped = await extractArchive(archive, directory);
    stage = "parsing";
    await store.stage(analysis.id, stage, "Selecting source files and resolving imports.");
    const result = await parseRepository(directory);
    result.coverage.skipped.push(...skipped);
    result.coverage.filesFound += skipped.length;
    result.coverage.filesSkipped += skipped.length;
    validateResult(result);
    stage = "storing";
    await store.stage(analysis.id, stage, "Saving files, edges, imports and coverage.");
    await store.complete(analysis.id, result);
    return { id: analysis.id, existing: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Failure persistence must itself fail loudly if the database is unavailable.
    try { await store.fail(analysis.id, stage, message); }
    catch (persistence: unknown) { throw new AggregateError([error, persistence], `Run failed during ${stage}: ${message}. Its failed state could not be saved.`); }
    return { id: analysis.id, existing: false, failed: { stage, message } };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
