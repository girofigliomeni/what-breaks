"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { analysisStore } from "@/lib/supabase/analysis-store";
import { runAnalysis } from "@/pipeline/run.mts";
import { repositoryUrl } from "@/pipeline/github.mts";
import { after } from "next/server";
import { redirect } from "next/navigation";

export async function analysePublicRepository(_previous: { message: string }, form: FormData) {
  const { orgId } = await auth.protect();
  if (!orgId) redirect("/session-tasks/choose-organization");
  const input = form.get("repository");
  if (typeof input !== "string" || input.length > 2048) return { message: "Enter a GitHub repository URL." };
  let url: string;
  try { url = repositoryUrl(input); }
  catch (error: unknown) { return { message: error instanceof Error ? error.message : "Enter a GitHub repository URL." }; }
  let id: string;
  try {
    const store = analysisStore(orgId, await createSupabaseClient());
    const analysis = await store.begin(url);
    id = analysis.id;
    if (analysis.created) after(async () => { await runAnalysis(url, analysis.id, store); });
  } catch (error: unknown) {
    console.error("Could not submit repository analysis", error);
    return { message: "Could not start the analysis. Reload and try again." };
  }
  redirect(`/analyses/${id}`);
}
