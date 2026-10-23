import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnvironment } from "../env.ts";
import type { Database, Json } from "./database.types";
import type { AnalysisStore } from "../../pipeline/run.mts";
import { validateResult } from "../../parser/contract.mts";

function json(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, json(item)]));
  throw new Error("Parser result contains a non-JSON value.");
}

export function analysisStore(organizationId: string, submissionClient: SupabaseClient<Database>): AnalysisStore & {
  retry(id: string): Promise<{ id: string; repository_url: string }>;
} {
  if (!organizationId) throw new Error("A submission organization is required.");
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY. Set it in .env.local before analysing a repository.");
  const { supabaseUrl } = getEnvironment();
  // The privileged client never escapes this module and never receives a user
  // token. The submitting session can expire without interrupting this run.
  const client = createClient<Database>(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let boundId: string | undefined;
  let boundRun: string | undefined;
  let started = false;
  function assertBound(id: string) {
    if (!boundId || !boundRun || id !== boundId) throw new Error("This writer is not bound to that analysis.");
    return boundRun;
  }
  async function update(id: string, fields: Database["public"]["Tables"]["analyses"]["Update"]) {
    const run = assertBound(id);
    const { error } = await client.from("analyses").update({ ...fields, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", id).eq("run_id", run).select("id").single();
    if (error) throw new Error(`Could not save analysis state: ${error.message}`);
  }
  return {
    async begin(url) {
      if (started) throw new Error("A writer can start only one analysis.");
      started = true;
      // Creation/deduplication still runs under the submitting token and RLS.
      const { data, error } = await submissionClient.rpc("begin_analysis", { repository_url: url }).single();
      if (error) throw new Error(`Could not start analysis: ${error.message}`);
      const { data: owned, error: ownershipError } = await client.from("analyses").select("id, run_id").eq("organization_id", organizationId).eq("id", data.id).single();
      if (ownershipError || !owned) throw new Error("The submitted analysis does not belong to the captured organization.");
      // Reusing an analysis must not confer permission to overwrite it.
      if (data.created) { boundId = data.id; boundRun = owned.run_id; }
      return data;
    },
    async retry(id) {
      if (started) throw new Error("A writer can start only one analysis.");
      started = true;
      // RLS authorizes the requested row before the privileged mutation. The
      // captured organization must also match before any reset is performed.
      const { data: authorized, error: authorizationError } = await submissionClient.from("analyses")
        .select("id, organization_id").eq("id", id).single();
      if (authorizationError || !authorized || authorized.organization_id !== organizationId)
        throw new Error("The retry is not authorized for the captured organization.");
      const { data, error } = await client.rpc("retry_analysis", { analysis_id: authorized.id }).single();
      if (error) throw new Error(`Could not retry analysis: ${error.message}`);
      const { error: ownershipError } = await client.from("analyses").select("id")
        .eq("organization_id", organizationId).eq("id", data.id).eq("run_id", data.run_id).single();
      if (ownershipError) throw new Error("The retried analysis does not belong to the captured organization and run.");
      boundId = data.id;
      boundRun = data.run_id;
      return data;
    },
    async stage(id, stage, message, commit) {
      await update(id, { status: "running", stage, stage_message: message, ...(commit ? { commit_sha: commit } : {}) });
    },
    async complete(id, result) {
      const run = assertBound(id);
      const { error } = await client.rpc("complete_analysis_run", { analysis_id: id, result: json(validateResult(result)), expected_run_id: run });
      if (error) throw new Error(`Could not store parser result: ${error.message}`);
    },
    async fail(id, stage, message) {
      await update(id, { status: "failed", stage: "failed", stage_message: message, failed_stage: stage, failure_message: message });
    },
  };
}
