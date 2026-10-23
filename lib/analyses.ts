import "server-only";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function listAnalyses() {
  const supabase = await createSupabaseClient();
  // The token and RLS select the team. Never add an organization filter here.
  const { data, error } = await supabase
    .from("analyses")
    .select("id, status, created_at, projects!inner(repository_url)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);

  if (error) throw new Error(`Could not load analyses: ${error.message}`);
  return { analyses: data.slice(0, 50), hasMore: data.length > 50 };
}
