import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const companies = await prisma.companyRegistry.findMany({
    orderBy: [{ atsProvider: "asc" }, { name: "asc" }],
  });

  // company_registry.id is a Postgres BIGINT -> Prisma BigInt, which
  // JSON.stringify/NextResponse.json can't serialize natively — cast to a
  // plain number (the table is tiny, nowhere near MAX_SAFE_INTEGER).
  return NextResponse.json({
    companies: companies.map((c) => ({ ...c, id: Number(c.id) })),
  });
}
