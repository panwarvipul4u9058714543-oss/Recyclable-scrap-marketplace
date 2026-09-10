import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <header className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow ? (
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-ash">
            <span className="inline-block h-px w-6 bg-rust" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-hero tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ash">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
