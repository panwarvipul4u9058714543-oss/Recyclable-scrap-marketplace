"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingStatus } from "@/lib/listings/listings";

type Action = "pause" | "resume" | "close";

export function ListingActions({
  id,
  status,
}: {
  id: string;
  status: ListingStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (action === "close" && !confirm("Close this listing permanently?")) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setError("Could not update the listing. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "CLOSED") {
    return <span style={{ color: "#9e9e9e" }}>Closed</span>;
  }

  return (
    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
      {status === "ACTIVE" && (
        <button
          type="button"
          onClick={() => run("pause")}
          disabled={busy}
          style={actionStyle}
        >
          Pause
        </button>
      )}
      {status === "PAUSED" && (
        <button
          type="button"
          onClick={() => run("resume")}
          disabled={busy}
          style={actionStyle}
        >
          Resume
        </button>
      )}
      <button
        type="button"
        onClick={() => run("close")}
        disabled={busy}
        style={{ ...actionStyle, color: "#ff8a80" }}
      >
        Close
      </button>
      {error && (
        <span role="alert" style={{ color: "#ff8a80", fontSize: "0.85rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}

const actionStyle: React.CSSProperties = {
  padding: "0.35rem 0.7rem",
  fontSize: "0.85rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
