"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface ResponseSummary {
  id: string;
  status:
    | "PENDING"
    | "WITHDRAWN"
    | "SELECTED"
    | "CANCELLED"
    | "COMPLETED"
    | "FAILED";
  youRevealed: boolean;
  counterpartyRevealed: boolean;
  contactRevealed: boolean;
  buyerPhone: string;
  supplierPhone: string;
  expiresAt: string | null;
  viewerIsBuyer: boolean;
  actualQuantity: number | null;
  finalPrice: number | null;
  failureReason: string | null;
}

interface Props {
  response: ResponseSummary;
  initialMessages: Message[];
  currentUserId: string;
}

/**
 * Interactive shell for a SELECTED bulk response: chat + reveal + outcome
 * form. Mirrors the household connection chat, scoped to a bulk response.
 */
export function BulkResponseChat({
  response,
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
      const res = await fetch(
        `/api/bulk-responses/${response.id}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: draft }),
        },
      );
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
      const res = await fetch(`/api/bulk-responses/${response.id}/reveal`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Couldn't reveal your contact. Please try again.");
        return;
      }
      router.refresh();
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
      const res = await fetch(
        `/api/bulk-responses/${response.id}/${kind}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        setError(
          kind === "complete"
            ? "Couldn't mark this completed."
            : "Couldn't mark this failed.",
        );
        return;
      }
      setOutcomeMode("none");
      setActualQuantity("");
      setFinalPrice("");
      setFailureReason("");
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function cancel() {
    if (!confirm("Cancel this bulk match? Both parties will be notified.")) {
      return;
    }
    setBusyAction("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/bulk-responses/${response.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Couldn't cancel. Please try again.");
        return;
      }
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  const isTerminal = response.status !== "SELECTED";
  const otherPhone = response.viewerIsBuyer
    ? response.supplierPhone
    : response.buyerPhone;
  const otherRole = response.viewerIsBuyer ? "supplier" : "buyer";

  return (
    <div>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}

      <section aria-label="Contact" style={boxStyle}>
        {response.contactRevealed ? (
          <p style={{ margin: 0 }}>
            <strong>{otherRole === "supplier" ? "Supplier" : "Buyer"}:</strong>{" "}
            <a href={`tel:${otherPhone}`}>{otherPhone}</a>
          </p>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Exact contact details are hidden until both parties reveal.
            </p>
            <ul style={{ margin: "0.4rem 0", paddingLeft: "1.2rem" }}>
              <li>
                You:{" "}
                {response.youRevealed ? (
                  <strong>revealed</strong>
                ) : (
                  <em>not yet</em>
                )}
              </li>
              <li>
                Other {otherRole}:{" "}
                {response.counterpartyRevealed ? (
                  <strong>revealed</strong>
                ) : (
                  <em>not yet</em>
                )}
              </li>
            </ul>
            {!response.youRevealed && !isTerminal && (
              <button
                type="button"
                onClick={reveal}
                disabled={busyAction === "reveal"}
                style={primaryButtonStyle}
              >
                {busyAction === "reveal" ? "Revealing…" : "Reveal my contact"}
              </button>
            )}
          </>
        )}
      </section>

      <section aria-label="Status" style={boxStyle}>
        <p style={{ margin: 0 }}>
          <strong>Status:</strong> {response.status}
        </p>
        {!isTerminal && (
          <>
            {response.expiresAt && (
              <p style={{ margin: "0.4rem 0 0", color: "#9e9e9e" }}>
                Match expires{" "}
                {new Date(response.expiresAt).toLocaleString()}.
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginTop: "0.6rem",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOutcomeMode(outcomeMode === "complete" ? "none" : "complete")
                }
                style={primaryButtonStyle}
              >
                Mark as completed
              </button>
              <button
                type="button"
                onClick={() =>
                  setOutcomeMode(outcomeMode === "fail" ? "none" : "fail")
                }
                style={secondaryButtonStyle}
              >
                Mark as failed
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busyAction === "cancel"}
                style={secondaryButtonStyle}
              >
                {busyAction === "cancel" ? "Cancelling…" : "Cancel match"}
              </button>
            </div>
            {outcomeMode !== "none" && (
              <form
                onSubmit={(e) => submitOutcome(outcomeMode, e)}
                style={outcomeFormStyle}
                aria-label={
                  outcomeMode === "complete"
                    ? "Complete match"
                    : "Report failure"
                }
              >
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>
                  {outcomeMode === "complete" ? "Pickup complete" : "Pickup failed"}
                </h3>
                {outcomeMode === "fail" && (
                  <>
                    <label htmlFor="failureReason">
                      What went wrong? (optional)
                    </label>
                    <textarea
                      id="failureReason"
                      maxLength={500}
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      style={{ ...inputStyle, minHeight: 80, width: "100%" }}
                    />
                  </>
                )}
                <label htmlFor="actualQuantity">
                  Actual quantity (optional)
                </label>
                <input
                  id="actualQuantity"
                  type="number"
                  min="0"
                  step="any"
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(e.target.value)}
                  style={inputStyle}
                />
                <label htmlFor="finalPrice">Final price (optional)</label>
                <input
                  id="finalPrice"
                  type="number"
                  min="0"
                  step="any"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={busyAction === outcomeMode}
                  style={primaryButtonStyle}
                >
                  {busyAction === outcomeMode
                    ? "Saving…"
                    : outcomeMode === "complete"
                      ? "Confirm completed"
                      : "Confirm failed"}
                </button>
              </form>
            )}
          </>
        )}
        {isTerminal && (
          <div style={{ marginTop: "0.4rem", color: "#9e9e9e" }}>
            {response.actualQuantity !== null && (
              <p style={{ margin: "0.2rem 0" }}>
                Actual quantity: <strong>{response.actualQuantity}</strong>
              </p>
            )}
            {response.finalPrice !== null && (
              <p style={{ margin: "0.2rem 0" }}>
                Final price: <strong>{response.finalPrice}</strong>
              </p>
            )}
            {response.failureReason && (
              <p style={{ margin: "0.2rem 0" }}>
                Reason: {response.failureReason}
              </p>
            )}
          </div>
        )}
      </section>

      <section aria-label="Chat" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>Chat</h2>
        <ul ref={listRef} style={chatListStyle}>
          {messages.length === 0 ? (
            <li style={{ color: "#9e9e9e" }}>No messages yet.</li>
          ) : (
            messages.map((m) => (
              <li
                key={m.id}
                style={{
                  ...bubbleStyle,
                  alignSelf:
                    m.senderId === currentUserId ? "flex-end" : "flex-start",
                  background:
                    m.senderId === currentUserId ? "#2e7d32" : "#333",
                }}
              >
                {m.body}
              </li>
            ))
          )}
        </ul>
        {isTerminal ? (
          <p style={{ color: "#9e9e9e" }}>
            This match is {response.status.toLowerCase()}; no new messages
            can be sent.
          </p>
        ) : (
          <form
            onSubmit={sendMessage}
            style={{ display: "flex", gap: "0.5rem" }}
          >
            <input
              aria-label="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="submit"
              disabled={posting || draft.trim() === ""}
              style={primaryButtonStyle}
            >
              {posting ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.8rem 1rem",
  margin: "1rem 0",
};

const chatListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  listStyle: "none",
  gap: "0.4rem",
  maxHeight: 300,
  overflowY: "auto",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.6rem",
  margin: "0 0 0.6rem",
};

const bubbleStyle: React.CSSProperties = {
  color: "#fff",
  padding: "0.4rem 0.7rem",
  borderRadius: 12,
  maxWidth: "80%",
};

const inputStyle: React.CSSProperties = {
  padding: "0.55rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.95rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

const outcomeFormStyle: React.CSSProperties = {
  marginTop: "0.8rem",
  padding: "0.6rem 0.8rem",
  border: "1px solid #333",
  borderRadius: 8,
  background: "rgba(255,255,255,0.02)",
};
