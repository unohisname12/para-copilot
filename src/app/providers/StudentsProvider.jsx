import React, { createContext, useContext } from 'react';
import { useStudents } from '../../hooks/useStudents';

const StudentsContext = createContext(null);

export function StudentsProvider({ activePeriod, children }) {
  const students = useStudents({ activePeriod });
  return <StudentsContext.Provider value={students}>{children}</StudentsContext.Provider>;
}

export function useStudentsContext() {
  const ctx = useContext(StudentsContext);
  if (!ctx) throw new Error('useStudentsContext must be used within StudentsProvider');
  return ctx;
}
