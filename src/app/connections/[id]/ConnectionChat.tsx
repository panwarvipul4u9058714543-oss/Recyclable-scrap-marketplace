"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface ConnectionSummary {
  id: string;
  status: "RESERVED" | "CANCELLED" | "EXPIRED";
  youRevealed: boolean;
  counterpartyRevealed: boolean;
  contactRevealed: boolean;
  sellerPhone: string;
  collectorPhone: string;
  pickup: { latitude: number; longitude: number } | null;
  expiresAt: string;
  viewerIsSeller: boolean;
}

interface Props {
  connection: ConnectionSummary;
  initialMessages: Message[];
  currentUserId: string;
}

/**
 * Interactive shell for a connection detail: chat thread with post form, a
 * reveal-my-contact button, and a cancel-reservation button. Server-rendered
 * bootstrapping is refreshed via router.refresh() after each mutating call
 * so the initial snapshot stays authoritative.
 */
export function ConnectionChat({
  connection,
  initialMessages,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyAction, setBusyAction] = useState<"reveal" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    <div>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}

      <section aria-label="Contact" style={contactBoxStyle}>
        {connection.contactRevealed ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>{otherRole === "buyer" ? "Buyer" : "Seller"}:</strong>{" "}
              <a href={`tel:${otherPhone}`}>{otherPhone}</a>
            </p>
            {connection.viewerIsSeller ? null : connection.pickup ? (
              <p style={{ margin: "0.4rem 0 0", color: "#9e9e9e" }}>
                Pickup coordinates: {connection.pickup.latitude.toFixed(6)},{" "}
                {connection.pickup.longitude.toFixed(6)}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Exact contact details are hidden until both of you reveal.
            </p>
            <ul style={{ margin: "0.4rem 0", paddingLeft: "1.2rem" }}>
              <li>
                You:{" "}
                {connection.youRevealed ? (
                  <strong>revealed</strong>
                ) : (
                  <em>not yet</em>
                )}
              </li>
              <li>
                Other {otherRole}:{" "}
                {connection.counterpartyRevealed ? (
                  <strong>revealed</strong>
                ) : (
                  <em>not yet</em>
                )}
              </li>
            </ul>
            {!connection.youRevealed && !isTerminal && (
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

      <section aria-label="Reservation" style={reservationBoxStyle}>
        <p style={{ margin: 0 }}>
          <strong>Status:</strong> {connection.status}
        </p>
        {!isTerminal && (
          <>
            <p style={{ margin: "0.4rem 0 0", color: "#9e9e9e" }}>
              Reservation expires{" "}
              {new Date(connection.expiresAt).toLocaleString()}.
            </p>
            <button
              type="button"
              onClick={cancel}
              disabled={busyAction === "cancel"}
              style={secondaryButtonStyle}
            >
              {busyAction === "cancel" ? "Cancelling…" : "Cancel reservation"}
            </button>
          </>
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
            This connection is {connection.status.toLowerCase()}; no new
            messages can be sent.
          </p>
        ) : (
          <form onSubmit={sendMessage} style={{ display: "flex", gap: "0.5rem" }}>
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

const contactBoxStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.8rem 1rem",
  margin: "1rem 0",
};

const reservationBoxStyle: React.CSSProperties = {
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
  marginTop: "0.6rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
