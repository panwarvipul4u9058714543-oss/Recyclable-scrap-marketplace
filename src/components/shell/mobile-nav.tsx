"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  links: Array<{ href: string; label: string }>;
  phone: string | null;
  isAdmin: boolean;
};

export function MobileNav({ links, phone, isAdmin }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-dune bg-paper text-ink md:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="h-4 w-4" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-ink/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l border-dune bg-paper shadow-lift transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between border-b border-dune px-5 py-3">
            <span className="font-serif text-lg text-ink">Menu</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-sand"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4" aria-label="Primary">
            {links.length === 0 ? (
              <Link
                onClick={() => setOpen(false)}
                href="/register"
                className="focus-ring rounded-md border border-rust bg-rust px-4 py-3 text-center text-sm font-medium text-paper"
              >
                Get started
              </Link>
            ) : (
              links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring rounded-md px-3 py-2 text-[15px] text-ink hover:bg-sand"
                >
                  {l.label}
                </Link>
              ))
            )}
          </nav>

          {phone ? (
            <div className="border-t border-dune px-5 py-4 text-xs">
              <p className="font-mono text-ash">
                {phone}
                {isAdmin ? <span className="ml-1 text-rust">·admin</span> : null}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
