import { useState } from 'react';
import { ollamaDraftEmail, summarizeStudentPatterns, generateHandoffNote, OllamaOfflineError } from '../engine/ollama';
import { buildContextPack, serializeForPatternPrompt, serializeForHandoffPrompt, serializeForEmailPrompt } from '../context/buildContext';

export function useOllamaInsights({
  effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate,
  ollamaOnline, setOllamaOnline, ollamaLoading, setOllamaLoading, ollamaErrorHandler,
  setCurrentChat,
}) {
  const [ollamaModal, setOllamaModal] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const handleOllamaPatternSummary = async (studentId) => {
    setOllamaLoading(true);
    try {
      const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, focusStudentId: studentId, logDaysBack: 14 });
      const result = await summarizeStudentPatterns(serializeForPatternPrompt(pack));
      setOllamaModal({ feature: "patterns", text: result, studentId });
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: ollamaErrorHandler(err) }]); }
    setOllamaLoading(false);
  };

  const handleOllamaHandoff = async (studentId, audience, urgency) => {
    setOllamaLoading(true);
    try {
      const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, focusStudentId: studentId, logDaysBack: 1, handoffAudience: audience, handoffUrgency: urgency });
      const result = await generateHandoffNote(serializeForHandoffPrompt(pack));
      setOllamaLoading(false);
      return result;
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: ollamaErrorHandler(err) }]); setOllamaLoading(false); return null; }
  };

  const draftEmail = async studentId => {
    setEmailDraft(""); setEmailModal({ studentId }); setEmailLoading(true);
    const s = allStudents[studentId];
    const stuLogs = logs.filter(l => l.studentId === studentId).slice(0, 5);
    const prompt = serializeForEmailPrompt(s, stuLogs);
    try {
      const draft = await ollamaDraftEmail(prompt);
      setEmailDraft(draft);
    } catch (err) {
      if (err instanceof OllamaOfflineError) setOllamaOnline(false);
      setEmailDraft("Local AI is offline. Start Ollama with: ollama serve");
    }
    setEmailLoading(false);
  };

  return {
    ollamaModal, setOllamaModal,
    emailModal, setEmailModal, emailDraft, setEmailDraft, emailLoading,
    handleOllamaPatternSummary, handleOllamaHandoff, draftEmail,
  };
}
