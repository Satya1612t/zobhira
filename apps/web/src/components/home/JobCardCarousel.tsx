import type { JobListItem } from "@/lib/jobQuery";
import { JobGridCard } from "@/components/JobGridCard";

const TILE_WIDTH = 280;
const TILE_HEIGHT = 280;
const TILE_GAP = 10;

const DWELL_SECONDS = 2.6; // how long each card sits front-and-center
const TURN_SECONDS = 0.9; // how long the step to the next card takes

// A ring of real job tiles, one shown front-and-center at a time — each tile
// sits around a circle via rotateY(angle) + translateZ(radius) (see
// .job-carousel-stage in globals.css), and the whole ring steps forward by
// one card at a time (hold, then a quick turn), rather than spinning
// continuously. Keyframes are generated per-render since the hold/turn split
// depends on how many jobs are passed in. Radius is derived from tile width +
// a fixed gap so tiles sit an even 10px apart, with no wrapping viewport box.
// Tiles reuse JobGridCard itself (same "Posted today" card design), just
// bigger, rather than a bespoke smaller layout.
export function JobCardCarousel({ jobs }: { jobs: JobListItem[] }) {
  if (jobs.length === 0) return null;
  const count = jobs.length;
  const angleStep = 360 / count;
  const radius = Math.round((TILE_WIDTH + TILE_GAP) / 2 / Math.tan(Math.PI / count));

  const stepSeconds = DWELL_SECONDS + TURN_SECONDS;
  const totalSeconds = stepSeconds * count;
  const stops: string[] = [];
  for (let i = 0; i <= count; i++) {
    const angle = i * angleStep;
    const holdStart = (i * stepSeconds / totalSeconds) * 100;
    const holdEnd = (i * stepSeconds + DWELL_SECONDS) / totalSeconds * 100;
    if (i === 0) {
      stops.push(`0% { transform: rotateY(0deg); }`);
    } else {
      stops.push(`${holdStart.toFixed(3)}% { transform: rotateY(${angle}deg); }`);
    }
    if (i < count) {
      stops.push(`${holdEnd.toFixed(3)}% { transform: rotateY(${angle}deg); }`);
    }
  }
  stops.push(`100% { transform: rotateY(360deg); }`);
  const keyframesCss = `@keyframes job-carousel-steps { ${stops.join(" ")} }`;

  return (
    <div
      className="job-carousel-viewport"
      style={{
        position: "relative",
        height: TILE_HEIGHT + 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: keyframesCss }} />
      {/* Static ground shadow — stays put while the stage above spins, so it
          reads as one shadow cast by the whole assembly onto a surface,
          not a shadow attached to any single (rotating) card. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 8,
          width: TILE_WIDTH * 0.82,
          height: 28,
          transform: "translateX(-50%)",
          background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(11,20,32,0.28), transparent 72%)",
          filter: "blur(3px)",
          zIndex: 0,
        }}
      />

      <div
        className="job-carousel-stage"
        style={{
          position: "relative",
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          zIndex: 1,
          animation: `job-carousel-steps ${totalSeconds}s ease-in-out infinite`,
        }}
      >
        {jobs.map((job, i) => (
          <div
            key={job.id}
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              transform: `rotateY(${i * angleStep}deg) translateZ(${radius}px)`,
              boxShadow: "var(--shadow-lg)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <JobGridCard job={job} />
          </div>
        ))}
      </div>
    </div>
  );
}
