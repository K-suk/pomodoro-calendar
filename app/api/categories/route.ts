import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

type CategoryPayload = {
  title?: string;
  color?: string;
  isPrivate?: boolean;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// GET: Get all categories (public + user's private)
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "User email required" }, { status: 400 });
  }

  const body = (await request.json()) as CategoryPayload;
  if (!body.title || !body.color) {
    return NextResponse.json({ error: "Title and color are required" }, { status: 400 });
  }

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
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CategoryPayload & { id?: string };
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
      title: body.title ?? existingCategory.title,
      color: body.color ?? existingCategory.color,
      // isPrivate cannot be changed by users (always true)
    },
  });

  return NextResponse.json({ category });
}

// DELETE: Delete a category
export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
