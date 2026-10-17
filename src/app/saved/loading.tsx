import { RouteGridSkeleton } from "@/components/route-bits";
import { Container, PageHeaderSkeleton } from "@/components/ui/primitives";

export default function SavedLoading() {
  return (
    <Container aria-busy="true">
      <PageHeaderSkeleton withActions />
      <RouteGridSkeleton count={6} />
    </Container>
  );
}
