"use client";

import { useState } from "react";

export function NotificationPreferences({
  initialNotifyOnRouteMatch,
}: {
  initialNotifyOnRouteMatch: boolean;
}) {
  const [enabled, setEnabled] = useState(initialNotifyOnRouteMatch);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function onChange(next: boolean) {
    setStatus("saving");
    setEnabled(next);
    try {
      const res = await fetch("/api/preferences/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notifyOnRouteMatch: next }),
      });
      if (!res.ok) {
        setStatus("error");
        setEnabled(!next);
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
      setEnabled(!next);
    }
  }

  return (
    <section
      aria-label="Notification preferences"
      style={{ marginTop: "1.5rem" }}
    >
      <h2 style={{ fontSize: "1.05rem" }}>Notification preferences</h2>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 0",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          Notify me on <strong>route matches</strong> — new listings that fit
          your active route.
        </span>
      </label>
      {status === "saved" && (
        <p role="status" style={{ color: "#81c784", fontSize: "0.85rem" }}>
          Preferences saved.
        </p>
      )}
      {status === "error" && (
        <p role="alert" style={{ color: "#ff8a80", fontSize: "0.85rem" }}>
          Couldn&apos;t save. Please try again.
        </p>
      )}
    </section>
  );
}
