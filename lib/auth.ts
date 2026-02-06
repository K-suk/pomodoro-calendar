import { createClient } from "@/utils/supabase/server";
import { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Ensures the request is authenticated.
 * Returns the User object if authenticated, or a NextResponse (401) if not.
 * 
 * Usage:
 * const auth = await requireAuth();
 * if (auth instanceof NextResponse) return auth;
 * const user = auth;
 */
export async function requireAuth(): Promise<User | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}
