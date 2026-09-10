"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Render a placeholder shell before hydration so the layout doesn't shift.
  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-dune bg-paper text-ink transition hover:border-ink/40 hover:bg-sand/50",
        className,
      )}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Moon className="h-4 w-4" strokeWidth={1.75} />
        )
      ) : (
        <Sun className="h-4 w-4 opacity-0" aria-hidden />
      )}
    </button>
  );
}
