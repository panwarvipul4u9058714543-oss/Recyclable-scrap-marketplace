"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNote } from "@/components/ui/inline-note";

export function NotificationPreferences({
  initialNotifyOnRouteMatch,
}: {
  initialNotifyOnRouteMatch: boolean;
}) {
  const [enabled, setEnabled] = useState(initialNotifyOnRouteMatch);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function onChange(next: boolean) {
    setStatus("saving");
    setEnabled(next);
    try {
      const res = await fetch("/api/preferences/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notifyOnRouteMatch: next }),
      });
      if (!res.ok) {
        setStatus("error");
        setEnabled(!next);
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
      setEnabled(!next);
    }
  }

  return (
    <section aria-label="Notification preferences" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl tracking-tight">
          Notification preferences
        </h2>
        <Bell className="h-4 w-4 text-ash" />
      </div>
      <Card className="p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="flex-1 text-[15px] leading-relaxed text-ink">
            Notify me on <strong className="font-medium text-rust-ink">route matches</strong> — new listings that fit
            your active route.
          </span>
        </label>
      </Card>
      {status === "saved" && (
        <InlineNote tone="ok" className="text-xs">
          Preferences saved.
        </InlineNote>
      )}
      {status === "error" && (
        <InlineNote tone="err" className="text-xs">
          Couldn&apos;t save. Please try again.
        </InlineNote>
      )}
    </section>
  );
}
