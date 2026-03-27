// ══════════════════════════════════════════════════════════════
// IDENTITY MODULE — Phase 1
// Extends the legacy pseudonym palette with emoji + codename.
// Zero coupling to existing code — safe to import anywhere.
// ══════════════════════════════════════════════════════════════

// ── Identity Palette — 12 entries (hex/name match PSEUDONYM_PALETTE exactly) ──
export const IDENTITY_PALETTE = [
  { hex: "#ef4444", name: "Red",    emoji: "🔥", codename: "Ember" },
  { hex: "#f97316", name: "Orange", emoji: "🍊", codename: "Tangerine" },
  { hex: "#eab308", name: "Yellow", emoji: "⭐", codename: "Nova" },
  { hex: "#22c55e", name: "Green",  emoji: "🌿", codename: "Fern" },
  { hex: "#06b6d4", name: "Cyan",   emoji: "🧊", codename: "Frost" },
  { hex: "#3b82f6", name: "Blue",   emoji: "🌊", codename: "Wave" },
  { hex: "#8b5cf6", name: "Violet", emoji: "🔮", codename: "Prism" },
  { hex: "#ec4899", name: "Pink",   emoji: "🌸", codename: "Bloom" },
  { hex: "#f43f5e", name: "Rose",   emoji: "🌹", codename: "Petal" },
  { hex: "#14b8a6", name: "Teal",   emoji: "🐬", codename: "Reef" },
  { hex: "#a855f7", name: "Purple", emoji: "🦋", codename: "Dusk" },
  { hex: "#84cc16", name: "Lime",   emoji: "🍀", codename: "Clover" },
];

// ── assignIdentity ────────────────────────────────────────────
// Returns: { colorName, color, emoji, codename, sequenceNumber }
export function assignIdentity(paletteIndex, sequenceNumber) {
  const entry = IDENTITY_PALETTE[paletteIndex % IDENTITY_PALETTE.length];
  return {
    colorName: entry.name,
    color: entry.hex,
    emoji: entry.emoji,
    codename: entry.codename,
    sequenceNumber,
  };
}

// ── generateIdentitySet ───────────────────────────────────────
// Input:  string[] of unique real names in desired assignment order
// Output: Map<name, { pseudonym, color, identity }>
export function generateIdentitySet(uniqueNames) {
  if (!Array.isArray(uniqueNames)) {
    throw new TypeError('generateIdentitySet: uniqueNames must be an Array');
  }
  const colorCounts = {};
  const result = new Map();
  uniqueNames.forEach((name, i) => {
    const paletteIndex = i % IDENTITY_PALETTE.length;
    const entry = IDENTITY_PALETTE[paletteIndex];
    colorCounts[entry.name] = (colorCounts[entry.name] || 0) + 1;
    const seq = colorCounts[entry.name];
    result.set(name, {
      pseudonym: `${entry.name} Student ${seq}`,
      color: entry.hex,
      identity: assignIdentity(paletteIndex, seq),
    });
  });
  return result;
}

// ── formatLabel ───────────────────────────────────────────────
// "compact" → "🔥 Ember 1"
// "full"    → "Red • 🔥 Ember 1"
// Defaults to "compact"
export function formatLabel(identity, format = "compact") {
  if (!identity) return "Unknown";
  const compact = `${identity.emoji} ${identity.codename} ${identity.sequenceNumber}`;
  if (format === "full") return `${identity.colorName} • ${compact}`;
  return compact;
}

// ── getStudentLabel ───────────────────────────────────────────
// Uses identity when present; falls back to legacy pseudonym.
export function getStudentLabel(student, format = "compact") {
  if (student?.identity) return formatLabel(student.identity, format);
  return student?.pseudonym || "Unknown";
}

// ── migrateIdentity ───────────────────────────────────────────
// Adds identity field to a student object if missing.
// Parses old "ColorName Student N" pseudonyms.
export function migrateIdentity(student) {
  if (!student) return student;
  if (student.identity) return student; // already migrated

  // Try parsing "ColorName Student N" format
  const match = (student.pseudonym || "").match(/^(\w+)\s+Student\s+(\d+)$/);
  if (match) {
    const [, colorName, seqStr] = match;
    const paletteEntry = IDENTITY_PALETTE.find(p => p.name === colorName);
    if (paletteEntry) {
      return {
        ...student,
        identity: {
          colorName: paletteEntry.name,
          color: paletteEntry.hex,
          emoji: paletteEntry.emoji,
          codename: paletteEntry.codename,
          sequenceNumber: parseInt(seqStr, 10),
        },
      };
    }
  }

  // Unparseable — use color hex fallback
  const paletteEntry = IDENTITY_PALETTE.find(p => p.hex === student.color);
  return {
    ...student,
    identity: {
      colorName: paletteEntry?.name || "Unknown",
      color: student.color || "#64748b",
      emoji: paletteEntry?.emoji || "🔵",
      codename: paletteEntry?.codename || "Unknown",
      sequenceNumber: 0,
    },
  };
}

// ── getDefaultIdentity ────────────────────────────────────────
// Returns { emoji, codename } from the palette for a given colorName, or null.
export function getDefaultIdentity(colorName) {
  const entry = IDENTITY_PALETTE.find(p => p.name === colorName);
  return entry ? { emoji: entry.emoji, codename: entry.codename } : null;
}

// ── isIdentityCustomized ──────────────────────────────────────
// Returns true when identity.emoji or identity.codename differs from palette defaults.
// Returns false when colorName is unknown (no palette baseline to compare against).
export function isIdentityCustomized(identity) {
  if (!identity) return false;
  const def = getDefaultIdentity(identity.colorName);
  if (!def) return false;
  return identity.emoji !== def.emoji || identity.codename !== def.codename;
}

// ── patchIdentity ─────────────────────────────────────────────
// Safely applies emoji/codename overrides to a student's identity.
// Normalizes via migrateIdentity first if identity is missing.
// Preserves colorName, color, sequenceNumber.
// Falls back to existing values when patch fields are empty/whitespace.
export function patchIdentity(student, { emoji, codename }) {
  const s = migrateIdentity(student);
  const base = s.identity;
  return {
    ...s,
    identity: {
      ...base,
      emoji:    emoji?.trim()    || base.emoji,
      codename: codename?.trim() || base.codename,
    },
  };
}

// ── getColorName ──────────────────────────────────────────────
export function getColorName(hex) {
  const entry = IDENTITY_PALETTE.find(p => p.hex === hex);
  return entry?.name || "Unknown";
}
