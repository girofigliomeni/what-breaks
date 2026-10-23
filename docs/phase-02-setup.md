# Phase 02 setup

The tracked migrations have been applied to the `what-breaks` Supabase project.
Eight data tables reference a ninth `organizations` parent by Clerk organization
ID. All nine enable and force RLS. Authenticated clients have SELECT access only;
policies read Clerk's `o.id` claim (or legacy `org_id`). Composite foreign keys
keep project, analysis and file references inside the same organization.

An existing `ensure_rls` database event trigger enables RLS on new tables. The
second migration revokes public execution of its privileged trigger function.

`supabase/seed.sql` contains repeatable development fixtures for Girolamo's
Organization and What Breaks Seed Team. Each has four example analysis states
and a distinct repository. No files, edges or parser results are fabricated.
Replace the two Clerk organization IDs before seeding another instance.

`supabase/verify.sql` checks all nine tables, token isolation, missing claims and
parent deletion from SQL, rolling back its temporary data. Run as database owner.
This does not replace the manual browser acceptance check.

The dashboard uses the server-only Clerk-token client with no organization
filter, requests named columns and shows at most 50 analyses. Organization
selection returns to `/` and resolves the query with the new session token.
An organization without analyses shows the empty state. No polling is used.

Clerk's Supabase integration and Supabase's Clerk Third-Party Auth provider
must be enabled as described in the phase 01 setup notes. SQL token checks
verify policies, but do not verify that provider configuration or browser flow.
