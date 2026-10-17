import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { BadgeList } from "@/components/profile-bits";
import { Card, Chip, Container, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import type { RouteStatus } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Account" };

const STATUS_TONE: Record<RouteStatus, "amber" | "emerald" | "rose" | "slate"> = { pending: "amber", published: "emerald", rejected: "rose", archived: "slate" };

export default async function AccountPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), requireViewer("/account")]);
  const { supabase, userId, profile, email } = viewer;
  const [subs, reports] = await Promise.all([
    supabase.from("routes").select("id, title, status, review_note, created_at, reviewed_at").eq("submitted_by", userId!).order("created_at", { ascending: false }).limit(30),
    supabase.from("reports").select("id, target_type, target_id, reason, status, resolution_note, created_at").eq("reporter_id", userId!).order("created_at", { ascending: false }).limit(20),
  ]);
  const submissions = (subs.data ?? []) as { id: string; title: string; status: RouteStatus; review_note: string | null; created_at: string; reviewed_at: string | null }[];
  const myReports = (reports.data ?? []) as { id: string; target_type: string; target_id: string; reason: string; status: string; resolution_note: string | null; created_at: string }[];

  if (!profile) {
    return (
      <Container className="max-w-2xl">
        <EmptyState title="Your profile is still being set up" body="Please sign out and sign in again. If this keeps happening, the database migration may not have run yet." />
      </Container>
    );
  }

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "routes", filter: `submitted_by=eq.${userId}` }, { table: "reports", filter: `reporter_id=eq.${userId}` }, { table: "profiles", filter: `id=eq.${userId}` }]} />
      <Container className="max-w-3xl space-y-6">
        <PageHeader
          title={t("nav.account")}
          subtitle={email ?? undefined}
          actions={
            <LinkButton href={`/u/${profile.username}`} variant="secondary">
              {t("nav.profile")}
            </LinkButton>
          }
        />
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-900">
              {profile.points} {t("contributors.points")}
            </h2>
            <Link href="/contributors" className="text-sm font-medium text-brand-700 hover:underline">
              {t("nav.contributors")} →
            </Link>
          </div>
          <BadgeList profile={profile} />
        </Card>
        <Card>
          <h2 className="mb-4 font-bold text-slate-900">Profile</h2>
          <ProfileForm profile={profile} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-slate-900">My route submissions</h2>
          {submissions.length ? (
            <ul className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/routes/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {s.title}
                    </Link>
                    <p className="text-xs text-slate-500">Submitted {formatDateTime(s.created_at)}</p>
                    {s.review_note ? <p className="mt-1 text-sm text-slate-600">Moderator: {s.review_note}</p> : null}
                  </div>
                  <Chip tone={STATUS_TONE[s.status]}>{s.status}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              No submissions yet.{" "}
              <Link href="/routes/new" className="font-semibold text-brand-700 hover:underline">
                {t("nav.contribute")}
              </Link>
            </p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-slate-900">My reports</h2>
          {myReports.length ? (
            <ul className="divide-y divide-slate-100">
              {myReports.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="text-slate-800">
                      {r.reason.replaceAll("_", " ")} · {r.target_type}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(r.created_at)}</p>
                    {r.resolution_note ? <p className="text-slate-600">Moderator: {r.resolution_note}</p> : null}
                  </div>
                  <Chip tone={r.status === "open" ? "amber" : r.status === "resolved" ? "emerald" : "slate"}>{r.status}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">You haven&apos;t reported anything.</p>
          )}
        </Card>
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">Want to change your password?</p>
          <LinkButton href="/account/update-password" variant="secondary">
            Change password
          </LinkButton>
        </Card>
      </Container>
    </I18nProvider>
  );
}
