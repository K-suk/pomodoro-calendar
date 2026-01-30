"use client";

import * as React from "react";
import { format, differenceInMinutes } from "date-fns";
import { RecurrencePicker, type RecurrenceConfig, generateRRule } from "./recurrence-picker";
import { CategoryPicker, type Category } from "./category-picker";
import { CategoryCreateModal } from "./category-create-modal";
import { CategoryEditModal } from "./category-edit-modal";

type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  categoryId: string | null;
  startAt: string;
  endAt: string;
  isPomodoro: boolean;
  inputDuration: number;
  outputDuration: number;
  isRecurring: boolean;
  rrule: string | null;
};

type EventCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: EventFormData) => void;
  onUpdate?: (event: EventFormData & { id: string }) => void;
  onDelete?: (eventId: string) => void;
  initialDate?: Date;
  initialEndDate?: Date;
  isSubmitting?: boolean;
  editingEvent?: EventRecord | null;
  isDeleteOnly?: boolean; // When true, only delete is allowed (for active pomodoro)
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
  categoryId: string | null;
  color: string;
  isRecurring: boolean;
  recurrence: RecurrenceConfig;
  rrule: string | null;
};

// Standard cycle: 25 min focus + 5 min blurting = 30 min
const STANDARD_CYCLE_DURATION = 30;
const STANDARD_FOCUS_DURATION = 25;
const STANDARD_BLURTING_DURATION = 5;

// Minimum durations for pomodoro
const MIN_POMODORO_DURATION = 25; // Focus only, no break
const MIN_POMODORO_WITH_BREAK_DURATION = 30; // Focus + blurting

// Calculate default pomodoro durations based on event length
// Returns null if duration is too short for pomodoro
const calculateDefaultPomodoroSettings = (eventDurationMinutes: number) => {
  // Too short for pomodoro
  if (eventDurationMinutes < MIN_POMODORO_DURATION) {
    return null;
  }

  // Exactly 25 minutes: Focus only mode (no blurting)
  if (eventDurationMinutes >= MIN_POMODORO_DURATION && eventDurationMinutes < MIN_POMODORO_WITH_BREAK_DURATION) {
    return {
      inputDuration: 25,
      outputDuration: 0, // No blurting for 25-29 min events
      longBreakDuration: 0,
      sets: 1,
      isStandardCycle: false,
      isFocusOnlyMode: true,
    };
  }

  // 30+ minutes: Standard cycle with blurting
  // If divisible by 30, use perfect cycles
  if (eventDurationMinutes % STANDARD_CYCLE_DURATION === 0) {
    const cycles = eventDurationMinutes / STANDARD_CYCLE_DURATION;
    return {
      inputDuration: STANDARD_FOCUS_DURATION,
      outputDuration: STANDARD_BLURTING_DURATION,
      longBreakDuration: 15,
      sets: cycles,
      isStandardCycle: true,
      isFocusOnlyMode: false,
    };
  }

  // For non-standard durations (35, 45, etc.), calculate proportionally
  // Focus = eventDuration - 5 (leaving 5 min for blurting)
  const inputDuration = eventDurationMinutes - STANDARD_BLURTING_DURATION;

  return {
    inputDuration,
    outputDuration: STANDARD_BLURTING_DURATION,
    longBreakDuration: 15,
    sets: 1,
    isStandardCycle: false,
    isFocusOnlyMode: false,
  };
};


