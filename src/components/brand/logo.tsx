import { cn } from "@/lib/utils";

// A geometric mark: a hand-drawn "recycled loop" tied around the letter R.
// It's asymmetric on purpose — the loop is not a perfect triangle, so it
// reads as a stamp rather than a stock icon.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("h-6 w-6 shrink-0", className)}
    >
      <path
        d="M6 22 L16 5 L28 22 Z"
        fill="none"
        stroke="hsl(var(--rust))"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="18" r="4.5" fill="hsl(var(--moss))" />
      <text
        x="16"
        y="21.2"
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, serif"
        fontSize="7"
        fontWeight="600"
        fill="hsl(var(--paper))"
      >
        R
      </text>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-serif text-[17px] tracking-tight leading-none text-ink",
        className,
      )}
    >
      raddi<span className="text-rust">.</span>
    </span>
  );
}
