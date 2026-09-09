"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SuspendedRowProps {
  user: {
    id: string;
    phone: string;
    suspendedAt: string | null;
    suspensionReason: string | null;
  };
}

export function SuspendedRow({ user }: SuspendedRowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reinstate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not reinstate.");
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
    <article aria-label="Suspended account" style={rowStyle}>
      <p style={{ margin: 0 }}>
        <strong>{user.phone}</strong> — suspended{" "}
        {user.suspendedAt
          ? new Date(user.suspendedAt).toLocaleString()
          : "(unknown)"}
      </p>
      {user.suspensionReason && (
        <p style={{ margin: "0.3rem 0 0" }}>
          Reason: {user.suspensionReason}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "#ff8a80", margin: "0.4rem 0 0" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={reinstate}
        disabled={busy}
        style={buttonStyle}
      >
        {busy ? "Reinstating…" : "Reinstate"}
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

const buttonStyle: React.CSSProperties = {
  marginTop: "0.6rem",
  padding: "0.45rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
