// ══════════════════════════════════════════════════════════════
// BRAND HEADER — SupaPara logo + tagline
// Logo file: /public/assets/logo.png — swap by replacing that file
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";

export function BrandHeader({ right = null }) {
  const [imgError, setImgError] = useState(false);

  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      height: "52px",
      flexShrink: 0,
      background: "#04080f",
      borderBottom: "1px solid #1e3a5f",
      zIndex: 100,
    }}>
      {/* Left: Logo + tagline */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {!imgError ? (
          <img
            src="/assets/logo.png"
            alt="SupaPara"
            onError={() => setImgError(true)}
            style={{
              height: "36px",
              width: "auto",
              objectFit: "contain",
              borderRadius: "6px",
            }}
          />
        ) : (
          /* Fallback text if image missing */
          <span style={{ fontSize: "17px", fontWeight: "800", color: "#fff", letterSpacing: "-0.02em" }}>
            SupaPara
          </span>
        )}
        <span style={{
          fontSize: "11px",
          color: "#475569",
          fontWeight: "500",
          letterSpacing: "0.01em",
          display: "var(--tagline-display, block)",
        }}>
          Powering ParaProfesionals
        </span>
      </div>

      {/* Right: optional slot */}
      {right && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {right}
        </div>
      )}
    </header>
  );
}
