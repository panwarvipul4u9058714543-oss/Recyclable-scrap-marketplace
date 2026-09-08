import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Recyclable Scrap Marketplace</h1>
      <p>
        Connecting households, collectors (kabadiwalas), scrap dealers,
        businesses and recyclers for ordinary recyclable scrap.
      </p>
      <p>
        <Link href="/register">Get started</Link> — register with your phone and
        choose how you&apos;ll use the marketplace.
      </p>
    </main>
  );
}
