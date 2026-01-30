
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { eventId, blurtingText, inputMinutes, outputMinutes } = body;

    if (!eventId || inputMinutes === undefined || outputMinutes === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if the event belongs to the user (security check)
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true },
    });

    if (!event) {
       return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.userId !== user.id) {
       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const log = await prisma.pomodoroLog.create({
      data: {
        eventId,
        blurtingText: blurtingText || "",
        inputMinutes,
        outputMinutes,
        actualDate: new Date(),
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Failed to create pomodoro log:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
