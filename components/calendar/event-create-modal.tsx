"use client";

import * as React from "react";
import { format, differenceInMinutes } from "date-fns";

type EventCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: EventFormData) => void;
  initialDate?: Date;
  initialEndDate?: Date;
  isSubmitting?: boolean;
};

export type EventFormData = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  isPomodoro: boolean;
  inputDuration: number;
  outputDuration: number;
  longBreakDuration: number;
  sets: number;
  category: string;
  color: string;
  isRecurring: boolean;
};

const CATEGORIES = [
  { id: "break", label: "Break", color: "#86efac" },
  { id: "exam", label: "Test/Exam", color: "#ef4444" },
  { id: "meeting", label: "Meeting", color: "#2563eb" },
  { id: "work", label: "Deep Work", color: "#374151" },
];

// Standard cycle: 20 min focus + 5 min blurting + 5 min break = 30 min
const STANDARD_CYCLE_DURATION = 30;
const STANDARD_FOCUS_DURATION = 20;
const STANDARD_BLURTING_DURATION = 5;
const STANDARD_BREAK_DURATION = 5;

// Calculate default pomodoro durations based on event length
const calculateDefaultPomodoroSettings = (eventDurationMinutes: number) => {
  // If event duration is >= 30 min and divisible by 30, use standard cycles
  if (eventDurationMinutes >= STANDARD_CYCLE_DURATION && eventDurationMinutes % STANDARD_CYCLE_DURATION === 0) {
    const cycles = eventDurationMinutes / STANDARD_CYCLE_DURATION;
    return {
      inputDuration: STANDARD_FOCUS_DURATION,
      outputDuration: STANDARD_BLURTING_DURATION,
      longBreakDuration: 15,
      sets: cycles,
      isStandardCycle: true,
    };
  }

  // For odd durations (35 min, 45 min, etc.):
  // Input = eventDuration - 10 (leaving 5 min blurting + 5 min break)
  // But minimum focus time is 5 minutes
  const minFocusTime = 5;
  const blurtingTime = STANDARD_BLURTING_DURATION;
  const breakTime = STANDARD_BREAK_DURATION;
  
  let inputDuration = Math.max(minFocusTime, eventDurationMinutes - blurtingTime - breakTime);
  
  // If event is too short (< 15 min), adjust proportionally
  if (eventDurationMinutes < 15) {
    inputDuration = Math.max(minFocusTime, eventDurationMinutes - 5);
  }

  return {
    inputDuration,
    outputDuration: blurtingTime,
    longBreakDuration: 15,
    sets: 1,
    isStandardCycle: false,
  };
};

