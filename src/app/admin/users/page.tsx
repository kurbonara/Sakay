import type { Metadata } from "next";
import { NotAllowed } from "@/components/admin-bits";
import { Card, Container } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { UserSearch } from "./user-search";

export const metadata: Metadata = { title: "Members" };

export default async function AdminUsersPage() {
  const viewer = await requireStaff("/admin/users", true);
  if (!viewer) return <NotAllowed adminOnly />;
  return (
    <Container className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Members & roles</h1>
      <Card>
        <UserSearch selfId={viewer.userId!} />
      </Card>
      <p className="text-xs text-slate-500">Every role change and suspension is recorded in the audit log.</p>
    </Container>
  );
}
