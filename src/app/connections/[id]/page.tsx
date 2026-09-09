import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ConnectionError,
  getConnectionDetail,
  listMessages,
} from "@/lib/connections/connections";
import { ConnectionChat } from "./ConnectionChat";

type Params = { params: { id: string } };

export default async function ConnectionDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  let detail;
  let messages;
  try {
    detail = await getConnectionDetail(user.id, params.id);
    messages = await listMessages(user.id, params.id);
  } catch (err) {
    if (err instanceof ConnectionError && err.code === "not_found") {
      notFound();
    }
    throw err;
  }

  const viewerIsSeller = detail.sellerId === user.id;

  return (
    <main>
      <p>
        <Link href="/connections">← Back to your connections</Link>
      </p>
      <h1 style={{ marginBottom: "0.2rem" }}>{detail.listingTitle}</h1>
      <p style={{ color: "#9e9e9e", marginTop: 0 }}>
        Locality: {detail.locality}{" "}
        {viewerIsSeller
          ? "· You are the seller."
          : "· You are the selected buyer."}
      </p>

      <ConnectionChat
        connection={{
          id: detail.id,
          status: detail.status,
          youRevealed: detail.youRevealed,
          counterpartyRevealed: detail.counterpartyRevealed,
          contactRevealed: detail.contactRevealed,
          sellerPhone: detail.sellerPhone,
          collectorPhone: detail.collectorPhone,
          pickup: detail.pickup,
          expiresAt: detail.expiresAt.toISOString(),
          viewerIsSeller,
          actualQuantity: detail.actualQuantity,
          finalPrice: detail.finalPrice,
          failureReason: detail.failureReason,
        }}
        initialMessages={messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        }))}
        currentUserId={user.id}
      />
    </main>
  );
}
