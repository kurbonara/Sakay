import "server-only";
import type { RouteCardLabels, StepLabels } from "@/components/route-bits";
import { getI18n } from "@/lib/i18n/server";
import type { TransportMode } from "@/lib/types";

export async function modeLabels(): Promise<Record<TransportMode, string>> {
  const { t } = await getI18n();
  return {
    jeepney: t("modes.jeepney"),
    bus: t("modes.bus"),
    uv_express: t("modes.uv_express"),
    tricycle: t("modes.tricycle"),
    train: t("modes.train"),
    ferry: t("modes.ferry"),
    walk: t("modes.walk"),
  };
}

export async function routeCardLabels(): Promise<RouteCardLabels> {
  const { t } = await getI18n();
  return {
    modes: await modeLabels(),
    sample: t("route.sample"),
    pwd: t("route.pwd"),
    senior: t("route.senior"),
    heavy: t("route.heavy"),
    reports: t("route.openReports"),
    status: { pending: t("route.pending"), rejected: t("route.rejected"), archived: t("route.archived"), published: "" },
  };
}


export async function stepLabels(): Promise<StepLabels> {
  const { t } = await getI18n();
  return {
    modes: await modeLabels(),
    signboard: t("route.signboard"),
    from: t("route.from"),
    to: t("route.to"),
    ride: t("route.ride"),
    walk: t("route.walk"),
  };
}
