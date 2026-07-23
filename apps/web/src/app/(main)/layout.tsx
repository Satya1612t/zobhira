import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

// Route group (no URL segment) — every page, including /login, gets the
// persistent navbar/footer shell (see /DESIGN.md); AppShell additionally
// drops the Sidebar specifically on /login.
export default function MainLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
