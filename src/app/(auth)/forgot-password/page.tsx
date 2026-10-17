import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { ForgotForm } from "../auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthShell
      title={t("auth.resetTitle")}
      subtitle="Enter your email and we'll send you a link to set a new password."
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          ← {t("nav.signIn")}
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
