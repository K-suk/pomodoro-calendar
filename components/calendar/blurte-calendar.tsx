"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import type { EventInput, DateSelectArg } from "@fullcalendar/core";
import { format } from "date-fns";
import { rrulestr } from "rrule";
import { useCsrf } from "@/hooks/use-csrf";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

type CalendarRange = {
  start: Date;
  end: Date;
};

const weekdayOptions = [
  { label: "Sun", value: "SU" },
  { label: "Mon", value: "MO" },
  { label: "Tue", value: "TU" },
  { label: "Wed", value: "WE" },
  { label: "Thu", value: "TH" },
  { label: "Fri", value: "FR" },
  { label: "Sat", value: "SA" },
];

const weekdayFromDate = (date: Date) => weekdayOptions[date.getDay()]?.value ?? "MO";

const formatDateTimeLocal = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

export function BlurteCalendar() {
  const csrfToken = useCsrf();
  const calendarRef = React.useRef<FullCalendar | null>(null);
  const [events, setEvents] = React.useState<EventRecord[]>([]);
  const [activeRange, setActiveRange] = React.useState<CalendarRange | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [recurrenceDays, setRecurrenceDays] = React.useState<string[]>([]);
  const [formState, setFormState] = React.useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    color: "#3b82f6",
    isPomodoro: false,
    inputDuration: 20,
    outputDuration: 5,
    isRecurring: false,
    rrule: "",
  });

  const loadEvents = React.useCallback(async () => {
    const params = activeRange
      ? new URLSearchParams({
        start: activeRange.start.toISOString(),
        end: activeRange.end.toISOString(),
      })
      : null;

    const response = await fetch(`/api/events${params ? `?${params.toString()}` : ""}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { events: EventRecord[] };
    setEvents(payload.events ?? []);
  }, [activeRange]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const openDialogForRange = React.useCallback((start: Date, end: Date) => {
    const defaultWeekday = weekdayFromDate(start);
    setRecurrenceDays([defaultWeekday]);
    setFormState((prev) => ({
      ...prev,
      title: "",
      description: "",
      startAt: formatDateTimeLocal(start),
      endAt: formatDateTimeLocal(end),
      color: prev.color || "#3b82f6",
      isPomodoro: false,
      inputDuration: 20,
      outputDuration: 5,
      isRecurring: false,
      rrule: `FREQ=WEEKLY;BYDAY=${defaultWeekday}`,
    }));
    setDialogOpen(true);
  }, []);

  const handleSelect = React.useCallback(
    (selection: DateSelectArg) => {
      calendarRef.current?.getApi().unselect();
      openDialogForRange(selection.start, selection.end);
    },
    [openDialogForRange]
  );

  const handleDateClick = React.useCallback(
    (info: DateClickArg) => {
      const start = info.date;
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      openDialogForRange(start, end);
    },
    [openDialogForRange]
  );

  const handleToggleRecurrenceDay = (value: string) => {
    setRecurrenceDays((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    );
  };

  const buildWeeklyRRule = (startAt: string, days: string[]) => {
    const start = startAt ? new Date(startAt) : new Date();
    const fallback = weekdayFromDate(start);
    const byDay = (days.length ? days : [fallback]).join(",");
    return `FREQ=WEEKLY;BYDAY=${byDay}`;
  };

  const handleSubmit = async () => {
    if (!formState.title || !formState.startAt || !formState.endAt) return;
    setIsSubmitting(true);
    const rrule = formState.isRecurring
      ? formState.rrule || buildWeeklyRRule(formState.startAt, recurrenceDays)
      : null;

    const payload = {
      title: formState.title,
      description: formState.description || null,
      startAt: new Date(formState.startAt).toISOString(),
      endAt: new Date(formState.endAt).toISOString(),
      color: formState.color || "#3b82f6",
      isPomodoro: formState.isPomodoro,
      inputDuration: formState.inputDuration,
      outputDuration: formState.outputDuration,
      isRecurring: formState.isRecurring,
      rrule,
    };

    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken || "",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as { event: EventRecord };
      setEvents((prev) => [data.event, ...prev]);
      setDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const displayEvents = React.useMemo<EventInput[]>(() => {
    if (!activeRange) {
      return events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startAt,
        end: event.endAt,
        backgroundColor: event.color ?? "#3b82f6",
        borderColor: event.color ?? "#3b82f6",
        extendedProps: event,
      }));
    }

    const rangeStart = activeRange.start;
    const rangeEnd = activeRange.end;

    return events.flatMap((event) => {
      const baseEvent = {
        title: event.title,
        backgroundColor: event.color ?? "#3b82f6",
        borderColor: event.color ?? "#3b82f6",
        extendedProps: event,
      };

      if (event.isRecurring && event.rrule) {
        try {
          const rule = rrulestr(event.rrule, { dtstart: new Date(event.startAt) });
          const duration =
            new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
          const occurrences = rule.between(rangeStart, rangeEnd, true);

          return occurrences.map((date) => ({
            ...baseEvent,
            id: `${event.id}:${date.toISOString()}`,
            start: date,
            end: new Date(date.getTime() + duration),
          }));
        } catch {
          return [];
        }
      }

      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      if (end < rangeStart || start > rangeEnd) return [];

      return [
        {
          ...baseEvent,
          id: event.id,
          start,
          end,
        },
      ];
    });
  }, [activeRange, events]);

  return (
    <div className="rounded-3xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Blurte Calendar</h2>
          <p className="text-sm text-muted-foreground">
            Drag to schedule focus blocks, enable Pomodoro mode, and sync instantly.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const start = new Date();
            const end = new Date(start.getTime() + 30 * 60 * 1000);
            openDialogForRange(start, end);
          }}
        >
          New Event
        </Button>
      </div>

      <div className="rounded-2xl border bg-background p-2">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridWeek,timeGridDay",
          }}
          height="auto"
          expandRows
          nowIndicator
          selectable
          selectMirror
          editable={false}
          dayMaxEvents={true}
          events={displayEvents}
          select={handleSelect}
          dateClick={handleDateClick}
          datesSet={(info) => setActiveRange({ start: info.start, end: info.end })}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Schedule your focus session and set Pomodoro or recurring options.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Deep work block"
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add details or goals"
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="startAt">Start</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={formState.startAt}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, startAt: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endAt">End</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={formState.endAt}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, endAt: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                className="h-12 w-20 p-1"
                value={formState.color}
                onChange={(event) => setFormState((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
              <div>
                <Label className="text-base">Pomodoro Mode</Label>
                <p className="text-sm text-muted-foreground">Enable timed focus cycles.</p>
              </div>
              <Switch
                checked={formState.isPomodoro}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, isPomodoro: checked }))
                }
              />
            </div>

            {formState.isPomodoro && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="inputDuration">Input Duration (minutes)</Label>
                  <Input
                    id="inputDuration"
                    type="number"
                    min={5}
                    value={formState.inputDuration}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        inputDuration: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="outputDuration">Output Duration (minutes)</Label>
                  <Input
                    id="outputDuration"
                    type="number"
                    min={1}
                    value={formState.outputDuration}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        outputDuration: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
              <div>
                <Label className="text-base">Recurring</Label>
                <p className="text-sm text-muted-foreground">Repeat this event weekly.</p>
              </div>
              <Switch
                checked={formState.isRecurring}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, isRecurring: checked }))
                }
              />
            </div>

            {formState.isRecurring && (
              <div className="grid gap-3 rounded-xl border bg-background p-4">
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((day) => (
                    <label
                      key={day.value}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${recurrenceDays.includes(day.value)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/20 text-muted-foreground"
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={recurrenceDays.includes(day.value)}
                        onChange={() => handleToggleRecurrenceDay(day.value)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rrule">RRule</Label>
                  <Input
                    id="rrule"
                    value={
                      formState.rrule ||
                      buildWeeklyRRule(formState.startAt, recurrenceDays)
                    }
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, rrule: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Uses RFC 5545 format. Example: FREQ=WEEKLY;BYDAY=MO,WE.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
