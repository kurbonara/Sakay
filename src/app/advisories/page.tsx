import { requestNow } from "@/lib/time";
import { CloudSun } from "lucide-react";
import type { Metadata } from "next";
import { AdvisoryItem } from "@/components/advisory-list";
import { LiveRefresh } from "@/components/live-refresh";
import { Container, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { ADVISORY } from "@/lib/queries";
import type { Advisory } from "@/lib/types";

export const metadata: Metadata = { title: "Advisories" };

export default async function AdvisoriesPage() {
  const [{ t, lang }, { supabase, isStaff }] = await Promise.all([getI18n(), getViewer()]);
  const now = await requestNow();
  const nowIso = new Date(now).toISOString();
  // RLS already hides ended advisories from the public; filter here too so staff see the same list.
  const { data } = await supabase.from("advisories").select(ADVISORY).or(`ends_at.is.null,ends_at.gt."${nowIso}"`).order("starts_at", { ascending: true });
  const all = (data ?? []) as Advisory[];
  const current = all.filter((a) => new Date(a.starts_at).getTime() <= now);
  const upcoming = all.filter((a) => new Date(a.starts_at).getTime() > now);
  const labels = { until: t("advisories.until"), starts: t("advisories.starts") };

  return (
    <I18nProvider lang={lang}>
      {/* Refresh live on changes, and exactly when an advisory starts or ends. */}
      <LiveRefresh tables={[{ table: "advisories" }]} boundaries={all.flatMap((a) => [a.starts_at, a.ends_at])} />
      <Container className="max-w-3xl space-y-6">
        <PageHeader
          title={t("advisories.title")}
          subtitle={t("advisories.subtitle")}
          actions={isStaff ? <LinkButton href="/admin/advisories" variant="secondary">Manage advisories</LinkButton> : null}
        />
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("advisories.current")}</h2>
          {current.length ? current.map((a) => <AdvisoryItem key={a.id} a={a} labels={labels} now={now} />) : <EmptyState icon={<CloudSun className="size-8" />} title={t("advisories.none")} />}
        </section>
        {upcoming.length ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("advisories.upcoming")}</h2>
            {upcoming.map((a) => (
              <AdvisoryItem key={a.id} a={a} labels={labels} now={now} />
            ))}
          </section>
        ) : null}
      </Container>
    </I18nProvider>
  );
}
