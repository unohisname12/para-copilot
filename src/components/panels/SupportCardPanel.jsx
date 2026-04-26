import React, { useState, useMemo } from "react";
import { SUPPORT_CARDS } from '../../data';

// Plain-English support cards. The para opens these mid-class to
// remember "okay, what do I actually do for [situation]?" — needs to
// be skimmable in 5 seconds. Three things matter here:
//   1. Find the right card fast (search + category chips)
//   2. Read the steps without squinting (proper hierarchy + spacing)
//   3. Know what NOT to do (red section is load-bearing)

const CATEGORY_META = {
  all:        { label: 'All',         icon: '📋', tone: 'var(--accent)' },
  behavior:   { label: 'Behavior',    icon: '🔴', tone: 'var(--red)' },
  academic:   { label: 'Academic',    icon: '📚', tone: 'var(--violet)' },
  regulation: { label: 'Regulation',  icon: '🌊', tone: 'var(--cyan)' },
  transition: { label: 'Transition',  icon: '🔔', tone: 'var(--yellow)' },
};

function iconForCategory(cat) {
  return CATEGORY_META[cat]?.icon || '📋';
}
function toneForCategory(cat) {
  return CATEGORY_META[cat]?.tone || 'var(--accent)';
}

export function SupportCardPanel({ cards }) {
  const list = cards && cards.length > 0 ? cards : SUPPORT_CARDS;
  const [selectedId, setSelectedId] = useState(list[0]?.id || null);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');

  const categories = useMemo(() => {
    const set = new Set(list.map(c => c.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(c => {
      if (filter !== 'all' && c.category !== filter) return false;
      if (!q) return true;
      const hay = [
        c.title, c.whenToUse,
        ...(c.studentTypes || []),
        ...(c.tags || []),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [list, search, filter]);

  const selected = filtered.find(c => c.id === selectedId) || filtered[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Search + category chips */}
      <div style={{
        padding: 'var(--space-3) var(--space-3) var(--space-2)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
        flexShrink: 0,
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔎 Search by situation, tag, or student type"
          className="chat-input"
          style={{ minHeight: 32, fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const active = filter === cat;
            const meta = CATEGORY_META[cat] || { label: cat, icon: '·', tone: 'var(--accent)' };
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${active ? meta.tone : 'var(--border)'}`,
                  background: active ? `${meta.tone}22` : 'transparent',
                  color: active ? meta.tone : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 120ms var(--ease-out)',
                }}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card list */}
      <div style={{
        padding: 'var(--space-2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 4,
        maxHeight: 200,
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        {filtered.length === 0 && (
          <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No cards match. Try a different search or category.
          </div>
        )}
        {filtered.map(c => {
          const active = selected?.id === c.id;
          const tone = toneForCategory(c.category);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${active ? tone : 'var(--border)'}`,
                background: active ? `${tone}1a` : 'var(--bg-dark)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
                fontFamily: 'inherit',
                transition: 'all 120ms var(--ease-out)',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.1 }}>{iconForCategory(c.category)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? tone : 'var(--text-primary)' }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.whenToUse}
                </div>
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected card detail */}
      {selected ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-4) var(--space-5)' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: 'var(--radius-md)',
              background: `${toneForCategory(selected.category)}22`,
              border: `1px solid ${toneForCategory(selected.category)}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              {iconForCategory(selected.category)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {selected.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>When: </span>
                {selected.whenToUse}
              </div>
            </div>
          </div>

          {/* Student types */}
          {selected.studentTypes?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              {selected.studentTypes.map(t => (
                <span key={t} className="pill pill-accent" style={{ fontSize: 10 }}>
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Three sections, color-coded */}
          <CardSection title="Steps" items={selected.steps} icon="✓" tone="var(--green)" />
          <CardSection title="What to say" items={selected.whatToSay} icon="💬" tone="var(--accent-hover)" />
          <CardSection title="What to avoid" items={selected.whatToAvoid} icon="⛔" tone="var(--red)" />

          {/* Accommodations */}
          {selected.accommodations?.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 'var(--space-2)',
              }}>
                Related accommodations
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {selected.accommodations.map(a => (
                  <span key={a} className="pill pill-green" style={{ fontSize: 10.5 }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Pick a card to see the steps.
        </div>
      )}
    </div>
  );
}

// ── Color-coded body section ─────────────────────────────────
function CardSection({ title, items, icon, tone }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      marginBottom: 'var(--space-3)',
      padding: 'var(--space-3)',
      background: 'var(--bg-surface)',
      borderLeft: `3px solid ${tone}`,
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700,
        color: tone,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 'var(--space-2)',
      }}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <ul style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
      }}>
        {items.map((s, i) => (
          <li key={i} style={{
            fontSize: 13, color: 'var(--text-primary)',
            lineHeight: 1.55,
            display: 'flex', gap: 8,
          }}>
            <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
