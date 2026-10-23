"use server";

import { auth } from "@clerk/nextjs/server";
import { getAnalysis, listAnalyses } from "@/lib/analyses";
import { progressPayload, stageMessage } from "@/lib/progress";

export async function readProgress(id: string) {
  await auth.protect();
  const analysis = await getAnalysis(id);
  if (!analysis) return null;
  const progress = progressPayload({ stage: analysis.stage, message: stageMessage(analysis) });
  if (!progress) throw new Error("The stored analysis has an invalid progress stage.");
  return { ...progress, updatedAt: analysis.updated_at };
}

export async function readAnalysisList() {
  await auth.protect();
  return listAnalyses();
}
