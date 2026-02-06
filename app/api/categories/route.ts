import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { CreateCategorySchema, UpdateCategorySchema } from "@/lib/validations";
import { requireAuth } from "@/lib/auth";
import { validateCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";

// GET: Get all categories (public + user's private)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  // Get public categories (isPrivate = false, userId = null)
  const publicCategories = await prisma.category.findMany({
    where: {
      isPrivate: false,
      userId: null,
    },
    orderBy: { title: "asc" },
  });

  // Get user's private categories
  const privateCategories = await prisma.category.findMany({
    where: {
      userId: user.id,
      isPrivate: true,
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({
    categories: [...publicCategories, ...privateCategories],
  });
}

// POST: Create a new category (always private for users)
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
  // Validations
  const result = CreateCategorySchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }
  const body = result.data;

  // Ensure user exists
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

  // Create category (always private for users)
  const category = await prisma.category.create({
    data: {
      userId: user.id,
      title: body.title,
      color: body.color,
      isPrivate: true, // Users can only create private categories
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}

// PUT: Update a category
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
  const result = UpdateCategorySchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }
  const body = result.data;

  if (!body.id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
  }

  // Verify the category belongs to the user
  const existingCategory = await prisma.category.findFirst({
    where: { id: body.id, userId: user.id },
  });

  if (!existingCategory) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const category = await prisma.category.update({
    where: { id: body.id },
    data: {
      title: body.title,
      color: body.color,
      // isPrivate cannot be changed by users (always true)
    },
  });

  return NextResponse.json({ category });
}

// DELETE: Delete a category
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
  const categoryId = searchParams.get("id");

  if (!categoryId) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
  }

  // Verify the category belongs to the user
  const existingCategory = await prisma.category.findFirst({
    where: { id: categoryId, userId: user.id },
  });

  if (!existingCategory) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });

  return NextResponse.json({ success: true });
}
