import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const sources = await prisma.scraperSource.findMany({
    orderBy: [{ family: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ sources });
}
