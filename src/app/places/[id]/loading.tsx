import { RouteGridSkeleton } from "@/components/route-bits";
import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function PlaceLoading() {
  return (
    <Container className="space-y-5" aria-busy="true">
      <Skeleton className="h-4 w-28" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-9 w-3/4" />
          <Card className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </Card>
        </div>
        <Skeleton className="h-72 w-full rounded-2xl lg:h-[460px]" />
      </div>
      <RouteGridSkeleton count={3} />
    </Container>
  );
}
