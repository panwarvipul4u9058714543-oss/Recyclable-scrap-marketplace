import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isProfessionalRole } from "@/lib/monetisation/plans";
import {
  BULK_BUYER_ROLES,
  BULK_SUPPLIER_ROLES,
  COLLECTOR_ROLES,
  SELLER_ROLES,
} from "@/lib/roles";
import { HeaderAuthArea } from "./header-auth-area";
import { MobileNav } from "./mobile-nav";

/**
 * Top navigation shown on every page. Server-rendered so it can read the
 * signed-in user and show only the workflows their roles unlock. The nav
 * scaffolding stays quiet — a single row of text links, one accent CTA — so
 * transactional pages carry the visual weight, not the chrome.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  const links: Array<{ href: string; label: string }> = [];

  if (user) {
    const roles = user.roles;
    const canSell = roles.some((r) => SELLER_ROLES.includes(r));
    const canBrowse = roles.some((r) => COLLECTOR_ROLES.includes(r));
    const canPublishBulk = roles.some((r) => BULK_BUYER_ROLES.includes(r));
    const canRespondBulk = roles.some((r) => BULK_SUPPLIER_ROLES.includes(r));

    links.push({ href: "/dashboard", label: "Dashboard" });
    if (canSell) links.push({ href: "/listings", label: "Listings" });
    if (canBrowse) links.push({ href: "/nearby", label: "Nearby" });
    if (canBrowse) links.push({ href: "/route", label: "Route" });
    if (canPublishBulk || canRespondBulk)
      links.push({ href: "/bulk", label: "Bulk" });
    links.push({ href: "/connections", label: "Connections" });
    if (roles.some(isProfessionalRole))
      links.push({ href: "/monetisation", label: "Paid" });
    if (user.isAdmin)
      links.push({ href: "/moderation", label: "Moderation" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-dune/60 bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="container-page flex h-14 items-center gap-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="focus-ring inline-flex items-center gap-2 rounded-sm"
        >
          <LogoMark />
          <Wordmark />
        </Link>

        {links.length > 0 && (
          <nav className="hidden gap-1 md:flex" aria-label="Primary">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="focus-ring rounded-sm px-2 py-1 text-sm text-ash transition hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex">
            <HeaderAuthArea
              phone={user?.phone ?? null}
              isAdmin={user?.isAdmin ?? false}
            />
          </div>
          <MobileNav
            links={links}
            phone={user?.phone ?? null}
            isAdmin={user?.isAdmin ?? false}
          />
        </div>
      </div>
    </header>
  );
}
