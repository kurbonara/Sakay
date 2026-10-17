import { Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function AdvisoriesLoading() {
  return (
    <Container className="max-w-3xl space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-4 w-32" />
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </Container>
  );
}
