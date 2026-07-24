import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDispatchKey } from "@/lib/dispatchAuth";

const VALID_PLATFORMS = ["telegram", "whatsapp", "instagram", "youtube"];
const VALID_TYPES = ["job", "contest"];

export async function POST(request: NextRequest) {
  const denied = requireDispatchKey(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const platform = body?.platform;
  const contentType = body?.contentType;
  const contentId = body?.contentId;

  if (
    typeof contentId !== "string" ||
    !contentId ||
    !VALID_PLATFORMS.includes(platform) ||
    !VALID_TYPES.includes(contentType)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.dispatchLog.upsert({
    where: { contentType_contentId_platform: { contentType, contentId, platform } },
    update: { postedAt: new Date(), attempts: { increment: 1 } },
    create: { contentType, contentId, platform, postedAt: new Date(), attempts: 1 },
  });

  return NextResponse.json({ ok: true });
}
