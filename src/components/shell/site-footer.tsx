import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-dune/60 bg-sand/40">
      <div className="container-page flex flex-col gap-4 py-8 text-sm text-ash sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md leading-relaxed">
          Built for the everyday scrap trade — households, kabadiwalas, dealers,
          businesses and recyclers, on one honest ledger.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Footer">
          <Link href="/register" className="hover:text-ink">
            Register
          </Link>
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
          <Link href="/nearby" className="hover:text-ink">
            Nearby
          </Link>
          <Link href="/bulk" className="hover:text-ink">
            Bulk
          </Link>
          <span className="text-ash/70">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}
