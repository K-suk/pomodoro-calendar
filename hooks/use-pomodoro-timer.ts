import { useState, useCallback, useRef, useEffect } from 'react';

export type PomodoroPhase = 'idle' | 'input' | 'output' | 'completed';

export type PomodoroState = {
  phase: PomodoroPhase;
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  inputDuration: number; // minutes
  outputDuration: number; // minutes
};

export type UsePomodoroTimerReturn = {
  state: PomodoroState;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skipToOutput: () => void;
};

export function usePomodoroTimer(
  inputDuration: number = 25,
  outputDuration: number = 5,
  onPhaseChange?: (phase: PomodoroPhase) => void
): UsePomodoroTimerReturn {
  const [state, setState] = useState<PomodoroState>({
    phase: 'idle',
    remainingSeconds: inputDuration * 60,
    totalSeconds: inputDuration * 60,
    isRunning: false,
    inputDuration,
    outputDuration,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setState((prev) => {
      if (!prev.isRunning || prev.phase === 'idle' || prev.phase === 'completed') {
        return prev;
      }

      const newRemaining = prev.remainingSeconds - 1;

      if (newRemaining <= 0) {
        // Phase transition
        if (prev.phase === 'input') {
          const outputSeconds = prev.outputDuration * 60;
          onPhaseChangeRef.current?.('output');
          return {
            ...prev,
            phase: 'output',
            remainingSeconds: outputSeconds,
            totalSeconds: outputSeconds,
          };
        } else if (prev.phase === 'output') {
          clearTimer();
          onPhaseChangeRef.current?.('completed');
          return {
            ...prev,
            phase: 'completed',
            remainingSeconds: 0,
            isRunning: false,
          };
        }
      }

      return {
        ...prev,
        remainingSeconds: newRemaining,
      };
    });
  }, [clearTimer]);

  const start = useCallback(() => {
    clearTimer();
    const inputSeconds = inputDuration * 60;
    setState({
      phase: 'input',
      remainingSeconds: inputSeconds,
      totalSeconds: inputSeconds,
      isRunning: true,
      inputDuration,
      outputDuration,
    });
    onPhaseChangeRef.current?.('input');
    intervalRef.current = setInterval(tick, 1000);
  }, [inputDuration, outputDuration, tick, clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setState((prev) => ({ ...prev, isRunning: false }));
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (state.phase === 'idle' || state.phase === 'completed') return;
    setState((prev) => ({ ...prev, isRunning: true }));
    intervalRef.current = setInterval(tick, 1000);
  }, [state.phase, tick]);

  const reset = useCallback(() => {
    clearTimer();
    setState({
      phase: 'idle',
      remainingSeconds: inputDuration * 60,
      totalSeconds: inputDuration * 60,
      isRunning: false,
      inputDuration,
      outputDuration,
    });
  }, [inputDuration, outputDuration, clearTimer]);

  const skipToOutput = useCallback(() => {
    if (state.phase !== 'input') return;
    clearTimer();
    const outputSeconds = outputDuration * 60;
    setState((prev) => ({
      ...prev,
      phase: 'output',
      remainingSeconds: outputSeconds,
      totalSeconds: outputSeconds,
      isRunning: true,
    }));
    onPhaseChangeRef.current?.('output');
    intervalRef.current = setInterval(tick, 1000);
  }, [state.phase, outputDuration, tick, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    skipToOutput,
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
