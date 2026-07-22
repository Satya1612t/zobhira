import type { Prisma } from "@prisma/client";

// Explicit select from day one (unlike jobQuery.ts's JOB_SELECT, which had
// to be retrofitted later) — excludes raw/dedupKey/extractionMethod/
// timestamps, none of which the frontend ever renders.
export const CONTEST_SELECT = {
  id: true,
  title: true,
  platform: true,
  organizer: true,
  mode: true,
  prizeAmount: true,
  prizeCurrency: true,
  prizeSummary: true,
  source: true,
  sourceUrl: true,
  description: true,
  summary: true,
  highlights: true,
  tags: true,
  startsAt: true,
  deadlineAt: true,
  logoUrl: true,
  isActive: true,
} satisfies Prisma.ContestSelect;

export type ContestListItem = Prisma.ContestGetPayload<{ select: typeof CONTEST_SELECT }>;

export type ContestSearchParams = {
  platform?: string;
};

// No India-scope default, no keyword/experience/workplace concepts —
// contests aren't location- or query-taxonomy driven the way jobs are.
export function buildContestsWhere({ platform }: ContestSearchParams): Prisma.ContestWhereInput {
  return {
    isActive: true,
    ...(platform ? { platform } : {}),
  };
}

// Soonest-deadline-first is the natural default for "what can I still
// enter" — nulls-last is required explicitly, since Postgres/Prisma would
// otherwise bubble null-deadline rows (DEV Community source) to the very
// top of an ascending sort.
export const CONTEST_ORDER_BY: Prisma.ContestOrderByWithRelationInput[] = [
  { deadlineAt: { sort: "asc", nulls: "last" } },
  { id: "desc" },
];
