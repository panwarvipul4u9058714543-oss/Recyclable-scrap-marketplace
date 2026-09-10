"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AD_SURFACES } from "@/lib/monetisation/plans";

export function NewAdPlacementForm() {
  const router = useRouter();
  const [surface, setSurface] = useState<(typeof AD_SURFACES)[number]>(
    "DISCOVERY",
  );
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/monetisation/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          surface,
          headline: headline.trim(),
          body: body.trim(),
          linkUrl: linkUrl.trim(),
          sponsorName: sponsorName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error === "disabled"
            ? "Monetisation is currently disabled."
            : "Could not create placement.",
        );
        return;
      }
      setHeadline("");
      setBody("");
      setLinkUrl("");
      setSponsorName("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="New ad placement" style={formStyle}>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <label style={{ flex: "0 0 180px" }}>
          Surface
          <select
            value={surface}
            onChange={(e) =>
              setSurface(e.target.value as (typeof AD_SURFACES)[number])
            }
            style={inputStyle}
          >
            {AD_SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: "1 1 200px" }}>
          Sponsor name (optional)
          <input
            type="text"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            maxLength={200}
            style={inputStyle}
          />
        </label>
      </div>
      <label>
        Headline
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          required
          maxLength={200}
          style={inputStyle}
        />
      </label>
      <label>
        Body
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={1000}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>
      <label>
        Link URL
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          required
          style={inputStyle}
        />
      </label>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} style={primaryButtonStyle}>
        {busy ? "Saving…" : "Create placement"}
      </button>
    </form>
  );
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  margin: "0.5rem 0 1rem",
  padding: "0.8rem",
  border: "1px solid #333",
  borderRadius: 8,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.45rem",
  marginTop: "0.25rem",
  fontSize: "0.95rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
  justifySelf: "start",
};
