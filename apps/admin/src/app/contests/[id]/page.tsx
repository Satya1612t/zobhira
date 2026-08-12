import { AdminContestDetail } from "@/components/AdminContestDetail";

export default function ContestDetailPage({ params }: { params: { id: string } }) {
  return <AdminContestDetail id={params.id} />;
}
