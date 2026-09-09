import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  BulkResponseError,
  getBulkResponseDetail,
  listBulkMessages,
} from "@/lib/bulk/responses";
import {
  MATERIAL_LABELS,
  QUANTITY_UNIT_LABELS,
  type MaterialCategory,
  type QuantityUnit,
} from "@/lib/materials";
import { BulkResponseChat } from "./BulkResponseChat";

export default async function BulkResponseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  let detail;
  let messages;
  try {
    detail = await getBulkResponseDetail(user.id, params.id);
    messages = await listBulkMessages(user.id, params.id);
  } catch (err) {
    if (err instanceof BulkResponseError && err.code === "not_found") {
      notFound();
    }
    throw err;
  }

  const viewerIsBuyer = detail.buyerId === user.id;
  const counterpartyId = viewerIsBuyer ? detail.supplierId : detail.buyerId;

  return (
    <main>
      <p>
        <Link href={viewerIsBuyer ? `/bulk/${detail.requirementId}` : "/bulk"}>
          ← Back
        </Link>
      </p>
      <h1 style={{ marginBottom: "0.2rem" }}>
        Bulk response — {MATERIAL_LABELS[detail.requirementMaterial as MaterialCategory]}
      </h1>
      <p style={{ color: "#9e9e9e", marginTop: 0 }}>
        Buyer wants at least {detail.requirementMinQuantity}{" "}
        {QUANTITY_UNIT_LABELS[detail.requirementMinQuantityUnit as QuantityUnit]} in{" "}
        {detail.requirementRegion} ·{" "}
        {viewerIsBuyer
          ? "You are the buyer."
          : "You are the responding supplier."}{" "}
        · <Link href={`/u/${counterpartyId}`}>View their profile</Link>
      </p>
      <p style={{ fontSize: "0.9rem" }}>
        Supplier offers{" "}
        <strong>
          {detail.offeredQuantity}{" "}
          {QUANTITY_UNIT_LABELS[detail.offeredQuantityUnit]}
        </strong>
        {detail.notes && <> — {detail.notes}</>}
      </p>

      <BulkResponseChat
        response={{
          id: detail.id,
          status: detail.status,
          youRevealed: detail.youRevealed,
          counterpartyRevealed: detail.counterpartyRevealed,
          contactRevealed: detail.contactRevealed,
          buyerPhone: detail.buyerPhone,
          supplierPhone: detail.supplierPhone,
          expiresAt: detail.expiresAt
            ? detail.expiresAt.toISOString()
            : null,
          viewerIsBuyer,
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
