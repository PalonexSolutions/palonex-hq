import Link from "next/link";
import { IdentityForm } from "@/features/identity/forms";
import { IdentityPanel, privatePageMetadata } from "@/features/identity/page";

export const metadata = privatePageMetadata("Forgot password");

export default function ForgotPassword() {
  return <IdentityPanel title="Forgot password?" description="Request a single-use password reset link for your account email.">
    <IdentityForm mode="forgot" />
    <div className="identity-links"><Link href="/login">Back to login</Link></div>
  </IdentityPanel>;
}
