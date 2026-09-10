import type { HTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const noteVariants = cva(
  "flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm leading-snug",
  {
    variants: {
      tone: {
        info: "border-dune bg-sand/60 text-ink",
        ok: "border-signal-ok/30 bg-moss-soft text-moss",
        warn: "border-signal-warn/30 bg-signal-warn/10 text-signal-warn",
        err: "border-signal-err/40 bg-signal-err/10 text-signal-err",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

const iconFor = {
  info: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  err: XCircle,
} as const;

interface Props
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof noteVariants> {
  children: React.ReactNode;
}

export function InlineNote({ tone, className, children, role, ...props }: Props) {
  const Icon = iconFor[tone ?? "info"];
  const inferredRole = role ?? (tone === "err" ? "alert" : tone === "ok" ? "status" : undefined);
  return (
    <div className={cn(noteVariants({ tone }), className)} role={inferredRole} {...props}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
