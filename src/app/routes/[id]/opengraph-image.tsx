import { ImageResponse } from "next/og";
import { duration, peso } from "@/lib/format";
import { getPublicRouteMeta } from "@/lib/public-data";

export const alt = "Route on Sakay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share image for Facebook/Messenger link previews (and the "Image" download button).
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = await getPublicRouteMeta(id);
  const title = route?.title ?? "Find your ride on Sakay";
  const subtitle = route ? `${route.origin?.name ?? ""} → ${route.destination?.name ?? ""}` : "Routes, fares and answers for commuters";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1d4ed8", color: "white", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 800 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 16, background: "#fbbf24", color: "#1d4ed8", alignItems: "center", justifyContent: "center", fontSize: 40 }}>S</div>
          Sakay
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 34, color: "#bfdbfe" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 32 }}>
          {route ? (
            <>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.15)", borderRadius: 16, padding: "12px 24px" }}>~{peso(route.total_fare)}</div>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.15)", borderRadius: 16, padding: "12px 24px" }}>{duration(route.total_minutes)}</div>
            </>
          ) : null}
          <div style={{ display: "flex", marginLeft: "auto", color: "#fcd34d" }}>Step-by-step directions →</div>
        </div>
      </div>
    ),
    size,
  );
}
