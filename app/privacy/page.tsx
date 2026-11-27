import type { Metadata } from "next";
import { PageIntro } from "@/components/site";
import { privacyVersion } from "@/features/enquiries/constants";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How PaLoNex Solutions handles accounts, business enquiries and website preferences.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <div className="shell content-page">
    <PageIntro label="PRIVACY" title="Privacy policy">Accounts, business enquiries and website preferences. Effective {privacyVersion}.</PageIntro>
    <section className="section">
      <h2>Business enquiries</h2>
      <p className="lede">Palonex Solutions Private Limited uses the details you submit to review, respond to and track your enquiry. We record the consent time and policy version. Please avoid including sensitive personal information in the message.</p>
      <p className="lede">Authorized staff review enquiries. If email notifications are enabled, our email provider receives the details needed to send an acknowledgement or notify staff. The message itself stays in the enquiry database. We use short-lived hashed identifiers to limit abuse.</p>
    </section>
    <section className="section">
      <h2>PaLoNex accounts</h2>
      <p className="lede">We use your name, email, consent and security records to operate and protect your account. Our email provider receives the data needed to deliver verification and recovery messages. Authorized staff may review account status and record administrative changes. Contact us to request correction or deletion of account data.</p>
    </section>
    <section className="section">
      <h2>Retention and requests</h2>
      <p className="lede">Our standard retention period for enquiries is 365 days, subject to operational or legal needs. To ask about your data, submit a business enquiry with your reference number if you have one.</p>
    </section>
    <section className="section">
      <h2>Browser storage</h2>
      <p className="lede">This site stores your theme preference in this browser. Engineering Tools process text and files locally and do not retain your inputs.</p>
    </section>
  </div>;
}
