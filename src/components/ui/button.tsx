import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight transition disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-rust text-paper shadow-soft hover:bg-rust/90 active:translate-y-px",
        secondary:
          "border border-dune bg-paper text-ink hover:border-ink/40 hover:bg-sand/50",
        ghost:
          "text-ink hover:bg-sand/60",
        moss:
          "bg-moss text-paper hover:bg-moss/90 active:translate-y-px",
        outline:
          "border border-ink/70 bg-transparent text-ink hover:bg-ink hover:text-paper",
        link:
          "text-rust underline-offset-4 hover:underline p-0",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
