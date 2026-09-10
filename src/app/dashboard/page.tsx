import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  Compass,
  Gauge,
  Handshake,
  LineChart,
  Map,
  ScrollText,
  Shield,
  Sparkles,
  UserRound,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isProfessionalRole } from "@/lib/monetisation/plans";
import {
  BULK_BUYER_ROLES,
  BULK_SUPPLIER_ROLES,
  COLLECTOR_ROLES,
  ROLE_LABELS,
  SELLER_ROLES,
  type Role,
} from "@/lib/roles";

// Domain copy chosen deliberately — no generic marketing lines. The idea is
// each role sees a one-sentence sketch of what "today" looks like from the
// ground, in the vocabulary the trade actually uses.
const ROLE_LINES: Record<Role, string> = {
  HOUSEHOLD: "Move a stack of raddi you've been putting off — one listing, honest weight.",
  BUSINESS: "Turn recurring scrap into a route your regulars already trust.",
  COLLECTOR: "Read the neighbourhood: who's got what, and where the run makes sense today.",
  DEALER: "See where volume is landing and what your buyers still need this week.",
  RECYCLER: "Source sorted material — kilos, not promises — from dealers on the ground.",
};

type Action = {
  href: string;
  label: string;
  hint: string;
  Icon: typeof Handshake;
  tone?: "rust" | "moss" | "ink";
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const canSell = user.roles.some((r) => SELLER_ROLES.includes(r));
  const canBrowse = user.roles.some((r) => COLLECTOR_ROLES.includes(r));
  const canPublishBulk = user.roles.some((r) => BULK_BUYER_ROLES.includes(r));
  const canRespondBulk = user.roles.some((r) => BULK_SUPPLIER_ROLES.includes(r));
  const canBulk = canPublishBulk || canRespondBulk;
  const isPro = user.roles.some(isProfessionalRole);
  const hasRoles = user.roles.length > 0;

  const actions: Action[] = [];
  if (canSell)
    actions.push({
      href: "/listings",
      label: "Manage listings",
      hint: "Post scrap, edit weights, mark collected.",
      Icon: ScrollText,
      tone: "rust",
    });
  if (canBrowse)
    actions.push({
      href: "/nearby",
      label: "Browse nearby",
      hint: "See what's within a few kilometres today.",
      Icon: Compass,
    });
  if (canBrowse)
    actions.push({
      href: "/route",
      label: "Plan a route",
      hint: "Line up a run and get pings when new stock drops.",
      Icon: Map,
    });
  if (canPublishBulk)
    actions.push({
      href: "/bulk",
      label: "Publish a bulk requirement",
      hint: "Tell suppliers what you'll take in volume this month.",
      Icon: Warehouse,
    });
  if (canRespondBulk)
    actions.push({
      href: "/bulk/browse",
      label: "Browse bulk requirements",
      hint: "Match your aggregated supply to a live buyer.",
      Icon: Boxes,
    });
  actions.push({
    href: "/connections",
    label: "Your connections",
    hint: "Active reservations, shared contacts, chat history.",
    Icon: Handshake,
    tone: "moss",
  });
  actions.push({
    href: "/profile",
    label: "Edit your profile",
    hint: "Your area, service radius, ratings.",
    Icon: UserRound,
  });
  if (isPro)
    actions.push({
      href: "/monetisation",
      label: "Paid features",
      hint: "Boost a listing, run a sponsored panel.",
      Icon: Sparkles,
      tone: "rust",
    });
  if (user.isAdmin)
    actions.push({
      href: "/moderation",
      label: "Moderation queue",
      hint: "Reports awaiting review, suspensions.",
      Icon: Shield,
      tone: "ink",
    });
  if (user.isAdmin)
    actions.push({
      href: "/admin/analytics",
      label: "Marketplace analytics",
      hint: "Funnel, density, monetisation KPIs.",
      Icon: LineChart,
      tone: "ink",
    });

  return (
    <main className="container-page py-10 sm:py-14">
      {/* Hero — asymmetric on wide screens so it doesn't read as a template. */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
        <div className="animate-fade-in">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-ash">
            <span className="inline-block h-px w-8 bg-rust" />
            Signed in
          </p>
          <h1 className="sr-only">Your dashboard</h1>
          <p className="font-serif text-hero text-ink" aria-hidden>
            Namaste,{" "}
            <span className="italic text-rust">{user.phone}</span>
          </p>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-ash">
            One ledger for the everyday scrap trade. Below, only the workflows
            your roles unlock — cleaner than a menu, honest about what you can
            actually do here today.
          </p>
        </div>

        <div className="hidden md:block">
          <Card className="relative overflow-hidden bg-sand/40 p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-rust" />
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-ash">
              <Gauge className="h-3.5 w-3.5" /> Roles active
            </p>
            <p className="mt-1 font-serif text-4xl leading-none text-ink">
              {user.roles.length}
            </p>
            <p className="mt-3 text-xs text-ash">
              You can hold as many as you actually work — a household that also
              runs a small dealer setup is welcome.
            </p>
          </Card>
        </div>
      </section>

      <div className="rule my-10" />

      {/* Roles */}
      <section aria-labelledby="roles-heading" className="animate-slide-in">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="roles-heading" className="font-serif text-2xl tracking-tight">
            Your roles
          </h2>
          <Link
            href="/profile"
            className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-ash hover:text-ink"
          >
            Change <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!hasRoles ? (
          <Card className="p-6">
            <p className="text-sm text-ash">
              You haven&apos;t picked a role yet.{" "}
              <Link href="/register" className="text-rust underline-offset-4 hover:underline">
                Choose your roles
              </Link>{" "}
              — this is what makes the marketplace remember what you actually do.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {user.roles.map((role) => (
              <li key={role}>
                <Card className="group h-full p-5 transition hover:-translate-y-px hover:border-ink/30 hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <Badge tone="moss">{ROLE_LABELS[role]}</Badge>
                    <span className="font-mono text-[10px] text-ash">
                      {role.slice(0, 3)}
                    </span>
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
                    {ROLE_LINES[role]}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rule my-10" />

      {/* Actions */}
      {(canSell || canBrowse || canBulk || user.isAdmin) && (
        <section aria-labelledby="actions-heading">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2
              id="actions-heading"
              className="font-serif text-2xl tracking-tight"
            >
              What you can do
            </h2>
            <span className="font-mono text-xs text-ash">
              {actions.length.toString().padStart(2, "0")} workflows
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map(({ href, label, hint, Icon, tone }) => (
              <Link
                key={href}
                href={href}
                className="focus-ring group block rounded-lg"
              >
                <Card className="relative h-full overflow-hidden p-5 transition group-hover:-translate-y-0.5 group-hover:border-ink/40 group-hover:shadow-lift">
                  <div
                    className={
                      "absolute inset-y-0 left-0 w-[3px] transition group-hover:w-1 " +
                      (tone === "moss"
                        ? "bg-moss"
                        : tone === "ink"
                          ? "bg-ink"
                          : tone === "rust"
                            ? "bg-rust"
                            : "bg-dune")
                    }
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={
                        "inline-flex h-9 w-9 items-center justify-center rounded-md border " +
                        (tone === "moss"
                          ? "border-moss/30 bg-moss-soft text-moss"
                          : tone === "ink"
                            ? "border-ink/30 bg-ink/5 text-ink"
                            : tone === "rust"
                              ? "border-rust/30 bg-rust-soft text-rust-ink"
                              : "border-dune bg-sand/50 text-ash")
                      }
                    >
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-ash transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                  <p className="mt-4 font-serif text-lg leading-tight text-ink">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-ash">{hint}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!canSell && !canBrowse && !canBulk && !user.isAdmin && (
        <Card className="mt-6 border-dashed p-6">
          <p className="text-sm text-ash">
            Pick a role to unlock the workflows that fit it.{" "}
            <Link href="/profile" className="text-rust underline-offset-4 hover:underline">
              Edit your profile
            </Link>
            .
          </p>
        </Card>
      )}
    </main>
  );
}
