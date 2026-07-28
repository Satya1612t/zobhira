import type { Metadata } from "next";
import { ProseLayout, type TocEntry } from "@/components/ProseLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Zobhira collects, uses, and protects your information across jobs and contests.",
};

const TOC: TocEntry[] = [
  { id: "what-we-collect", label: "What we collect" },
  { id: "what-we-dont-collect", label: "What we don't collect" },
  { id: "listing-data", label: "Listing data" },
  { id: "how-we-use-it", label: "How we use it" },
  { id: "retention", label: "Data retention" },
  { id: "children", label: "Children's privacy" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact us" },
];

const DATA_TABLE = [
  { category: "Search activity", usedFor: "Show your \"Recent searches\" panel", retention: "Until you clear it" },
  { category: "Account information", usedFor: "Save roles, sync your applications", retention: "Until account deletion" },
  { category: "Contact form submissions", usedFor: "Respond to your message", retention: "As long as needed to respond" },
];

export default function PrivacyPage() {
  return (
    <main className="container" style={{ paddingBlock: 40 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 8px" }}>
        Privacy Policy
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-faint)", fontSize: 12.5, marginBottom: 24 }}>
        Last updated: July 2026
      </p>

      <ProseLayout toc={TOC}>
        <div className="prose-summary-card">
          <span className="kicker" style={{ marginBottom: 8, display: "block" }}>In short</span>
          <p style={{ margin: 0 }}>
            We store the text of your searches, and, only if you create an account, your name,
            email, and saved activity. We never sell your data or track you across other sites.
            Job and contest listing data belongs to the original poster, not us.
          </p>
        </div>

        <p className="prose-lede">
          Zobhira (&quot;we,&quot; &quot;us,&quot; &quot;the platform&quot;) is a searchable board
          of job listings and contests. This policy explains what information we collect from you,
          how we use it, and who to contact if you have questions.
        </p>

        <h2 id="what-we-collect" className="prose-h2">1. What we collect</h2>
        <p><strong>Search activity.</strong> The text of searches you run is stored so the &quot;Recent searches&quot; panel can show them again later. No account, name, or contact detail is attached to a stored search.</p>
        <p><strong>Account information.</strong> If you create an account to save roles or track applications, we store the details you provide for that purpose: your name, email, and the activity tied to your account.</p>
        <p><strong>Contact form submissions.</strong> If you reach out through the Contact page or by phone, we keep what you send us so we can respond.</p>

        <h2 id="what-we-dont-collect" className="prose-h2">2. What we don&apos;t collect</h2>
        <p>We don&apos;t track you across other websites, sell your data to third parties, or run advertising trackers on this site.</p>

        <div className="prose-table-wrap">
          <table className="prose-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>What it&apos;s used for</th>
                <th>Retention</th>
              </tr>
            </thead>
            <tbody>
              {DATA_TABLE.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{row.usedFor}</td>
                  <td>{row.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="listing-data" className="prose-h2">3. Job and contest data</h2>
        <p>Listings shown on Zobhira are checked and updated on a recurring schedule. This data belongs to the original poster. Zobhira displays it to help you find it faster and does not alter its substance. We link back to the original listing wherever one is available.</p>

        <h2 id="how-we-use-it" className="prose-h2">4. How we use what we collect</h2>
        <p>Solely to run the platform: showing your recent searches back to you, keeping your account and saved roles in sync, and responding when you contact us. We don&apos;t use your information for anything beyond that.</p>

        <h2 id="retention" className="prose-h2">5. Data retention</h2>
        <p>Search history and account data are kept for as long as your account is active. You can request deletion at any time using the contact details below.</p>

        <h2 id="children" className="prose-h2">6. Children&apos;s privacy</h2>
        <p>Zobhira is built for students and working professionals and is not directed at children under 13. We don&apos;t knowingly collect information from children under 13.</p>

        <h2 id="changes" className="prose-h2">7. Changes to this policy</h2>
        <p>If how we handle your data changes, we&apos;ll update this page and change the date above.</p>

        <h2 id="contact" className="prose-h2">8. Contact us</h2>
        <p>Questions about this policy or your data can be sent to us at our Indore office, by phone, or by email:</p>
        <p style={{ margin: 0 }}>
          Zobhira, Vijay Nagar, Indore, Madhya Pradesh, India
          <br />
          <a href="tel:+919131753246">+91 91317 53246</a>
          {" · "}
          <a href="tel:+917000232707">+91 70002 32707</a>
          <br />
          <a href="mailto:naukri.intech@gmail.com">naukri.intech@gmail.com</a>
        </p>
      </ProseLayout>
    </main>
  );
}
