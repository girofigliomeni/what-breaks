import { auth } from "@clerk/nextjs/server";
import { getAnalysis } from "@/lib/analyses";
import { progressPayload, stageMessage } from "@/lib/progress";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ message: "Select a signed-in organization." }, { status: 401 });
  const analysis = await getAnalysis((await params).id);
  if (!analysis) return Response.json(null, { status: 404 });
  const progress = progressPayload({ stage: analysis.stage, message: stageMessage(analysis) });
  if (!progress) throw new Error("The stored analysis has an invalid progress stage.");
  return Response.json({ ...progress, updatedAt: analysis.updated_at }, { headers: { "Cache-Control": "no-store" } });
}
