import { Container, Skeleton } from "@/components/ui/primitives";

export default function AnalyticsLoading() {
  return (
    <Container className="space-y-5" aria-busy="true">
      <Skeleton className="h-8 w-36" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </Container>
  );
}
