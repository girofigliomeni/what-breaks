# Phase 7 — The pipeline

**Goal.** Paste a URL and watch your own repository become a map.

## Build

- Fetching a public repository as an archive. No repository scope is requested
  and no token is ever stored.
  Archives may be up to 128 MiB downloaded and 512 MiB extracted, with at most
  20,000 entries.
- Record which commit the archive came from. A later phase needs to know
  whether the repository has moved on since.
- The run: fetch, select, parse, store — with named stages, and a catch at the
  top that writes a failed state rather than leaving a row stuck mid-parse
  forever.
- The form on the dashboard, finally wired to something.
- **One analysis per repository.** Submitting a URL that has already been
  analysed does not create a second one — it takes you to the existing analysis.
  Re-running the same repository is a deliberate act from that analysis, not
  something you get by pasting the URL again.
- A progress page that names the stage as it happens, updated live.
- Failed or stale analyses have a Retry action that restarts the same analysis
  with a new run identity. Concurrent retries and writes from older runs cannot
  overwrite it. Completed analyses cannot be retried in this phase.
- Analyses that are completed, failed or stale have Remove with confirmation
  explaining that the saved analysis and graph are deleted for the organization.
  Active runs cannot be removed. Removing the selected analysis returns home.
  Other open lists update live after removal.
- The explorer, now reading real stored rows instead of the checked-in file.
  Expanded folder headers stay within their reserved two-row height so every
  visible file row, including the last, fits fully inside the node.
- A coverage banner on the map, which says the graph is partial when it is.
  Its collapsed row separates the label, coverage percentage, parsed-file count
  and unresolved-import count into spaced groups instead of a sentence.
- One shared workspace: repositories stay on the left, the selected map or live
  progress occupies the centre, and file details stay on the right. File-type
  filters sit above the map. Repository selections have bookmarkable URLs and
  support browser Back/Forward. Opening home selects nothing and shows instructions.
- The empty map has an inset bordered canvas. A reserved repository questions
  section sits beneath the map and details; answering questions is not enabled yet.
  The form has no helper sentence beneath its button. The analyses heading and
  live connection status share a row, with a labelled colour indicator on the right.
- Panel heading borders align on the empty workspace. On desktop the workspace
  fits the viewport, with questions always visible below the map and details.
  Long details scroll inside their own panel. The coverage disclosure arrow has
  space before its label. UI copy uses plain punctuation without decorative
  characters, em dashes or semicolons.
- The title, sidebar headings and form use the same left inset. Empty map and
  file details retain their subdued helper text, spacing and small outline icons.
- A shared top navbar with a prominent monospace “What Breaks.” title linking home, plus the
  organization and account menus. There is no duplicate Repositories link or
  unlabeled navigation icon. The map
  shows the repository at the top left of its canvas and the commit at the top
  right on the same line, without a duplicate repository row. Progress still
  identifies its repository below the navbar.
  Invitations live in organization settings; there is no separate invite button.

## Constraints

- Submission authenticates with Clerk and creates/reuses the analysis under RLS.
  A single server-only writer may then use the Supabase secret key, bound to the
  captured organization, explicitly created or retried analysis, and run identity, so token expiry cannot stop
  progress, completion or failure writes. Merely reused analyses are not writable through
  this path. Application reads remain on the authenticated client under RLS.

- Live progress is driven from the database, not from the browser polling.
  Something in the database publishes when the stage moves, and the page
  subscribes. Publish the stage and its message, not the whole row — then the
  page has nothing to filter and nothing to interpret.
- **The channel has to be declared before anything can publish to it.** A
  pattern for per-analysis channels is registered as part of the migration,
  alongside the tables. Publishing to an unregistered channel silently goes
  nowhere, and the symptom is a progress page that simply never updates.
- Publish from a trigger on our own table. Never attach a trigger to the
  realtime machinery itself.
- **Who may subscribe is also a policy.** Another organization's analysis
  channel is not subscribable, for the same reason its rows aren't selectable.
  The progress stream is protected the same way the data is.
- The browser side uses the authenticated client, not a bare one — it needs the
  access token cookie to open the socket, which is why that cookie is readable
  in the first place.
- A run that fails writes _why_ it failed and which stage it failed in.
- **A run that dies without failing has to be visible too.** Nothing here has a
  queue or a timeout, so a process that stops mid-parse leaves a row that will
  say "parsing" forever. The dashboard marks any unfinished run past a few
  minutes old as stale, so the difference between working and abandoned is
  legible without opening it.
- The coverage banner may collapse, but it collapses to a single line that
  still names the figure. A graph that is quietly thirty percent complete must
  never be able to look complete.
- **Delete the checked-in parser output and the preview route as part of this
  phase.** It was scaffolding to build the interface against; analyses are
  stored properly now. Everything built on it keeps working, on live data.

## Acceptance check

1. Paste a public repository URL. The stages tick past with real names, not a
   spinner, and land on its map.
2. Paste a repository you've already analysed. You land on the existing
   analysis. There is still one row for it, not two.
3. Paste a URL for a repository that doesn't exist. It fails with a message
   that says what went wrong, and the dashboard row reads failed — not
   "parsing" forever.
4. Open the dashboard in a second tab during a run. The stage updates there
   too, without a refresh.
5. Analyse a repository with a deliberately awkward setup — aliases, or a
   nested app — and confirm the coverage banner appears and names a figure
   under 95%.
6. Open an analysis in the shared workspace. The navbar shows the active organization and
   clicking “What Breaks.” returns to the dashboard. The page names its repository/view. Organization settings
   provide invitations without a separate invite button.
7. Open home: no repository is selected. Choose one from the left-hand list:
   its map (or progress) appears beside the same list, with file details on the
   right. Select a file to populate details. Bookmark the selected URL and use
   browser Back/Forward to restore previous selections, including the empty home.
8. Retry a failed analysis. Its URL stays the same and progress starts again.
   Active and completed analyses do not offer Retry. A stale run does.
9. Remove a completed, failed or stale analysis, cancel once, then confirm.
   The row disappears in both tabs. Removing the selected analysis opens home.
   An active run has no Remove action.

## Not in this phase

Framework-specific roles, and routes.
