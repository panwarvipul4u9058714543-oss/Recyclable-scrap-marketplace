"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AdPanelClientPlacement {
  id: string;
  headline: string;
  body: string;
  linkUrl: string;
  sponsorName: string | null;
}

export function AdPanelClient({
  placements,
}: {
  placements: AdPanelClientPlacement[];
}) {
  const recorded = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const p of placements) {
      if (recorded.current.has(p.id)) continue;
      recorded.current.add(p.id);
      fetch(`/api/monetisation/ads/${p.id}/impression`, {
        method: "POST",
      }).catch(() => {
        // best-effort
      });
    }
  }, [placements]);

  function handleClick(id: string) {
    fetch(`/api/monetisation/ads/${id}/click`, { method: "POST" }).catch(() => {
      // best-effort — the link is a real anchor so navigation still works
    });
  }

  return (
    <aside aria-label="Sponsored" className="animate-fade-in">
      <Card className="border-dashed bg-sand/40 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-ash">
          <Megaphone className="h-3 w-3" /> Sponsored
        </p>
        <ul className="space-y-3">
          {placements.map((p, idx) => (
            <li
              key={p.id}
              className={
                "space-y-1.5 " +
                (idx > 0 ? "border-t border-dune/60 pt-3" : "")
              }
            >
              <p className="font-serif text-base leading-tight text-ink">
                {p.headline}
              </p>
              {p.sponsorName ? (
                <p className="text-xs text-ash">{p.sponsorName}</p>
              ) : null}
              <p className="text-sm leading-snug text-ink/85">{p.body}</p>
              <a
                href={p.linkUrl}
                target="_blank"
                rel="nofollow noopener sponsored"
                onClick={() => handleClick(p.id)}
                className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-rust hover:underline"
              >
                Learn more <ArrowUpRight className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}
