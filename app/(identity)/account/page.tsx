import { redirect } from "next/navigation";
import { AccountLogout, IdentityForm } from "@/features/identity/forms";
import { privatePageMetadata, publicAccount } from "@/features/identity/page";

export const metadata = privatePageMetadata("Your account");

export default async function Account() {
  const user = await publicAccount();
  if (!user) redirect("/login");
  return <div className="shell content-page identity-page">
    <header className="page-intro"><p className="eyebrow">PALONEX ACCOUNT</p><h1>Your account</h1></header>
    <div className="identity-grid">
      <section className="card">
        <h2>Profile</h2>
        <p>{user.email} · Verified email</p>
        <p>Member since {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(user.createdAt)}</p>
        <IdentityForm mode="profile" name={user.name} />
      </section>
      <section className="card">
        <h2>Account security</h2>
        <p>Public sessions expire after seven days. Changing the password signs out other sessions.</p>
        <IdentityForm mode="password" />
        <div className="identity-links"><AccountLogout /></div>
      </section>
      <section className="card"><h2>Product memberships</h2><p>No product memberships yet. Your PaLoNex identity is ready for future products as they open.</p></section>
    </div>
  </div>;
}
