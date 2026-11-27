import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/site";
import { consentVersion } from "@/features/identity/schema";

export const metadata: Metadata = { title: "Account terms", alternates: { canonical: "/terms" } };

export default function Terms() {
  return <div className="shell content-page">
    <PageIntro label="TERMS" title="PaLoNex account terms">Effective {consentVersion}.</PageIntro>
    <section className="section">
      <h2>Using your account</h2>
      <p className="lede">Keep control of your sign-in credentials, use an email address you control, and avoid abuse or unauthorized access. PaLoNex Solutions Private Limited may suspend accounts to protect the service and its users.</p>
      <p className="lede">A PaLoNex HQ account allows you to manage your HQ profile. Future products may have separate eligibility requirements or terms.</p>
      <p className="lede">For information about account data, see the <Link className="text-link" href="/privacy">privacy policy</Link>.</p>
    </section>
  </div>;
}
