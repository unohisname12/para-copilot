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

// Deterministic hash with good diffusion (murmur3-inspired). Gives near-
// uniform distribution across a 12-bucket palette for realistic Para App
// Number inputs. Same input → same output, stable across devices.
function hashKey(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// Derive { palette entry, sequence number } deterministically from a Para App
// Number. Same number everywhere → same identity everywhere. Sequence is the
// last 3 digits (or last 3 chars hashed) — guarantees cross-para stability
// without requiring knowledge of the full roster.
export function deriveIdentityFromParaAppNumber(paraAppNumber) {
  const key = String(paraAppNumber || '').trim();
  if (!key) return null;
  const paletteIndex = hashKey(key) % IDENTITY_PALETTE.length;
  const entry = IDENTITY_PALETTE[paletteIndex];
  // Use last 3 digits when available (6-digit Para App Numbers), else hash.
  const tail = key.length >= 3 ? key.slice(-3) : key.padStart(3, '0');
  const sequenceNumber = /^\d+$/.test(tail)
    ? parseInt(tail, 10)
    : (hashKey(key + ':seq') % 900) + 100;
  return {
    paletteIndex,
    entry,
    sequenceNumber,
    pseudonym: `${entry.name} Student ${sequenceNumber}`,
    color: entry.hex,
    identity: assignIdentity(paletteIndex, sequenceNumber),
  };
}

// ── generateIdentitySet ───────────────────────────────────────
// Accepts either:
//   (A) string[] — legacy: sequence by input order, one palette entry per bucket
//   (B) {name, paraAppNumber?, pseudonym?, color?}[] — per-entry:
//       - If entry has `pseudonym`, honor it (admin override).
//       - Else if entry has `paraAppNumber`, derive deterministically.
//       - Else fall back to (A)-style incremental assignment.
// Output: Map<name, { pseudonym, color, identity }>
export function generateIdentitySet(input) {
  if (!Array.isArray(input)) {
    throw new TypeError('generateIdentitySet: input must be an Array');
  }
  const colorCounts = {};
  const result = new Map();

  input.forEach((raw, i) => {
    const isObj = raw && typeof raw === 'object' && !Array.isArray(raw);
    const name = isObj ? raw.name : raw;
    if (!name) return;

    const paraAppNumber = isObj ? raw.paraAppNumber : null;
    const overridePseudonym = isObj ? raw.pseudonym : null;
    const overrideColor = isObj ? raw.color : null;

    // (1) Explicit admin-provided pseudonym — honored ONLY if it parses as a
    //     color-label format ("Red Student 3", "Blue Student 12", etc.).
    //     Any other string (e.g. the fake name "Jordan Smith" used as an
    //     alias in some roster schemas) is ignored so we don't bucket every
    //     student into palette[0].
    if (overridePseudonym) {
      const paletteEntry = IDENTITY_PALETTE.find(p => overridePseudonym.startsWith(p.name));
      const seqMatch = overridePseudonym.match(/^\w+\s+Student\s+(\d+)/i);
      if (paletteEntry && seqMatch) {
        const seq = parseInt(seqMatch[1], 10);
        result.set(name, {
          pseudonym: overridePseudonym,
          color: overrideColor || paletteEntry.hex,
          identity: assignIdentity(IDENTITY_PALETTE.indexOf(paletteEntry), seq),
        });
        return;
      }
      // else fall through to paraAppNumber / legacy path
    }

    // (2) Deterministic from Para App Number.
    if (paraAppNumber) {
      const derived = deriveIdentityFromParaAppNumber(paraAppNumber);
      if (derived) {
        result.set(name, {
          pseudonym: derived.pseudonym,
          color: derived.color,
          identity: derived.identity,
        });
        return;
      }
    }

    // (3) Legacy fallback — input-order palette cycle.
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
// Precedence (when VaultProvider has enriched the student object):
//   1. student.realName — real name from the local vault (requires toggle ON)
//   2. student.identity — codename ("🔥 Ember 1")
//   3. student.pseudonym — legacy ("Red Student 1")
// Real names only exist on the student object when the user has explicitly
// enabled "Show real names" AND the vault contains a paraAppNumber match.
export function getStudentLabel(student, format = "compact") {
  if (student?.realName) return student.realName;
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
