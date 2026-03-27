// ── getSidebarVisibility ──────────────────────────────────────
// Returns a map of which sidebar sections should render.
// Essential controls (toggle, date, period, stealth, roster) are
// always visible. Nav and toolbox are hidden in Simple Mode to
// reduce cognitive load for paras.
export function getSidebarVisibility(simpleMode) {
  return {
    showSimpleModeToggle: true,
    showDate:             true,
    showPeriod:           true,
    showStealth:          true,
    showRoster:           true,
    showNav:              !simpleMode,
    showToolbox:          !simpleMode,
  };
}
