import type { Metadata } from "next";
import { ProseLayout, type TocEntry } from "@/components/ProseLayout";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply to using Zobhira to find jobs and contests.",
};

const TOC: TocEntry[] = [
  { id: "what-zobhira-is", label: "What Zobhira is" },
  { id: "accuracy", label: "Accuracy of listings" },
  { id: "using-zobhira", label: "Using Zobhira" },
  { id: "accounts", label: "Accounts" },
  { id: "contests", label: "Contests" },
  { id: "ip", label: "Intellectual property" },
  { id: "liability", label: "Limitation of liability" },
  { id: "changes", label: "Changes to these terms" },
  { id: "law", label: "Governing law" },
  { id: "contact", label: "Contact us" },
];

export default function TermsPage() {
  return (
    <main className="container" style={{ paddingBlock: 40 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 8px" }}>
        Terms &amp; Conditions
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-faint)", fontSize: 12.5, marginBottom: 24 }}>
        Last updated: July 2026
      </p>

      <ProseLayout toc={TOC}>
        <div className="prose-summary-card">
          <span className="kicker" style={{ marginBottom: 8, display: "block" }}>In short</span>
          <p style={{ margin: 0 }}>
            Zobhira is a listings board, not the employer or contest organizer for anything shown
            here. Always confirm details with the original poster before you apply.
          </p>
        </div>

        <p className="prose-lede">
          These terms govern your use of Zobhira, a board of open jobs and contests updated every
          morning. By using the site, you agree to them.
        </p>

        <h2 id="what-zobhira-is" className="prose-h2">1. What Zobhira is</h2>
        <p>Zobhira is a listings board. We show job postings and contest announcements in one searchable place. We are not the employer or contest organizer for anything listed here, and we don&apos;t guarantee that any listing results in an interview, a win, or a job offer.</p>

        <h2 id="accuracy" className="prose-h2">2. Accuracy of listings</h2>
        <p>Listings are checked on a schedule and may change or close after we&apos;ve last checked them. Deadlines, salary figures, and eligibility criteria can shift on the original listing faster than we can re-check them. Always confirm details (location, timing, eligibility, and how to apply) with the original poster before you apply.</p>

        <h2 id="using-zobhira" className="prose-h2">3. Using Zobhira</h2>
        <p>You agree to use Zobhira only for its intended purpose: finding jobs and contests. You agree not to:</p>
        <ul>
          <li>Copy or redistribute listings from this site at scale</li>
          <li>Use automated tools to overload or disrupt the platform</li>
          <li>Submit false information through any form or account on the site</li>
          <li>Use the platform for any unlawful purpose</li>
        </ul>

        <h2 id="accounts" className="prose-h2">4. Accounts</h2>
        <p>If you create an account, you&apos;re responsible for keeping your login details secure and for activity that happens under your account. Tell us if you believe your account has been accessed without your permission.</p>

        <h2 id="contests" className="prose-h2">5. Contests</h2>
        <p>Contests shown on Zobhira are run entirely by their own organizers. Entry rules, judging, and prizes are decided and administered by that organizer, not by Zobhira. Any dispute about a contest is between you and its organizer.</p>

        <h2 id="ip" className="prose-h2">6. Intellectual property</h2>
        <p>The Zobhira name, logo, and site design belong to Zobhira. Listing content belongs to its original poster and is shown here to help you find it, not to claim it as our own.</p>

        <h2 id="liability" className="prose-h2">7. Limitation of liability</h2>
        <p>Zobhira is provided &quot;as is.&quot; To the extent permitted by law, we aren&apos;t liable for losses arising from outdated listings, a contest you didn&apos;t win, or any decision made based on information found through the platform.</p>

        <h2 id="changes" className="prose-h2">8. Changes to these terms</h2>
        <p>We may update these terms as the platform changes. Continued use of Zobhira after an update means you accept the revised terms.</p>

        <h2 id="law" className="prose-h2">9. Governing law</h2>
        <p>These terms are governed by the laws of India, and any dispute is subject to the jurisdiction of the courts in Indore, Madhya Pradesh.</p>

        <h2 id="contact" className="prose-h2">10. Contact us</h2>
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
