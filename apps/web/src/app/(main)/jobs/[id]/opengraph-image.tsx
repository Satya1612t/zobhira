import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Job listing on Zobhira";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: { title: true, company: true, location: true, workplaceType: true },
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
          background: "linear-gradient(135deg, #003366 0%, #0a4d92 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 700 }}>Zobhira</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            {job?.title ?? "Job listing"}
          </div>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>
            {[job?.company, job?.location].filter(Boolean).join(" · ")}
            {job?.workplaceType && job.workplaceType !== "unknown" ? ` · ${job.workplaceType}` : ""}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
