// Central place for configuration. NEXT_PUBLIC_* values are inlined at build
// time, so they must be referenced literally (process.env.NEXT_PUBLIC_X).

export class MissingEnvError extends Error {
  constructor(public missing: string[]) {
    super(
      `Missing ${missing.join(", ")} in .env.local. ` +
        `Copy .env.example to .env.local, paste the values from your Supabase dashboard ` +
        `(Project Settings → API Keys and Data API), then restart "npm run dev". ` +
        `On Vercel, add the same variables under Project → Settings → Environment Variables and redeploy.`,
    );
    this.name = "MissingEnvError";
  }
}

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
