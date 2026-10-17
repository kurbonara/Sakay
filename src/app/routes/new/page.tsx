import type { Metadata } from "next";
import { RouteForm } from "@/components/route-form";
import { Container, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { modeLabels } from "@/lib/labels";

export const metadata: Metadata = { title: "Add a route" };

export default async function NewRoutePage() {
  const [{ t, lang }, modes] = await Promise.all([getI18n(), modeLabels(), requireViewer("/routes/new")]);
  return (
    <I18nProvider lang={lang}>
      <Container className="max-w-3xl">
        <PageHeader
          title={t("nav.contribute")}
          subtitle="Add each ride as a leg. Use landmarks people know (malls, schools, churches, terminals) and the exact signboard text."
        />
        <RouteForm modeLabels={modes} />
      </Container>
    </I18nProvider>
  );
}
