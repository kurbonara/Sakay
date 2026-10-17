import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { SignUpForm } from "../auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Create account" };

const safe = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/account");

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = safe(sp.next);
  const [{ t }, { userId }] = await Promise.all([getI18n(), getViewer()]);
  if (userId) redirect(next);
  return (
    <AuthShell
      title={t("auth.signUpTitle")}
      subtitle={t("auth.signUpSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            {t("nav.signIn")}
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthShell>
  );
}
