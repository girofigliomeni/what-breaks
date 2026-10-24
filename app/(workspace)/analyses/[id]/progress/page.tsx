import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  await auth.protect();
  const { id } = await params;
  // Preserve existing progress bookmarks; every state now uses one workspace URL.
  redirect(`/analyses/${id}`);
}
