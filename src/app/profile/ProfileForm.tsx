"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNote } from "@/components/ui/inline-note";
import { Input, Textarea } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { COLLECTOR_ROLES, type Role } from "@/lib/roles";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  type MaterialCategory,
} from "@/lib/materials";
import type { ProfileDTO } from "@/lib/profiles/profiles";

interface ProfileFormProps {
  roles: Role[];
  initial: ProfileDTO;
}

export function ProfileForm({ roles, initial }: ProfileFormProps) {
  const router = useRouter();
  const isCollectorRole = roles.some((r) => COLLECTOR_ROLES.includes(r));
  const isOrgRole = roles.some((r) =>
    (["BUSINESS", "DEALER", "RECYCLER"] as Role[]).includes(r),
  );

  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [organisationName, setOrganisationName] = useState(
    initial.organisationName ?? "",
  );
  const [registrationId, setRegistrationId] = useState(
    initial.registrationId ?? "",
  );
  const [serviceAreaLocality, setServiceAreaLocality] = useState(
    initial.serviceAreaLocality ?? "",
  );
  const [serviceAreaRadiusKm, setServiceAreaRadiusKm] = useState(
    initial.serviceAreaRadiusKm == null
      ? ""
      : String(initial.serviceAreaRadiusKm),
  );
  const [acceptedMaterials, setAcceptedMaterials] = useState<
    MaterialCategory[]
  >(initial.acceptedMaterials);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleMaterial(category: MaterialCategory) {
    setAcceptedMaterials((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const radius = serviceAreaRadiusKm.trim();
    let radiusValue: number | undefined | "";
    if (radius === "") {
      radiusValue = "";
    } else {
      const n = Number(radius);
      if (!Number.isFinite(n) || n < 0.5 || n > 500) {
        setError("Service-area radius must be between 0.5 and 500 km.");
        return;
      }
      radiusValue = n;
    }

    const payload: Record<string, unknown> = {
      displayName,
      bio,
      organisationName: isOrgRole ? organisationName : "",
      registrationId: isOrgRole ? registrationId : "",
      serviceAreaLocality: isCollectorRole ? serviceAreaLocality : "",
      serviceAreaRadiusKm: isCollectorRole ? radiusValue : "",
      acceptedMaterials: isCollectorRole ? acceptedMaterials : [],
    };

    setBusy(true);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError("Could not save your profile. Please check the fields.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}
      {saved ? <InlineNote tone="ok">Profile saved.</InlineNote> : null}

      <Card className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-serif text-xl tracking-tight">Public identity</h2>
          <p className="mt-1 text-sm text-ash">
            The name and short bio others see across the marketplace.
          </p>
        </div>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Shown to others instead of your phone"
            />
          </div>
          <div>
            <Label htmlFor="bio">About you (optional)</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A short intro others will see on your profile"
            />
            <FieldHint>
              A line or two — what you deal in, when you&apos;re usually free,
              anything a match would want to know.
            </FieldHint>
          </div>
        </div>
      </Card>

      {isOrgRole && (
        <Card className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl tracking-tight">
              Organisation &amp; verification
            </h2>
            <p className="mt-1 text-sm text-ash">
              Businesses, dealers and recyclers can add their organisation name
              and any registration or licence number so others can verify them.
            </p>
          </div>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="organisationName">Organisation name</Label>
              <Input
                id="organisationName"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                placeholder="e.g. Green Cafe Pvt Ltd"
              />
            </div>
            <div>
              <Label htmlFor="registrationId">Registration / licence ID</Label>
              <Input
                id="registrationId"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                placeholder="e.g. GST, Udyam, CPCB or municipal licence"
              />
            </div>
          </div>
        </Card>
      )}

      {isCollectorRole && (
        <Card className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl tracking-tight">
              Service area &amp; accepted materials
            </h2>
            <p className="mt-1 text-sm text-ash">
              Collectors, dealers and recyclers can describe where they operate
              and which materials they accept.
            </p>
          </div>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="serviceAreaLocality">Service area</Label>
              <Input
                id="serviceAreaLocality"
                value={serviceAreaLocality}
                onChange={(e) => setServiceAreaLocality(e.target.value)}
                placeholder="e.g. Bengaluru south"
              />
            </div>
            <div className="max-w-xs">
              <Label htmlFor="serviceAreaRadiusKm">
                How far you&apos;ll travel (km)
              </Label>
              <Input
                id="serviceAreaRadiusKm"
                type="number"
                min="0.5"
                max="500"
                step="0.5"
                value={serviceAreaRadiusKm}
                onChange={(e) => setServiceAreaRadiusKm(e.target.value)}
                placeholder="10"
              />
              <FieldHint>Between 0.5 and 500 km.</FieldHint>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">
                Accepted materials
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MATERIAL_CATEGORIES.map((category) => {
                  const checked = acceptedMaterials.includes(category);
                  return (
                    <label
                      key={category}
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition " +
                        (checked
                          ? "border-moss/50 bg-moss-soft text-ink"
                          : "border-dune bg-paper hover:border-ink/30 hover:bg-sand/50")
                      }
                    >
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleMaterial(category)}
                      />
                      <span>{MATERIAL_LABELS[category]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} variant="primary" size="lg" className="group">
          <Save className="h-4 w-4" />
          {busy ? "Saving…" : "Save profile"}
        </Button>
        <span className="text-xs text-ash">Changes appear on your public profile immediately.</span>
      </div>
    </form>
  );
}
