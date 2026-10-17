"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/env";
import { LANG_COOKIE } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/** Only allow redirects back into this site. */
function safeNext(value: FormDataEntryValue | null, fallback = "/"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password. Check them and try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox (and spam folder) for the link.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Try signing in instead.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
  if (/password should be at least/i.test(message)) return "Use a password with at least 8 characters.";
  if (/fetch failed|network/i.test(message)) return "We couldn't reach the server. Check your connection and try again.";
  return message || "Something went wrong. Please try again.";
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, message: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: authMessage(error.message) };
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!email || !password || !displayName) return { ok: false, message: "Fill in your name, email and password." };
  if (password.length < 8) return { ok: false, message: "Use a password with at least 8 characters." };
  if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
    return { ok: false, message: "Usernames use 3-24 lowercase letters, numbers or underscores." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, username: username || undefined },
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/account`,
    },
  });
  if (error) return { ok: false, message: authMessage(error.message) };
  if (data.session) {
    // "Confirm email" is turned off: the person is signed in right away.
    revalidatePath("/", "layout");
    redirect(safeNext(formData.get("next"), "/account"));
  }
  return { ok: true, message: `Almost done! We sent a confirmation link to ${email}. Open it on this device to finish signing up.` };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Enter the email you signed up with." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/account/update-password`,
  });
  if (error) return { ok: false, message: authMessage(error.message) };
  return { ok: true, message: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { ok: false, message: "Use a password with at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: authMessage(error.message) };
  return { ok: true, message: "Password updated. You're all set." };
}

export async function setLanguage(formData: FormData): Promise<void> {
  const lang = formData.get("lang") === "fil" ? "fil" : "en";
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
