import { useState, useRef, useEffect, useCallback } from 'react';
import { DB } from '../data';
import { runLocalEngine } from '../engine';
import { ollamaAskAI, generateTeachingSuggestions, OllamaOfflineError } from '../engine/ollama';
import { buildContextPack, serializeForAI, serializeForSuggestionsPrompt } from '../context/buildContext';

const initMsg = pid => [{
  sender: "app",
  text: `Hi Mr. Dre! Watching ${DB.periods[pid].label} with ${DB.periods[pid].teacher}. Tell me what is happening and I will cross-reference IEPs, Support Cards, and the Situation Engine.`,
}];

export function useChat({
  activePeriod, period,
  effectivePeriodStudents, allStudents,
  logs, knowledgeBase, docContent, currentDate,
  ollamaOnline, setOllamaOnline, ollamaLoading, setOllamaLoading,
  ollamaErrorHandler,
}) {
  const [periodChats, setPeriodChats] = useState({
    p1: initMsg("p1"), p2: initMsg("p2"), p3: initMsg("p3"),
    p4: initMsg("p4"), p5: initMsg("p5"), p6: initMsg("p6"),
  });
  const [masterChat, setMasterChat] = useState([{ sender: "app", text: "Master chat — shows all cross-period AI messages." }]);
  const [chatMode, setChatMode] = useState("period");
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef();

  const currentChat = chatMode === "master" ? masterChat : (periodChats[activePeriod] || []);

  const setCurrentChat = useCallback(updater => {
    if (chatMode === "master") { setMasterChat(updater); }
    else {
      setPeriodChats(prev => ({
        ...prev,
        [activePeriod]: typeof updater === "function" ? updater(prev[activePeriod]) : updater,
      }));
    }
  }, [chatMode, activePeriod]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat, activePeriod]);

  const handleChat = e => {
    e?.preventDefault(); if (!chatInput.trim()) return;
    const userText = chatInput; setChatInput("");
    setCurrentChat(h => [...h, { sender: "user", text: userText }]);
    const result = runLocalEngine(userText, effectivePeriodStudents, knowledgeBase, activePeriod, docContent, period.label, logs, allStudents);
    let kbBlock = "";
    if (result.kbHits.length > 0) {
      kbBlock = "\n\n📚 From your Knowledge Base:";
      result.kbHits.forEach(hit => { kbBlock += `\n[${hit.docTitle}]`; hit.snippets.forEach(s => { kbBlock += `\n  — ${s}`; }); });
    }
    let docBlock = result.docSnippet ? `\n\n📄 From Class Notes 4 Paras:\n${result.docSnippet.slice(0, 200)}${result.docSnippet.length > 200 ? "..." : ""}` : "";
    let notePrompt = result.needsNoteBuilding ? "\n\n📝 No shared doc data for this period yet." : "";
    setCurrentChat(h => [...h, {
      sender: "app", text: result.moves.join("\n") + kbBlock + docBlock + notePrompt,
      actions: result.actions, sources: result.sources, kbHits: result.kbHits, showAI: true,
      originalQuery: userText, followUp: result.followUp, needsNoteBuilding: result.needsNoteBuilding,
      recommendedCards: result.recommendedCards, recommendedTools: result.recommendedTools,
      detectedSituations: result.situations,
    }]);
  };

  const askAI = async (query) => {
    if (!ollamaOnline) {
      setCurrentChat(h => [...h, { sender: "app", text: "Local AI is offline. Start Ollama with: ollama serve\nLocal engine results above are still valid." }]);
      return;
    }
    setAiLoading(true);
    const kbDocs = knowledgeBase.filter(k => k.period === activePeriod || k.period === "all").map(k => `[${k.title}]:\n${k.content.slice(0, 600)}`).join("\n\n");
    const bundledSources = ["📋 IEP database", ...(kbDocs ? [`📚 KB (${knowledgeBase.filter(k => k.period === activePeriod || k.period === "all").length} docs)`] : []), ...(docContent ? ["📄 Class Notes"] : []), ...(logs.length ? ["🗄️ Recent logs"] : [])];
    setCurrentChat(h => [...h, { sender: "app", text: `Local AI reading:\n${bundledSources.join("\n")}`, isBundleNotice: true }]);
    const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, logDaysBack: 7 });
    const userPrompt = serializeForAI(pack, query, kbDocs);
    try {
      const reply = await ollamaAskAI(userPrompt);
      setCurrentChat(h => [...h, { sender: "ai", text: reply, aiSources: bundledSources }]);
      if (chatMode === "period") setMasterChat(h => [...h, { sender: "ai", text: `[${period.label}] ${reply}` }]);
    } catch (err) {
      if (err instanceof OllamaOfflineError) setOllamaOnline(false);
      setCurrentChat(h => [...h, { sender: "app", text: `Local AI error: ${err.message}` }]);
    }
    setAiLoading(false);
  };

  const handleOllamaSuggestions = async (query, detectedSituations) => {
    setOllamaLoading(true);
    try {
      const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, logDaysBack: 7, detectedSituations });
      const result = await generateTeachingSuggestions(serializeForSuggestionsPrompt(pack));
      setCurrentChat(h => [...h, { sender: "ollama", text: result, ollamaFeature: "suggestions" }]);
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: ollamaErrorHandler(err) }]); }
    setOllamaLoading(false);
  };

  return {
    periodChats, masterChat,
    chatMode, setChatMode,
    chatInput, setChatInput,
    currentChat, setCurrentChat,
    aiLoading, chatEndRef,
    handleChat, askAI, handleOllamaSuggestions,
  };
}
