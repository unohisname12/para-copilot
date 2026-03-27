import { getSidebarVisibility } from '../utils/sidebarVisibility';

describe('getSidebarVisibility — normal mode', () => {
  test('nav is visible when simpleMode is false', () => {
    expect(getSidebarVisibility(false).showNav).toBe(true);
  });

  test('toolbox is visible when simpleMode is false', () => {
    expect(getSidebarVisibility(false).showToolbox).toBe(true);
  });
});

describe('getSidebarVisibility — Simple Mode', () => {
  test('nav is hidden when simpleMode is true', () => {
    expect(getSidebarVisibility(true).showNav).toBe(false);
  });

  test('toolbox is hidden when simpleMode is true', () => {
    expect(getSidebarVisibility(true).showToolbox).toBe(false);
  });
});

describe('getSidebarVisibility — always-visible controls', () => {
  test('essential controls are always visible regardless of mode', () => {
    const simple = getSidebarVisibility(true);
    const normal = getSidebarVisibility(false);

    // These should be true in both modes — the return value signals "always show these"
    expect(simple.showSimpleModeToggle).toBe(true);
    expect(simple.showDate).toBe(true);
    expect(simple.showPeriod).toBe(true);
    expect(simple.showStealth).toBe(true);
    expect(simple.showRoster).toBe(true);

    expect(normal.showSimpleModeToggle).toBe(true);
    expect(normal.showDate).toBe(true);
    expect(normal.showPeriod).toBe(true);
    expect(normal.showStealth).toBe(true);
    expect(normal.showRoster).toBe(true);
  });
});