export function EventCreateModal({
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialEndDate,
  isSubmitting = false,
}: EventCreateModalProps) {
  const [eventType, setEventType] = React.useState<"pomodoro" | "normal">("pomodoro");
  const [formState, setFormState] = React.useState<EventFormData>({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    isPomodoro: true,
    inputDuration: 25,
    outputDuration: 5,
    longBreakDuration: 15,
    sets: 1,
    category: "work",
    color: "#374151",
    isRecurring: false,
  });

  // Calculate event duration in minutes
  const eventDurationMinutes = React.useMemo(() => {
    if (!formState.startAt || !formState.endAt) return 60;
    const start = new Date(formState.startAt);
    const end = new Date(formState.endAt);
    return Math.max(15, differenceInMinutes(end, start));
  }, [formState.startAt, formState.endAt]);

  // Check if using standard cycles (30 min each: 20 focus + 5 blurting + 5 break)
  const isStandardCycle = formState.inputDuration === STANDARD_FOCUS_DURATION && 
                          formState.outputDuration === STANDARD_BLURTING_DURATION;

  // Total pomodoro time per cycle (focus + blurting + break)
  const totalCycleTime = formState.inputDuration + formState.outputDuration + STANDARD_BREAK_DURATION;
  
  // Total time for all sets
  const totalPomodoroTime = isStandardCycle 
    ? formState.sets * STANDARD_CYCLE_DURATION
    : totalCycleTime;

  // Validation: pomodoro time should not exceed event duration
  const isPomodoroTimeValid = totalPomodoroTime <= eventDurationMinutes;

  // Update form when initial dates change
  React.useEffect(() => {
    if (initialDate && initialEndDate) {
      const durationMinutes = differenceInMinutes(initialEndDate, initialDate);
      const pomodoroSettings = calculateDefaultPomodoroSettings(durationMinutes);

      setFormState((prev) => ({
        ...prev,
        startAt: format(initialDate, "yyyy-MM-dd'T'HH:mm"),
        endAt: format(initialEndDate, "yyyy-MM-dd'T'HH:mm"),
        inputDuration: pomodoroSettings.inputDuration,
        outputDuration: pomodoroSettings.outputDuration,
        longBreakDuration: pomodoroSettings.longBreakDuration,
        sets: pomodoroSettings.sets,
      }));
    } else if (initialDate) {
      const endDate = new Date(initialDate.getTime() + 60 * 60 * 1000);
      const pomodoroSettings = calculateDefaultPomodoroSettings(60);

      setFormState((prev) => ({
        ...prev,
        startAt: format(initialDate, "yyyy-MM-dd'T'HH:mm"),
        endAt: format(endDate, "yyyy-MM-dd'T'HH:mm"),
        inputDuration: pomodoroSettings.inputDuration,
        outputDuration: pomodoroSettings.outputDuration,
        longBreakDuration: pomodoroSettings.longBreakDuration,
        sets: pomodoroSettings.sets,
      }));
    }
  }, [initialDate, initialEndDate]);

  // Auto-adjust pomodoro times when event duration changes
  React.useEffect(() => {
    if (eventType === "pomodoro" && !isPomodoroTimeValid) {
      const settings = calculateDefaultPomodoroSettings(eventDurationMinutes);
      setFormState((prev) => ({
        ...prev,
        inputDuration: settings.inputDuration,
        outputDuration: settings.outputDuration,
      }));
    }
  }, [eventDurationMinutes, eventType, isPomodoroTimeValid]);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setFormState({
        title: "",
        description: "",
        startAt: "",
        endAt: "",
        isPomodoro: true,
        inputDuration: 25,
        outputDuration: 5,
        longBreakDuration: 15,
        sets: 1,
        category: "work",
        color: "#374151",
        isRecurring: false,
      });
      setEventType("pomodoro");
    }
  }, [isOpen]);

  const handleEventTypeChange = (type: "pomodoro" | "normal") => {
    setEventType(type);
    setFormState((prev) => ({
      ...prev,
      isPomodoro: type === "pomodoro",
    }));
  };

  const handleCategorySelect = (categoryId: string) => {
    const category = CATEGORIES.find((c) => c.id === categoryId);
    setFormState((prev) => ({
      ...prev,
      category: categoryId,
      color: category?.color || "#374151",
    }));
  };

  const handleDurationChange = (field: "inputDuration" | "outputDuration", value: number) => {
    const newValue = Math.max(5, value);
    
    // For custom cycles, ensure total (focus + blurting + break) doesn't exceed event duration
    // Blurting = 5, Break = 5, so max focus = eventDuration - 10
    const maxFocus = eventDurationMinutes - STANDARD_BLURTING_DURATION - STANDARD_BREAK_DURATION;
    
    if (field === "inputDuration") {
      setFormState((prev) => ({
        ...prev,
        inputDuration: Math.min(newValue, maxFocus),
      }));
    }
  };

  const handleSubmit = () => {
    if (!formState.title || !formState.startAt || !formState.endAt) return;
    if (eventType === "pomodoro" && !isPomodoroTimeValid) return;
    onSave(formState);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card w-full max-w-[560px] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-muted-foreground">drag_handle</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="p-2 hover:bg-muted rounded-full transition-colors"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-muted-foreground">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 overflow-y-auto max-h-[70vh]">
          {/* Task Name */}
          <div className="mb-4">
            <input
              className="w-full text-3xl font-bold border-none focus:ring-0 focus:outline-none placeholder:text-muted-foreground/30 bg-transparent px-0 py-2"
              placeholder="Task Name"
              type="text"
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              autoFocus
            />
            <div className="h-[1px] w-full bg-border"></div>
          </div>

          {/* Event Type Toggle */}
          <div className="flex gap-3 py-4">
            <button
              className={`flex h-10 items-center justify-center gap-2 px-5 rounded-lg font-medium text-sm transition-all shadow-sm ${
                eventType === "pomodoro"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => handleEventTypeChange("pomodoro")}
            >
              <span className="material-symbols-outlined text-[20px]">timer</span>
              Pomodoro
            </button>
            <button
              className={`flex h-10 items-center justify-center gap-2 px-5 rounded-lg font-medium text-sm transition-all ${
                eventType === "normal"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => handleEventTypeChange("normal")}
            >
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              Normal Event
            </button>
          </div>

          <div className="space-y-4">
            {/* Date & Time */}
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-muted-foreground group-hover:text-primary transition-colors">
                    schedule
                  </span>
                </div>
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <input
                    type="datetime-local"
                    className="text-sm font-normal bg-muted/50 hover:bg-muted px-3 py-2 rounded border border-transparent hover:border-border transition-all focus:ring-primary focus:border-primary"
                    value={formState.startAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, startAt: e.target.value }))}
                  />
                  <span className="text-muted-foreground hidden sm:block">–</span>
                  <input
                    type="datetime-local"
                    className="text-sm font-normal bg-muted/50 hover:bg-muted px-3 py-2 rounded border border-transparent hover:border-border transition-all focus:ring-primary focus:border-primary"
                    value={formState.endAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, endAt: e.target.value }))}
                  />
                </div>
              </div>

              {/* Event Duration Display */}
              <div className="ml-14 text-xs text-muted-foreground">
                Duration: {eventDurationMinutes} minutes
              </div>

              {/* Repeat Option */}
              <div className="flex items-center gap-4 group ml-14">
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors ${
                    formState.isRecurring
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setFormState((prev) => ({ ...prev, isRecurring: !prev.isRecurring }))}
                >
                  <span className="text-xs font-medium">
                    {formState.isRecurring ? "Repeats weekly" : "Does not repeat"}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    {formState.isRecurring ? "check" : "expand_more"}
                  </span>
                </button>
              </div>
            </div>

            <div className="h-[1px] w-full bg-border"></div>

            {/* Timer Configuration (Pomodoro only) */}
            {eventType === "pomodoro" && (
              <div className="py-2">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-muted-foreground">
                      settings_input_component
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Timer Configuration
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {isStandardCycle 
                        ? `Standard cycle: 20-5-5 × ${formState.sets} = ${totalPomodoroTime} min`
                        : `Custom: ${formState.inputDuration}-${formState.outputDuration}-5 = ${totalCycleTime} min`
                      }
                    </span>
                  </div>
                </div>

                {/* Time Usage Bar */}
                <div className="ml-14 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`h-full transition-all ${isPomodoroTimeValid ? 'bg-primary' : 'bg-destructive'}`}
                        style={{ width: `${Math.min(100, (totalPomodoroTime / eventDurationMinutes) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${isPomodoroTimeValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {totalPomodoroTime}/{eventDurationMinutes} min
                    </span>
                  </div>
                  {!isPomodoroTimeValid && (
                    <p className="text-xs text-destructive">
                      ⚠️ Pomodoro time exceeds event duration. Please reduce cycles or time.
                    </p>
                  )}
                </div>

                {/* Cycle Info Card */}
                <div className="ml-14 mb-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">self_improvement</span>
                      <div>
                        <div className="font-bold text-primary">{formState.inputDuration} min</div>
                        <div className="text-[10px] text-muted-foreground">Focus</div>
                      </div>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-lg">edit_note</span>
                      <div>
                        <div className="font-bold text-amber-600">{formState.outputDuration} min</div>
                        <div className="text-[10px] text-muted-foreground">Blurting</div>
                      </div>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-green-500 text-lg">coffee</span>
                      <div>
                        <div className="font-bold text-green-600">5 min</div>
                        <div className="text-[10px] text-muted-foreground">Break</div>
                      </div>
                    </div>
                    {isStandardCycle && formState.sets > 1 && (
                      <>
                        <span className="text-muted-foreground">×</span>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-lg">repeat</span>
                          <div>
                            <div className="font-bold">{formState.sets}</div>
                            <div className="text-[10px] text-muted-foreground">Cycles</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Only show customization if not standard cycle */}
                {!isStandardCycle && (
                  <div className="grid grid-cols-3 gap-4 ml-14">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase">
                        Focus
                      </label>
                      <div className="relative">
                        <input
                          className={`w-full bg-muted/50 border rounded px-2 py-1.5 text-sm focus:ring-primary focus:border-primary pr-10 ${
                            !isPomodoroTimeValid ? 'border-destructive' : 'border-border'
                          }`}
                          type="number"
                          min={5}
                          value={formState.inputDuration}
                          onChange={(e) => handleDurationChange("inputDuration", Number(e.target.value))}
                        />
                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          min
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase">
                        Blurting
                      </label>
                      <div className="relative">
                        <input
                          className="w-full bg-muted/50 border border-border rounded px-2 py-1.5 text-sm focus:ring-primary focus:border-primary pr-10"
                          type="number"
                          min={1}
                          value={formState.outputDuration}
                          disabled
                        />
                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          min
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase">
                        Break
                      </label>
                      <div className="relative">
                        <input
                          className="w-full bg-muted/50 border border-border rounded px-2 py-1.5 text-sm focus:ring-primary focus:border-primary pr-10"
                          type="number"
                          value={5}
                          disabled
                        />
                        <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          min
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Standard cycle adjustment */}
                {isStandardCycle && (
                  <div className="ml-14">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase">
                        Number of Cycles
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors disabled:opacity-50"
                          onClick={() => setFormState((prev) => ({ ...prev, sets: Math.max(1, prev.sets - 1) }))}
                          disabled={formState.sets <= 1}
                        >
                          <span className="material-symbols-outlined">remove</span>
                        </button>
                        <span className="text-2xl font-bold w-12 text-center">{formState.sets}</span>
                        <button
                          className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors disabled:opacity-50"
                          onClick={() => setFormState((prev) => ({ ...prev, sets: prev.sets + 1 }))}
                          disabled={totalPomodoroTime + STANDARD_CYCLE_DURATION > eventDurationMinutes}
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>
                        <span className="text-sm text-muted-foreground ml-2">
                          = {formState.sets * STANDARD_CYCLE_DURATION} min total
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category */}
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-muted-foreground">label</span>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">Category</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 ml-14">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      formState.category === category.id
                        ? "border-2 border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                    onClick={() => handleCategorySelect(category.id)}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span
                      className={`text-xs ${
                        formState.category === category.id ? "font-bold" : "font-medium"
                      }`}
                    >
                      {category.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="flex items-start gap-4 py-2 group">
              <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-1">
                <span className="material-symbols-outlined text-muted-foreground group-hover:text-primary transition-colors">
                  notes
                </span>
              </div>
              <div className="flex-1 border border-border rounded-lg p-3 hover:border-primary/50 transition-colors bg-muted/30">
                <textarea
                  className="w-full text-sm border-none focus:ring-0 focus:outline-none bg-transparent placeholder:text-muted-foreground p-0 resize-none"
                  placeholder="Add description or notes..."
                  rows={2}
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end">
          <button
            className="px-10 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={isSubmitting || !formState.title || (eventType === "pomodoro" && !isPomodoroTimeValid)}
          >
            {isSubmitting ? "Saving..." : "Save Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
