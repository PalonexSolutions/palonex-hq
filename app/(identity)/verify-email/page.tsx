import Link from "next/link";
import { IdentityForm } from "@/features/identity/forms";
import { IdentityPanel, privatePageMetadata } from "@/features/identity/page";

export const metadata = privatePageMetadata("Verify email");

export default function VerifyEmail() {
  return <IdentityPanel title="Verify your email" description="Open your emailed verification link and confirm below.">
    <IdentityForm mode="verify" />
    <section className="identity-resend">
      <h2>Need a new link?</h2>
      <IdentityForm mode="resend" />
    </section>
    <div className="identity-links"><Link href="/login">Log in</Link></div>
  </IdentityPanel>;
}
