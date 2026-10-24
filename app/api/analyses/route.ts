import { auth } from "@clerk/nextjs/server";
import { listAnalyses } from "@/lib/analyses";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return Response.json({ message: "Select a signed-in organization." }, { status: 401 });
  return Response.json(await listAnalyses(), { headers: { "Cache-Control": "no-store" } });
}
