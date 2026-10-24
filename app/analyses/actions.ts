"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { analysisStore } from "@/lib/supabase/analysis-store";
import { runAnalysis } from "@/pipeline/run.mts";
import { after } from "next/server";
import { revalidatePath } from "next/cache";

export async function changeAnalysis(id: string, operation: "retry" | "remove") {
  const { orgId } = await auth.protect();
  if (!orgId) return { message: "Select an organization first." };
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return { message: "Invalid analysis." };
  if (operation !== "retry" && operation !== "remove") return { message: "Invalid action." };
  try {
    const client = await createSupabaseClient();
    if (operation === "retry") {
      const store = analysisStore(orgId, client);
      const run = await store.retry(id);
      after(async () => { await runAnalysis(run.repository_url, run.id, store); });
    } else {
      const { error } = await client.rpc("remove_analysis", { analysis_id: id });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/", "page");
    return { message: "" };
  } catch (error: unknown) {
    console.error(`Could not ${operation} analysis`, error);
    return { message: operation === "retry"
      ? "Could not retry. The analysis may already be running or unavailable. Reload and try again."
      : "Could not remove. The analysis may be running or unavailable. Reload and try again." };
  }
}
