"use client";

import * as React from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  startOfDay,
  differenceInMinutes,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  getDay,
  addMinutes,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { AuthButton } from "@/components/auth-button";
import { PomodoroTimerModal, MiniTimer } from "@/components/pomodoro/pomodoro-timer-modal";
import { EventCreateModal, type EventFormData } from "@/components/calendar/event-create-modal";
import { usePomodoroTimer, type PomodoroPhase } from "@/hooks/use-pomodoro-timer";
import { useBlurtingSession } from "@/hooks/use-blurting-session";
import { BlurtingModal } from "@/components/pomodoro/blurting-modal";
import { useNotifications } from "@/hooks/use-notifications";

// Find the current active pomodoro event
function findActivePomodoro(events: EventRecord[]): EventRecord | null {
  const now = new Date().getTime();
  return events.find((event) => {
    if (!event.isPomodoro) return false;
    const start = new Date(event.startAt).getTime();
    const end = new Date(event.endAt).getTime();
    return now >= start && now <= end;
  }) || null;
}

// Check if a pomodoro event is completed (past its end time)
function isCompletedPomodoro(event: EventRecord): boolean {
  if (!event.isPomodoro) return false;
  const now = new Date().getTime();
  const end = new Date(event.endAt).getTime();
  return now > end;
}

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


type DragMode = 'create' | 'move' | 'resize';

