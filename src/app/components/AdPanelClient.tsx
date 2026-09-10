"use client";

import { useEffect, useRef } from "react";

interface AdPanelClientPlacement {
  id: string;
  headline: string;
  body: string;
  linkUrl: string;
  sponsorName: string | null;
}

/**
 * Renders the sponsored panel and posts one impression per placement id on
 * mount. Deduplicates within a mount so re-renders don't double-count.
 * Failures are silent — an ad panel must never block the user's page.
 */
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
    <aside aria-label="Sponsored" style={panelStyle}>
      <p style={headerStyle}>Sponsored</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {placements.map((p) => (
          <li key={p.id} style={itemStyle}>
            <p style={{ margin: 0, fontWeight: 600 }}>{p.headline}</p>
            {p.sponsorName && <p style={metaStyle}>{p.sponsorName}</p>}
            <p style={{ margin: "0.3rem 0 0.5rem" }}>{p.body}</p>
            <a
              href={p.linkUrl}
              target="_blank"
              rel="nofollow noopener sponsored"
              onClick={() => handleClick(p.id)}
              style={ctaStyle}
            >
              Learn more →
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: "1.5rem",
  padding: "0.9rem 1rem",
  border: "1px dashed #444",
  borderRadius: 8,
  background: "#12141a",
};

const headerStyle: React.CSSProperties = {
  margin: 0,
  color: "#9e9e9e",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const itemStyle: React.CSSProperties = {
  padding: "0.6rem 0",
  borderBottom: "1px solid #222",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.85rem",
  margin: "0.2rem 0 0",
};

const ctaStyle: React.CSSProperties = {
  color: "#82b1ff",
  fontSize: "0.9rem",
};
