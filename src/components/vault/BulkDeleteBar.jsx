import React from 'react';

export default function BulkDeleteBar({ count, onDelete, onCancel }) {
  if (!count) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk delete actions"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'rgba(232,69,69,.12)',
        borderBottom: '1px solid rgba(232,69,69,.35)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#FCA5A5' }}>
        {count} selected
      </span>
      <button
        onClick={onDelete}
        style={{
          background: '#E84545',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Delete {count}
      </button>
      <button
        onClick={onCancel}
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid rgba(255,255,255,.2)',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
