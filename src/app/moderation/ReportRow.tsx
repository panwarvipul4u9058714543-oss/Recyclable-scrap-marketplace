"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertOctagon, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineNote } from "@/components/ui/inline-note";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [busy, setBusy] = useState<"" | "resolve" | "dismiss" | "suspend">("");
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
    <article aria-label="Open report" className="rounded-lg border border-dune/70 bg-paper p-5 shadow-soft">
        <p className="flex items-center gap-2 text-[15px] text-ink">
          <strong className="font-medium">{report.reason}</strong>
          <span className="text-ash">·</span>
          <span>against {report.targetLabel}</span>
        </p>
        <p className="mt-1 text-xs text-ash">
          Reported by{" "}
          <span className="font-mono text-ink">{report.reporterPhone}</span> on{" "}
          {new Date(report.createdAt).toLocaleString()}
        </p>
        {report.details && (
          <p className="mt-2 text-sm italic text-ink/85">
            &ldquo;{report.details}&rdquo;
          </p>
        )}
        {error && <InlineNote tone="err" className="mt-3">{error}</InlineNote>}

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor={`note-${report.id}`}>Review note (optional)</Label>
            <Input
              id={`note-${report.id}`}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => decide("RESOLVED")}
              disabled={busy !== ""}
              variant="moss"
              size="sm"
            >
              <Check className="h-3.5 w-3.5" />
              {busy === "resolve" ? "Saving…" : "Mark resolved"}
            </Button>
            <Button
              type="button"
              onClick={() => decide("DISMISSED")}
              disabled={busy !== ""}
              variant="secondary"
              size="sm"
            >
              <X className="h-3.5 w-3.5" />
              {busy === "dismiss" ? "Saving…" : "Dismiss"}
            </Button>
          </div>
        </div>

        {report.targetUserId && !report.targetUserSuspended && (
          <div className="mt-6 space-y-3 rounded-md border border-signal-err/30 bg-signal-err/5 p-4">
            <Label htmlFor={`susp-${report.id}`}>
              Suspend the reported account (reason)
            </Label>
            <Input
              id={`susp-${report.id}`}
              type="text"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Repeated no-shows across three connections"
            />
            <Button
              type="button"
              onClick={suspend}
              disabled={busy !== ""}
              variant="primary"
              size="sm"
              className="bg-signal-err hover:bg-signal-err/90"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              {busy === "suspend" ? "Suspending…" : "Suspend account"}
            </Button>
          </div>
        )}
        {report.targetUserId && report.targetUserSuspended && (
          <p className="mt-4 text-xs text-ash">
            That account is already suspended.
          </p>
        )}
    </article>
  );
}
