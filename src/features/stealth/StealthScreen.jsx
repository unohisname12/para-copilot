// ── Stealth Mode 2.0 ──────────────────────────────────────────
// Decoy landing: looks like the most boring adult thing a kid has ever
// seen ("🔒 TOP SECRET — Adult Stuff Only", dad jokes, mortgage talk).
// Student-safe tools (timer, breathing, etc.) still work below the
// decoy panel so a para can hand the device over for a regulation
// activity. Exit requires a 4-digit PIN if one is set; otherwise it
// exits immediately and the app surfaces a "set a code" toast.

import React, { useState, useMemo } from 'react';
import { hasPin } from './pinStorage';
import { PinEntryModal } from './PinEntryModal';
import { pickJoke, pickBoringTopics, DAD_JOKES } from './dadJokes';

const STUDENT_SAFE_IDS = ['timer', 'breathing', 'grounding', 'calc', 'mult', 'cer'];

export function StealthScreen({ activeTool, toolboxTools, onSelectTool, onExit, onExitWithoutPin }) {
  const tool = toolboxTools.find(t => t.id === activeTool);
  const studentTools = toolboxTools.filter(t => STUDENT_SAFE_IDS.includes(t.id));
  const [jokeIdx, setJokeIdx] = useState(() => Math.floor(Math.random() * DAD_JOKES.length));
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const boringTopics = useMemo(() => pickBoringTopics(6, 42), []);

  const handleDoneClick = () => {
    if (hasPin()) {
      setPinModalOpen(true);
    } else {
      // No PIN — let them exit and surface the "set one now" prompt.
      if (onExitWithoutPin) onExitWithoutPin();
      else if (onExit) onExit();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      background: 'var(--bg-deep, #04080f)',
      display: 'flex', flexDirection: 'column',
      color: 'var(--text-primary)',
    }}>
      {/* Top bar: looks institutional, "TOP SECRET" framing */}
      <div style={{
        padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>📚</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}>
              Classroom Edu
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -2 }}>
              Teacher resources
            </span>
          </div>
        </div>
        <button
          onClick={handleDoneClick}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'var(--bg-dark)', color: 'var(--text-secondary)',
            fontFamily: 'inherit',
          }}
        >
          Done
        </button>
      </div>

      {/* Body: decoy + tools */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: 'clamp(16px, 3vw, 32px)',
        display: 'flex', flexDirection: 'column', gap: 20,
        maxWidth: 760, width: '100%', margin: '0 auto',
      }}>
        {tool ? (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            minHeight: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '100%', maxWidth: 600 }}>{tool.component}</div>
          </div>
        ) : (
          <>
            {/* Dad joke panel */}
            <div style={{
              padding: 'clamp(16px, 3vw, 24px)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                Dad Joke of the Moment
              </div>
              <div style={{
                fontSize: 'clamp(15px, 2.4vw, 18px)', lineHeight: 1.6,
                color: 'var(--text-primary)', fontWeight: 500,
                fontStyle: 'italic',
              }}>
                "{pickJoke(jokeIdx)}"
              </div>
              <button
                type="button"
                onClick={() => setJokeIdx(i => (i + 1) % DAD_JOKES.length)}
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start', fontSize: 11 }}
              >
                🔄 Next joke
              </button>
            </div>

            {/* Boring adult topics decoy */}
            <div style={{
              padding: 'clamp(16px, 3vw, 24px)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                Other extremely boring grown-up things
              </div>
              <ul style={{
                margin: 0, paddingLeft: 20,
                fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)',
              }}>
                {boringTopics.map((t, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{t}</li>
                ))}
              </ul>
            </div>

            {/* Tools row — student-safe activities */}
            <div style={{
              padding: '14px 16px',
              background: 'var(--bg-dark)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                Tools
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {studentTools.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTool(t.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      minHeight: 36,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tool && (
          <button
            onClick={() => onSelectTool(null)}
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'flex-start', fontSize: 12 }}
          >
            ← Back to lame stuff
          </button>
        )}
      </div>

      {pinModalOpen && (
        <PinEntryModal
          mode="verify"
          onSuccess={() => { setPinModalOpen(false); onExit && onExit(); }}
          onCancel={() => setPinModalOpen(false)}
        />
      )}
    </div>
  );
}
