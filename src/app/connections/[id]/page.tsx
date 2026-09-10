import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ConnectionError,
  getConnectionDetail,
  listMessages,
} from "@/lib/connections/connections";
import { getRatingByRater } from "@/lib/ratings/ratings";
import { ConnectionChat } from "./ConnectionChat";
import { RatingForm } from "./RatingForm";

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
  const counterpartyId = viewerIsSeller
    ? detail.collectorId
    : detail.sellerId;
  const terminal =
    detail.status === "COMPLETED" || detail.status === "FAILED";
  const existingRating = terminal
    ? await getRatingByRater(user.id, detail.id)
    : null;

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/connections"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to your connections
      </Link>
      <PageHeader
        eyebrow={viewerIsSeller ? "Reservation · seller" : "Reservation · buyer"}
        title={detail.listingTitle}
        description={
          <>
            {detail.locality}
            {" · "}
            <Link
              href={`/u/${counterpartyId}`}
              className="text-rust underline-offset-4 hover:underline"
            >
              View their profile
            </Link>
          </>
        }
      />

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

      {terminal && (
        <RatingForm
          connectionId={detail.id}
          counterpartyLabel={viewerIsSeller ? "the collector" : "the seller"}
          existingScore={existingRating?.score ?? null}
          existingComment={existingRating?.comment ?? null}
        />
      )}
    </main>
  );
}
