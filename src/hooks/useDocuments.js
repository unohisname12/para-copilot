import { useState } from 'react';

export function useDocuments() {
  const [docLink, setDocLink] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [docId, setDocId] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [showNoteDraft, setShowNoteDraft] = useState(false);
  const [docPushStatus, setDocPushStatus] = useState("");

  return {
    docLink, setDocLink,
    docContent, setDocContent,
    docLoading, setDocLoading,
    docId, setDocId,
    noteDraft, setNoteDraft,
    showNoteDraft, setShowNoteDraft,
    docPushStatus, setDocPushStatus,
  };
}
