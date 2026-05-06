import React, { useEffect, useState } from "react";
import { checkCloudHealth, getCloudApiKey } from "../engine/cloudAI";

const KEY_STORAGE_KEY = 'supapara_gemini_api_key_v1';

export function CloudAIStatusBadge() {
  const [state, setState] = useState(() => (getCloudApiKey() ? 'checking' : 'no_key'));

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!getCloudApiKey()) {
        if (!cancelled) setState('no_key');
        return;
      }
      try {
        const res = await checkCloudHealth();
        if (cancelled) return;
        setState(res && res.online ? 'online' : 'invalid');
      } catch {
        if (!cancelled) setState('invalid');
      }
    };

    run();
    const id = setInterval(run, 60000);
    const onStorage = (e) => { if (e.key === KEY_STORAGE_KEY) run(); };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (state === 'online') {
    return (
      <span title="Gemini API key set and reachable"
        style={{ fontSize: "10px", background: "#052e2b", color: "#34d399",
          padding: "2px 8px", borderRadius: "20px", border: "1px solid #065f46",
          cursor: "default", userSelect: "none" }}>
        AI online
      </span>
    );
  }
  if (state === 'invalid') {
    return (
      <span title="Gemini API key is set but rejected or unreachable"
        style={{ fontSize: "10px", background: "#3f0d12", color: "#f87171",
          padding: "2px 8px", borderRadius: "20px", border: "1px solid #7f1d1d",
          cursor: "default", userSelect: "none" }}>
        AI key invalid
      </span>
    );
  }
  return (
    <span title="No Gemini API key set. Paste a key in Smart Import → Settings."
      style={{ fontSize: "10px", background: "#1e293b", color: "#475569",
        padding: "2px 8px", borderRadius: "20px", border: "1px solid #334155",
        cursor: "default", userSelect: "none" }}>
      AI off
    </span>
  );
}
