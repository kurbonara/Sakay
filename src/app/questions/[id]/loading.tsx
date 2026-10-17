import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function QuestionLoading() {
  return (
    <Container className="max-w-3xl space-y-5" aria-busy="true">
      <Skeleton className="h-4 w-32" />
      <Card className="space-y-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-7 w-5/6" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full" />
      </Card>
      <Skeleton className="h-6 w-32" />
      {[0, 1].map((i) => (
        <Card key={i} className="flex gap-3">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="size-7" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="size-7" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-3 w-40" />
          </div>
        </Card>
      ))}
    </Container>
  );
}
