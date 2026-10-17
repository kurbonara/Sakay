import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "Ask a question" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/i;

export default async function AskPage({ searchParams }: PageProps<"/questions/ask">) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const [{ t, lang }, { supabase }] = await Promise.all([getI18n(), requireViewer(`/questions/ask${qs ? `?${qs}` : ""}`)]);

  const fromId = UUID.test(one(sp.fromId)) ? one(sp.fromId) : null;
  const toId = UUID.test(one(sp.toId)) ? one(sp.toId) : null;
  const ids = [fromId, toId].filter(Boolean) as string[];
  const { data: places } = ids.length ? await supabase.from("places").select("id, name, kind, city, lat, lng").in("id", ids) : { data: [] };
  const find = (id: string | null, text: string) => places?.find((p) => p.id === id) ?? (text ? { id: "", name: text } : null);
  const from = find(fromId, one(sp.from));
  const to = find(toId, one(sp.to));
  const initialTitle = one(sp.title) || (from && to ? `How do I get from ${from.name} to ${to.name}?` : "");

  return (
    <I18nProvider lang={lang}>
      <Container>
        <PageHeader title={t("qa.ask")} subtitle={t("qa.subtitle")} />
        <AskForm initialTitle={initialTitle} initialFrom={from} initialTo={to} />
      </Container>
    </I18nProvider>
  );
}
