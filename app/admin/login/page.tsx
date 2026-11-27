import { LoginForm } from "@/features/admin/auth-controls";

export default function AdminLogin() {
  return <div className="shell admin-shell">
    <section className="card admin-login">
      <p className="eyebrow">PALONEX HQ</p>
      <h1>Staff sign-in</h1>
      <p className="lede">Enter your administrator credentials to open the internal console.</p>
      <LoginForm />
    </section>
  </div>;
}
