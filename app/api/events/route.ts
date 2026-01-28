import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

type EventPayload = {
  title?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  color?: string | null;
  categoryId?: string | null;
  isPomodoro?: boolean;
  inputDuration?: number;
  outputDuration?: number;
  isRecurring?: boolean;
  rrule?: string | null;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

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
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "User email required" }, { status: 400 });
  }

  const body = (await request.json()) as EventPayload;
  if (!body.title || !body.startAt || !body.endAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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
      color: body.color ?? "#3b82f6",
      categoryId: body.categoryId ?? null,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      isPomodoro: Boolean(body.isPomodoro),
      inputDuration: body.inputDuration ?? 20,
      outputDuration: body.outputDuration ?? 5,
      isRecurring: Boolean(body.isRecurring),
      rrule: body.isRecurring ? body.rrule ?? null : null,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as EventPayload & { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
  }

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
      title: body.title ?? existingEvent.title,
      description: body.description !== undefined ? body.description : existingEvent.description,
      color: body.color ?? existingEvent.color,
      categoryId: body.categoryId !== undefined ? body.categoryId : existingEvent.categoryId,
      startAt: body.startAt ? new Date(body.startAt) : existingEvent.startAt,
      endAt: body.endAt ? new Date(body.endAt) : existingEvent.endAt,
      isPomodoro: body.isPomodoro !== undefined ? Boolean(body.isPomodoro) : existingEvent.isPomodoro,
      inputDuration: body.inputDuration ?? existingEvent.inputDuration,
      outputDuration: body.outputDuration ?? existingEvent.outputDuration,
      isRecurring: body.isRecurring !== undefined ? Boolean(body.isRecurring) : existingEvent.isRecurring,
      rrule: body.isRecurring ? (body.rrule ?? existingEvent.rrule) : null,
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
