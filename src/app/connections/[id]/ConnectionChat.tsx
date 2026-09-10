"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldOff,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface ConnectionSummary {
  id: string;
  status: "RESERVED" | "CANCELLED" | "EXPIRED" | "COMPLETED" | "FAILED";
  youRevealed: boolean;
  counterpartyRevealed: boolean;
  contactRevealed: boolean;
  sellerPhone: string;
  collectorPhone: string;
  pickup: { latitude: number; longitude: number } | null;
  expiresAt: string;
  viewerIsSeller: boolean;
  actualQuantity: number | null;
  finalPrice: number | null;
  failureReason: string | null;
}

interface Props {
  connection: ConnectionSummary;
  initialMessages: Message[];
  currentUserId: string;
}

export function ConnectionChat({
  connection,
  initialMessages,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "reveal" | "cancel" | "complete" | "fail" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [outcomeMode, setOutcomeMode] = useState<"none" | "complete" | "fail">(
    "none",
  );
  const [actualQuantity, setActualQuantity] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (draft.trim() === "" || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connection.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!res.ok) {
        setError("Couldn't send that message. Please try again.");
        return;
      }
      const { message } = (await res.json()) as { message: Message };
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function reveal() {
    setBusyAction("reveal");
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connection.id}/reveal`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Couldn't reveal your contact. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  function parseOptionalPositive(
    raw: string,
    label: string,
  ): { value?: number; error?: string } {
    if (raw.trim() === "") return {};
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return { error: `${label} must be a positive number.` };
    }
    return { value: n };
  }

  async function submitOutcome(kind: "complete" | "fail", e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const qty = parseOptionalPositive(actualQuantity, "Actual quantity");
    const price = parseOptionalPositive(finalPrice, "Final price");
    if (qty.error || price.error) {
      setError(qty.error ?? price.error!);
      return;
    }

    const payload: Record<string, unknown> = {};
    if (qty.value !== undefined) payload.actualQuantity = qty.value;
    if (price.value !== undefined) payload.finalPrice = price.value;
    if (kind === "fail" && failureReason.trim() !== "") {
      payload.failureReason = failureReason.trim();
    }

    setBusyAction(kind);
    try {
      const res = await fetch(`/api/connections/${connection.id}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(
          kind === "complete"
            ? "Couldn't mark this completed. Please check the fields and try again."
            : "Couldn't mark this failed. Please check the fields and try again.",
        );
        return;
      }
      setOutcomeMode("none");
      setActualQuantity("");
      setFinalPrice("");
      setFailureReason("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function cancel() {
    if (
      !confirm(
        "Cancel this reservation? The listing will become available to other buyers again.",
      )
    )
      return;
    setBusyAction("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connection.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Couldn't cancel this reservation. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  const isTerminal = connection.status !== "RESERVED";
  const otherPhone = connection.viewerIsSeller
    ? connection.collectorPhone
    : connection.sellerPhone;
  const otherRole = connection.viewerIsSeller ? "buyer" : "seller";

  return (
    <div className="space-y-5">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}

      <section aria-label="Contact" role="region">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-ash">
            {connection.contactRevealed ? (
              <>
                <Phone className="h-3.5 w-3.5" /> Contact revealed
              </>
            ) : (
              <>
                <ShieldOff className="h-3.5 w-3.5" /> Contact hidden
              </>
            )}
          </div>
          {connection.contactRevealed ? (
            <>
              <p className="text-[15px] text-ink">
                <strong className="font-medium">
                  {otherRole === "buyer" ? "Buyer" : "Seller"}:
                </strong>{" "}
                <a
                  href={`tel:${otherPhone}`}
                  className="font-mono text-rust underline-offset-4 hover:underline"
                >
                  {otherPhone}
                </a>
              </p>
              {!connection.viewerIsSeller && connection.pickup ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-ash">
                  <MapPin className="h-3.5 w-3.5" />
                  Pickup coordinates:{" "}
                  <span className="font-mono text-ink">
                    {connection.pickup.latitude.toFixed(6)},{" "}
                    {connection.pickup.longitude.toFixed(6)}
                  </span>
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-ink">
                Exact contact details are hidden until both of you reveal.
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-ash">You:</span>
                  {connection.youRevealed ? (
                    <strong className="font-medium text-moss">revealed</strong>
                  ) : (
                    <em className="text-ash">not yet</em>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-ash">Other {otherRole}:</span>
                  {connection.counterpartyRevealed ? (
                    <strong className="font-medium text-moss">revealed</strong>
                  ) : (
                    <em className="text-ash">not yet</em>
                  )}
                </li>
              </ul>
              {!connection.youRevealed && !isTerminal && (
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={reveal}
                    disabled={busyAction === "reveal"}
                    variant="primary"
                    size="sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {busyAction === "reveal"
                      ? "Revealing…"
                      : "Reveal my contact"}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      <section aria-label="Reservation" role="region">
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="flex items-center gap-2 text-sm">
              <strong className="font-medium text-ink">Status:</strong>{" "}
              <span className="font-mono text-ink">{connection.status}</span>
            </p>
            {!isTerminal && (
              <p className="flex items-center gap-1 text-xs text-ash">
                <Clock className="h-3 w-3" />
                Reservation expires{" "}
                {new Date(connection.expiresAt).toLocaleString()}.
              </p>
            )}
          </div>

          {!isTerminal && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    setOutcomeMode(
                      outcomeMode === "complete" ? "none" : "complete",
                    )
                  }
                  variant="moss"
                  size="sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark as completed
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    setOutcomeMode(outcomeMode === "fail" ? "none" : "fail")
                  }
                  variant="secondary"
                  size="sm"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Mark as failed
                </Button>
                <Button
                  type="button"
                  onClick={cancel}
                  disabled={busyAction === "cancel"}
                  variant="ghost"
                  size="sm"
                >
                  {busyAction === "cancel"
                    ? "Cancelling…"
                    : "Cancel reservation"}
                </Button>
              </div>

              {outcomeMode === "complete" && (
                <form
                  onSubmit={(e) => submitOutcome("complete", e)}
                  aria-label="Complete pickup"
                  className="mt-4 rounded-md border border-moss/30 bg-moss-soft/60 p-4"
                >
                  <h3 className="mb-3 flex items-center gap-2 font-serif text-lg tracking-tight text-moss">
                    <Sparkles className="h-4 w-4" /> Pickup complete
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="actualQuantity">
                        Actual quantity (optional)
                      </Label>
                      <Input
                        id="actualQuantity"
                        type="number"
                        min="0"
                        step="any"
                        value={actualQuantity}
                        onChange={(e) => setActualQuantity(e.target.value)}
                        placeholder="e.g. 7.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalPrice">Final price (optional)</Label>
                      <Input
                        id="finalPrice"
                        type="number"
                        min="0"
                        step="any"
                        value={finalPrice}
                        onChange={(e) => setFinalPrice(e.target.value)}
                        placeholder="e.g. 375"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      type="submit"
                      disabled={busyAction === "complete"}
                      variant="primary"
                      size="sm"
                    >
                      {busyAction === "complete"
                        ? "Saving…"
                        : "Confirm completed"}
                    </Button>
                  </div>
                </form>
              )}

              {outcomeMode === "fail" && (
                <form
                  onSubmit={(e) => submitOutcome("fail", e)}
                  aria-label="Report failure"
                  className="mt-4 rounded-md border border-signal-warn/30 bg-signal-warn/5 p-4"
                >
                  <h3 className="mb-3 flex items-center gap-2 font-serif text-lg tracking-tight text-signal-warn">
                    <XCircle className="h-4 w-4" /> Pickup failed
                  </h3>
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor="failureReason">
                        What went wrong? (optional, max 500 chars)
                      </Label>
                      <Textarea
                        id="failureReason"
                        maxLength={500}
                        value={failureReason}
                        onChange={(e) => setFailureReason(e.target.value)}
                        placeholder="e.g. Access blocked at the gate."
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="failQuantity">
                          Actual quantity picked up (optional)
                        </Label>
                        <Input
                          id="failQuantity"
                          type="number"
                          min="0"
                          step="any"
                          value={actualQuantity}
                          onChange={(e) => setActualQuantity(e.target.value)}
                          placeholder="e.g. 1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="failPrice">
                          Final price agreed (optional)
                        </Label>
                        <Input
                          id="failPrice"
                          type="number"
                          min="0"
                          step="any"
                          value={finalPrice}
                          onChange={(e) => setFinalPrice(e.target.value)}
                          placeholder="e.g. 50"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      type="submit"
                      disabled={busyAction === "fail"}
                      variant="primary"
                      size="sm"
                    >
                      {busyAction === "fail" ? "Saving…" : "Confirm failed"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          {isTerminal && (
            <div className="mt-3 space-y-1 text-sm text-ash">
              {connection.actualQuantity !== null && (
                <p>
                  Actual quantity:{" "}
                  <strong className="font-mono text-ink">
                    {connection.actualQuantity}
                  </strong>
                </p>
              )}
              {connection.finalPrice !== null && (
                <p>
                  Final price:{" "}
                  <strong className="font-mono text-ink">
                    {connection.finalPrice}
                  </strong>
                </p>
              )}
              {connection.failureReason && <p>Reason: {connection.failureReason}</p>}
            </div>
          )}
        </Card>
      </section>

      <section aria-label="Chat" role="region">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-xl tracking-tight">
            <MessageCircle className="h-4 w-4 text-ash" /> Chat
          </h2>
          <ul
            ref={listRef}
            className="mb-3 flex max-h-80 flex-col gap-2 overflow-y-auto rounded-md border border-dune/60 bg-sand/40 p-3"
          >
            {messages.length === 0 ? (
              <li className="text-sm text-ash">No messages yet.</li>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === currentUserId;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-[15px] leading-snug",
                      mine
                        ? "self-end bg-rust text-paper"
                        : "self-start border border-dune bg-paper text-ink",
                    )}
                  >
                    {m.body}
                  </li>
                );
              })
            )}
          </ul>
          {isTerminal ? (
            <p className="text-sm text-ash">
              This connection is {connection.status.toLowerCase()}; no new
              messages can be sent.
            </p>
          ) : (
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                aria-label="Message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message"
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={posting || draft.trim() === ""}
                variant="primary"
              >
                <Send className="h-4 w-4" />
                {posting ? "Sending…" : "Send"}
              </Button>
            </form>
          )}
        </Card>
      </section>
    </div>
  );
}
