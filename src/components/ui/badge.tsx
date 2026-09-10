import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium tracking-tight uppercase",
  {
    variants: {
      tone: {
        neutral: "border-dune bg-sand/60 text-ash",
        rust: "border-rust/30 bg-rust-soft text-rust-ink",
        moss: "border-moss/25 bg-moss-soft text-moss",
        outline: "border-ink/70 bg-transparent text-ink",
        warn: "border-signal-warn/40 bg-signal-warn/10 text-signal-warn",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
