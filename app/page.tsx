import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { InviteTeammate } from "@/components/invite-teammate";
import { redirect } from "next/navigation";
import { listAnalyses } from "@/lib/analyses";

// Authentication and the active team must resolve before the workspace is sent.
export const instant = false;

export default async function Home() {
  const { orgId, orgSlug, orgRole } = await auth();
  if (!orgId) redirect("/session-tasks/choose-organization");
  const { analyses, hasMore } = await listAnalyses();
  return (
    <div className="workspace">
      <div className="team-bar">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" afterLeaveOrganizationUrl="/" />
        <span className="team-context">Workspace <code>{orgSlug || orgId}</code></span>
        {orgRole === "org:admin" ? <InviteTeammate /> : null}
      </div>
      <main id="main-content" className="workspace-panels">
        <aside className="panel repository-panel" aria-labelledby="repository-title">
          <div className="panel-heading"><h2 id="repository-title">Repositories</h2><span className="panel-count" aria-label={`${analyses.length}${hasMore ? ' or more' : ''} analyses`}>{analyses.length}{hasMore ? '+' : ''}</span></div>
          <h3 className="analyses-heading">Analyses</h3>
          <p className="seed-notice">Seeded examples. Repository parsing is not available yet.</p>
          {analyses.length === 0 ? (
            <p>No analyses yet for this team.</p>
          ) : (
            <ul className="analysis-list">
              {analyses.map((analysis) => (
                <li key={analysis.id}>
                  <code>{analysis.projects.repository_url.replace(/^https:\/\/github\.com\//, "")}</code>
                  <span className="analysis-status" data-status={analysis.status}>{analysis.status}</span>
                  <time dateTime={analysis.created_at}>
                    {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(analysis.created_at))} UTC
                  </time>
                </li>
              ))}
            </ul>
          )}
          {hasMore ? <p>Showing the latest 50 analyses.</p> : null}
        </aside>
        <section className="panel map-panel" aria-labelledby="map-title">
          <div className="panel-heading"><h1 id="map-title">Dependency map</h1><span className="panel-caption">Imports &amp; dependencies</span></div>
          <div className="map-canvas"><div className="empty-map"><span className="empty-symbol" aria-hidden="true">⌘</span><p>No repository mapped</p><p>The dependency map will appear here once a repository has been analysed.</p></div></div>
        </section>
        <aside className="panel details-panel" aria-labelledby="details-title">
          <div className="panel-heading"><h2 id="details-title">File details</h2></div>
          <div className="panel-empty"><code className="empty-file" aria-hidden="true">{'{ }'}</code><p>No file selected</p><p>File imports and dependants will appear here.</p></div>
        </aside>
        <section className="panel questions-panel" aria-labelledby="questions-title">
          <div className="panel-heading"><h2 id="questions-title">Repository questions</h2></div>
          <p className="questions-empty">Questions will be available once a repository is mapped.</p>
        </section>
      </main>
    </div>
  );
}
