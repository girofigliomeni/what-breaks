# Phase 01 setup

Required in `.env.local` (validated before the server starts):

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Clerk owns authentication. Supabase uses the active Clerk session token through
the server-only client; there is no Supabase session cookie or refresh middleware.
No tables or database queries are part of this phase.

The linked Clerk development instance has Organizations, required membership and
automatic first-organization creation enabled. Sign-in methods remain Clerk
configuration. All successful sign-ins and sign-ups return to `/`. The current
organization ID is read from the verified session during server rendering.

The workspace's Invite teammate form sends an `org:member` invitation with the
current app origin plus `/sign-in` as its redirect URL. The server checks the
active team and administrator role; no invitations are sent during setup.
The Clerk switcher's separate management interface uses Clerk's default invitation
behaviour; use Invite teammate for invitations returning to this app.

Before database policies are introduced, enable Clerk's Supabase integration and
add the Clerk domain as a Third-Party Auth provider in Supabase. This establishes
trust in the session token; an MCP connection does not configure that trust.
See [Supabase's Clerk guide](https://supabase.com/docs/guides/auth/third-party/clerk).

The theme choice is stored in local storage and applied to the root element before
paint. System mode follows the OS through CSS; explicit light/dark takes priority.
If browser storage is blocked, a preference applies for the current page only.

Desktop shell: repositories left, map centre, file details right, repository
questions beneath the map and details. On smaller screens panels stack. Empty
panels contain no synthetic repository data or inactive feature controls.
