import { timingSafeEqual } from "node:crypto";

// Shared-secret gate for the n8n dispatch endpoints. n8n calls these from
// inside the compose network (http://web:3000) with an
// `X-Dispatch-Key: <secret>` header. Structurally mirrors apps/admin's
// requireAdmin (verify header → return null-on-success or a ready-to-send
// Response), but there's no Firebase/human identity here — it's service-to-
// service, so a single high-entropy shared secret is the right primitive.
export function requireDispatchKey(request: Request): Response | null {
  const expected = process.env.DISPATCH_API_KEY ?? "";
  const provided = request.headers.get("x-dispatch-key") ?? "";

  // Fail closed if unconfigured, so a missing env var never accidentally
  // allows an empty-string match.
  if (!expected) {
    return json({ error: "Dispatch auth not configured" }, 503);
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on unequal-length buffers, so length-check first;
  // an unequal length is itself just "not a match", not an error.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ error: "Invalid dispatch key" }, 401);
  }

  return null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
