import { Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function ContributorsLoading() {
  return (
    <Container className="max-w-3xl" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </Container>
  );
}
