import type { ReactNode } from "react";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listAnalyses } from "@/lib/analyses";
import { RepositorySidebar } from "@/components/analysis-list";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { orgId } = await auth.protect();
  if (!orgId) redirect("/session-tasks/choose-organization");
  const list = await listAnalyses();
  return <main id="main-content" className="workspace-layout" aria-label="Repository workspace">
    <Suspense fallback={<aside className="panel repository-panel"><div className="panel-heading"><h2>Repositories</h2></div><p>Loading repositories…</p></aside>}>
      <RepositorySidebar initial={list} organizationId={orgId} />
    </Suspense>
    <div className="workspace-content">
      {children}
      <section className="questions-panel" aria-labelledby="questions-heading">
        <div className="panel-heading"><h2 id="questions-heading">Repository questions</h2></div>
        <p>Repository questions are not available yet.</p>
      </section>
    </div>
  </main>;
}
