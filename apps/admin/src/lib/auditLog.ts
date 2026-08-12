import "server-only";
import { prisma } from "@/lib/prisma";

type AuditAction =
  | "job.delete"
  | "job.set_active"
  | "job.clear_all"
  | "contest.delete"
  | "contest.set_active"
  | "contest.clear_all"
  | "source.set_enabled"
  | "scheduler.trigger"
  | "contest_scheduler.trigger"
  | "feed_scheduler.trigger"
  | "company.add"
  | "company.set_active"
  | "company.delete"
  | "analytics.clear"
  | "certification.create"
  | "certification.update"
  | "certification.publish"
  | "certification.unpublish"
  | "certification.delete";

type AuditTargetType = "job" | "contest" | "source" | "scheduler" | "company" | "analytics" | "certification";

// Fire-and-forget by design: a logging failure must never block or fail the
// admin action it's recording. Errors are swallowed (not silently ignored —
// logged to stderr) rather than surfaced to the caller.
export function writeAuditLog(params: {
  adminEmail: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const { adminEmail, action, targetType, targetId, metadata } = params;
  prisma.adminAuditLog
    .create({ data: { adminEmail, action, targetType, targetId, metadata } })
    .catch((error) => {
      console.error("[auditLog] failed to record", action, targetType, targetId, error);
    });
}
