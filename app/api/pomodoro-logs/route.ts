
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreatePomodoroLogSchema } from "@/lib/validations";
import { requireAuth } from "@/lib/auth";
import { validateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const user = auth;

    // Validate CSRF token
    const csrfToken = req.headers.get("X-CSRF-Token");
    const isValidCsrf = await validateCsrfToken(csrfToken || "", user.id);
    if (!isValidCsrf) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const json = await req.json();
    const result = CreatePomodoroLogSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { eventId, blurtingText, sessionFeedback, inputMinutes, outputMinutes } = result.data;

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
        sessionFeedback: sessionFeedback || null,
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
