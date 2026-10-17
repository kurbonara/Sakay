import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MissingEnvError, supabaseEnv } from "@/lib/env";

// Pages that need a signed-in user. This is only a convenience redirect; the
// real checks happen in the database (RLS + RPCs) and in each page.
const PROTECTED = ["/account", "/saved", "/routes/new", "/questions/ask", "/admin"];

function envErrorPage(error: MissingEnvError) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sakay setup needed</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}main{max-width:640px;margin:10vh auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px}code{background:#f1f5f9;padding:2px 6px;border-radius:6px}h1{font-size:22px;margin:0 0 12px}li{margin:6px 0}</style></head>
<body><main><h1>Almost there: Sakay needs its settings</h1>
<p>${error.message.replace(/</g, "&lt;")}</p>
<ol><li>In the project folder, copy <code>.env.example</code> to <code>.env.local</code>.</li>
<li>Fill in <code>${error.missing.join("</code>, <code>")}</code>.</li>
<li>Stop and restart <code>npm run dev</code>.</li></ol></main></body></html>`;
  return new NextResponse(html, { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function proxy(request: NextRequest) {
  let env: { url: string; key: string };
  try {
    env = supabaseEnv();
  } catch (e) {
    if (e instanceof MissingEnvError) return envErrorPage(e);
    throw e;
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Refreshes the session cookie if needed and verifies the JWT.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files, images, the service worker and metadata files.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
