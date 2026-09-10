"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, PhoneCall, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNote } from "@/components/ui/inline-note";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

type Phase = "phone" | "code" | "roles";

// Role sub-copy — a professional would explain what happens next for each
// choice. Generic labels alone read like a signup wizard from any app.
const ROLE_HINTS: Record<Role, string> = {
  HOUSEHOLD: "Post occasional scrap from your home. Set your own kilo rate.",
  BUSINESS: "Turn recurring waste (cafe, shop, workshop) into a scheduled pickup.",
  COLLECTOR: "Walk or ride a route. See what's up nearby, plan a run.",
  DEALER: "Aggregate from many collectors. Publish what you'll buy in bulk.",
  RECYCLER: "Source sorted material from dealers close to your unit.",
};

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

  const step = phase === "phone" ? 1 : phase === "code" ? 2 : 3;

  return (
    <main className="container-page py-10 sm:py-16">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
        <section className="max-w-xl animate-fade-in">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ash">
            <span className="inline-block h-px w-8 bg-rust" />
            Step {step} of 3
          </p>
          <h1 className="font-serif text-hero tracking-tight text-ink">
            Join the marketplace
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ash">
            {phase === "phone" &&
              "We identify accounts by phone so kabadiwalas and households can reach each other after a match. Nothing else is required to sign up."}
            {phase === "code" &&
              "Enter the six-digit code we just sent. Codes expire in a few minutes."}
            {phase === "roles" &&
              "Pick every role you actually work in — you'll only see the workflows that match. You can change these later on your profile."}
          </p>

          {error ? (
            <InlineNote tone="err" className="mt-6">
              {error}
            </InlineNote>
          ) : null}

          <Card className="mt-6 p-6 sm:p-8">
            {phase === "phone" && (
              <form onSubmit={startVerification} className="grid gap-4">
                <div>
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <FieldHint>
                    Include the country code. We never publish this — only your
                    matched counterparty sees it once you both accept a connection.
                  </FieldHint>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" disabled={busy} variant="primary" size="lg" className="group">
                    {busy ? "Sending…" : "Send code"}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Button>
                  <span className="text-xs text-ash">
                    <PhoneCall className="mr-1 inline h-3 w-3" />
                    SMS to the number above
                  </span>
                </div>
              </form>
            )}

            {phase === "code" && (
              <form onSubmit={submitCode} className="grid gap-4">
                <p className="text-sm text-ash">
                  We sent a 6-digit code to{" "}
                  <span className="font-mono text-ink">{phone}</span>.
                </p>
                {devCode ? (
                  <InlineNote tone="warn">
                    Dev mode — your code is <strong>{devCode}</strong>
                  </InlineNote>
                ) : null}
                <div>
                  <Label htmlFor="code">Verification code</Label>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono text-lg tracking-[0.4em]"
                    required
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" disabled={busy} variant="primary" size="lg">
                    {busy ? "Verifying…" : "Verify"}
                  </Button>
                  <Button
                    type="button"
                    onClick={startOver}
                    disabled={busy}
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Use a different number / request a new code
                  </Button>
                </div>
              </form>
            )}

            {phase === "roles" && (
              <form onSubmit={submitRoles} className="grid gap-5">
                <p className="text-sm text-ash">
                  How will you use the marketplace? You can pick more than one.
                </p>
                <fieldset className="grid gap-2">
                  <legend className="sr-only">Roles</legend>
                  {ROLES.map((role) => {
                    const checked = selected.includes(role);
                    return (
                      <label
                        key={role}
                        className={
                          "focus-within:ring-2 focus-within:ring-rust/30 " +
                          "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition " +
                          (checked
                            ? "border-rust/60 bg-rust-soft"
                            : "border-dune bg-paper hover:border-ink/30 hover:bg-sand/50")
                        }
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleRole(role)}
                        />
                        <span className="flex-1">
                          <span className="block font-medium text-ink">
                            {ROLE_LABELS[role]}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-ash">
                            {ROLE_HINTS[role]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
                <div className="pt-1">
                  <Button type="submit" disabled={busy} variant="primary" size="lg" className="group">
                    {busy ? "Saving…" : "Continue"}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </section>

        <aside className="animate-slide-in md:sticky md:top-24">
          <Card className="overflow-hidden bg-sand/40 p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-ash">
              <ShieldCheck className="h-3.5 w-3.5" /> What we ask, and why
            </div>
            <ul className="space-y-4 text-sm">
              <li>
                <p className="font-medium text-ink">Just your phone number.</p>
                <p className="mt-0.5 text-ash">
                  No email, no address, no password. One SMS gets you in.
                </p>
              </li>
              <li>
                <p className="font-medium text-ink">Roles you actually work.</p>
                <p className="mt-0.5 text-ash">
                  Households, kabadiwalas, dealers, businesses, recyclers —
                  pick the ones that fit today. You can change them later.
                </p>
              </li>
              <li>
                <p className="font-medium text-ink">Contact stays private.</p>
                <p className="mt-0.5 text-ash">
                  Your number is never on your public profile. It&apos;s shared
                  only after both sides accept a connection.
                </p>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
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
