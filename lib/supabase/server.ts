import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getEnvironment } from "@/lib/env";

export async function createSupabaseClient() {
  const { userId, orgId, getToken } = await auth();
  if (!userId || !orgId) throw new Error("A signed-in organization is required for database access.");
  const { supabaseUrl, supabasePublishableKey } = getEnvironment();
  return createClient(supabaseUrl, supabasePublishableKey, {
    // Clerk owns the session; resolve its token on every request rather than storing a second session.
    accessToken: async () => {
      const token = await getToken();
      if (!token) throw new Error("The Clerk session token is unavailable. Sign in again.");
      return token;
    },
  });
}
