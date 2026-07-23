import { requireAdmin } from "@/lib/firebase-admin";

// Lets the client ask "is the signed-in user actually allowed in" without
// exposing the admin allowlist itself to client-side code — the allowlist
// stays server-only (see requireAdmin), this just returns a yes/no.
export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if (result instanceof Response) return result;
  return Response.json({ allowed: true, email: result.email });
}
