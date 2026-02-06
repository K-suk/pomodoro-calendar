"use client";

import * as React from "react";
import { calculateProgress, formatTime, type PomodoroPhase, type PomodoroState } from "@/hooks/use-pomodoro-timer";

type PomodoroTimerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  inputDuration: number; // minutes
  outputDuration: number; // minutes
  totalSessions?: number;
  onComplete?: (blurtingText: string) => void;
  eventStartAt: string; // ISO string
  eventEndAt: string; // ISO string
  // External timer state (managed by parent)
  timerState?: PomodoroState;
  // Feedback props
  feedbackText?: string;
  onFeedbackChange?: (text: string) => void;
  onFeedbackSubmit?: () => void;
};

// Check if current time is within event time range
function isWithinEventTime(startAt: string, endAt: string): boolean {
  const now = new Date().getTime();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  return now >= start && now <= end;
}

export function PomodoroTimerModal({
  isOpen,
  onClose,
  eventTitle,
  inputDuration,
  outputDuration,
  totalSessions = 1,
  eventStartAt,
  eventEndAt,
  timerState,
  feedbackText = "",
  onFeedbackChange,
  onFeedbackSubmit,
}: PomodoroTimerModalProps) {
  const [completedSessions] = React.useState(0);

  // Use external timer state if provided, otherwise use defaults
  const state = timerState ?? {
    phase: "idle" as PomodoroPhase,
    remainingSeconds: inputDuration * 60,
    totalSeconds: inputDuration * 60,
    isRunning: false,
    inputDuration,
    outputDuration,
  };

  const progress = calculateProgress(state.remainingSeconds, state.totalSeconds);
  const minutes = Math.floor(state.remainingSeconds / 60);
  const seconds = state.remainingSeconds % 60;

  const phaseLabel = state.phase === "input"
    ? "Focus Session"
    : state.phase === "output"
      ? "Blurting Time"
      : state.phase === "break"
        ? "Break Time"
        : state.phase === "completed"
          ? "Session Complete"
          : "Ready";

  // Check if we're within the event time
  const withinEventTime = isWithinEventTime(eventStartAt, eventEndAt);

  if (!isOpen) return null;

  // Note: Blurting modal is now handled by parent component

  // Allow closing at any phase - timer will continue in header
  const canClose = true;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay - click to close only during break */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
        style={{ cursor: canClose ? 'pointer' : 'default' }}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-card w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center relative border border-border pointer-events-auto">
          {/* Close button - only during break */}
          {canClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
              title="Continue in background"
            >
              <span className="material-symbols-outlined text-muted-foreground">close</span>
            </button>
          )}

          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-12 w-full flex flex-col items-center">
            {/* Phase Label */}
            <div className="mb-4">
              <p className="text-[10px] tracking-[0.3em] font-bold uppercase text-primary">
                {phaseLabel}
              </p>
            </div>

            {/* Not within event time warning */}
            {!withinEventTime && state.phase === "idle" && (
              <div className="mb-6 p-4 bg-destructive/10 rounded-lg text-center">
                <p className="text-sm text-destructive font-medium">
                  Timer will start at scheduled time
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(eventStartAt).toLocaleTimeString()} - {new Date(eventEndAt).toLocaleTimeString()}
                </p>
              </div>
            )}

            {/* Timer Display */}
            <div className="flex items-center justify-center py-6">
              <span className="text-[100px] font-extralight leading-none tracking-tighter">
                {minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-[100px] font-extralight leading-none text-primary pb-4 mx-2">
                :
              </span>
              <span className="text-[100px] font-extralight leading-none tracking-tighter">
                {seconds.toString().padStart(2, "0")}
              </span>
            </div>

            {/* Session Progress */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {Array.from({ length: totalSessions }).map((_, i) => (
                <div
                  key={i}
                  className={`size-2 rounded-full transition-colors ${i < completedSessions ? "bg-primary" : "bg-muted"
                    }`}
                />
              ))}
            </div>

            {/* Event Title */}
            <div className="mt-8">
              <p className="text-muted-foreground text-xs font-medium">
                {eventTitle}
              </p>
            </div>

            {/* Break / Feedback Section */}
            {state.phase === "break" ? (
              <div className="mt-8 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-green-600">
                      Session Feedback
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Memo for yourself
                    </span>
                  </div>
                  <textarea
                    className="w-full h-32 p-3 text-sm bg-muted/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                    placeholder="What did you accomplish? Any thoughts?"
                    value={feedbackText}
                    onChange={(e) => onFeedbackChange?.(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={onFeedbackSubmit}
                    className="w-full py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    Save Feedback
                  </button>
                </div>
              </div>
            ) : (
              /* Message - different for focus vs output */
              <div className="mt-6 text-center">
                {state.phase === "output" ? (
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                    Blurting time • Write everything down!
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                    Stay focused • No escape
                  </p>
                )}
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}

// Export for use in header persistent timer
export function MiniTimer({
  remainingSeconds,
  phase,
  eventTitle,
  onClick
}: {
  remainingSeconds: number;
  phase: PomodoroPhase;
  eventTitle: string;
  onClick: () => void;
}) {
  const timeDisplay = formatTime(remainingSeconds);
  const phaseColor = phase === "input" ? "text-primary" : phase === "output" ? "text-amber-500" : phase === "break" ? "text-green-500" : "text-muted-foreground";

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-lg transition-colors"
    >
      <span className="material-symbols-outlined text-primary text-lg animate-pulse">timer</span>
      <div className="flex flex-col items-start">
        <span className={`font-mono text-lg font-bold ${phaseColor}`}>
          {timeDisplay}
        </span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
          {eventTitle}
        </span>
      </div>
    </button>
  );
}
