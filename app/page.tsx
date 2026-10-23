import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { InviteTeammate } from "@/components/invite-teammate";
import { redirect } from "next/navigation";

// Authentication and the active team must resolve before the workspace is sent.
export const instant = false;

export default async function Home() {
  const { orgId, orgSlug, orgRole } = await auth();
  if (!orgId) redirect("/session-tasks/choose-organization");
  return (
    <div className="workspace">
      <div className="team-bar">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" afterLeaveOrganizationUrl="/" />
        <span className="team-context">Workspace <code>{orgSlug || orgId}</code></span>
        {orgRole === "org:admin" ? <InviteTeammate /> : null}
      </div>
      <main id="main-content" className="workspace-panels">
        <aside className="panel repository-panel" aria-labelledby="repository-title">
          <h2 id="repository-title">Repositories</h2>
          <p>No repositories mapped yet.</p>
        </aside>
        <section className="panel map-panel" aria-labelledby="map-title">
          <h1 id="map-title">Dependency map</h1>
          <div className="empty-map"><p>No repository selected.</p><p>A repository map will appear here.</p></div>
        </section>
        <aside className="panel details-panel" aria-labelledby="details-title">
          <h2 id="details-title">File details</h2>
          <p>Select a file in the map to inspect its connections.</p>
        </aside>
        <section className="panel questions-panel" aria-labelledby="questions-title">
          <h2 id="questions-title">Repository questions</h2>
          <p>Questions will be available once a repository is mapped.</p>
        </section>
      </main>
    </div>
  );
}
