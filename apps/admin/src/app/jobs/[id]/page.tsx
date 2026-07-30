import { AdminJobDetail } from "@/components/AdminJobDetail";

export default function JobDetailPage({ params }: { params: { id: string } }) {
  return <AdminJobDetail id={params.id} />;
}
