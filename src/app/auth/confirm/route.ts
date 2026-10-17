import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing page for links in Supabase emails (sign-up confirmation, password
// reset, magic links). Supports both the token_hash style and the PKCE ?code=.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();
  let errorMessage: string | null = null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) errorMessage = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) errorMessage = error.message;
  } else {
    errorMessage = "This link is missing information.";
  }

  if (errorMessage) {
    const friendly = /expired|invalid/i.test(errorMessage)
      ? "That link has expired or was already used. Sign in, or request a new link."
      : "We couldn't confirm that link. Please try signing in, or request a new link.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(friendly)}`, origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
