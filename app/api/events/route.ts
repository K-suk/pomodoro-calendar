import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { CreateEventSchema, UpdateEventSchema, EventQuerySchema } from "@/lib/validations";
import { requireAuth } from "@/lib/auth";
import { validateCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { searchParams } = new URL(request.url);
  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");

  // Validate query params using Zod
  const queryResult = EventQuerySchema.safeParse({
    start: startRaw ?? undefined,
    end: endRaw ?? undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { start, end } = queryResult.data;

  const where: Record<string, unknown> = { userId: user.id };
  if (start && end) {
    where.AND = [
      { startAt: { lt: new Date(end) } },
      { endAt: { gt: new Date(start) } },
    ];
  } else if (start) {
    where.endAt = { gt: new Date(start) };
  } else if (end) {
    where.startAt = { lt: new Date(end) };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { startAt: "desc" },
  });

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  // Rate Limiting (100 requests / minute)
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Validate CSRF token
  const csrfToken = request.headers.get("X-CSRF-Token");
  const isValidCsrf = await validateCsrfToken(csrfToken || "", user.id);
  if (!isValidCsrf) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "User email required" }, { status: 400 });
  }

  const json = await request.json();
  const result = CreateEventSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const body = result.data;

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined),
      image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    create: {
      id: user.id,
      email: user.email,
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined),
      image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    },
  });

  const event = await prisma.event.create({
    data: {
      userId: user.id,
      title: body.title,
      description: body.description ?? null,
      color: body.color,
      categoryId: body.categoryId ?? null,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      isPomodoro: body.isPomodoro,
      inputDuration: body.inputDuration,
      outputDuration: body.outputDuration,
      isRecurring: body.isRecurring,
      rrule: body.rrule ?? null,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  // Validate CSRF token
  const csrfToken = request.headers.get("X-CSRF-Token");
  const isValidCsrf = await validateCsrfToken(csrfToken || "", user.id);
  if (!isValidCsrf) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const json = await request.json();
  const result = UpdateEventSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const body = result.data;

  // Verify the event belongs to the user
  const existingEvent = await prisma.event.findFirst({
    where: { id: body.id, userId: user.id },
  });

  if (!existingEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const event = await prisma.event.update({
    where: { id: body.id },
    data: {
      title: body.title,
      description: body.description ?? existingEvent.description, // Keep existing if undefined in partial update? careful with partial
      // Ideally UpdateSchema shouldn't be partial if we want full replacement, but here we likely want standard update behavior. 
      // Zod safeParse with partial returns undefined for missing keys.
      // We should use `?? existingEvent.field` only if we intend to allow partial updates.
      // Let's stick to the logic of "if provided in body, update it; otherwise keep existing".
      // But safeParse removes unknown keys, so body only has valid keys.
      color: body.color,
      categoryId: body.categoryId,
      startAt: body.startAt ? new Date(body.startAt) : undefined, // schema makes them optional in partial
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      isPomodoro: body.isPomodoro,
      inputDuration: body.inputDuration,
      outputDuration: body.outputDuration,
      isRecurring: body.isRecurring,
      rrule: body.rrule, // Update rule if provided
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  // Validate CSRF token
  const csrfToken = request.headers.get("X-CSRF-Token");
  const isValidCsrf = await validateCsrfToken(csrfToken || "", user.id);
  if (!isValidCsrf) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("id");

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
  }

  // Verify the event belongs to the user
  const existingEvent = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
  });

  if (!existingEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.event.delete({
    where: { id: eventId },
  });

  return NextResponse.json({ success: true });
}
