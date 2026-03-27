import {
  IDENTITY_PALETTE,
  assignIdentity,
  generateIdentitySet,
  formatLabel,
  getStudentLabel,
  migrateIdentity,
  getColorName,
} from '../identity';

// ── IDENTITY_PALETTE ──────────────────────────────────────────
describe('IDENTITY_PALETTE', () => {
  test('has exactly 12 entries', () => {
    expect(IDENTITY_PALETTE).toHaveLength(12);
  });

  test('each entry has hex, name, emoji, codename', () => {
    IDENTITY_PALETTE.forEach((entry, i) => {
      expect(entry).toHaveProperty('hex');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('emoji');
      expect(entry).toHaveProperty('codename');
      expect(typeof entry.hex).toBe('string');
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.emoji).toBe('string');
      expect(typeof entry.codename).toBe('string');
    });
  });

  test('hex values match existing PSEUDONYM_PALETTE order', () => {
    expect(IDENTITY_PALETTE[0]).toEqual({ hex: "#ef4444", name: "Red",    emoji: "🔥", codename: "Ember" });
    expect(IDENTITY_PALETTE[5]).toEqual({ hex: "#3b82f6", name: "Blue",   emoji: "🌊", codename: "Wave" });
    expect(IDENTITY_PALETTE[11]).toEqual({ hex: "#84cc16", name: "Lime",  emoji: "🍀", codename: "Clover" });
  });

  test('all 12 hex values are in correct order', () => {
    const expectedHexes = [
      "#ef4444", "#f97316", "#eab308", "#22c55e",
      "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
      "#f43f5e", "#14b8a6", "#a855f7", "#84cc16",
    ];
    IDENTITY_PALETTE.forEach((entry, i) => {
      expect(entry.hex).toBe(expectedHexes[i]);
    });
  });
});

// ── assignIdentity ────────────────────────────────────────────
describe('assignIdentity', () => {
  test('returns correct structure for index 0, seq 1', () => {
    const result = assignIdentity(0, 1);
    expect(result).toEqual({
      colorName: "Red",
      color: "#ef4444",
      emoji: "🔥",
      codename: "Ember",
      sequenceNumber: 1,
    });
  });

  test('returns correct structure for index 5, seq 3', () => {
    const result = assignIdentity(5, 3);
    expect(result).toEqual({
      colorName: "Blue",
      color: "#3b82f6",
      emoji: "🌊",
      codename: "Wave",
      sequenceNumber: 3,
    });
  });

  test('wraps around palette for index >= 12', () => {
    const result = assignIdentity(12, 2);
    // 12 % 12 === 0 → Red
    expect(result.colorName).toBe("Red");
    expect(result.color).toBe("#ef4444");
    expect(result.sequenceNumber).toBe(2);
  });

  test('wraps around palette for index 13', () => {
    const result = assignIdentity(13, 1);
    // 13 % 12 === 1 → Orange
    expect(result.colorName).toBe("Orange");
    expect(result.color).toBe("#f97316");
  });
});

