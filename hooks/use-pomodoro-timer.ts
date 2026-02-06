import { useState, useCallback, useRef, useEffect } from 'react';

export type PomodoroPhase = 'idle' | 'input' | 'output' | 'break' | 'completed';

export type PomodoroState = {
  phase: PomodoroPhase;
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  inputDuration: number; // minutes
  outputDuration: number; // minutes
  breakDuration: number; // minutes
};

// Storage key for persisting timer state
const TIMER_STORAGE_KEY = 'pomodoro_timer_state';
const ACTIVE_POMODORO_KEY = 'pomodoro_active_event_id';

type StoredTimerState = {
  phase: PomodoroPhase;
  startTime: number; // timestamp when timer started
  totalSeconds: number;
  inputDuration: number;
  outputDuration: number;
  breakDuration: number;
  eventId?: string; // to identify which event this timer is for
  customInputDuration?: number;
  customOutputDuration?: number;
};

export type UsePomodoroTimerReturn = {
  state: PomodoroState;
  start: (customInputDuration?: number, customOutputDuration?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skipToOutput: () => void;
  skipToBreak: () => void;
  // Debug functions (remove later)
  debugSkip1Min: () => void;
  debugSkip10Min: () => void;
};

export function usePomodoroTimer(
  inputDuration: number = 25,
  outputDuration: number = 5,
  onPhaseChange?: (phase: PomodoroPhase) => void,
  eventId?: string // Optional event ID for persistence
): UsePomodoroTimerReturn {
  // Resolve eventId: use passed value, or fallback to globally stored active event ID
  const resolvedEventId = eventId ?? (typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_POMODORO_KEY) ?? undefined : undefined);

  // Synchronously load persisted state on initialization
  const [storedState, setStoredState] = useState<StoredTimerState | null>(() => {
    if (!resolvedEventId || typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(`${TIMER_STORAGE_KEY}_${resolvedEventId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredTimerState;
        const now = Date.now();
        const elapsed = Math.floor((now - parsed.startTime) / 1000);
        
        if (elapsed < parsed.totalSeconds) {
          return parsed;
        } else {
          // Timer expired, clear storage
          localStorage.removeItem(`${TIMER_STORAGE_KEY}_${resolvedEventId}`);
          localStorage.removeItem(ACTIVE_POMODORO_KEY);
          return null;
        }
      }
    } catch (error) {
      console.error('Failed to load timer state:', error);
    }
    return null;
  });

  const startTimeRef = useRef<number | null>(storedState ? storedState.startTime : null);
  const phaseStartTimeRef = useRef<number | null>(storedState ? storedState.startTime : null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  // Calculate remaining seconds based on start time
  const calculateRemaining = useCallback((stored: StoredTimerState | null): number => {
    if (!stored || !phaseStartTimeRef.current) {
      return inputDuration * 60;
    }
    
    const now = Date.now();
    const elapsed = Math.floor((now - phaseStartTimeRef.current) / 1000);
    const remaining = stored.totalSeconds - elapsed;
    
    return Math.max(0, remaining);
  }, [inputDuration]);

  // Initialize state from stored state or defaults
  const getInitialState = useCallback((): PomodoroState => {
    if (storedState) {
      const remaining = calculateRemaining(storedState);
      return {
        phase: storedState.phase,
        remainingSeconds: remaining,
        totalSeconds: storedState.totalSeconds,
        isRunning: remaining > 0,
        inputDuration: storedState.inputDuration,
        outputDuration: storedState.outputDuration,
        breakDuration: storedState.breakDuration || 5,
      };
    }
    
    return {
      phase: 'idle',
      remainingSeconds: inputDuration * 60,
      totalSeconds: inputDuration * 60,
      isRunning: false,
      inputDuration,
      outputDuration,
      breakDuration: 5, // Default break duration
    };
  }, [storedState, inputDuration, outputDuration, calculateRemaining]);

  const [state, setState] = useState<PomodoroState>(getInitialState);

  // Update state when stored state changes
  useEffect(() => {
    if (storedState) {
      const newState = getInitialState();
      setState(newState);
    }
  }, [storedState, getInitialState]);

  // Save state to localStorage
  const saveState = useCallback((
    phase: PomodoroPhase, 
    totalSeconds: number, 
    startTime: number,
    customInputDuration?: number,
    customOutputDuration?: number
  ) => {
    const targetEventId = eventId ?? resolvedEventId;
    const actualInputDuration = customInputDuration ?? inputDuration;
    const actualOutputDuration = customOutputDuration ?? outputDuration;
    const actualBreakDuration = 5; // Fixed for now

    if (targetEventId && typeof window !== 'undefined') {
      const stateToSave: StoredTimerState = {
        phase,
        startTime,
        totalSeconds,
        inputDuration: actualInputDuration,
        outputDuration: actualOutputDuration,
        breakDuration: actualBreakDuration,
        eventId: targetEventId,
      };
      try {
        localStorage.setItem(`${TIMER_STORAGE_KEY}_${targetEventId}`, JSON.stringify(stateToSave));
        localStorage.setItem(ACTIVE_POMODORO_KEY, targetEventId); // Store globally
        setStoredState(stateToSave);
      } catch (error) {
        console.error('Failed to save timer state:', error);
      }
    }
  }, [eventId, resolvedEventId, inputDuration, outputDuration]);

  // Clear saved state
  const clearSavedState = useCallback(() => {
    const targetEventId = eventId ?? resolvedEventId;
    if (targetEventId && typeof window !== 'undefined') {
      localStorage.removeItem(`${TIMER_STORAGE_KEY}_${targetEventId}`);
      localStorage.removeItem(ACTIVE_POMODORO_KEY); // Clear global key
      setStoredState(null);
      startTimeRef.current = null;
      phaseStartTimeRef.current = null;
    }
  }, [eventId, resolvedEventId]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Update timer based on elapsed time from start
  const updateTimer = useCallback(() => {
    if (!storedState || !phaseStartTimeRef.current) {
      return;
    }

    const now = Date.now();
    const elapsed = Math.floor((now - phaseStartTimeRef.current) / 1000);
    const remaining = storedState.totalSeconds - elapsed;

    if (remaining <= 0) {
      // Phase transition
      if (storedState.phase === 'input') {
        // Check if there's a blurting/output phase
        if (storedState.outputDuration > 0) {
          const outputSeconds = storedState.outputDuration * 60;
          const newStartTime = now;
          phaseStartTimeRef.current = newStartTime;
          // IMPORTANT: Pass the stored durations to ensure we don't accidentally overwrite them with stale hook props
          saveState(
            'output', 
            outputSeconds, 
            startTimeRef.current || newStartTime, 
            storedState.inputDuration, 
            storedState.outputDuration
          );
          onPhaseChangeRef.current?.('output');
          setState((prev) => ({
            ...prev,
            phase: 'output',
            remainingSeconds: outputSeconds,
            totalSeconds: outputSeconds,
            isRunning: true, // Timer runs during blurting phase
          }));
        } else {
          // No output phase, go to break directly
          const breakSeconds = (storedState.breakDuration || 5) * 60;
          const newStartTime = now;
          phaseStartTimeRef.current = newStartTime;
          saveState(
            'break',
            breakSeconds,
            startTimeRef.current || newStartTime,
            storedState.inputDuration,
            storedState.outputDuration
          );
          onPhaseChangeRef.current?.('break');
          setState((prev) => ({
            ...prev,
            phase: 'break',
            remainingSeconds: breakSeconds,
            totalSeconds: breakSeconds,
            isRunning: true,
          }));
        }
      } else if (storedState.phase === 'output') {
        // Output done, go to break
        const breakSeconds = (storedState.breakDuration || 5) * 60;
        const newStartTime = now;
        phaseStartTimeRef.current = newStartTime;
        saveState(
          'break',
          breakSeconds,
          startTimeRef.current || newStartTime,
          storedState.inputDuration,
          storedState.outputDuration
        );
        onPhaseChangeRef.current?.('break');
        setState((prev) => ({
          ...prev,
          phase: 'break',
          remainingSeconds: breakSeconds,
          totalSeconds: breakSeconds,
          isRunning: true,
        }));
      } else if (storedState.phase === 'break') {
        // Break done, complete (or handle sets later)
        clearTimer();
        clearSavedState();
        onPhaseChangeRef.current?.('completed');
        setState((prev) => ({
          ...prev,
          phase: 'completed',
          remainingSeconds: 0,
          isRunning: false,
        }));
      }
    } else {
      setState((prev) => ({
        ...prev,
        remainingSeconds: remaining,
        isRunning: true,
      }));
    }
  }, [storedState, saveState, clearTimer, clearSavedState]);

  const tick = useCallback(() => {
    updateTimer();
  }, [updateTimer]);

  // Use a ref to always have the latest tick function in the interval
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // Centralized interval management
  useEffect(() => {
    if (!state.isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Always ensure a fresh interval if we should be running
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        tickRef.current();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning]);

  const start = useCallback((customInputDuration?: number, customOutputDuration?: number) => {
    const actualInputDuration = customInputDuration ?? inputDuration;
    const actualOutputDuration = customOutputDuration ?? outputDuration;
    const inputSeconds = actualInputDuration * 60;
    const now = Date.now();
    startTimeRef.current = now;
    phaseStartTimeRef.current = now;
    
    // Pass the actual durations to saveState to ensure correct values are persisted
    saveState('input', inputSeconds, now, actualInputDuration, actualOutputDuration);
    
    setState({
      phase: 'input',
      remainingSeconds: inputSeconds,
      totalSeconds: inputSeconds,
      isRunning: true,
      inputDuration: actualInputDuration,
      outputDuration: actualOutputDuration,
      breakDuration: 5,
    });
    onPhaseChangeRef.current?.('input');
  }, [inputDuration, outputDuration, saveState]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
    // Note: interval will be cleared by the useEffect monitoring state.isRunning
  }, []);

  const resume = useCallback(() => {
    if (!storedState || storedState.phase === 'idle' || storedState.phase === 'completed') return;
    
    // Calculate new start time based on remaining seconds in state
    // We want: now + remaining = finish time
    // So: start = now - (total - remaining)
    const now = Date.now();
    const elapsedReal = state.totalSeconds - state.remainingSeconds;
    const newStartTime = now - (elapsedReal * 1000);
    
    phaseStartTimeRef.current = newStartTime;
    startTimeRef.current = newStartTime;
    
    // Save state to persist the pause adjustment
    saveState(
      storedState.phase, 
      storedState.totalSeconds, 
      newStartTime, 
      storedState.inputDuration, 
      storedState.outputDuration
    );
    
    setState((prev) => ({ ...prev, isRunning: true }));
  }, [storedState, state.totalSeconds, state.remainingSeconds, saveState]);

  const reset = useCallback(() => {
    clearSavedState();
    setState({
      phase: 'idle',
      remainingSeconds: inputDuration * 60,
      totalSeconds: inputDuration * 60,
      isRunning: false,
      inputDuration,
      outputDuration,
      breakDuration: 5,
    });
  }, [inputDuration, outputDuration, clearSavedState]);

  const skipToOutput = useCallback(() => {
    if (!storedState || storedState.phase !== 'input') return;

    // Logic: Skip Input. If output > 0, go to output. Else go to break.
    // For now, let's just use existing skipToOutput logic but respect 0 duration?
    // Actually if outputDuration is 0, we should skip to BREAK.
    
    if (outputDuration > 0) {
      const outputSeconds = outputDuration * 60;
      const now = Date.now();
      phaseStartTimeRef.current = now;
      
      saveState('output', outputSeconds, startTimeRef.current || now);
      
      setState((prev) => ({
        ...prev,
        phase: 'output',
        remainingSeconds: outputSeconds,
        totalSeconds: outputSeconds,
        isRunning: true,
      }));
      onPhaseChangeRef.current?.('output');
    } else {
      // Go to Break
      skipToBreak();
    }
  }, [storedState, outputDuration, saveState]);

  const skipToBreak = useCallback(() => {
    const breakSeconds = 5 * 60;
    const now = Date.now();
    phaseStartTimeRef.current = now;
    
    saveState('break', breakSeconds, startTimeRef.current || now);
    
    setState((prev) => ({
      ...prev,
      phase: 'break',
      remainingSeconds: breakSeconds,
      totalSeconds: breakSeconds,
      isRunning: true,
    }));
    onPhaseChangeRef.current?.('break');
  }, [saveState]);

  // Handle page visibility changes (tab switching)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && storedState && storedState.phase !== 'idle' && storedState.phase !== 'completed') {
        // Recalculate time when tab becomes visible
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [storedState, updateTimer]);

  // Auto-resume timer if stored state exists
  useEffect(() => {
    if (storedState && storedState.phase !== 'idle' && storedState.phase !== 'completed') {
      const remaining = calculateRemaining(storedState);
      if (remaining > 0) {
        // Restore phase start time
        const now = Date.now();
        phaseStartTimeRef.current = now - (storedState.totalSeconds - remaining) * 1000;
        
        setState((prev) => ({
          ...prev,
          phase: storedState.phase,
          remainingSeconds: remaining,
          totalSeconds: storedState.totalSeconds,
          isRunning: true,
          inputDuration: storedState.inputDuration,
          outputDuration: storedState.outputDuration,
          breakDuration: storedState.breakDuration || 5,
        }));
      } else {
        // Timer expired, transition phase or complete
        updateTimer();
      }
    }
  }, [storedState, calculateRemaining, updateTimer]);

  // Sync timer every 3 minutes to correct any drift
  useEffect(() => {
    if (!state.isRunning) return;
    
    const syncInterval = setInterval(() => {
      // Explicitly recalculate time from start timestamp
      updateTimer();
    }, 3 * 60 * 1000);
    
    return () => clearInterval(syncInterval);
  }, [state.isRunning, updateTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Debug functions to skip time (remove later)
  const debugSkip1Min = useCallback(() => {
    if (phaseStartTimeRef.current) {
      phaseStartTimeRef.current -= 60 * 1000; // Skip 1 minute
      updateTimer();
    }
  }, [updateTimer]);

  const debugSkip10Min = useCallback(() => {
    if (phaseStartTimeRef.current) {
      phaseStartTimeRef.current -= 10 * 60 * 1000; // Skip 10 minutes
      updateTimer();
    }
  }, [updateTimer]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    skipToOutput,
    skipToBreak,
    debugSkip1Min,
    debugSkip10Min,
  };
}

// Utility functions for testing and external use
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function calculateProgress(remaining: number, total: number): number {
  if (total === 0) return 0;
  return ((total - remaining) / total) * 100;
}
