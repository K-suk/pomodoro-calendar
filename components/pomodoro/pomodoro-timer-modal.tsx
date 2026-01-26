"use client";

import * as React from "react";
import { usePomodoroTimer, calculateProgress, type PomodoroPhase } from "@/hooks/use-pomodoro-timer";
import { useBlurtingSession } from "@/hooks/use-blurting-session";
import { BlurtingModal } from "./blurting-modal";

type PomodoroTimerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  inputDuration: number; // minutes
  outputDuration: number; // minutes
  totalSessions?: number;
  onComplete?: (blurtingText: string) => void;
};

export function PomodoroTimerModal({
  isOpen,
  onClose,
  eventTitle,
  inputDuration,
  outputDuration,
  totalSessions = 4,
  onComplete,
}: PomodoroTimerModalProps) {
  const [completedSessions, setCompletedSessions] = React.useState(0);
  const [showBlurtingModal, setShowBlurtingModal] = React.useState(false);
  
  const handlePhaseChange = React.useCallback((phase: PomodoroPhase) => {
    if (phase === "output") {
      blurtingSession.startSession();
      setShowBlurtingModal(true);
    } else if (phase === "completed") {
      // Don't auto-close blurting modal, let user finish
    }
  }, []);

  const timer = usePomodoroTimer(inputDuration, outputDuration, handlePhaseChange);
  const blurtingSession = useBlurtingSession();

  // Start timer when modal opens
  React.useEffect(() => {
    if (isOpen && timer.state.phase === "idle") {
      timer.start();
    }
  }, [isOpen]);

  // Reset when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      timer.reset();
      blurtingSession.resetSession();
      setShowBlurtingModal(false);
      setCompletedSessions(0);
    }
  }, [isOpen]);

  const handleStop = () => {
    timer.pause();
    onClose();
  };

  const handleReset = () => {
    timer.reset();
    blurtingSession.resetSession();
    setShowBlurtingModal(false);
    timer.start();
  };

  const handleSkipToBlurting = () => {
    timer.skipToOutput();
  };

  const handleBlurtingComplete = (text: string) => {
    blurtingSession.endSession();
    setCompletedSessions((prev) => prev + 1);
    setShowBlurtingModal(false);
    onComplete?.(text);
    
    // If more sessions remaining, restart timer
    if (completedSessions + 1 < totalSessions) {
      timer.reset();
      timer.start();
    } else {
      onClose();
    }
  };

  const handleBlurtingClose = () => {
    setShowBlurtingModal(false);
    timer.pause();
  };

  const progress = calculateProgress(timer.state.remainingSeconds, timer.state.totalSeconds);
  const minutes = Math.floor(timer.state.remainingSeconds / 60);
  const seconds = timer.state.remainingSeconds % 60;

  const phaseLabel = timer.state.phase === "input" 
    ? "Focus Session" 
    : timer.state.phase === "output" 
    ? "Blurting Time" 
    : timer.state.phase === "completed"
    ? "Session Complete"
    : "Ready";

  if (!isOpen) return null;

  // Show Blurting Modal during output phase
  if (showBlurtingModal && timer.state.phase === "output") {
    return (
      <BlurtingModal
        isOpen={true}
        onClose={handleBlurtingClose}
        onComplete={handleBlurtingComplete}
        remainingSeconds={timer.state.remainingSeconds}
        totalSeconds={timer.state.totalSeconds}
        eventTitle={eventTitle}
        initialText={blurtingSession.state.blurtingText}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleStop}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-card w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center relative border border-border pointer-events-auto">
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

            {/* Skip to Blurting Button (only during input phase) */}
            {timer.state.phase === "input" && (
              <button
                className="text-xs text-muted-foreground hover:text-primary transition-colors mb-4"
                onClick={handleSkipToBlurting}
              >
                Skip to blurting →
              </button>
            )}

            {/* Control Bar */}
            <div className="flex items-center justify-between w-full mt-8 px-4">
              {/* Stop Button */}
              <button 
                className="text-muted-foreground hover:text-primary transition-colors text-sm font-bold tracking-widest px-4 py-2"
                onClick={handleStop}
              >
                STOP
              </button>

              {/* Session Dots */}
              <div className="flex gap-2">
                {Array.from({ length: totalSessions }).map((_, i) => (
                  <div
                    key={i}
                    className={`size-1.5 rounded-full transition-colors ${
                      i < completedSessions ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              {/* Reset Button */}
              <button 
                className="size-10 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-full transition-all"
                onClick={handleReset}
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </button>
            </div>

            {/* Event Title */}
            <div className="mt-8">
              <p className="text-muted-foreground text-xs font-medium">
                {eventTitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
