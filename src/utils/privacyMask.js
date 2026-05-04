// Typing-time name shield. Returns dotted initials so a passing glance over
// the para's shoulder doesn't expose a real name. Vault and exports are
// intentionally NOT routed through this — privacy mode is a typing-time
// surface only.
export function maskName(name) {
  if (name == null) return '—';
  const trimmed = String(name).trim().replace(/\s+/g, ' ');
  if (!trimmed) return '—';
  const parts = trimmed.split(' ').filter(Boolean);
  if (parts.length === 1) return `${parts[0][0].toUpperCase()}.`;
  const first = parts[0][0].toUpperCase();
  const last = parts[parts.length - 1][0].toUpperCase();
  return `${first}.${last}.`;
}
