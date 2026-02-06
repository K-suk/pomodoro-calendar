import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const token = await generateCsrfToken(user.id);

  return NextResponse.json({ token });
}
