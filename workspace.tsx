"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface WorkspaceState {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  currentProspectId: string | null;
  setCurrentProspectId: (id: string | null) => void;
  assistantOpen: boolean;
  openAssistant: (prefill?: string) => void;
  closeAssistant: () => void;
  assistantPrefill: string | null;
  consumePrefill: () => string | null;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentProspectId, setCurrentProspectId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrefill, setAssistantPrefill] = useState<string | null>(null);

  const openAssistant = useCallback((prefill?: string) => {
    if (prefill) setAssistantPrefill(prefill);
    setAssistantOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const consumePrefill = useCallback(() => {
    const value = assistantPrefill;
    setAssistantPrefill(null);
    return value;
  }, [assistantPrefill]);

  const value = useMemo(
    () => ({ selectedIds, setSelectedIds, currentProspectId, setCurrentProspectId, assistantOpen, openAssistant, closeAssistant, assistantPrefill, consumePrefill }),
    [selectedIds, currentProspectId, assistantOpen, openAssistant, closeAssistant, assistantPrefill, consumePrefill],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace doit être utilisé dans WorkspaceProvider");
  return context;
}

/** Déclare le prospect affiché (pour « ce prospect » dans Nova AI). */
export function CurrentProspect({ id }: { id: string }) {
  const { setCurrentProspectId } = useWorkspace();
  useEffect(() => {
    setCurrentProspectId(id);
    return () => setCurrentProspectId(null);
  }, [id, setCurrentProspectId]);
  return null;
}
