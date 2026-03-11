import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionSettings, SessionInfo } from "@shared/types/session";

// Re-export types for components
export type { SessionSettings, SessionInfo };

// Local Session type that extends SessionInfo with any renderer-specific fields
export type Session = SessionInfo;

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  removeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,

      setSessions: (sessions) => set({ sessions }),

      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        })),

      updateSession: (sessionId, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        })),

      removeSession: (sessionId) =>
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== sessionId);
          const newActiveId =
            state.activeSessionId === sessionId
              ? newSessions[0]?.id || null
              : state.activeSessionId;
          return { sessions: newSessions, activeSessionId: newActiveId };
        }),

      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),
    }),
    {
      name: "wisecli-sessions",
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);

// Selectors
export const useActiveSession = () => {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  return sessions.find((s) => s.id === activeSessionId) || null;
};
