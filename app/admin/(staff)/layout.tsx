import Link from "next/link";
import { adminPage } from "@/features/admin/access";
import { LogoutButton } from "@/features/admin/auth-controls";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await adminPage();
  return <div className="shell admin-shell">
    <header className="admin-header">
      <div><p className="eyebrow">PALONEX HQ ADMIN</p><p className="admin-staff-name">{staff.name}</p></div>
      <nav aria-label="Admin navigation">
        <Link href="/admin" prefetch={false}>Overview</Link>
        <Link href="/admin/enquiries" prefetch={false}>Enquiries</Link>
        <Link href="/admin/notifications" prefetch={false}>Notifications</Link>
        <Link href="/admin/accounts" prefetch={false}>Public accounts</Link>
      </nav>
      <LogoutButton />
    </header>
    {children}
  </div>;
}
