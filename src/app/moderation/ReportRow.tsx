"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReportRowProps {
  report: {
    id: string;
    reason: string;
    details: string | null;
    targetLabel: string;
    targetUserId: string | null;
    targetUserSuspended: boolean;
    reporterPhone: string;
    createdAt: string;
  };
}

export function ReportRow({ report }: ReportRowProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [busy, setBusy] = useState<
    "" | "resolve" | "dismiss" | "suspend"
  >("");
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "RESOLVED" | "DISMISSED") {
    setBusy(decision === "RESOLVED" ? "resolve" : "dismiss");
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        setError("Could not save the decision. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy("");
    }
  }

  async function suspend() {
    if (!report.targetUserId) return;
    if (suspendReason.trim().length < 2) {
      setError("Enter a suspension reason (at least 2 characters).");
      return;
    }
    setBusy("suspend");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${report.targetUserId}/suspend`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: suspendReason.trim() }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error === "already_suspended"
            ? "That account is already suspended."
            : "Could not suspend the account.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy("");
    }
  }

  return (
    <article aria-label="Open report" style={rowStyle}>
      <p style={{ margin: 0 }}>
        <strong>{report.reason}</strong> · against {report.targetLabel}
      </p>
      <p style={metaStyle}>
        Reported by {report.reporterPhone} on{" "}
        {new Date(report.createdAt).toLocaleString()}
      </p>
      {report.details && (
        <p style={{ margin: "0.3rem 0 0" }}>&ldquo;{report.details}&rdquo;</p>
      )}
      {error && (
        <p role="alert" style={{ color: "#ff8a80", margin: "0.4rem 0 0" }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: "0.6rem" }}>
        <label htmlFor={`note-${report.id}`}>Review note (optional)</label>
        <input
          id={`note-${report.id}`}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          style={inputStyle}
        />

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => decide("RESOLVED")}
            disabled={busy !== ""}
            style={primaryButtonStyle}
          >
            {busy === "resolve" ? "Saving…" : "Mark resolved"}
          </button>
          <button
            type="button"
            onClick={() => decide("DISMISSED")}
            disabled={busy !== ""}
            style={secondaryButtonStyle}
          >
            {busy === "dismiss" ? "Saving…" : "Dismiss"}
          </button>
        </div>
      </div>

      {report.targetUserId && !report.targetUserSuspended && (
        <div style={{ marginTop: "0.8rem" }}>
          <label htmlFor={`susp-${report.id}`}>
            Suspend the reported account (reason)
          </label>
          <input
            id={`susp-${report.id}`}
            type="text"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. Repeated no-shows across three connections"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={suspend}
            disabled={busy !== ""}
            style={dangerButtonStyle}
          >
            {busy === "suspend" ? "Suspending…" : "Suspend account"}
          </button>
        </div>
      )}
      {report.targetUserId && report.targetUserSuspended && (
        <p style={{ ...metaStyle, marginTop: "0.6rem" }}>
          That account is already suspended.
        </p>
      )}
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

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.45rem",
  margin: "0.35rem 0 0.6rem",
  fontSize: "0.95rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.45rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.45rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "0.45rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "none",
  background: "#c62828",
  color: "#fff",
  cursor: "pointer",
};
