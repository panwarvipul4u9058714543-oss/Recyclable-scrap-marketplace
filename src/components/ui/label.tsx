import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-1.5 inline-block text-sm font-medium tracking-tight text-ink", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-1.5 text-xs leading-relaxed text-ash", className)}>{children}</p>;
}

export function FieldError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("mt-1.5 text-xs text-signal-err", className)}>
      {children}
    </p>
  );
}
