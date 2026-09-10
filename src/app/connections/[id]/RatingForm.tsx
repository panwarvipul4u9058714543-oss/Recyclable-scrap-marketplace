"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <section aria-label="Your rating" className="mt-6">
        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 font-serif text-xl tracking-tight">
            <Star className="h-4 w-4 fill-rust text-rust" /> Your rating
          </h2>
          <p className="text-sm text-ink">
            You rated {counterpartyLabel}{" "}
            <strong className="font-mono font-medium">{existingScore} / 5</strong>.
          </p>
          {existingComment && (
            <p className="mt-2 text-sm italic text-ash">
              &ldquo;{existingComment}&rdquo;
            </p>
          )}
        </Card>
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
    <section aria-label="Rate the counterparty" className="mt-6">
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-xl tracking-tight">
          <Star className="h-4 w-4 text-ash" /> Rate {counterpartyLabel}
        </h2>
        <form onSubmit={onSubmit} className="grid gap-4">
          {error ? <InlineNote tone="err">{error}</InlineNote> : null}
          <div className="max-w-xs">
            <Label htmlFor="rating-score">Score</Label>
            <Select
              id="rating-score"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} — {["Poor", "Fair", "OK", "Good", "Excellent"][n - 1]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rating-comment">Comment (optional)</Label>
            <Textarea
              id="rating-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Button type="submit" disabled={busy} variant="primary">
              {busy ? "Saving…" : "Submit rating"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
