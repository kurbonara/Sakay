import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { SignInForm } from "../auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Sign in" };

const safe = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/");

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safe(sp.next);
  const [{ t }, { userId }] = await Promise.all([getI18n(), getViewer()]);
  if (userId) redirect(next);
  return (
    <AuthShell
      title={t("auth.signInTitle")}
      subtitle={t("common.signInToHelp")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 hover:underline">
            {t("nav.signUp")}
          </Link>
        </>
      }
    >
      <SignInForm next={next} error={typeof sp.error === "string" ? sp.error : undefined} />
    </AuthShell>
  );
}
