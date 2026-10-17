import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { buttonClasses, Container } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Container className="max-w-xl py-10 text-center">
      <MapPinOff className="mx-auto size-10 text-slate-400" aria-hidden />
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Mukhang naligaw tayo</h1>
      <p className="mt-2 text-slate-600">We couldn&apos;t find that page. It may have been removed, merged, or the link is incomplete.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className={buttonClasses("primary", "md")}>
          Search routes
        </Link>
        <Link href="/questions" className={buttonClasses("secondary", "md")}>
          Browse Q&amp;A
        </Link>
      </div>
    </Container>
  );
}
