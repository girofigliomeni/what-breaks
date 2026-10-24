"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function useRealtimeClientFactory() {
  const { getToken, orgId } = useAuth();
  // Client Components also render on the server. Construct the socket client
  // only when its consumer's browser effect runs, never during server rendering.
  return useCallback(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase browser configuration is missing.");
    return createClient<Database>(url, key, {
      // Realtime uses this callback on joins and heartbeats. Clerk's browser SDK
      // refreshes tokens; no copied cookie or server request token gets frozen.
      accessToken: async () => {
        const token = await getToken({ organizationId: orgId ?? undefined });
        if (!token) throw new Error("Sign in again to receive live progress.");
        return token;
      },
    });
  }, [getToken, orgId]);
}
