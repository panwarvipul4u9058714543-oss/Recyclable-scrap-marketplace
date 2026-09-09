"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SafetyActionsProps {
  targetUserId: string;
  initiallyBlocked: boolean;
}

export function SafetyActions({
  targetUserId,
  initiallyBlocked,
}: SafetyActionsProps) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleBlock() {
    setStatus(null);
    setBusy(true);
    try {
      const res = blocked
        ? await fetch(`/api/blocks/${encodeURIComponent(targetUserId)}`, {
            method: "DELETE",
          })
        : await fetch("/api/blocks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId: targetUserId }),
          });
      if (!res.ok) {
        setStatus("Could not update the block.");
        return;
      }
      setBlocked(!blocked);
      setStatus(!blocked ? "User blocked." : "Block removed.");
      router.refresh();
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (reason.trim().length < 2) {
      setStatus("Please pick a reason.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "USER",
          targetId: targetUserId,
          reason,
          details,
        }),
      });
      if (!res.ok) {
        setStatus("Could not send the report.");
        return;
      }
      setStatus("Report submitted. An operator will review it.");
      setReporting(false);
      setReason("");
      setDetails("");
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Safety" style={sectionStyle}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>Safety</h2>
      {status && (
        <p role="status" style={{ margin: "0 0 0.5rem" }}>
          {status}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={toggleBlock}
          disabled={busy}
          style={buttonStyle}
        >
          {blocked ? "Unblock user" : "Block user"}
        </button>
        <button
          type="button"
          onClick={() => setReporting((v) => !v)}
          disabled={busy}
          style={secondaryButtonStyle}
        >
          {reporting ? "Cancel report" : "Report user"}
        </button>
      </div>

      {reporting && (
        <form onSubmit={submitReport} style={{ marginTop: "0.6rem" }}>
          <label htmlFor="report-reason">Reason</label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={inputStyle}
          >
            <option value="">Pick a reason…</option>
            <option value="harassment">Harassment or abuse</option>
            <option value="fraud">Fraud or scam</option>
            <option value="no_show">Repeated no-shows</option>
            <option value="unsafe">Unsafe behaviour</option>
            <option value="prohibited">
              Prohibited or hazardous material
            </option>
            <option value="other">Something else</option>
          </select>
          <label htmlFor="report-details">Details (optional)</label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            style={inputStyle}
          />
          <button type="submit" disabled={busy} style={buttonStyle}>
            {busy ? "Sending…" : "Submit report"}
          </button>
        </form>
      )}
    </section>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.8rem 1rem",
  margin: "1rem 0",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5rem",
  margin: "0.35rem 0 0.8rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.95rem",
  borderRadius: 6,
  border: "none",
  background: "#c62828",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.95rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  cursor: "pointer",
};
