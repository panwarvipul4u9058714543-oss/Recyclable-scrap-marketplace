import { listActiveAdPlacements } from "@/lib/monetisation/ads";
import type { AdSurface } from "@/lib/monetisation/plans";
import { AdPanelClient } from "./AdPanelClient";

/**
 * Renders active ad placements for a surface as a distinct sponsored block
 * beside the primary list — it never blocks the core transaction flow. Server
 * component that resolves the placements up-front and hands them to a small
 * client child for impression / click tracking. Returns null when there are
 * no active placements (including when monetisation is disabled, since
 * listActiveAdPlacements returns []).
 */
export async function AdPanel({ surface }: { surface: AdSurface }) {
  const placements = await listActiveAdPlacements(surface);
  if (placements.length === 0) return null;
  return (
    <AdPanelClient
      placements={placements.map((p) => ({
        id: p.id,
        headline: p.headline,
        body: p.body,
        linkUrl: p.linkUrl,
        sponsorName: p.sponsorName,
      }))}
    />
  );
}
