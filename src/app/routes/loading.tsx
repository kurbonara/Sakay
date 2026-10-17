import { RouteGridSkeleton } from "@/components/route-bits";
import { Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function RoutesLoading() {
  return (
    <Container aria-busy="true">
      <PageHeaderSkeleton withActions />
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="mt-5">
        <RouteGridSkeleton count={6} />
      </div>
    </Container>
  );
}
