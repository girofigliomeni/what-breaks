# Large graph storage timeout

The shadcn-ui/ui completion RPC exceeded the API's inherited eight-second
statement timeout. Logs showed failures during both file and edge insertion.

Completion now builds a path-to-ID lookup from INSERT RETURNING rather than
joining freshly inserted files using plans based on older table statistics.
It reads only the analysis fields it needs and checks the inserted edge count
directly. Missing endpoints still abort the entire transaction. Run identity,
organization isolation and service-only mutation permissions are unchanged.

The service-only complete_analysis_run RPC has a bounded 60-second timeout,
following Supabase's function-level timeout guidance. Other queries retain
their existing limits. Both migrations are applied to the what-breaks project.

Verification used the real shadcn-ui/ui parser payload: 4,411 files, 9,948 edges,
and about 9 MB of JSON. Before the fix, its API save timed out. After the fix,
the database completion took 1.4 seconds and the full API request took 9.7
seconds. Stored file and edge counts matched the payload exactly. The
disposable database fixture and local payload were removed afterward; the
user's failed analysis was not retried or modified.

The pipeline and lifecycle SQL checks passed, including missing-endpoint
rollback, replaced-run rejection and client mutation restrictions. TypeScript,
ESLint and production build passed. Security advisors returned no findings.
Browser acceptance remains manual: Retry the failed analysis and confirm
that storing finishes and the map opens.

## Retry progress reconciliation

A subsequent retry failed during fetching after GitHub's 60-second timeout,
while the progress view still showed fetching and the sidebar retained the
previous storage error. The database published queued, fetching and failed
events; a terminal websocket subscription received all three.

Readbacks now use authenticated, uncached GET handlers rather than sharing
Next's sequential Server Action dispatcher with mutations. Database reads
still use the Clerk token and RLS. Retry explicitly reconciles the sidebar;
new server snapshots reset its retained client rows. Both views reconcile on
subscription, reconnect, window focus and network recovery, with outdated
read responses discarded. Progress also reconciles on mount independently of
socket availability. There is no database polling timer.

GitHub timeout messages now name the commit lookup or archive download and
the 60-second limit. The pipeline regression script covers timeout failure
persistence. Types, lint and build pass. Browser acceptance remains manual:
Retry should clear the old failed sidebar state, and a later failure should
show its current reason in both views. Switching away and back should recover
the latest stored state even after a socket interruption.
