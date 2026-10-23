import "server-only";

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing ${name}. Set it in .env.local before starting What Breaks.`);
  return value;
}

export function getEnvironment() {
  const clerkPublishableKey = required("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const clerkSecretKey = required("CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY);
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const url = URL.parse(supabaseUrl);
  if (!url || !["https:", "http:"].includes(url.protocol)) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTP or HTTPS URL.");
  return { clerkPublishableKey, clerkSecretKey, supabaseUrl, supabasePublishableKey };
}
