import { z } from 'zod';

// --- Shared Schemas ---

export const UUIDSchema = z.string().uuid("Invalid ID format");
export const DateStringSchema = z.string().datetime("Invalid date format");

// --- Events API Schemas ---

export const EventQuerySchema = z.object({
  start: DateStringSchema.optional(),
  end: DateStringSchema.optional(),
}).refine(data => {
  if (data.start && data.end) {
    return new Date(data.start) < new Date(data.end);
  }
  return true;
}, {
  message: "Start date must be before end date",
  path: ["start"],
});

const EventBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format").default("#3b82f6"),
  categoryId: UUIDSchema.optional().nullable(),
  startAt: DateStringSchema,
  endAt: DateStringSchema,
  isPomodoro: z.boolean().default(false),
  inputDuration: z.number().int().min(1).max(180).default(20), // Max 3 hours focus
  outputDuration: z.number().int().min(0).max(60).default(5), // Max 1 hour break
  isRecurring: z.boolean().default(false),
  rrule: z.string().optional().nullable(),
});

export const CreateEventSchema = EventBaseSchema.refine(data => new Date(data.startAt) < new Date(data.endAt), {
  message: "Start time must be before end time",
  path: ["endAt"],
});

export const UpdateEventSchema = EventBaseSchema.partial().extend({
  id: UUIDSchema,
});

// --- Categories API Schemas ---

export const CreateCategorySchema = z.object({
  title: z.string().min(1, "Title is required").max(50, "Title is too long"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format"),
  isPrivate: z.boolean().default(true),
});

export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  id: UUIDSchema,
});

// --- Pomodoro Logs API Schemas ---

export const CreatePomodoroLogSchema = z.object({
  eventId: UUIDSchema,
  blurtingText: z.string().max(5000, "Blurting text is too long").optional(),
  sessionFeedback: z.string().max(5000, "Feedback text is too long").optional(),
  inputMinutes: z.number().int().min(0, "Duration cannot be negative"),
  outputMinutes: z.number().int().min(0, "Duration cannot be negative"),
});
