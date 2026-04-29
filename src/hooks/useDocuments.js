import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useDocuments() {
  // docLink + docContent persist across reloads — once a para fetches their
  // class notes from a Google Doc, they shouldn't have to re-paste the URL or
  // re-fetch on every refresh. Stays local; never syncs to the cloud.
  const [docLink, setDocLink] = useLocalStorage('paraDocLinkV1', '');
  const [docContent, setDocContent] = useLocalStorage('paraDocContentV1', '');

  // Ephemeral UI state — fine as plain useState
  const [docLoading, setDocLoading] = useState(false);
  const [docId, setDocId] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [showNoteDraft, setShowNoteDraft] = useState(false);
  const [docPushStatus, setDocPushStatus] = useState('');

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
