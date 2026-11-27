import Link from "next/link";
import { IdentityForm } from "@/features/identity/forms";
import { IdentityPanel, privatePageMetadata, redirectSignedIn } from "@/features/identity/page";

export const metadata = privatePageMetadata("Log in", "Sign in to your PaLoNex account.");

export default async function Login() {
  await redirectSignedIn();
  return <IdentityPanel title="Log in" description="Sign in with your verified PaLoNex email address.">
    <IdentityForm mode="login" />
    <div className="identity-links"><Link href="/forgot-password">Forgot password?</Link><Link href="/verify-email">Resend verification</Link><Link href="/register">Create an account</Link></div>
  </IdentityPanel>;
}
