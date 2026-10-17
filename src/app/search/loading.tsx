import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function SearchLoading() {
  return (
    <Container className="space-y-5" aria-busy="true">
      <Card className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="mx-auto size-9 rounded-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full sm:w-40" />
      </Card>
      <Skeleton className="h-7 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-48 rounded-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl lg:h-[520px]" />
      </div>
    </Container>
  );
}
