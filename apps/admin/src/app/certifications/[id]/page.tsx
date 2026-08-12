import Link from "next/link";
import { CertificationEditor } from "@/components/CertificationEditor";

export default function EditCertificationPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Link href="/certifications" style={{ fontSize: 13, color: "var(--ink-muted)", textDecoration: "none" }}>
        ← Back to certifications
      </Link>
      <div style={{ height: 12 }} />
      <CertificationEditor certId={params.id} />
    </div>
  );
}
