import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getAnalysis, getStoredResult } from "@/lib/analyses";
import { validateResult } from "@/parser/contract.mts";
import { DependencyMap } from "@/components/dependency-map";
import { CoverageBanner } from "@/components/coverage-banner";
import { AnalysisContext } from "@/components/analysis-context";
import { MapShell } from "@/components/map-shell";
import { AnalysisProgress } from "@/components/analysis-progress";
import { progressPayload, stageMessage } from "@/lib/progress";

export const instant = false;

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth.protect();
  if (!orgId) redirect("/session-tasks/choose-organization");
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) notFound();
  const name = analysis.projects.repository_url.replace(/^https:\/\/github\.com\//, "");
  if (analysis.status !== "completed") {
    const progress = progressPayload({ stage: analysis.stage, message: stageMessage(analysis) });
    if (!progress) throw new Error("The stored analysis has an invalid progress stage.");
    return <div className="analysis-explorer">
      <AnalysisContext repository={name} view="Progress" />
      <MapShell><AnalysisProgress key={`${orgId}:${id}`} id={id} initial={{ ...progress, updatedAt: analysis.updated_at }} initiallyStale={analysis.stale} /></MapShell>
    </div>;
  }
  const result = validateResult(await getStoredResult(id));
  return <div className="analysis-explorer">
    <AnalysisContext repository={name} view="Map" commit={analysis.commit_sha} />
    <CoverageBanner coverage={result.coverage} />
    <DependencyMap key={id} result={result} name={name} />
  </div>;
}
