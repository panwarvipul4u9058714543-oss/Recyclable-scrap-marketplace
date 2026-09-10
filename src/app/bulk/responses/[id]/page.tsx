import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="container-page py-10 sm:py-14">
      <Link
        href={viewerIsBuyer ? `/bulk/${detail.requirementId}` : "/bulk"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <PageHeader
        eyebrow={viewerIsBuyer ? "Bulk match · buyer" : "Bulk match · supplier"}
        title={`Bulk response — ${MATERIAL_LABELS[detail.requirementMaterial as MaterialCategory]}`}
        description={
          <>
            Buyer wants at least {detail.requirementMinQuantity}{" "}
            {QUANTITY_UNIT_LABELS[detail.requirementMinQuantityUnit as QuantityUnit]}{" "}
            in {detail.requirementRegion} ·{" "}
            <Link
              href={`/u/${counterpartyId}`}
              className="text-rust underline-offset-4 hover:underline"
            >
              View their profile
            </Link>
          </>
        }
      />

      <p className="mb-6 text-sm text-ink">
        Supplier offers{" "}
        <strong className="font-mono font-medium">
          {detail.offeredQuantity} {QUANTITY_UNIT_LABELS[detail.offeredQuantityUnit]}
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
          expiresAt: detail.expiresAt ? detail.expiresAt.toISOString() : null,
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
