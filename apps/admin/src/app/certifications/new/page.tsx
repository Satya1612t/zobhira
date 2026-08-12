import { CertificationEditor } from "@/components/CertificationEditor";

export default function NewCertificationPage() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Add a certification manually. It&apos;s created as a draft — you&apos;ll fill in the rest and
        publish on the next screen.
      </p>
      <CertificationEditor />
    </div>
  );
}
