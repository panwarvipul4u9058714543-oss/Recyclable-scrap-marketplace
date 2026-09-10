"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// A styled checkbox that keeps the native input for accessibility (and so
// `page.getByLabel(...).check()` in tests keeps working) while overlaying a
// custom mark. Wrap in <label> around a text sibling.
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <span className="relative inline-flex h-5 w-5 shrink-0">
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "peer h-5 w-5 cursor-pointer appearance-none rounded-sm border border-dune bg-paper shadow-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40 checked:border-rust checked:bg-rust hover:border-ink/40",
        className,
      )}
      {...props}
    />
    <Check
      aria-hidden
      className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-paper opacity-0 peer-checked:opacity-100"
      strokeWidth={3}
    />
  </span>
));
Checkbox.displayName = "Checkbox";
