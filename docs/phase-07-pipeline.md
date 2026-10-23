# Phase 07: pipeline and live progress

The dashboard form submits to the authenticated `analysePublicRepository`
Server Action. Submission uses the existing Clerk-token Supabase client, with RLS
deciding the organization. Once created, one server-only writer uses
`SUPABASE_SECRET_KEY` for the run so Clerk token expiry cannot interrupt progress,
completion or failure writes. No GitHub token or package installation is needed.

## Form, progress and stored explorer

Home and analysis URLs now share one workspace layout. The repository list/form
stays mounted on the left across selections. The centre shows instructions at
`/`, live stages for an unfinished `/analyses/[id]`, or its completed map. The
right column shows file details when a file is selected. File-type filters sit
above the map instead of occupying another column. A reserved questions panel sits
beneath the map and details. Home deliberately selects nothing, even when completed
analyses exist, and shows instructions inside a bordered canvas. The sidebar places
its labelled live-status indicator opposite the Analyses heading.

Repository links update the URL through Next navigation and mark the active row,
so bookmarks and browser Back/Forward restore selection. Switching repositories
resets map selection/filter state. An organization switch clears the previous
team's sidebar rows and subscribes using the active organization. Read isolation
still comes from RLS. Old `/analyses/[id]/progress` bookmarks redirect to the
canonical workspace URL.

The app header has a prominent monospace “What Breaks.” title linking home, the organization
menu and account menu. There is no duplicate Repositories link. The decorative icon beside the name was removed because
it looked like an unlabeled control. Analysis pages show only their repository,
view and optional commit in a compact context row below the navbar. Organization
settings provide invitations. The separate invite UI/action, second organization
bar and duplicate page-level back links have been removed.

Submission creates or reuses the analysis before returning a redirect to
`/analyses/[id]`. New runs continue in Next.js `after()` work, with the
existing top-level failure handler. The page can open while fetching/parsing is
still running. Post-response work is not durable: if the process dies, both the
dashboard and progress page label unfinished runs stale after five minutes.
Their local stale timers never query the database.

The browser subscribes to private `analysis:<id>` progress and
`organization:<organization-id>:analyses` dashboard topics using the publishable
key plus Clerk's browser `getToken()` callback. The installed Realtime SDK calls
that callback on joins/heartbeats, allowing Clerk to refresh tokens. Product
database reads remain server-side under RLS; the browser client only subscribes.
Sockets are removed on unmount or organization changes.

The progress stream applies named stage/message events directly. The dashboard
receives a stage-change event and requests a fresh, bounded server-side list.
Both reconcile once after subscription/reconnection to cover changes between
the initial render and socket join. There is no interval or database polling.
Progress snapshots overtaken by live events are discarded, and earlier stage
events cannot regress the page. Connection failures remain visible.

Completion refreshes the selected workspace in place, which validates and displays the real stored
parser result. The coverage summary remains visible when collapsed, including
the file figure and unresolved import count; skips and excluded directories
are explicit. The preview route and checked-in parser output were deleted.
Graph/folding terminal checks now parse disposable source fixtures instead.

## Private progress channels

`supabase/migrations/20261023194307_analysis_progress_broadcast.sql` is applied.
This Realtime version declares allowed topic patterns through SELECT policies
on `realtime.messages`; it has no channel registry table/function. The migration
declares both private topic patterns before installing a publisher on our own
`analyses` table. There are no triggers on Realtime's tables.

The analysis-channel policy explicitly checks the subscriber's organization;
the dashboard-channel policy matches the organization claim. Neither grants
client publishing. The private trigger function is inaccessible to clients and
publishes exactly `{stage, message}`. Failure messages include the failed stage.
It inserts into Realtime's message table directly so publication errors abort
the state change visibly rather than being swallowed by `realtime.send`.

`supabase/verify-progress.sql` passed against the real database: queued/running/
failed payloads, dashboard events, exact payload fields, same-organization joins,
denied foreign/missing-organization joins, and denied client broadcasts. The
verification rolled back all fixtures. Security advisors returned no findings.
Browser behavior remains for the user's manual acceptance check.

The writer captures the organization from `auth.protect()`, verifies the returned
analysis belongs to it, and binds itself only to a newly created analysis. Stage
and failure updates filter by both IDs; atomic completion accepts only the bound
ID and derives all row ownership from that analysis. An existing analysis grants
no write access through this path. The privileged client stays private to this
module, with session persistence/refresh disabled and no user token attached.
Product reads continue through Clerk and RLS. This is the explicitly approved
pipeline write exception, not a change to read authorization. The secret stays
in server-only environment variables. Server runtime limits still apply.

