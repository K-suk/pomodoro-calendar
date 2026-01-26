import { useState, useCallback } from 'react';

export type BlurtingSessionState = {
  isActive: boolean;
  blurtingText: string;
  startedAt: Date | null;
  endedAt: Date | null;
};

export type UseBlurtingSessionReturn = {
  state: BlurtingSessionState;
  startSession: () => void;
  endSession: () => void;
  updateText: (text: string) => void;
  resetSession: () => void;
  getSessionDuration: () => number; // in seconds
};

export function useBlurtingSession(): UseBlurtingSessionReturn {
  const [state, setState] = useState<BlurtingSessionState>({
    isActive: false,
    blurtingText: '',
    startedAt: null,
    endedAt: null,
  });

  const startSession = useCallback(() => {
    setState({
      isActive: true,
      blurtingText: '',
      startedAt: new Date(),
      endedAt: null,
    });
  }, []);

  const endSession = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      endedAt: new Date(),
    }));
  }, []);

  const updateText = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      blurtingText: text,
    }));
  }, []);

  const resetSession = useCallback(() => {
    setState({
      isActive: false,
      blurtingText: '',
      startedAt: null,
      endedAt: null,
    });
  }, []);

  const getSessionDuration = useCallback(() => {
    if (!state.startedAt) return 0;
    const endTime = state.endedAt ?? new Date();
    return Math.floor((endTime.getTime() - state.startedAt.getTime()) / 1000);
  }, [state.startedAt, state.endedAt]);

  return {
    state,
    startSession,
    endSession,
    updateText,
    resetSession,
    getSessionDuration,
  };
}

// Utility functions
export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export function countCharacters(text: string): number {
  return text.length;
}

export function calculateWordsPerMinute(wordCount: number, durationSeconds: number): number {
  if (durationSeconds === 0) return 0;
  return Math.round((wordCount / durationSeconds) * 60);
}
