import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ChevronRight,
  Handshake,
  Leaf,
  MapPin,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";

const ROLES = [
  {
    name: "Households",
    line: "Post the stack in the corner. Get a fair kilo rate from someone nearby.",
    Icon: Handshake,
    tone: "rust" as const,
  },
  {
    name: "Kabadiwalas",
    line: "Read the neighbourhood — who's got what, and where the run actually pays.",
    Icon: MapPin,
    tone: "moss" as const,
  },
  {
    name: "Dealers",
    line: "Aggregate small pickups into a truckload. Publish what you'll take.",
    Icon: Boxes,
    tone: "ink" as const,
  },
  {
    name: "Businesses",
    line: "Turn recurring cafe / shop / workshop scrap into a scheduled pickup.",
    Icon: ScrollText,
    tone: "rust" as const,
  },
  {
    name: "Recyclers",
    line: "Source sorted material — kilos, not promises — from dealers on the ground.",
    Icon: Sparkles,
    tone: "moss" as const,
  },
];

const HOW = [
  {
    step: "01",
    title: "List it as it is",
    body: "Weight range, material, a photo, one locality string. No inflated grades, no stock photos. Everyone reads the same listing.",
  },
  {
    step: "02",
    title: "The match happens on ground truth",
    body: "Buyers nearby see distance and availability first. Interest goes both ways before phone numbers do — nothing is public until you both accept.",
  },
  {
    step: "03",
    title: "Weight, price, handshake",
    body: "Chat on-platform, pick a time, complete the pickup. The connection ends when both sides say it did — and the ratings that follow feed the reputation everyone else sees.",
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero — asymmetric, editorial */}
      <section className="relative overflow-hidden border-b border-dune/60 bg-paper">
        <div className="surface-grain absolute inset-0 opacity-70" aria-hidden />
        <div className="container-page relative py-16 sm:py-24">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-end">
            <div className="animate-fade-in">
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-ash">
                <span className="inline-block h-px w-8 bg-rust" /> raddi. — the ledger
              </p>
              <h1 className="font-serif text-display leading-[1.02] text-ink">
                The scrap trade,
                <br />
                <span className="italic text-rust">written down honestly.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ash">
                Households, kabadiwalas, dealers, businesses and recyclers — on
                one marketplace, in the vocabulary they actually use. Real
                weights, distance-first discovery, a shared record of who moved
                what.
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

              <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-ash">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-moss" />
                  Phone-only sign-up
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-rust" />
                  Contact stays hidden until both accept
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-ash" />
                  No commission on the trade itself
                </span>
              </div>
            </div>

            {/* Visual right column — an editorial "sample listing" card */}
            <Card className="animate-slide-in relative overflow-hidden bg-sand/50 p-6">
              <div className="absolute inset-x-0 top-0 h-1 bg-rust" />
              <div className="mb-3 flex items-center justify-between">
                <Badge tone="moss">Live listing</Badge>
                <span className="font-mono text-xs text-ash">01 · sample</span>
              </div>
              <h3 className="font-serif text-2xl leading-tight tracking-tight text-ink">
                Clean PET bottles, ~6 kg
              </h3>
              <p className="mt-2 text-sm text-ash">
                <span className="text-ink">Plastic (bottles, containers)</span>{" "}
                · 5–8 kg · Koramangala, Bengaluru · Ready today
              </p>
              <div className="mt-4 flex items-baseline justify-between border-t border-dune/60 pt-4">
                <span className="text-xs text-ash">Approximate distance</span>
                <span className="font-mono text-sm text-moss">2.3 km</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs text-ash">Interested buyers</span>
                <span className="font-mono text-sm text-ink">3</span>
              </div>
              <p className="mt-6 text-xs italic text-ash">
                Reads the same for everyone. Buyers see distance before
                identity; nothing shared until both sides accept.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-b border-dune/60 bg-paper">
        <div className="container-page py-16 sm:py-24">
          <div className="mb-10 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ash">
                <Leaf className="h-3.5 w-3.5 text-moss" /> Built for
              </p>
              <h2 className="font-serif text-hero tracking-tight text-ink">
                Everyone who&apos;s already
                <br />
                <span className="italic text-moss">moving raddi.</span>
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-ash">
              Not a single-role app pretending to serve five audiences. Each
              role sees only the workflows their day actually needs.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map(({ name, line, Icon, tone }, idx) => (
              <li key={name}>
                <Reveal delay={idx * 0.05}>
                <Card className="group relative h-full overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-lift">
                  <div
                    className={
                      "absolute inset-y-0 left-0 w-[3px] transition group-hover:w-1 " +
                      (tone === "moss"
                        ? "bg-moss"
                        : tone === "ink"
                          ? "bg-ink"
                          : "bg-rust")
                    }
                  />
                  <div
                    className={
                      "mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md border " +
                      (tone === "moss"
                        ? "border-moss/30 bg-moss-soft text-moss"
                        : tone === "ink"
                          ? "border-ink/30 bg-ink/5 text-ink"
                          : "border-rust/30 bg-rust-soft text-rust-ink")
                    }
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <p className="font-serif text-xl leading-tight tracking-tight text-ink">
                    {name}
                  </p>
                  <p className="mt-2 text-sm leading-snug text-ash">{line}</p>
                </Card>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-dune/60 bg-sand/40">
        <div className="container-page py-16 sm:py-24">
          <div className="mb-10">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ash">
              <span className="inline-block h-px w-8 bg-rust" /> How it works
            </p>
            <h2 className="font-serif text-hero tracking-tight text-ink">
              Three steps.
              <br />
              <span className="italic text-rust">No middleman between them.</span>
            </h2>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {HOW.map(({ step, title, body }, idx) => (
              <li key={step}>
                <Reveal delay={idx * 0.08}>
                <Card className="h-full p-6">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-rust">
                    Step {step}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-ink">
                    {title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
                    {body}
                  </p>
                </Card>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-paper">
        <div className="container-page py-20 sm:py-28">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ash">
                <span className="inline-block h-px w-8 bg-moss" /> One phone number away
              </p>
              <h2 className="font-serif text-hero tracking-tight text-ink">
                Post your first listing,
                <br />
                or watch the ground move first.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ash">
                Every account starts the same way — a phone number, a role or
                two, and you&apos;re in. No credit card, no waitlist, no
                onboarding call.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="focus-ring inline-flex">
                <Button size="lg" variant="primary" className="group">
                  Register
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link href="/nearby" className="focus-ring inline-flex">
                <Button size="lg" variant="outline">
                  Browse without signing up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