Realtime clients are constructed inside browser effects, not during component
rendering: Client Components also render on the server, where Clerk's browser
`getToken()` is unavailable.

`scripts/verify-secret-writer.mts` verifies the real writer with disposable
database fixtures. Run using Node's `--conditions=react-server` and
`--env-file=.env.local`, followed by organization, completion-analysis,
failure-analysis and foreign-analysis fixture IDs. Submission is simulated;
the Supabase secret-key requests are real. The check makes submission auth
unusable after startup, then checks completion/failure and rejects foreign IDs,
foreign organizations, reused-analysis writes and repeated starts. Verification
passed; SQL also confirmed saved files/edges, the failed state, an unchanged
foreign row, and read isolation under the authenticated role. Fixtures were
removed afterward. No session token or secret is printed.

The run canonicalizes a GitHub root URL, atomically creates or returns the
organization's existing analysis, resolves HEAD to a commit SHA, and downloads
that exact commit's ZIP. Stages are fetching, selecting, parsing, storing, then
completed or failed. Failure records retain the stage and reason. Resubmission
returns the existing row even if failed; rerun controls are deferred.

Archive limits are 32 MiB downloaded, 128 MiB expanded, and 20,000 entries.
Paths are checked before extraction, checksums are validated, and links are
never materialized: their paths/reasons join the coverage skips. Temporary
directories are removed after the run. Repository scripts are never executed
and repository dependencies are never installed. A shared tsconfig that is
unavailable therefore produces the parser's existing explicit skip reasons.

The storage transaction writes relational files/edges and the complete versioned
parser result (metadata, import records, coverage) on the analysis. A failed
storage transaction leaves no partial file or edge inserts.

## Database migration applied

`supabase/migrations/20261023185843_analysis_pipeline.sql` is applied to the
`what-breaks` Supabase project, following explicit user approval. It removed
only the approved organizations' empty, commit-less example analyses,
adds one analysis per project, run fields and parser storage, and grants
organization-scoped writes. Both RPCs are security invoker. Submission uses the
authenticated role under RLS; completion now uses the server writer's privileged
role, which bypasses RLS.
The checked-in TypeScript types were regenerated from the applied schema.
`supabase/verify.sql` and `supabase/verify-pipeline.sql` passed against that
database. A duplicate real analysis makes the uniqueness constraint fail; it
is never silently deleted.

A live archive of `sindresorhus/yocto-queue` at commit
`72a8fa96a9d389765cdf2bb9c6daba8302fc375d` was parsed and its exact result
round-tripped through `complete_analysis` as the authenticated role with a
temporary organization claim: 4 files, 2 edges, 7 skips. The JSON contract and
relational counts matched. That verification transaction rolled back, leaving
no demonstration analysis or test organization. This verifies database RLS and
storage, not the Clerk provider/browser flow.

Security advisors returned no findings. The performance advisor reported
JWT initialization on the existing/new policies. An attempted optional policy
rewrite was rejected by automatic approval review as outside the approved
migration. No rewrite was applied. An authenticated EXPLAIN then confirmed
that the current analysis policy already uses an InitPlan and an organization
index condition, so the rewrite is unnecessary for this flow. The advisor
also reported an unused edge index on this empty database; it is retained for
graph reads. See the [policy initialization advisory](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
and [unused-index advisory](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

`supabase/seed.sql` now seeds only organizations/projects. SQL verification uses
temporary controlled analysis fixtures rather than relying on example states.

## Terminal verification

Use `corepack pnpm` if pnpm is unavailable on PATH.

Do not clear the whole `.next` directory while the development server is running:
it contains `.next/dev`, including live CSS-worker output. Earlier cleanup left
the server serving stale styles even though production CSS was correct. If a
full cache cleanup is necessary, stop this project's dev process first and restart
it afterward. Check the CSS served by the dev server, not only build output.

- `corepack pnpm verify:pipeline`: real parser with a synthetic archive and an
  in-memory store; checks commit pinning, duplicate reuse, skips, failed stages,
  archive traversal/link handling and corrupt content.
- `corepack pnpm verify:pipeline --live`: additionally downloads and parses
  `jonschlinkert/is-number`, with in-memory storage, not a database write.
- `corepack pnpm exec tsc --noEmit`, `corepack pnpm lint`, `corepack pnpm build`.

The browser acceptance check remains manual. Explicit rerun controls are still
deferred; pasting an existing URL always reuses its analysis.