export function EventCreateModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  initialDate,
  initialEndDate,
  isSubmitting = false,
  editingEvent,
  isDeleteOnly = false,
}: EventCreateModalProps) {
  const isEditMode = !!editingEvent;
  const [eventType, setEventType] = React.useState<"pomodoro" | "normal">("pomodoro");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(false);
  const [showCategoryCreateModal, setShowCategoryCreateModal] = React.useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [isEditingCategory, setIsEditingCategory] = React.useState(false);

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
    categoryId: null,
    color: "#374151",
    isRecurring: false,
    recurrence: { type: "none" },
    rrule: null,
  });

  // Load categories
  React.useEffect(() => {
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = (await response.json()) as { categories: Category[] };
          setCategories(data.categories);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    if (isOpen) {
      void loadCategories();
    }
  }, [isOpen]);

  // Calculate event duration in minutes
  const eventDurationMinutes = React.useMemo(() => {
    if (!formState.startAt || !formState.endAt) return 60;
    const start = new Date(formState.startAt);
    const end = new Date(formState.endAt);
    return Math.max(15, differenceInMinutes(end, start));
  }, [formState.startAt, formState.endAt]);

  // Check if using standard cycles (30 min each: 25 focus + 5 blurting)
  const isStandardCycle = formState.inputDuration === STANDARD_FOCUS_DURATION &&
    formState.outputDuration === STANDARD_BLURTING_DURATION;

  // Total pomodoro time per cycle (focus + blurting)
  const totalCycleTime = formState.inputDuration + formState.outputDuration;

  // Total time for all sets
  const totalPomodoroTime = isStandardCycle
    ? formState.sets * STANDARD_CYCLE_DURATION
    : totalCycleTime;

  // Validation: pomodoro time should not exceed event duration AND duration must be >= 25 min
  const isPomodoroTimeValid = totalPomodoroTime <= eventDurationMinutes && eventDurationMinutes >= MIN_POMODORO_DURATION;

  // Update form when initial dates change
  React.useEffect(() => {
    if (initialDate && initialEndDate) {
      const durationMinutes = differenceInMinutes(initialEndDate, initialDate);
      const pomodoroSettings = calculateDefaultPomodoroSettings(durationMinutes);

      setFormState((prev) => ({
        ...prev,
        startAt: format(initialDate, "yyyy-MM-dd'T'HH:mm"),
        endAt: format(initialEndDate, "yyyy-MM-dd'T'HH:mm"),
        inputDuration: pomodoroSettings?.inputDuration ?? 25,
        outputDuration: pomodoroSettings?.outputDuration ?? 5,
        longBreakDuration: pomodoroSettings?.longBreakDuration ?? 0,
        sets: pomodoroSettings?.sets ?? 1,
      }));
    } else if (initialDate) {
      const endDate = new Date(initialDate.getTime() + 60 * 60 * 1000);
      const pomodoroSettings = calculateDefaultPomodoroSettings(60);

      setFormState((prev) => ({
        ...prev,
        startAt: format(initialDate, "yyyy-MM-dd'T'HH:mm"),
        endAt: format(endDate, "yyyy-MM-dd'T'HH:mm"),
        inputDuration: pomodoroSettings?.inputDuration ?? 25,
        outputDuration: pomodoroSettings?.outputDuration ?? 5,
        longBreakDuration: pomodoroSettings?.longBreakDuration ?? 0,
        sets: pomodoroSettings?.sets ?? 1,
      }));
    }
  }, [initialDate, initialEndDate]);

  // Auto-adjust pomodoro times when event duration changes
  React.useEffect(() => {
    if (eventType === "pomodoro" && eventDurationMinutes >= MIN_POMODORO_DURATION) {
      const settings = calculateDefaultPomodoroSettings(eventDurationMinutes);
      if (settings) {
        setFormState((prev) => ({
          ...prev,
          inputDuration: settings.inputDuration,
          outputDuration: settings.outputDuration,
        }));
      }
    }
  }, [eventDurationMinutes, eventType]);

  // Populate form when editing an event
  React.useEffect(() => {
    if (editingEvent && isOpen) {
      setFormState({
        title: editingEvent.title,
        description: editingEvent.description || "",
        startAt: format(new Date(editingEvent.startAt), "yyyy-MM-dd'T'HH:mm"),
        endAt: format(new Date(editingEvent.endAt), "yyyy-MM-dd'T'HH:mm"),
        isPomodoro: editingEvent.isPomodoro,
        inputDuration: editingEvent.inputDuration,
        outputDuration: editingEvent.outputDuration,
        longBreakDuration: 15,
        sets: 1,
        categoryId: editingEvent.categoryId || null,
        color: editingEvent.color || "#374151",
        isRecurring: editingEvent.isRecurring,
        recurrence: editingEvent.isRecurring ? { type: "weekly" } : { type: "none" }, // TODO: Parse rrule
        rrule: editingEvent.rrule,
      });
      setEventType(editingEvent.isPomodoro ? "pomodoro" : "normal");
    }
  }, [editingEvent, isOpen]);

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
        categoryId: null,
        color: "#374151",
        isRecurring: false,
        recurrence: { type: "none" },
        rrule: null,
      });
      setEventType("pomodoro");
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  const handleCategorySelect = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    setFormState((prev) => ({
      ...prev,
      categoryId,
      color: category?.color || prev.color,
    }));
  };

  const handleCreateCategory = async (title: string, color: string) => {
    setIsCreatingCategory(true);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, color }),
      });

      if (response.ok) {
        const data = (await response.json()) as { category: Category };
        setCategories((prev) => [...prev, data.category]);
        setFormState((prev) => ({
          ...prev,
          categoryId: data.category.id,
          color: data.category.color,
        }));
        setShowCategoryCreateModal(false);
      }
    } catch (error) {
      console.error("Failed to create category:", error);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
  };

  const handleUpdateCategory = async (id: string, title: string, color: string) => {
    setIsEditingCategory(true);
    try {
      const response = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title, color }),
      });

      if (response.ok) {
        const data = (await response.json()) as { category: Category };
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? data.category : c))
        );

        // If this category is currently selected, update the form state
        if (formState.categoryId === id) {
          setFormState((prev) => ({
            ...prev,
            color: data.category.color,
          }));
        }

        setEditingCategory(null);
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    } finally {
      setIsEditingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setIsEditingCategory(true);
    try {
      const response = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));

        // If this category was selected, clear the selection
        if (formState.categoryId === id) {
          setFormState((prev) => ({
            ...prev,
            categoryId: null,
          }));
        }

        setEditingCategory(null);
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    } finally {
      setIsEditingCategory(false);
    }
  };

  const handleEventTypeChange = (type: "pomodoro" | "normal") => {
    setEventType(type);
    setFormState((prev) => ({
      ...prev,
      isPomodoro: type === "pomodoro",
    }));
  };

  const handleDurationChange = (field: "inputDuration" | "outputDuration", value: number) => {
    const newValue = Math.max(5, value);

    // For custom cycles, ensure total (focus + blurting) doesn't exceed event duration
    // Blurting = 5, so max focus = eventDuration - 5
    const maxFocus = eventDurationMinutes - STANDARD_BLURTING_DURATION;

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

    // Generate RRULE from recurrence config
    const startDate = new Date(formState.startAt);
    const rrule = generateRRule(formState.recurrence, startDate);
    const isRecurring = formState.recurrence.type !== "none";

    const formDataWithRrule = {
      ...formState,
      isRecurring,
      rrule,
    };

    if (isEditMode && editingEvent && onUpdate) {
      onUpdate({ ...formDataWithRrule, id: editingEvent.id });
    } else {
      onSave(formDataWithRrule);
    }
  };

  const handleRecurrenceChange = (recurrence: RecurrenceConfig) => {
    setFormState((prev) => ({
      ...prev,
      recurrence,
      isRecurring: recurrence.type !== "none",
    }));
  };

  const handleDelete = () => {
    if (editingEvent && onDelete) {
      onDelete(editingEvent.id);
    }
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

  // Delete-only mode for active pomodoro
  if (isDeleteOnly && editingEvent) {
    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onKeyDown={handleKeyDown}
      >
        <div className="bg-card w-full max-w-[400px] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary animate-pulse">timer</span>
              <span className="text-sm font-medium text-muted-foreground">Pomodoro in Progress</span>
            </div>
            <button
              className="p-2 hover:bg-muted rounded-full transition-colors"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-muted-foreground">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <h3 className="text-xl font-bold mb-2">{editingEvent.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {format(new Date(editingEvent.startAt), "h:mm a")} - {format(new Date(editingEvent.endAt), "h:mm a")}
            </p>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500">info</span>
                <div>
                  <p className="text-sm font-medium text-amber-600">Timer is running</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This event cannot be edited while the pomodoro timer is active. You can only delete it.
                  </p>
                </div>
              </div>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Delete Event
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-destructive">warning</span>
                </div>
                <h3 className="text-lg font-semibold">Delete Event</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete &quot;{editingEvent.title}&quot;? This will also stop the running timer. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  onClick={() => {
                    handleDelete();
                    setShowDeleteConfirm(false);
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
            {isEditMode && (
              <span className="text-sm font-medium text-muted-foreground">Edit Task</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && onDelete && (
              <button
                className="p-2 hover:bg-destructive/10 rounded-full transition-colors group"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete event"
              >
                <span className="material-symbols-outlined text-muted-foreground group-hover:text-destructive">delete</span>
              </button>
            )}
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
          <div className="flex flex-col gap-2 py-4">
            <div className="flex gap-3">
              <button
                className={`flex h-10 items-center justify-center gap-2 px-5 rounded-lg font-medium text-sm transition-all shadow-sm ${eventType === "pomodoro"
                    ? "bg-primary text-primary-foreground"
                    : eventDurationMinutes < MIN_POMODORO_DURATION
                      ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                onClick={() => eventDurationMinutes >= MIN_POMODORO_DURATION && handleEventTypeChange("pomodoro")}
                disabled={eventDurationMinutes < MIN_POMODORO_DURATION}
              >
                <span className="material-symbols-outlined text-[20px]">timer</span>
                Pomodoro
              </button>
              <button
                className={`flex h-10 items-center justify-center gap-2 px-5 rounded-lg font-medium text-sm transition-all ${eventType === "normal"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                onClick={() => handleEventTypeChange("normal")}
              >
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                Normal Event
              </button>
            </div>
            {/* Duration warning */}
            {eventDurationMinutes < MIN_POMODORO_DURATION && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>Pomodoro requires at least 25 minutes. Current: {eventDurationMinutes} min</span>
              </div>
            )}
            {/* Focus only mode indicator */}
            {eventType === "pomodoro" && eventDurationMinutes >= MIN_POMODORO_DURATION && eventDurationMinutes < MIN_POMODORO_WITH_BREAK_DURATION && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                <span className="material-symbols-outlined text-sm">self_improvement</span>
                <span>Focus Only Mode: 25 min focus, no blurting phase</span>
              </div>
            )}
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
                <RecurrencePicker
                  value={formState.recurrence}
                  onChange={handleRecurrenceChange}
                  startDate={formState.startAt ? new Date(formState.startAt) : undefined}
                />
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
                          className={`w-full bg-muted/50 border rounded px-2 py-1.5 text-sm focus:ring-primary focus:border-primary pr-10 ${!isPomodoroTimeValid ? 'border-destructive' : 'border-border'
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
              <div className="ml-14">
                <CategoryPicker
                  categories={categories}
                  selectedCategoryId={formState.categoryId}
                  onSelect={handleCategorySelect}
                  onCreateCategory={() => setShowCategoryCreateModal(true)}
                  onEditCategory={handleEditCategory}
                  isLoading={isLoadingCategories}
                />
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
            {isSubmitting ? "Saving..." : isEditMode ? "Update Task" : "Save Task"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-destructive">warning</span>
              </div>
              <h3 className="text-lg font-semibold">Delete Event</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete &quot;{editingEvent?.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                onClick={() => {
                  handleDelete();
                  setShowDeleteConfirm(false);
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Create Modal */}
      <CategoryCreateModal
        isOpen={showCategoryCreateModal}
        onClose={() => setShowCategoryCreateModal(false)}
        onSave={handleCreateCategory}
        isSubmitting={isCreatingCategory}
      />

      {/* Category Edit Modal */}
      <CategoryEditModal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        onSave={handleUpdateCategory}
        onDelete={handleDeleteCategory}
        category={editingCategory}
        isSubmitting={isEditingCategory}
      />
    </div>
  );
}
