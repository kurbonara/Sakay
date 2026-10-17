import { Container } from "@/components/ui/primitives";
import { AdminNav } from "./admin-nav";

// Static shell only: each admin page checks the viewer's role itself, and every
// action is re-checked by the database.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Container>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-600">Sakay admin</p>
        <AdminNav />
      </Container>
      {children}
    </>
  );
}
