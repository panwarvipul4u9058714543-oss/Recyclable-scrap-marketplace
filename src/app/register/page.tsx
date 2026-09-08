"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

type Phase = "phone" | "code" | "roles";

export default function RegisterPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startVerification(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCode("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Please enter a valid phone number.");
        return;
      }
      setDevCode(data.devCode ?? null);
      setPhase("code");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(errorMessage(data.error));
        return;
      }
      // Preload any roles the account already has so re-registering never
      // silently drops existing roles when the selection is saved.
      const me = await fetch("/api/auth/me").then((r) => r.json());
      const existing: Role[] = me?.user?.roles ?? [];
      setSelected(existing);
      setPhase("roles");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRole(role: Role) {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function submitRoles(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/roles", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roles: selected }),
      });
      if (!res.ok) {
        setError("Could not save your roles. Please try again.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setError(null);
    setCode("");
    setDevCode(null);
    setPhase("phone");
  }

  return (
    <main>
      <h1>Join the marketplace</h1>
      {error && <p role="alert" style={{ color: "#ff8a80" }}>{error}</p>}

      {phase === "phone" && (
        <form onSubmit={startVerification}>
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={busy} style={buttonStyle}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {phase === "code" && (
        <form onSubmit={submitCode}>
          <p>We sent a 6-digit code to {phone}.</p>
          {devCode && (
            <p style={{ color: "#9e9e9e" }}>
              Dev mode — your code is <strong>{devCode}</strong>
            </p>
          )}
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={busy} style={buttonStyle}>
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={startOver}
            disabled={busy}
            style={linkButtonStyle}
          >
            Use a different number / request a new code
          </button>
        </form>
      )}

      {phase === "roles" && (
        <form onSubmit={submitRoles}>
          <p>How will you use the marketplace? You can pick more than one.</p>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="sr-only">Roles</legend>
            {ROLES.map((role) => (
              <label key={role} style={roleRowStyle}>
                <input
                  type="checkbox"
                  checked={selected.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={busy} style={buttonStyle}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      )}
    </main>
  );
}

function errorMessage(reason: string | undefined): string {
  switch (reason) {
    case "invalid_code":
      return "That code is incorrect.";
    case "expired":
      return "That code has expired. Request a new one.";
    case "too_many_attempts":
      return "Too many attempts. Request a new code.";
    case "no_pending":
      return "No code was requested. Start again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.6rem",
  margin: "0.4rem 0 1rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const linkButtonStyle: React.CSSProperties = {
  display: "block",
  marginTop: "0.9rem",
  padding: 0,
  background: "none",
  border: "none",
  color: "#2e7d32",
  cursor: "pointer",
  fontSize: "0.9rem",
  textDecoration: "underline",
};

const roleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.4rem 0",
};
