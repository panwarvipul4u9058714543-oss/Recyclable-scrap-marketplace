import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// A quiet, editorial landing. Full marketing pass lands in Step E — this is a
// placeholder that already speaks in the app's voice so signing up doesn't
// jump between two visual languages.
export default function HomePage() {
  return (
    <main className="container-page py-14 sm:py-24">
      <section className="grid gap-10 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
        <div className="animate-fade-in">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ash">
            <span className="inline-block h-px w-8 bg-rust" /> The ledger
          </p>
          <h1 className="font-serif text-display leading-[1.02] text-ink">
            The scrap trade,{" "}
            <span className="italic text-rust">written down honestly.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ash">
            Households, kabadiwalas, dealers, businesses and recyclers — on one
            marketplace, in the vocabulary they actually use. No stock photos,
            no promises. Just working listings, real weights, and a shared
            record of who moved what.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className="focus-ring inline-flex">
              <Button size="lg" variant="primary" className="group">
                Register with your phone
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/nearby" className="focus-ring inline-flex">
              <Button size="lg" variant="ghost">
                Peek at what&apos;s nearby
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <Card className="relative overflow-hidden bg-sand/40 p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-moss" />
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ash">
            Built for
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Households", "Post the stack in the corner. Get a fair kilo rate."],
              ["Kabadiwalas", "See who's got what, plan a route, avoid dry runs."],
              ["Dealers", "Aggregate small pickups into a truckload."],
              ["Businesses", "Turn recurring scrap into a repeatable pickup."],
              ["Recyclers", "Source sorted material from the ground up."],
            ].map(([who, why]) => (
              <li key={who} className="border-t border-dune/60 pt-3 first:border-0 first:pt-0">
                <p className="font-medium text-ink">{who}</p>
                <p className="mt-0.5 text-ash">{why}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </main>
  );
}
