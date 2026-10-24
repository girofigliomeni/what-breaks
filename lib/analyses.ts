import "server-only";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function listAnalyses() {
  const supabase = await createSupabaseClient();
  // The token and RLS select the team. Never add an organization filter here.
  const { data, error } = await supabase
    .from("analyses")
    .select("id, status, stage, stage_message, updated_at, created_at, projects!inner(repository_url)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);

  if (error) throw new Error(`Could not load analyses: ${error.message}`);
  const now = Date.now();
  return { analyses: data.slice(0, 50).map((analysis) => ({ ...analysis, stale: !["completed", "failed"].includes(analysis.status) && now - Date.parse(analysis.updated_at) >= 5 * 60_000 })), hasMore: data.length > 50 };
}

export async function getAnalysis(id: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return null;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("analyses")
    .select("id, run_id, status, stage, stage_message, failed_stage, failure_message, updated_at, commit_sha, projects!inner(repository_url)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load analysis: ${error.message}`);
  return data ? { ...data, stale: !["completed", "failed"].includes(data.status) && Date.now() - Date.parse(data.updated_at) >= 5 * 60_000 } : null;
}

export async function getStoredResult(id: string) {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("analyses").select("parser_result").eq("id", id).single();
  if (error) throw new Error(`Could not load parser result: ${error.message}`);
  return data.parser_result;
}
