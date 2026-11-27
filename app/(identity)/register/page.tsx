import Link from "next/link";
import { IdentityForm } from "@/features/identity/forms";
import { IdentityPanel, privatePageMetadata, redirectSignedIn } from "@/features/identity/page";

export const metadata = privatePageMetadata("Create a PaLoNex account", "Register for a PaLoNex account and verify your email address.");

export default async function Register() {
  await redirectSignedIn();
  return <IdentityPanel title="Create your account" description="Create a PaLoNex identity for HQ and future ecosystem products.">
    <IdentityForm mode="register" />
    <div className="identity-links"><Link href="/login">Already registered? Log in</Link></div>
  </IdentityPanel>;
}
