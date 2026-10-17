import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/primitives";
import { OfflineRoutesList } from "./offline-routes";

export const metadata: Metadata = { title: "Offline routes" };

// Fully static: the service worker caches this page so it opens with no signal.
export default function OfflinePage() {
  return (
    <Container className="max-w-3xl">
      <PageHeader
        title="Your offline routes"
        subtitle="These are the routes you saved, stored on this device. They work even without mobile data."
      />
      <OfflineRoutesList />
    </Container>
  );
}