// ── generateIdentitySet ───────────────────────────────────────
describe('generateIdentitySet', () => {
  test('produces Map with pseudonym, color, and identity', () => {
    const result = generateIdentitySet(['Alice']);
    expect(result).toBeInstanceOf(Map);
    const alice = result.get('Alice');
    expect(alice).toHaveProperty('pseudonym');
    expect(alice).toHaveProperty('color');
    expect(alice).toHaveProperty('identity');
  });

  test('pseudonym format matches legacy: "Red Student 1"', () => {
    const result = generateIdentitySet(['Alice']);
    expect(result.get('Alice').pseudonym).toBe('Red Student 1');
    expect(result.get('Alice').color).toBe('#ef4444');
  });

  test('identity object has all required fields', () => {
    const result = generateIdentitySet(['Alice']);
    const { identity } = result.get('Alice');
    expect(identity).toEqual({
      colorName: "Red",
      color: "#ef4444",
      emoji: "🔥",
      codename: "Ember",
      sequenceNumber: 1,
    });
  });

  test('cycles palette and increments counter', () => {
    const names = Array.from({ length: 13 }, (_, i) => `Person ${i + 1}`);
    const result = generateIdentitySet(names);
    expect(result.get('Person 1').pseudonym).toBe('Red Student 1');
    expect(result.get('Person 13').pseudonym).toBe('Red Student 2');
    expect(result.get('Person 13').identity.sequenceNumber).toBe(2);
    expect(result.get('Person 13').color).toBe('#ef4444');
  });

  test('assigns sequential palette colors to first three names', () => {
    const result = generateIdentitySet(['Alice', 'Bob', 'Carol']);
    expect(result.get('Alice').color).toBe('#ef4444'); // Red
    expect(result.get('Bob').color).toBe('#f97316');   // Orange
    expect(result.get('Carol').color).toBe('#eab308'); // Yellow
  });

  test('throws on non-array input', () => {
    expect(() => generateIdentitySet(null)).toThrow(TypeError);
    expect(() => generateIdentitySet("Alice")).toThrow(TypeError);
    expect(() => generateIdentitySet(42)).toThrow(TypeError);
    expect(() => generateIdentitySet({})).toThrow(TypeError);
  });

  test('returns empty Map for empty input', () => {
    const result = generateIdentitySet([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});

// ── formatLabel ───────────────────────────────────────────────
describe('formatLabel', () => {
  const redIdentity = {
    colorName: "Red",
    color: "#ef4444",
    emoji: "🔥",
    codename: "Ember",
    sequenceNumber: 1,
  };

  test('"compact" format → "🔥 Ember 1"', () => {
    expect(formatLabel(redIdentity, "compact")).toBe("🔥 Ember 1");
  });

  test('"full" format → "Red • 🔥 Ember 1"', () => {
    expect(formatLabel(redIdentity, "full")).toBe("Red • 🔥 Ember 1");
  });

  test('defaults to compact when format omitted', () => {
    expect(formatLabel(redIdentity)).toBe("🔥 Ember 1");
  });

  test('returns "Unknown" for null identity', () => {
    expect(formatLabel(null)).toBe("Unknown");
    expect(formatLabel(undefined)).toBe("Unknown");
  });

  test('works for Blue identity', () => {
    const blueIdentity = {
      colorName: "Blue",
      color: "#3b82f6",
      emoji: "🌊",
      codename: "Wave",
      sequenceNumber: 3,
    };
    expect(formatLabel(blueIdentity, "compact")).toBe("🌊 Wave 3");
    expect(formatLabel(blueIdentity, "full")).toBe("Blue • 🌊 Wave 3");
  });
});

// ── getStudentLabel ───────────────────────────────────────────
describe('getStudentLabel', () => {
  const studentWithIdentity = {
    pseudonym: "Red Student 1",
    color: "#ef4444",
    identity: {
      colorName: "Red",
      color: "#ef4444",
      emoji: "🔥",
      codename: "Ember",
      sequenceNumber: 1,
    },
  };

  const studentWithoutIdentity = {
    pseudonym: "Orange Student 2",
    color: "#f97316",
  };

  test('uses identity when present → compact', () => {
    expect(getStudentLabel(studentWithIdentity)).toBe("🔥 Ember 1");
  });

  test('uses identity with full format', () => {
    expect(getStudentLabel(studentWithIdentity, "full")).toBe("Red • 🔥 Ember 1");
  });

  test('falls back to pseudonym when no identity', () => {
    expect(getStudentLabel(studentWithoutIdentity)).toBe("Orange Student 2");
  });

  test('returns "Unknown" for null student', () => {
    expect(getStudentLabel(null)).toBe("Unknown");
    expect(getStudentLabel(undefined)).toBe("Unknown");
  });

  test('returns "Unknown" for student with neither identity nor pseudonym', () => {
    expect(getStudentLabel({})).toBe("Unknown");
  });
});

// ── migrateIdentity ───────────────────────────────────────────
describe('migrateIdentity', () => {
  test('parses "Red Student 1" → correct identity object', () => {
    const student = { pseudonym: "Red Student 1", color: "#ef4444" };
    const result = migrateIdentity(student);
    expect(result.identity).toEqual({
      colorName: "Red",
      color: "#ef4444",
      emoji: "🔥",
      codename: "Ember",
      sequenceNumber: 1,
    });
  });

  test('keeps pseudonym unchanged after migration', () => {
    const student = { pseudonym: "Green Student 3", color: "#22c55e" };
    const result = migrateIdentity(student);
    expect(result.pseudonym).toBe("Green Student 3");
  });

  test('parses "Blue Student 2" correctly', () => {
    const student = { pseudonym: "Blue Student 2", color: "#3b82f6" };
    const result = migrateIdentity(student);
    expect(result.identity).toEqual({
      colorName: "Blue",
      color: "#3b82f6",
      emoji: "🌊",
      codename: "Wave",
      sequenceNumber: 2,
    });
  });

  test('no-op when identity already exists', () => {
    const existingIdentity = {
      colorName: "Red",
      color: "#ef4444",
      emoji: "🔥",
      codename: "Ember",
      sequenceNumber: 1,
    };
    const student = {
      pseudonym: "Red Student 1",
      color: "#ef4444",
      identity: existingIdentity,
    };
    const result = migrateIdentity(student);
    expect(result).toBe(student); // same reference — not mutated
    expect(result.identity).toBe(existingIdentity);
  });

  test('handles unparseable pseudonym with color fallback', () => {
    const student = { pseudonym: "Mystery Person", color: "#3b82f6" };
    const result = migrateIdentity(student);
    expect(result.identity.colorName).toBe("Blue");
    expect(result.identity.color).toBe("#3b82f6");
    expect(result.identity.emoji).toBe("🌊");
    expect(result.identity.codename).toBe("Wave");
    expect(result.identity.sequenceNumber).toBe(0);
  });

  test('handles unparseable pseudonym with unknown color', () => {
    const student = { pseudonym: "Mystery Person", color: "#000000" };
    const result = migrateIdentity(student);
    expect(result.identity.colorName).toBe("Unknown");
    expect(result.identity.color).toBe("#000000");
    expect(result.identity.emoji).toBe("🔵");
    expect(result.identity.codename).toBe("Unknown");
    expect(result.identity.sequenceNumber).toBe(0);
  });

  test('handles student with no pseudonym and unknown color', () => {
    const student = { color: "#000000" };
    const result = migrateIdentity(student);
    expect(result.identity.colorName).toBe("Unknown");
    expect(result.identity.sequenceNumber).toBe(0);
  });

  test('returns null inputs as-is', () => {
    expect(migrateIdentity(null)).toBeNull();
  });

  test('returns undefined inputs as-is', () => {
    expect(migrateIdentity(undefined)).toBeUndefined();
  });
});

// ── getColorName ──────────────────────────────────────────────
describe('getColorName', () => {
  test('returns name for known hex', () => {
    expect(getColorName("#ef4444")).toBe("Red");
    expect(getColorName("#f97316")).toBe("Orange");
    expect(getColorName("#3b82f6")).toBe("Blue");
    expect(getColorName("#84cc16")).toBe("Lime");
  });

  test('returns "Unknown" for unknown hex', () => {
    expect(getColorName("#000000")).toBe("Unknown");
    expect(getColorName("#ffffff")).toBe("Unknown");
    expect(getColorName("")).toBe("Unknown");
  });

  test('returns "Unknown" for undefined input', () => {
    expect(getColorName(undefined)).toBe("Unknown");
  });
});
