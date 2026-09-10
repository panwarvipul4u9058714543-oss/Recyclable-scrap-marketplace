"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AdPlacementRowProps {
  placement: {
    id: string;
    surface: string;
    headline: string;
    body: string;
    linkUrl: string;
    sponsorName: string | null;
    status: "ACTIVE" | "PAUSED";
    createdAt: string | Date;
  };
}

export function AdPlacementRow({ placement }: AdPlacementRowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/monetisation/ads/${placement.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: placement.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
        }),
      });
      if (!res.ok) {
        setError("Could not update placement.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article aria-label={`Ad placement ${placement.headline}`} style={rowStyle}>
      <p style={{ margin: 0 }}>
        <strong>{placement.headline}</strong>{" "}
        <span style={{ color: "#9e9e9e", fontSize: "0.85rem" }}>
          · {placement.surface} · {placement.status}
        </span>
      </p>
      {placement.sponsorName && (
        <p style={metaStyle}>Sponsor: {placement.sponsorName}</p>
      )}
      <p style={{ margin: "0.3rem 0 0" }}>{placement.body}</p>
      <p style={metaStyle}>Link: {placement.linkUrl}</p>
      {error && (
        <p role="alert" style={{ color: "#ff8a80", margin: "0.4rem 0 0" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        style={secondaryButtonStyle}
      >
        {busy
          ? "Saving…"
          : placement.status === "ACTIVE"
            ? "Pause"
            : "Activate"}
      </button>
    </article>
  );
}

const rowStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.8rem 0",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.85rem",
  margin: "0.3rem 0 0",
};

const secondaryButtonStyle: React.CSSProperties = {
  marginTop: "0.6rem",
  padding: "0.45rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
