// Central place for configuration. NEXT_PUBLIC_* values are inlined at build
// time, so they must be referenced literally (process.env.NEXT_PUBLIC_X).

export class MissingEnvError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(
      `Missing ${missing.join(", ")} in .env.local. ` +
        `Copy .env.example to .env.local, paste the values from your Supabase dashboard ` +
        `(Project Settings → API Keys and Data API), then restart "npm run dev". ` +
        `On Vercel, add the same variables under Project → Settings → Environment Variables and redeploy.`,
    );
    this.name = "MissingEnvError";
    this.missing = missing;
  }
}

/**
 * Accepts the Project URL the way people actually paste it: with spaces, a
 * trailing slash, or the REST endpoint copied by mistake
 * ("https://x.supabase.co/rest/v1/"). The Supabase client adds /rest/v1 itself.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim().replace(/^["']|["']$/g, "");
  if (!v) return undefined;
  return v.replace(/\/+$/, "").replace(/\/(rest|auth|realtime|storage)\/v1$/i, "").replace(/\/+$/, "");
}

export function supabaseEnv(): { url: string; key: string } {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (missing.length) throw new MissingEnvError(missing);
  return { url: url!, key: key! };
}

export function hasSupabaseEnv(): boolean {
  try {
    supabaseEnv();
    return true;
  } catch {
    return false;
  }
}

/** Public address of the site, used for share links, QR codes and auth emails. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** IANA time zone used for every date shown in the app. */
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "Asia/Manila";
