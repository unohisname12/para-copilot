import React from 'react';
import { useEscape } from '../hooks/useEscape';
import { useVault } from '../context/VaultProvider';
import { useTeamOptional } from '../context/TeamProvider';
import { useGrammarFixSetting } from '../hooks/useAutoGrammarFix';
import { ONBOARDING_KEY } from './OnboardingModal';
import { hasPin, clearPin } from '../features/stealth/pinStorage';
import { PinEntryModal } from '../features/stealth/PinEntryModal';

// One place for everything a user can turn on/off. Lives behind the
// ⚙️ Settings button in the sidebar. No deep menus — flat list of
// sections: Display / Help / Account / Danger zone.
//
// Banner-hidden + onboarding state live in localStorage so they
// persist across sessions. Vault-related toggles delegate to the
// existing VaultProvider (single source of truth).

const BANNER_HIDDEN_KEY = 'supapara_hideFindStudentsBanner_v1';

export function isFindStudentsBannerHidden() {
  try { return localStorage.getItem(BANNER_HIDDEN_KEY) === '1'; }
  catch { return false; }
}

export function setFindStudentsBannerHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(BANNER_HIDDEN_KEY, '1');
    else        localStorage.removeItem(BANNER_HIDDEN_KEY);
  } catch {}
}

export default function SettingsModal({ open, onClose, onReplayOnboarding }) {
  const vault = useVault();
  const team  = useTeamOptional();

  // Local mirror so the toggle reflects the localStorage value.
  const [bannerHidden, setBannerHidden] = React.useState(() => isFindStudentsBannerHidden());
  const [pinExists, setPinExists] = React.useState(() => hasPin());
  const [pinModal, setPinModal] = React.useState(false);

  useEscape(open ? onClose : () => {});
  if (!open) return null;

  function toggleBanner() {
    const next = !bannerHidden;
    setBannerHidden(next);
    setFindStudentsBannerHidden(next);
  }

  function replayOnboarding() {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch {}
    onClose?.();
    if (onReplayOnboarding) setTimeout(onReplayOnboarding, 200);
  }

  async function handleSignOut() {
    if (!window.confirm('Sign out of SupaPara on this computer?\n\nYou\'ll need to sign in again next time. Local data (real names, notes you made) stays on this device.')) return;
    try { await team?.signOut?.(); } catch (e) { alert(e.message); }
    onClose?.();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 560, width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={hat}>Settings</div>
            <div style={title}>Options</div>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* EDITOR */}
          <Section label="Editor">
            <GrammarFixToggle />
          </Section>

          {/* DISPLAY */}
          <Section label="Display">
            <Toggle
              icon="🎯"
              title="Show 'Find my students' banner"
              body="The blue banner on the Dashboard that reminds you to load your name list. Sidebar button still works either way."
              on={!bannerHidden}
              onChange={toggleBanner}
            />
            {vault?.hasVault && (
              <Toggle
                icon="👤"
                title="Show real names"
                body="When on, students show by name. When off, they show by their 6-digit Para App Number. Either way, names stay on this computer only."
                on={!!vault.showRealNames}
                onChange={vault.toggleShowRealNames}
              />
            )}
            {vault?.hasVault && (
              <Toggle
                icon="💾"
                title="Remember names on this device"
                body={vault.persisted
                  ? `Names auto-load every session. Auto-wipes after ${vault.inactivityDays || 14} days of inactivity.`
                  : "When on, names stick around between browser sessions so you don't have to re-upload daily. Real names still never leave this computer."
                }
                on={!!vault.persisted}
                onChange={vault.persisted
                  ? () => {
                      if (window.confirm('Stop remembering real names on this device?\n\nYou\'ll need to re-upload your name list next session.')) vault.purgeVault?.();
                    }
                  : () => vault.requestEnablePersistence?.()
                }
              />
            )}
          </Section>

          {/* STEALTH PIN */}
          <Section label="Stealth screen PIN">
            <ActionRow
              icon="🔒"
              title={pinExists ? 'Change your stealth code' : 'Set a stealth code'}
              body={pinExists
                ? 'A 4-digit code is set on this device. Tap to change it.'
                : 'No code set yet. A code keeps a curious kid from sneaking back to the real app from Stealth Mode.'}
              onClick={() => setPinModal(true)}
              actionLabel={pinExists ? 'Change' : 'Set'}
            />
            {pinExists && (
              <ActionRow
                icon="🗑"
                title="Forget my stealth code — I'll set a new one"
                body="Removes the code from this device. Stealth Mode will exit without prompting until you set a new code."
                onClick={() => {
                  if (window.confirm('Forget the stealth code on this device?')) {
                    clearPin();
                    setPinExists(false);
                  }
                }}
                actionLabel="Forget"
                danger
              />
            )}
          </Section>

          {/* HELP */}
          <Section label="Help">
            <ActionRow
              icon="📖"
              title="Replay the welcome tour"
              body="The 5-slide intro that ran when you first signed in."
              onClick={replayOnboarding}
              actionLabel="Show me"
            />
          </Section>

          {/* ACCOUNT */}
          {team?.session && (
            <Section label="Account">
              <ActionRow
                icon="👋"
                title="Sign out"
                body={team.user?.email ? `Signed in as ${team.user.email}.` : 'Sign out on this computer.'}
                onClick={handleSignOut}
                actionLabel="Sign out"
                danger
              />
            </Section>
          )}
        </div>

        <div className="modal-footer">
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Real names always stay on this computer. The cloud only sees 6-digit Para App Numbers.
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ minHeight: 40 }}>
            Done
          </button>
        </div>

        {pinModal && (
          <PinEntryModal
            mode="set"
            title={pinExists ? 'Change your stealth code' : 'Set your stealth code'}
            onSuccess={() => { setPinExists(true); setPinModal(false); }}
            onCancel={() => setPinModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// Wraps the global "Auto-cleanup typing" toggle. Reading + writing goes
// through useGrammarFixSetting so the same value drives every textarea
// across the app (Dashboard topic, Simple Mode, Handoff Builder, etc.).
function GrammarFixToggle() {
  const [enabled, setEnabled] = useGrammarFixSetting();
  return (
    <Toggle
      icon="✨"
      title="Auto-cleanup typing"
      body="Lightly fixes capitalization and double spaces 1.5s after you stop typing. Cursor stays put. Applies to every place you log notes (dashboard, Simple Mode, handoffs, parent notes)."
      on={!!enabled}
      onChange={() => setEnabled(!enabled)}
    />
  );
}

// ── building blocks ─────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 'var(--space-2)',
      }}>{label}</div>
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: 1,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ icon, title, body, on, onChange }) {
  return (
    <label style={rowStyle}>
      <div style={iconBox}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitle}>{title}</div>
        <div style={rowBody}>{body}</div>
      </div>
      <Switch on={on} onChange={onChange} />
    </label>
  );
}

function ActionRow({ icon, title, body, onClick, actionLabel, danger = false }) {
  return (
    <div style={rowStyle}>
      <div style={iconBox}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitle}>{title}</div>
        <div style={rowBody}>{body}</div>
      </div>
      <button
        onClick={onClick}
        className={danger ? 'btn btn-secondary btn-sm' : 'btn btn-secondary btn-sm'}
        style={danger ? { color: 'var(--red)', borderColor: 'rgba(239,68,68,0.4)' } : null}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Switch({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 40, height: 22,
        borderRadius: 11,
        background: on ? 'var(--accent-strong)' : 'var(--bg-dark)',
        border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        left: on ? 20 : 2, top: 1,
        width: 16, height: 16,
        borderRadius: 8,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        transition: 'left 160ms cubic-bezier(0.16,1,0.3,1)',
      }} />
    </button>
  );
}

// ── styles ───────────────────────────────────────────────────

const hat   = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' };
const title = { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginTop: 2 };

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--panel-bg)',
  cursor: 'default',
};
const iconBox = {
  width: 36, height: 36,
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-dark)',
  border: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, flexShrink: 0,
};
const rowTitle = { fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' };
const rowBody  = { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 };
