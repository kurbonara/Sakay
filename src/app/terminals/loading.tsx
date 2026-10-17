import { Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function TerminalsLoading() {
  return (
    <Container aria-busy="true">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <Skeleton className="mb-2 mt-6 h-4 w-28" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}
