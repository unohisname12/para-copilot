import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StealthScreen } from '../features/stealth/StealthScreen';
import { setPin, clearPin } from '../features/stealth/pinStorage';

beforeEach(() => {
  globalThis.localStorage.clear();
});
afterEach(() => clearPin());

const FAKE_TOOLS = [
  { id: 'timer', label: '⏱️ Timer', component: <div>Timer Tool</div> },
  { id: 'breathing', label: '🫁 Breathing', component: <div>Breathing Tool</div> },
  { id: 'goals', label: '🎯 Goal Tracker', component: <div>Goal Tracker (NOT student-safe)</div> },
];

describe('StealthScreen', () => {
  test('renders the Classroom Edu decoy header', () => {
    render(<StealthScreen
      activeTool={null}
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={() => {}}
    />);
    expect(screen.getByText(/classroom edu/i)).toBeTruthy();
    expect(screen.getByText(/teacher resources/i)).toBeTruthy();
  });

  test('renders a dad joke and "next joke" button', () => {
    render(<StealthScreen
      activeTool={null}
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={() => {}}
    />);
    expect(screen.getByText(/dad joke/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /next joke/i })).toBeTruthy();
  });

  test('renders only student-safe tools (no goals tracker etc.)', () => {
    render(<StealthScreen
      activeTool={null}
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={() => {}}
    />);
    expect(screen.getByText('⏱️ Timer')).toBeTruthy();
    expect(screen.getByText('🫁 Breathing')).toBeTruthy();
    // Goal Tracker is NOT in the studentSafe allowlist — must not appear.
    expect(screen.queryByText('🎯 Goal Tracker')).toBeNull();
  });

  test('Done button calls onExit directly when no PIN is set', () => {
    const onExit = jest.fn();
    const onExitWithoutPin = jest.fn();
    render(<StealthScreen
      activeTool={null}
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={onExit}
      onExitWithoutPin={onExitWithoutPin}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // No PIN → uses onExitWithoutPin path (not onExit)
    expect(onExitWithoutPin).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  test('Done button opens PIN modal when PIN is set', async () => {
    await setPin('1234');
    const onExit = jest.fn();
    render(<StealthScreen
      activeTool={null}
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={onExit}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // PIN modal title or PIN inputs become visible
    expect(screen.getByLabelText('PIN digit 1')).toBeTruthy();
    // onExit not yet called
    expect(onExit).not.toHaveBeenCalled();
  });

  test('renders selected tool component when activeTool is set', () => {
    render(<StealthScreen
      activeTool="timer"
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={() => {}}
    />);
    expect(screen.getByText('Timer Tool')).toBeTruthy();
  });

  test('does NOT leak para identity (no email, no name, no team) into DOM', () => {
    render(<StealthScreen
      activeTool={null}
      toolboxTools={FAKE_TOOLS}
      onSelectTool={() => {}}
      onExit={() => {}}
    />);
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/@/);            // no email
    expect(html).not.toMatch(/Deandre/i);     // no para name
    expect(html).not.toMatch(/Fairview/i);    // no team / school name
  });
});
