import Link from "next/link";
import { IdentityForm } from "@/features/identity/forms";
import { IdentityPanel, privatePageMetadata } from "@/features/identity/page";

export const metadata = privatePageMetadata("Reset password");

export default function ResetPassword() {
  return <IdentityPanel title="Reset password" description="Open your emailed link, then choose a new password. A successful reset signs out existing sessions.">
    <IdentityForm mode="reset" />
    <div className="identity-links"><Link href="/forgot-password">Request another link</Link><Link href="/login">Log in</Link></div>
  </IdentityPanel>;
}
