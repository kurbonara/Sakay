import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function AdminAdvisoriesLoading() {
  return (
    <Container className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Card className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </Card>
      </div>
    </Container>
  );
}
