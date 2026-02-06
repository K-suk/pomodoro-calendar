"use client";

import * as React from "react";
import { formatTime } from "@/hooks/use-pomodoro-timer";

type BlurtingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (text: string) => void;
  remainingSeconds: number;
  totalSeconds: number;
  eventTitle?: string;
  initialText?: string;
  canComplete?: boolean; // Only allow completion when true (timer finished)
  onTextChange?: (text: string) => void; // Sync text changes to parent
};

export function BlurtingModal({
  isOpen,
  onClose: _onClose, // Intentionally unused - cannot close during blurting
  onComplete,
  remainingSeconds,
  totalSeconds,
  eventTitle,
  initialText = "",
  canComplete = true, // Default to true for backwards compatibility
  onTextChange,
}: BlurtingModalProps) {
  void _onClose; // Suppress unused variable warning
  const [text, setText] = React.useState(initialText);
  const [isSaving, setIsSaving] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  React.useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Reset text when initialText changes
  React.useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const handleComplete = React.useCallback(() => {
    if (!canComplete) return;
    onComplete(text);
    setText("");
  }, [canComplete, onComplete, text]);

  // Keyboard shortcut: CMD/Ctrl + Enter to complete (only if allowed)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canComplete) {
          handleComplete();
        }
      }
      // Escape is disabled - no escape from blurting!
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, canComplete, handleComplete]);

  // Auto-save simulation
  React.useEffect(() => {
    if (!text) return;

    setIsSaving(true);
    const timer = setTimeout(() => {
      setIsSaving(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [text]);

  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
        {/* Modal Content */}
        <div className="flex flex-col w-full max-w-[800px] bg-card rounded-xl shadow-2xl border border-border/50 overflow-hidden relative">
          {/* Progress Bar - Only show if timer is active */}
          {totalSeconds > 0 && (
            <div className="flex flex-col w-full">
              <div className="h-1.5 w-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center px-8 py-2 border-b border-border">
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Recall Active
                </span>
                <span className="text-xs font-mono font-medium text-primary">
                  {formatTime(remainingSeconds)} remaining
                </span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="px-8 pt-10 pb-4 text-center">
            <h3 className="tracking-tight text-xl font-semibold leading-tight">
              Reflection / Blurting
            </h3>
            <p className="text-muted-foreground text-sm mt-1 font-normal">
              Let your thoughts flow. No structure, just memory.
            </p>
            {eventTitle && (
              <p className="text-xs text-primary mt-2 font-medium">
                {eventTitle}
              </p>
            )}
          </div>

          {/* Text Area */}
          <div className="flex-1 px-8 py-4 min-h-[400px]">
            <label className="flex flex-col h-full w-full">
              <textarea
                ref={textareaRef}
                className="flex w-full h-full min-h-[360px] min-w-0 flex-1 resize-none overflow-y-auto border-none focus:ring-0 focus:outline-none bg-transparent p-0 text-lg md:text-xl font-normal leading-relaxed placeholder:text-muted-foreground/40"
                placeholder="Write down everything you remember..."
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  onTextChange?.(e.target.value);
                }}
                autoFocus
              />
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-8 py-6 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span className="material-symbols-outlined text-sm">
                {isSaving ? "sync" : "cloud_done"}
              </span>
              <span>{isSaving ? "Saving..." : "Saved"}</span>
            </div>
            <div className="flex items-center gap-4">

              {/* No cancel button - must complete the blurting session */}
              <button
                className={`flex min-w-[100px] items-center justify-center overflow-hidden rounded-lg h-10 px-6 text-sm font-bold leading-normal tracking-wide transition-all ${canComplete
                  ? "cursor-pointer bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
                  }`}
                onClick={handleComplete}
                disabled={!canComplete}
              >
                <span className="truncate">
                  {canComplete ? "Done" : `Wait ${formatTime(remainingSeconds)}`}
                </span>
              </button>
            </div>
          </div>

          {/* No close button - no escape from blurting! */}
        </div>
      </div>

      {/* Status message */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-medium opacity-60">
        {canComplete ? (
          <>
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-border font-sans text-[10px]">
              ⌘
            </kbd>{" "}
            +{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-border font-sans text-[10px]">
              Enter
            </kbd>{" "}
            to finish
          </>
        ) : (
          <span className="text-primary">
            Keep writing • No escape until timer ends
          </span>
        )}
      </div>
    </>
  );
}
