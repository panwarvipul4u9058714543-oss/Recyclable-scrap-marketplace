"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RatingFormProps {
  connectionId: string;
  counterpartyLabel: string;
  existingScore: number | null;
  existingComment: string | null;
}

export function RatingForm({
  connectionId,
  counterpartyLabel,
  existingScore,
  existingComment,
}: RatingFormProps) {
  const router = useRouter();
  const [score, setScore] = useState<number>(existingScore ?? 5);
  const [comment, setComment] = useState<string>(existingComment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (existingScore !== null) {
    return (
      <section aria-label="Your rating" style={sectionStyle}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>
          Your rating
        </h2>
        <p style={{ margin: 0 }}>
          You rated {counterpartyLabel} <strong>{existingScore} / 5</strong>.
        </p>
        {existingComment && (
          <p style={{ margin: "0.3rem 0 0", color: "#9e9e9e" }}>
            &ldquo;{existingComment}&rdquo;
          </p>
        )}
      </section>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/rating`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score, comment }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (data?.error === "already_rated") {
          setError("You have already rated this connection.");
        } else {
          setError("Could not save your rating. Please try again.");
        }
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Rate the counterparty" style={sectionStyle}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>
        Rate {counterpartyLabel}
      </h2>
      <form onSubmit={onSubmit}>
        {error && (
          <p role="alert" style={{ color: "#ff8a80", margin: "0 0 0.5rem" }}>
            {error}
          </p>
        )}
        <label htmlFor="rating-score">Score</label>
        <select
          id="rating-score"
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          style={inputStyle}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} — {["Poor", "Fair", "OK", "Good", "Excellent"][n - 1]}
            </option>
          ))}
        </select>
        <label htmlFor="rating-comment">Comment (optional)</label>
        <textarea
          id="rating-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          style={inputStyle}
        />
        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? "Saving…" : "Submit rating"}
        </button>
      </form>
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
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};
