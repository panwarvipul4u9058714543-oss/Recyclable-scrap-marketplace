"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ListingStatus } from "@/lib/listings/listings";

type Action = "pause" | "resume" | "close";

export function ListingActions({
  id,
  status,
}: {
  id: string;
  status: ListingStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (action === "close" && !confirm("Close this listing permanently?")) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setError("Could not update the listing. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "CLOSED") {
    return <span className="text-sm text-ash">Closed</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {status === "ACTIVE" && (
        <Button
          type="button"
          onClick={() => run("pause")}
          disabled={busy}
          variant="secondary"
          size="sm"
        >
          <PauseCircle className="h-3.5 w-3.5" />
          Pause
        </Button>
      )}
      {status === "PAUSED" && (
        <Button
          type="button"
          onClick={() => run("resume")}
          disabled={busy}
          variant="secondary"
          size="sm"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Resume
        </Button>
      )}
      <Button
        type="button"
        onClick={() => run("close")}
        disabled={busy}
        variant="ghost"
        size="sm"
        className="text-signal-err hover:bg-signal-err/10 hover:text-signal-err"
      >
        <XCircle className="h-3.5 w-3.5" />
        Close
      </Button>
      {error && (
        <span role="alert" className="text-xs text-signal-err">
          {error}
        </span>
      )}
    </div>
  );
}
