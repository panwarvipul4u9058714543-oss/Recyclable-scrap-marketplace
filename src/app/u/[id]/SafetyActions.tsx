"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flag, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <section aria-label="Safety">
      <h2 className="mb-2 font-serif text-xl tracking-tight">Safety</h2>
      <Card className="p-5">
        {status && (
          <p role="status" className="mb-3 text-sm text-ink">
            {status}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={toggleBlock}
            disabled={busy}
            variant="primary"
            size="sm"
            className="bg-signal-err hover:bg-signal-err/90"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {blocked ? "Unblock user" : "Block user"}
          </Button>
          <Button
            type="button"
            onClick={() => setReporting((v) => !v)}
            disabled={busy}
            variant="secondary"
            size="sm"
          >
            <Flag className="h-3.5 w-3.5" />
            {reporting ? "Cancel report" : "Report user"}
          </Button>
        </div>

        {reporting && (
          <form onSubmit={submitReport} className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="report-reason">Reason</Label>
              <Select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
              </Select>
            </div>
            <div>
              <Label htmlFor="report-details">Details (optional)</Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
              />
            </div>
            {status && status !== "Report submitted. An operator will review it." && (
              <InlineNote tone="err">{status}</InlineNote>
            )}
            <div>
              <Button type="submit" disabled={busy} variant="primary" size="sm">
                {busy ? "Sending…" : "Submit report"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
