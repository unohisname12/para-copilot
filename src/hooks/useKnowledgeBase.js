import { useState, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { configurePdfWorker } from '../utils/pdfWorker';

export function useKnowledgeBase({ currentDate, activePeriod }) {
  const [knowledgeBase, setKnowledgeBase] = useLocalStorage('paraKBV1', []);
  const [kbInput, setKbInput] = useState("");
  const [kbTitle, setKbTitle] = useState("");
  const [kbDocType, setKbDocType] = useState("Teaching Strategy");
  const [kbUploading, setKbUploading] = useState(false);
  const fileInputRef = useRef();

  const addToKB = scope => {
    if (!kbTitle.trim() || !kbInput.trim()) return;
    setKnowledgeBase(prev => [...prev, {
      id: Date.now(), title: kbTitle, content: kbInput,
      docType: kbDocType, period: scope, date: currentDate, source: "text",
    }]);
    setKbTitle(""); setKbInput("");
    alert(`Added "${kbTitle}" to KB.`);
  };

  const handleFileUpload = async (e, scope) => {
    const file = e.target.files[0]; if (!file) return; setKbUploading(true);
    try {
      let text = "";
	      if (file.type === "application/pdf") {
	        try {
	          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
	          configurePdfWorker(pdfjsLib);
	          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
          }
        } catch {
          alert("Could not extract PDF text. Try a .txt file instead.");
          setKbUploading(false); e.target.value = ""; return;
        }
      } else {
        text = await file.text();
      }
      setKnowledgeBase(prev => [...prev, {
        id: Date.now(), title: kbTitle.trim() || file.name.replace(/\.\w+$/, ""),
        content: text, docType: kbDocType, period: scope, date: currentDate,
        source: file.type === "application/pdf" ? "pdf" : "file", fileName: file.name,
      }]);
      setKbTitle("");
    } catch { alert("Could not read file."); }
    setKbUploading(false); e.target.value = "";
  };

  return {
    knowledgeBase, setKnowledgeBase,
    kbInput, setKbInput, kbTitle, setKbTitle,
    kbDocType, setKbDocType, kbUploading,
    fileInputRef,
    addToKB, handleFileUpload,
  };
}
