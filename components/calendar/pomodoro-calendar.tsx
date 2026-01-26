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
import { PomodoroTimerModal } from "@/components/pomodoro/pomodoro-timer-modal";
import { EventCreateModal, type EventFormData } from "@/components/calendar/event-create-modal";

type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  startAt: string;
  endAt: string;
  isPomodoro: boolean;
  inputDuration: number;
  outputDuration: number;
  isRecurring: boolean;
  rrule: string | null;
};

type DragState = {
  isDragging: boolean;
  startDay: Date | null;
  startMinutes: number;
  currentDay: Date | null;
  currentMinutes: number;
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
  const [selectedEvent, setSelectedEvent] = React.useState<EventRecord | null>(null);
  const [createModalInitialDate, setCreateModalInitialDate] = React.useState<Date | undefined>();
  const [createModalInitialEndDate, setCreateModalInitialEndDate] = React.useState<Date | undefined>();

  // Drag state
  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
    startDay: null,
    startMinutes: 0,
    currentDay: null,
    currentMinutes: 0,
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
  const loadEvents = React.useCallback(async () => {
    const params = new URLSearchParams({
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    });

    const response = await fetch(`/api/events?${params.toString()}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { events: EventRecord[] };
    setEvents(payload.events ?? []);
  }, [weekStart, weekEnd]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Scroll to current time on mount
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const scrollTop = now.getHours() * SLOT_HEIGHT - 100;
      scrollContainerRef.current.scrollTop = Math.max(0, scrollTop);
    }
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

    setDragState({
      isDragging: true,
      startDay: day,
      startMinutes: clampedStartMinutes,
      currentDay: day,
      currentMinutes: clampedStartMinutes + 30, // Default 30 min
    });
  };

  // Handle mouse move
  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !gridRef.current) return;

    const grid = gridRef.current;
    const gridRect = grid.getBoundingClientRect();

    // Calculate Y position relative to the grid
    // gridRect.top already accounts for scroll position (it's viewport-relative)
    const relativeY = e.clientY - gridRect.top;

    // Convert to minutes (1px = 1 minute in our grid) and round to 15 min
    const minutes = Math.round(relativeY / 15) * 15;

    // Clamp minutes to valid range (0 to 24 hours)
    const clampedMinutes = Math.max(0, Math.min(24 * 60, minutes));

    setDragState((prev) => ({
      ...prev,
      currentMinutes: Math.max(clampedMinutes, prev.startMinutes + 15), // Minimum 15 min
    }));
  }, [dragState.isDragging]);

  // Handle mouse up
  const handleMouseUp = React.useCallback(() => {
    if (!dragState.isDragging || !dragState.startDay) return;

    const startMinutes = Math.min(dragState.startMinutes, dragState.currentMinutes);
    const endMinutes = Math.max(dragState.startMinutes, dragState.currentMinutes);
    const duration = endMinutes - startMinutes;

    if (duration >= 15) {
      const startDate = addMinutes(startOfDay(dragState.startDay), startMinutes);
      const endDate = addMinutes(startOfDay(dragState.startDay), endMinutes);

      setCreateModalInitialDate(startDate);
      setCreateModalInitialEndDate(endDate);
      setDialogOpen(true);
    }

    setDragState({
      isDragging: false,
      startDay: null,
      startMinutes: 0,
      currentDay: null,
      currentMinutes: 0,
    });
  }, [dragState]);

  // Add global mouse event listeners for drag
  React.useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

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
      isPomodoro: formData.isPomodoro,
      inputDuration: formData.inputDuration,
      outputDuration: formData.outputDuration,
      isRecurring: formData.isRecurring,
      rrule: null,
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

  // Calculate event position and height
  const getEventStyle = (event: EventRecord) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const dayStart = startOfDay(start);

    const topMinutes = differenceInMinutes(start, dayStart);
    const durationMinutes = differenceInMinutes(end, start);

    return {
      top: `${topMinutes}px`,
      height: `${Math.max(durationMinutes, 30)}px`,
    };
  };

  // Current time indicator position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const minutes = differenceInMinutes(now, dayStart);
    return minutes;
  };

  const currentTimePosition = getCurrentTimePosition();

  const handleEventClick = (event: EventRecord) => {
    if (event.isPomodoro) {
      setSelectedEvent(event);
      setTimerModalOpen(true);
    }
  };

  const handleTimerComplete = async (blurtingText: string) => {
    if (!selectedEvent) return;

    // TODO: Save blurting log to database
    console.log("Blurting completed:", {
      eventId: selectedEvent.id,
      blurtingText,
    });
  };

  // Calculate drag preview
  const getDragPreviewStyle = () => {
    if (!dragState.isDragging || !dragState.startDay) return null;

    const startMinutes = Math.min(dragState.startMinutes, dragState.currentMinutes);
    const endMinutes = Math.max(dragState.startMinutes, dragState.currentMinutes);
    const duration = endMinutes - startMinutes;

    const dayIndex = weekDays.findIndex((d) => isSameDay(d, dragState.startDay!));
    if (dayIndex === -1) return null;

    return {
      top: `${startMinutes}px`,
      height: `${duration}px`,
      dayIndex,
    };
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
                style={{ top: `${currentTimePosition}px` }}
              >
                <div className="w-16 flex justify-end pr-2">
                  <span className="bg-primary text-primary-foreground text-[10px] px-1 rounded-sm">
                    {format(new Date(), "h:mm")}
                  </span>
                </div>
                <div className="flex-1 h-[1.5px] bg-primary relative">
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card"></div>
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
                <div
                  className="absolute bg-primary/30 border-2 border-primary border-dashed rounded-lg z-30 pointer-events-none"
                  style={{
                    top: dragPreview.top,
                    height: dragPreview.height,
                    left: `calc(64px + ${dragPreview.dayIndex} * ((100% - 64px) / 7) + 4px)`,
                    width: `calc((100% - 64px) / 7 - 8px)`,
                  }}
                >
                  <div className="p-2 text-xs font-medium text-primary">
                    {format(addMinutes(startOfDay(dragState.startDay!), Math.min(dragState.startMinutes, dragState.currentMinutes)), "h:mm a")}
                    {" - "}
                    {format(addMinutes(startOfDay(dragState.startDay!), Math.max(dragState.startMinutes, dragState.currentMinutes)), "h:mm a")}
                  </div>
                </div>
              )}

              {/* Time rows */}
              {HOURS.map((hour) => (
                <React.Fragment key={hour}>
                  <div className="time-label text-right pr-3 text-[11px] text-muted-foreground pt-1 border-r border-border">
                    {formatHour(hour)}
                  </div>
                  {weekDays.map((day, dayIndex) => {
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
                          const style = getEventStyle(event);
                          const isPomodoroEvent = event.isPomodoro;

                          return (
                            <div
                              key={event.id}
                              className={`absolute inset-x-1 p-2 rounded-lg text-xs font-medium shadow-sm z-10 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${isPomodoroEvent
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary border-l-4 border-primary"
                                }`}
                              style={style}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="truncate">{event.title}</span>
                                {isPomodoroEvent && (
                                  <span className="material-symbols-outlined text-[14px]" title="Click to start timer">timer</span>
                                )}
                              </div>
                              <span className={`text-[10px] ${isPomodoroEvent ? "opacity-80" : ""}`}>
                                {format(new Date(event.startAt), "h:mm")} -{" "}
                                {format(new Date(event.endAt), "h:mm a")}
                              </span>
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

      {/* Create Event Modal */}
      <EventCreateModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleEventSave}
        initialDate={createModalInitialDate}
        initialEndDate={createModalInitialEndDate}
        isSubmitting={isSubmitting}
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
      {selectedEvent && (
        <PomodoroTimerModal
          isOpen={timerModalOpen}
          onClose={() => {
            setTimerModalOpen(false);
            setSelectedEvent(null);
          }}
          eventTitle={selectedEvent.title}
          inputDuration={selectedEvent.inputDuration}
          outputDuration={selectedEvent.outputDuration}
          onComplete={handleTimerComplete}
        />
      )}
    </div>
  );
}
