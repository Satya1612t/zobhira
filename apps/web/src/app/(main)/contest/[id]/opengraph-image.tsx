import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Contest listing on Zobhira";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    select: { title: true, organizer: true, mode: true },
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #f0a202 0%, #ffca4d 100%)",
          color: "#1a1200",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 700 }}>Zobhira</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            {contest?.title ?? "Contest listing"}
          </div>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.8 }}>
            {[contest?.organizer, contest?.mode].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
