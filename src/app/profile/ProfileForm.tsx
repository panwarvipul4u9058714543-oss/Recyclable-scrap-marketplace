"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/roles";
import { COLLECTOR_ROLES } from "@/lib/roles";
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
    <form onSubmit={onSubmit}>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" style={{ color: "#a5d6a7" }}>
          Profile saved.
        </p>
      )}

      <label htmlFor="displayName">Display name</label>
      <input
        id="displayName"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Shown to others instead of your phone"
        style={inputStyle}
      />

      <label htmlFor="bio">About you (optional)</label>
      <textarea
        id="bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        placeholder="A short intro others will see on your profile"
        style={inputStyle}
      />

      {isOrgRole && (
        <fieldset style={fieldsetStyle}>
          <legend>Organisation &amp; verification</legend>
          <p style={hintStyle}>
            Businesses, dealers and recyclers can add their organisation name
            and any registration or licence number so others can verify them.
          </p>

          <label htmlFor="organisationName">Organisation name</label>
          <input
            id="organisationName"
            value={organisationName}
            onChange={(e) => setOrganisationName(e.target.value)}
            placeholder="e.g. Green Cafe Pvt Ltd"
            style={inputStyle}
          />

          <label htmlFor="registrationId">Registration / licence ID</label>
          <input
            id="registrationId"
            value={registrationId}
            onChange={(e) => setRegistrationId(e.target.value)}
            placeholder="e.g. GST, Udyam, CPCB or municipal licence"
            style={inputStyle}
          />
        </fieldset>
      )}

      {isCollectorRole && (
        <fieldset style={fieldsetStyle}>
          <legend>Service area &amp; accepted materials</legend>
          <p style={hintStyle}>
            Collectors, dealers and recyclers can describe where they operate
            and which materials they accept.
          </p>

          <label htmlFor="serviceAreaLocality">Service area</label>
          <input
            id="serviceAreaLocality"
            value={serviceAreaLocality}
            onChange={(e) => setServiceAreaLocality(e.target.value)}
            placeholder="e.g. Bengaluru south"
            style={inputStyle}
          />

          <label htmlFor="serviceAreaRadiusKm">
            How far you&apos;ll travel (km)
          </label>
          <input
            id="serviceAreaRadiusKm"
            type="number"
            min="0.5"
            max="500"
            step="0.5"
            value={serviceAreaRadiusKm}
            onChange={(e) => setServiceAreaRadiusKm(e.target.value)}
            placeholder="10"
            style={inputStyle}
          />

          <fieldset style={materialsFieldsetStyle}>
            <legend style={{ fontSize: "0.9rem" }}>Accepted materials</legend>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1rem" }}
            >
              {MATERIAL_CATEGORIES.map((category) => (
                <label
                  key={category}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.9rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptedMaterials.includes(category)}
                    onChange={() => toggleMaterial(category)}
                  />
                  {MATERIAL_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      )}

      <button type="submit" disabled={busy} style={buttonStyle}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.55rem",
  margin: "0.35rem 0 1rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const fieldsetStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.6rem 1rem 0",
  margin: "0 0 1rem",
};

const materialsFieldsetStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.5rem 0.8rem",
  margin: "0 0 0.6rem",
};

const hintStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.85rem",
  margin: "0 0 0.6rem",
};
