import { AdminSourcesTable } from "@/components/AdminSourcesTable";
import { AdminDangerZone } from "@/components/AdminDangerZone";

export default function SourcesPage() {
  return (
    <div>
      <AdminSourcesTable />
      <AdminDangerZone />
    </div>
  );
}
