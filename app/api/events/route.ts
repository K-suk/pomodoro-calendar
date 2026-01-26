import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

type EventPayload = {
  title?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  color?: string | null;
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
