import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { UpdatePasswordForm } from "../../(auth)/auth-forms";
import { AuthShell } from "../../(auth)/auth-shell";

export const metadata: Metadata = { title: "New password" };

export default async function UpdatePasswordPage() {
  const [{ t }] = await Promise.all([getI18n(), requireViewer("/account/update-password")]);
  return (
    <AuthShell title={t("auth.newPassword")} subtitle="Choose a new password for your Sakay account.">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
