import { useState, useEffect } from 'react';
import { checkOllamaHealth, OllamaOfflineError } from '../engine/ollama';

export function useOllama() {
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [ollamaModel, setOllamaModel] = useState(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  useEffect(() => {
    checkOllamaHealth().then(({ online, model }) => {
      setOllamaOnline(online);
      setOllamaModel(model);
    });
  }, []);

  const ollamaErrorHandler = (err) => {
    if (err instanceof OllamaOfflineError) {
      setOllamaOnline(false);
      return "Local AI is offline. Run: ollama serve";
    }
    return `Local AI error: ${err.message}`;
  };

  return {
    ollamaOnline, setOllamaOnline,
    ollamaModel,
    ollamaLoading, setOllamaLoading,
    ollamaErrorHandler,
  };
}
