import React, { createContext, useContext } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useTeamOptional } from '../../context/TeamProvider';

const StudentsContext = createContext(null);

export function StudentsProvider({ activePeriod, children }) {
  const team = useTeamOptional();
  const cloudStudents = team?.activeTeamId ? (team.teamStudents || []) : null;
  const students = useStudents({ activePeriod, cloudStudents });
  return <StudentsContext.Provider value={students}>{children}</StudentsContext.Provider>;
}

export function useStudentsContext() {
  const ctx = useContext(StudentsContext);
  if (!ctx) throw new Error('useStudentsContext must be used within StudentsProvider');
  return ctx;
}
