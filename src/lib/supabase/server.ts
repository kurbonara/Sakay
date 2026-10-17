import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads the signed-in user's session from cookies, so every query runs with
 * their permissions (RLS). Cookies are read first so this never runs during
 * the static prerender.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Anonymous client (public data only) for places without a request, like OG images. */
export function createAnonClient() {
  const { url, key } = supabaseEnv();
  return createPlainClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