type DragState = {
  isDragging: boolean;
  mode: DragMode;
  startDay: Date | null;
  startMinutes: number;
  currentDay: Date | null;
  currentMinutes: number;
  activeEventId: string | null;
  initialEventStart: Date | null;
  initialEventEnd: Date | null;
  dragOffsetMinutes: number;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINI_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const SLOT_HEIGHT = 60; // 1 hour = 60px

const formatHour = (hour: number) => {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
};

export function PomodoroCalendar() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [miniCalendarDate, setMiniCalendarDate] = React.useState(new Date());
  const [events, setEvents] = React.useState<EventRecord[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [timerModalOpen, setTimerModalOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<EventRecord | null>(null);
  const [createModalInitialDate, setCreateModalInitialDate] = React.useState<Date | undefined>();
  const [createModalInitialEndDate, setCreateModalInitialEndDate] = React.useState<Date | undefined>();
  const [now, setNow] = React.useState(new Date());
  const [completedPomodoroWarning, setCompletedPomodoroWarning] = React.useState(false);

  // Active pomodoro session state (persists even when modal is closed)
  const [activePomodoro, setActivePomodoro] = React.useState<EventRecord | null>(null);
  const [showBlurtingModal, setShowBlurtingModal] = React.useState(false);

  // Blurting session hook (must be declared before handlePhaseChange)
  const blurtingSession = useBlurtingSession();

  // Notifications hook
  const notifications = useNotifications();

  // Timer hook for persistent timer
  const handlePhaseChange = React.useCallback((phase: PomodoroPhase) => {
    // Send notification for phase change
    // - For output/completed: Always send (user needs to know timer ended)
    // - For input: Only when user is away from the page
    const alwaysNotifyPhases = phase === "output" || phase === "completed";
    const shouldNotify = phase !== "idle" && (alwaysNotifyPhases || document.hidden);

    if (shouldNotify) {
      notifications.notifyPhaseChange(phase, activePomodoro?.title);
    }

    if (phase === "output") {
      blurtingSession.startSession();
      setShowBlurtingModal(true);
      setTimerModalOpen(false);
    }
  }, [blurtingSession, notifications, activePomodoro?.title]);

  const persistentTimer = usePomodoroTimer(
    activePomodoro?.inputDuration ?? 25,
    activePomodoro?.outputDuration ?? 5,
    handlePhaseChange,
    activePomodoro?.id // Pass event ID for persistence
  );

  // Check for active pomodoro every second
  React.useEffect(() => {
    const checkActivePomodoro = () => {
      const active = findActivePomodoro(events);

      if (active && !activePomodoro) {
        // New active pomodoro found - auto start!
        setActivePomodoro(active);
        setTimerModalOpen(true);
      } else if (!active && activePomodoro) {
        // Active pomodoro ended
        if (persistentTimer.state.phase === "completed" || persistentTimer.state.phase === "idle") {
          setActivePomodoro(null);
          persistentTimer.reset();
          blurtingSession.resetSession();
        }
      }
    };

    checkActivePomodoro();
    const interval = setInterval(checkActivePomodoro, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, activePomodoro, persistentTimer.state.phase]);

  // Start timer when activePomodoro is set AND timer is not already running
  React.useEffect(() => {
    if (activePomodoro && persistentTimer.state.phase === "idle" && !persistentTimer.state.isRunning) {
      // Request notification permission if not already granted
      if (notifications.permission === "default") {
        notifications.requestPermission();
      }

      // Pass explicit durations to avoid stale closure issues
      persistentTimer.start(activePomodoro.inputDuration, activePomodoro.outputDuration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePomodoro, persistentTimer.state.phase, persistentTimer.state.isRunning, notifications.permission]);

  // Auto-complete session when blurting timer reaches 0 (phase becomes "completed")
  React.useEffect(() => {
    if (persistentTimer.state.phase === "completed" && activePomodoro && showBlurtingModal) {
      // Timer ended - auto-complete the session
      const blurtingText = blurtingSession.state.blurtingText;
      blurtingSession.endSession();
      setShowBlurtingModal(false);
      handleTimerComplete(blurtingText);
      // Send completion notification
      notifications.notifyPhaseChange("completed", activePomodoro.title);
      setActivePomodoro(null);
      persistentTimer.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistentTimer.state.phase]);

  // Drag state
  interface DragState {
    isDragging: boolean;
    mode: 'create' | 'move' | 'resize';
    startDay: Date | null;
    startMinutes: number;
    currentDay: Date | null;
    currentMinutes: number;
    activeEventId: string | null;
    initialEventStart: Date | null;
    initialEventEnd: Date | null;
    dragOffsetMinutes: number;
    startX?: number;
    startY?: number;
  }

  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
    mode: 'create',
    startDay: null,
    startMinutes: 0,
    currentDay: null,
    currentMinutes: 0,
    activeEventId: null,
    initialEventStart: null,
    initialEventEnd: null,
    dragOffsetMinutes: 0,
    startX: 0,
    startY: 0,
  });

  // Refs for performance optimization (mutable drag state)
  const dragPreviewRef = React.useRef<HTMLDivElement>(null);
  const dragDataRef = React.useRef<{
    currentMinutes: number;
    currentDay: Date | null;
  }>({
    currentMinutes: 0,
    currentDay: null,
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Mini calendar days
  const miniMonthStart = startOfMonth(miniCalendarDate);
  const miniMonthEnd = endOfMonth(miniCalendarDate);
  const miniCalendarStart = startOfWeek(miniMonthStart, { weekStartsOn: 0 });
  const miniCalendarEnd = endOfWeek(miniMonthEnd, { weekStartsOn: 0 });
  const miniCalendarDays = eachDayOfInterval({ start: miniCalendarStart, end: miniCalendarEnd });

  // Load events
  const weekStartISO = weekStart.toISOString();
  const weekEndISO = weekEnd.toISOString();

  const loadEvents = React.useCallback(async () => {
    const params = new URLSearchParams({
      start: weekStartISO,
      end: weekEndISO,
    });

    const response = await fetch(`/api/events?${params.toString()}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { events: EventRecord[] };
    setEvents(payload.events ?? []);
  }, [weekStartISO, weekEndISO]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Scroll to current time on mount
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      const initialNow = new Date();
      const scrollTop = initialNow.getHours() * SLOT_HEIGHT - 100;
      scrollContainerRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, []);

  // Update 'now' every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const goToToday = () => {
    setCurrentDate(new Date());
    setMiniCalendarDate(new Date());
  };

  const goToPrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToPrevMonth = () => setMiniCalendarDate(subMonths(miniCalendarDate, 1));
  const goToNextMonth = () => setMiniCalendarDate(addMonths(miniCalendarDate, 1));

  const selectDateFromMiniCalendar = (date: Date) => {
    setCurrentDate(date);
  };

  // Handle mouse down on time slot
  const handleMouseDown = (e: React.MouseEvent, day: Date, hour: number) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();

    // Get the clicked time-slot's position
    const slotElement = e.currentTarget as HTMLElement;
    const slotRect = slotElement.getBoundingClientRect();

    // Calculate the offset within the clicked slot (0-60 pixels = 0-60 minutes)
    const offsetY = e.clientY - slotRect.top;

    // Calculate total raw minutes from midnight
    const rawMinutes = hour * 60 + offsetY;

    // Round to nearest 15 minutes (e.g., 11:52 -> 11:45, 11:58 -> 12:00)
    const startMinutes = Math.round(rawMinutes / 15) * 15;

    // Clamp to valid range (0 to 24 hours)
    const clampedStartMinutes = Math.max(0, Math.min(24 * 60 - 15, startMinutes));

    // Init update ref
    dragDataRef.current = {
      currentMinutes: clampedStartMinutes + 30,
      currentDay: day,
    };

    setDragState({
      isDragging: true,
      mode: 'create',
      startDay: day,
      startMinutes: clampedStartMinutes,
      currentDay: day,
      currentMinutes: clampedStartMinutes + 30, // Default 30 min
      activeEventId: null,
      initialEventStart: null,
      initialEventEnd: null,
      dragOffsetMinutes: 0,
    });
  };

  // Handle mouse down on event (for move)
  const handleEventMouseDown = (e: React.MouseEvent, event: EventRecord, day: Date) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    // Block move for completed pomodoros
    if (isCompletedPomodoro(event)) {
      setCompletedPomodoroWarning(true);
      setTimeout(() => setCompletedPomodoroWarning(false), 3000);
      return;
    }

    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    // Calculate offset from event start
    const slotElement = (e.target as HTMLElement).closest('.time-slot');
    if (!slotElement) return;

    const rect = slotElement.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickHour = parseInt(slotElement.parentElement?.querySelector('.time-label')?.textContent || "0"); // Rough estimation, better to use passed data if possible

    // Better approach: calculate based on the mouse position relative to the grid
    // But we can just use the event start time vs mouse time calculated in mouse move/down
    // For now, let's calculate the minute difference between click time and event start time

    // Actually, we can just use the exact start time of the event
    // and when dragging, we apply the delta

    // Let's use the mouse position to get "click minutes"
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const clickMinutes = Math.round(relativeY / 15) * 15;

    // Calculate offset
    const eventStartMinutes = start.getHours() * 60 + start.getMinutes();
    const dragOffsetMinutes = clickMinutes - eventStartMinutes;

    // Init update ref
    dragDataRef.current = {
      currentMinutes: eventStartMinutes,
      currentDay: day,
    };

    setDragState({
      isDragging: false, // Wait for threshold
      mode: 'move',
      startDay: day, // This acts as the "anchor" day
      startMinutes: eventStartMinutes,
      currentDay: day,
      currentMinutes: eventStartMinutes,
      activeEventId: event.id,
      initialEventStart: start,
      initialEventEnd: end,
      dragOffsetMinutes: dragOffsetMinutes,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  // Handle mouse down on resize handle
  const handleResizeMouseDown = (e: React.MouseEvent, event: EventRecord, day: Date) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    // Block resize for completed pomodoros
    if (isCompletedPomodoro(event)) {
      setCompletedPomodoroWarning(true);
      setTimeout(() => setCompletedPomodoroWarning(false), 3000);
      return;
    }

    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    // Init update ref
    dragDataRef.current = {
      currentMinutes: endMinutes,
      currentDay: day,
    };

    setDragState({
      isDragging: false, // Wait for threshold
      mode: 'resize',
      startDay: day,
      startMinutes: startMinutes,
      currentDay: day,
      currentMinutes: endMinutes,
      activeEventId: event.id,
      initialEventStart: start,
      initialEventEnd: end,
      dragOffsetMinutes: 0,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  // Handle mouse move
  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    // If not dragging and no active event pending, return
    if ((!dragState.isDragging && !dragState.activeEventId && dragState.mode !== 'create') || !gridRef.current) return;

    // Check threshold for move/resize if not yet dragging
    if (!dragState.isDragging && (dragState.mode === 'move' || dragState.mode === 'resize')) {
      const dx = e.clientX - (dragState.startX || 0);
      const dy = e.clientY - (dragState.startY || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 5) return; // Threshold not met

      // Start dragging - triggers ONE re-render to show preview
      setDragState(prev => ({ ...prev, isDragging: true }));
      // Stop here for this frame, let the re-render happen so the ref is attached
      return;
    }

    const grid = gridRef.current;
    const gridRect = grid.getBoundingClientRect();

    // Calculate Y position relative to the grid
    const relativeY = e.clientY - gridRect.top;

    // Convert to minutes (1px = 1 minute in our grid) and round to 15 min
    const minutes = Math.round(relativeY / 15) * 15;
    const clampedMinutes = Math.max(0, Math.min(24 * 60, minutes));

    // Calculate current day index based on X position
    const dayWidth = (gridRect.width - 64) / 7; // 64px is time label width
    const mouseX = e.clientX - gridRect.left - 64;
    const dayIndex = Math.floor(mouseX / dayWidth);
    const clampedDayIndex = Math.max(0, Math.min(6, dayIndex));
    const newDay = weekDays[clampedDayIndex];

    // Update refs
    dragDataRef.current = {
      currentMinutes: dragState.mode === 'move'
        ? Math.round((clampedMinutes - dragState.dragOffsetMinutes) / 15) * 15
        : (dragState.mode === 'resize'
          ? Math.max(dragState.startMinutes + 15, clampedMinutes)
          : clampedMinutes),
      currentDay: newDay
    };

    // --- Direct DOM Manipulation ---
    if (dragPreviewRef.current) {
      const el = dragPreviewRef.current;
      const data = dragDataRef.current;

      // Update Position/Size
      if (dragState.mode === 'create') {
        const start = Math.min(dragState.startMinutes, data.currentMinutes);
        const end = Math.max(dragState.startMinutes, data.currentMinutes);
        el.style.top = `${start}px`;
        el.style.height = `${end - start}px`;
        el.style.left = `calc(64px + ${clampedDayIndex} * ((100% - 64px) / 7) + 4px)`;

        // Text Update
        const textEl = el.querySelector('.time-display');
        if (textEl && dragState.startDay) {
          textEl.textContent = `${format(addMinutes(startOfDay(dragState.startDay), start), "h:mm a")} - ${format(addMinutes(startOfDay(dragState.startDay), end), "h:mm a")}`;
        }

      } else if (dragState.mode === 'move') {
        const duration = differenceInMinutes(dragState.initialEventEnd!, dragState.initialEventStart!);
        el.style.top = `${data.currentMinutes}px`;
        el.style.left = `calc(64px + ${clampedDayIndex} * ((100% - 64px) / 7) + 4px)`;

        const textEl = el.querySelector('.time-display');
        if (textEl && dragState.startDay) {
          // Use currentDay from ref (newDay) which might be different from startDay
          const startBase = startOfDay(newDay);
          const start = addMinutes(startBase, data.currentMinutes);
          const end = addMinutes(start, duration);
          textEl.textContent = `${format(start, "h:mm")} - ${format(end, "h:mm a")}`;
        }

      } else if (dragState.mode === 'resize') {
        const start = dragState.startMinutes;
        const end = data.currentMinutes;
        const duration = end - start;
        el.style.height = `${Math.max(15, duration)}px`;

        const textEl = el.querySelector('.time-display');
        if (textEl && dragState.startDay) {
          const startBase = startOfDay(dragState.startDay);
          textEl.textContent = `${format(addMinutes(startBase, start), "h:mm")} - ${format(addMinutes(startBase, end), "h:mm a")}`;
        }
      }
    }
  }, [dragState.isDragging, dragState.mode, dragState.activeEventId, dragState.dragOffsetMinutes, dragState.startMinutes, dragState.startDay, dragState.initialEventEnd, dragState.initialEventStart, dragState.startX, dragState.startY, weekDays]);

  // Handle mouse up
  const handleMouseUp = React.useCallback(async () => {
    // If we have no active interaction setup, return
    if (!dragState.startDay) return;

    // Handle "click" case: mouse up but never dragged (threshold not met)
    if (!dragState.isDragging) {
      if ((dragState.mode === 'move' || dragState.mode === 'resize') && dragState.activeEventId) {
        // Find the event and open details/modal
        const event = events.find(e => e.id === dragState.activeEventId);
        if (event) {
          setEditingEvent(event);
          setCreateModalInitialDate(new Date(event.startAt));
          setCreateModalInitialEndDate(new Date(event.endAt));
          setDialogOpen(true);
        }
      }

      // Reset state and return
      setDragState({
        isDragging: false,
        mode: 'create',
        startDay: null,
        startMinutes: 0,
        currentDay: null,
        currentMinutes: 0,
        activeEventId: null,
        initialEventStart: null,
        initialEventEnd: null,
        dragOffsetMinutes: 0,
        startX: 0,
        startY: 0,
      });
      return;
    }

    // Capture final values from ref before resetting state
    const finalData = dragDataRef.current;

    // Optimistically reset drag state immediately to stop UI dragging
    const currentMode = dragState.mode;
    const currentActiveId = dragState.activeEventId;
    const currentInitialStart = dragState.initialEventStart;
    const currentInitialEnd = dragState.initialEventEnd;
    const currentStartDay = dragState.startDay;
    const currentStartMinutes = dragState.startMinutes;

    setDragState({
      isDragging: false,
      mode: 'create',
      startDay: null,
      startMinutes: 0,
      currentDay: null,
      currentMinutes: 0,
      activeEventId: null,
      initialEventStart: null,
      initialEventEnd: null,
      dragOffsetMinutes: 0,
      startX: 0,
      startY: 0,
    });

    if (currentMode === 'create') {
      const startMinutes = Math.min(currentStartMinutes, finalData.currentMinutes);
      const endMinutes = Math.max(currentStartMinutes, finalData.currentMinutes);
      const duration = endMinutes - startMinutes;

      if (duration >= 15 && currentStartDay) {
        const startDate = addMinutes(startOfDay(currentStartDay), startMinutes);
        const endDate = addMinutes(startOfDay(currentStartDay), endMinutes);

        setCreateModalInitialDate(startDate);
        setCreateModalInitialEndDate(endDate);
        setDialogOpen(true);
      }
    } else if (currentMode === 'move' && currentActiveId && currentInitialEnd && currentInitialStart) {
      const originalDuration = differenceInMinutes(currentInitialEnd, currentInitialStart);

      // Calculate new start time
      // Use currentDay from REF
      const finalDay = finalData.currentDay || currentStartDay;
      if (finalDay) {
        const newStartBase = startOfDay(finalDay);
        const newStart = addMinutes(newStartBase, finalData.currentMinutes);
        const newEnd = addMinutes(newStart, originalDuration);

        const event = events.find(e => e.id === currentActiveId);
        if (event) {
          // Optimistic UI Update - instant visual feedback
          setEvents(prev => prev.map(e => e.id === event.id ? {
            ...e,
            startAt: newStart.toISOString(),
            endAt: newEnd.toISOString()
          } : e));

          // Sync with server in background (fire-and-forget, no state update on response)
          fetch("/api/events", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: event.id,
              title: event.title,
              description: event.description || null,
              startAt: newStart.toISOString(),
              endAt: newEnd.toISOString(),
              color: event.color || "#EA2831",
              categoryId: event.categoryId,
              isPomodoro: event.isPomodoro,
              inputDuration: event.inputDuration,
              outputDuration: event.outputDuration,
              isRecurring: event.isRecurring,
              rrule: event.rrule,
            }),
          });
        }
      }
    } else if (currentMode === 'resize' && currentActiveId && currentInitialStart) {
      if (currentStartDay) {
        const newEnd = addMinutes(startOfDay(currentStartDay), finalData.currentMinutes);

        const event = events.find(e => e.id === currentActiveId);
        if (event) {
          // Optimistic UI Update - instant visual feedback
          setEvents(prev => prev.map(e => e.id === event.id ? {
            ...e,
            endAt: newEnd.toISOString()
          } : e));

          // Sync with server in background (fire-and-forget, no state update on response)
          fetch("/api/events", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: event.id,
              title: event.title,
              description: event.description || null,
              startAt: currentInitialStart.toISOString(),
              endAt: newEnd.toISOString(),
              color: event.color || "#EA2831",
              categoryId: event.categoryId,
              isPomodoro: event.isPomodoro,
              inputDuration: event.inputDuration,
              outputDuration: event.outputDuration,
              isRecurring: event.isRecurring,
              rrule: event.rrule,
            }),
          });
        }
      }
    }
  }, [dragState, events]);

  // Add global mouse event listeners for drag
  React.useEffect(() => {
    if (dragState.startDay) { // Listen if we started an interaction (click/drag)
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState.startDay, handleMouseMove, handleMouseUp]);

  const openDialogForSlot = (date: Date, hour: number) => {
    const start = setMinutes(setHours(date, hour), 0);
    const end = setMinutes(setHours(date, hour + 1), 0);
    setCreateModalInitialDate(start);
    setCreateModalInitialEndDate(end);
    setDialogOpen(true);
  };

  const handleEventSave = async (formData: EventFormData) => {
    setIsSubmitting(true);

    const payload = {
      title: formData.title,
      description: formData.description || null,
      startAt: new Date(formData.startAt).toISOString(),
      endAt: new Date(formData.endAt).toISOString(),
      color: formData.color || "#EA2831",
      categoryId: formData.categoryId,
      isPomodoro: formData.isPomodoro,
      inputDuration: formData.inputDuration,
      outputDuration: formData.outputDuration,
      isRecurring: formData.isRecurring,
      rrule: formData.rrule,
    };

    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as { event: EventRecord };
      setEvents((prev) => [data.event, ...prev]);
      setDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startAt);
      return isSameDay(eventStart, date);
    });
  };

  // Check if two events overlap
  const eventsOverlap = (event1: EventRecord, event2: EventRecord) => {
    const start1 = new Date(event1.startAt).getTime();
    const end1 = new Date(event1.endAt).getTime();
    const start2 = new Date(event2.startAt).getTime();
    const end2 = new Date(event2.endAt).getTime();
    return start1 < end2 && start2 < end1;
  };

  // Calculate layout for overlapping events
  const calculateEventLayout = React.useCallback((dayEvents: EventRecord[]) => {
    if (dayEvents.length === 0) return new Map<string, { column: number; totalColumns: number }>();

    // Sort by start time, then by duration (longer events first)
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const startDiff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      if (startDiff !== 0) return startDiff;
      const durationA = new Date(a.endAt).getTime() - new Date(a.startAt).getTime();
      const durationB = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
      return durationB - durationA;
    });

    const layoutMap = new Map<string, { column: number; totalColumns: number }>();
    const columns: EventRecord[][] = [];

    for (const event of sortedEvents) {
      // Find the first column where this event doesn't overlap with existing events
      let columnIndex = 0;
      let placed = false;

      while (!placed) {
        if (!columns[columnIndex]) {
          columns[columnIndex] = [];
        }

        const hasOverlap = columns[columnIndex].some((existingEvent) =>
          eventsOverlap(event, existingEvent)
        );

        if (!hasOverlap) {
          columns[columnIndex].push(event);
          layoutMap.set(event.id, { column: columnIndex, totalColumns: 0 });
          placed = true;
        } else {
          columnIndex++;
        }
      }
    }

    // Calculate total columns for each event based on its overlap group
    for (const event of sortedEvents) {
      const overlappingEvents = sortedEvents.filter((e) => eventsOverlap(event, e));
      const maxColumn = Math.max(...overlappingEvents.map((e) => layoutMap.get(e.id)?.column ?? 0));
      const layout = layoutMap.get(event.id);
      if (layout) {
        layout.totalColumns = maxColumn + 1;
      }
    }

    return layoutMap;
  }, []);

  // Memoize event layouts for each day
  const eventLayouts = React.useMemo(() => {
    const layouts = new Map<string, Map<string, { column: number; totalColumns: number }>>();
    for (const day of weekDays) {
      const dayKey = format(day, "yyyy-MM-dd");
      // Inline getEventsForDay logic to avoid dependency issues
      const dayEvents = events.filter((event) => {
        const eventStart = new Date(event.startAt);
        return isSameDay(eventStart, day);
      });
      layouts.set(dayKey, calculateEventLayout(dayEvents));
    }
    return layouts;
  }, [weekDays, events, calculateEventLayout]);

  // Calculate event position and height (relative to the hour slot)
  const getEventStyle = (event: EventRecord, dayKey: string) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    // Get minutes within the hour (0-59) for top position
    const minutesInHour = start.getMinutes();
    const durationMinutes = differenceInMinutes(end, start);

    // Get layout info for overlapping events
    const dayLayout = eventLayouts.get(dayKey);
    const layout = dayLayout?.get(event.id);
    const column = layout?.column ?? 0;
    const totalColumns = layout?.totalColumns ?? 1;

    // Calculate width and left position based on columns
    const widthPercent = 100 / totalColumns;
    const leftPercent = column * widthPercent;

    // Use actual duration in pixels (1 minute = 1px)
    // Minimum height of 15px for very short events to ensure visibility
    const heightPx = Math.max(durationMinutes, 15);

    return {
      top: `${minutesInHour}px`,
      height: `${heightPx}px`,
      width: `calc(${widthPercent}% - 8px)`,
      left: `calc(${leftPercent}% + 4px)`,
    };
  };

  // Current time indicator position
  const getCurrentTimePosition = () => {
    const dayStart = startOfDay(now);
    const minutes = differenceInMinutes(now, dayStart);
    // 1 minute = (SLOT_HEIGHT / 60) pixels. Since SLOT_HEIGHT = 60, it's 1px/min.
    return minutes * (SLOT_HEIGHT / 60);
  };

  const currentTimePosition = getCurrentTimePosition();

  const handleEventClick = (event: EventRecord, e: React.MouseEvent) => {
    void e; // Suppress unused parameter warning

    // If this is the currently active pomodoro, show timer modal
    if (activePomodoro && activePomodoro.id === event.id) {
      setTimerModalOpen(true);
      return;
    }

    // All other events open edit modal
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleEventUpdate = async (formData: EventFormData & { id: string }) => {
    setIsSubmitting(true);

    const payload = {
      id: formData.id,
      title: formData.title,
      description: formData.description || null,
      startAt: new Date(formData.startAt).toISOString(),
      endAt: new Date(formData.endAt).toISOString(),
      color: formData.color || "#EA2831",
      categoryId: formData.categoryId,
      isPomodoro: formData.isPomodoro,
      inputDuration: formData.inputDuration,
      outputDuration: formData.outputDuration,
      isRecurring: formData.isRecurring,
      rrule: formData.rrule,
    };

    const response = await fetch("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as { event: EventRecord };
      setEvents((prev) =>
        prev.map((e) => (e.id === data.event.id ? data.event : e))
      );
      setDialogOpen(false);
      setEditingEvent(null);
    }
    setIsSubmitting(false);
  };

  const handleEventDelete = async (eventId: string) => {
    setIsSubmitting(true);

    const response = await fetch(`/api/events?id=${eventId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setDialogOpen(false);
      setEditingEvent(null);

      // If deleting the active pomodoro, stop the timer
      if (activePomodoro && activePomodoro.id === eventId) {
        setActivePomodoro(null);
        setTimerModalOpen(false);
        setShowBlurtingModal(false);
        persistentTimer.reset();
        blurtingSession.resetSession();
      }
    }
    setIsSubmitting(false);
  };

  const handleTimerComplete = async (blurtingText: string) => {
    if (!activePomodoro) return;

    try {
      const response = await fetch("/api/pomodoro-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: activePomodoro.id,
          blurtingText,
          inputMinutes: activePomodoro.inputDuration,
          outputMinutes: activePomodoro.outputDuration,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save pomodoro log");
      }
    } catch (error) {
      console.error("Error saving pomodoro log:", error);
      // Ideally show a toast error here
    }
  };

  // Calculate drag preview
  const getDragPreviewStyle = () => {
    if (!dragState.isDragging || !dragState.startDay) return null;

    // Default create mode logic
    if (dragState.mode === 'create') {
      const startMinutes = Math.min(dragState.startMinutes, dragState.currentMinutes);
      const endMinutes = Math.max(dragState.startMinutes, dragState.currentMinutes);
      const duration = endMinutes - startMinutes;

      const dayIndex = weekDays.findIndex((d) => isSameDay(d, dragState.startDay!));
      if (dayIndex === -1) return null;

      return {
        top: `${startMinutes}px`,
        height: `${duration}px`,
        left: `calc(64px + ${dayIndex} * ((100% - 64px) / 7) + 4px)`,
        width: `calc((100% - 64px) / 7 - 8px)`,
        type: 'create',
      };
    }

    // Move and Resize modes
    if ((dragState.mode === 'move' || dragState.mode === 'resize') && dragState.initialEventStart && dragState.initialEventEnd && dragState.activeEventId) {
      const event = events.find(e => e.id === dragState.activeEventId);
      if (!event) return null;

      let startMinutes = 0;
      let duration = 0;
      let dayIndex = 0;

      if (dragState.mode === 'move') {
        // Use currentDay and currentMinutes
        startMinutes = dragState.currentMinutes;
        duration = differenceInMinutes(dragState.initialEventEnd, dragState.initialEventStart);

        const currentDay = dragState.currentDay || dragState.startDay;
        dayIndex = weekDays.findIndex((d) => isSameDay(d, currentDay!));
      } else { // resize
        startMinutes = dragState.startMinutes; // Start time is fixed
        const endMinutes = dragState.currentMinutes;
        duration = endMinutes - startMinutes;

        dayIndex = weekDays.findIndex((d) => isSameDay(d, dragState.startDay!));
      }

      if (dayIndex === -1) return null;

      return {
        top: `${startMinutes}px`,
        height: `${Math.max(15, duration)}px`,
        left: `calc(64px + ${dayIndex} * ((100% - 64px) / 7) + 4px)`,
        width: `calc((100% - 64px) / 7 - 8px)`, // Full width column for now (simplified)
        type: dragState.mode,
        event: event,
      };
    }

    return null;
  };

  const dragPreview = getDragPreviewStyle();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="text-primary">
              <span className="material-symbols-outlined text-3xl">event_repeat</span>
            </div>
            <h1 className="text-xl font-medium tracking-tight">Pomodoro</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="px-4 py-2 rounded-lg text-sm font-medium"
              onClick={goToToday}
            >
              Today
            </Button>
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                onClick={goToPrevWeek}
              >
                <span className="material-symbols-outlined text-xl">chevron_left</span>
              </button>
              <button
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                onClick={goToNextWeek}
              >
                <span className="material-symbols-outlined text-xl">chevron_right</span>
              </button>
            </div>
            <h2 className="text-xl font-normal text-muted-foreground ml-2">
              {format(currentDate, "MMMM yyyy")}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Show Mini Timer when pomodoro is active, otherwise show search */}
          {activePomodoro && persistentTimer.state.phase !== "idle" ? (
            <MiniTimer
              remainingSeconds={persistentTimer.state.remainingSeconds}
              phase={persistentTimer.state.phase}
              eventTitle={activePomodoro.title}
              onClick={() => setTimerModalOpen(true)}
            />
          ) : (
            <div className="relative flex items-center bg-muted rounded-lg px-3 py-1.5 w-64">
              <span className="material-symbols-outlined text-muted-foreground text-lg mr-2">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm p-0 w-full placeholder-muted-foreground focus:outline-none"
                placeholder="Search events"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-2 border-l border-border pl-4 ml-2">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="ml-2">
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex flex-col border-r border-border bg-card p-4 overflow-y-auto">
          <button
            className="flex items-center gap-3 bg-card border border-border hover:shadow-md transition-shadow py-3 px-5 rounded-full text-sm font-medium mb-8"
            onClick={() => {
              const now = new Date();
              openDialogForSlot(now, now.getHours());
            }}
          >
            <span className="material-symbols-outlined text-primary text-2xl">add</span>
            Create
          </button>

          {/* Mini Calendar */}
          <div className="mb-8">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-sm font-medium">{format(miniCalendarDate, "MMMM yyyy")}</span>
              <div className="flex gap-1">
                <span
                  className="material-symbols-outlined text-lg cursor-pointer hover:bg-muted rounded p-0.5"
                  onClick={goToPrevMonth}
                >
                  chevron_left
                </span>
                <span
                  className="material-symbols-outlined text-lg cursor-pointer hover:bg-muted rounded p-0.5"
                  onClick={goToNextMonth}
                >
                  chevron_right
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground mb-2">
              {MINI_WEEKDAYS.map((day, i) => (
                <span key={i}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 text-center text-xs gap-y-1">
              {miniCalendarDays.map((day, i) => {
                const isCurrentMonth = isSameMonth(day, miniCalendarDate);
                const isSelected = isSameDay(day, currentDate);
                const isTodayDate = isToday(day);

                return (
                  <span
                    key={i}
                    className={`py-1 cursor-pointer rounded-full transition-colors ${!isCurrentMonth
                      ? "text-muted-foreground/40"
                      : isSelected
                        ? "bg-primary text-primary-foreground"
                        : isTodayDate
                          ? "bg-primary/20 text-primary font-semibold"
                          : "hover:bg-muted"
                      }`}
                    onClick={() => selectDateFromMiniCalendar(day)}
                  >
                    {format(day, "d")}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Calendar Filters */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              My Calendars
            </h3>
            <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-muted rounded cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-sm">Deep Work</span>
            </label>
            <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-muted rounded cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-sm">Quick Break</span>
            </label>
            <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-muted rounded cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-sm">Meetings</span>
            </label>
          </div>
        </aside>

        {/* Main Calendar */}
        <main className="flex-1 flex flex-col overflow-hidden bg-card">
          {/* Days Header */}
          <div className="calendar-grid border-b border-border sticky top-0 bg-card z-10">
            <div className="w-16"></div>
            {weekDays.map((day, i) => (
              <div key={i} className="flex flex-col items-center py-3">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  {WEEKDAYS[getDay(day)]}
                </span>
                <span
                  className={`text-2xl font-light ${isToday(day) ? "bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center" : ""
                    }`}
                >
                  {format(day, "d")}
                </span>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-y-auto relative ${dragState.isDragging ? "select-none" : ""}`}
          >
            {/* Current Time Indicator */}
            {weekDays.some((day) => isToday(day)) && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{
                  top: `${currentTimePosition}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                <div className="w-16 flex justify-end pr-2">
                  <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-sm font-bold shadow-sm">
                    {format(now, "h:mm")}
                  </span>
                </div>
                <div className="flex-1 h-[2px] bg-primary relative">
                  <div className="absolute -left-1 -top-[4px] w-2.5 h-2.5 rounded-full bg-primary border-2 border-card shadow-sm"></div>
                </div>
              </div>
            )}

            <div ref={gridRef} className="calendar-grid relative">
              {/* Column lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                <div className="w-16 border-r border-border"></div>
                {weekDays.map((_, i) => (
                  <div key={i} className="flex-1 border-r border-border last:border-r-0"></div>
                ))}
              </div>

              {/* Drag Preview */}
              {dragPreview && (
                dragPreview.type === 'create' ? (
                  <div
                    ref={dragPreviewRef}
                    className="absolute bg-primary/30 border-2 border-primary border-dashed rounded-lg z-30 pointer-events-none"
                    style={{
                      top: dragPreview.top,
                      height: dragPreview.height,
                      left: dragPreview.left,
                      width: dragPreview.width,
                    }}
                  >
                    <div className="p-2 text-xs font-medium text-primary time-display">
                      {format(addMinutes(startOfDay(dragState.startDay!), Math.min(dragState.startMinutes, dragState.currentMinutes)), "h:mm a")}
                      {" - "}
                      {format(addMinutes(startOfDay(dragState.startDay!), Math.max(dragState.startMinutes, dragState.currentMinutes)), "h:mm a")}
                    </div>
                  </div>
                ) : (
                  dragPreview.event && (
                    <div
                      ref={dragPreviewRef}
                      className={`absolute p-2 rounded-lg text-xs font-medium shadow-lg z-30 overflow-hidden pointer-events-none opacity-80 ${dragPreview.event.isPomodoro
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary border-l-4 border-primary"
                        }`}
                      style={{
                        top: dragPreview.top,
                        height: dragPreview.height,
                        left: dragPreview.left,
                        width: dragPreview.width,
                      }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="truncate">{dragPreview.event.title}</span>
                        {dragPreview.event.isPomodoro && (
                          <span className="material-symbols-outlined text-[14px]">timer</span>
                        )}
                      </div>
                      <span className={`text-[10px] time-display ${dragPreview.event.isPomodoro ? "opacity-80" : ""}`}>
                        {/* Calculate time based on current position */}
                        {dragState.mode === 'move' ? (
                          <>
                            {format(addMinutes(startOfDay(dragState.currentDay || dragState.startDay!), dragState.currentMinutes), "h:mm")} -{" "}
                            {format(addMinutes(startOfDay(dragState.currentDay || dragState.startDay!), dragState.currentMinutes + differenceInMinutes(new Date(dragPreview.event.endAt), new Date(dragPreview.event.startAt))), "h:mm a")}
                          </>
                        ) : (
                          <>
                            {format(new Date(dragPreview.event.startAt), "h:mm")} -{" "}
                            {format(addMinutes(startOfDay(dragState.startDay!), dragState.currentMinutes), "h:mm a")}
                          </>
                        )}
                      </span>
                    </div>
                  )
                )
              )}

              {/* Time rows */}
              {HOURS.map((hour) => (
                <React.Fragment key={hour}>
                  <div className="time-label text-right pr-3 text-[11px] text-muted-foreground pt-1 border-r border-border">
                    {formatHour(hour)}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayEvents = getEventsForDay(day).filter((event) => {
                      const eventHour = new Date(event.startAt).getHours();
                      return eventHour === hour;
                    });

                    return (
                      <div
                        key={dayIndex}
                        className="time-slot relative cursor-crosshair hover:bg-primary/5 transition-colors"
                        onMouseDown={(e) => handleMouseDown(e, day, hour)}
                      >
                        {dayEvents.map((event) => {
                          const style = getEventStyle(event, dayKey);
                          const isPomodoroEvent = event.isPomodoro;

                          return (
                            <div
                              key={event.id}
                              className={`absolute rounded-lg text-xs font-medium shadow-sm z-10 overflow-hidden hover:opacity-90 transition-opacity ${isPomodoroEvent
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary border-l-4 border-primary"
                                } ${dragState.activeEventId === event.id ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                              style={style}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event, e);
                              }}
                              onMouseDown={(e) => handleEventMouseDown(e, event, day)}
                            >
                              <div className="p-2 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-0.5 pointer-events-none">
                                  <span className="truncate">{event.title}</span>
                                  {isPomodoroEvent && (
                                    <span className="material-symbols-outlined text-[14px]" title="Click to start timer">timer</span>
                                  )}
                                </div>
                                <span className={`text-[10px] pointer-events-none ${isPomodoroEvent ? "opacity-80" : ""}`}>
                                  {format(new Date(event.startAt), "h:mm")} -{" "}
                                  {format(new Date(event.endAt), "h:mm a")}
                                </span>
                              </div>

                              {/* Resize Handle */}
                              <div
                                className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize hover:bg-black/10 z-20"
                                onMouseDown={(e) => handleResizeMouseDown(e, event, day)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Create/Edit Event Modal */}
      <EventCreateModal
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleEventSave}
        onUpdate={handleEventUpdate}
        onDelete={handleEventDelete}
        initialDate={createModalInitialDate}
        initialEndDate={createModalInitialEndDate}
        isSubmitting={isSubmitting}
        editingEvent={editingEvent}
        isDeleteOnly={!!(editingEvent && (
          (activePomodoro && editingEvent.id === activePomodoro.id) ||
          isCompletedPomodoro(editingEvent)
        ))}
      />

      {/* Mobile FAB */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <button
          className="size-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
          onClick={() => {
            const now = new Date();
            openDialogForSlot(now, now.getHours());
          }}
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </div>

      {/* Pomodoro Timer Modal */}
      {activePomodoro && (
        <PomodoroTimerModal
          isOpen={timerModalOpen}
          onClose={() => {
            // Can only close modal, but timer keeps running in header
            setTimerModalOpen(false);
          }}
          eventTitle={activePomodoro.title}
          inputDuration={activePomodoro.inputDuration}
          outputDuration={activePomodoro.outputDuration}
          onComplete={handleTimerComplete}
          eventStartAt={activePomodoro.startAt}
          eventEndAt={activePomodoro.endAt}
          timerState={persistentTimer.state}
          onDebugSkip1Min={persistentTimer.debugSkip1Min}
          onDebugSkip10Min={persistentTimer.debugSkip10Min}
        />
      )}

      {/* Persistent Blurting Modal (shown when in output phase) */}
      {activePomodoro && showBlurtingModal && persistentTimer.state.phase === "output" && (
        <BlurtingModal
          isOpen={true}
          onClose={() => { }} // Cannot close during blurting
          onComplete={(text) => {
            blurtingSession.endSession();
            setShowBlurtingModal(false);
            handleTimerComplete(text);
            // Send completion notification
            notifications.notifyPhaseChange("completed", activePomodoro.title);
            // Session is done - reset everything
            setActivePomodoro(null);
            persistentTimer.reset();
          }}
          eventTitle={activePomodoro.title}
          initialText={blurtingSession.state.blurtingText}
          canComplete={persistentTimer.state.remainingSeconds <= 0}
          remainingSeconds={persistentTimer.state.remainingSeconds}
          totalSeconds={persistentTimer.state.totalSeconds}
          onTextChange={blurtingSession.updateText}
          onDebugSkip1Min={persistentTimer.debugSkip1Min}
        />
      )}

      {/* Completed Pomodoro Warning Toast */}
      {completedPomodoroWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg">
            <span className="material-symbols-outlined">lock</span>
            <span className="font-medium">Completed Pomodoros cannot be edited. Only deletion is allowed.</span>
          </div>
        </div>
      )}
    </div>
  );
}
