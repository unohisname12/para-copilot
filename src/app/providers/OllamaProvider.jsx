import React, { createContext, useContext } from 'react';
import { useOllama } from '../../hooks/useOllama';

const OllamaContext = createContext(null);

export function OllamaProvider({ children }) {
  const ollama = useOllama();
  return <OllamaContext.Provider value={ollama}>{children}</OllamaContext.Provider>;
}

export function useOllamaContext() {
  const ctx = useContext(OllamaContext);
  if (!ctx) throw new Error('useOllamaContext must be used within OllamaProvider');
  return ctx;
}
